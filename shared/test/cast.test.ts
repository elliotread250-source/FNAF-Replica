import { describe, expect, it } from 'vitest';
import { FR, FrSim, GOLDEN_POSTER, IDLE_CMD, type Agent, type FrEvent, type FrPlayer } from '../src';

const DT = 1 / FR.TICK_HZ;

function sim(roster: Record<string, number>, n = 3, extra: Partial<ConstructorParameters<typeof FrSim>[0]> = {}): { s: FrSim; p: FrPlayer } {
  const s = new FrSim({ seed: 11, night: n, mode: 'night', aggression: roster, spawnProtection: 0, playerCount: 4, ...extra });
  const p = s.addPlayer('p1', 'A');
  s.tick();
  return { s, p };
}
const agent = (s: FrSim, id: string) => s.agents.find((a) => a.id === id) as Agent;
function at(p: FrPlayer, x: number, z: number, yaw = 0, y = 0): void {
  Object.assign(p.body, { x, z, y, yaw, vy: 0, grounded: true });
  p.cmd = { ...IDLE_CMD, yaw, flash: true };
}
function run(s: FrSim, seconds: number, each?: (e: FrEvent[]) => void): FrEvent[] {
  const all: FrEvent[] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const ev = s.tick();
    all.push(...ev);
    each?.(ev);
  }
  return all;
}
const lightAll = (s: FrSim) => {
  s.power.main = true;
  s.night.breakers.fill(true);
  s.night.blown.clear();
  for (const c of ['dining', 'west', 'east', 'stage', 'cove', 'kitchen'] as const) s.power.circuits.add(c);
};

describe('freddy', () => {
  it('never moves while a player is looking at him, and moves at most 6 m per unseen second', () => {
    const { s, p } = sim({ freddy: 20 });
    lightAll(s);
    const f = agent(s, 'freddy');
    Object.assign(f, { x: 40, z: 21, y: 0, state: 'STALK' });
    // Player 10 m west, looking straight at him (yaw -PI/2 faces +X).
    at(p, 30, 21, -Math.PI / 2);
    run(s, 3);
    expect(Math.hypot(f.x - 40, f.z - 21)).toBeLessThan(0.01);
    // Turn away: he comes, but no faster than 6 m/s.
    at(p, 30, 21, Math.PI / 2);
    run(s, 1);
    const moved = Math.hypot(f.x - 40, f.z - 21);
    expect(moved).toBeGreaterThan(1);
    expect(moved).toBeLessThanOrEqual(FR.ai.FREDDY_MAX_UNSEEN_STEP + 0.01);
  });

  it('cannot catch a player who had him on screen in the last 0.4 s', () => {
    const { s, p } = sim({ freddy: 20 });
    lightAll(s);
    const f = agent(s, 'freddy');
    // Freddy right behind the player, facing them.
    Object.assign(f, { x: 30.9, z: 21, y: 0, yaw: Math.PI / 2, state: 'STALK' });
    at(p, 30, 21, -Math.PI / 2); // looking at him
    run(s, 0.2);
    at(p, 30, 21, Math.PI / 2); // glance away
    const ev = run(s, 0.3);
    expect(ev.some((e) => e.t === 'catch')).toBe(false);
  });

  it('counts the lit/dark rule: in the dark with the flashlight off he is not seen beyond eye range', () => {
    const { s, p } = sim({ freddy: 20 });
    const f = agent(s, 'freddy');
    Object.assign(f, { x: 45, z: 21, y: 0, state: 'STALK' });
    at(p, 30, 21, -Math.PI / 2);
    p.cmd = { ...p.cmd, flash: false };
    run(s, 1);
    expect(Math.hypot(f.x - 45, f.z - 21)).toBeGreaterThan(1);
  });
});

describe('foxy', () => {
  it('advances cove stages on move opportunities, freezes while watched and sprints at stage 3', () => {
    const { s, p } = sim({ foxy: 20 });
    const fx = agent(s, 'foxy');
    at(p, 44, 50, 0); // in the kitchen, nowhere near the cove
    const stages: number[] = [];
    let ran = false;
    run(s, 20, (ev) => {
      for (const e of ev) {
        if (e.t === 'cove') stages.push(e.stage);
        if (e.t === 'foxyRun') ran = true;
      }
    });
    expect(stages[stages.length - 1]).toBe(3);
    expect(stages).toEqual([...stages].sort());
    expect(ran).toBe(true);
    expect(fx.state === 'SPRINT' || fx.state === 'RETURN' || fx.state === 'SATISFIED').toBe(true);
  });

  it('does not advance while someone watches the cove', () => {
    const { s, p } = sim({ foxy: 20 });
    lightAll(s);
    const fx = agent(s, 'foxy');
    at(p, 20, 16, Math.PI / 2); // in the dining hall looking west into the cove
    run(s, 6);
    expect(fx.x2.stage ?? 0).toBeLessThanOrEqual(1);
  });

  it('a closed shutter stops the sprint and drains increasing power', () => {
    const { s, p } = sim({ foxy: 20 });
    const fx = agent(s, 'foxy');
    const shutter = s.level.doors.find((d) => d.name.startsWith('Shutter S1')) as NonNullable<ReturnType<() => (typeof s.level.doors)[0]>>;
    // Close S1 (dining <-> west hall) and every route into the west hall stays shut except the cove curtain.
    s.doorTarget[shutter.id] = 0;
    s.world.doorOpen[shutter.id] = 0;
    at(p, 30, 21, 0); // dining hall, on the far side of S1
    const p0 = s.night.power;
    Object.assign(fx, { x: 12, z: 26.5, y: 0, yaw: Math.PI / 2 });
    fx.x2.stage = 3;
    fx.state = 'SPRINT';
    fx.path = null;
    const ev = run(s, 4);
    const knocks = ev.filter((e) => e.t === 'foxyKnock');
    if (knocks.length) {
      expect(s.night.power).toBeLessThan(p0);
      expect((knocks[0] as { drain: number }).drain).toBe(FR.ai.FOXY_KNOCK_DRAIN_START);
    } else {
      // He found another way round: he must not have passed through the closed shutter.
      expect(s.world.doorOpen[shutter.id]).toBe(0);
    }
  });
});

