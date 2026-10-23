import { createRng, next } from '../rng';
import { officeKitColliders } from './officeKit';
import { rotatedBoxes } from './rotated';
import { roomKitColliders } from './roomKits';
import { CAMERAS, HIDE_SPECS, INTERACTABLES, ITEM_SPAWNS, OPENING_SPECS, PROPS, ROOMS, SPAWNS } from './layout';
import type {
  AudioZone,
  Box,
  Collider,
  FrDoorDef,
  Flicker,
  InteractableDef,
  LightDef,
  Level,
  OpeningDef,
  PropDef,
  RoomDef,
  WallRun,
} from './types';

const THIN = 0.2;
const THICK = 0.35;
const DOOR_H = 2.2;

interface Edge {
  lo: string | null;
  hi: string | null;
  opening: number; // index into openings, or -1
}

const key = (a: number, b: number) => `${a},${b}`;

function box(cx: number, cz: number, w: number, d: number, y1: number, y2: number): Box {
  return { x1: cx - w / 2, x2: cx + w / 2, z1: cz - d / 2, z2: cz + d / 2, y1, y2 };
}

/** Collision footprint of a prop: boxes in world space. */
export function propColliders(p: PropDef): Collider[] {
  const y = p.y ?? 0;
  const ry = p.ry ?? 0;
  // Any rotation: quarter turns give one exact box, other angles a cell approximation (rotated.ts).
  const mk = (w: number, d: number, h: number, extra: Partial<Collider> = {}, dy = 0): Collider[] =>
    rotatedBoxes(p.x, p.z, w, d, ry, y + dy, y + dy + h, { kind: 'prop', low: h <= 1.0 && !extra.kind, ...extra });
  const num = (k: string, d: number) => (typeof p.p?.[k] === 'number' ? (p.p[k] as number) : d);
  switch (p.type) {
    case 'block':
      return mk(num('w', 1), num('d', 1), num('h', 1));
    case 'table':
      return p.p?.long ? mk(3.6, 1.1, 0.8) : mk(2.6, 1.1, 0.8);
    case 'chair':
      return mk(0.45, 0.45, 0.5);
    case 'locker':
      return mk(0.6, 0.5, 1.9);
    case 'cabinet':
      return mk(0.8, 0.9, 1.9);
    case 'giftbox':
      return mk(1.4, 1.4, 1.5);
    case 'musicbox':
      return mk(0.7, 0.7, 1.1);
    case 'coffin':
      return mk(0.8, 2.0, 0.7);
    case 'deck':
      return mk(num('w', 4), num('d', 4), num('h', 1), { kind: 'prop', low: false });
    case 'steps': {
      const n = num('n', 3);
      const run = num('run', 0.5);
      const w = num('w', 1.5);
      const dir = String(p.p?.dir ?? 'x+');
      const out: Collider[] = [];
      for (let i = 0; i < n; i++) {
        const top = y + ((i + 1) * (num('rise', 0) || 1.0 / n));
        const off = i * run + run / 2;
        const cx = dir === 'x+' ? p.x + off : dir === 'x-' ? p.x - off : p.x;
        const cz = dir === 'z+' ? p.z + off : dir === 'z-' ? p.z - off : p.z;
        const horizontal = dir.startsWith('x');
        const b = box(cx, cz, horizontal ? run : w, horizontal ? w : run, y, top);
        out.push({ ...b, kind: 'step' });
      }
      return out;
    }
    case 'stairs': {
      // A straight flight running +Z, descending from y to y - drop. Used for the basement stairs.
      const w = num('w', 4);
      const run = num('run', 5);
      const drop = num('drop', 4.5);
      const rise = 0.3;
      const n = Math.round(drop / rise);
      const depth = run / n;
      const out: Collider[] = [];
      for (let i = 0; i < n; i++) {
        const top = y - (i + 1) * rise;
        const b = { x1: p.x - w / 2, x2: p.x + w / 2, z1: p.z + i * depth, z2: p.z + (i + 1) * depth, y1: y - drop - 0.5, y2: top };
        out.push({ ...b, kind: 'step' });
      }
      return out;
    }
    default:
      return [];
  }
}

