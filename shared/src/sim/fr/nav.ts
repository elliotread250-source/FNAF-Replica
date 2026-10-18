import type { Level } from '../../world/types';
import { CollisionWorld } from './collision';

// Navigation for the animatronics: a 0.5 m walk grid flood-filled from the spawn with the real collision
// world (doors treated as open), so anything an agent can path through, a body could physically walk.
// Doors become marked edges: the agent stops and opens them. Paths come from A* and are string-pulled.

const CELL = 0.5;
const AGENT_R = 0.36;
const AGENT_H = 2.0;
const STEP = 0.35;

export interface NavPathPoint {
  x: number;
  y: number;
  z: number;
  /** Door this segment passes through (the agent must open it), or -1. */
  door: number;
}

export class NavGrid {
  readonly xs: number[] = [];
  readonly ys: number[] = [];
  readonly zs: number[] = [];
  /** 8 neighbour slots per node, -1 for none. */
  readonly nbr: Int32Array;
  /** Door id crossed by the edge in the same slot, -1 for none. */
  readonly nbrDoor: Int16Array;
  /** Room id per node (for zone-aware choices). */
  readonly room: (string | null)[] = [];
  private lookup = new Map<string, number[]>();

  constructor(
    private readonly level: Level,
    world: CollisionWorld,
  ) {
    const saved = Float32Array.from(world.doorOpen);
    world.doorOpen.fill(1);
    const key = (ix: number, iz: number) => `${ix},${iz}`;
    const addNode = (x: number, y: number, z: number): number => {
      const id = this.xs.length;
      this.xs.push(x);
      this.ys.push(y);
      this.zs.push(z);
      const k = key(Math.round(x / CELL), Math.round(z / CELL));
      const list = this.lookup.get(k);
      if (list) list.push(id);
      else this.lookup.set(k, [id]);
      return id;
    };
    const findAt = (ix: number, iz: number, y: number): number => {
      const list = this.lookup.get(key(ix, iz));
      if (!list) return -1;
      for (const id of list) if (Math.abs(this.ys[id] - y) < 0.2) return id;
      return -1;
    };
    // Flood fill from every spawn and every room centre, so disconnected-by-locked-door rooms still exist.
    const seeds: [number, number, number][] = level.spawns.map((s) => [s.x, s.z, s.y]);
    for (const r of level.rooms) {
      const [x1, z1, x2, z2] = r.rects[0];
      seeds.push([Math.round(((x1 + x2) / 2) / CELL) * CELL, Math.round(((z1 + z2) / 2) / CELL) * CELL, r.floorY]);
    }
    const queue: number[] = [];
    for (const [sx0, sz0, sy] of seeds) {
      const sx = Math.round(sx0 / CELL) * CELL;
      const sz = Math.round(sz0 / CELL) * CELL;
      const g = world.groundAt(sx, sy + 0.1, sz, AGENT_R, STEP);
      if (g === -Infinity || world.blocked(sx, g, sz, AGENT_R, AGENT_H, STEP)) continue;
      if (findAt(Math.round(sx / CELL), Math.round(sz / CELL), g) >= 0) continue;
      queue.push(addNode(sx, g, sz));
    }
    const edges: [number, number][] = [];
    while (queue.length) {
      const id = queue.pop() as number;
      const x = this.xs[id];
      const y = this.ys[id];
      const z = this.zs[id];
      for (const [dx, dz] of [
        [CELL, 0],
        [-CELL, 0],
        [0, CELL],
        [0, -CELL],
      ]) {
        const nx = x + dx;
        const nz = z + dz;
        const g = world.groundAt(nx, y, nz, AGENT_R, STEP);
        if (g === -Infinity || g < y - 0.8) continue;
        if (world.blocked(nx, g, nz, AGENT_R, AGENT_H, STEP)) continue;
        let n = findAt(Math.round(nx / CELL), Math.round(nz / CELL), g);
        if (n < 0) {
          n = addNode(nx, g, nz);
          queue.push(n);
        }
        edges.push([id, n]);
      }
    }
    world.doorOpen.set(saved);

    const N = this.xs.length;
    this.nbr = new Int32Array(N * 8).fill(-1);
    this.nbrDoor = new Int16Array(N * 8).fill(-1);
    const addEdge = (a: number, b: number) => {
      for (let s = 0; s < 8; s++) {
        if (this.nbr[a * 8 + s] === b) return;
        if (this.nbr[a * 8 + s] === -1) {
          this.nbr[a * 8 + s] = b;
          this.nbrDoor[a * 8 + s] = this.doorBetween(a, b);
          return;
        }
      }
    };
    for (const [a, b] of edges) {
      addEdge(a, b);
      addEdge(b, a);
    }
    // Diagonals where both orthogonal neighbours exist and no door is involved.
    for (let a = 0; a < N; a++) {
      const ortho = [...this.nbr.slice(a * 8, a * 8 + 8)].filter((v) => v >= 0);
      for (const b of ortho) {
        for (const c of ortho) {
          if (b >= c) continue;
          if (this.xs[b] === this.xs[c] || this.zs[b] === this.zs[c]) continue;
          // b and c are perpendicular neighbours; their shared neighbour (not a) is the diagonal.
          const dx = this.xs[b] + this.xs[c] - this.xs[a];
          const dz = this.zs[b] + this.zs[c] - this.zs[a];
          const d = findAt(Math.round(dx / CELL), Math.round(dz / CELL), this.ys[a]);
          if (d < 0) continue;
          if (this.doorBetween(a, b) >= 0 || this.doorBetween(a, c) >= 0 || this.doorBetween(b, d) >= 0 || this.doorBetween(c, d) >= 0) continue;
          if (!this.linked(b, d) || !this.linked(c, d)) continue;
          addEdge(a, d);
        }
      }
    }
    for (let i = 0; i < N; i++) this.room.push(this.roomAt(this.xs[i], this.ys[i], this.zs[i]));
  }

