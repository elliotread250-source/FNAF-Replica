import * as THREE from 'three';
import { OFFICE_KIT, createRng, next, type OfficePart } from '@fnaf/shared';
import { metalTex, posterTex, stripesTex, woodTex } from '../textures';
import { plain } from '../materials';

// Detailed meshes for the free-roam Security Office, built from the shared OFFICE_KIT catalogue so every part
// sits exactly where its collider is. Everything here is original procedural geometry and canvas art.

export interface OfficeKitState {
  /** Office circuit live (fan, lamps, screens). */
  powered: boolean;
  doorL: boolean;
  doorR: boolean;
  lightL: boolean;
  lightR: boolean;
  monitorUp: boolean;
}

export interface OfficeKitRender {
  root: THREE.Group;
  /** World position of the fan head, for its audio. */
  fanPos: THREE.Vector3;
  /** Current fan speed 0..1 (spins down over ~3 s when power drops). */
  fanSpeed(): number;
  update(dt: number, s: OfficeKitState): void;
}

const memo = new Map<string, THREE.Texture>();
function canvasTex(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, srgb = true): THREE.CanvasTexture {
  let t = memo.get(key) as THREE.CanvasTexture | undefined;
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d') as CanvasRenderingContext2D);
  t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  memo.set(key, t);
  return t;
}

function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg = 16) => new THREE.CylinderGeometry(rt, rb, h, seg);

/** Desk laminate: worn wood-grain with coffee rings, scratches and a darker band where forearms rest. */
function deskTopTex(): THREE.Texture {
  return canvasTex('ok:desktop', 512, 160, (c) => {
    const rng = createRng(4401);
    c.fillStyle = '#5b3c24';
    c.fillRect(0, 0, 512, 160);
    for (let i = 0; i < 90; i++) {
      c.strokeStyle = `rgba(${30 + next(rng) * 30},${18 + next(rng) * 14},8,${0.15 + next(rng) * 0.2})`;
      c.lineWidth = 1 + next(rng) * 2;
      const y = next(rng) * 160;
      c.beginPath();
      c.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) c.lineTo(x, y + Math.sin(x / 60 + i) * 3 + (next(rng) - 0.5) * 2);
      c.stroke();
    }
    // Forearm wear along the front edge.
    const g = c.createLinearGradient(0, 160, 0, 110);
    g.addColorStop(0, 'rgba(20,12,6,0.35)');
    g.addColorStop(1, 'rgba(20,12,6,0)');
    c.fillStyle = g;
    c.fillRect(60, 110, 400, 50);
    // Coffee rings.
    for (const [x, y, r] of [[300, 120, 14], [318, 112, 13], [420, 128, 12], [190, 130, 15]] as const) {
      c.strokeStyle = 'rgba(40,20,6,0.55)';
      c.lineWidth = 2.2;
      c.beginPath();
      c.arc(x, y, r, 0.3, Math.PI * 1.85);
      c.stroke();
    }
    // Scratches.
    for (let i = 0; i < 60; i++) {
      c.strokeStyle = `rgba(200,170,130,${0.08 + next(rng) * 0.15})`;
      c.lineWidth = 0.6;
      const x = next(rng) * 512;
      const y = next(rng) * 160;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + (next(rng) - 0.5) * 50, y + (next(rng) - 0.5) * 8);
      c.stroke();
    }
  });
}

