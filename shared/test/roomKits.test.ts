import { describe, expect, it } from 'vitest';
import { CollisionWorld, FR, OFFICE_KIT, ROOM_KITS, getLevel, type Collider } from '../src';

// Invariants for the building-wide set dressing catalogue (shared/src/world/roomKits.ts).

const level = getLevel();
const P = FR.player;
const inRoom = (room: string, x: number, z: number, pad: number) =>
  level.roomById[room].rects.some(([x1, z1, x2, z2]) => x >= x1 - pad && x <= x2 + pad && z >= z1 - pad && z <= z2 + pad);

describe('room kits', () => {
  it('have unique ids, known rooms, and sit on their floor', () => {
    const ids = [...ROOM_KITS.map((p) => p.id), ...OFFICE_KIT.map((p) => p.id)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of ROOM_KITS) {
      const r = level.roomById[p.room];
      expect(r, p.id).toBeDefined();
      expect(inRoom(p.room, p.x, p.z, 0.2), p.id).toBe(true);
      expect(p.y, p.id).toBeGreaterThanOrEqual(r.floorY - 1e-6);
      expect(p.y + (p.policy === 'flat' ? 0 : p.policy === 'overhead' ? p.h / 2 : p.h), p.id).toBeLessThanOrEqual(r.floorY + r.ceilH + 1e-6);
    }
  });

  it('give solid parts colliders no bigger than what is drawn, and nothing else gets one', () => {
    for (const p of ROOM_KITS) {
      if (p.policy !== 'solid') {
        expect(p.boxes, p.id).toBeUndefined();
        continue;
      }
      expect(p.boxes?.length, p.id).toBeGreaterThan(0);
      for (const b of p.boxes ?? []) {
        expect(b.x1, p.id).toBeGreaterThanOrEqual(p.x - p.w / 2 - 1e-6);
        expect(b.x2, p.id).toBeLessThanOrEqual(p.x + p.w / 2 + 1e-6);
        expect(b.z1, p.id).toBeGreaterThanOrEqual(p.z - p.d / 2 - 1e-6);
        expect(b.z2, p.id).toBeLessThanOrEqual(p.z + p.d / 2 + 1e-6);
      }
    }
  });

  it('keep solid parts out of walls, other furniture and a 0.7 m apron in front of every doorway', () => {
    const walls = level.colliders.filter((c) => c.kind === 'wall');
    const mine = new Set(ROOM_KITS.flatMap((p) => p.boxes ?? []));
    const others = level.colliders.filter((c) => (c.kind === 'prop' || c.kind === 'step') && !mine.has(c));
    const hit = (a: Collider, b: Collider, pad: number) => a.x1 < b.x2 - pad && a.x2 > b.x1 + pad && a.z1 < b.z2 - pad && a.z2 > b.z1 + pad && a.y1 < b.y2 - pad && a.y2 > b.y1 + pad;
    const bad: string[] = [];
    for (const p of ROOM_KITS) {
      for (const b of p.boxes ?? []) {
        for (const w of walls) if (hit(b, w, 0.005)) bad.push(`${p.id} in a wall`);
        for (const o of others) if (hit(b, o, 0.005)) bad.push(`${p.id} in a prop at ${o.x1.toFixed(1)},${o.z1.toFixed(1)}`);
        for (const o of level.openings) {
          if (o.kind !== 'doorway' || Math.abs(o.floorY - b.y1) > 3) continue;
          const apron: Collider = o.axis === 'x' ? { x1: o.line - 0.7, x2: o.line + 0.7, z1: o.from, z2: o.to, y1: o.floorY, y2: o.floorY + 2 } : { z1: o.line - 0.7, z2: o.line + 0.7, x1: o.from, x2: o.to, y1: o.floorY, y2: o.floorY + 2 };
          if (hit(b, apron, 0)) bad.push(`${p.id} blocks a doorway at ${o.axis}=${o.line}`);
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('mount wall decals on a real wall face, never across an opening', () => {
    const walls = level.colliders.filter((c) => c.kind === 'wall');
    const bad: string[] = [];
    for (const p of ROOM_KITS) {
      if (p.policy !== 'flat' || p.kind === 'puddle') continue;
      const alongX = p.d < p.w; // a decal on a z-wall spans x
      const face = alongX ? p.z : p.x;
      const lo = (alongX ? p.x - p.w / 2 : p.z - p.d / 2) + 0.05;
      const hi = (alongX ? p.x + p.w / 2 : p.z + p.d / 2) - 0.05;
      const y1 = p.y - p.h / 2;
      const y2 = p.y + p.h / 2;
      // Every sampled point along the decal must be backed by a wall whose face is within 2 cm.
      for (let t = lo; t <= hi; t += 0.1) {
        const backed = walls.some((w) => {
          const [f1, f2, a1, a2] = alongX ? [w.z1, w.z2, w.x1, w.x2] : [w.x1, w.x2, w.z1, w.z2];
          return (Math.abs(face - f1) < 0.02 || Math.abs(face - f2) < 0.02) && t >= a1 && t <= a2 && y1 >= w.y1 - 0.01 && y2 <= w.y2 + 0.01;
        });
        const decor = p.room === 'stage' || p.id === 'cove.sign'; // on the stage backdrop / cove curtain meshes
        if (!backed && !decor) {
          bad.push(`${p.id} unbacked at ${t.toFixed(2)}`);
          break;
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('hang overhead parts above a jumping guard', () => {
    for (const p of ROOM_KITS.filter((q) => q.policy === 'overhead')) {
      const fy = level.roomById[p.room].floorY;
      expect(p.y - p.h / 2 - fy, p.id).toBeGreaterThanOrEqual(P.HEIGHT_STAND + P.JUMP_HEIGHT + 0.05);
    }
  });

  it('leave every hiding spot exit and item spawn usable', () => {
    const w = new CollisionWorld(level);
    w.doorOpen.fill(1);
    for (const h of level.hidingSpots) {
      const fy = level.roomById[h.room].floorY;
      for (const e of h.exits) {
        const g = w.groundAt(e.x, fy + 0.5, e.z, P.RADIUS, 1);
        expect(w.blocked(e.x, g, e.z, P.RADIUS, P.HEIGHT_CROUCH, P.STEP_HEIGHT), `${h.type} exit in ${h.room}`).toBe(false);
      }
    }
    const reach = P.INTERACT_RANGE + 1;
    const unreachable: string[] = [];
    for (const it of level.itemSpawns) {
      const fy = level.roomById[it.room].floorY;
      let ok = false;
      for (let r = 0.5; r <= 2.4 && !ok; r += 0.2)
        for (let a = 0; a < 24 && !ok; a++) {
          const x = it.x + Math.cos((a / 24) * Math.PI * 2) * r;
          const z = it.z + Math.sin((a / 24) * Math.PI * 2) * r;
          if (Math.hypot(it.x - x, it.z - z) > reach) continue;
          const g = w.groundAt(x, fy, z, P.RADIUS, P.STEP_HEIGHT);
          if (g === -Infinity || w.blocked(x, g, z, P.RADIUS, P.HEIGHT_STAND, P.STEP_HEIGHT)) continue;
          ok = w.canReach(x, g + P.EYE_STAND, z, it.x, it.y, it.z);
        }
      if (!ok) unreachable.push(`${it.room}@${it.x},${it.z}`);
    }
    expect(unreachable).toEqual([]);
  });
});

describe('level data heights', () => {
  it('puts every item spawn, interactable and hiding spot between its room floor and ceiling', () => {
    const bad: string[] = [];
    for (const it of [...level.itemSpawns, ...level.interactables, ...level.hidingSpots]) {
      const r = level.roomById[it.room];
      if (it.y < r.floorY - 0.01 || it.y > r.floorY + r.ceilH) bad.push(`${it.room}@${it.x},${it.z} y=${it.y}`);
    }
    expect(bad).toEqual([]);
  });
});