function lightKindFor(room: RoomDef): LightDef['kind'] {
  if (room.ceilH >= 4.5 && room.style !== 'concrete') return 'pendant';
  if (room.style === 'basement' || room.style === 'concrete') return 'caged';
  if (room.style === 'dirty') return 'bulb';
  return 'fluoro';
}

let cached: Level | null = null;
let checksum: string | null = null;

/**
 * A short hash of everything collision and interaction depend on: colliders, doors, interactables and spawns.
 * Server and client compare it at the start of a free-roam match so a browser running an old bundle can't
 * predict movement against walls the server no longer has.
 */
export function levelChecksum(): string {
  if (checksum) return checksum;
  const lv = getLevel();
  let h = 0x811c9dc5;
  const mix = (v: number) => {
    h ^= Math.round(v * 1000) | 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  };
  for (const c of lv.colliders) [c.x1, c.x2, c.y1, c.y2, c.z1, c.z2, c.door ?? -1, c.rot?.c ?? 2, c.rot?.s ?? 2].forEach(mix);
  for (const d of lv.doors) [d.line, d.from, d.to, d.height, d.swing, d.hinge === 'from' ? 1 : 2, d.kind.length].forEach(mix);
  for (const i of lv.interactables) [i.x, i.y, i.z, i.id.length].forEach(mix);
  for (const sp of lv.spawns) [sp.x, sp.y, sp.z].forEach(mix);
  checksum = h.toString(16).padStart(8, '0');
  return checksum;
}

export function getLevel(): Level {
  if (!cached) cached = buildLevel();
  return cached;
}

