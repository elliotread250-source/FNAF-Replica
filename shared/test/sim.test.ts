import { describe, expect, it } from 'vitest';
import {
  CONFIG,
  createRng,
  int,
  createWorld,
  step,
  viewFor,
  drainPerSecond,
  opportunity,
  secs,
  caesar,
  NIGHT5_CIPHER,
  scoreMatch,
  type World,
} from '../src/index';
import { anim, classic, coop, input, quiet, run } from './helpers';

describe('AI rolls', () => {
  it('1. AI 0 never moves over 10,000 opportunities; AI 20 moves every opportunity', () => {
    const w = quiet(classic(1));
    const a = anim(w, 'bonnie');
    let zero = 0;
    a.aiLevel = 0;
    for (let i = 0; i < 10000; i++) {
      a.moveTimer = 1;
      if (opportunity(w, a)) zero++;
    }
    expect(zero).toBe(0);
    a.aiLevel = 20;
    let twenty = 0;
    for (let i = 0; i < 10000; i++) {
      a.moveTimer = 1;
      if (opportunity(w, a)) twenty++;
    }
    expect(twenty).toBe(10000);
  });

  it('2. AI N moves with probability N/20 within tolerance over 20,000 seeded rolls', () => {
    for (const n of [1, 5, 10, 15]) {
      const w = quiet(classic(1, n));
      const a = anim(w, 'chica');
      a.aiLevel = n;
      let hits = 0;
      for (let i = 0; i < 20000; i++) {
        a.moveTimer = 1;
        if (opportunity(w, a)) hits++;
      }
      expect(Math.abs(hits / 20000 - n / 20)).toBeLessThan(0.015);
    }
  });

  it('3. movement timers fire at the configured interval within one tick', () => {
    for (const [id, interval] of Object.entries(CONFIG.animatronics.INTERVALS)) {
      const w = quiet(classic(1));
      const a = anim(w, id);
      a.aiLevel = 20;
      a.moveTimer = interval * CONFIG.TICK_HZ;
      const fires: number[] = [];
      for (let t = 1; t <= 2000; t++) {
        if (opportunity(w, a)) fires.push(t);
      }
      for (let i = 1; i < fires.length; i++) {
        expect(Math.abs(fires[i] - fires[i - 1] - interval * CONFIG.TICK_HZ)).toBeLessThanOrEqual(1);
      }
      expect(fires.length).toBeGreaterThan(5);
    }
  });

  it('4. night tables load the right AI; hourly bumps at 2, 3, 4 AM (and 5 AM Freddy in Night Shift)', () => {
    const w = classic(6);
    expect(anim(w, 'freddy').aiLevel).toBe(4);
    expect(anim(w, 'bonnie').aiLevel).toBe(10);
    expect(anim(w, 'chica').aiLevel).toBe(12);
    expect(anim(w, 'foxy').aiLevel).toBe(16);
    const c = classic(1);
    quiet(c);
    for (const a of c.anims) a.aiLevel = 0;
    c.tick = c.hourTicks * 2 - 1;
    step(c);
    expect(anim(c, 'bonnie').aiLevel).toBe(1);
    c.tick = c.hourTicks * 3 - 1;
    step(c);
    expect(anim(c, 'bonnie').aiLevel).toBe(2);
    expect(anim(c, 'chica').aiLevel).toBe(1);
    expect(anim(c, 'foxy').aiLevel).toBe(1);
    c.tick = c.hourTicks * 5 - 1;
    step(c);
    expect(anim(c, 'freddy').aiLevel).toBe(0);
    const n = quiet(coop(4, 1));
    n.tick = n.hourTicks * 5 - 1;
    step(n);
    expect(anim(n, 'freddy').aiLevel).toBe(1);
    // Night Shift four-player Night 5 table.
    const n5 = coop(4, 5);
    expect([anim(n5, 'freddy').aiLevel, anim(n5, 'bonnie').aiLevel, anim(n5, 'chica').aiLevel, anim(n5, 'foxy').aiLevel]).toEqual([5, 8, 9, 8]);
  });
});