/** CRT raster: a dim green camera image with scanlines, or noise for a dead feed. */
function rasterTex(kind: string): THREE.CanvasTexture {
  return canvasTex(`ok:raster:${kind}`, 128, 96, (c) => {
    const rng = createRng(kind.length * 31 + 7);
    c.fillStyle = '#020604';
    c.fillRect(0, 0, 128, 96);
    if (kind === 'feed') {
      // A corridor in perspective: the kind of picture the cameras give.
      c.strokeStyle = 'rgba(120,220,150,0.5)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, 96);
      c.lineTo(48, 40);
      c.lineTo(80, 40);
      c.lineTo(128, 96);
      c.moveTo(48, 40);
      c.lineTo(48, 4);
      c.moveTo(80, 40);
      c.lineTo(80, 4);
      c.stroke();
      c.fillStyle = 'rgba(160,240,180,0.6)';
      c.font = 'bold 10px monospace';
      c.fillText('CAM 2A', 6, 12);
    }
    const img = c.getImageData(0, 0, 128, 96);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = next(rng) * (kind === 'static' ? 120 : 26);
      img.data[i] += n * 0.5;
      img.data[i + 1] += n;
      img.data[i + 2] += n * 0.6;
    }
    c.putImageData(img, 0, 0);
    c.fillStyle = 'rgba(0,0,0,0.45)';
    for (let y = 0; y < 96; y += 2) c.fillRect(0, y, 128, 1);
  });
}

function stripedCupTex(): THREE.Texture {
  return canvasTex('ok:cup', 64, 64, (c) => {
    c.fillStyle = '#f2ece2';
    c.fillRect(0, 0, 64, 64);
    c.fillStyle = '#c41e1e';
    for (let x = 0; x < 64; x += 16) c.fillRect(x, 0, 8, 64);
  });
}

function paperTex(seed: number): THREE.Texture {
  return canvasTex(`ok:paper:${seed}`, 128, 176, (c) => {
    const rng = createRng(seed);
    c.fillStyle = '#e6dfcb';
    c.fillRect(0, 0, 128, 176);
    c.fillStyle = 'rgba(40,40,60,0.55)';
    c.fillRect(10, 10, 70, 6);
    for (let y = 30; y < 166; y += 9) c.fillRect(10, y, 40 + next(rng) * 70, 2);
    c.fillStyle = 'rgba(120,90,40,0.18)';
    c.beginPath();
    c.arc(90, 140, 16, 0, Math.PI * 2);
    c.fill();
  });
}

function cobwebTex(): THREE.Texture {
  return canvasTex('ok:web', 128, 128, (c) => {
    c.clearRect(0, 0, 128, 128);
    c.strokeStyle = 'rgba(220,220,220,0.5)';
    c.lineWidth = 0.8;
    for (let i = 0; i < 9; i++) {
      const a = (i / 8) * (Math.PI / 2);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(Math.cos(a) * 128, Math.sin(a) * 128);
      c.stroke();
    }
    for (let r = 14; r < 128; r += 14) {
      c.beginPath();
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * (Math.PI / 2);
        const rr = r + Math.sin(i * 1.7) * 3;
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    }
  });
}

/** Plane bulged outward by `bulge` at the centre: a CRT's curved glass. */
function curvedScreen(w: number, h: number, bulge: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h, 8, 6);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (w / 2);
    const y = pos.getY(i) / (h / 2);
    pos.setZ(i, bulge * (1 - 0.5 * (x * x + y * y)));
  }
  g.computeVertexNormals();
  return g;
}

/** A square frustum along -Z (the CRT's tapered rear), front face w x h, back face scaled by k. */
function taper(w: number, h: number, depth: number, k: number): THREE.BufferGeometry {
  const r = (h / 2) * Math.SQRT2;
  const g = new THREE.CylinderGeometry(r * k, r, depth, 4, 1);
  g.rotateY(Math.PI / 4);
  g.rotateX(-Math.PI / 2);
  g.scale(w / h, 1, 1);
  return g;
}