export function buildLevel(): Level {
  const roomById: Record<string, RoomDef> = {};
  for (const r of ROOMS) {
    if (roomById[r.id]) throw new Error(`duplicate room ${r.id}`);
    roomById[r.id] = r;
  }

  // 1. Cell maps per floor level.
  const levels = [...new Set(ROOMS.map((r) => r.floorY))];
  const cells = new Map<number, Map<string, string>>();
  const bounds = { x1: Infinity, z1: Infinity, x2: -Infinity, z2: -Infinity };
  for (const y of levels) cells.set(y, new Map());
  for (const r of ROOMS) {
    const m = cells.get(r.floorY) as Map<string, string>;
    for (const [x1, z1, x2, z2] of r.rects) {
      bounds.x1 = Math.min(bounds.x1, x1);
      bounds.z1 = Math.min(bounds.z1, z1);
      bounds.x2 = Math.max(bounds.x2, x2);
      bounds.z2 = Math.max(bounds.z2, z2);
      for (let x = x1; x < x2; x++) {
        for (let z = z1; z < z2; z++) {
          const k = key(x, z);
          const other = m.get(k);
          if (other && other !== r.id) throw new Error(`rooms ${other} and ${r.id} overlap at ${k}`);
          m.set(k, r.id);
        }
      }
    }
  }

  // 2. Openings and doors.
  const openings: OpeningDef[] = [];
  const doors: FrDoorDef[] = [];
  OPENING_SPECS.forEach((s, i) => {
    const doorSpec = s.door;
    const h =
      s.kind === 'arch'
        ? 2.9
        : s.kind === 'window'
          ? 2.4
          : doorSpec?.height ?? DOOR_H;
    openings.push({
      id: `o${i}`,
      axis: s.axis,
      line: s.line,
      from: s.from,
      to: s.to,
      kind: s.kind,
      head: h,
      sill: s.kind === 'window' ? 0.9 : 0,
      floorY: s.floorY,
    });
    if (doorSpec) {
      doors.push({
        id: doors.length,
        name: doorSpec.name ?? `door ${doors.length}`,
        kind: doorSpec.kind ?? 'swing',
        axis: s.axis,
        line: s.line,
        from: s.from,
        to: s.to,
        floorY: s.floorY,
        height: h,
        hinge: doorSpec.hinge ?? 'from',
        swing: doorSpec.swing ?? 1,
        locked: doorSpec.locked,
        circuit: doorSpec.circuit,
        startsOpen: doorSpec.startsOpen,
      });
    }
  });

  // 3. Edges between cells.
  const walls: WallRun[] = [];
  const lintels: WallRun[] = [];
  const colliders: Collider[] = [];
  const links = new Map<string, Set<string>>();
  const link = (a: string | null, b: string | null) => {
    if (!a || !b) return;
    if (!links.has(a)) links.set(a, new Set());
    if (!links.has(b)) links.set(b, new Set());
    (links.get(a) as Set<string>).add(b);
    (links.get(b) as Set<string>).add(a);
  };

  for (const floorY of levels) {
    const m = cells.get(floorY) as Map<string, string>;
    // axis 'x' walls: fixed x, run along z. axis 'z' walls: fixed z, run along x.
    const edges = { x: new Map<number, Map<number, Edge>>(), z: new Map<number, Map<number, Edge>>() };
    const add = (axis: 'x' | 'z', line: number, pos: number, e: Edge) => {
      const lines = edges[axis];
      if (!lines.has(line)) lines.set(line, new Map());
      (lines.get(line) as Map<number, Edge>).set(pos, e);
    };
    const ext = 1;
    for (let x = bounds.x1 - ext; x <= bounds.x2 + ext; x++) {
      for (let z = bounds.z1 - ext; z <= bounds.z2 + ext; z++) {
        const here = m.get(key(x, z)) ?? null;
        const west = m.get(key(x - 1, z)) ?? null;
        const north = m.get(key(x, z - 1)) ?? null;
        if (here !== west) add('x', x, z, { lo: west, hi: here, opening: -1 });
        if (here !== north) add('z', z, x, { lo: north, hi: here, opening: -1 });
      }
    }
    // Stamp openings onto this level's edges.
    openings.forEach((o, idx) => {
      if (o.floorY !== floorY) return;
      const lines = edges[o.axis].get(o.line);
      for (let p = o.from; p < o.to; p++) {
        const e = lines?.get(p);
        if (!e) throw new Error(`opening ${idx} (${o.axis}=${o.line} ${o.from}..${o.to}) is not on a wall at ${p}`);
        e.opening = idx;
        link(e.lo, e.hi);
        // Archways rise to half a metre under the lower of the two ceilings.
        if (o.kind === 'arch' && e.lo && e.hi) o.head = Math.max(o.head, Math.min(roomById[e.lo].ceilH, roomById[e.hi].ceilH) - 0.5);
      }
    });

    const topOf = (e: Edge) => Math.max(e.lo ? roomById[e.lo].ceilH : 0, e.hi ? roomById[e.hi].ceilH : 0);
    for (const axis of ['x', 'z'] as const) {
      for (const [line, byPos] of edges[axis]) {
        const positions = [...byPos.keys()].sort((a, b) => a - b);
        let i = 0;
        while (i < positions.length) {
          const start = positions[i];
          const e0 = byPos.get(start) as Edge;
          let end = start + 1;
          let j = i + 1;
          while (j < positions.length && positions[j] === end) {
            const e = byPos.get(positions[j]) as Edge;
            if (e.lo !== e0.lo || e.hi !== e0.hi || e.opening !== e0.opening || topOf(e) !== topOf(e0)) break;
            end++;
            j++;
          }
          i = j;
          const thick = e0.lo === null || e0.hi === null ? THICK : THIN;
          const top = floorY + topOf(e0);
          const isOpenAt = (pos: number) => (byPos.get(pos)?.opening ?? -1) >= 0;
          const run: WallRun = { axis, line, a: start, b: end, y1: floorY, y2: top, thick, lo: e0.lo, hi: e0.hi };
          if (e0.opening < 0) {
            const a = start - (isOpenAt(start - 1) ? 0 : thick / 2);
            const b = end + (isOpenAt(end) ? 0 : thick / 2);
            walls.push({ ...run, a, b });
            colliders.push(wallBox(axis, line, a, b, floorY, top, thick, 'wall'));
          } else {
            const o = openings[e0.opening];
            const head = floorY + o.head;
            lintels.push({ ...run, y1: head, y2: top });
            colliders.push(wallBox(axis, line, start, end, head, top, thick, 'wall'));
            if (o.sill > 0) {
              lintels.push({ ...run, y1: floorY, y2: floorY + o.sill });
              colliders.push(wallBox(axis, line, start, end, floorY, floorY + o.sill, thick, 'wall'));
            }
            if (o.kind === 'window' || o.kind === 'glass') {
              colliders.push(wallBox(axis, line, start, end, floorY + o.sill, head, 0.1, 'glass'));
            }
          }
        }
      }
    }
  }
  link('stairTop', 'stairBot');

  // 4. Door colliders (the sim switches them off while the door is open).
  for (const d of doors) {
    const lo = d.from;
    const hi = d.to;
    const b = d.axis === 'z' ? { x1: lo, x2: hi, z1: d.line - 0.06, z2: d.line + 0.06 } : { z1: lo, z2: hi, x1: d.line - 0.06, x2: d.line + 0.06 };
    colliders.push({ ...b, y1: d.floorY, y2: d.floorY + d.height, door: d.id, kind: 'door' });
  }

  // 5. Floors and ceilings.
  for (const r of ROOMS) {
    for (const [x1, z1, x2, z2] of r.rects) {
      if (!r.noFloor) colliders.push({ x1, x2, z1, z2, y1: r.floorY - 0.6, y2: r.floorY, kind: 'floor' });
      if (!r.noCeil) colliders.push({ x1, x2, z1, z2, y1: r.floorY + r.ceilH, y2: r.floorY + r.ceilH + 0.4, kind: 'ceiling' });
    }
  }

  // 6. Props.
  const props = PROPS.map((p) => ({ ...p }));
  for (const p of props) colliders.push(...propColliders(p));
  colliders.push(...officeKitColliders(), ...roomKitColliders());

  // 7. Lights.
  const lights = buildLights(roomById);

  const audio: AudioZone[] = ROOMS.map((r) => ({
    room: r.id,
    reverb: r.style === 'dining' || r.style === 'stage' ? 'big' : r.style === 'tile' ? 'tile' : r.id === 'bHall' ? 'tunnel' : r.ceilH > 4 ? 'hall' : 'small',
  }));

  return {
    rooms: ROOMS,
    roomById,
    openings,
    doors,
    walls,
    lintels,
    props,
    colliders,
    lights,
    interactables: mountOnWalls(INTERACTABLES, colliders),
    spawns: SPAWNS,
    itemSpawns: ITEM_SPAWNS,
    cameras: CAMERAS,
    hidingSpots: HIDE_SPECS.map((h, id) => ({
      ...h,
      id,
      capacity: h.capacity ?? 1,
      enterTime: h.enterTime ?? 0.9,
      hazard: h.hazard ?? 'none',
      yaw: Math.atan2(-(h.exits[0].x - h.x), -(h.exits[0].z - h.z)),
    })),
    audio,
    bounds: { x1: bounds.x1, z1: bounds.z1, x2: bounds.x2, z2: bounds.z2 },
    links: Object.fromEntries([...links].map(([k, v]) => [k, [...v]])),
  };
}

