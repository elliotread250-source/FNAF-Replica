import * as THREE from 'three';
import { CLIPPINGS, type MapNode } from '@fnaf/shared';
import { checkerFloor, confettiWall, tileWall, ceilingTiles, curtainTex, posterTex, newspaperTex, signTex, woodTex, metalTex } from '../textures';
import { plain, glow, textured } from '../materials';
import { buildCharacter, type CharacterRig, type PoseName } from '../characters/build';
import { volumetricCone, Flicker, SparkSystem } from '../fx/effects';
import { store } from '../../store';

export interface CamRoom {
  node: string;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  spots: THREE.Vector3[];
  rigs: Map<string, CharacterRig>;
  flickers: Flicker[];
  sparks: SparkSystem;
  swing: THREE.Object3D | null;
  extras: Record<string, THREE.Object3D>;
  dark: boolean;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
/** Lights here are in physical units (candela); this keeps the authored numbers readable. */
const LUX = 14;

function m(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D, shadow = true): THREE.Mesh {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.castShadow = shadow;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}

function shell(scene: THREE.Scene, w: number, d: number, h: number, wall: THREE.Texture, floorSeed = 3): void {
  const f = checkerFloor(floorSeed);
  const floor = m(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: f.map, normalMap: f.normal, roughnessMap: f.rough }), 0, 0, 0, scene, false);
  floor.rotation.x = -Math.PI / 2;
  (floor.material as THREE.MeshStandardMaterial).map!.repeat.set(w / 2, d / 2);
  const ceil = m(new THREE.PlaneGeometry(w, d), textured('roomceil', ceilingTiles(6)), 0, h, 0, scene, false);
  ceil.rotation.x = Math.PI / 2;
  const wm = new THREE.MeshStandardMaterial({ map: wall, roughness: 0.95 });
  for (const [x, z, ry, len] of [
    [0, -d / 2, 0, w],
    [0, d / 2, Math.PI, w],
    [-w / 2, 0, Math.PI / 2, d],
    [w / 2, 0, -Math.PI / 2, d],
  ] as [number, number, number, number][]) {
    const p = m(new THREE.PlaneGeometry(len, h), wm, x, h / 2, z, scene, false);
    p.rotation.y = ry;
  }
}

function table(parent: THREE.Object3D, x: number, z: number, hats = true): void {
  const top = plain('#d8d0c0', 0.6);
  m(new THREE.BoxGeometry(1.8, 0.05, 0.8), top, x, 0.75, z, parent);
  m(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 8), plain('#6a6a6a', 0.4, 0.7), x, 0.37, z, parent);
  const cloth = m(new THREE.BoxGeometry(1.82, 0.02, 0.82), plain('#c84a4a', 0.9), x, 0.78, z, parent);
  void cloth;
  if (!hats) return;
  const cols = ['#e8c22c', '#3a8ac4', '#c44fd0', '#3ab05a'];
  for (let i = 0; i < 4; i++) {
    const hat = m(new THREE.ConeGeometry(0.06, 0.18, 10), plain(cols[i % 4], 0.6), x - 0.6 + i * 0.4, 0.88, z + (i % 2 ? 0.2 : -0.2), parent);
    hat.rotation.z = rnd(-0.3, 0.3);
    m(new THREE.CylinderGeometry(0.1, 0.1, 0.01, 12), plain('#f2f2f2', 0.4), x - 0.6 + i * 0.4, 0.79, z + (i % 2 ? -0.2 : 0.2), parent);
  }
}

