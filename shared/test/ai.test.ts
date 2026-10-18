import { describe, expect, it } from 'vitest';
import { FR, FrSim, IDLE_CMD, type Agent, type FrEvent, type FrPlayer } from '../src';

const DT = 1 / FR.TICK_HZ;

function setup(aggression = 10, opts: { lit?: string[] } = {}): { sim: FrSim; p: FrPlayer; a: Agent } {
  const sim = new FrSim({ seed: 42, night: 3, mode: 'night', aggression: { bonnie: aggression }, spawnProtection: 0, playerCount: 4 });
  const p = sim.addPlayer('p1', 'Tester');
  sim.tick();
  const a = sim.agents[0];
  if (opts.lit) {
    sim.power.main = true;
    sim.night.breakers.fill(true);
    sim.night.blown.clear();
    for (const c of opts.lit) sim.power.circuits.add(c as never);
  }
  return { sim, p, a };
}

/** Pin the agent in place, looking along yaw, doing nothing until perception kicks in. */
function hold(a: Agent, x: number, y: number, z: number, yaw: number): void {
  Object.assign(a, { x, y, z, yaw, state: 'PATROL', path: [], goal: null, pauseT: 1e9, decisionT: 1e9 });
}

function place(p: FrPlayer, x: number, z: number, yaw = 0, y = 0): void {
  Object.assign(p.body, { x, z, y, yaw, vy: 0, grounded: true });
}

function run(sim: FrSim, seconds: number, each?: (e: FrEvent[]) => void): FrEvent[] {
  const all: FrEvent[] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const ev = sim.tick();
    all.push(...ev);
    each?.(ev);
  }
  return all;
}

// Dining hall: a long open floor. Agent at x=40 looking west (-X); player 10 m away at x=30.
const ROW_Z = 21;

describe('perception', () => {
  it('does not spot a crouched, still player 10 m away in the dark with the flashlight off within 5 s', () => {
    const { sim, p, a } = setup(10);
    hold(a, 40, 0, ROW_Z, Math.PI / 2);
    place(p, 30, ROW_Z, -Math.PI / 2);
    p.body.stance = 1;
    p.body.height = FR.player.HEIGHT_CROUCH;
    sim.setCmd('p1', { ...IDLE_CMD, yaw: -Math.PI / 2, stance: 1, flash: false });
    run(sim, 5);
    expect(a.state).not.toBe('CHASE');
  });

  it('spots the same player within 2 s when their flashlight points at the agent', () => {
    const { sim, p, a } = setup(10);
    hold(a, 40, 0, ROW_Z, Math.PI / 2);
    place(p, 30, ROW_Z, -Math.PI / 2);
    sim.setCmd('p1', { ...IDLE_CMD, yaw: -Math.PI / 2, stance: 1, flash: true });
    let at = -1;
    run(sim, 2.2, (ev) => {
      if (at < 0 && ev.some((e) => e.t === 'chase')) at = sim.time;
    });
    expect(at).toBeGreaterThan(0);
  });

  it('spots a player 1 m in front instantly', () => {
    const { sim, p, a } = setup(10);
    hold(a, 40, 0, ROW_Z, Math.PI / 2);
    place(p, 39, ROW_Z, -Math.PI / 2);
    sim.setCmd('p1', { ...IDLE_CMD, yaw: -Math.PI / 2, flash: false });
    const ev = run(sim, 0.2);
    expect(ev.some((e) => e.t === 'chase' || e.t === 'catch')).toBe(true);
  });

  it('cannot see through a wall', () => {
    const { sim, p, a } = setup(20, { lit: ['dining', 'west'] });
    // Agent in the dining hall, player in the west hall behind the dining hall's west wall (x = 14).
    hold(a, 16, 0, 23, Math.PI / 2);
    place(p, 12, 23, -Math.PI / 2);
    sim.setCmd('p1', { ...IDLE_CMD, yaw: -Math.PI / 2, flash: true });
    run(sim, 4);
    expect(a.state).not.toBe('CHASE');
  });

  it('fills detection faster in a lit zone than in the dark', () => {
    const dark = setup(10);
    hold(dark.a, 40, 0, ROW_Z, Math.PI / 2);
    place(dark.p, 32, ROW_Z);
    dark.sim.setCmd('p1', { ...IDLE_CMD, flash: false });
    run(dark.sim, 0.5);
    const lit = setup(10, { lit: ['dining'] });
    hold(lit.a, 40, 0, ROW_Z, Math.PI / 2);
    place(lit.p, 32, ROW_Z);
    lit.sim.setCmd('p1', { ...IDLE_CMD, flash: false });
    run(lit.sim, 0.5);
    expect(lit.a.detect.p1).toBeGreaterThan(dark.a.detect.p1);
  });
});