/**
 * Wall-mounted controls are authored 0.1 m off the wall line, which is right for 0.2 m interior walls but buries
 * them in 0.35 m exterior walls. Push any that start inside a wall out along their facing until they sit on the
 * face, so the plate you see is on the surface and the hand can reach it.
 */
function mountOnWalls(items: InteractableDef[], colliders: Collider[]): InteractableDef[] {
  const mounted = new Set<InteractableDef['type']>(['zoneSwitch', 'fuseBox', 'breaker', 'mainBreaker']);
  const walls = colliders.filter((c) => c.kind === 'wall');
  return items.map((it) => {
    if (!mounted.has(it.type)) return it;
    const nx = Math.sin((it.ry * Math.PI) / 180);
    const nz = Math.cos((it.ry * Math.PI) / 180);
    const out = { ...it };
    const inside = () => walls.some((c) => out.x > c.x1 && out.x < c.x2 && out.z > c.z1 && out.z < c.z2 && out.y > c.y1 && out.y < c.y2);
    for (let i = 0; i < 40 && inside(); i++) {
      out.x += nx * 0.01;
      out.z += nz * 0.01;
    }
    if (out !== it && (out.x !== it.x || out.z !== it.z)) {
      out.x += nx * 0.015;
      out.z += nz * 0.015;
    }
    return out;
  });
}