  get size(): number {
    return this.xs.length;
  }

  private linked(a: number, b: number): boolean {
    for (let s = 0; s < 8; s++) if (this.nbr[a * 8 + s] === b) return true;
    return false;
  }

  private doorBetween(a: number, b: number): number {
    const ax = this.xs[a];
    const az = this.zs[a];
    const bx = this.xs[b];
    const bz = this.zs[b];
    for (const d of this.level.doors) {
      if (Math.abs(d.floorY - this.ys[a]) > 1.2) continue;
      if (d.axis === 'z') {
        if ((az - d.line) * (bz - d.line) > 0) continue;
        if (az === bz) continue;
        const x = (ax + bx) / 2;
        if (x >= d.from - 0.01 && x <= d.to + 0.01) return d.id;
      } else {
        if ((ax - d.line) * (bx - d.line) > 0) continue;
        if (ax === bx) continue;
        const z = (az + bz) / 2;
        if (z >= d.from - 0.01 && z <= d.to + 0.01) return d.id;
      }
    }
    return -1;
  }

  roomAt(x: number, y: number, z: number): string | null {
    for (const r of this.level.rooms) {
      if (y < r.floorY - 0.6 || y > r.floorY + r.ceilH) continue;
      for (const [x1, z1, x2, z2] of r.rects) if (x >= x1 && x < x2 && z >= z1 && z < z2) return r.id;
    }
    return null;
  }

