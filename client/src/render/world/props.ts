import * as THREE from 'three';
import type { PropDef } from '@fnaf/shared';
import { metalTex, woodTex, signTex, curtainTex, dirtTex } from '../textures';
import { propColliders } from '@fnaf/shared';

const cache = new Map<string, THREE.Material>();
function m<T extends THREE.Material>(key: string, make: () => T): T {
  let v = cache.get(key) as T | undefined;
  if (!v) {
    v = make();
    cache.set(key, v);
  }
  return v;
}

function std(color: string, rough = 0.8, metal = 0, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return m(`std:${color}:${rough}:${metal}:${JSON.stringify(extra)}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
}

const woodMat = () => m('wood', () => new THREE.MeshStandardMaterial({ map: woodTex(7, '#6a4426'), roughness: 0.75 }));
const steelMat = () => m('steel', () => new THREE.MeshStandardMaterial({ map: metalTex(5, 'brushed', '#9aa0a6').map, roughness: 0.4, metalness: 0.6 }));
const glassMat = () => m('glass', () => new THREE.MeshPhysicalMaterial({ color: '#a8d4e8', transparent: true, opacity: 0.25, roughness: 0.05, transmission: 0, side: THREE.DoubleSide }));
const dirtMat = (c: string) => m(`dirt:${c}`, () => new THREE.MeshStandardMaterial({ color: c, map: dirtTex(15), roughness: 0.95 }));

const geoCache = new Map<string, THREE.BufferGeometry>();
function boxGeo(w: number, h: number, d: number): THREE.BoxGeometry {
  const k = `b:${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}`;
  let g = geoCache.get(k) as THREE.BoxGeometry | undefined;
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    geoCache.set(k, g);
  }
  return g;
}

function cyl(rt: number, rb: number, h: number, seg = 12): THREE.CylinderGeometry {
  const k = `c:${rt}:${rb}:${h}:${seg}`;
  let g = geoCache.get(k) as THREE.CylinderGeometry | undefined;
  if (!g) {
    g = new THREE.CylinderGeometry(rt, rb, h, seg);
    geoCache.set(k, g);
  }
  return g;
}

function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, shadow = true): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

const PASTEL = ['#ff9ab8', '#9ad0ff', '#ffe08a', '#a8f0b8', '#d0a8ff'];

function blockMat(name: string): THREE.Material {
  switch (name) {
    case 'steel':
      return steelMat();
    case 'wood':
      return woodMat();
    case 'glass':
      return glassMat();
    case 'plush':
      return std('#7a5a3c', 1);
    case 'case':
      return std('#141414', 0.5, 0.3);
    case 'speaker':
      return std('#101012', 0.6);
    case 'plastic':
      return std('#e0405a', 0.4);
    case 'tile':
      return std('#cfe2dc', 0.4);
    case 'vending':
      return std('#a82a2a', 0.4, 0.2, { emissive: '#301010', emissiveIntensity: 1 });
    case 'gift':
      return std('#d04a6a', 0.7);
    case 'sheet':
      return std('#cfcabb', 1);
    case 'crate':
      return dirtMat('#8a6a42');
    case 'play':
      return std('#4a8ae0', 0.8);
    default:
      return std('#888', 0.8);
  }
}

function arcadeScreenTex(kind: number): THREE.CanvasTexture {
  return m(`screen:${kind}`, () => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const x = c.getContext('2d') as CanvasRenderingContext2D;
    const palettes = [['#0a0a30', '#ff4040', '#ffd040'], ['#001a10', '#40ff80', '#ffffff'], ['#200028', '#ff60d0', '#60d0ff'], ['#101010', '#ffa030', '#ffffff']];
    const p = palettes[kind % 4];
    x.fillStyle = p[0];
    x.fillRect(0, 0, 64, 64);
    // Chunky pixel scene: a "ship", enemies, ground.
    x.fillStyle = p[1];
    for (let i = 0; i < 6; i++) x.fillRect(6 + i * 9, 8 + ((i * 7 + kind * 5) % 20), 6, 5);
    x.fillStyle = p[2];
    x.fillRect(28, 50, 8, 6);
    x.fillRect(31, 44, 2, 6);
    x.fillRect(0, 60, 64, 4);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    return t as unknown as THREE.Material;
  }) as unknown as THREE.CanvasTexture;
}

export interface PropBuild {
  object: THREE.Object3D;
  /** Materials that glow and should dim when their room's power is off. */
  glows: THREE.MeshStandardMaterial[];
}

export function buildProp(def: PropDef): PropBuild {
  const g = new THREE.Group();
  const glows: THREE.MeshStandardMaterial[] = [];
  const y = def.y ?? 0;
  g.position.set(def.x, y, def.z);
  g.rotation.y = ((def.ry ?? 0) * Math.PI) / 180;
  const num = (k: string, d: number) => (typeof def.p?.[k] === 'number' ? (def.p[k] as number) : d);

  switch (def.type) {
    case 'block': {
      const w = num('w', 1);
      const h = num('h', 1);
      const d = num('d', 1);
      const stall = def.p?.label === 'stall';
      // Restroom partitions are painted steel with a darker edge cap, not tile.
      const mat = stall ? std('#b8b098', 0.45, 0.35) : blockMat(String(def.p?.mat ?? 'steel'));
      const mesh = add(g, boxGeo(w, h, d), mat, 0, h / 2, 0);
      if (stall) {
        add(g, boxGeo(w + 0.02, 0.04, d + 0.02), std('#6a6658', 0.4, 0.6), 0, h - 0.02, 0, false);
        add(g, boxGeo(w + 0.02, h, 0.04), std('#6a6658', 0.4, 0.6), 0, h / 2, d / 2 - 0.02, false);
      }
      const mt = String(def.p?.mat);
      if (mt === 'sheet') {
        mesh.scale.set(1, 1, 1);
        add(g, boxGeo(w * 0.5, 0.4, d * 0.5), mat, 0, h + 0.2, 0);
      }
      if (mt === 'glass') {
        add(g, boxGeo(w * 0.96, 0.05, d * 0.96), steelMat(), 0, h * 0.5, 0);
        add(g, boxGeo(w * 0.5, 0.3, d * 0.5), std('#d0a040', 0.7), 0, 0.2, 0);
      }
      if (mt === 'vending') {
        const gl = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffe8b0', emissiveIntensity: 1.4 });
        glows.push(gl);
        add(g, boxGeo(w * 0.7, h * 0.5, 0.03), gl, 0, h * 0.62, d / 2 + 0.01, false);
      }
      if (mt === 'speaker') {
        add(g, cyl(0.28, 0.28, 0.05, 20), std('#252528', 0.5), 0, h * 0.35, d / 2 + 0.03, false).rotation.x = Math.PI / 2;
        add(g, cyl(0.16, 0.16, 0.05, 20), std('#252528', 0.5), 0, h * 0.75, d / 2 + 0.03, false).rotation.x = Math.PI / 2;
      }
      break;
    }
    case 'table': {
      const long = Boolean(def.p?.long);
      const w = long ? 3.6 : 2.6;
      const d = 1.1;
      const cloth = std(PASTEL[(Math.round(def.x + def.z) >>> 0) % PASTEL.length], 0.95);
      add(g, boxGeo(w, 0.05, d), cloth, 0, 0.76, 0);
      add(g, boxGeo(w - 0.1, 0.03, d - 0.1), woodMat(), 0, 0.73, 0);
      for (const sx of [-1, 1]) add(g, boxGeo(0.08, 0.72, d - 0.2), woodMat(), (sx * (w - 0.5)) / 2, 0.36, 0);
      // Benches
      for (const sz of [-1, 1]) add(g, boxGeo(w - 0.3, 0.06, 0.34), woodMat(), 0, 0.44, sz * (d / 2 + 0.38));
      // Party hats, plates and a centrepiece balloon
      for (let i = 0; i < 4; i++) {
        const hx = -w / 2 + 0.5 + i * ((w - 1) / 3);
        const hat = add(g, new THREE.ConeGeometry(0.07, 0.2, 8), std(PASTEL[(i + 1) % 5], 0.6), hx, 0.88, i % 2 ? 0.3 : -0.3);
        hat.rotation.z = 0.15;
        add(g, cyl(0.12, 0.12, 0.015, 16), std('#f4f0ea', 0.5), hx + 0.2, 0.795, i % 2 ? -0.28 : 0.28, false);
      }
      add(g, cyl(0.01, 0.01, 0.5, 4), std('#ccc', 0.5), 0, 1.0, 0, false);
      add(g, new THREE.SphereGeometry(0.17, 12, 10), std(PASTEL[(Math.round(def.x) >>> 0) % 5], 0.3), 0, 1.32, 0, false);
      if (def.p?.birthday) {
        add(g, cyl(0.2, 0.2, 0.02, 16), std('#ffffff', 0.4), 0, 0.8, 0, false);
        const card = add(g, boxGeo(0.12, 0.17, 0.01), std('#ffd21a', 0.5), -0.3, 0.86, 0.1, false);
        card.rotation.y = 0.4;
      }
      break;
    }
    case 'chair': {
      add(g, boxGeo(0.42, 0.05, 0.42), woodMat(), 0, 0.45, 0);
      add(g, boxGeo(0.42, 0.45, 0.04), woodMat(), 0, 0.7, -0.2);
      break;
    }
    case 'locker': {
      const body = std(def.p?.usable ? '#4a5a6a' : '#3a4048', 0.5, 0.5);
      add(g, boxGeo(0.5, 1.9, 0.6), body, 0, 0.95, 0);
      const door = add(g, boxGeo(0.03, 1.8, 0.56), std('#5a6a7a', 0.45, 0.5), 0.27, 0.95, 0);
      if (def.p?.usable) {
        door.position.set(0.3, 0.95, 0.02);
        door.rotation.y = -0.12;
      }
      for (let i = 0; i < 4; i++) add(g, boxGeo(0.02, 0.02, 0.3), std('#111', 0.8), 0.29, 1.55 + i * 0.05, 0, false);
      break;
    }
    case 'cabinet': {
      const body = std('#18102a', 0.5, 0.2);
      add(g, boxGeo(0.8, 1.9, 0.9), body, 0, 0.95, 0);
      add(g, boxGeo(0.8, 0.1, 0.6), std('#2a1850', 0.5), 0, 1.0, 0.55);
      const gl = new THREE.MeshStandardMaterial({ map: arcadeScreenTex(num('screen', 0)), emissive: '#ffffff', emissiveMap: arcadeScreenTex(num('screen', 0)), emissiveIntensity: 1.5 });
      glows.push(gl);
      const screen = add(g, new THREE.PlaneGeometry(0.62, 0.52), gl, 0, 1.38, 0.451, false);
      screen.rotation.x = -0.15;
      add(g, boxGeo(0.7, 0.28, 0.02), std(PASTEL[num('screen', 0) % 5], 0.6), 0, 1.78, 0.452, false);
      for (let i = 0; i < 2; i++) add(g, new THREE.SphereGeometry(0.035, 8, 6), std('#e03030', 0.4), -0.1 + i * 0.2, 1.06, 0.7, false);
      break;
    }
    case 'deck': {
      const w = num('w', 4);
      const d = num('d', 4);
      const h = num('h', 1);
      add(g, boxGeo(w, h, d), woodMat(), 0, h / 2, 0);
      add(g, boxGeo(w, 0.04, d), std('#241018', 0.7), 0, h + 0.002, 0, false);
      break;
    }
    case 'steps': {
      // Same boxes as the colliders, so what you see is what you climb. Positions are world space, so reset the group.
      g.position.set(0, 0, 0);
      g.rotation.set(0, 0, 0);
      for (const c of propColliders(def)) {
        add(g, boxGeo(c.x2 - c.x1, c.y2 - c.y1, c.z2 - c.z1), woodMat(), (c.x1 + c.x2) / 2, (c.y1 + c.y2) / 2, (c.z1 + c.z2) / 2);
      }
      break;
    }
    case 'stairs': {
      g.position.set(0, 0, 0);
      g.rotation.set(0, 0, 0);
      for (const c of propColliders(def)) {
        add(g, boxGeo(c.x2 - c.x1, c.y2 - c.y1, c.z2 - c.z1), dirtMat('#6a6862'), (c.x1 + c.x2) / 2, (c.y1 + c.y2) / 2, (c.z1 + c.z2) / 2);
      }
      break;
    }
    case 'giftbox': {
      add(g, boxGeo(1.6, 0.12, 1.6), std('#2a1a14', 0.8), 0, 0.06, 0);
      add(g, boxGeo(1.4, 1.4, 1.4), std('#e8e0d0', 0.7), 0, 0.82, 0);
      for (const [w, d] of [[0.2, 1.42], [1.42, 0.2]]) add(g, boxGeo(w, 1.42, d), std('#c41e3a', 0.6), 0, 0.82, 0);
      const bow = new THREE.Mesh(new THREE.TorusKnotGeometry(0.2, 0.07, 48, 8), std('#c41e3a', 0.5));
      bow.position.set(0, 1.62, 0);
      g.add(bow);
      break;
    }
    case 'musicbox': {
      add(g, cyl(0.3, 0.34, 0.9, 16), std('#2a2018', 0.7), 0, 0.45, 0);
      add(g, boxGeo(0.62, 0.3, 0.5), std('#8a5a2a', 0.5, 0.2), 0, 1.0, 0);
      add(g, boxGeo(0.06, 0.06, 0.34), std('#d4a020', 0.3, 0.9), 0.36, 1.0, 0);
      add(g, cyl(0.14, 0.14, 0.03, 20), std('#d4a020', 0.3, 0.9), 0, 1.18, 0.0);
      break;
    }
    case 'coffin': {
      add(g, boxGeo(0.8, 0.6, 2.0), std('#1a1410', 0.8), 0, 0.3, 0);
      add(g, boxGeo(0.84, 0.08, 2.04), std('#2a1e16', 0.7), 0, 0.64, 0);
      break;
    }
    default:
      break;
  }
  void signTex;
  void curtainTex;
  return { object: g, glows };
}