export function buildOfficeKit(): OfficeKitRender {
  const root = new THREE.Group();
  root.name = 'officeKit';
  const metal = metalTex(19, 'scratched', '#6a6e74');
  const steel = new THREE.MeshStandardMaterial({ map: metal.map, normalMap: metal.normal, roughnessMap: metal.rough, metalness: 0.75, roughness: 0.5 });
  const rust = metalTex(23, 'rust', '#5a4a3a');
  const rusty = new THREE.MeshStandardMaterial({ map: rust.map, normalMap: rust.normal, metalness: 0.5, roughness: 0.8 });
  const darkMetal = plain('#24262a', 0.5, 0.7);
  const beige = new THREE.MeshStandardMaterial({ color: '#b9b09c', roughness: 0.62 });
  const beigeDark = new THREE.MeshStandardMaterial({ color: '#8f8775', roughness: 0.7 });
  const black = plain('#0c0c0d', 0.55);
  const screens: { mat: THREE.MeshStandardMaterial; kind: string; tex: THREE.Texture | null }[] = [];
  const panelLamps: { mat: THREE.MeshStandardMaterial; side: 'L' | 'R'; what: 'door' | 'light' }[] = [];
  let fanBlades: THREE.Object3D | null = null;
  let fanHead: THREE.Object3D | null = null;
  const fanPos = new THREE.Vector3();
  let lampShade: THREE.Object3D | null = null;

  for (const part of OFFICE_KIT) {
    const g = new THREE.Group();
    g.name = part.id;
    g.position.set(part.x, part.y, part.z);
    g.rotation.y = (part.ry * Math.PI) / 180;
    root.add(g);
    switch (part.kind) {
      case 'desk':
        buildDesk(g, part);
        break;
      case 'crt': {
        const s = buildCrt(g, part, beige, beigeDark, black);
        screens.push(s);
        break;
      }
      case 'fan': {
        const f = buildFan(g, steel, darkMetal, rusty);
        fanBlades = f.blades;
        fanHead = f.head;
        fanPos.set(part.x, part.y + 0.36, part.z);
        break;
      }
      case 'chair':
        buildChair(g, darkMetal);
        break;
      case 'cup': {
        const red = part.p?.color === 'red';
        const h = part.h - (red ? 0.05 : 0);
        add(g, cyl(part.w / 2, part.w / 2.6, h, 18), red ? new THREE.MeshStandardMaterial({ map: stripedCupTex(), roughness: 0.55 }) : plain('#e8e4da', 0.5), 0, h / 2, 0);
        if (red) {
          add(g, cyl(part.w / 2 + 0.003, part.w / 2 + 0.003, 0.012, 18), plain('#f0f0f0', 0.4), 0, h + 0.006, 0, false);
          const straw = add(g, cyl(0.004, 0.004, 0.12, 6), plain('#e83a3a', 0.4), 0.01, h + 0.06, 0, false);
          straw.rotation.z = -0.18;
        } else {
          add(g, cyl(part.w / 2 - 0.004, part.w / 2 - 0.004, 0.002, 16), plain('#2a1608', 0.2), 0, h - 0.012, 0, false);
        }
        break;
      }
      case 'papers': {
        const n = Number(part.p?.n ?? 3);
        const rng = createRng(part.id.length * 13);
        for (let i = 0; i < n; i++) {
          const sheet = add(g, new THREE.PlaneGeometry(0.21, 0.297), new THREE.MeshStandardMaterial({ map: paperTex(500 + i + part.id.length), roughness: 0.95, side: THREE.DoubleSide }), (next(rng) - 0.5) * 0.08, 0.002 + i * 0.0012, (next(rng) - 0.5) * 0.06, false);
          sheet.rotation.x = -Math.PI / 2;
          sheet.rotation.z = (next(rng) - 0.5) * 0.7;
        }
        if (part.id.endsWith('.2')) {
          // A couple of crumpled balls.
          for (let i = 0; i < 2; i++) add(g, new THREE.IcosahedronGeometry(0.035, 0), plain('#ddd6c2', 0.95), 0.08 - i * 0.12, 0.03, 0.06, true);
        }
        break;
      }
      case 'poster': {
        const tex = posterTex('celebrate', 40);
        const p = add(g, new THREE.PlaneGeometry(part.w, part.h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1 }), 0, 0, 0, false);
        p.receiveShadow = true;
        // The bottom-right corner has come untaped and curls off the wall.
        const curl = add(g, new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshStandardMaterial({ color: '#d8cfb8', roughness: 0.9, side: THREE.DoubleSide }), part.w / 2 - 0.06, -part.h / 2 + 0.06, 0.03, false);
        curl.rotation.set(-0.5, 0.5, Math.PI / 4);
        tapeCorners(g, part.w, part.h, [0, 1, 2]);
        break;
      }
      case 'drawing': {
        const art = add(g, new THREE.PlaneGeometry(part.w, part.h), new THREE.MeshStandardMaterial({ map: posterTex('drawing', Number(part.p?.seed ?? 60)), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1 }), 0, 0, 0, false);
        art.rotation.z = (Number(part.p?.tilt ?? 0) * Math.PI) / 180;
        tapeCorners(g, part.w, part.h, [0, 1], art.rotation.z);
        break;
      }
      case 'doorPanel':
        buildPanel(g, part, steel, darkMetal, panelLamps);
        break;
      case 'shutterFrame':
        buildShutterFrame(g, part, steel, rusty);
        break;
      case 'cables':
        buildCables(g, part);
        break;
      case 'ceilingGrid':
        buildCeiling(g, part);
        break;
      case 'lamp': {
        const cord = add(g, cyl(0.006, 0.006, 0.55, 5), black, 0, -0.275, 0, false);
        void cord;
        lampShade = new THREE.Group();
        lampShade.position.y = -0.55;
        g.add(lampShade);
        add(lampShade, new THREE.ConeGeometry(0.17, 0.13, 20, 1, true), new THREE.MeshStandardMaterial({ color: '#3a3e36', metalness: 0.6, roughness: 0.55, side: THREE.DoubleSide }), 0, -0.04, 0, true);
        break;
      }
      case 'bin': {
        add(g, cyl(0.16, 0.13, 0.42, 14), new THREE.MeshStandardMaterial({ color: '#4a5048', metalness: 0.6, roughness: 0.6, side: THREE.DoubleSide }), 0, 0.21, 0);
        for (let i = 0; i < 3; i++) add(g, new THREE.IcosahedronGeometry(0.05, 0), plain('#d8d0bc', 0.95), (i - 1) * 0.05, 0.4 + (i % 2) * 0.02, (i % 2) * 0.04, false);
        break;
      }
      case 'cabinet': {
        // Local frame: front faces +Z before the part's rotation; w/d are world extents, so swap for ±90.
        const quarter = Math.abs(part.ry) % 180 === 90;
        const lw = quarter ? part.d : part.w;
        const ld = quarter ? part.w : part.d;
        add(g, box(lw, part.h, ld), new THREE.MeshStandardMaterial({ color: '#5d6458', metalness: 0.55, roughness: 0.55 }), 0, part.h / 2, 0);
        for (let i = 0; i < 3; i++) {
          const y = 0.24 + i * 0.42;
          add(g, box(lw - 0.06, 0.38, 0.015), new THREE.MeshStandardMaterial({ color: '#6a7264', metalness: 0.5, roughness: 0.5 }), 0, y, ld / 2 + 0.008, false);
          add(g, box(0.12, 0.02, 0.025), steel, 0, y + 0.1, ld / 2 + 0.025, false);
        }
        break;
      }
      case 'cobweb': {
        const web = add(g, new THREE.PlaneGeometry(part.w, part.h), new THREE.MeshBasicMaterial({ map: cobwebTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide }), 0, 0, 0, false);
        web.rotation.x = -0.6;
        break;
      }
    }
  }

  let speed = 1;
  let t = 0;
  return {
    root,
    fanPos,
    fanSpeed: () => speed,
    update(dt, s) {
      t += dt;
      // Fan: spins up in ~1 s, coasts down over ~3 s when the office loses power.
      const target = s.powered ? 1 : 0;
      speed += (target - speed) * Math.min(1, dt * (target > speed ? 1.6 : 0.6));
      if (speed < 0.01 && !s.powered) speed = 0;
      if (fanBlades) fanBlades.rotation.z -= dt * 26 * speed;
      if (fanHead) {
        fanHead.position.x = Math.sin(t * 61) * 0.0012 * speed;
        fanHead.position.y = 0.36 + Math.sin(t * 47) * 0.0008 * speed;
      }
      // The lamp shivers with the fan and the building's hum.
      if (lampShade) lampShade.rotation.z = Math.sin(t * 1.3) * 0.012 * (0.4 + speed);
      for (const sc of screens) {
        const on = s.powered && sc.kind !== 'off';
        const boost = sc.kind === 'feed' && s.monitorUp ? 1.6 : 1;
        sc.mat.emissiveIntensity = on ? (0.55 + Math.sin(t * 50) * 0.03) * boost : 0;
        if (on && sc.tex) sc.tex.offset.set(0, sc.kind === 'static' ? Math.random() : (t * 0.05) % 1);
      }
      for (const l of panelLamps) {
        const lit = s.powered && (l.what === 'door' ? (l.side === 'L' ? s.doorL : s.doorR) : l.side === 'L' ? s.lightL : s.lightR);
        l.mat.emissiveIntensity = lit ? 2.4 : s.powered ? 0.12 : 0;
      }
    },
  };

  function buildDesk(g: THREE.Group, part: OfficePart): void {
    const w = part.w;
    const d = part.d;
    const top = part.h;
    const wood = new THREE.MeshStandardMaterial({ map: woodTex(8, '#4a3020'), roughness: 0.72 });
    const lam = new THREE.MeshStandardMaterial({ map: deskTopTex(), roughness: 0.55 });
    const edge = plain('#2e1e12', 0.6);
    add(g, box(w, 0.06, d), [wood, wood, lam, wood, wood, wood] as unknown as THREE.Material, 0, top - 0.03, 0);
    // Front edge banding, with two chips where the particleboard shows through.
    add(g, box(w, 0.065, 0.012), edge, 0, top - 0.03, d / 2 + 0.006, false);
    for (const x of [-0.55, 0.95]) add(g, box(0.07, 0.03, 0.004), plain('#7a6448', 0.95), x, top - 0.045, d / 2 + 0.0125, false);
    // Pedestals with drawers and steel pulls.
    for (const sx of [-1, 1]) {
      const px = sx * (w / 2 - 0.25);
      add(g, box(0.5, top - 0.06, d), wood, px, (top - 0.06) / 2, 0);
      for (let i = 0; i < 3; i++) {
        const y = 0.12 + i * 0.22;
        add(g, box(0.44, 0.19, 0.015), new THREE.MeshStandardMaterial({ map: woodTex(9 + i, '#553826'), roughness: 0.7 }), px, y + 0.09, d / 2 + 0.008, false);
        add(g, box(0.14, 0.018, 0.02), steel, px, y + 0.15, d / 2 + 0.022, false);
      }
      // Kick plate and feet.
      add(g, box(0.5, 0.04, 0.02), darkMetal, px, 0.02, d / 2 - 0.02, false);
    }
    // Modesty panel at the back of the footwell, and a dust shelf under the top.
    add(g, box(w - 1.0, top - 0.18, 0.04), wood, 0, 0.12 + (top - 0.18) / 2, -d / 2 + 0.02);
    add(g, box(w - 1.04, 0.02, d * 0.4), wood, 0, top - 0.16, -d / 2 + d * 0.2 + 0.05, false);
    // Cable grommet at the back left, under the CRTs.
    add(g, cyl(0.03, 0.03, 0.065, 12), black, -0.5, top - 0.03, -d / 2 + 0.08, false);
  }

  function buildCrt(g: THREE.Group, part: OfficePart, body: THREE.Material, bezel: THREE.Material, glass: THREE.Material): { mat: THREE.MeshStandardMaterial; kind: string; tex: THREE.Texture | null } {
    const w = part.w;
    const h = part.h;
    const d = part.d;
    const front = d * 0.42;
    // Front housing and bezel, then the tapered tube housing behind it.
    add(g, box(w, h, front), body, 0, h / 2, d / 2 - front / 2);
    add(g, taper(w * 0.92, h * 0.9, d - front, 0.55), body, 0, h * 0.48, d / 2 - front - (d - front) / 2);
    add(g, box(w * 0.9, h * 0.8, 0.02), bezel, 0, h * 0.53, d / 2 + 0.005, false);
    add(g, box(w * 0.86, 0.035, 0.02), bezel, 0, 0.03, d / 2 - 0.02, false);
    // Vent slots on top.
    for (let i = 0; i < 7; i++) add(g, box(w * 0.04, 0.004, front * 0.5), glass, -w * 0.3 + i * w * 0.1, h + 0.002, d / 2 - front / 2, false);
    // Screws in the bezel corners.
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) add(g, cyl(0.006, 0.006, 0.006, 6), darkMetal, sx * w * 0.41, h * 0.53 + sy * h * 0.36, d / 2 + 0.017, false).rotation.x = Math.PI / 2;
    const kind = String(part.p?.screen ?? 'off');
    const tex = kind === 'off' ? null : rasterTex(kind);
    if (tex) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    }
    const mat = new THREE.MeshStandardMaterial({
      color: kind === 'off' ? '#0e1210' : '#020403',
      roughness: 0.32,
      metalness: 0.1,
      emissive: kind === 'off' ? '#000000' : '#ffffff',
      emissiveMap: tex,
      emissiveIntensity: kind === 'off' ? 0 : 0.6,
    });
    add(g, curvedScreen(w * 0.74, h * 0.6, 0.018), mat, 0, h * 0.54, d / 2 + 0.016, false);
    // Power LED.
    const led = new THREE.MeshStandardMaterial({ color: '#111', emissive: kind === 'off' ? '#401000' : '#20ff40', emissiveIntensity: 1.2 });
    add(g, new THREE.SphereGeometry(0.006, 6, 4), led, w * 0.38, 0.03, d / 2 + 0.004, false);
    return { mat, kind, tex };
  }

  function buildFan(g: THREE.Group, cage: THREE.Material, dark: THREE.Material, base: THREE.Material): { blades: THREE.Group; head: THREE.Group } {
    // Heavy cast base, a short neck, the motor housing and a stamped wire cage. Local +Z faces the guard.
    add(g, cyl(0.12, 0.14, 0.045, 24), base, 0, 0.022, 0);
    add(g, cyl(0.022, 0.026, 0.26, 10), dark, 0, 0.17, 0);
    const head = new THREE.Group();
    head.position.y = 0.36;
    g.add(head);
    const motor = add(head, cyl(0.06, 0.07, 0.12, 18), dark, 0, 0, -0.07);
    motor.rotation.x = Math.PI / 2;
    add(head, cyl(0.012, 0.012, 0.06, 8), cage, 0, 0, 0.0).rotation.x = Math.PI / 2;
    const blades = new THREE.Group();
    blades.position.z = 0.03;
    head.add(blades);
    // Four slightly pitched, rounded blades.
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.02);
    shape.bezierCurveTo(0.06, 0.03, 0.08, 0.15, 0.03, 0.165);
    shape.bezierCurveTo(-0.02, 0.17, -0.04, 0.08, 0, 0.02);
    const bladeGeo = new THREE.ShapeGeometry(shape, 8);
    const bladeMat = new THREE.MeshStandardMaterial({ color: '#7a7e80', metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const piv = new THREE.Group();
      piv.rotation.z = (i * Math.PI) / 2;
      const b = new THREE.Mesh(bladeGeo, bladeMat);
      b.rotation.y = 0.35;
      b.castShadow = true;
      piv.add(b);
      blades.add(piv);
    }
    add(blades, cyl(0.025, 0.025, 0.025, 12), dark, 0, 0, 0).rotation.x = Math.PI / 2;
    // Cage: outer rings front and back, an inner front ring, radial spokes and the side wires that join them.
    const wire = cage;
    const R = 0.2;
    for (const [z, r] of [[0.075, R], [-0.02, R], [0.085, R * 0.45], [0.088, R * 0.18]] as const) {
      const ring = add(head, new THREE.TorusGeometry(r, 0.0035, 5, 40), wire, 0, 0, z, false);
      ring.castShadow = true;
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const spoke = add(head, cyl(0.0022, 0.0022, R - 0.035, 4), wire, Math.cos(a) * (R / 2 + 0.017), Math.sin(a) * (R / 2 + 0.017), 0.083, false);
      spoke.rotation.z = a - Math.PI / 2;
      const side = add(head, cyl(0.0022, 0.0022, 0.095, 4), wire, Math.cos(a) * R, Math.sin(a) * R, 0.0275, false);
      side.rotation.x = Math.PI / 2;
    }
    // Badge on the front hub.
    add(head, cyl(0.03, 0.03, 0.006, 16), plain('#8a1a1a', 0.5, 0.3), 0, 0, 0.09, false).rotation.x = Math.PI / 2;
    return { blades, head };
  }

  function buildChair(g: THREE.Group, dark: THREE.Material): void {
    const vinyl = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.5 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      const leg = add(g, box(0.035, 0.03, 0.28), dark, Math.sin(a) * 0.14, 0.06, Math.cos(a) * 0.14);
      leg.rotation.y = a;
      add(g, new THREE.SphereGeometry(0.025, 8, 6), black, Math.sin(a) * 0.27, 0.025, Math.cos(a) * 0.27);
    }
    add(g, cyl(0.025, 0.03, 0.3, 10), dark, 0, 0.23, 0);
    add(g, box(0.48, 0.08, 0.46), vinyl, 0, 0.44, 0);
    // A split in the seat vinyl, foam showing.
    add(g, box(0.12, 0.004, 0.03), plain('#c8b070', 0.95), 0.08, 0.482, 0.05, false).rotation.y = 0.5;
    add(g, box(0.04, 0.5, 0.03), dark, 0, 0.72, 0.24);
    add(g, box(0.44, 0.38, 0.07), vinyl, 0, 0.85, 0.26);
    for (const sx of [-1, 1]) {
      add(g, box(0.03, 0.2, 0.03), dark, sx * 0.25, 0.58, 0.0);
      add(g, box(0.06, 0.03, 0.26), black, sx * 0.25, 0.68, 0.0);
    }
  }

  function tapeCorners(g: THREE.Group, w: number, h: number, corners: number[], rot = 0): void {
    const tape = new THREE.MeshStandardMaterial({ color: '#e8e0b8', transparent: true, opacity: 0.6, roughness: 0.3, depthWrite: false });
    const pts: [number, number][] = [[-w / 2, h / 2], [w / 2, h / 2], [-w / 2, -h / 2], [w / 2, -h / 2]];
    for (const i of corners) {
      const [x, y] = pts[i];
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      const t = add(g, new THREE.PlaneGeometry(0.07, 0.025), tape, x * c - y * s, x * s + y * c, 0.0015, false);
      t.rotation.z = rot + (i % 2 ? -0.7 : 0.7);
    }
  }

  function buildPanel(g: THREE.Group, part: OfficePart, face: THREE.Material, dark: THREE.Material, lamps: typeof panelLamps): void {
    const side = (part.p?.side === 'L' ? 'L' : 'R') as 'L' | 'R';
    add(g, box(part.w, part.h, part.d), face, 0, 0, 0);
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) add(g, cyl(0.008, 0.008, 0.008, 6), dark, sx * (part.w / 2 - 0.02), sy * (part.h / 2 - 0.02), part.d / 2 + 0.003, false).rotation.x = Math.PI / 2;
    const rows: ['door' | 'light', string, string, number][] = [
      ['door', '#7a1010', '#ff2a1a', 0.09],
      ['light', '#c8c8c0', '#fff4d8', -0.11],
    ];
    for (const [what, col, glowCol, y] of rows) {
      // Recessed collar and a raised mushroom button.
      add(g, cyl(0.045, 0.045, 0.012, 18), dark, 0, y, part.d / 2 + 0.006, false).rotation.x = Math.PI / 2;
      add(g, cyl(0.036, 0.036, 0.03, 18), plain(col, 0.45), 0, y, part.d / 2 + 0.02, false).rotation.x = Math.PI / 2;
      const lampMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', emissive: glowCol, emissiveIntensity: 0.1, roughness: 0.3 });
      add(g, new THREE.SphereGeometry(0.013, 10, 8), lampMat, 0.06, y + 0.05, part.d / 2 + 0.008, false);
      lamps.push({ mat: lampMat, side, what });
    }
    // Wiring sheath up the wall to the ceiling.
    add(g, box(0.03, 3 - part.y - part.h / 2, 0.03), dark, -0.06, part.h / 2 + (3 - part.y - part.h / 2) / 2, 0, false);
  }

  function buildShutterFrame(g: THREE.Group, part: OfficePart, face: THREE.Material, rusted: THREE.Material): void {
    // Group origin: x on the wall line, z at the opening's centre (z 50..52). Office side is +X for the west
    // door and -X for the east door; channels sit on the wall face just outside the opening so nothing
    // narrows the doorway that the collider leaves open.
    const into = part.p?.side === 'W' ? 1 : -1;
    const face0 = into * 0.1;
    for (const z of [-1.05, 1.05]) add(g, box(0.06, 2.4, 0.09), face, face0 + into * 0.03, 1.2, z);
    const header = add(g, box(0.18, 0.36, 2.3), new THREE.MeshStandardMaterial({ map: stripesTex(), roughness: 0.6, metalness: 0.3 }), face0 + into * 0.09, 2.58, 0);
    header.castShadow = true;
    add(g, box(0.2, 0.004, 2.0), rusted, 0, 0.002, 0, false);
    // Warning decal under the header.
    add(g, box(0.004, 0.06, 1.6), plain('#c41e1e', 0.6), face0 + into * 0.181, 2.37, 0, false);
  }

  function buildCables(g: THREE.Group, part: OfficePart): void {
    // A junction box on the ceiling and a sagging bundle that drops behind the desk to the CRTs.
    const ox = part.x;
    const oy = part.y;
    const oz = part.z;
    const L = (x: number, y: number, z: number) => new THREE.Vector3(x - ox, y - oy, z - oz);
    // The drops come down the wall left of the poster (x 24.03..24.97) so they never cross it.
    const jb = L(23.4, 2.96, 48.3);
    add(g, box(0.18, 0.08, 0.12), plain('#4a4c48', 0.6, 0.4), jb.x, jb.y, jb.z, false);
    const runs: THREE.Vector3[][] = [
      [L(23.4, 2.92, 48.3), L(23.55, 2.1, 48.2), L(23.8, 1.15, 48.22), L(24.1, 0.95, 48.75)],
      [L(23.44, 2.92, 48.32), L(23.72, 1.95, 48.2), L(24.0, 1.05, 48.24), L(24.7, 0.98, 48.75)],
      [L(23.38, 2.92, 48.3), L(24.8, 2.72, 48.6), L(26.0, 2.78, 48.5), L(27.2, 2.95, 48.3)],
      [L(23.4, 2.93, 48.28), L(22.9, 2.66, 48.4), L(22.3, 2.85, 48.3)],
    ];
    const mat = plain('#141414', 0.55);
    runs.forEach((pts, i) => {
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, i < 2 ? 0.012 : 0.008, 6), mat);
      tube.castShadow = true;
      g.add(tube);
    });
  }

  function buildCeiling(g: THREE.Group, part: OfficePart): void {
    // Exposed T-bar grid on 0.6 m centres, with two tiles sagging and a water stain.
    const bar = plain('#9a968a', 0.7, 0.2);
    const xs = Math.round(part.w / 0.6);
    const zs = Math.round(part.d / 0.6);
    for (let i = 0; i <= xs; i++) add(g, box(0.02, 0.015, part.d), bar, -part.w / 2 + i * 0.6, -0.01, 0, false);
    for (let j = 0; j <= zs; j++) add(g, box(part.w, 0.015, 0.02), bar, 0, -0.01, -part.d / 2 + j * 0.6, false);
    const stain = new THREE.MeshStandardMaterial({ color: '#9c8e6a', roughness: 1 });
    for (const [x, z, rx] of [[1.5, -2.7, 0.12], [-1.8, 1.5, -0.09]] as const) {
      const tile = add(g, box(0.58, 0.012, 0.58), stain, x, -0.06, z, false);
      tile.rotation.x = rx;
    }
  }
}
