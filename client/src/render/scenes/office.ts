import * as THREE from 'three';
import { COSMETICS_BY_ID, type DoorId, type StationId } from '@fnaf/shared';
import { checkerFloor, confettiWall, ceilingTiles, metalTex, posterTex, stripesTex, woodTex, signTex } from '../textures';
import { plain, glow, textured, dirty } from '../materials';
import { volumetricCone, dustMotes, driftMotes, Flicker, SparkSystem } from '../fx/effects';
import { buildCharacter, type CharacterRig } from '../characters/build';
import { store } from '../../store';

export interface OfficeDoor {
  id: DoorId;
  side: 'left' | 'right';
  kind: 'door' | 'vent';
  slab: THREE.Mesh;
  doorButton: THREE.Mesh;
  lightButton: THREE.Mesh;
  spot: THREE.SpotLight;
  cone: THREE.Mesh;
  motes: THREE.Points;
  closedT: number; // 0 open .. 1 closed (animated)
  target: number;
  /** World positions outside the door. */
  blindSpot: THREE.Vector3;
  inside: THREE.Vector3;
  far: THREE.Vector3;
}

export interface OfficeScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  doors: OfficeDoor[];
  bulb: THREE.PointLight;
  bulbMesh: THREE.Mesh;
  fan: THREE.Group;
  nose: THREE.Mesh;
  phone: THREE.Mesh;
  monitorLight: THREE.PointLight;
  flashlight: THREE.SpotLight | null;
  flashCone: THREE.Mesh | null;
  ambient: THREE.AmbientLight;
  sparks: SparkSystem;
  characters: Map<string, CharacterRig>;
  hands: THREE.Group;
  maskOverlay: THREE.Mesh;
  flickers: Flicker[];
  /** Set a character's placement for this frame, or remove it. */
  place(id: string, where: { pos: THREE.Vector3; rotY: number; pose: Parameters<CharacterRig['pose']>[0]; eyesOnly?: boolean } | null): void;
  update(dt: number, t: number): void;
  setDoor(id: DoorId, closed: boolean): void;
  swing(): void;
  clickables(): THREE.Object3D[];
  dispose(): void;
}

const ROOM_W = 6;
const ROOM_D = 5.5;
const ROOM_H = 3;
const DOOR_Z = -0.9;

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number], parent: THREE.Object3D, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export interface OfficeSpec {
  station: StationId;
  doors: { id: DoorId; side: 'left' | 'right'; kind: 'door' | 'vent' }[];
  decor: string;
  guardEquip: Record<string, string>;
  shadowSize: number;
  leaderName: string;
}