describe('Power', () => {
  it('5. Classic drains at the configured rate for usage 1 to 5, plus passive drain', () => {
    const doorsFor = (w: World, u: number) => {
      const o = w.stations.office!;
      w.doors.left.closed = u >= 2;
      w.doors.right.closed = u >= 3;
      w.doors.left.light = u >= 4;
      o.tablet = u >= 5;
    };
    for (let u = 1; u <= 5; u++) {
      const w = quiet(classic(1));
      doorsFor(w, u);
      run(w, 10);
      const expected = 100 - CONFIG.power.BASE_DRAIN_PER_USAGE[u] * 10;
      expect(Math.abs(w.power - expected)).toBeLessThan(1);
    }
    const w5 = quiet(classic(5));
    run(w5, 10);
    const expected = 100 - (CONFIG.power.BASE_DRAIN_PER_USAGE[1] + CONFIG.power.PASSIVE_DRAIN[5] * CONFIG.power.CLASSIC_PASSIVE_SCALE) * 10;
    expect(Math.abs(w5.power - expected)).toBeLessThan(0.2);
  });

  it('6. closing a door adds a usage bar; opening removes it; tablet and lights likewise', () => {
    const w = quiet(classic(1));
    const o = w.stations.office!;
    drainPerSecond(w);
    expect(o.usage).toBe(1);
    input(w, 'p1', { action: 'door', door: 'left', closed: true });
    drainPerSecond(w);
    expect(o.usage).toBe(2);
    run(w, 0.2);
    input(w, 'p1', { action: 'light', door: 'right', on: true });
    drainPerSecond(w);
    expect(o.usage).toBe(3);
    input(w, 'p1', { action: 'light', door: 'right', on: false });
    input(w, 'p1', { action: 'tablet', up: true });
    drainPerSecond(w);
    expect(o.usage).toBe(3);
    input(w, 'p1', { action: 'tablet', up: false });
    run(w, 0.2);
    input(w, 'p1', { action: 'door', door: 'left', closed: false });
    drainPerSecond(w);
    expect(o.usage).toBe(1);
  });

  it('20. co-op scaling: four stations at usage 2 drain at the configured combined rate', () => {
    const w = quiet(coop(4, 1));
    for (const d of ['west', 'east', 'south_l', 'vent']) w.doors[d].closed = true;
    const expected = 4 * CONFIG.power.BASE_DRAIN_PER_USAGE[2] * CONFIG.power.CO_OP_POWER_SCALE[4];
    expect(drainPerSecond(w)).toBeCloseTo(expected, 6);
  });

  it('14. power at 0 opens and jams all doors and starts the power-out; 6 AM during it means survival', () => {
    const w = quiet(classic(1));
    w.doors.left.closed = true;
    w.power = 0.01;
    run(w, 1);
    expect(w.powerOut.active).toBe(true);
    expect(w.doors.left.closed).toBe(false);
    expect(w.doors.left.jammed).toBe(true);
    const ev = input(w, 'p1', { action: 'door', door: 'left', closed: true });
    expect(ev.some((e) => e.type === 'reject')).toBe(true);
    // Jump to just before 6 AM: the sequence can't finish in time.
    w.tick = w.hourTicks * 6 - 5;
    run(w, 1);
    expect(w.result).toBe('win');
    expect(w.stations.office!.alive).toBe(true);
  });
});