  /** Closest node to a point (searching outward a few cells), or -1. */
  nearest(x: number, y: number, z: number, maxCells = 6): number {
    const ix = Math.round(x / CELL);
    const iz = Math.round(z / CELL);
    let best = -1;
    let bestD = Infinity;
    for (let r = 0; r <= maxCells; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const list = this.lookup.get(`${ix + dx},${iz + dz}`);
          if (!list) continue;
          for (const id of list) {
            if (Math.abs(this.ys[id] - y) > 1.6) continue;
            const d = (this.xs[id] - x) ** 2 + (this.zs[id] - z) ** 2 + (this.ys[id] - y) ** 2 * 4;
            if (d < bestD) {
              bestD = d;
              best = id;
            }
          }
        }
      }
      if (best >= 0 && r >= 1) break;
    }
    return best;
  }

  /**
   * A* from node to node. `doorOk(id)` says whether a door may be passed (closed swing doors can be
   * opened by agents; shutters and locked doors cannot). Returns string-pulled waypoints or null.
   */
  findPath(from: number, to: number, doorOk: (door: number) => boolean, maxExpand = 60000): NavPathPoint[] | null {
    if (from < 0 || to < 0) return null;
    if (from === to) return [{ x: this.xs[to], y: this.ys[to], z: this.zs[to], door: -1 }];
    const N = this.size;
    const g = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const cameDoor = new Int16Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = new MinHeap();
    const h = (n: number) => Math.hypot(this.xs[n] - this.xs[to], this.zs[n] - this.zs[to], (this.ys[n] - this.ys[to]) * 2);
    g[from] = 0;
    heap.push(from, h(from));
    let expanded = 0;
    while (heap.size) {
      const cur = heap.pop();
      if (cur === to) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (++expanded > maxExpand) return null;
      for (let s = 0; s < 8; s++) {
        const n = this.nbr[cur * 8 + s];
        if (n < 0 || closed[n]) continue;
        const door = this.nbrDoor[cur * 8 + s];
        if (door >= 0 && !doorOk(door)) continue;
        const cost = Math.hypot(this.xs[n] - this.xs[cur], this.zs[n] - this.zs[cur], this.ys[n] - this.ys[cur]) + (door >= 0 ? 1.5 : 0);
        const ng = g[cur] + cost;
        if (ng < g[n]) {
          g[n] = ng;
          came[n] = cur;
          cameDoor[n] = door;
          heap.push(n, ng + h(n));
        }
      }
    }
    if (came[to] < 0) return null;
    const raw: NavPathPoint[] = [];
    for (let n = to; n !== from; n = came[n]) raw.push({ x: this.xs[n], y: this.ys[n], z: this.zs[n], door: cameDoor[n] });
    raw.push({ x: this.xs[from], y: this.ys[from], z: this.zs[from], door: -1 });
    raw.reverse();
    return this.smooth(raw);
  }

  /** Drop waypoints while the straight line between kept points stays on the grid and level. */
  private smooth(pts: NavPathPoint[]): NavPathPoint[] {
    const out: NavPathPoint[] = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = i + 1;
      // A door crossing must stay its own segment: keep the node before and after it.
      while (j + 1 < pts.length && pts[j + 1].door < 0 && pts[j].door < 0 && this.straight(pts[i], pts[j + 1])) j++;
      out.push(pts[j]);
      i = j;
    }
    return out;
  }

  private straight(a: NavPathPoint, b: NavPathPoint): boolean {
    if (Math.abs(a.y - b.y) > 0.05) return false;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.ceil(len / (CELL * 0.5));
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      // All four surrounding grid cells must be walkable at this height.
      for (const [ox, oz] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ]) {
        const ix = Math.floor(x / CELL) + ox;
        const iz = Math.floor(z / CELL) + oz;
        const list = this.lookup.get(`${ix},${iz}`);
        if (!list || !list.some((id) => Math.abs(this.ys[id] - a.y) < 0.2)) return false;
      }
    }
    return true;
  }

  /** Random node in a room, deterministic given the roll. */
  nodeInRoom(roomId: string, roll: number): number {
    const ids: number[] = [];
    for (let i = 0; i < this.size; i += 3) if (this.room[i] === roomId) ids.push(i);
    if (!ids.length) return -1;
    return ids[Math.floor(roll * ids.length) % ids.length];
  }
}

class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];
  get size(): number {
    return this.ids.length;
  }
  push(id: number, k: number): void {
    this.ids.push(id);
    this.keys.push(k);
    let i = this.ids.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= this.keys[i]) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.ids[0];
    const lastId = this.ids.pop() as number;
    const lastK = this.keys.pop() as number;
    if (this.ids.length) {
      this.ids[0] = lastId;
      this.keys[0] = lastK;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.ids.length && this.keys[l] < this.keys[m]) m = l;
        if (r < this.ids.length && this.keys[r] < this.keys[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number): void {
    [this.ids[a], this.ids[b]] = [this.ids[b], this.ids[a]];
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
  }
}