export function buildOffice(spec: OfficeSpec): OfficeScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#000000');
  scene.fog = new THREE.FogExp2('#000000', 0.06);
  const camera = new THREE.PerspectiveCamera(spec.station === 'control' ? 72 : 70, 16 / 9, 0.05, 60);
  camera.position.set(0, 1.15, 1.4);

  const decor = String(COSMETICS_BY_ID[spec.decor]?.params.theme ?? 'default');
  const room = new THREE.Group();
  scene.add(room);

  // Floor, ceiling, walls.
  const f = checkerFloor(3);
  const floorMat = new THREE.MeshStandardMaterial({ map: f.map, normalMap: f.normal, roughnessMap: f.rough, roughness: 0.8 });
  const floor = mesh(new THREE.PlaneGeometry(24, 12), floorMat, [0, 0, 0], room, false);
  floor.rotation.x = -Math.PI / 2;
  const ceil = mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), textured('ceil', ceilingTiles(5)), [0, ROOM_H, -0.5], room, false);
  ceil.rotation.x = Math.PI / 2;
  const wallMat = textured(`wall:${spec.station}`, confettiWall(spec.station.length, spec.station === 'control' ? '#2a3a3a' : '#3a2f4a'));
  const back = mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_H), wallMat, [0, ROOM_H / 2, -ROOM_D / 2 - 0.5], room, false);
  void back;
  const hasDoor = (side: 'left' | 'right') => spec.doors.find((d) => d.side === side);
  for (const side of ['left', 'right'] as const) {
    const x = side === 'left' ? -ROOM_W / 2 : ROOM_W / 2;
    const rot = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
    const d = hasDoor(side);
    if (!d) {
      const w = mesh(new THREE.PlaneGeometry(ROOM_D, ROOM_H), wallMat, [x, ROOM_H / 2, -0.5], room, false);
      w.rotation.y = rot;
      continue;
    }
    const gapW = d.kind === 'vent' ? 1.1 : 1.5;
    const gapH = d.kind === 'vent' ? 1.0 : 2.5;
    const zStart = -0.5 - ROOM_D / 2;
    const zEnd = -0.5 + ROOM_D / 2;
    const g0 = DOOR_Z - gapW / 2;
    const g1 = DOOR_Z + gapW / 2;
    // Wall pieces around the opening.
    const pieces: [number, number, number, number][] = [
      [zStart, g0, 0, ROOM_H],
      [g1, zEnd, 0, ROOM_H],
      [g0, g1, gapH, ROOM_H],
    ];
    if (d.kind === 'vent') pieces.push([g0, g1, 0, 0.12]);
    for (const [a, b, y0, y1] of pieces) {
      const w = mesh(new THREE.PlaneGeometry(b - a, y1 - y0), wallMat, [x, (y0 + y1) / 2, (a + b) / 2], room, false);
      w.rotation.y = rot;
    }
    // Door frame with warning stripes.
    const frameM = textured('stripes', stripesTex(), { roughness: 0.6, metalness: 0.3 });
    const sx = side === 'left' ? 1 : -1;
    for (const z of [g0, g1]) mesh(new THREE.BoxGeometry(0.12, gapH, 0.1), frameM, [x + sx * 0.02, gapH / 2, z], room);
    mesh(new THREE.BoxGeometry(0.12, 0.12, gapW + 0.1), frameM, [x + sx * 0.02, gapH + 0.06, DOOR_Z], room);
    // Outside: a dark corridor (or a vent duct).
    const out = new THREE.Group();
    room.add(out);
    if (d.kind === 'vent') {
      const duct = metalTex(31, 'rust', '#4a4a4a');
      const dm = new THREE.MeshStandardMaterial({ map: duct.map, normalMap: duct.normal, roughness: 0.6, metalness: 0.7, side: THREE.BackSide });
      mesh(new THREE.BoxGeometry(5, 1, 1.1), dm, [x - sx * 2.5, 0.5, DOOR_Z], out, false);
    } else {
      const hallLen = 12;
      const hall = new THREE.Mesh(new THREE.BoxGeometry(hallLen, gapH + 0.4, 2.4), new THREE.MeshStandardMaterial({ map: confettiWall(17, '#2a2238'), side: THREE.BackSide, roughness: 0.95 }));
      hall.position.set(side === 'left' ? x - hallLen / 2 : x + hallLen / 2, (gapH + 0.4) / 2, DOOR_Z);
      hall.receiveShadow = true;
      out.add(hall);
      // Posters down the hall.
      for (let i = 0; i < 3; i++) {
        const p = mesh(new THREE.PlaneGeometry(0.5, 0.7), textured(`hp${i}${side}`, posterTex(i === 1 ? 'celebrate' : 'drawing', 30 + i)), [0, 1.5, 0], out, false);
        p.position.set(side === 'left' ? x - 2 - i * 3 : x + 2 + i * 3, 1.5, DOOR_Z + 1.18);
        p.rotation.y = Math.PI;
      }
    }
  }

  // Desk.
  const deskMat = new THREE.MeshStandardMaterial({ map: woodTex(8, '#4a3020'), roughness: 0.7 });
  const desk = new THREE.Group();
  desk.position.set(0, 0, -0.55);
  room.add(desk);
  mesh(new THREE.BoxGeometry(2.8, 0.06, 0.9), deskMat, [0, 0.78, 0], desk);
  for (const x of [-1.3, 1.3]) mesh(new THREE.BoxGeometry(0.08, 0.78, 0.8), deskMat, [x, 0.39, 0], desk);
  mesh(new THREE.BoxGeometry(2.6, 0.6, 0.04), deskMat, [0, 0.45, -0.42], desk);
  // CRT monitor stack.
  const caseM = dirty('#b8b0a0', 0.7);
  const screens: THREE.Mesh[] = [];
  for (const [x, y, sc] of [
    [-0.15, 1.05, 1],
    [0.45, 1.0, 0.75],
    [-0.15, 1.5, 0.8],
  ] as [number, number, number][]) {
    mesh(new THREE.BoxGeometry(0.5 * sc, 0.42 * sc, 0.45 * sc), caseM, [x, y, -0.15], desk);
    const scr = mesh(new THREE.PlaneGeometry(0.4 * sc, 0.3 * sc), glow('#0f2a18', 0.6), [x, y + 0.01, -0.15 + 0.226 * sc], desk, false);
    screens.push(scr);
  }
  const monitorLight = new THREE.PointLight('#5ad890', 0.35, 2.5, 2);
  monitorLight.position.set(0, 1.1, 0.2);
  desk.add(monitorLight);
  // Fan.
  const fan = new THREE.Group();
  fan.position.set(-0.9, 0.81, 0.05);
  desk.add(fan);
  mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.04, 16), plain('#2a2a2a', 0.5, 0.6), [0, 0.02, 0], fan);
  mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 8), plain('#3a3a3a', 0.4, 0.8), [0, 0.17, 0], fan);
  const head = new THREE.Group();
  head.position.set(0, 0.34, 0);
  head.rotation.y = 0.5;
  fan.add(head);
  const blades = new THREE.Group();
  head.add(blades);
  for (let i = 0; i < 3; i++) {
    const b = mesh(new THREE.BoxGeometry(0.08, 0.2, 0.005), plain('#5a5a5a', 0.4, 0.7), [0, 0.1, 0.05], blades);
    b.geometry.translate(0, 0, 0);
    const pivot = new THREE.Group();
    pivot.rotation.z = (i * Math.PI * 2) / 3;
    pivot.add(b);
    blades.add(pivot);
  }
  const cage = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.008, 4, 24), plain('#6a6a6a', 0.4, 0.8));
  cage.position.z = 0.06;
  head.add(cage);
  const blur = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshBasicMaterial({ color: '#6a6a6a', transparent: true, opacity: 0.25 }));
  blur.position.z = 0.052;
  head.add(blur);
  fan.userData.blades = blades;
  fan.userData.blur = blur;
  // Cups, paper, phone.
  mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.12, 12), plain('#c41e1e', 0.5), [0.95, 0.87, 0.1], desk).userData.cup = true;
  mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.12, 12), plain('#e8e8e8', 0.5), [1.05, 0.87, -0.05], desk).userData.cup = true;
  for (let i = 0; i < 4; i++) mesh(new THREE.BoxGeometry(0.21, 0.003, 0.29), plain('#e8e2d0', 0.9), [0.5 + i * 0.03, 0.812 + i * 0.003, 0.25], desk, false).rotation.y = i * 0.3;
  const phone = mesh(new THREE.BoxGeometry(0.22, 0.07, 0.16), plain('#1a1a1a', 0.4), [-0.55, 0.85, 0.25], desk);
  phone.name = 'phone';
  // Decor cosmetics.
  if (decor === 'cupcake' || decor === 'golden') {
    const c = buildCharacter('chica').root; // borrow the cupcake from Chica's tray
    void c;
    const cupcake = new THREE.Group();
    mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.07, 14), plain(decor === 'golden' ? '#c8a030' : '#c88a4a', 0.6, decor === 'golden' ? 0.8 : 0), [0, 0.035, 0], cupcake);
    mesh(new THREE.SphereGeometry(0.075, 14, 10), plain(decor === 'golden' ? '#ffe070' : '#ff7ab8', 0.6, decor === 'golden' ? 0.6 : 0), [0, 0.09, 0], cupcake).scale.y = 0.7;
    for (const x of [-0.025, 0.025]) {
      mesh(new THREE.SphereGeometry(0.016, 8, 6), plain('#fff', 0.3), [x, 0.11, 0.06], cupcake);
      mesh(new THREE.SphereGeometry(0.008, 6, 4), plain('#000', 0.3), [x, 0.11, 0.075], cupcake);
    }
    cupcake.position.set(0.25, 0.81, 0.15);
    desk.add(cupcake);
  }
  if (decor === 'plush') {
    for (const [i, id] of ['freddy', 'bonnie', 'chica', 'foxy'].entries()) {
      const p = buildCharacter(id, store.roster.mode).root;
      p.scale.setScalar(0.12);
      p.position.set(0.7 + i * 0.13, 0.81, 0.3);
      p.rotation.y = -0.3;
      desk.add(p);
    }
  }
  if (decor === 'arcade') {
    mesh(new THREE.BoxGeometry(0.2, 0.35, 0.18), plain('#2a1a5a', 0.5), [1.15, 0.99, -0.2], desk);
    mesh(new THREE.PlaneGeometry(0.15, 0.12), glow('#ff3ad8', 1.5), [1.15, 1.05, -0.109], desk, false);
  }
  const candles: THREE.PointLight[] = [];
  if (decor === 'haunted') {
    for (const x of [-1.2, 1.2]) {
      mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), plain('#f0e8d0', 0.8), [x, 0.87, 0.3], desk);
      const fl = mesh(new THREE.SphereGeometry(0.012, 6, 4), glow('#ffa030', 4), [x, 0.95, 0.3], desk, false);
      void fl;
      const l = new THREE.PointLight('#ffa040', 0.4, 1.5, 2);
      l.position.set(x, 0.97, 0.3);
      desk.add(l);
      candles.push(l);
    }
  }
  if (decor === 'golden') deskMat.color.set('#d8b060');

  // Posters on the back wall: the leader (honk) and rules; kid drawings with that decor.
  const leaderPoster = mesh(new THREE.PlaneGeometry(0.8, 1.1), textured('leaderposter', posterTex('leader', 40, [spec.leaderName])), [-1.2, 1.7, -ROOM_D / 2 - 0.49], room, false);
  void leaderPoster;
  const nose = mesh(new THREE.CircleGeometry(0.035, 12), plain('#c41e1e', 0.5), [-1.2, 1.52, -ROOM_D / 2 - 0.48], room, false);
  nose.name = 'nose';
  mesh(new THREE.PlaneGeometry(0.6, 0.8), textured('rules', posterTex('rules', 41)), [1.0, 1.75, -ROOM_D / 2 - 0.49], room, false);
  if (decor === 'drawings') {
    for (let i = 0; i < 4; i++) mesh(new THREE.PlaneGeometry(0.35, 0.45), textured(`draw${i}`, posterTex('drawing', 50 + i)), [-0.2 + i * 0.4, 2.2 - (i % 2) * 0.1, -ROOM_D / 2 - 0.48], room, false).rotation.z = (i - 1.5) * 0.08;
  }
  if (spec.station === 'control') {
    // The most electrical room in the building: banks of monitors, a breaker box, a cable tray.
    for (let i = 0; i < 5; i++) {
      mesh(new THREE.BoxGeometry(0.45, 0.35, 0.35), caseM, [-1.6 + i * 0.75, 2.05, -ROOM_D / 2 - 0.3], room);
      mesh(new THREE.PlaneGeometry(0.36, 0.26), glow(i % 2 ? '#2a5a3a' : '#3a4a1a', 1), [-1.6 + i * 0.75, 2.05, -ROOM_D / 2 - 0.12], room, false);
    }
    mesh(new THREE.BoxGeometry(0.6, 0.8, 0.12), plain('#4a4a4a', 0.5, 0.6), [-2.6, 1.4, -2.0], room);
    mesh(new THREE.BoxGeometry(5.5, 0.06, 0.3), plain('#3a3a3a', 0.6, 0.7), [0, 2.85, -ROOM_D / 2 - 0.2], room);
    mesh(new THREE.PlaneGeometry(1.4, 0.4), textured('ctrlsign', signTex('MAINTENANCE', '#1a2a1a', '#5af07a')), [0, 2.55, -ROOM_D / 2 - 0.48], room, false);
  }

  // Overhead bulb: warm, dim, shadow-casting, and it sways after door slams.
  const bulbPivot = new THREE.Group();
  bulbPivot.position.set(0, ROOM_H, -0.3);
  room.add(bulbPivot);
  mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.6, 4), plain('#111', 0.5), [0, -0.3, 0], bulbPivot, false);
  const bulbMesh = mesh(new THREE.SphereGeometry(0.05, 12, 8), glow('#ffcc88', 2), [0, -0.62, 0], bulbPivot, false);
  const bulb = new THREE.PointLight('#ffb070', 3.2, 9, 1.6);
  bulb.position.set(0, -0.68, 0);
  bulb.castShadow = true;
  bulb.shadow.mapSize.set(spec.shadowSize, spec.shadowSize);
  bulb.shadow.bias = -0.002;
  bulb.shadow.radius = 4;
  bulbPivot.add(bulb);
  let swingV = 0;
  let swingA = 0;
  const ambient = new THREE.AmbientLight('#20283a', 0.08);
  scene.add(ambient);
  const flickers = [new Flicker(bulb, 3.2, 0.004)];
  const sparks = new SparkSystem(scene);

  // Doors, buttons, door lights.
  const doors: OfficeDoor[] = [];
  const steel = metalTex(19, 'scratched', '#6a6e74');
  const doorMat = new THREE.MeshStandardMaterial({ map: steel.map, normalMap: steel.normal, roughnessMap: steel.rough, metalness: 0.85, roughness: 0.45 });
  for (const d of spec.doors) {
    const sx = d.side === 'left' ? -1 : 1;
    const x = (sx * ROOM_W) / 2;
    const gapW = d.kind === 'vent' ? 1.1 : 1.5;
    const gapH = d.kind === 'vent' ? 1.0 : 2.5;
    const slab = mesh(new THREE.BoxGeometry(0.08, gapH, gapW), doorMat, [x, gapH * 1.5, DOOR_Z], room);
    slab.userData.openY = gapH * 1.5;
    slab.userData.closedY = gapH / 2;
    // Buttons on the wall beside the opening.
    const panelZ = DOOR_Z + gapW / 2 + 0.35;
    const panelY = d.kind === 'vent' ? 1.1 : 1.3;
    mesh(new THREE.BoxGeometry(0.04, 0.5, 0.22), plain('#2a2a2a', 0.5, 0.6), [x - sx * 0.02, panelY, panelZ], room);
    const doorButton = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), new THREE.MeshStandardMaterial({ color: '#7a1010', emissive: '#ff2020', emissiveIntensity: 0.3 }), [x - sx * 0.05, panelY + 0.1, panelZ], room, false);
    doorButton.rotation.z = Math.PI / 2;
    doorButton.name = `door:${d.id}`;
    const lightButton = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), new THREE.MeshStandardMaterial({ color: '#c8c8c8', emissive: '#ffffff', emissiveIntensity: 0.05 }), [x - sx * 0.05, panelY - 0.1, panelZ], room, false);
    lightButton.rotation.z = Math.PI / 2;
    lightButton.name = `light:${d.id}`;
    if (store.settings.colourblind) {
      mesh(new THREE.PlaneGeometry(0.16, 0.06), textured(`lbl:door`, signTex('DOOR', '#000', '#fff')), [x - sx * 0.045, panelY + 0.19, panelZ], room, false).rotation.y = -sx * Math.PI / 2;
      mesh(new THREE.PlaneGeometry(0.16, 0.06), textured(`lbl:light`, signTex('LIGHT', '#000', '#fff')), [x - sx * 0.045, panelY - 0.19, panelZ], room, false).rotation.y = -sx * Math.PI / 2;
    }
    // Door light: cold white spot above the blind spot, with a volumetric beam and dust.
    const blindSpot = new THREE.Vector3(x + sx * (d.kind === 'vent' ? 1.4 : 0.75), 0, DOOR_Z);
    const spot = new THREE.SpotLight('#e8f0ff', 0, 7, 0.65, 0.4, 1.2);
    // Mounted outside, above and to one side: half the face catches the light, half stays in shadow.
    spot.position.set(x + sx * 0.25, d.kind === 'vent' ? gapH - 0.1 : gapH + 0.32, DOOR_Z - (d.kind === 'vent' ? 0 : 0.6));
    spot.target.position.copy(blindSpot).setY(d.kind === 'vent' ? 0.3 : 0.9);
    spot.castShadow = true;
    spot.shadow.mapSize.set(Math.min(1024, spec.shadowSize), Math.min(1024, spec.shadowSize));
    spot.shadow.bias = -0.003;
    room.add(spot, spot.target);
    const cone = volumetricCone('#dfe8ff', gapH + 0.2, 0.9, 0.22);
    cone.position.copy(spot.position);
    cone.lookAt(blindSpot.clone().setY(-1));
    cone.rotateX(-Math.PI / 2);
    cone.visible = false;
    room.add(cone);
    const motes = dustMotes(store.settings.photosensitive ? 0 : 300, new THREE.Vector3(1.2, gapH, 1.2));
    motes.position.set(blindSpot.x, 0, blindSpot.z);
    motes.visible = false;
    room.add(motes);
    doors.push({
      id: d.id,
      side: d.side,
      kind: d.kind,
      slab,
      doorButton,
      lightButton,
      spot,
      cone,
      motes,
      closedT: 0,
      target: 0,
      blindSpot,
      inside: new THREE.Vector3(x - sx * 0.9, 0, DOOR_Z + 0.2),
      far: new THREE.Vector3(x + sx * 3.5, 0, DOOR_Z),
    });
  }

  // West flashlight: a beam straight down the hall.
  let flashlight: THREE.SpotLight | null = null;
  let flashCone: THREE.Mesh | null = null;
  const leftDoor = doors.find((d) => d.side === 'left' && d.kind === 'door');
  if (leftDoor && (spec.station === 'west' || spec.station === 'solo')) {
    const tint = String(COSMETICS_BY_ID[spec.guardEquip.flashlight ?? '']?.params.tint ?? '#fff4d8');
    flashlight = new THREE.SpotLight(tint, 0, 16, 0.32, 0.5, 1);
    flashlight.position.set(-2.4, 1.3, DOOR_Z);
    flashlight.target.position.set(-12, 0.9, DOOR_Z);
    flashlight.castShadow = true;
    room.add(flashlight, flashlight.target);
    flashCone = volumetricCone(tint, 9, 1.4, 0.18);
    flashCone.position.copy(flashlight.position);
    flashCone.rotation.z = -Math.PI / 2;
    flashCone.visible = false;
    room.add(flashCone);
  }

  // First-person hands (uniform colours on the sleeves).
  const hands = new THREE.Group();
  camera.add(hands);
  scene.add(camera);
  const sleeveCol = String(COSMETICS_BY_ID[spec.guardEquip.guard ?? '']?.params.shirt ?? '#2f4f8f');
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.name = side < 0 ? 'handL' : 'handR';
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.4, 10), plain(sleeveCol, 0.8));
    sleeve.rotation.x = Math.PI / 2;
    sleeve.position.z = 0.15;
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), plain('#1a1a1a', 0.7));
    arm.add(sleeve, glove);
    arm.position.set(side * 0.3, -0.45, -0.4);
    arm.visible = false;
    hands.add(arm);
  }

  // Mask overlay (South): the inside of a cheap head, two eye holes.
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = 512;
  maskCanvas.height = 288;
  const mctx = maskCanvas.getContext('2d') as CanvasRenderingContext2D;
  mctx.fillStyle = '#0a0604';
  mctx.fillRect(0, 0, 512, 288);
  mctx.globalCompositeOperation = 'destination-out';
  for (const x of [190, 322]) {
    const g = mctx.createRadialGradient(x, 130, 10, x, 130, 50);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    mctx.fillStyle = g;
    mctx.beginPath();
    mctx.ellipse(x, 130, 52, 40, 0, 0, Math.PI * 2);
    mctx.fill();
  }
  const maskTex = new THREE.CanvasTexture(maskCanvas);
  const maskOverlay = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.225), new THREE.MeshBasicMaterial({ map: maskTex, transparent: true, depthTest: false }));
  maskOverlay.position.set(0, 0, -0.12);
  maskOverlay.renderOrder = 100;
  maskOverlay.visible = false;
  camera.add(maskOverlay);

  const characters = new Map<string, CharacterRig>();
  const placedThisFrame = new Set<string>();

  const office: OfficeScene = {
    scene,
    camera,
    doors,
    bulb,
    bulbMesh,
    fan,
    nose,
    phone,
    monitorLight,
    flashlight,
    flashCone,
    ambient,
    sparks,
    characters,
    hands,
    maskOverlay,
    flickers,
    place(id, where) {
      let rig = characters.get(id);
      if (!where) {
        if (rig) rig.root.visible = false;
        return;
      }
      if (!rig) {
        rig = buildCharacter(id, store.roster.mode);
        characters.set(id, rig);
        scene.add(rig.root);
      }
      rig.root.visible = true;
      rig.root.position.copy(where.pos);
      rig.root.rotation.y = where.rotY;
      rig.pose(where.pose);
      rig.setEyesOnly(Boolean(where.eyesOnly));
      placedThisFrame.add(id);
    },
    update(dt, t) {
      // Fan.
      const blades = fan.userData.blades as THREE.Group;
      const spinning = (fan.userData.speed ?? 1) as number;
      blades.rotation.z += dt * 40 * spinning;
      (fan.userData.blur as THREE.Mesh).visible = spinning > 0.5;
      // Doors slide with a little bounce.
      for (const d of doors) {
        const k = Math.min(1, dt / 0.25);
        const prev = d.closedT;
        d.closedT += (d.target - d.closedT) * (d.target > d.closedT ? Math.min(1, k * 2.2) : k * 1.4);
        if (d.target === 1 && prev < 0.98 && d.closedT >= 0.98) d.closedT = 1.03;
        const y0 = d.slab.userData.openY as number;
        const y1 = d.slab.userData.closedY as number;
        d.slab.position.y = y0 + (y1 - y0) * Math.min(1.03, d.closedT);
        if (d.motes.visible) driftMotes(d.motes, t);
        const cm = d.cone.material as THREE.ShaderMaterial;
        cm.uniforms.time.value = t;
      }
      // Bulb sway.
      swingV += -swingA * 6 * dt - swingV * 0.6 * dt;
      swingA += swingV * dt;
      bulbPivot.rotation.z = swingA;
      bulbPivot.rotation.x = swingA * 0.4;
      for (const fl of flickers) fl.update(dt, t);
      for (const c of candles) c.intensity = 0.3 + Math.random() * 0.2;
      for (const s of screens) (s.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + Math.sin(t * 50) * 0.03;
      sparks.update(dt);
      for (const [id, rig] of characters) {
        if (!placedThisFrame.has(id)) rig.root.visible = false;
        else {
          rig.tick(t);
          if (rig.sparkRate > 0 && Math.random() < rig.sparkRate * dt && rig.sparkPoints.length) {
            const sp = rig.sparkPoints[Math.floor(Math.random() * rig.sparkPoints.length)];
            sparks.burst(sp.getWorldPosition(new THREE.Vector3()), 10);
          }
        }
      }
      placedThisFrame.clear();
    },
    setDoor(id, closed) {
      const d = doors.find((x) => x.id === id);
      if (d) d.target = closed ? 1 : 0;
    },
    swing() {
      swingV += (Math.random() - 0.5) * 1.2;
    },
    clickables() {
      return [...doors.flatMap((d) => [d.doorButton, d.lightButton]), nose, phone];
    },
    dispose() {
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    },
  };
  return office;
}
