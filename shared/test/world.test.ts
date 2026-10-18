import { describe, expect, it } from 'vitest';
import { CollisionWorld, FR, getLevel, newBody, stepBody, type Body, type Input, type Level } from '../src';

const level: Level = getLevel();

function world(openAll = true): CollisionWorld {
  const w = new CollisionWorld(level);
  if (openAll) w.doorOpen.fill(1);
  return w;
}

const idle: Input = { fwd: 0, strafe: 0, yaw: 0, pitch: 0, sprint: false, stance: 0, jump: false };
const DT = 1 / FR.TICK_HZ;

function run(b: Body, w: CollisionWorld, inp: Partial<Input>, seconds: number): void {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) stepBody(b, { ...idle, yaw: b.yaw, stance: b.stance, ...inp }, DT, w);
}

/** yaw so that the body faces a compass direction: N = -Z, E = +X, S = +Z, W = -X. */
const YAW = { N: 0, W: Math.PI / 2, S: Math.PI, E: -Math.PI / 2 };

describe('level', () => {
  it('builds without overlapping rooms or stray openings', () => {
    expect(level.rooms.length).toBeGreaterThan(35);
    expect(level.walls.length).toBeGreaterThan(100);
  });

  it('connects every room to the staff entrance through openings', () => {
    const seen = new Set(['staff']);
    const queue = ['staff'];
    while (queue.length) {
      const r = queue.pop() as string;
      for (const n of level.links[r] ?? []) if (!seen.has(n)) (seen.add(n), queue.push(n));
    }
    const missing = level.rooms.filter((r) => !seen.has(r.id)).map((r) => r.id);
    expect(missing).toEqual([]);
  });

  it('is physically walkable from the spawn to every room (doors open)', () => {
    const w = world();
    const step = 0.5;
    const key = (x: number, z: number, y: number) => `${Math.round(x / step)},${Math.round(z / step)},${Math.round(y * 2)}`;
    const start = level.spawns[0];
    const seen = new Set<string>([key(start.x, start.z, 0)]);
    const queue: [number, number, number][] = [[start.x, start.z, 0]];
    const reached = new Set<string>();
    const roomAt = (x: number, z: number, y: number): string | null => {
      for (const r of level.rooms) {
        if (Math.abs(r.floorY - y) > 0.4 && !(r.id === 'stairTop' || r.id === 'stairBot')) continue;
        for (const [x1, z1, x2, z2] of r.rects) if (x >= x1 && x < x2 && z >= z1 && z < z2 && y >= r.floorY - 0.4 && y <= r.floorY + 0.4) return r.id;
      }
      return null;
    };
    while (queue.length) {
      const [x, z, y] = queue.pop() as [number, number, number];
      const rm = roomAt(x, z, y);
      if (rm) reached.add(rm);
      for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
        const nx = x + dx;
        const nz = z + dz;
        const g = w.groundAt(nx, y, nz, FR.player.RADIUS, FR.player.STEP_HEIGHT);
        if (g === -Infinity) continue;
        // allow stepping down a flight (0.3 per step) too
        if (w.blocked(nx, g, nz, FR.player.RADIUS, FR.player.HEIGHT_STAND, FR.player.STEP_HEIGHT)) continue;
        const k = key(nx, nz, g);
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push([nx, nz, g]);
      }
    }
    // Basement stairs descend in 0.3 steps; the grid walk steps down by at most STEP_HEIGHT too.
    const rooms = level.rooms.map((r) => r.id).filter((id) => !reached.has(id));
    expect(rooms).toEqual([]);
  });
});