describe('Doors and animatronics', () => {
  it('7. a closed door blocks Bonnie and he retreats; an open door lets him in', () => {
    const w = quiet(classic(1));
    const b = anim(w, 'bonnie');
    b.aiLevel = 20;
    b.node = 'west_corner';
    b.subPos = 'at_door';
    b.door = 'left';
    b.targetDoor = 'left';
    w.doors.left.closed = true;
    b.moveTimer = 1;
    step(w);
    expect(b.subPos).toBe('room');
    expect(b.node).not.toBe('west_corner');
    // Open door.
    b.node = 'west_corner';
    b.subPos = 'at_door';
    b.door = 'left';
    w.doors.left.closed = false;
    b.moveTimer = 1;
    step(w);
    expect(b.subPos).toBe('in_office');
  });

  it('8. Bonnie in the office jams the left door and light; pressing yields a rejection', () => {
    const w = quiet(classic(1));
    const b = anim(w, 'bonnie');
    b.aiLevel = 20;
    b.node = 'west_corner';
    b.subPos = 'at_door';
    b.door = 'left';
    b.moveTimer = 1;
    w.stations.office!.tablet = true;
    step(w);
    expect(b.subPos).toBe('in_office');
    w.stations.office!.tablet = false;
    const e1 = input(w, 'p1', { action: 'door', door: 'left', closed: true });
    expect(e1.some((e) => e.type === 'reject' && e.reason === 'jammed')).toBe(true);
    const e2 = input(w, 'p1', { action: 'light', door: 'left', on: true });
    expect(e2.some((e) => e.type === 'error_buzz')).toBe(true);
  });

  it('9. in-office attacker strikes when the tablet goes down, after the delay if it stays down, and forces it down eventually', () => {
    // a) tablet goes down
    const w = quiet(classic(1));
    const s = w.stations.office!;
    s.tablet = true;
    const b = anim(w, 'bonnie');
    Object.assign(b, { node: 'west_corner', subPos: 'at_door', door: 'left', aiLevel: 20, moveTimer: 1 });
    step(w);
    run(w, 3);
    expect(s.alive).toBe(true);
    input(w, 'p1', { action: 'tablet', up: false });
    run(w, 0.3);
    expect(s.alive).toBe(false);
    expect(s.killedBy).toBe('bonnie');
    // b) tablet stays down
    const w2 = quiet(classic(1));
    const b2 = anim(w2, 'bonnie');
    Object.assign(b2, { node: 'west_corner', subPos: 'at_door', door: 'left', aiLevel: 20, moveTimer: 1 });
    step(w2);
    expect(b2.subPos).toBe('in_office');
    run(w2, 1.4);
    expect(w2.stations.office!.alive).toBe(true);
    run(w2, 2);
    expect(w2.stations.office!.alive).toBe(false);
    // c) tablet stays up forever: forced down within 25 s
    const w3 = quiet(classic(1));
    w3.stations.office!.tablet = true;
    const b3 = anim(w3, 'bonnie');
    Object.assign(b3, { node: 'west_corner', subPos: 'at_door', door: 'left', aiLevel: 20, moveTimer: 1 });
    step(w3);
    const ev = run(w3, 26);
    expect(ev.some((e) => e.type === 'tablet_forced')).toBe(true);
    expect(w3.stations.office!.alive).toBe(false);
  });

  it('10. Freddy never takes an opportunity while his node is watched', () => {
    const w = quiet(classic(3));
    const f = anim(w, 'freddy');
    f.aiLevel = 20;
    const s = w.stations.office!;
    s.tablet = true;
    s.cam = 'stage';
    run(w, 60);
    expect(f.node).toBe('stage');
    s.tablet = false;
    run(w, 10);
    expect(f.node).not.toBe('stage');
  });

  it('11. Foxy freezes when watched, climbs stages 0-3 when not, and the sprint shortens when the West Hall is viewed', () => {
    const w = quiet(classic(1));
    const fx = anim(w, 'foxy');
    fx.aiLevel = 20;
    const s = w.stations.office!;
    s.tablet = true;
    s.cam = 'cove';
    run(w, 30);
    // Watching the cove continuously keeps him frozen at most of the time.
    expect(fx.stage).toBeLessThan(3);
    s.tablet = false;
    run(w, 25);
    expect(fx.stage).toBe(3);
    const before = fx.flags.sprintLeft;
    expect(before).toBeGreaterThan(secs(10));
    s.tablet = true;
    s.cam = 'west_hall';
    step(w);
    expect(fx.flags.sprintLeft).toBeLessThanOrEqual(secs(CONFIG.animatronics.FOXY_SPRINT_WHEN_SEEN));
  });

  it('12. Foxy knocks drain 1%, then 6%, then 11% across three blocked runs', () => {
    const w = quiet(classic(1));
    w.passiveDrain = 0;
    const fx = anim(w, 'foxy');
    w.doors.left.closed = true;
    const drains: number[] = [];
    for (let i = 0; i < 3; i++) {
      Object.assign(fx, { stage: 3, flags: { sprintLeft: 2, sprintTotal: 100, seen: 1 } });
      const ev = run(w, 0.2);
      const k = ev.find((e) => e.type === 'knock');
      drains.push(Number(k?.drain));
    }
    expect(drains).toEqual([1, 6, 11]);
  });

  it('13. the flashlight sends Foxy back in the first half of the sprint, not the second', () => {
    const w = quiet(coop(4, 1));
    const fx = anim(w, 'foxy');
    const west = w.stations.west!;
    west.flashlight = true;
    Object.assign(fx, { stage: 3, node: 'west_hall', flags: { sprintLeft: 400, sprintTotal: 500, seen: 0 } });
    step(w);
    expect(fx.stage).toBe(1);
    Object.assign(fx, { stage: 3, node: 'west_hall', flags: { sprintLeft: 100, sprintTotal: 500, seen: 0 } });
    step(w);
    expect(fx.stage).toBe(3);
  });

  it('15. Golden Freddy appears only after the poster; raising the tablet within 4 s dismisses him; failing kills', () => {
    const w = quiet(classic(1));
    const s = w.stations.office!;
    input(w, 'p1', { action: 'tablet', up: true });
    input(w, 'p1', { action: 'tablet', up: false });
    expect(s.goldenUntil).toBeNull();
    w.goldenOdds = 1;
    input(w, 'p1', { action: 'tablet', up: true });
    input(w, 'p1', { action: 'camera', node: 'west_corner' });
    expect(s.goldenArmed).toBe(true);
    input(w, 'p1', { action: 'tablet', up: false });
    expect(s.goldenUntil).not.toBeNull();
    run(w, 2);
    w.goldenOdds = 0;
    input(w, 'p1', { action: 'tablet', up: true });
    expect(s.goldenUntil).toBeNull();
    expect(s.alive).toBe(true);
    // Fail case.
    w.goldenOdds = 1;
    input(w, 'p1', { action: 'camera', node: 'stage' });
    input(w, 'p1', { action: 'camera', node: 'west_corner' });
    input(w, 'p1', { action: 'tablet', up: false });
    run(w, 4.5);
    expect(s.alive).toBe(false);
    expect(s.killedBy).toBe('golden');
  });

  it('16. 1/9/8/7 Custom Night kills the host instantly with Golden Freddy', () => {
    const w = coop(4, 7, 1, { custom: { ai: { freddy: 1, bonnie: 9, chica: 8, foxy: 7 }, puppet: 0, extended: {} } });
    const ev = run(w, 0.1);
    expect(ev.some((e) => e.type === 'death' && e.by === 'golden' && e.player === 'p1')).toBe(true);
    expect(ev.some((e) => e.type === 'radio')).toBe(true);
    expect(w.stations.east!.alive).toBe(true);
  });

  it('17. music box unwinds, the Puppet emerges at 0, travels at fixed speed, is recalled above 50%, kills on arrival', () => {
    const w = quiet(coop(4, 3));
    expect(w.musicBox.enabled).toBe(true);
    run(w, 10);
    expect(w.musicBox.level).toBeCloseTo(100 - CONFIG.musicBox.UNWIND[3] * 10, 0);
    w.musicBox.level = 0.01;
    run(w, 0.2);
    expect(w.musicBox.puppetOut).toBe(true);
    // Recall: wind above 50 in time.
    w.musicBox.level = 51;
    run(w, 0.1);
    expect(w.musicBox.puppetOut).toBe(false);
    // Arrival kills the Technician (arcade -> vent_hub -> office, 2 edges at 8 s each).
    w.musicBox.level = 0.01;
    run(w, 0.2);
    expect(w.musicBox.puppetOut).toBe(true);
    w.musicBox.rate = 0;
    run(w, 8 * 2 + 1);
    expect(w.stations.control!.alive).toBe(false);
    expect(w.stations.control!.killedBy).toBe('puppet');
  });

  it('18. maintenance failures follow the schedule; reboots take 5 s (12 s all); ventilation causes hallucinations after 20 s', () => {
    const w = quiet(coop(4, 3));
    w.maintenance.schedule = [
      { tick: w.tick + 2, system: 'ventilation' },
      { tick: w.tick + 4, system: 'cameras' },
    ];
    run(w, 0.3);
    expect(Object.keys(w.maintenance.failed).sort()).toEqual(['cameras', 'ventilation']);
    const ev = run(w, 21);
    expect(ev.some((e) => e.type === 'hallucination')).toBe(true);
    input(w, 'p4', { action: 'tool', tool: 'reboot', system: 'cameras' });
    run(w, 4.8);
    expect(w.maintenance.failed.cameras).toBeDefined();
    run(w, 0.4);
    expect(w.maintenance.failed.cameras).toBeUndefined();
    w.maintenance.failed.power = w.tick;
    input(w, 'p4', { action: 'tool', tool: 'reboot', system: 'all' });
    run(w, 11.5);
    expect(w.maintenance.failed.power).toBeDefined();
    run(w, 0.6);
    expect(Object.keys(w.maintenance.failed)).toEqual([]);
  });

  it('19. the mask fools a mask-able animatronic in time and never fools Foxy', () => {
    const w = quiet(coop(4, 2));
    const s = w.stations.south!;
    input(w, 'p3', { action: 'tool', tool: 'mask', on: true });
    run(w, 0.5);
    const c = anim(w, 'chica');
    Object.assign(c, { node: 'south_hall', subPos: 'at_door', door: 'south_l', targetDoor: 'south_l', aiLevel: 20, moveTimer: 1 });
    step(w);
    expect(c.subPos).toBe('in_office');
    const ev = run(w, 7);
    expect(ev.some((e) => e.type === 'fooled')).toBe(true);
    expect(s.alive).toBe(true);
    expect(c.subPos).toBe('room');
    expect(c.node).toBe('south_hall');
    expect(s.stats.maskFools).toBe(1);
    // Foxy isn't mask-able (his rule never routes him south; force him in to check the flag).
    const fx = anim(w, 'foxy');
    Object.assign(fx, { subPos: 'in_office', station: 'south', door: 'south_r', enteredTick: w.tick, flags: { maskGrace: w.tick + 30 } });
    run(w, 4);
    expect(s.alive).toBe(false);
  });

  it('21. sealed stations are never targeted and never draw power', () => {
    const w = quiet(coop(2, 1));
    expect(w.stations.south!.sealed).toBe(true);
    expect(w.stations.control!.sealed).toBe(true);
    const b = anim(w, 'bonnie');
    const c = anim(w, 'chica');
    for (let i = 0; i < 200; i++) {
      b.targetDoor = null;
      c.targetDoor = null;
      b.aiLevel = 20;
      c.aiLevel = 20;
      run(w, 5);
      for (const a of [b, c]) if (a.targetDoor) expect(['west', 'east']).toContain(a.targetDoor);
      if (w.ended) break;
    }
    drainPerSecond(w);
    expect(w.stations.south!.usage).toBe(0);
    expect(w.stations.control!.usage).toBe(0);
  });

  it('22. a disconnected station goes to autopilot, then seals after 60 s', () => {
    const w = quiet(coop(4, 1));
    step(w, [{ pid: 'p2', seq: 1, input: { action: 'disconnect' } }]);
    expect(w.stations.east!.connected).toBe(false);
    run(w, 30);
    expect(w.stations.east!.abandoned).toBe(false);
    run(w, 31);
    expect(w.stations.east!.abandoned).toBe(true);
    expect(w.doors.east.closed).toBe(true);
    drainPerSecond(w);
    expect(w.stations.east!.usage).toBe(0);
  });

  it('23. a seeded night replays identically', () => {
    const play = () => {
      const w = coop(4, 5, 777);
      w.hourTicks = 20 * 20;
      const log: string[] = [];
      while (!w.ended) for (const e of step(w)) log.push(JSON.stringify(e));
      return log;
    };
    const a = play();
    const b = play();
    expect(a.length).toBeGreaterThan(10);
    expect(a).toEqual(b);
  });

  it('24. per-player view hides animatronics the player cannot perceive', () => {
    const w = quiet(coop(4, 1));
    const b = anim(w, 'bonnie');
    b.node = 'dining';
    expect(viewFor(w, 'p1').an.some((a) => a.id === 'bonnie')).toBe(false);
    w.stations.west!.tablet = true;
    w.stations.west!.cam = 'dining';
    expect(viewFor(w, 'p1').an.some((a) => a.id === 'bonnie')).toBe(true);
    expect(viewFor(w, 'p2').an.some((a) => a.id === 'bonnie')).toBe(false);
    // At the door: only visible with that door's light on.
    Object.assign(b, { node: 'west_corner', subPos: 'at_door', door: 'west' });
    w.stations.west!.tablet = false;
    expect(viewFor(w, 'p1').an.some((a) => a.id === 'bonnie')).toBe(false);
    w.doors.west.light = true;
    expect(viewFor(w, 'p1').an.some((a) => a.id === 'bonnie' && a.s === 'at_door')).toBe(true);
    // Freddy is never visible in a door light.
    const f = anim(w, 'freddy');
    Object.assign(f, { node: 'east_corner', subPos: 'at_door', door: 'east' });
    w.doors.east.light = true;
    expect(viewFor(w, 'p2').an.some((a) => a.id === 'freddy')).toBe(false);
    // Ghosts see everything.
    w.stations.south!.alive = false;
    expect(viewFor(w, 'p3').an.length).toBeGreaterThanOrEqual(4);
  });
});

