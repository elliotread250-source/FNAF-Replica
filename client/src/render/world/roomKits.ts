import * as THREE from 'three';
import { ROOM_KITS, createRng, next, type KitPart } from '@fnaf/shared';
import { metalTex, posterTex, signTex, woodTex, dirtTex } from '../textures';
import { plain } from '../materials';

// Meshes for ROOM_KITS (shared/src/world/roomKits.ts). Every part is built at its catalogue position, so the
// collider the level build made from the same entry is exactly under what you see. All art is procedural.

const memo = new Map<string, THREE.Texture>();
function canvasTex(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, transparent = false): THREE.CanvasTexture {
  let t = memo.get(key) as THREE.CanvasTexture | undefined;
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  if (transparent) ctx.clearRect(0, 0, w, h);
  draw(ctx);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
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
const cyl = (rt: number, rb: number, h: number, seg = 14) => new THREE.CylinderGeometry(rt, rb, h, seg);
const PAPER = ['#e8e0c8', '#f0d8d8', '#d8e4f0', '#e8f0d0', '#f2ecdc'];
const PENNANT = ['#c43a3a', '#3a8ac4', '#e8c22c', '#3ab05a', '#c44fd0', '#f0f0f0'];

function starsTex(seed: number, n: number): THREE.Texture {
  return canvasTex(`kit:stars:${seed}:${n}`, 512, 256, (c) => {
    const rng = createRng(seed);
    for (let i = 0; i < n; i++) {
      const x = next(rng) * 512;
      const y = next(rng) * 256;
      const r = 5 + next(rng) * 9;
      c.fillStyle = next(rng) < 0.8 ? '#ffd21a' : '#f0f0f0';
      c.globalAlpha = 0.65 + next(rng) * 0.35;
      c.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = k % 2 ? r * 0.45 : r;
        c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      c.fill();
    }
  }, true);
}

function boardTex(seed: number): THREE.Texture {
  return canvasTex(`kit:board:${seed}`, 256, 160, (c) => {
    const rng = createRng(seed);
    c.fillStyle = '#9a7448';
    c.fillRect(0, 0, 256, 160);
    for (let i = 0; i < 900; i++) {
      c.fillStyle = `rgba(60,40,20,${0.15 + next(rng) * 0.2})`;
      c.fillRect(next(rng) * 256, next(rng) * 160, 2, 2);
    }
    c.strokeStyle = '#3a2814';
    c.lineWidth = 8;
    c.strokeRect(4, 4, 248, 152);
    for (let i = 0; i < 6; i++) {
      const x = 16 + next(rng) * 180;
      const y = 14 + next(rng) * 90;
      c.save();
      c.translate(x + 28, y + 24);
      c.rotate((next(rng) - 0.5) * 0.3);
      c.fillStyle = PAPER[Math.floor(next(rng) * PAPER.length)];
      c.fillRect(-28, -24, 56, 48);
      c.fillStyle = 'rgba(40,40,60,0.55)';
      for (let l = 0; l < 5; l++) c.fillRect(-22, -16 + l * 8, 20 + next(rng) * 22, 2);
      c.fillStyle = '#c41e1e';
      c.beginPath();
      c.arc(0, -22, 3, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  });
}

function puddleTex(): THREE.Texture {
  return canvasTex('kit:puddle', 128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 10, 64, 64, 62);
    g.addColorStop(0, 'rgba(20,24,26,0.85)');
    g.addColorStop(0.7, 'rgba(20,24,26,0.55)');
    g.addColorStop(1, 'rgba(20,24,26,0)');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(64, 64, 62, 46, 0.3, 0, Math.PI * 2);
    c.fill();
  }, true);
}

/** Box of goods on a shelf: cardboard, or a bottle cluster. */
function goods(g: THREE.Group, rng: ReturnType<typeof createRng>, x0: number, x1: number, y: number, depth: number): void {
  let x = x0 + 0.05;
  while (x < x1 - 0.12) {
    const w = 0.12 + next(rng) * 0.25;
    if (x + w > x1 - 0.03) break;
    if (next(rng) < 0.3) {
      for (let k = 0; k < 3; k++) add(g, cyl(0.035, 0.04, 0.24, 8), plain(['#3a8ac4', '#e8e0c8', '#c43a3a', '#3ab05a'][k % 4], 0.4), x + 0.04 + k * 0.08, y + 0.12, 0, false);
    } else {
      const h = 0.12 + next(rng) * 0.22;
      add(g, box(w, h, depth * (0.6 + next(rng) * 0.3)), plain(next(rng) < 0.6 ? '#9a7448' : '#b8a888', 0.9), x + w / 2, y + h / 2, (next(rng) - 0.5) * 0.08, false);
    }
    x += w + 0.04 + next(rng) * 0.1;
  }
}

/** Groups are built facing +Z; quarter-turn parts swap their world w/d for the local frame. */
function localDims(p: KitPart): [number, number] {
  return Math.abs(p.ry) % 180 === 90 ? [p.d, p.w] : [p.w, p.d];
}

/** A cable or pipe run along an axis, sagging between clips every `span` metres. */
function sagRun(p: KitPart, radius: number, sag: number, span: number, count: number, mat: THREE.Material, root: THREE.Group): void {
  const axis = String(p.p?.axis ?? 'x');
  const from = Number(p.p?.from ?? 0);
  const to = Number(p.p?.to ?? 0);
  const fixed = Number(axis === 'x' ? p.p?.z ?? p.z : p.p?.x ?? p.x);
  for (let k = 0; k < count; k++) {
    const pts: THREE.Vector3[] = [];
    const off = (k - (count - 1) / 2) * radius * 2.6;
    const steps = Math.max(2, Math.round((to - from) / 0.25));
    for (let i = 0; i <= steps; i++) {
      const t = from + ((to - from) * i) / steps;
      const phase = ((t - from) % span) / span;
      const y = p.y + p.h / 2 - Math.sin(phase * Math.PI) * sag * (1 + k * 0.3);
      pts.push(axis === 'x' ? new THREE.Vector3(t, y, fixed + off) : new THREE.Vector3(fixed + off, y, t));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), steps * 2, radius, 6), mat);
    tube.castShadow = sag > 0;
    root.add(tube);
  }
  // Clips or brackets.
  for (let t = from; t <= to; t += span) {
    const c = new THREE.Mesh(box(axis === 'x' ? 0.03 : 0.12, 0.05, axis === 'x' ? 0.12 : 0.03), plain('#3a3a3a', 0.6, 0.5));
    c.position.set(axis === 'x' ? t : fixed, p.y + p.h / 2, axis === 'x' ? fixed : t);
    root.add(c);
  }
}

