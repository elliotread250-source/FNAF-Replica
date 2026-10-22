import type { Box, Collider, FrDoorDef, Level } from '../../world/types';

const CELL = 4;
const cellKey = (cx: number, cz: number) => cx * 4096 + cz;

/** How far a swing door's blade turns when fully open. The renderer poses the mesh with the same number. */
export const DOOR_SWING_MAX = (Math.PI / 2) * 0.94;
/** Collision thickness of a swung blade, and the longest box used to approximate it. */
const BLADE_T = 0.08;
const BLADE_LINK = 0.2;
/** A shutter's slab stops this far short of its full height when raised. */
export const SHUTTER_HEADROOM = 0.15;

/** One door leaf: the hinge point on the ground plane and the leaf's vector when open by `open`. */
export interface DoorLeaf {
  hx: number;
  hz: number;
  vx: number;
  vz: number;
  /** Y rotation (radians) the renderer should apply to this leaf's pivot. */
  angle: number;
}

/**
 * Where each leaf of a hinged door sits for an openness 0..1. Shared by collision and rendering so the blade
 * you see is the blade you bump into. Rotation follows three.js: (x, z) -> (x cos + z sin, -x sin + z cos).
 */
export function doorLeaves(d: FrDoorDef, open: number): DoorLeaf[] {
  const alongX = d.axis === 'z';
  const w = d.to - d.from;
  const rot = (x: number, z: number, a: number): [number, number] => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
  if (d.kind === 'double') {
    const mid = (d.from + d.to) / 2;
    return [-1, 1].map((side) => {
      const edge = mid + side * (w / 2);
      const angle = (alongX ? -1 : 1) * (side === -1 ? 1 : -1) * d.swing * open * DOOR_SWING_MAX;
      const len = -side * (w / 2);
      const [vx, vz] = rot(alongX ? len : 0, alongX ? 0 : len, angle);
      return { hx: alongX ? edge : d.line, hz: alongX ? d.line : edge, vx, vz, angle };
    });
  }
  const s = d.hinge === 'from' ? 1 : -1;
  const hinge = d.hinge === 'from' ? d.from : d.to;
  const angle = (alongX ? -1 : 1) * s * d.swing * open * DOOR_SWING_MAX;
  const [vx, vz] = rot(alongX ? s * w : 0, alongX ? 0 : s * w, angle);
  return [{ hx: alongX ? hinge : d.line, hz: alongX ? d.line : hinge, vx, vz, angle }];
}

const isHinged = (d: FrDoorDef) => d.kind === 'swing' || d.kind === 'exit' || d.kind === 'glass' || d.kind === 'double';

/**
 * The boxes a door occupies at openness `open`. Closed doors are one slab across the opening. Shutters and
 * rollers keep their footprint but their underside rises with the slab, so you can duck under a half-open
 * shutter but not walk through one. Hinged doors become a chain of small boxes along each swung blade.
 * Curtains are cloth: solid until mostly drawn, then nothing.
 */
export function doorBoxes(d: FrDoorDef, closed: Collider, open: number, out: Collider[]): Collider[] {
  out.length = 0;
  if (open <= 0.02) {
    out.push(closed);
    return out;
  }
  if (d.kind === 'shutter' || d.kind === 'roller') {
    out.push({ ...closed, y1: d.floorY + open * (d.height - SHUTTER_HEADROOM) });
    return out;
  }
  if (!isHinged(d)) {
    if (open < 0.7) out.push(closed);
    return out;
  }
  for (const l of doorLeaves(d, open)) {
    const len = Math.hypot(l.vx, l.vz);
    const n = Math.max(1, Math.ceil(len / BLADE_LINK));
    const hx = Math.abs(l.vx / n) / 2 + BLADE_T / 2;
    const hz = Math.abs(l.vz / n) / 2 + BLADE_T / 2;
    for (let k = 0; k < n; k++) {
      const cx = l.hx + (l.vx * (k + 0.5)) / n;
      const cz = l.hz + (l.vz * (k + 0.5)) / n;
      out.push({ x1: cx - hx, x2: cx + hx, z1: cz - hz, z2: cz + hz, y1: closed.y1, y2: closed.y2, door: d.id, kind: 'door' });
    }
  }
  return out;
}

/** Everything a door can ever occupy on the ground plane, for the spatial hash. */
function doorSweep(d: FrDoorDef, closed: Box): Box {
  if (!isHinged(d)) return closed;
  const w = d.to - d.from + BLADE_T;
  const alongX = d.axis === 'z';
  return alongX
    ? { x1: d.from - BLADE_T, x2: d.to + BLADE_T, z1: d.line - w, z2: d.line + w, y1: closed.y1, y2: closed.y2 }
    : { z1: d.from - BLADE_T, z2: d.to + BLADE_T, x1: d.line - w, x2: d.line + w, y1: closed.y1, y2: closed.y2 };
}