describe('hiding', () => {
  const lockerSpot = (sim: FrSim) => sim.level.hidingSpots.find((s) => s.type === 'locker') as NonNullable<ReturnType<FrSim['spot']>>;

  it('hiding unseen means the agent does not go straight to the spot', () => {
    const { sim, p, a } = setup(12);
    const s = lockerSpot(sim);
    place(p, s.exits[0].x, s.exits[0].z, 0);
    hold(a, 30, 0, 20, 0); // far away in the dining hall
    sim.setCmd('p1', { ...IDLE_CMD, act: { type: 'hide', id: s.id } });
    run(sim, 1.5);
    expect(p.hidden?.phase).toBe('in');
    expect(a.sawHide.p1).toBeUndefined();
  });

  it('an agent that saw you go in checks that spot, warns 0.8 s before, and catches you', () => {
    const { sim, p, a } = setup(15, { lit: ['staff'] });
    const s = lockerSpot(sim);
    place(p, s.exits[0].x, s.exits[0].z, 0);
    // Agent 4 m east of the locker, facing it.
    hold(a, s.exits[0].x + 4, 0, s.z, Math.PI / 2);
    sim.setCmd('p1', { ...IDLE_CMD, flash: true, yaw: -Math.PI / 2 });
    run(sim, 0.6);
    sim.setCmd('p1', { ...IDLE_CMD, flash: true, act: { type: 'hide', id: s.id } });
    let warnAt = -1;
    let catchAt = -1;
    run(sim, 12, (ev) => {
      for (const e of ev) {
        if (e.t === 'checkWarn' && warnAt < 0) warnAt = sim.time;
        if (e.t === 'catch' && catchAt < 0) catchAt = sim.time;
      }
    });
    expect(warnAt).toBeGreaterThan(0);
    expect(catchAt).toBeGreaterThan(0);
    expect(catchAt - warnAt).toBeGreaterThanOrEqual(FR.ai.CHECK_WARNING - 1e-6);
  });

  it('bursting out during the warning gives a head start instead of a catch at the spot', () => {
    const { sim, p, a } = setup(15, { lit: ['staff'] });
    const s = lockerSpot(sim);
    place(p, s.exits[0].x, s.exits[0].z, 0);
    hold(a, s.exits[0].x + 4, 0, s.z, Math.PI / 2);
    sim.setCmd('p1', { ...IDLE_CMD, flash: true, yaw: -Math.PI / 2 });
    run(sim, 0.6);
    sim.setCmd('p1', { ...IDLE_CMD, flash: true, act: { type: 'hide', id: s.id } });
    let hidingCatch = false;
    let warned = false;
    run(sim, 12, (ev) => {
      for (const e of ev) {
        if (e.t === 'checkWarn' && !warned) {
          warned = true;
          sim.setCmd('p1', { ...IDLE_CMD, act: { type: 'unhide', exit: 0 } });
        }
        if (e.t === 'catch' && e.kind === 'hiding') hidingCatch = true;
      }
    });
    expect(warned).toBe(true);
    expect(hidingCatch).toBe(false);
  });

  it('holding breath keeps you silent; running out makes you gasp', () => {
    const { sim, p } = setup(0);
    const s = lockerSpot(sim);
    place(p, s.exits[0].x, s.exits[0].z, 0);
    sim.setCmd('p1', { ...IDLE_CMD, act: { type: 'hide', id: s.id } });
    run(sim, 1.2);
    sim.setCmd('p1', { ...IDLE_CMD, breath: true });
    const ev = run(sim, FR.player.BREATH_HOLD - 0.5);
    expect(ev.some((e) => e.t === 'noise' || e.t === 'gasp')).toBe(false);
    const ev2 = run(sim, 1.0);
    expect(ev2.some((e) => e.t === 'gasp')).toBe(true);
    expect(ev2.some((e) => e.t === 'noise' && e.r === FR.noise.GASP)).toBe(true);
  });
});

