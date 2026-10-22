import { describe, expect, it } from 'vitest';
import { CollisionWorld, DESK_TOP, FR, OFFICE_KIT, OFFICE_RECT, doorLeaves, getLevel, newBody, stepBody, type Body, type Collider, type FrInput } from '../src';

// Phasing and door-shape invariants for the map rebuild (docs/MAP_REBUILD_PROGRESS.md, spec sections 4, 6 and 8).

const level = getLevel();
const DT = 1 / FR.TICK_HZ;
const idle: FrInput = { fwd: 0, strafe: 0, yaw: 0, pitch: 0, sprint: false, stance: 0, jump: false };
const YAW = { N: 0, W: Math.PI / 2, S: Math.PI, E: -Math.PI / 2 };
const P = FR.player;

function run(b: Body, w: CollisionWorld, inp: Partial<FrInput>, seconds: number): void {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) stepBody(b, { ...idle, yaw: b.yaw, stance: b.stance, ...inp }, DT, w);
}

const door = (name: string) => {
  const d = level.doors.find((x) => x.name === name);
  if (!d) throw new Error(`no door ${name}`);
  return d;
};

const overlaps = (a: Collider, b: Collider, pad = 0) => a.x1 < b.x2 - pad && a.x2 > b.x1 + pad && a.z1 < b.z2 - pad && a.z2 > b.z1 + pad && a.y1 < b.y2 && a.y2 > b.y1;

