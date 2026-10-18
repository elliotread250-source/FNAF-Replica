import { describe, expect, it } from 'vitest';
import { BREAKER_GROUPS, FR, FrSim, IDLE_CMD, PLATE_TABLES, type FrPlayer } from '../src';

function night(n = 1, players = 4): { sim: FrSim; p: FrPlayer } {
  const sim = new FrSim({ seed: 5, night: n, mode: 'night', aggression: {}, playerCount: players });
  const p = sim.addPlayer('p1', 'A');
  sim.tick();
  return { sim, p };
}

function at(p: FrPlayer, x: number, z: number, y = 0): void {
  Object.assign(p.body, { x, z, y, vy: 0, grounded: true });
}

function press(sim: FrSim, id: string): void {
  sim.setCmd('p1', { ...IDLE_CMD, act: { type: 'item', id } });
  sim.tick();
}

describe('power', () => {
  it('starts at the night table value and drains faster with more circuits on', () => {
    const { sim } = night(5);
    expect(sim.night.power).toBeCloseTo(FR.power.START[5], 1);
    const off = sim.night.drainPerHour();
    sim.power.main = true;
    sim.night.breakers.fill(true);
    sim.night.blown.clear();
    for (const c of ['dining', 'west', 'east'] as const) sim.power.circuits.add(c);
    expect(sim.night.drainPerHour()).toBeCloseTo(off + FR.power.BASE + 3 * FR.power.PER_CIRCUIT, 5);
  });

  it('blacks out at 0%: main off, circuits dead, shutters open', () => {
    const { sim } = night(1);
    sim.power.main = true;
    sim.night.power = 0.0001;
    const ev = (() => {
      for (let i = 0; i < 5; i++) {
        const e = sim.tick();
        if (e.some((q) => q.t === 'powerOut')) return e;
      }
      return [];
    })();
    expect(ev.some((e) => e.t === 'powerOut')).toBe(true);
    expect(sim.power.main).toBe(false);
    sim.level.doors.forEach((d, i) => d.kind === 'shutter' && expect(sim.doorTarget[i]).toBe(1));
  });
});

describe('breaker puzzle', () => {
  const panel = (p: FrPlayer) => at(p, 23.4, 60, -4.5);
  const setLoad = (sim: FrSim, target: number) => {
    // Switch on breakers greedily until the load reaches the target exactly (loads are 1..4).
    sim.night.breakers.fill(false);
    let sum = 0;
    for (let i = 0; i < sim.night.loads.length && sum < target; i++) {
      if (sum + sim.night.loads[i] <= target) {
        sim.night.breakers[i] = true;
        sum += sim.night.loads[i];
      }
    }
    return sum;
  };

  it('holds the master lever only when the load sits in the green band', () => {
    const { sim, p } = night(1);
    panel(p);
    const lo = sim.night.band[0];
    expect(setLoad(sim, lo)).toBe(lo);
    press(sim, 'main-breaker');
    expect(sim.power.main).toBe(true);
  });

  it('trips with a loud bang and a cooldown when overloaded', () => {
    const { sim, p } = night(1);
    panel(p);
    sim.night.breakers.fill(true);
    expect(sim.night.loadOn()).toBeGreaterThan(sim.night.band[1]);
    sim.setCmd('p1', { ...IDLE_CMD, act: { type: 'item', id: 'main-breaker' } });
    const ev = sim.tick();
    expect(sim.power.main).toBe(false);
    expect(ev.some((e) => e.t === 'master' && e.result === 'trip')).toBe(true);
    expect(ev.some((e) => e.t === 'noise' && e.r === FR.noise.BREAKER_TRIP)).toBe(true);
    expect(sim.night.masterCooldown).toBeGreaterThan(FR.power.BREAKER_COOLDOWN - 1);
  });

  it('drops back when underloaded', () => {
    const { sim, p } = night(1);
    panel(p);
    sim.night.breakers.fill(false);
    press(sim, 'main-breaker');
    expect(sim.power.main).toBe(false);
  });
});

describe('fuses and zone switches', () => {
  it('Night 1 always blows the Dining Hall fuse; a fuse from the closet fixes it', () => {
    const { sim, p } = night(1);
    const dining = BREAKER_GROUPS.findIndex((g) => g.id === 'dining');
    expect(sim.night.blown.has(dining)).toBe(true);
    sim.power.main = true;
    sim.night.breakers.fill(true);
    // The switch refuses while the fuse is blown.
    at(p, 34.5, 11.2);
    press(sim, 'switch:dining');
    expect(sim.circuitOn('dining')).toBe(false);
    // Take a fuse from the supply closet, then hold E at fuse box 1.
    const fuse = sim.night.items.find((i) => i.type === 'fuse' && i.x < 30) as NonNullable<(typeof sim.night.items)[0]>;
    at(p, fuse.x + 0.6, fuse.z);
    sim.setCmd('p1', { ...IDLE_CMD, act: { type: 'pickup', id: fuse.id } });
    sim.tick();
    expect(fuse.holder).toBe('p1');
    at(p, 23, 57);
    for (let i = 0; i < FR.TICK_HZ * (FR.objectives.FUSE_INSERT + 0.2); i++) {
      sim.setCmd('p1', { ...IDLE_CMD, use: 'fusebox:0' });
      sim.tick();
    }
    expect(sim.night.blown.has(dining)).toBe(false);
    at(p, 34.5, 11.2);
    press(sim, 'switch:dining');
    expect(sim.circuitOn('dining')).toBe(true);
  });
});