describe('search, catch and revive', () => {
  it('searches the hiding spots closest to the last known position first', () => {
    const { sim, a } = setup(12);
    a.lastKnown = { x: 5, y: 0, z: 54, t: 0 };
    Object.assign(a, { x: 8, z: 54, y: 0, state: 'CHASE' });
    // Force the transition through the public path: lose the target.
    a.target = null;
    run(sim, DT);
    expect(a.state === 'SEARCH' || a.state === 'CHECK').toBe(true);
    const first = sim.spot(a.state === 'CHECK' ? a.checkSpot : a.searchSpots[0]);
    expect(Math.hypot(first.x - 5, first.z - 54)).toBeLessThan(6);
  });

  it('only catches from the front', () => {
    const { sim, p, a } = setup(10);
    hold(a, 40, 0, ROW_Z, Math.PI / 2); // facing west
    place(p, 40.9, ROW_Z); // just behind, to the east
    sim.setCmd('p1', { ...IDLE_CMD, flash: false });
    a.state = 'INVESTIGATE';
    a.goal = { x: 40, y: 0, z: ROW_Z };
    a.pauseT = 1e9;
    run(sim, 0.1);
    expect(p.downed).toBe(false);
  });

  it('revives a downed player after a 4 s hold, and a third catch goes straight to ghost', () => {
    const sim = new FrSim({ seed: 1, night: 1, mode: 'night', aggression: {}, playerCount: 2 });
    const p = sim.addPlayer('p1', 'A');
    const q = sim.addPlayer('p2', 'B');
    place(p, 30, 20);
    place(q, 31, 20);
    sim.tick();
    sim.catchPlayer(p, 'bonnie', 'standard');
    expect(p.downed).toBe(true);
    sim.setCmd('p2', { ...IDLE_CMD, hold: true });
    run(sim, FR.player.REVIVE_TIME - 0.3);
    expect(p.downed).toBe(true);
    run(sim, 0.5);
    expect(p.downed).toBe(false);
    sim.catchPlayer(p, 'bonnie', 'standard');
    run(sim, FR.player.REVIVE_TIME + 0.2);
    expect(p.revives).toBe(2);
    sim.catchPlayer(p, 'bonnie', 'standard');
    expect(p.ghost).toBe(true);
  });

  it('never re-catches the same victim straight after a catch', () => {
    const { sim, p, a } = setup(20, { lit: ['dining'] });
    hold(a, 40, 0, ROW_Z, Math.PI / 2);
    place(p, 39.2, ROW_Z);
    sim.setCmd('p1', { ...IDLE_CMD });
    const ev = run(sim, 0.5);
    expect(ev.filter((e) => e.t === 'catch').length).toBe(1);
    // Revive immediately and stand in front of the satisfied agent.
    p.downed = false;
    const ev2 = run(sim, 3);
    expect(ev2.filter((e) => e.t === 'catch').length).toBe(0);
  });
});

describe('bonnie', () => {
  it('relocates only between points nobody can see, never into a room with a player', () => {
    const { sim, p, a } = setup(20);
    // Player far away in the kitchen, looking at a wall.
    place(p, 44, 50, 0);
    sim.setCmd('p1', { ...IDLE_CMD, flash: false, stance: 1 });
    p.body.stance = 1;
    Object.assign(a, { x: 12, z: 26, y: 0, state: 'PATROL', unseenT: 30, decisionT: 1e9 });
    a.goal = { x: 12, y: 0, z: 47 };
    a.path = null;
    const ev = run(sim, 3);
    expect(ev.some((e) => e.t === 'relocate')).toBe(true);
    const room = sim.roomAt(a.x, a.y + 0.3, a.z);
    expect(room).not.toBe('kitchen');
  });
});

describe('determinism', () => {
  it('replays a seeded night with an input log to the same events', () => {
    const play = () => {
      const sim = new FrSim({ seed: 99, night: 2, mode: 'night', aggression: { bonnie: 14 }, spawnProtection: 0, playerCount: 1 });
      sim.addPlayer('p1', 'A');
      const out: string[] = [];
      for (let i = 0; i < 30 * 40; i++) {
        sim.setCmd('p1', { ...IDLE_CMD, fwd: Math.sin(i / 40) > 0 ? 1 : 0, yaw: i / 90, sprint: i % 200 < 60, flash: i % 300 < 150 });
        for (const e of sim.tick()) if (e.t !== 'noise' && e.t !== 'step') out.push(`${sim.tickN}:${JSON.stringify(e)}`);
      }
      return out.join('\n');
    };
    expect(play()).toEqual(play());
  });
});
