import { FR } from '../../frConfig';
import { CAMERAS } from '../../world/layout';
import type { SecurityCameraDef } from '../../world/types';
import { investigate, type Agent } from './ai';
import type { FrPlayer, FrSim } from './sim';

// The Security Office (Part 3.6, 4.12): a seat with two shutter doors, two corner lights, the monitor
// and the camera network; the Faz-Pad tablet that shows the same cameras anywhere; the 12:05 phone call;
// the stage booth's Showtime lure. Watching on camera counts as looking (Freddy, Foxy, Bonnie).

export const STAGE_POINT = { x: 61, y: 1, z: 15 };
const CAM_FOV_H = 80;
const CAM_RANGE = 30;

export type OfficeButton = 'doorL' | 'doorR' | 'lightL' | 'lightR' | 'monitor';

export class OfficeState {
  seated: string | null = null;
  lights = { L: false, R: false };
  monitorUp = false;
  phone: 'idle' | 'ringing' | 'answered' | 'missed' = 'idle';
  phoneT = 0;
  lureCooldown = 0;
  readonly doorL: number;
  readonly doorR: number;

  constructor(private readonly sim: FrSim) {
    this.doorL = sim.level.doors.find((d) => d.name === 'Security Door West')?.id ?? -1;
    this.doorR = sim.level.doors.find((d) => d.name === 'Security Door East')?.id ?? -1;
  }

  /** The office has its own feed off the main breaker (no zone switch). */
  powered(): boolean {
    return this.sim.power.main && this.sim.night.groupLive('office');
  }

  drainPerHour(): number {
    let r = 0;
    if (this.lights.L) r += FR.power.OFFICE_LIGHT;
    if (this.lights.R) r += FR.power.OFFICE_LIGHT;
    if (this.monitorUp) r += FR.power.MONITOR;
    return r;
  }

  tick(dt: number): void {
    const sim = this.sim;
    if (this.lureCooldown > 0) this.lureCooldown -= dt;
    if (!this.powered()) {
      this.lights.L = this.lights.R = false;
      this.monitorUp = false;
    }
    if (this.seated) {
      const p = sim.players.get(this.seated);
      if (!p || !sim.alive(p) || p.hidden) this.stand(p);
    }
    // The phone rings at 12:05 AM, Nights 1 to 5, for half a minute.
    const ringAt = (5 / 60) * sim.hourSeconds;
    if (sim.opts.mode === 'night' && sim.opts.night <= 5 && this.phone === 'idle' && sim.time >= ringAt) {
      this.phone = 'ringing';
      this.phoneT = 30;
      sim.emit({ t: 'phone', state: 'ringing' });
    }
    if (this.phone === 'ringing') {
      this.phoneT -= dt;
      if (this.phoneT <= 0) {
        this.phone = 'missed';
        sim.emit({ t: 'phone', state: 'missed' });
      }
    }
  }

  answer(p: FrPlayer): void {
    if (this.phone === 'idle') return;
    // A missed call stays on the answering machine for the rest of the night.
    this.phone = 'answered';
    this.sim.emit({ t: 'call', night: this.sim.opts.night, by: p.id });
  }

  sit(p: FrPlayer): void {
    if (this.seated && this.seated !== p.id) {
      this.sim.emit({ t: 'nopower', pid: p.id, text: 'Someone is already on duty.' });
      return;
    }
    this.seated = p.id;
    Object.assign(p.body, { x: 25, z: 50.8, y: 0, vy: 0, grounded: true });
    p.seated = true;
    this.sim.emit({ t: 'seat', pid: p.id, on: true });
  }

  stand(p: FrPlayer | undefined): void {
    if (p) {
      p.seated = false;
      p.viewCam = p.tabletUp ? p.viewCam : null;
      this.sim.emit({ t: 'seat', pid: p.id, on: false });
    }
    this.seated = null;
    this.monitorUp = false;
  }