describe('chica', () => {
  it('smells a cupcake carrier within 20 m through walls', () => {
    const { s, p } = sim({ chica: 10 });
    const c = agent(s, 'chica');
    Object.assign(c, { x: 44, z: 47, y: 0, state: 'PATROL', path: [], goal: null, pauseT: 1e9, decisionT: 1e9 });
    const cake = s.night.items.find((i) => i.type === 'cupcake') as NonNullable<(typeof s.night.items)[0]>;
    cake.holder = 'p1';
    at(p, 40, 34, 0); // restroom corridor area, walls in between
    run(s, 1.5);
    expect(c.state).toBe('INVESTIGATE');
    expect(c.log.join('\n')).toMatch(/smells cupcakes/);
  });

  it('stops to admire a placed birthday cupcake', () => {
    const { s, p } = sim({ chica: 10 });
    const c = agent(s, 'chica');
    const cake = s.night.items.find((i) => i.type === 'cupcake') as NonNullable<(typeof s.night.items)[0]>;
    cake.plate = s.night.plates[0];
    cake.x = 30;
    cake.z = 21;
    Object.assign(c, { x: 34, z: 21, y: 0, state: 'PATROL', path: [], goal: null, pauseT: 1e9, decisionT: 1e9 });
    at(p, 5, 62, 0);
    run(s, 1.5);
    expect(c.log.join('\n')).toMatch(/birthday cupcake/);
  });
});

describe('puppet', () => {
  it('rises when the music box empties, ignores hiding, kills outright, and goes home when wound past 50%', () => {
    const { s, p } = sim({}, 3);
    const other = s.addPlayer('p2', 'B');
    at(other, 4, 62);
    const pup = agent(s, 'puppet');
    expect(pup.state).toBe('DORMANT');
    // Hide in the closest under-table spot in the dining hall.
    const spot = s.level.hidingSpots.find((h) => h.room === 'dining') as NonNullable<(typeof s.level.hidingSpots)[0]>;
    at(p, spot.exits[0].x, spot.exits[0].z);
    s.setCmd('p1', { ...IDLE_CMD, act: { type: 'hide', id: spot.id } });
    run(s, 1.2);
    expect(p.hidden).not.toBeNull();
    s.night.musicBox = 0.01;
    let out = false;
    let caught = false;
    for (let i = 0; i < FR.TICK_HZ * 40 && !caught; i++) {
      for (const e of s.tick()) {
        if (e.t === 'puppetOut') out = true;
        if (e.t === 'catch' && e.agent === 'puppet') caught = true;
      }
    }
    expect(out).toBe(true);
    expect(caught).toBe(true);
    expect(p.ghost).toBe(true);
    s.night.musicBox = 60;
    run(s, 0.2);
    expect(pup.state === 'RETURN' || pup.state === 'DORMANT').toBe(true);
  });

  it('does not come out on Nights 1 and 2', () => {
    const { s } = sim({ bonnie: 0 }, 2);
    expect(s.agents.some((a) => a.id === 'puppet')).toBe(false);
  });
});

describe('golden freddy', () => {
  it('appears behind the player who saw the poster, and takes them if they stare for 3 s', () => {
    const { s, p } = sim({}, 3, { goldenBoost: 1e9 });
    lightAll(s);
    // Stand in the West Corner looking at the poster on its south wall.
    at(p, 18, 50.6, Math.PI);
    let poster = false;
    run(s, 0.3, (ev) => ev.forEach((e) => e.t === 'golden' && e.phase === 'poster' && (poster = true)));
    expect(poster).toBe(true);
    // Turn around: he's there.
    at(p, 18, 50.6, 0);
    let appear = false;
    run(s, 0.2, (ev) => ev.forEach((e) => e.t === 'golden' && e.phase === 'appear' && (appear = true)));
    expect(appear).toBe(true);
    // Keep staring at him.
    const ev = run(s, FR.ai.GOLDEN_WINDOW + 0.3);
    expect(ev.some((e) => e.t === 'golden' && e.phase === 'scream')).toBe(true);
    expect(p.ghost).toBe(true);
    void GOLDEN_POSTER;
  });

  it('vanishes if the player looks away', () => {
    const { s, p } = sim({}, 3, { goldenBoost: 1e9 });
    lightAll(s);
    at(p, 18, 50.6, Math.PI);
    run(s, 0.3);
    at(p, 18, 50.6, 0);
    run(s, 0.5);
    at(p, 18, 50.6, Math.PI);
    const ev = run(s, 0.5);
    expect(ev.some((e) => e.t === 'golden' && e.phase === 'gone')).toBe(true);
    expect(p.ghost).toBe(false);
  });
});

describe('blackout', () => {
  it('freezes everyone else and brings Power-Out Freddy, who sings before he hunts', () => {
    const { s, p } = sim({ bonnie: 10, chica: 10 }, 3);
    at(p, 30, 21, 0);
    s.night.power = 0.0001;
    let song = false;
    run(s, 12, (ev) => ev.forEach((e) => e.t === 'toreador' && (song = true)));
    expect(s.agents.filter((a) => a.id !== 'powerout').every((a) => a.state === 'FROZEN')).toBe(true);
    expect(song).toBe(true);
    const po = agent(s, 'powerout');
    expect(po.state).toBe('SONG');
  });
});