describe('controller', () => {
  it('walks at 2.8 m/s and sprints at 5.0 m/s, draining stamina', () => {
    const w = world();
    const b = newBody(24, 20, 0, YAW.E);
    run(b, w, { fwd: 1 }, 1);
    expect(b.x - 24).toBeCloseTo(FR.player.WALK, 0);
    const s = newBody(16, 12, 0, YAW.E);
    run(s, w, { fwd: 1, sprint: true }, 1);
    expect(s.x - 16).toBeCloseTo(FR.player.SPRINT, 0);
    expect(s.stamina).toBeLessThan(90);
    run(s, w, {}, 6);
    expect(s.stamina).toBeGreaterThan(80);
  });

  it('crouches to 1.1 m and crawls to 0.6 m with matching speeds', () => {
    const w = world();
    const b = newBody(24, 20, 0, YAW.E);
    run(b, w, { fwd: 1, stance: 1 }, 1);
    expect(b.height).toBeCloseTo(FR.player.HEIGHT_CROUCH, 1);
    expect(b.x - 24).toBeCloseTo(FR.player.CROUCH, 0);
    run(b, w, { stance: 2 }, 1);
    expect(b.height).toBeCloseTo(FR.player.HEIGHT_CRAWL, 1);
  });

  it('cannot tunnel through a wall at sprint speed', () => {
    const w = world();
    // Lounge: run west into the lounge's west wall at x = 2.
    const b = newBody(8, 55, 0, YAW.W);
    run(b, w, { fwd: 1, sprint: true }, 4);
    expect(b.x).toBeGreaterThan(2.1);
    expect(b.x).toBeLessThan(3.5);
  });

  it('blocks on a closed door and passes an open one', () => {
    const w = world(false);
    const door = level.doors.find((d) => d.name === 'Staff Entrance interior door');
    expect(door).toBeDefined();
    const b = newBody(5.5, 62, 0, YAW.N);
    run(b, w, { fwd: 1 }, 2);
    expect(b.z).toBeGreaterThan(60.2);
    w.doorOpen[door?.id ?? 0] = 1;
    run(b, w, { fwd: 1 }, 2);
    expect(b.z).toBeLessThan(60);
  });

  it('steps up onto the stage deck', () => {
    const w = world();
    const b = newBody(49.5, 13.5, 0, YAW.E);
    run(b, w, { fwd: 1, stance: 0 }, 3.5);
    expect(b.y).toBeCloseTo(1.0, 1);
    expect(b.x).toBeGreaterThan(54);
  });

  it('vaults a 0.8 m table but cannot just walk through it', () => {
    const w = world();
    const t = level.props.find((p) => p.type === 'table' && p.room === 'dining') as { x: number; z: number };
    const b = newBody(t.x, t.z + 2.6, 0, YAW.N);
    run(b, w, { fwd: 1 }, 1.2);
    expect(b.z).toBeGreaterThan(t.z + 0.5);
    run(b, w, { fwd: 1, jump: true }, DT);
    run(b, w, { fwd: 1 }, 1.2);
    expect(b.z).toBeLessThan(t.z - 0.6);
    expect(b.y).toBeCloseTo(0, 1);
  });

  it('cannot stand up under a 1.0 m ceiling', () => {
    const w = new CollisionWorld({
      colliders: [
        { x1: -5, x2: 5, z1: -5, z2: 5, y1: -1, y2: 0, kind: 'floor' },
        { x1: -5, x2: 5, z1: -5, z2: 5, y1: 1.0, y2: 1.4, kind: 'ceiling' },
      ],
      doors: [],
    });
    const b = newBody(0, 0, 0, 0);
    b.stance = 2;
    b.height = FR.player.HEIGHT_CRAWL;
    run(b, w, { stance: 2 }, 1);
    expect(b.stance).toBe(2);
    run(b, w, { stance: 0 }, 1);
    expect(b.stance).toBe(2);
    expect(b.height).toBeLessThanOrEqual(1.0);
  });

  it('walks down the basement stairs to y = -4.5', () => {
    const w = world();
    const b = newBody(36, 57.5, 0, YAW.S);
    run(b, w, { fwd: 1 }, 7);
    expect(b.y).toBeCloseTo(-4.5, 1);
    expect(b.z).toBeGreaterThan(63.5);
  });

  it('keeps a stable position when idle', () => {
    const w = world();
    const b = newBody(24, 20, 0, 0);
    run(b, w, {}, 2);
    expect(b.x).toBeCloseTo(24, 3);
    expect(b.y).toBeCloseTo(0, 3);
  });

  it('is deterministic', () => {
    const play = () => {
      const w = world();
      const b = newBody(24, 20, 0, 0);
      for (let i = 0; i < 300; i++) stepBody(b, { ...idle, fwd: 1, strafe: Math.sin(i / 20), yaw: i / 50, sprint: i % 90 < 40 }, DT, w);
      return [b.x, b.y, b.z, b.stamina];
    };
    expect(play()).toEqual(play());
  });
});