function wallBox(axis: 'x' | 'z', line: number, a: number, b: number, y1: number, y2: number, thick: number, kind: Collider['kind']): Collider {
  return axis === 'x'
    ? { x1: line - thick / 2, x2: line + thick / 2, z1: a, z2: b, y1, y2, kind }
    : { z1: line - thick / 2, z2: line + thick / 2, x1: a, x2: b, y1, y2, kind };
}

function buildLights(roomById: Record<string, RoomDef>): LightDef[] {
  const rng = createRng(77);
  const out: LightDef[] = [];
  const push = (l: Omit<LightDef, 'id'>) => out.push({ ...l, id: out.length });
  for (const r of Object.values(roomById)) {
    const kind = lightKindFor(r);
    const spacing = kind === 'pendant' ? 7.5 : kind === 'caged' ? 5 : 6;
    for (const [x1, z1, x2, z2] of r.rects) {
      const w = x2 - x1;
      const d = z2 - z1;
      const nx = Math.max(1, Math.round(w / spacing));
      const nz = Math.max(1, Math.round(d / spacing));
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nz; j++) {
          const flickerRoll = next(rng);
          const flicker: Flicker = flickerRoll < 0.08 ? 'buzz' : flickerRoll < 0.12 ? 'dead' : 'none';
          const warm = r.style === 'dining' || r.style === 'prize' || r.style.startsWith('party');
          push({
            room: r.id,
            x: x1 + ((i + 0.5) * w) / nx,
            z: z1 + ((j + 0.5) * d) / nz,
            y: r.floorY + r.ceilH - (kind === 'pendant' ? 1.0 : 0.12),
            kind,
            color: warm ? '#ffd9a0' : r.style === 'tile' || r.style === 'steel' ? '#d8f0ff' : '#eef0f4',
            // Dim, institutional light: pools under fixtures, dark corners between them (the old values washed
            // every lit room out to white).
            intensity: kind === 'pendant' ? 36 : kind === 'caged' ? 12 : kind === 'bulb' ? 10 : 15,
            circuit: r.circuit,
            flicker,
            real: true,
          });
        }
      }
      if (r.emergency) {
        push({
          room: r.id,
          x: x1 + w / 2,
          z: z1 + d / 2,
          y: r.floorY + r.ceilH - 0.4,
          kind: 'emergency',
          color: '#ff2a18',
          intensity: 6,
          circuit: r.circuit,
          flicker: 'none',
          real: true,
        });
      }
    }
  }
  // Landmarks: West Hall's permanently buzzing tube, Parts & Service's sparking bulb.
  const westHall = out.find((l) => l.room === 'westHall' && l.kind === 'fluoro');
  if (westHall) westHall.flicker = 'buzz';
  const parts = out.find((l) => l.room === 'parts');
  if (parts) parts.flicker = 'spark';
  // The Security Office has one warm bulb on a cord over the desk, not a ceiling tube (see officeKit.ts).
  const office = out.find((l) => l.room === 'office');
  if (office) Object.assign(office, { kind: 'bulb', x: 25, z: 50.3, y: 2.38, color: '#ffcf96', intensity: 8, flicker: 'none' });
  // Neon signs and the prize corner spots.
  push({ room: 'prize', x: 22, y: 3.2, z: 0.4, kind: 'neon', color: '#ff5fb0', intensity: 12, circuit: 'always', flicker: 'none', real: true });
  push({ room: 'stage', x: 61, y: 4.2, z: 11, kind: 'neon', color: '#4aa0ff', intensity: 14, circuit: 'stage', flicker: 'buzz', real: true });
  return out;
}