  press(p: FrPlayer, what: OfficeButton): void {
    const sim = this.sim;
    if (this.seated !== p.id) return;
    if (!this.powered()) {
      sim.emit({ t: 'nopower', pid: p.id, text: 'The buttons are dead. No power to the office.' });
      return;
    }
    if (what === 'doorL' || what === 'doorR') {
      const id = what === 'doorL' ? this.doorL : this.doorR;
      if (id < 0) return;
      // An animatronic standing in the doorway jams it (the classic error buzz).
      const d = sim.level.doors[id];
      const agentThere = sim.agents.some((a) => {
        const along = d.axis === 'z' ? a.x : a.z;
        const across = d.axis === 'z' ? a.z : a.x;
        return along > d.from - 0.3 && along < d.to + 0.3 && Math.abs(across - d.line) < 0.8;
      });
      if (sim.doorTarget[id] > 0.5 && (sim.anyoneInDoorway(id) || agentThere)) {
        sim.emit({ t: 'nopower', pid: p.id, text: 'BZZT. Something is in the way.' });
        return;
      }
      sim.setDoor(id, sim.doorTarget[id] < 0.5, p.id);
    } else if (what === 'lightL') this.lights.L = !this.lights.L;
    else if (what === 'lightR') this.lights.R = !this.lights.R;
    else if (what === 'monitor') {
      this.monitorUp = !this.monitorUp;
      p.viewCam = this.monitorUp ? (p.viewCam ?? '1B') : null;
    }
    sim.emit({ t: 'office', what, lights: { ...this.lights }, monitor: this.monitorUp });
  }

  /** Is a lit office door light shining on this point (the corner just outside the door)? */
  lightsCorner(x: number, z: number): boolean {
    if (!this.powered()) return false;
    if (this.lights.L && x >= 17 && x <= 22 && z >= 48 && z <= 52.5) return true;
    if (this.lights.R && x >= 28 && x <= 33 && z >= 48 && z <= 52.5) return true;
    return false;
  }

  /** Showtime lure from the stage booth (Part 5.6). */
  lure(p: FrPlayer): void {
    const sim = this.sim;
    if (this.lureCooldown > 0) {
      sim.emit({ t: 'nopower', pid: p.id, text: `The jingle needs ${Math.ceil(this.lureCooldown)} seconds to rewind.` });
      return;
    }
    if (!sim.power.main) {
      sim.emit({ t: 'nopower', pid: p.id, text: 'No power to the stage speakers.' });
      return;
    }
    this.lureCooldown = 90;
    sim.night.power = Math.max(0, sim.night.power - 2);
    sim.emit({ t: 'lure', x: STAGE_POINT.x, y: STAGE_POINT.y, z: STAGE_POINT.z });
    for (const a of sim.agents) {
      if (!lurable(a)) continue;
      if (Math.hypot(a.x - STAGE_POINT.x, a.z - STAGE_POINT.z) > 35) continue;
      investigate(sim, a, { x: STAGE_POINT.x - 4, y: 0, z: STAGE_POINT.z }, 'the Showtime jingle');
      a.x2.lured = sim.time + 25;
    }
  }
}

function lurable(a: Agent): boolean {
  if (a.id === 'freddy' || a.id === 'puppet' || a.id === 'powerout' || a.id === 'foxy') return false;
  return a.state === 'PATROL' || a.state === 'INVESTIGATE' || a.state === 'SEARCH' || a.state === 'EAT';
}

export function camera(id: string | null): SecurityCameraDef | undefined {
  return id ? CAMERAS.find((c) => c.id === id) : undefined;
}

/** Does this security camera have a line of sight to the point? Cameras see in the dark (infrared). */
export function cameraSees(sim: FrSim, cam: SecurityCameraDef, x: number, y: number, z: number): boolean {
  if (cam.audioOnly) return false;
  const dx = x - cam.x;
  const dy = y - cam.y;
  const dz = z - cam.z;
  const d = Math.hypot(dx, dy, dz);
  if (d > CAM_RANGE || d < 0.1) return false;
  const fx = -Math.sin(cam.yaw);
  const fz = -Math.cos(cam.yaw);
  const flat = Math.hypot(dx, dz) || 1;
  if ((dx * fx + dz * fz) / flat < Math.cos(((CAM_FOV_H / 2) * Math.PI) / 180)) return false;
  return sim.world.clearLine(cam.x, cam.y, cam.z, x, y, z);
}