describe('music box', () => {
  it('unwinds at the night rate and winds at 10% per second', () => {
    const { sim, p } = night(3);
    const start = sim.night.musicBox;
    for (let i = 0; i < FR.TICK_HZ * 10; i++) sim.tick();
    expect(start - sim.night.musicBox).toBeCloseTo(FR.musicBox.UNWIND[3] * 10, 0);
    at(p, 25, 6.3);
    sim.night.musicBox = 50;
    const before = sim.night.musicBox;
    for (let i = 0; i < FR.TICK_HZ * 2; i++) {
      sim.setCmd('p1', { ...IDLE_CMD, use: 'musicbox' });
      sim.tick();
    }
    expect(sim.night.musicBox - before).toBeGreaterThan(FR.musicBox.WIND * 2 - 2);
  });

  it('warns at 30/15/5 and fails at 0', () => {
    const { sim } = night(6);
    sim.night.musicBox = 31;
    const seen: number[] = [];
    let empty = false;
    for (let i = 0; i < FR.TICK_HZ * 60 && !empty; i++) {
      for (const e of sim.tick()) {
        if (e.t === 'musicbox') seen.push(e.level);
        if (e.t === 'musicEmpty') empty = true;
      }
    }
    expect(seen).toEqual([30, 15, 5]);
    expect(empty).toBe(true);
    expect(sim.night.objectives().find((o) => o.id === 'musicbox')?.failed).toBe(true);
  });
});

describe('cupcakes', () => {
  it('places cupcakes on birthday tables only, four slots per player, and finishes at five', () => {
    const { sim, p } = night(1);
    const cakes = sim.night.items.filter((i) => i.type === 'cupcake');
    expect(cakes.length).toBe(5);
    at(p, 49.8, 49);
    for (const c of cakes) {
      sim.setCmd('p1', { ...IDLE_CMD, act: { type: 'pickup', id: c.id } });
      sim.tick();
    }
    expect(sim.night.carried(p).length).toBe(4);
    let done = false;
    for (const plate of sim.night.plates) {
      const t = PLATE_TABLES[plate];
      at(p, t.x, t.z + 1.0);
      sim.setCmd('p1', { ...IDLE_CMD, act: { type: 'item', id: `plate:${plate}` } });
      for (const e of sim.tick()) if (e.t === 'cupcakesDone') done = true;
      if (!sim.night.carried(p).some((i) => i.type === 'cupcake')) {
        at(p, 49.8, 49);
        const left = cakes.find((c) => !c.holder && c.plate < 0);
        if (left) {
          sim.setCmd('p1', { ...IDLE_CMD, act: { type: 'pickup', id: left.id } });
          sim.tick();
        }
      }
    }
    expect(sim.night.placed()).toBe(5);
    expect(done).toBe(true);
  });
});

describe('early exit and 6 AM', () => {
  it('unlocks the front doors at 5 AM only when every required job is done', () => {
    const { sim } = night(1);
    sim.time = sim.hourSeconds * 5 - 0.01;
    for (let i = 0; i < 3; i++) sim.tick();
    expect(sim.night.frontUnlocked).toBe(false);
    // Cheat everything done.
    sim.power.main = true;
    sim.night.breakers.fill(true);
    sim.night.blown.clear();
    for (const z of sim.night.requiredZones) sim.power.circuits.add(z);
    sim.night.items.filter((i) => i.type === 'cupcake').forEach((c, k) => (c.plate = sim.night.plates[k]));
    sim.tick();
    expect(sim.night.frontUnlocked).toBe(true);
  });

  it('wins at 6 AM when anyone is still in the night', () => {
    const sim = new FrSim({ seed: 2, night: 1, mode: 'night', aggression: {}, playerCount: 2, fast: true });
    sim.addPlayer('a', 'A');
    const b = sim.addPlayer('b', 'B');
    b.ghost = true;
    let end: boolean | null = null;
    for (let i = 0; i < FR.TICK_HZ * sim.hourSeconds * 6 + 5 && end === null; i++) for (const e of sim.tick()) if (e.t === 'end') end = e.won;
    expect(end).toBe(true);
  });
});