describe('doors block by their animated shape', () => {
  it('a security shutter blocks from both sides while closed', () => {
    const d = door('Security Door West');
    for (const [x, yaw, past] of [[24, YAW.W, (bx: number) => bx < 22], [19, YAW.E, (bx: number) => bx > 22]] as const) {
      const w = new CollisionWorld(level);
      w.doorOpen[d.id] = 0;
      const b = newBody(x, 51, 0, yaw);
      run(b, w, { fwd: 1, sprint: true }, 3);
      expect(past(b.x)).toBe(false);
    }
  });

  it('a half-raised shutter stops a standing guard but not a crawling one', () => {
    const d = door('Security Door West');
    const w = new CollisionWorld(level);
    w.doorOpen[d.id] = 0.5; // underside at ~1.1 m: above a crawl, below a standing head
    const stand = newBody(24, 51, 0, YAW.W);
    run(stand, w, { fwd: 1 }, 3);
    expect(stand.x).toBeGreaterThan(22);
    const crawl = newBody(24, 51, 0, YAW.W);
    crawl.stance = 2;
    crawl.height = P.HEIGHT_CRAWL;
    run(crawl, w, { fwd: 1, stance: 2 }, 6);
    expect(crawl.x).toBeLessThan(21.5);
  });

  it('a shutter at 75% still stops a standing guard (the old on/off switch at 0.7 let you through)', () => {
    const d = door('Security Door East');
    const w = new CollisionWorld(level);
    w.doorOpen[d.id] = 0.75; // underside at ~1.69 m, under a standing guard's 1.75 m
    const b = newBody(26, 51, 0, YAW.E);
    run(b, w, { fwd: 1 }, 3);
    expect(b.x).toBeLessThan(28);
  });

  it('an open swing door is a solid blade you walk around, not through', () => {
    const d = door('Supply Closet door'); // z = 52, x 33..34, opens into the closet
    const w = new CollisionWorld(level);
    w.doorOpen[d.id] = 1;
    const [leaf] = doorLeaves(d, 1);
    const tipX = leaf.hx + leaf.vx;
    const tipZ = leaf.hz + leaf.vz;
    // The blade is in the hash and blocks a circle centred on its midpoint.
    const mx = leaf.hx + leaf.vx / 2;
    const mz = leaf.hz + leaf.vz / 2;
    expect(w.blocked(mx, 0, mz, P.RADIUS, P.HEIGHT_STAND, P.STEP_HEIGHT)).toBe(true);
    expect(Math.hypot(tipX - leaf.hx, tipZ - leaf.hz)).toBeCloseTo(1, 3);
    // But the doorway itself is clear.
    expect(w.blocked(33.6, 0, 52, P.RADIUS, P.HEIGHT_STAND, P.STEP_HEIGHT)).toBe(false);
  });

  it('a door at 40% open still blocks the passage', () => {
    const d = door('Staff Entrance interior door'); // z = 60, x 4..6
    const w = new CollisionWorld(level);
    w.doorOpen[d.id] = 0.4;
    const b = newBody(5.6, 62.5, 0, YAW.N);
    run(b, w, { fwd: 1 }, 3);
    expect(b.z).toBeGreaterThan(60);
  });

  it('open leaves never swing into furniture, interactables or another door', () => {
    const w = new CollisionWorld(level);
    w.doorOpen.fill(1);
    const solids = level.colliders.filter((c) => c.kind === 'prop' || c.kind === 'step');
    const bad: string[] = [];
    for (const d of level.doors) {
      const boxes = w.doorShape(d.id);
      for (const b of boxes) {
        for (const s of solids) if (overlaps(b, s)) bad.push(`${d.name} hits a prop at ${s.x1.toFixed(1)},${s.z1.toFixed(1)}`);
        for (const it of level.interactables) {
          if (Math.abs(it.y - d.floorY) > 2.5) continue;
          if (it.x > b.x1 - 0.1 && it.x < b.x2 + 0.1 && it.z > b.z1 - 0.1 && it.z < b.z2 + 0.1) bad.push(`${d.name} covers ${it.id}`);
        }
        for (const o of level.doors) {
          if (o.id === d.id) continue;
          for (const ob of w.doorShape(o.id)) if (overlaps(b, ob)) bad.push(`${d.name} hits ${o.name}`);
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('door collision follows doorOpen writes made directly to the array', () => {
    const d = door('Staff Entrance interior door');
    const w = new CollisionWorld(level);
    w.doorOpen[d.id] = 0;
    expect(w.blocked(5, 0, 60, P.RADIUS, P.HEIGHT_STAND, P.STEP_HEIGHT)).toBe(true);
    w.doorOpen.fill(1);
    expect(w.blocked(5, 0, 60, P.RADIUS, P.HEIGHT_STAND, P.STEP_HEIGHT)).toBe(false);
    w.doorOpen.set(new Float32Array(level.doors.length));
    expect(w.blocked(5, 0, 60, P.RADIUS, P.HEIGHT_STAND, P.STEP_HEIGHT)).toBe(true);
  });
});

describe('vaulting', () => {
  it('cannot vault a low table through the wall behind it', () => {
    // Floor on both sides, a 0.8 m table hard against a 0.2 m wall at z = -1.
    const w = new CollisionWorld({
      colliders: [
        { x1: -5, x2: 5, z1: -6, z2: 6, y1: -1, y2: 0, kind: 'floor' },
        { x1: -2, x2: 2, z1: -0.9, z2: -0.1, y1: 0, y2: 0.8, kind: 'prop', low: true },
        { x1: -5, x2: 5, z1: -1.1, z2: -0.9, y1: 0, y2: 3, kind: 'wall' },
      ],
      doors: [],
    });
    const b = newBody(0, 0.6, 0, YAW.N);
    run(b, w, { fwd: 1, jump: true }, 2);
    expect(b.z).toBeGreaterThan(-0.9);
  });
});

describe('props', () => {
  it('only uses quarter-turn rotations (colliders snap to 90 degrees)', () => {
    const off = level.props.filter((p) => ((((p.ry ?? 0) % 90) + 90) % 90) !== 0).map((p) => `${p.type}@${p.x},${p.z}`);
    expect(off).toEqual([]);
  });

  it('spawns never start inside anything', () => {
    const w = new CollisionWorld(level);
    for (const s of level.spawns) expect(w.blocked(s.x, s.y, s.z, P.RADIUS, P.HEIGHT_STAND, P.STEP_HEIGHT)).toBe(false);
  });
});

describe('security office kit', () => {
  const w = new CollisionWorld(level);
  w.doorOpen.fill(1);

  it('has unique ids and keeps every part inside the office', () => {
    const ids = OFFICE_KIT.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of OFFICE_KIT) {
      expect(p.x - p.w / 2).toBeGreaterThanOrEqual(OFFICE_RECT.x1 - 0.2);
      expect(p.x + p.w / 2).toBeLessThanOrEqual(OFFICE_RECT.x2 + 0.2);
      expect(p.z - p.d / 2).toBeGreaterThanOrEqual(OFFICE_RECT.z1 - 0.2);
      expect(p.z + p.d / 2).toBeLessThanOrEqual(OFFICE_RECT.z2 + 0.2);
      if (p.policy === 'solid') expect(p.boxes?.length).toBeGreaterThan(0);
      else expect(p.boxes).toBeUndefined();
    }
  });

  it('rests desk clutter on the desk top, not floating or sunk', () => {
    const desk = OFFICE_KIT.find((p) => p.id === 'office.desk')!;
    for (const p of OFFICE_KIT.filter((q) => q.kind === 'cup' || q.kind === 'papers' || q.kind === 'fan' || q.id === 'office.crt.1' || q.id === 'office.crt.2')) {
      expect(p.y).toBeCloseTo(DESK_TOP, 5);
      expect(Math.abs(p.x - desk.x)).toBeLessThan(desk.w / 2 - p.w / 4);
      expect(Math.abs(p.z - desk.z)).toBeLessThan(desk.d / 2);
    }
  });

  it('keeps the honk hotspot on the poster', () => {
    const poster = OFFICE_KIT.find((p) => p.id === 'office.poster.celebrate')!;
    const honk = level.interactables.find((i) => i.id === 'honk')!;
    expect(Math.abs(honk.x - poster.x)).toBeLessThan(poster.w / 2);
    expect(Math.abs(honk.y - poster.y)).toBeLessThan(poster.h / 2);
    expect(Math.abs(honk.z - poster.z)).toBeLessThan(0.1);
  });

  it('the desk is solid to walk into but the footwell takes a crawling guard', () => {
    const b = newBody(25, 51.6, 0, YAW.N);
    b.x = 25.6; // beside the chair
    run(b, w, { fwd: 1 }, 3);
    expect(b.z).toBeGreaterThan(49.75 + P.RADIUS - 0.02);
    const c = newBody(25.6, 50.4, 0, YAW.N);
    c.stance = 2;
    c.height = P.HEIGHT_CRAWL;
    run(c, w, { fwd: 1, stance: 2 }, 3);
    expect(c.z).toBeLessThan(49.6);
    // ... and cannot stand up under the desk.
    run(c, w, { stance: 0 }, 1);
    expect(c.stance).toBe(2);
  });

  it('the chair blocks, and standing up from it puts you clear of the furniture', () => {
    expect(w.blocked(25, 0, 50.8, P.RADIUS, P.HEIGHT_STAND, P.STEP_HEIGHT)).toBe(true);
    const b = newBody(25, 50.8, 0, YAW.N);
    run(b, w, {}, 0.5);
    expect(w.blocked(b.x, b.y, b.z, P.RADIUS * 0.98, P.HEIGHT_STAND, P.STEP_HEIGHT)).toBe(false);
    expect(b.x).toBeGreaterThan(22.3);
    expect(b.x).toBeLessThan(27.7);
    expect(b.z).toBeGreaterThan(49.75);
  });

  it('leaves a walkable route from each shutter to the chair and the rear door', () => {
    for (const [sx, yaw] of [[21, YAW.E], [29, YAW.W]] as const) {
      const b = newBody(sx, 51, 0, yaw);
      run(b, w, { fwd: 1 }, 1.4);
      expect(Math.abs(b.x - 25)).toBeLessThan(1.6);
      expect(Math.abs(b.z - 51)).toBeLessThan(0.3);
    }
    const r = newBody(24.5, 51.6, 0, YAW.S);
    run(r, w, { fwd: 1 }, 2.5);
    expect(r.z).toBeGreaterThan(55.6);
  });

  it('every solid part has a collider no bigger than its drawn bounds', () => {
    for (const p of OFFICE_KIT.filter((q) => q.policy === 'solid')) {
      for (const b of p.boxes ?? []) {
        expect(b.x1).toBeGreaterThanOrEqual(p.x - p.w / 2 - 1e-6);
        expect(b.x2).toBeLessThanOrEqual(p.x + p.w / 2 + 1e-6);
        expect(b.z1).toBeGreaterThanOrEqual(p.z - p.d / 2 - 1e-6);
        expect(b.z2).toBeLessThanOrEqual(p.z + p.d / 2 + 1e-6);
        expect(b.y2).toBeLessThanOrEqual(p.y + p.h + 1e-6);
      }
    }
  });
});

describe('walls hold everywhere', () => {
  const roomAt = (x: number, z: number, y: number): string | null => {
    for (const r of level.rooms) {
      if (Math.abs(r.floorY - y) > 0.4) continue;
      for (const [x1, z1, x2, z2] of r.rects) if (x >= x1 && x < x2 && z >= z1 && z < z2) return r.id;
    }
    return null;
  };

  it('sprinting square into every wall span, from both sides, never crosses it', () => {
    const w = new CollisionWorld(level);
    w.doorOpen.fill(0);
    const crossed: string[] = [];
    let tried = 0;
    for (const wr of level.walls) {
      if (!wr.lo || !wr.hi) continue;
      const len = wr.b - wr.a;
      if (len < 1.2) continue;
      for (const side of [-1, 1] as const) {
        for (const f of [0.25, 0.5, 0.75]) {
          const along = wr.a + len * f;
          const off = side * 0.9;
          const x = wr.axis === 'x' ? wr.line + off : along;
          const z = wr.axis === 'x' ? along : wr.line + off;
          const y = wr.y1;
          const g = w.groundAt(x, y, z, P.RADIUS, P.STEP_HEIGHT);
          if (g === -Infinity || Math.abs(g - y) > 0.01 || w.blocked(x, y, z, P.RADIUS, P.HEIGHT_STAND, P.STEP_HEIGHT)) continue;
          const yaw = wr.axis === 'x' ? (side < 0 ? YAW.E : YAW.W) : side < 0 ? YAW.S : YAW.N;
          const b = newBody(x, z, y, yaw);
          run(b, w, { fwd: 1, sprint: true }, 1.2);
          tried++;
          const after = wr.axis === 'x' ? b.x - wr.line : b.z - wr.line;
          if (Math.sign(after) !== side) crossed.push(`${wr.lo}|${wr.hi} ${wr.axis}=${wr.line} at ${along.toFixed(1)}`);
        }
      }
    }
    expect(tried).toBeGreaterThan(300);
    expect(crossed).toEqual([]);
  });

  it('a 45 degree approach slides along the wall instead of sticking or passing', () => {
    const w = new CollisionWorld(level);
    // Lounge west wall (x = 2): run north-west into it.
    const b = newBody(4, 56, 0, Math.PI / 4);
    run(b, w, { fwd: 1 }, 2);
    expect(b.x).toBeGreaterThan(2.1);
    expect(b.z).toBeLessThan(54.5); // kept moving north along the wall
  });

  it('glancing a convex corner neither snags nor clips through', () => {
    const w = new CollisionWorld(level);
    w.doorOpen.fill(1);
    // West Hall meets West Corner at the arch x = 14, z 48..50: skim past the wall end at (14, 48) heading south.
    const b = newBody(13.75, 46.5, 0, YAW.S);
    run(b, w, { fwd: 1 }, 0.7);
    expect(b.z).toBeGreaterThan(48.3);
    expect(b.speed).toBeGreaterThan(1);
  });

  it('a huge frame (half a second after a tab switch) still cannot tunnel', () => {
    const w = new CollisionWorld(level);
    const b = newBody(8, 55, 0, YAW.W);
    for (let i = 0; i < 6; i++) stepBody(b, { ...idle, yaw: YAW.W, fwd: 1, sprint: true }, 0.5, w);
    expect(b.x).toBeGreaterThan(2.1);
  });

  it('never moves from one room into a room it is not linked to (no gaps at wall junctions)', () => {
    const w = new CollisionWorld(level);
    w.doorOpen.fill(1);
    const step = 0.25;
    const start = level.spawns[0];
    const k = (x: number, z: number, y: number) => `${Math.round(x / step)},${Math.round(z / step)},${Math.round(y * 2)}`;
    const seen = new Set([k(start.x, start.z, 0)]);
    const queue: [number, number, number][] = [[start.x, start.z, 0]];
    const bad = new Set<string>();
    while (queue.length) {
      const [x, z, y] = queue.pop() as [number, number, number];
      const ra = roomAt(x, z, y);
      for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
        const nx = x + dx;
        const nz = z + dz;
        const g = w.groundAt(nx, y, nz, P.RADIUS, P.STEP_HEIGHT);
        if (g === -Infinity || w.blocked(nx, g, nz, P.RADIUS, P.HEIGHT_STAND, P.STEP_HEIGHT)) continue;
        const rb = roomAt(nx, nz, g);
        if (ra && rb && ra !== rb && !(level.links[ra] ?? []).includes(rb)) bad.add(`${ra}->${rb} near ${nx.toFixed(2)},${nz.toFixed(2)}`);
        const key = k(nx, nz, g);
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push([nx, nz, g]);
      }
    }
    expect([...bad]).toEqual([]);
  });
});

describe('recovery and door courtesy', () => {
  it('a body left inside a wall goes back to where it last stood', () => {
    const w = new CollisionWorld(level);
    const b = newBody(8, 55, 0, 0);
    run(b, w, {}, 0.2);
    // Teleport into the middle of the thick west exterior wall of the lounge (x = 2) and well below the floor.
    Object.assign(b, { x: 2, z: 55 });
    b.y = -40;
    run(b, w, {}, DT);
    expect(b.x).toBeCloseTo(8, 3);
    expect(b.y).toBeCloseTo(0, 3);
  });

  it('a swinging door stops against a guard in its path instead of shoving them', async () => {
    const { FrSim } = await import('../src');
    const sim = new FrSim({ seed: 3, night: 1, mode: 'day', playerCount: 1 });
    const p = sim.addPlayer('a', 'A');
    const d = door('Supply Closet door');
    sim.world.doorOpen[d.id] = 0;
    sim.doorTarget[d.id] = 0;
    const [leaf] = doorLeaves(d, 1);
    // Stand where the leaf ends up when fully open.
    Object.assign(p.body, { x: leaf.hx + leaf.vx * 0.6, z: leaf.hz + leaf.vz * 0.6, y: 0 });
    const before = { x: p.body.x, z: p.body.z };
    sim.setDoor(d.id, true, 'a');
    for (let i = 0; i < 60; i++) sim.tick();
    expect(sim.world.doorOpen[d.id]).toBeLessThan(0.95);
    expect(Math.hypot(p.body.x - before.x, p.body.z - before.z)).toBeLessThan(0.05);
  });
});

describe('four guards at once', () => {
  it('four simulated players weaving through the staff area stay out of walls and replay identically', async () => {
    const { FrSim } = await import('../src');
    const play = () => {
      const sim = new FrSim({ seed: 9, night: 1, mode: 'day', playerCount: 4 });
      const ids = ['a', 'b', 'c', 'd'];
      for (const id of ids) sim.addPlayer(id, id);
      sim.world.doorOpen.fill(1);
      sim.doorTarget.fill(1);
      const out: number[] = [];
      for (let t = 0; t < 30 * 8; t++) {
        ids.forEach((id, i) => {
          const yaw = Math.PI + Math.sin(t / 25 + i) * 0.9 + (t > 120 ? Math.PI : 0);
          sim.setCmd(id, { fwd: 1, strafe: Math.sin(t / 9 + i) * 0.5, yaw, pitch: 0, sprint: (t + i * 7) % 60 < 25, stance: 0, jump: t % 47 === i, flash: false, breath: false });
        });
        sim.tick();
        for (const id of ids) {
          const b = (sim.players.get(id) as { body: Body }).body;
          if (b.vault > 0) continue;
          expect(sim.world.blocked(b.x, b.y, b.z, P.RADIUS * 0.9, b.height, P.STEP_HEIGHT)).toBe(false);
        }
      }
      for (const id of ids) {
        const b = (sim.players.get(id) as { body: Body }).body;
        out.push(b.x, b.y, b.z);
      }
      return out;
    };
    expect(play()).toEqual(play());
  });
});