/** Build the room behind a security camera. Each kind gets its own props and lighting. */
export function buildRoom(node: MapNode, clips: Record<string, number>, posterGolden = false): CamRoom {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#000');
  scene.fog = new THREE.FogExp2('#000', 0.08);
  const camera = new THREE.PerspectiveCamera(62, 4 / 3, 0.05, 40);
  const spots: THREE.Vector3[] = node.poses.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const flickers: Flicker[] = [];
  const sparks = new SparkSystem(scene);
  const extras: Record<string, THREE.Object3D> = {};
  let swing: THREE.Object3D | null = null;
  let dark = false;
  const amb = new THREE.AmbientLight('#3a4050', 0.35);
  scene.add(amb);

  const ceilLight = (x: number, z: number, color: string, intensity: number, h: number, flicker = 0) => {
    const l = new THREE.SpotLight(color, intensity * LUX, 10, 0.9, 0.6, 1.4);
    l.position.set(x, h - 0.05, z);
    l.target.position.set(x, 0, z);
    l.castShadow = true;
    l.shadow.mapSize.set(512, 512);
    scene.add(l, l.target);
    m(new THREE.BoxGeometry(0.9, 0.04, 0.15), glow(color, intensity > 0 ? 1.4 : 0.1), x, h - 0.02, z, scene, false);
    if (flicker) flickers.push(new Flicker(l, intensity * LUX, flicker));
    return l;
  };

  switch (node.room) {
    case 'stage': {
      shell(scene, 9, 7, 4, confettiWall(21, '#2a1a3a'));
      const wood = new THREE.MeshStandardMaterial({ map: woodTex(22, '#3a2416'), roughness: 0.7 });
      m(new THREE.BoxGeometry(6, 0.5, 2.6), wood, 0, 0.25, -1.4, scene);
      const curtain = m(new THREE.PlaneGeometry(7, 3.5), new THREE.MeshStandardMaterial({ map: curtainTex('#4a0a14', false), roughness: 1, side: THREE.DoubleSide }), 0, 2.2, -2.7, scene, false);
      void curtain;
      m(new THREE.PlaneGeometry(2.6, 0.7), textured('stagesign', signTex(store.roster.venue().toUpperCase().slice(0, 22), '#2a0a10', '#ffd21a')), 0, 3.5, -2.65, scene, false);
      // Three dimmed coloured stage spots with dust in the beams.
      for (const [x, col] of [
        [-2, '#ff3040'],
        [0, '#4060ff'],
        [2, '#ffb030'],
      ] as [number, string][]) {
        const s = new THREE.SpotLight(col, 5 * LUX, 9, 0.45, 0.5, 1.3);
        s.position.set(x, 3.9, 0.8);
        s.target.position.set(x * 0.7, 0.5, -1.2);
        s.castShadow = true;
        s.shadow.mapSize.set(512, 512);
        scene.add(s, s.target);
        const cone = volumetricCone(col, 4, 0.9, 0.12);
        cone.position.copy(s.position);
        cone.lookAt(s.target.position.clone().add(new THREE.Vector3(0, -2, 0)));
        cone.rotateX(-Math.PI / 2);
        scene.add(cone);
      }
      for (const sp of spots) sp.set(sp.x, 0.5, -1.3);
      camera.position.set(3.8, 3.4, 3);
      camera.lookAt(0, 1.4, -1.4);
      break;
    }
    case 'dining': {
      shell(scene, 12, 10, 3.4, confettiWall(23, '#3a2f4a'));
      for (let i = 0; i < 3; i++) {
        table(scene, -3, -2 + i * 2.2);
        table(scene, 3, -2 + i * 2.2);
      }
      for (let i = 0; i < 4; i++) {
        const lamp = new THREE.Group();
        lamp.position.set(-3 + (i % 2) * 6, 3.4, -1 + Math.floor(i / 2) * 3);
        scene.add(lamp);
        m(new THREE.ConeGeometry(0.25, 0.2, 12, 1, true), plain('#2a2a2a', 0.5, 0.5), 0, -0.6, 0, lamp);
        if (i === 1) {
          const l = new THREE.PointLight('#ffc080', 1.6 * LUX, 6, 1.6);
          l.position.y = -0.7;
          l.castShadow = true;
          l.shadow.mapSize.set(512, 512);
          lamp.add(l);
          flickers.push(new Flicker(l, 1.6 * LUX, 0.05));
        }
      }
      camera.position.set(5.5, 3.1, 4.5);
      camera.lookAt(-0.5, 0.6, -1);
      break;
    }
    case 'cove': {
      shell(scene, 6, 5, 3.5, confettiWall(24, '#1a1428'));
      m(new THREE.BoxGeometry(3.4, 0.6, 1.6), new THREE.MeshStandardMaterial({ map: woodTex(25, '#2a1a10') }), 0, 0.3, -1.4, scene);
      const curtMat = new THREE.MeshStandardMaterial({ map: curtainTex('#4a1a6a', true), roughness: 1, side: THREE.DoubleSide });
      const curtL = m(new THREE.PlaneGeometry(1.8, 3), curtMat, -0.85, 2.0, -0.6, scene, false);
      const curtR = m(new THREE.PlaneGeometry(1.8, 3), curtMat, 0.85, 2.0, -0.6, scene, false);
      extras.curtL = curtL;
      extras.curtR = curtR;
      const sign = m(new THREE.PlaneGeometry(1.4, 0.45), textured('cove_ooo', signTex('SORRY!\nOUT OF ORDER', '#f2e8d0', '#7a1010')), 0, 1.3, -0.55, scene, false);
      sign.visible = false;
      extras.sign = sign;
      m(new THREE.PlaneGeometry(1.6, 0.4), textured('covesign', signTex('PIRATE COVE', '#2a0a3a', '#d8c060')), 0, 3.3, -0.58, scene, false);
      const s = new THREE.SpotLight('#9a6aff', 4 * LUX, 7, 0.55, 0.6, 1.4);
      s.position.set(0, 3.4, 0.8);
      s.target.position.set(0, 1, -0.6);
      s.castShadow = true;
      scene.add(s, s.target);
      spots[0].set(0.15, 0.6, -1.2);
      camera.position.set(2.2, 2.6, 2.6);
      camera.lookAt(0, 1.3, -0.8);
      break;
    }
    case 'hall':
    case 'corner': {
      const len = node.room === 'hall' ? 10 : 5;
      shell(scene, 3, len, 3, confettiWall(26 + node.id.length, '#2f2840'));
      for (let i = 0; i < Math.floor(len / 2.5); i++) {
        const z = -len / 2 + 1.5 + i * 2.5;
        const working = i === 1 || (node.room === 'corner' && i === 0);
        ceilLight(0, z, '#d8f0e8', working ? 1.6 : 0, 3, working ? 0.03 : 0);
      }
      // Posters and newspaper clippings on the walls.
      const clip = CLIPPINGS.find((c) => c.id === clips[node.id]);
      if (clip) {
        const t = newspaperTex(store.roster.fill(clip.headline), [store.roster.fill(clip.body[0]), store.roster.fill(clip.body[1])], clip.id);
        const n = m(new THREE.PlaneGeometry(0.6, 0.75), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), -1.48, 1.6, 0, scene, false);
        n.rotation.y = Math.PI / 2;
        n.name = `clip:${clip.id}`;
        extras.clip = n;
      }
      const isPosterCam = node.room === 'corner' && node.x < 50;
      const eyeless = node.id === 'west_hall' && Math.random() < 0.01;
      const posterKind = eyeless ? 'eyeless' : isPosterCam ? 'leader' : 'celebrate';
      const p = m(new THREE.PlaneGeometry(0.8, 1.1), textured(`poster:${node.id}:${posterKind}`, posterTex(posterKind, 60 + node.id.length, [store.roster.slot('leader')])), 1.48, 1.7, -0.6, scene, false);
      p.rotation.y = -Math.PI / 2;
      extras.poster = p;
      if (isPosterCam) {
        const golden = m(new THREE.PlaneGeometry(0.8, 1.1), textured('goldenposter', posterTex('leader', 99, ['IT\'S ME'])), 1.47, 1.7, -0.6, scene, false);
        golden.rotation.y = -Math.PI / 2;
        (golden.material as THREE.MeshStandardMaterial).color.set('#d8b030');
        golden.visible = posterGolden;
        extras.golden = golden;
      }
      camera.position.set(1.2, 2.7, len / 2 - 0.3);
      camera.lookAt(-0.2, 0.9, -len / 2 + 1);
      for (const sp of spots) sp.multiply(new THREE.Vector3(0.6, 1, len / 6));
      break;
    }
    case 'closet': {
      shell(scene, 3, 3, 2.8, confettiWall(28, '#2a2a2a'));
      for (let i = 0; i < 3; i++) m(new THREE.BoxGeometry(1.2, 0.04, 0.4), plain('#5a4a3a', 0.8), -1.2, 0.6 + i * 0.6, -1, scene);
      for (let i = 0; i < 4; i++) m(new THREE.BoxGeometry(0.25, 0.3, 0.25), plain('#8a7a5a', 0.9), -1.5 + i * 0.25, 0.77, -1, scene);
      m(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), plain('#8a6a4a', 0.8), 1, 0.7, -1, scene).rotation.z = 0.2;
      const b = new THREE.PointLight('#ffd090', 0.8 * LUX, 4, 2);
      b.position.set(0.5, 2.5, 0);
      b.castShadow = true;
      scene.add(b);
      flickers.push(new Flicker(b, 0.8 * LUX, 0.04));
      camera.position.set(1.2, 2.4, 1.3);
      camera.lookAt(-0.3, 0.9, -0.6);
      break;
    }
    case 'backstage':
    case 'parts': {
      shell(scene, 6, 5, 3, confettiWall(29, '#1e1e24'));
      // Shelves of spare heads.
      for (let i = 0; i < 2; i++) m(new THREE.BoxGeometry(3, 0.05, 0.5), plain('#4a3a2a', 0.8), -0.5, 1.4 + i * 0.6, -2.2, scene);
      const heads = ['freddy', 'bonnie', 'chica', 'golden'];
      for (let i = 0; i < 4; i++) {
        const r = buildCharacter(heads[i], store.roster.mode);
        const h = r.head;
        h.removeFromParent();
        h.position.set(-1.6 + i * 0.75, 1.45 + (i > 1 ? 0.6 : 0) - 1.62 * 0.1, -2.2);
        h.rotation.y = rnd(-0.4, 0.4);
        h.scale.setScalar(0.9);
        scene.add(h);
      }
      // Workbench with a spare endo that sometimes turns to the camera.
      m(new THREE.BoxGeometry(2, 0.06, 0.9), new THREE.MeshStandardMaterial({ map: woodTex(30, '#5a4028') }), 1.3, 0.85, -0.8, scene);
      const endo = buildCharacter('endo', store.roster.mode);
      endo.root.position.set(1.3, 0.88, -0.8);
      endo.root.rotation.set(-Math.PI / 2, 0, 0.3);
      scene.add(endo.root);
      extras.endo = endo.head;
      if (node.room === 'backstage') {
        const locker = m(new THREE.BoxGeometry(0.7, 2, 0.5), new THREE.MeshStandardMaterial({ map: metalTex(33, 'rust', '#4a5a4a').map, metalness: 0.6, roughness: 0.6 }), -2.5, 1, -1.5, scene);
        locker.name = 'locker';
        extras.locker = locker;
      }
      // The bare bulb on a cord, swinging very slightly: shadows sway.
      const cord = new THREE.Group();
      cord.position.set(0, 3, -0.5);
      scene.add(cord);
      m(new THREE.CylinderGeometry(0.004, 0.004, 1, 4), plain('#111', 0.5), 0, -0.5, 0, cord, false);
      m(new THREE.SphereGeometry(0.05, 10, 8), glow('#ffd090', 3), 0, -1.02, 0, cord, false);
      const b = new THREE.PointLight('#ffc070', 2.2 * LUX, 7, 1.6);
      b.position.y = -1.08;
      b.castShadow = true;
      b.shadow.mapSize.set(512, 512);
      cord.add(b);
      swing = cord;
      flickers.push(new Flicker(b, 2.2 * LUX, 0.01));
      if (node.room === 'parts') extras.wire = m(new THREE.CylinderGeometry(0.005, 0.005, 0.8, 4), plain('#b01818', 0.5), 2, 2.6, 0.5, scene, false);
      camera.position.set(2.6, 2.6, 2.2);
      camera.lookAt(-0.5, 1, -1.2);
      break;
    }
    case 'restrooms': {
      shell(scene, 5, 5, 3, tileWall(31, '#8ab0a8'));
      for (let i = 0; i < 3; i++) m(new THREE.BoxGeometry(0.05, 2, 1.2), plain('#5a7a7a', 0.6), -1 + i * 1.1, 1, -1.8, scene);
      const mirror = m(new THREE.PlaneGeometry(2, 0.8), new THREE.MeshStandardMaterial({ color: '#2a3a3a', metalness: 1, roughness: 0.1 }), 2.48, 1.6, 0, scene, false);
      mirror.rotation.y = -Math.PI / 2;
      ceilLight(0, 0, '#a0f0e0', 1.3, 3, 0.05);
      camera.position.set(2, 2.6, 2.2);
      camera.lookAt(-0.5, 0.9, -0.5);
      break;
    }
    case 'arcade': {
      shell(scene, 7, 6, 3.2, confettiWall(32, '#2a1a3a'));
      // The Puppet's gift box, lit from inside its lid gap.
      const box = new THREE.Group();
      box.position.set(0, 0, -1.6);
      scene.add(box);
      const stripes = new THREE.MeshStandardMaterial({ color: '#c41e3a', roughness: 0.6 });
      m(new THREE.BoxGeometry(1.2, 1.2, 1.2), stripes, 0, 0.6, 0, box);
      m(new THREE.BoxGeometry(1.24, 0.12, 1.24), plain('#f2f2f2', 0.6), 0, 0.6, 0, box);
      m(new THREE.BoxGeometry(0.12, 1.22, 1.22), plain('#f2f2f2', 0.6), 0, 0.6, 0, box);
      const lid = m(new THREE.BoxGeometry(1.3, 0.15, 1.3), stripes, 0, 1.3, 0, box);
      extras.lid = lid;
      const inner = new THREE.PointLight('#ffd0a0', 0.6 * LUX, 2, 2);
      inner.position.set(0, 1.25, 0);
      box.add(inner);
      // Prize counter and a glowing cabinet.
      m(new THREE.BoxGeometry(2.5, 1, 0.6), plain('#3a2a5a', 0.7), 2.2, 0.5, -2.2, scene);
      for (let i = 0; i < 5; i++) m(new THREE.SphereGeometry(0.12, 10, 8), plain(['#c41e1e', '#3a8ac4', '#e8c22c', '#3ab05a', '#c44fd0'][i], 0.9), 1.4 + i * 0.4, 1.12, -2.2, scene);
      m(new THREE.BoxGeometry(0.8, 1.9, 0.7), plain('#1a1a3a', 0.6), -2.6, 0.95, -2.2, scene);
      m(new THREE.PlaneGeometry(0.6, 0.45), glow('#3af0ff', 1.8), -2.6, 1.4, -1.84, scene, false);
      const cab = new THREE.PointLight('#3af0ff', 1 * LUX, 4, 2);
      cab.position.set(-2.6, 1.3, -1.4);
      scene.add(cab);
      flickers.push(new Flicker(cab, 1 * LUX, 0.02));
      spots[0].set(-1.2, 0, -0.6);
      spots[1].set(1.2, 0, -0.6);
      camera.position.set(2.8, 2.7, 2.6);
      camera.lookAt(-0.2, 0.8, -1.2);
      break;
    }
    case 'party': {
      shell(scene, 8, 6, 3.2, confettiWall(33 + node.id.length, '#3a2a4a'));
      table(scene, 0, -1.5);
      // String lights, half working.
      for (let i = 0; i < 16; i++) {
        const x = -3.6 + i * 0.48;
        const y = 3 - Math.sin((i / 15) * Math.PI) * 0.4;
        const on = i % 3 !== 0;
        m(new THREE.SphereGeometry(0.035, 6, 4), glow(['#ff3040', '#3a8aff', '#ffd21a', '#3aff6a'][i % 4], on ? 2 : 0.05), x, y, -2.8, scene, false);
      }
      const l1 = new THREE.PointLight('#ffb0d0', 0.9 * LUX, 6, 2);
      l1.position.set(-1.5, 2.6, -2.2);
      l1.castShadow = true;
      l1.shadow.mapSize.set(512, 512);
      scene.add(l1);
      const l2 = new THREE.PointLight('#a0c0ff', 0.6 * LUX, 6, 2);
      l2.position.set(1.8, 2.6, -2.2);
      scene.add(l2);
      // Balloons tied to chairs, swaying.
      const balloons = new THREE.Group();
      scene.add(balloons);
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Group();
        b.position.set(-2 + i * 1.3, 0.8, -0.4 + (i % 2) * 0.6);
        m(new THREE.CylinderGeometry(0.003, 0.003, 1, 4), plain('#ddd', 0.5), 0, 0.5, 0, b, false);
        m(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshPhysicalMaterial({ color: ['#c41e1e', '#3a8ac4', '#e8c22c', '#c44fd0'][i], roughness: 0.2, clearcoat: 1 }), 0, 1.1, 0, b).scale.y = 1.2;
        balloons.add(b);
      }
      extras.balloons = balloons;
      const clip = CLIPPINGS.find((c) => c.id === clips[node.id]);
      if (clip) {
        const t = newspaperTex(store.roster.fill(clip.headline), [store.roster.fill(clip.body[0]), store.roster.fill(clip.body[1])], clip.id);
        const n = m(new THREE.PlaneGeometry(0.6, 0.75), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), 3.98, 1.6, -1, scene, false);
        n.rotation.y = -Math.PI / 2;
        n.name = `clip:${clip.id}`;
        extras.clip = n;
      }
      camera.position.set(3.4, 2.8, 2.6);
      camera.lookAt(-0.4, 0.8, -1);
      break;
    }
    case 'vent': {
      const duct = metalTex(34, 'rust', '#5a5a5a');
      const dm = new THREE.MeshStandardMaterial({ map: duct.map, normalMap: duct.normal, metalness: 0.7, roughness: 0.5, side: THREE.BackSide });
      m(new THREE.BoxGeometry(2.4, 1.4, 6), dm, 0, 0.7, -1, scene, false);
      m(new THREE.BoxGeometry(1.2, 1.4, 2.4), dm, 1.8, 0.7, -1, scene, false);
      const cage = new THREE.PointLight('#e0d0a0', 0.7 * LUX, 4, 2);
      cage.position.set(0, 1.25, 0.5);
      scene.add(cage);
      flickers.push(new Flicker(cage, 0.7 * LUX, 0.03));
      m(new THREE.SphereGeometry(0.04, 8, 6), glow('#e0d0a0', 2), 0, 1.33, 0.5, scene, false);
      for (const sp of spots) sp.set(sp.x * 0.6, 0, sp.z - 1.5);
      camera.position.set(0.6, 1.2, 1.7);
      camera.lookAt(0, 0.4, -2);
      break;
    }
    case 'kitchen':
    default:
      dark = true;
      shell(scene, 6, 6, 3, tileWall(35, '#9a9a8a'));
      camera.position.set(2, 2.5, 2);
      camera.lookAt(0, 0.8, 0);
  }

  // Cheap security cameras carry their own IR lamp: a harsh, close light from the lens direction.
  const ir = new THREE.PointLight('#d8e8ff', node.room === 'stage' || node.room === 'dining' ? 4 * LUX : 2.2 * LUX, 9, 2);
  ir.position.copy(camera.position);
  scene.add(ir);
  return { node: node.id, scene, camera, spots, rigs: new Map(), flickers, sparks, swing, extras, dark };
}

/** Put (or hide) characters in a camera room for this render. */
export function stageCharacters(room: CamRoom, anims: { id: string; slot: number; pose?: PoseName; offset?: THREE.Vector3; eyesOnly?: boolean; rotY?: number }[]): void {
  const want = new Set(anims.map((a) => a.id));
  for (const [id, rig] of room.rigs) if (!want.has(id)) rig.root.visible = false;
  for (const a of anims) {
    let rig = room.rigs.get(a.id);
    if (!rig) {
      rig = buildCharacter(a.id, store.roster.mode);
      room.rigs.set(a.id, rig);
      room.scene.add(rig.root);
    }
    const spot = room.spots[a.slot % room.spots.length] ?? new THREE.Vector3();
    rig.root.visible = true;
    rig.root.position.copy(spot).add(a.offset ?? new THREE.Vector3());
    rig.root.lookAt(room.camera.position.x, rig.root.position.y, room.camera.position.z);
    if (a.rotY !== undefined) rig.root.rotation.y = a.rotY;
    rig.pose(a.pose ?? 'idle');
    rig.setEyesOnly(Boolean(a.eyesOnly));
  }
}