export interface RoomKitBuild {
  byRoom: Map<string, THREE.Group>;
}

export function buildRoomKits(): RoomKitBuild {
  const byRoom = new Map<string, THREE.Group>();
  const rootFor = (room: string) => {
    let g = byRoom.get(room);
    if (!g) {
      g = new THREE.Group();
      g.name = `kit:${room}`;
      byRoom.set(room, g);
    }
    return g;
  };
  const steelT = metalTex(5, 'brushed', '#9aa0a6');
  const steel = new THREE.MeshStandardMaterial({ map: steelT.map, roughness: 0.45, metalness: 0.65 });
  const darkSteel = plain('#4a4e52', 0.5, 0.6);
  const cable = plain('#121212', 0.6);
  const tape = new THREE.MeshStandardMaterial({ color: '#e8e0b8', transparent: true, opacity: 0.6, depthWrite: false, roughness: 0.3 });

  for (const p of ROOM_KITS) {
    const root = rootFor(p.room);
    const rng = createRng(p.id.length * 131 + Math.round(p.x * 7 + p.z * 13));
    const g = new THREE.Group();
    g.name = p.id;
    root.add(g);
    // Wall decals and floor parts get the part's own frame; runs (wires, pipes, bunting) work in world space.
    const framed = !['wires', 'pipes', 'bunting', 'truss'].includes(p.kind);
    if (framed) {
      g.position.set(p.x, p.y, p.z);
      g.rotation.y = (p.ry * Math.PI) / 180;
    }
    const [lw, ld] = localDims(p);
    const decalW = Math.max(p.w, p.d);
    switch (p.kind) {
      case 'poster': {
        const art = String(p.p?.art ?? 'celebrate') as Parameters<typeof posterTex>[0];
        add(g, new THREE.PlaneGeometry(decalW, p.h), new THREE.MeshStandardMaterial({ map: posterTex(art, Number(p.p?.seed ?? 11)), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1 }), 0, 0, 0, false);
        for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1]] as const) add(g, new THREE.PlaneGeometry(0.07, 0.025), tape, (sx * decalW) / 2, (sy * p.h) / 2, 0.002, false).rotation.z = sx * sy * 0.7;
        break;
      }
      case 'drawings': {
        const n = Number(p.p?.n ?? 4);
        const seed = Number(p.p?.seed ?? 60);
        for (let i = 0; i < n; i++) {
          const x = -decalW / 2 + 0.2 + (i / Math.max(1, n - 1)) * (decalW - 0.4);
          const y = (i % 2 ? -0.18 : 0.14) + (next(rng) - 0.5) * 0.1;
          const d = add(g, new THREE.PlaneGeometry(0.3, 0.38), new THREE.MeshStandardMaterial({ map: posterTex('drawing', seed + i), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1 }), x, y, 0.001 * i, false);
          d.rotation.z = (next(rng) - 0.5) * 0.25;
          add(g, new THREE.PlaneGeometry(0.06, 0.02), tape, x, y + 0.19, 0.002 + 0.001 * i, false);
        }
        break;
      }
      case 'sign': {
        const t = signTex(String(p.p?.text ?? ''), String(p.p?.bg ?? '#3a1a10'), String(p.p?.fg ?? '#ffd21a'));
        add(g, box(decalW, p.h, 0.03), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }), 0, 0, 0.015, false);
        break;
      }
      case 'stars':
        add(g, new THREE.PlaneGeometry(decalW, p.h), new THREE.MeshStandardMaterial({ map: starsTex(Number(p.p?.seed ?? 1), Number(p.p?.n ?? 30)), transparent: true, depthWrite: false, roughness: 0.6, emissive: '#3a2a00', emissiveIntensity: 0.4 }), 0, 0, 0, false);
        break;
      case 'board':
        add(g, box(decalW, p.h, 0.025), new THREE.MeshStandardMaterial({ map: boardTex(Number(p.p?.seed ?? 1)), roughness: 0.95 }), 0, 0, 0.0125, false);
        break;
      case 'mirror': {
        add(g, box(decalW + 0.06, p.h + 0.06, 0.02), darkSteel, 0, 0, 0.01, false);
        // No environment map in the building, so a true mirror renders black; a glossy grey-blue reads as glass.
        add(g, new THREE.PlaneGeometry(decalW, p.h), new THREE.MeshStandardMaterial({ color: '#7a868c', metalness: 0.25, roughness: 0.22, map: dirtTex(21) }), 0, 0, 0.022, false);
        break;
      }
      case 'puddle': {
        if (p.p?.mat) {
          add(g, box(p.w, 0.012, p.d), plain('#141414', 0.95), 0, 0.006, 0, false);
          for (let i = 0; i < 8; i++) add(g, box(p.w - 0.1, 0.004, 0.02), plain('#222', 0.9), 0, 0.013, -p.d / 2 + 0.08 + i * ((p.d - 0.16) / 7), false);
        } else {
          const m = add(g, new THREE.PlaneGeometry(p.w, p.d), new THREE.MeshStandardMaterial({ map: puddleTex(), transparent: true, depthWrite: false, roughness: 0.04, metalness: 0.3 }), 0, 0, 0, false);
          m.rotation.x = -Math.PI / 2;
        }
        break;
      }
      case 'bunting': {
        // A string with alternating paper triangles, sagging from wall to wall.
        const axis = String(p.p?.axis ?? 'x');
        const from = Number(p.p?.from ?? 0);
        const to = Number(p.p?.to ?? 0);
        const fixed = Number(p.p?.z ?? p.p?.x ?? 0);
        const top = p.y + p.h / 2;
        const sagAt = (t: number) => top - Math.sin(((t - from) / (to - from)) * Math.PI) * (p.h * 0.6);
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 24; i++) {
          const t = from + ((to - from) * i) / 24;
          pts.push(axis === 'x' ? new THREE.Vector3(t, sagAt(t), fixed) : new THREE.Vector3(fixed, sagAt(t), t));
        }
        g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.006, 4), plain('#d8d0c0', 0.8)));
        const positions: number[] = [];
        const colors: number[] = [];
        const col = new THREE.Color();
        let k = Number(p.p?.seed ?? 0);
        for (let t = from + 0.2; t < to - 0.2; t += 0.32) {
          const y = sagAt(t);
          col.set(PENNANT[k++ % PENNANT.length]);
          const a = axis === 'x' ? [t - 0.1, y, fixed] : [fixed, y, t - 0.1];
          const b = axis === 'x' ? [t + 0.1, y, fixed] : [fixed, y, t + 0.1];
          const c = axis === 'x' ? [t, y - 0.22, fixed] : [fixed, y - 0.22, t];
          positions.push(...a, ...b, ...c);
          for (let v = 0; v < 3; v++) colors.push(col.r, col.g, col.b);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.computeVertexNormals();
        g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })));
        break;
      }
      case 'wires':
        sagRun(p, 0.012, 0.18, 1.6, 3, cable, g);
        break;
      case 'pipes':
        sagRun(p, p.room.startsWith('b') ? 0.07 : 0.045, 0, 2.5, p.room === 'bBoiler' ? 1 : 2, new THREE.MeshStandardMaterial({ color: p.room.startsWith('b') ? '#5a4a3a' : '#7a7a72', metalness: 0.6, roughness: 0.6, map: dirtTex(17) }), g);
        break;
      case 'truss': {
        const from = Number(p.p?.from ?? 0);
        const to = Number(p.p?.to ?? 0);
        const x = Number(p.p?.x ?? p.x);
        const len = to - from;
        for (const [dy, dz] of [[0.1, 0.1], [0.1, -0.1], [-0.1, 0.1], [-0.1, -0.1]] as const) add(g, cyl(0.018, 0.018, len, 6), darkSteel, x + dz, p.y + dy, (from + to) / 2, false).rotation.x = Math.PI / 2;
        for (let t = from; t <= to; t += 0.5) add(g, box(0.2, 0.2, 0.012), darkSteel, x, p.y, t, false);
        const cans = Number(p.p?.cans ?? 4);
        for (let i = 0; i < cans; i++) {
          const z = from + ((i + 0.5) * len) / cans;
          const can = add(g, cyl(0.08, 0.1, 0.24, 12), plain('#141414', 0.5, 0.4), x + (i % 2 ? 0.12 : -0.12), p.y - 0.25, z);
          can.rotation.z = (i % 2 ? -1 : 1) * 0.5;
          add(g, cyl(0.07, 0.07, 0.01, 12), new THREE.MeshStandardMaterial({ color: '#111', emissive: ['#ff5040', '#ffd060', '#60a0ff'][i % 3], emissiveIntensity: 0.6 }), x + (i % 2 ? 0.17 : -0.17), p.y - 0.33, z, false);
        }
        break;
      }
      case 'shelf':
      case 'rack': {
        const tiers = Number(p.p?.tiers ?? 4);
        const top0 = Number(p.p?.top ?? 0.4);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, box(0.04, p.h, 0.04), darkSteel, (sx * (lw - 0.04)) / 2, p.h / 2, (sz * (ld - 0.04)) / 2);
        for (let i = 0; i < tiers; i++) {
          const y = i === 0 ? 0.12 : i === 1 ? top0 - 0.02 : top0 + ((p.h - top0 - 0.05) * (i - 1)) / (tiers - 2 || 1);
          add(g, box(lw, 0.025, ld), steel, 0, y, 0, true);
          if (p.kind === 'shelf') goods(g, rng, -lw / 2, lw / 2, y + 0.0125, ld);
          else for (let k = 0; k < 3; k++) {
              const limb = add(g, cyl(0.04, 0.05, 0.6, 8), plain('#3a3d42', 0.4, 0.8), -lw / 2 + 0.4 + k * 0.9, y + 0.06, 0, false);
              limb.rotation.z = Math.PI / 2;
            }
        }
        break;
      }
      case 'cabinet': {
        add(g, box(lw, p.h, ld), new THREE.MeshStandardMaterial({ color: '#7a8270', metalness: 0.4, roughness: 0.6, map: dirtTex(19) }), 0, p.h / 2, 0);
        add(g, box(0.008, p.h - 0.1, 0.01), plain('#1a1a1a', 0.8), 0, p.h / 2, ld / 2 + 0.003, false);
        for (const sx of [-1, 1]) add(g, box(0.02, 0.18, 0.03), steel, sx * 0.07, p.h * 0.55, ld / 2 + 0.015, false);
        add(g, box(lw * 0.5, 0.12, 0.004), plain('#e8e0c8', 0.9), 0, p.h * 0.8, ld / 2 + 0.003, false);
        break;
      }
      case 'bucket': {
        add(g, box(0.4, 0.3, 0.32), plain('#e8b820', 0.5), 0, 0.2, 0);
        add(g, box(0.4, 0.02, 0.32), plain('#2a4a6a', 0.4), 0, 0.33, 0, false);
        add(g, box(0.12, 0.14, 0.3), plain('#c89a10', 0.5), -0.12, 0.42, 0);
        for (const [x, z] of [[-0.17, -0.13], [0.17, -0.13], [-0.17, 0.13], [0.17, 0.13]] as const) add(g, new THREE.SphereGeometry(0.025, 6, 4), plain('#111'), x, 0.025, z, false);
        const mop = add(g, cyl(0.012, 0.012, 1.3, 6), plain('#8a6a4a', 0.7), 0.05, 0.85, 0, true);
        mop.rotation.z = -0.2;
        add(g, cyl(0.06, 0.09, 0.14, 10), plain('#d8d0b8', 1), 0.0, 0.25, 0, false);
        break;
      }
      case 'bin': {
        add(g, cyl(p.w / 2, p.w / 2 - 0.03, p.h, 16), new THREE.MeshStandardMaterial({ color: '#5a6058', metalness: 0.55, roughness: 0.55, side: THREE.DoubleSide, map: dirtTex(23) }), 0, p.h / 2, 0);
        add(g, new THREE.IcosahedronGeometry(p.w * 0.25, 0), plain('#d8d0bc', 0.95), 0.02, p.h - 0.03, 0.02, false);
        break;
      }
      case 'wedge': {
        const shape = new THREE.Shape();
        shape.moveTo(-ld / 2, 0);
        shape.lineTo(ld / 2, 0);
        shape.lineTo(ld / 2, p.h * 0.35);
        shape.lineTo(-ld / 2 + 0.08, p.h);
        shape.lineTo(-ld / 2, p.h);
        const geo = new THREE.ExtrudeGeometry(shape, { depth: lw, bevelEnabled: false });
        geo.translate(0, 0, -lw / 2);
        geo.rotateY(Math.PI / 2);
        add(g, geo, plain('#111113', 0.6), 0, 0, 0);
        break;
      }
      case 'heads': {
        // A wall shelf with spare costume heads: bear, rabbit, bird, fox, in faded colours, eyes empty.
        add(g, box(lw, 0.03, ld), new THREE.MeshStandardMaterial({ map: woodTex(11, '#5a3a22'), roughness: 0.8 }), 0, 1.3, 0);
        add(g, box(lw, 0.03, ld), new THREE.MeshStandardMaterial({ map: woodTex(12, '#5a3a22'), roughness: 0.8 }), 0, 0.6, 0);
        for (const sx of [-1, 1]) add(g, box(0.04, p.h, ld), new THREE.MeshStandardMaterial({ map: woodTex(13, '#4a3020'), roughness: 0.8 }), (sx * (lw - 0.04)) / 2, p.h / 2, 0);
        const cols = ['#6b4423', '#5b5fb8', '#e8c22c', '#a83a2a', '#6b4423'];
        const n = Number(p.p?.heads ?? 5);
        for (let i = 0; i < n; i++) {
          const hx = -lw / 2 + 0.35 + (i * (lw - 0.7)) / Math.max(1, n - 1);
          const hy = i % 2 ? 0.82 : 1.52;
          const col = cols[i % cols.length];
          const head = add(g, new THREE.SphereGeometry(0.2, 14, 10), plain(col, 0.95), hx, hy, 0);
          head.scale.set(1, 0.95, 0.9);
          add(g, new THREE.SphereGeometry(0.11, 10, 8), plain('#d8c8a8', 0.95), hx, hy - 0.06, 0.15, false).scale.set(1, 0.7, 0.8);
          for (const ex of [-0.07, 0.07]) add(g, new THREE.SphereGeometry(0.035, 8, 6), plain('#050505', 0.3), hx + ex, hy + 0.05, 0.16, false);
          // Ears: round for the bear, tall for the rabbit, none for the bird, pointed for the fox.
          const kind = i % 4;
          for (const ex of [-1, 1]) {
            if (kind === 0) add(g, new THREE.SphereGeometry(0.06, 8, 6), plain(col, 0.95), hx + ex * 0.15, hy + 0.17, 0, false);
            if (kind === 1) add(g, cyl(0.03, 0.045, 0.3, 8), plain(col, 0.95), hx + ex * 0.08, hy + 0.32, 0, false).rotation.z = ex * 0.15;
            if (kind === 3) add(g, new THREE.ConeGeometry(0.06, 0.14, 6), plain(col, 0.95), hx + ex * 0.12, hy + 0.2, 0, false);
          }
        }
        break;
      }
      case 'endo': {
        const metal = plain('#3a3d42', 0.35, 0.85);
        add(g, box(0.5, 0.12, 0.28), metal, 0, 0.1, 0);
        add(g, new THREE.SphereGeometry(0.14, 12, 10), metal, -0.55, 0.15, 0);
        for (const ex of [-0.05, 0.05]) add(g, new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ff2010', emissiveIntensity: 0.2 }), -0.66, 0.2, ex, false);
        for (const sz of [-1, 1]) {
          const arm = add(g, cyl(0.025, 0.025, 0.6, 8), metal, 0.05, 0.08, sz * 0.22, false);
          arm.rotation.z = Math.PI / 2;
          const leg = add(g, cyl(0.03, 0.03, 0.7, 8), metal, 0.55, 0.08, sz * 0.1, false);
          leg.rotation.z = Math.PI / 2;
        }
        for (let i = 0; i < 4; i++) add(g, cyl(0.004, 0.004, 0.5, 4), plain(['#c41e1e', '#2a5bd8', '#e8c22c', '#111'][i], 0.6), -0.1 + i * 0.05, 0.17, 0.05, false).rotation.z = Math.PI / 2 + i * 0.1;
        break;
      }
      case 'hood': {
        add(g, box(p.w, 0.3, p.d), steel, 0, 0.15 - p.h / 2, 0);
        add(g, box(p.w * 0.5, 0.3, p.d * 0.5), steel, 0, p.h / 2 - 0.15, 0);
        add(g, box(p.w - 0.1, 0.01, p.d - 0.1), plain('#3a3a32', 0.9, 0.4), 0, -p.h / 2 + 0.005, 0, false);
        break;
      }
      case 'fridge': {
        add(g, box(lw, p.h, ld), steel, 0, p.h / 2, 0);
        add(g, box(0.006, p.h - 0.1, 0.01), plain('#222', 0.6), 0, p.h / 2, ld / 2 + 0.003, false);
        for (const sx of [-1, 1]) add(g, box(0.025, 0.5, 0.04), darkSteel, sx * 0.06, p.h * 0.6, ld / 2 + 0.02, false);
        break;
      }
      case 'pots': {
        for (let i = 0; i < 3; i++) {
          const r = 0.13 + (i % 2) * 0.05;
          add(g, cyl(r, r, 0.22 + (i % 2) * 0.08, 16), steel, -1.3 + i * 1.2, (0.22 + (i % 2) * 0.08) / 2, -0.05);
        }
        const pan = add(g, cyl(0.16, 0.14, 0.05, 16), darkSteel, 1.6, 0.025, 0.1);
        void pan;
        add(g, box(0.3, 0.02, 0.03), darkSteel, 1.9, 0.04, 0.1, false);
        break;
      }
      case 'sink': {
        add(g, box(lw, 0.06, ld), plain('#d8d4c8', 0.35), 0, p.h - 0.03, 0);
        add(g, box(lw, p.h - 0.06, 0.03), plain('#8a8478', 0.8), 0, (p.h - 0.06) / 2, -ld / 2 + 0.03);
        const n = Number(p.p?.n ?? 2);
        for (let i = 0; i < n; i++) {
          const x = -lw / 2 + ((i + 0.5) * lw) / n;
          add(g, cyl(0.17, 0.12, 0.12, 16), plain('#ece8e0', 0.2), x, p.h - 0.09, 0.03, false);
          const tap = add(g, cyl(0.015, 0.015, 0.16, 8), steel, x, p.h + 0.08, -ld / 2 + 0.1, false);
          void tap;
          add(g, cyl(0.012, 0.012, 0.1, 8), steel, x, p.h + 0.15, -ld / 2 + 0.15, false).rotation.x = Math.PI / 2;
        }
        break;
      }
      case 'crates': {
        let y = 0;
        let level = 0;
        while (y < p.h - 0.2) {
          const h = Math.min(p.h - y, 0.45 + next(rng) * 0.25);
          const shrink = level * 0.08;
          add(g, box(lw - shrink - next(rng) * 0.1, h, ld - shrink), new THREE.MeshStandardMaterial({ map: woodTex(20 + level, next(rng) < 0.5 ? '#8a6a42' : '#a88a5a'), roughness: 0.9 }), (next(rng) - 0.5) * 0.06, y + h / 2, (next(rng) - 0.5) * 0.06);
          y += h;
          level++;
        }
        break;
      }
      case 'toilet': {
        const china = plain('#ece8e0', 0.2);
        add(g, cyl(0.15, 0.12, 0.38, 14), china, 0, 0.19, 0.06);
        add(g, cyl(0.19, 0.19, 0.03, 16), plain('#d8d0c0', 0.4), 0, 0.395, 0.08, false);
        add(g, box(0.38, 0.32, 0.17), china, 0, 0.6, -0.24);
        break;
      }
      case 'timeclock': {
        add(g, box(0.26, 0.32, 0.12), plain('#a8a090', 0.6, 0.2), 0, 0, 0.06);
        add(g, new THREE.CircleGeometry(0.08, 20), plain('#f0ece0', 0.5), 0, 0.05, 0.121, false);
        add(g, box(0.004, 0.06, 0.004), plain('#111'), 0, 0.07, 0.124, false);
        for (let i = 0; i < 6; i++) add(g, box(0.06, 0.12, 0.004), plain('#e8dcc0', 0.9), -0.12 + (i % 3) * 0.12, -0.32 - Math.floor(i / 3) * 0.14, 0.01 + i * 0.0005, false);
        add(g, box(0.4, 0.3, 0.02), plain('#5a5448', 0.7), 0, -0.39, 0.004, false);
        break;
      }
      case 'coats': {
        add(g, box(decalW, 0.06, 0.03), new THREE.MeshStandardMaterial({ map: woodTex(15, '#5a3a22'), roughness: 0.8 }), 0, 0.35, 0.015);
        const cols = ['#2a3a5a', '#4a3a2a', '#e8e0d0'];
        for (let i = 0; i < 3; i++) {
          const x = -decalW / 2 + 0.25 + i * 0.4;
          add(g, cyl(0.012, 0.012, 0.08, 6), plain('#888', 0.4, 0.8), x, 0.32, 0.06, false).rotation.x = Math.PI / 2;
          const coat = add(g, cyl(0.12, 0.2, 0.75 - (i === 2 ? 0.15 : 0), 10), plain(cols[i], 0.95), x, 0.32 - (0.75 - (i === 2 ? 0.15 : 0)) / 2, 0.11);
          coat.scale.z = 0.45;
        }
        break;
      }
      case 'lockers': {
        for (let i = 0; i < 3; i++) {
          const x = -lw / 2 + (i + 0.5) * (lw / 3);
          add(g, box(lw / 3 - 0.01, p.h, ld), plain(i === 1 ? '#4a5a6a' : '#3a4a58', 0.5, 0.5), x, p.h / 2, 0);
          for (let v = 0; v < 4; v++) add(g, box(lw / 3 - 0.12, 0.012, 0.005), plain('#141414', 0.8), x, p.h - 0.2 - v * 0.04, ld / 2 + 0.003, false);
          add(g, box(0.03, 0.08, 0.02), plain('#9a9a9a', 0.4, 0.8), x + lw / 6 - 0.06, p.h * 0.55, ld / 2 + 0.01, false);
        }
        break;
      }
      case 'keypad': {
        add(g, box(decalW, p.h, 0.03), plain('#d8d4c8', 0.5), 0, 0, 0.015);
        for (let i = 0; i < 12; i++) add(g, box(0.025, 0.02, 0.008), plain('#3a3a3a', 0.6), -0.04 + (i % 3) * 0.04, 0.04 - Math.floor(i / 3) * 0.03, 0.032, false);
        add(g, new THREE.SphereGeometry(0.008, 6, 4), new THREE.MeshStandardMaterial({ color: '#200', emissive: '#ff2010', emissiveIntensity: 2 }), 0.05, 0.085, 0.032, false);
        break;
      }
      case 'barrels': {
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          if (next(rng) < 0.15) continue;
          const r = Math.min(lw, ld) / 4 - 0.01;
          add(g, cyl(r, r, p.h, 18), new THREE.MeshStandardMaterial({ color: ['#2a4a7a', '#7a2a2a', '#3a5a3a'][Math.floor(next(rng) * 3)], metalness: 0.5, roughness: 0.6, map: dirtTex(25) }), (sx * lw) / 4, p.h / 2, (sz * ld) / 4);
        }
        break;
      }
    }
  }
  return { byRoom };
}
