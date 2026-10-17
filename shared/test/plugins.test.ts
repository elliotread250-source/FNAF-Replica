import { describe, expect, it } from 'vitest';
import { step, secs } from '../src/index';
import { anim, coop, input, quiet, run } from './helpers';

const custom = (ext: Record<string, number>) => ({ custom: { ai: { freddy: 0, bonnie: 0, chica: 0, foxy: 0 }, puppet: 0, extended: ext } });

describe('25. extended roster plugins', () => {
  it('Endo-01: moves only when a station uses 4+ bars; keeping usage low keeps it home', () => {
    const w = quiet(coop(4, 7, 1, custom({ endo: 20 })));
    const e = anim(w, 'endo');
    e.aiLevel = 20;
    run(w, 30);
    expect(e.node).toBe('backstage');
    // West guard burns power: door + light + flashlight = 4 bars.
    w.doors.west.closed = true;
    w.doors.west.light = true;
    w.stations.west!.flashlight = true;
    w.stations.west!.battery = 1e9;
    run(w, 30);
    expect(e.node === 'backstage' && e.subPos === 'room').toBe(false);
  });

  it('Toy Freddy: long camera stares let him in (and he kills); short glances are safe', () => {
    const w = quiet(coop(4, 7, 2, custom({ toy_freddy: 20 })));
    const s = w.stations.south!;
    run(w, 1);
    const t = anim(w, 'toy_freddy');
    expect(t.subPos).toBe('at_door');
    for (let i = 0; i < 10; i++) {
      input(w, 'p3', { action: 'tablet', up: true });
      run(w, 3);
      input(w, 'p3', { action: 'tablet', up: false });
      run(w, 1);
    }
    expect(s.alive).toBe(true);
    input(w, 'p3', { action: 'tablet', up: true });
    run(w, 9);
    input(w, 'p3', { action: 'tablet', up: false });
    run(w, 4);
    expect(s.alive).toBe(false);
  });

  it('Tangle: closing the door at the peak sends it away; missing the peak kills', () => {
    const w = quiet(coop(4, 7, 3, custom({ mangle: 20 })));
    run(w, 0.1);
    const sid = w.plugins.mangle.station as 'west';
    const st = w.stations[sid]!;
    const door = Object.keys(w.doors).find((d) => w.doorStation[d] === sid)!;
    const pid = st.playerId!;
    let peaked = false;
    for (let i = 0; i < 20 * 40 && !peaked; i++) {
      const ev = step(w);
      peaked = ev.some((e) => e.type === 'mangle_peak');
    }
    expect(peaked).toBe(true);
    const gone = input(w, pid, { action: 'door', door, closed: true });
    expect(gone.some((e) => e.type === 'mangle_gone')).toBe(true);
    expect(Number(w.plugins.mangle.peakUntil)).toBe(0);
    expect(st.alive).toBe(true);
    // Second round: ignore it.
    let kills = false;
    for (let i = 0; i < 20 * 60 && !kills; i++) kills = step(w).some((e) => e.type === 'death' && e.by === 'mangle');
    expect(kills).toBe(true);
  });

  it('Balloon Kid: turning a light on while he giggles steals that station\'s lights', () => {
    const w = quiet(coop(4, 7, 4, custom({ bb: 20 })));
    let giggle: Record<string, unknown> | undefined;
    for (let i = 0; i < secs(120) && !giggle; i++) giggle = step(w).find((e) => e.type === 'bb_giggle');
    expect(giggle).toBeDefined();
    const sid = giggle!.station as 'west';
    const s = w.stations[sid]!;
    const door = Object.keys(w.doors).find((d) => w.doorStation[d] === sid)!;
    input(w, s.playerId!, { action: 'light', door, on: true });
    expect(w.doors[door].lightDeadUntil).toBeGreaterThan(w.tick);
    const ev = input(w, s.playerId!, { action: 'light', door, on: true });
    expect(ev.some((e) => e.type === 'reject')).toBe(true);
  });

  it('Shadow Bear: staring for 2 s kills the cameras; looking away is safe', () => {
    const w = quiet(coop(4, 7, 5, custom({ shadow_freddy: 20 })));
    for (let i = 0; i < secs(120) && !w.plugins.shadow.node; i++) step(w);
    const node = w.plugins.shadow.node as string;
    expect(node).toBeTruthy();
    const s = w.stations.west!;
    s.tablet = true;
    s.cam = node;
    run(w, 1);
    s.cam = 'stage';
    run(w, 0.5);
    expect(w.maintenance.failed.cameras).toBeUndefined();
    s.cam = node;
    run(w, 2.5);
    expect(w.maintenance.failed.cameras).toBeDefined();
  });

  it('Spring Rabbit: lures pull it; a closed door only holds it for 10 s', () => {
    const w = quiet(coop(4, 7, 6, custom({ springtrap: 20 })));
    const sp = anim(w, 'springtrap');
    sp.node = 'dining';
    input(w, 'p4', { action: 'tool', tool: 'lure', node: 'stage' });
    expect(sp.node).toBe('stage');
    // Door hold.
    Object.assign(sp, { node: 'east_corner', subPos: 'at_door', door: 'east', targetDoor: 'east', flags: { doorWait: 0 } });
    w.doors.east.closed = true;
    run(w, 9);
    expect(sp.subPos).toBe('at_door');
    run(w, 1.5);
    expect(sp.subPos).toBe('in_office');
    run(w, 4);
    expect(w.stations.east!.alive).toBe(false);
  });

  it('Phantom Fox: harmless with good air; with vents down it knocks out a tablet', () => {
    const w = quiet(coop(4, 7, 7, custom({ phantom_foxy: 20 })));
    anim(w, 'phantom_foxy').aiLevel = 20;
    const ev = run(w, 20);
    expect(ev.some((e) => e.type === 'hallucination' && e.kind === 'phantom')).toBe(true);
    expect(ev.some((e) => e.type === 'phantom_jumpscare')).toBe(false);
    w.maintenance.failed.ventilation = w.tick;
    const ev2 = run(w, 20);
    expect(ev2.some((e) => e.type === 'phantom_jumpscare')).toBe(true);
    expect(Object.values(w.stations).every((s) => !s || s.alive || s.sealed)).toBe(true);
  });

  it('The Hollow: door camping 30 s gets you visited; opening the door in time is safe', () => {
    const w = quiet(coop(4, 7, 8, custom({ nightmare: 20 })));
    input(w, 'p1', { action: 'door', door: 'west', closed: true });
    let breath = false;
    for (let i = 0; i < secs(60) && !breath; i++) breath = step(w).some((e) => e.type === 'nightmare_breath' && e.door === 'west');
    expect(breath).toBe(true);
    input(w, 'p1', { action: 'door', door: 'west', closed: false });
    run(w, 10);
    expect(w.stations.west!.alive).toBe(true);
    input(w, 'p2', { action: 'door', door: 'east', closed: true });
    run(w, 60);
    expect(w.stations.east!.alive).toBe(false);
    expect(w.stations.east!.killedBy).toBe('nightmare');
  });
});