/** Spatial hash over the level's collision boxes, plus live door state. Shared by the server and the client. */
export class CollisionWorld {
  readonly colliders: Collider[];
  /**
   * 0 = closed, 1 = open, per door id. Writers may set it directly; the posed collision shape of each door
   * follows it (see `doorBoxes`). AI and nav treat a door as passable from 0.7.
   */
  readonly doorOpen: Float32Array;
  private readonly doorDefs: FrDoorDef[];
  /** Posed boxes per door and the openness they were posed for. */
  private posed: { open: number; closed: Collider; boxes: Collider[] }[];
  private grid = new Map<number, number[]>();
  private stamp: Int32Array;
  private stampN = 0;

  constructor(level: Pick<Level, 'colliders' | 'doors'>) {
    this.colliders = level.colliders;
    this.doorDefs = level.doors;
    this.doorOpen = new Float32Array(level.doors.length);
    level.doors.forEach((d, i) => (this.doorOpen[i] = d.startsOpen ? 1 : 0));
    this.posed = level.doors.map((d) => ({ open: NaN, closed: level.colliders.find((c) => c.door === d.id) as Collider, boxes: [] }));
    this.stamp = new Int32Array(this.colliders.length);
    this.colliders.forEach((c0, i) => {
      const c = c0.door === undefined ? c0 : doorSweep(this.doorDefs[c0.door], c0);
      const x1 = Math.floor(c.x1 / CELL);
      const x2 = Math.floor(c.x2 / CELL);
      const z1 = Math.floor(c.z1 / CELL);
      const z2 = Math.floor(c.z2 / CELL);
      for (let cx = x1; cx <= x2; cx++) {
        for (let cz = z1; cz <= z2; cz++) {
          const k = cellKey(cx, cz);
          const list = this.grid.get(k);
          if (list) list.push(i);
          else this.grid.set(k, [i]);
        }
      }
    });
  }

  /** Colliders returned by `query` are already posed for their door's state, so every one of them is live. */
  isActive(c: Collider): boolean {
    void c;
    return true;
  }

  /** The boxes door `id` occupies right now. */
  doorShape(id: number): Collider[] {
    const p = this.posed[id];
    const open = this.doorOpen[id];
    if (p.open !== open) {
      doorBoxes(this.doorDefs[id], p.closed, open, p.boxes);
      p.open = open;
    }
    return p.boxes;
  }

  /** Boxes whose footprint touches the rectangle, with doors posed. The returned array is reused between calls. */
  query(x1: number, z1: number, x2: number, z2: number, out: Collider[] = []): Collider[] {
    out.length = 0;
    this.stampN++;
    for (let cx = Math.floor(x1 / CELL); cx <= Math.floor(x2 / CELL); cx++) {
      for (let cz = Math.floor(z1 / CELL); cz <= Math.floor(z2 / CELL); cz++) {
        const list = this.grid.get(cellKey(cx, cz));
        if (!list) continue;
        for (const i of list) {
          if (this.stamp[i] === this.stampN) continue;
          this.stamp[i] = this.stampN;
          const c = this.colliders[i];
          if (c.door !== undefined) {
            for (const b of this.doorShape(c.door)) if (!(b.x2 < x1 || b.x1 > x2 || b.z2 < z1 || b.z1 > z2)) out.push(b);
            continue;
          }
          if (c.x2 < x1 || c.x1 > x2 || c.z2 < z1 || c.z1 > z2) continue;
          out.push(c);
        }
      }
    }
    return out;
  }

  /**
   * Does a vertical cylinder (radius r, from y to y+h) overlap anything solid? Boxes whose top is within
   * `step` of y are ground, not obstacles. Floors under y never block.
   */
  blocked(x: number, y: number, z: number, r: number, h: number, step: number): boolean {
    const near = this.query(x - r, z - r, x + r, z + r, []);
    for (const c of near) {
      if (!this.isActive(c) || c.kind === 'floor') continue;
      if (c.y2 <= y + step || c.y1 >= y + h) continue;
      if (circleBox(x, z, r, c) > 0) return true;
    }
    return false;
  }

  /** Highest walkable surface under the circle that is no more than `step` above `y`. -Infinity if none. */
  groundAt(x: number, y: number, z: number, r: number, step: number): number {
    const near = this.query(x - r, z - r, x + r, z + r, []);
    let best = -Infinity;
    for (const c of near) {
      if (!this.isActive(c)) continue;
      if (c.kind === 'ceiling' || c.kind === 'glass' || c.kind === 'door') continue;
      if (c.y2 > y + step + 1e-4) continue;
      if (c.y2 <= best) continue;
      // Support only if the centre or most of the circle is over the box, so you don't hover on a wall edge.
      if (circleBox(x, z, r * 0.7, c) > 0 || (x >= c.x1 && x <= c.x2 && z >= c.z1 && z <= c.z2)) best = c.y2;
    }
    return best;
  }

