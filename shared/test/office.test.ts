import { describe, expect, it } from 'vitest';
import { FR, FrSim, IDLE_CMD, type Agent, type FrEvent, type FrPlayer } from '../src';

const DT = 1 / FR.TICK_HZ;
function setup(roster: Record<string, number> = {}, n = 3): { s: FrSim; p: FrPlayer } {
  const s = new FrSim({ seed: 3, night: n, mode: 'night', aggression: roster, spawnProtection: 0, playerCount: 4 });
  const p = s.addPlayer('p1', 'A');
  s.tick();
  s.power.main = true;
  s.night.breakers.fill(true);
  s.night.blown.clear();
  return { s, p };
}
function act(s: FrSim, a: Parameters<FrSim['setCmd']>[1]['act']): FrEvent[] {
  s.setCmd('p1', { ...IDLE_CMD, act: a });
  return s.tick();
}
function run(s: FrSim, seconds: number, cmd = IDLE_CMD): FrEvent[] {
  const out: FrEvent[] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    s.setCmd('p1', cmd);
    out.push(...s.tick());
  }
  return out;
}
const at = (p: FrPlayer, x: number, z: number, yaw = 0) => Object.assign(p.body, { x, z, y: 0, yaw, vy: 0, grounded: true });

describe('security office', () => {
  it('seats a player, closes the west door and lights the west corner', () => {
    const { s, p } = setup();
    at(p, 25, 50.5);
    act(s, { type: 'item', id: 'office-chair' });
    expect(p.seated).toBe(true);
    act(s, { type: 'office', what: 'doorL' });
    run(s, 2);
    expect(s.world.doorOpen[s.office.doorL]).toBeLessThan(0.05);
    expect(s.litAt(19, 0, 50)).toBe(false);
    act(s, { type: 'office', what: 'lightL' });
    expect(s.litAt(19, 0, 50)).toBe(true);
    // Door and light both drain extra.
    expect(s.office.drainPerHour()).toBe(FR.power.OFFICE_LIGHT);
  });

  it('a camera feed counts as looking: Freddy freezes on CAM 1B', () => {
    const { s, p } = setup({ freddy: 20 });
    const f = s.agents.find((a) => a.id === 'freddy') as Agent;
    Object.assign(f, { x: 34, z: 20, y: 0, state: 'STALK' });
    at(p, 25, 50.5);
    act(s, { type: 'item', id: 'office-chair' });
    act(s, { type: 'office', what: 'monitor' });
    act(s, { type: 'cam', id: '1B' });
    expect(p.viewCam).toBe('1B');
    const x0 = f.x;
    const z0 = f.z;
    run(s, 3);
    expect(Math.hypot(f.x - x0, f.z - z0)).toBeLessThan(0.01);
    act(s, { type: 'cam', id: '9' });
    run(s, 2);
    expect(Math.hypot(f.x - x0, f.z - z0)).toBeGreaterThan(1);
  });

  it('winds the music box remotely from CAM 8 at 40% speed', () => {
    const { s, p } = setup();
    at(p, 25, 50.5);
    act(s, { type: 'item', id: 'office-chair' });
    act(s, { type: 'office', what: 'monitor' });
    act(s, { type: 'cam', id: '8' });
    s.night.musicBox = 40;
    run(s, 2, { ...IDLE_CMD, use: 'musicbox:remote' });
    const unwind = FR.musicBox.UNWIND[3] * 2;
    expect(s.night.musicBox - 40).toBeCloseTo(FR.musicBox.WIND_REMOTE * 2 - unwind, 0);
  });

  it('the phone rings at 12:05 AM and answering plays the night call to everyone', () => {
    const { s, p } = setup({}, 1);
    let ring = false;
    for (let i = 0; i < Math.round(((5 / 60) * s.hourSeconds + 1) / DT); i++) for (const e of s.tick()) if (e.t === 'phone' && e.state === 'ringing') ring = true;
    expect(ring).toBe(true);
    at(p, 24.5, 50.2);
    const ev = act(s, { type: 'item', id: 'phone' });
    expect(ev.some((e) => e.t === 'call' && e.night === 1)).toBe(true);
  });

  it('the Faz-Pad shows cameras anywhere and drains its own battery', () => {
    const { s, p } = setup();
    const pad = s.night.items.find((i) => i.type === 'fazpad') as NonNullable<(typeof s.night.items)[0]>;
    at(p, pad.x - 0.2, pad.z + 1.0);
    act(s, { type: 'pickup', id: pad.id });
    expect(pad.holder).toBe('p1');
    act(s, { type: 'tablet', up: true });
    expect(p.tabletUp).toBe(true);
    expect(p.viewCam).not.toBeNull();
    run(s, 5);
    expect(p.padBattery).toBeCloseTo(90, 0);
  });

  it('the Showtime lure pulls Bonnie to the stage for 25 seconds', () => {
    const { s, p } = setup({ bonnie: 10 });
    const b = s.agents.find((a) => a.id === 'bonnie') as Agent;
    Object.assign(b, { x: 40, z: 22, y: 0, state: 'PATROL', path: [], goal: null, pauseT: 1e9, decisionT: 1e9 });
    at(p, 61, 24.2, Math.PI);
    const ev = act(s, { type: 'item', id: 'booth-desk' });
    expect(ev.some((e) => e.t === 'lure')).toBe(true);
    expect(b.state).toBe('INVESTIGATE');
    expect(b.log.join('\n')).toMatch(/Showtime jingle/);
    expect(s.office.lureCooldown).toBeGreaterThan(80);
  });
});