describe('Misc rules', () => {
  it('Night 5 cipher decodes to the backstage hint', () => {
    expect(caesar(NIGHT5_CIPHER, -7)).toBe('THEY WERE NEVER FOUND. LOOK BEHIND THE STAGE.');
  });

  it('rng is deterministic', () => {
    const a = createRng(5);
    const b = createRng(5);
    for (let i = 0; i < 100; i++) expect(int(a, 1, 20)).toBe(int(b, 1, 20));
  });

  it('6 AM victory pays out per Part 8.6', () => {
    const w = quiet(coop(4, 2));
    w.tick = w.hourTicks * 6 - 1;
    step(w);
    expect(w.result).toBe('win');
    const r = scoreMatch(w);
    const base = CONFIG.rewards.NIGHTSHIFT_WIN_BASE + CONFIG.rewards.NIGHTSHIFT_WIN_PER_NIGHT * 2;
    expect(r.players[0].tokens).toBe(Math.round(base * 1.15));
  });

  it('call mute vote needs half the living guards', () => {
    const w = quiet(createWorld({ seed: 3, mode: 'nightshift', night: 1, hourSeconds: 89, players: [
      { id: 'a', name: 'A', station: 'west' }, { id: 'b', name: 'B', station: 'east' }, { id: 'c', name: 'C', station: 'south' }, { id: 'd', name: 'D', station: 'control' },
    ] }));
    w.call = { night: 1, startTick: 1, duration: 60, muted: false, votes: [] };
    input(w, 'a', { action: 'vote_mute' });
    expect(w.call.muted).toBe(false);
    input(w, 'b', { action: 'vote_mute' });
    expect(w.call.muted).toBe(true);
  });
});