  /** Lowest ceiling above y within the circle, or Infinity. */
  ceilingAt(x: number, y: number, z: number, r: number): number {
    const near = this.query(x - r, z - r, x + r, z + r, []);
    let best = Infinity;
    for (const c of near) {
      if (!this.isActive(c) || c.kind === 'floor') continue;
      if (c.y1 < y - 1e-4) continue;
      if (circleBox(x, z, r * 0.9, c) > 0 && c.y1 < best) best = c.y1;
    }
    return best;
  }

  /** Ray against all active boxes, optionally ignoring glass. Returns the hit distance or Infinity. */
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number, opts: { glass?: boolean } = {}): number {
    const ex = ox + dx * maxT;
    const ez = oz + dz * maxT;
    const near = this.query(Math.min(ox, ex) - 0.05, Math.min(oz, ez) - 0.05, Math.max(ox, ex) + 0.05, Math.max(oz, ez) + 0.05, []);
    let best = Infinity;
    for (const c of near) {
      if (!this.isActive(c)) continue;
      if (c.kind === 'glass' && opts.glass === false) continue;
      const t = rayBox(ox, oy, oz, dx, dy, dz, c);
      if (t >= 0 && t < best && t <= maxT) best = t;
    }
    return best;
  }

  /** How many walls (and closed doors) a straight line passes through, for sound attenuation. Capped at 3. */
  countBetween(ax: number, ay: number, az: number, bx: number, by: number, bz: number): { walls: number; doors: number } {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    const out = { walls: 0, doors: 0 };
    if (len < 1e-3) return out;
    const near = this.query(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), []);
    for (const c of near) {
      if (!this.isActive(c) || c.kind === 'prop' || c.kind === 'step') continue;
      const t = rayBox(ax, ay, az, dx / len, dy / len, dz / len, c);
      if (t < 0 || t > len) continue;
      if (c.kind === 'door') out.doors++;
      else out.walls++;
      if (out.walls + out.doors >= 3) break;
    }
    return out;
  }

  /** Line of sight between two points, ignoring glass if asked. */
  clearLine(ax: number, ay: number, az: number, bx: number, by: number, bz: number, glassBlocks = false): boolean {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return true;
    return this.raycast(ax, ay, az, dx / len, dy / len, dz / len, len - 0.02, { glass: glassBlocks }) === Infinity;
  }
}

/**
 * Circle vs box in XZ. Returns penetration depth (> 0 if overlapping) and, via `pushOut`, the correction.
 */
export function circleBox(cx: number, cz: number, r: number, b: Box): number {
  const nx = Math.max(b.x1, Math.min(cx, b.x2));
  const nz = Math.max(b.z1, Math.min(cz, b.z2));
  const d = Math.hypot(cx - nx, cz - nz);
  if (d < r - 1e-6) return r - d + (d === 0 ? 1e-6 : 0);
  return 0;
}

const push = { x: 0, z: 0 };
/** Minimum push that moves the circle out of the box. Result is in a shared scratch object. */
export function pushOut(cx: number, cz: number, r: number, b: Box): { x: number; z: number } | null {
  const nx = Math.max(b.x1, Math.min(cx, b.x2));
  const nz = Math.max(b.z1, Math.min(cz, b.z2));
  const dx = cx - nx;
  const dz = cz - nz;
  const d = Math.hypot(dx, dz);
  if (d >= r - 1e-6) return null;
  if (d > 1e-6) {
    const k = (r - d) / d;
    push.x = dx * k;
    push.z = dz * k;
    return push;
  }
  // Centre is inside the box: leave by the nearest face.
  const left = cx - b.x1;
  const right = b.x2 - cx;
  const up = cz - b.z1;
  const down = b.z2 - cz;
  const m = Math.min(left, right, up, down);
  if (m === left) {
    push.x = -(left + r);
    push.z = 0;
  } else if (m === right) {
    push.x = right + r;
    push.z = 0;
  } else if (m === up) {
    push.x = 0;
    push.z = -(up + r);
  } else {
    push.x = 0;
    push.z = down + r;
  }
  return push;
}

/** Slab test. Returns the entry distance, or -1. */
export function rayBox(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, b: Box): number {
  let tmin = 0;
  let tmax = Infinity;
  const axes: [number, number, number, number][] = [
    [ox, dx, b.x1, b.x2],
    [oy, dy, b.y1, b.y2],
    [oz, dz, b.z1, b.z2],
  ];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return -1;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}
