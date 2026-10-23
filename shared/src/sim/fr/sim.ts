import { FR } from '../../frConfig';
import { createRng, next, type Rng } from '../../rng';
import { getLevel } from '../../world/build';
import type { CircuitId, HidingSpotDef, Level } from '../../world/types';
import { CollisionWorld } from './collision';
import { eyeHeight, newBody, stepBody, type Body, type FrInput, type Stance } from './controller';
import { NavGrid } from './nav';
import { Agent, makeAgent, sawHiding, tickAgent } from './ai';
import { NightState } from './night';
import { spawnPowerOut } from './cast';
import { OfficeState, camera, cameraSees, type OfficeButton } from './office';

// The free-roam simulation. Deterministic given a seed and the input log; runs headless in Node (server,
// tests, balance script) and in the browser (solo play). It owns players, doors, power, noise, the clock
// and the animatronics. Renderers only read it.

export type FrMode = 'day' | 'night';

export type FrAct =
  | { type: 'door'; id: number }
  | { type: 'item'; id: string }
  | { type: 'hide'; id: number }
  | { type: 'unhide'; exit: number }
  | { type: 'revive'; pid: string }
  | { type: 'pickup'; id: number }
  | { type: 'battery' }
  | { type: 'drop' }
  | { type: 'stand' }
  | { type: 'office'; what: OfficeButton }
  | { type: 'cam'; id: string }
  | { type: 'tablet'; up: boolean };

export interface FrCmd extends FrInput {
  flash: boolean;
  breath: boolean;
  act?: FrAct;
  /** Held interaction (revive) is still being held. */
  hold?: boolean;
  /** Id of the thing being held down (music box crank, fuse box). */
  use?: string;
}

export interface HiddenState {
  spot: number;
  phase: 'enter' | 'in' | 'exit';
  t: number;
  exit: number;
}

export interface FrPlayer {
  id: string;
  name: string;
  body: Body;
  flashOn: boolean;
  battery: number;
  hidden: HiddenState | null;
  breath: number;
  holdingBreath: boolean;
  downed: boolean;
  bleed: number;
  revives: number;
  ghost: boolean;
  catches: number;
  /** Seconds of revive progress being applied to this player. */
  reviveProgress: number;
  revivedBy: string | null;
  /** Loudest noise this tick (for the HUD's noise ring). */
  noise: number;
  /** Time (sim seconds) of the last tell this player received from any animatronic. */
  lastTell: number;
  cmd: FrCmd;
  /** Seconds in the current hiding spot, for anti-camping. */
  hiddenFor: number;
  /** Seconds into the current held interaction. */
  useProgress: number;
  useTarget: string | null;
  /** Left through the front doors early. */
  exited: boolean;
  /** Sitting at the Security Office desk. */
  seated: boolean;
  /** Camera this player is watching (office monitor or Faz-Pad), or null. */
  viewCam: string | null;
  tabletUp: boolean;
  padBattery: number;
  /** Golden Freddy, for this player only: 0 none, 1 armed by the poster, 2 sitting in front of them. */
  golden: { phase: 0 | 1 | 2; yaw0: number; x: number; y: number; z: number; t: number; stare: number; seenPoster: boolean; count: number };
}

/** The band poster in the West Corner (Golden Freddy's poster). */
export const GOLDEN_POSTER = { x: 18, y: 1.7, z: 51.75 };

export type FrEvent =
  | { t: 'noise'; x: number; y: number; z: number; r: number; pid?: string }
  | { t: 'door'; id: number; open: boolean; by: string }
  | { t: 'locked'; pid: string; door: number; text: string }
  | { t: 'power'; main: boolean }
  | { t: 'switch'; circuit: CircuitId; on: boolean; pid: string }
  | { t: 'nopower'; pid: string; text: string }
  | { t: 'honk'; x: number; y: number; z: number }
  | { t: 'notice'; agent: string; pid: string }
  | { t: 'chase'; agent: string; pid: string }
  | { t: 'lost'; agent: string }
  | { t: 'checkWarn'; agent: string; spot: number }
  | { t: 'check'; agent: string; spot: number; found: boolean }
  | { t: 'catch'; agent: string; pid: string; kind: 'standard' | 'hiding'; spot?: number }
  | { t: 'downed'; pid: string }
  | { t: 'revived'; pid: string; by: string }
  | { t: 'ghost'; pid: string }
  | { t: 'gasp'; pid: string }
  | { t: 'hide'; pid: string; spot: number; enter: boolean }
  | { t: 'state'; agent: string; from: string; to: string; why: string }
  | { t: 'relocate'; agent: string }
  | { t: 'hour'; hour: number }
  | { t: 'end'; won: boolean }
  | { t: 'step'; pid: string; r: number }
  | { t: 'breaker'; index: number; on: boolean }
  | { t: 'master'; result: 'on' | 'trip' | 'drop' | 'cooldown'; load: number }
  | { t: 'fusebox'; pid: string; index: number; blown: number; hasFuse: boolean }
  | { t: 'fuseFixed'; pid: string; group: number }
  | { t: 'musicbox'; level: number }
  | { t: 'musicEmpty' }
  | { t: 'pickup'; pid: string; item: number; type: string }
  | { t: 'drop'; pid: string; item: number }
  | { t: 'battery'; pid: string }
  | { t: 'cupcake'; pid: string; plate: number; placed: number }
  | { t: 'cupcakesDone' }
  | { t: 'frontUnlocked' }
  | { t: 'exit'; pid: string }
  | { t: 'powerOut' }
  | { t: 'clatter'; agent: string; x: number; y: number; z: number }
  | { t: 'cove'; stage: number }
  | { t: 'foxyRun'; agent: string }
  | { t: 'foxyBack'; agent: string; why: string }
  | { t: 'foxyKnock'; door: number; drain: number }
  | { t: 'laugh'; agent: string; x: number; y: number; z: number }
  | { t: 'puppetOut' }
  | { t: 'puppetBack' }
  | { t: 'toreador'; x: number; y: number; z: number }
  | { t: 'songEnd' }
  | { t: 'golden'; pid: string; phase: 'poster' | 'appear' | 'gone' | 'scream'; x?: number; z?: number }
  | { t: 'phone'; state: 'ringing' | 'missed' }
  | { t: 'call'; night: number; by: string }
  | { t: 'seat'; pid: string; on: boolean }
  | { t: 'office'; what: string; lights: { L: boolean; R: boolean }; monitor: boolean }
  | { t: 'lure'; x: number; y: number; z: number }
  | { t: 'tablet'; pid: string; up: boolean };

export interface FrSimOptions {
  seed: number;
  night: number;
  mode: FrMode;
  fast?: boolean;
  /** Override the night's roster (id -> aggression). */
  aggression?: Record<string, number>;
  /** Players expected at start (for scaling); defaults to the number added before the first tick. */
  playerCount?: number;
  /** Seconds of spawn protection (defaults to the config by night). */
  spawnProtection?: number;
  /** Multiplies Golden Freddy's odds (tests and Custom Night). */
  goldenBoost?: number;
}

export const IDLE_CMD: FrCmd = { fwd: 0, strafe: 0, yaw: 0, pitch: 0, sprint: false, stance: 0, jump: false, flash: true, breath: false };

let sharedNav: NavGrid | null = null;

export class FrSim {
  readonly level: Level;
  readonly world: CollisionWorld;
  readonly nav: NavGrid;
  readonly rng: Rng;
  readonly opts: FrSimOptions;
  readonly players = new Map<string, FrPlayer>();
  readonly agents: Agent[] = [];
  readonly doorTarget: Float32Array;
  readonly power = { main: false, circuits: new Set<CircuitId>(['always']) };
  readonly night: NightState;
  readonly office: OfficeState;
  /** Events produced during the last tick. */
  events: FrEvent[] = [];
  /** Noise heard this tick (also included in events). */
  noises: { x: number; y: number; z: number; r: number; pid?: string }[] = [];
  time = 0;
  tickN = 0;
  hour = 0;
  over: { won: boolean } | null = null;
  /** Foxy's knocks tonight (each drains more). */
  knocks = 0;
  private powerOutAt = -1;
  readonly dt = 1 / FR.TICK_HZ;
  readonly hourSeconds: number;
  private started = false;

  constructor(opts: FrSimOptions) {
    this.opts = opts;
    this.level = getLevel();
    this.world = new CollisionWorld(this.level);
    // The walk grid is pure data derived from the static level, so every sim in a process shares it.
    if (!sharedNav) sharedNav = new NavGrid(this.level, new CollisionWorld(this.level));
    this.nav = sharedNav;
    this.rng = createRng(opts.seed);
    this.hourSeconds = opts.fast ? FR.nights.FAST_HOUR_SECONDS : FR.nights.HOUR_SECONDS;
    this.doorTarget = Float32Array.from(this.world.doorOpen);
    if (opts.mode === 'day') {
      this.power.main = true;
      for (const r of this.level.rooms) this.power.circuits.add(r.circuit);
    }
    this.night = new NightState(this, opts.mode === 'night');
    this.office = new OfficeState(this);
  }

  // ---- Setup -------------------------------------------------------------------------------------

  addPlayer(id: string, name: string): FrPlayer {
    const idx = this.players.size % this.level.spawns.length;
    const s = this.level.spawns[idx];
    const p: FrPlayer = {
      id,
      name,
      body: newBody(s.x, s.z, s.y, s.yaw),
      flashOn: this.opts.mode !== 'day',
      battery: 100,
      hidden: null,
      breath: FR.player.BREATH_HOLD,
      holdingBreath: false,
      downed: false,
      bleed: 0,
      revives: 0,
      ghost: false,
      catches: 0,
      reviveProgress: 0,
      revivedBy: null,
      noise: 0,
      lastTell: -100,
      cmd: { ...IDLE_CMD, yaw: s.yaw },
      hiddenFor: 0,
      useProgress: 0,
      useTarget: null,
      exited: false,
      golden: { phase: 0, yaw0: 0, x: 0, y: 0, z: 0, t: 0, stare: 0, seenPoster: false, count: 0 },
      seated: false,
      viewCam: null,
      tabletUp: false,
      padBattery: 100,
    };
    this.players.set(id, p);
    return p;
  }

  removePlayer(id: string): void {
    this.players.delete(id);
  }

  setCmd(id: string, cmd: FrCmd): void {
    const p = this.players.get(id);
    if (!p) return;
    // Acts are edge-triggered: keep an unconsumed act if a newer command arrives without one.
    const pending = p.cmd.act;
    p.cmd = { ...cmd, act: cmd.act ?? pending };
  }

  private start(): void {
    this.started = true;
    if (this.opts.mode !== 'night') return;
    const n = Math.max(1, Math.min(6, this.opts.night));
    const roster = this.opts.aggression ?? FR.nights.AGGRESSION[n] ?? {};
    const count = this.opts.playerCount ?? Math.max(1, this.players.size);
    const scale = FR.scaling.AGGRESSION[Math.min(4, count)] ?? 1;
    const protection = this.opts.spawnProtection ?? (n === 1 ? FR.ai.SPAWN_PROTECTION_N1 : FR.ai.SPAWN_PROTECTION);
    for (const id of ['freddy', 'bonnie', 'chica', 'foxy']) {
      const a = roster[id];
      // Freddy always stands on the stage; inactive (aggression 0) he just watches.
      if (a === undefined && id !== 'freddy') continue;
      this.agents.push(makeAgent(this, id, (a ?? 0) * scale, protection));
    }
    // The Puppet sleeps in the gift box from Night 3 (or whenever the roster names it).
    if (n >= 3 || roster.puppet !== undefined) this.agents.push(makeAgent(this, 'puppet', 10, 0));
  }

  // ---- Queries -----------------------------------------------------------------------------------

  circuitOn(c: CircuitId): boolean {
    if (c === 'always') return true;
    if (c === 'breaker') return this.power.main;
    if (c === 'office') return this.power.main && this.night.groupLive('office');
    return this.power.main && this.power.circuits.has(c) && this.night.groupLive(c);
  }

  roomAt(x: number, y: number, z: number): string | null {
    return this.nav.roomAt(x, y, z);
  }

  /** Is the zone at this point lit? */
  litAt(x: number, y: number, z: number): boolean {
    if (this.office.lightsCorner(x, z)) return true;
    const r = this.roomAt(x, y + 0.3, z);
    if (!r) return false;
    return this.circuitOn(this.level.roomById[r].circuit);
  }

  alive(p: FrPlayer): boolean {
    return !p.ghost && !p.downed && !p.exited;
  }

  /** Can this living player currently see the point (frustum, range, occlusion, light)? */
  playerSees(p: FrPlayer, x: number, y: number, z: number, glowing = false): boolean {
    if (!this.alive(p) || p.hidden) return false;
    // Watching a camera counts as looking (and you can't see the room you're in while you do).
    if (p.viewCam) {
      const cam = camera(p.viewCam);
      return cam ? cameraSees(this, cam, x, y, z) : false;
    }
    const b = p.body;
    const ex = b.x;
    const ey = b.y + eyeHeight(b);
    const ez = b.z;
    const dx = x - ex;
    const dy = y - ey;
    const dz = z - ez;
    const d = Math.hypot(dx, dy, dz);
    if (d > FR.ai.PLAYER_VIEW_RANGE) return false;
    const fx = -Math.sin(b.yaw);
    const fz = -Math.cos(b.yaw);
    const flat = Math.hypot(dx, dz) || 1;
    const cosH = (dx * fx + dz * fz) / flat;
    if (cosH < Math.cos(((FR.ai.PLAYER_FOV_H / 2) * Math.PI) / 180)) return false;
    // Light: lit zone, or inside the flashlight cone, or glowing eyes close by.
    const lit = this.litAt(x, y - 1, z) || (p.flashOn && p.battery > 0 && d < FR.flashlight.RANGE && cosH > Math.cos(((FR.flashlight.CONE / 2 + 4) * Math.PI) / 180)) || (glowing && d < FR.ai.EYES_VISIBLE_DARK);
    if (!lit) return false;
    return this.world.clearLine(ex, ey, ez, x, y, z);
  }

  spotOccupants(spot: number): FrPlayer[] {
    const out: FrPlayer[] = [];
    for (const p of this.players.values()) if (p.hidden && p.hidden.spot === spot && p.hidden.phase !== 'exit') out.push(p);
    return out;
  }

  emit(e: FrEvent): void {
    this.events.push(e);
  }

  noise(x: number, y: number, z: number, r: number, pid?: string): void {
    this.noises.push({ x, y, z, r, pid });
    this.events.push({ t: 'noise', x, y, z, r, pid });
    if (pid) {
      const p = this.players.get(pid);
      if (p) p.noise = Math.max(p.noise, r);
    }
  }

  setDoor(id: number, open: boolean, by: string): void {
    const d = this.level.doors[id];
    if (!d) return;
    const was = this.doorTarget[id] > 0.5;
    if (was === open) return;
    this.doorTarget[id] = open ? 1 : 0;
    this.emit({ t: 'door', id, open, by });
    const mx = d.axis === 'z' ? (d.from + d.to) / 2 : d.line;
    const mz = d.axis === 'z' ? d.line : (d.from + d.to) / 2;
    this.noise(mx, d.floorY + 1, mz, open ? FR.noise.DOOR_OPEN : FR.noise.DOOR_SLAM, by.startsWith('agent:') ? undefined : by);
  }

  // ---- Tick --------------------------------------------------------------------------------------

  tick(): FrEvent[] {
    if (!this.started) this.start();
    this.events = [];
    this.noises = [];
    if (this.over) return this.events;
    const dt = this.dt;
    this.time += dt;
    this.tickN++;

    this.tickDoors(dt);
    this.night.tick(dt);
    this.office.tick(dt);
    for (const p of this.players.values()) this.tickPlayer(p, dt);
    this.tickPowerOut();
    for (const a of this.agents) tickAgent(this, a, dt);
    this.tickClock();
    return this.events;
  }

  private tickDoors(dt: number): void {
    for (let i = 0; i < this.doorTarget.length; i++) {
      const cur = this.world.doorOpen[i];
      const tgt = this.doorTarget[i];
      if (cur === tgt) continue;
      const d = this.level.doors[i];
      // Shutters lose power: they spring open and jam.
      const rate = d.kind === 'shutter' ? (tgt > cur ? 1 / 1.5 : 1 / 1.2) : d.kind === 'roller' ? 0.5 : 2.4;
      // A shutter won't close on a player standing under it.
      if (d.kind === 'shutter' && tgt < cur && this.anyoneInDoorway(i)) continue;
      const nextOpen = cur + Math.sign(tgt - cur) * Math.min(Math.abs(tgt - cur), rate * dt);
      // A hinged door stops against a guard in its swing rather than pushing them (possibly into a wall).
      if (d.kind !== 'shutter' && d.kind !== 'roller' && d.kind !== 'curtain' && this.anyoneInSwing(i, nextOpen)) continue;
      this.world.doorOpen[i] = nextOpen;
    }
  }

  anyoneInSwing(id: number, open: number): boolean {
    for (const p of this.players.values()) {
      if (p.ghost || p.hidden || p.exited) continue;
      const b = p.body;
      if (this.world.doorWouldHit(id, open, b.x, b.y, b.z, FR.player.RADIUS - 0.02, b.height)) return true;
    }
    return false;
  }

  anyoneInDoorway(id: number): boolean {
    const d = this.level.doors[id];
    for (const p of this.players.values()) {
      if (p.ghost || p.hidden) continue;
      const along = d.axis === 'z' ? p.body.x : p.body.z;
      const across = d.axis === 'z' ? p.body.z : p.body.x;
      if (along > d.from - 0.3 && along < d.to + 0.3 && Math.abs(across - d.line) < 0.45 && Math.abs(p.body.y - d.floorY) < 1) return true;
    }
    return false;
  }

  private tickPlayer(p: FrPlayer, dt: number): void {
    p.noise = 0;
    const c = p.cmd;
    const act = c.act;
    p.cmd = { ...c, act: undefined, jump: false };
    p.flashOn = c.flash && !p.downed;
    if (p.flashOn && this.opts.mode === 'night') p.battery = Math.max(0, p.battery - (FR.flashlight.DRAIN * dt) / 3);
    if (p.exited) return;
    if (p.ghost) {
      this.moveGhost(p, c, dt);
      return;
    }
    if (p.downed) {
      p.bleed -= dt;
      if (p.reviveProgress > 0 && !this.reviverHolding(p)) p.reviveProgress = 0;
      if (p.bleed <= 0) this.toGhost(p);
      else {
        // Downed players crawl slowly.
        const slow: FrInput = { ...c, fwd: c.fwd * 0.43, strafe: c.strafe * 0.43, sprint: false, stance: 2, jump: false };
        p.body.forcedCrawl = true;
        stepBody(p.body, slow, dt, this.world);
      }
      return;
    }
    p.body.forcedCrawl = false;
    if (act) this.handleAct(p, act);
    if (p.hidden) {
      this.tickHidden(p, c, dt);
      return;
    }
    if (p.tabletUp) {
      p.padBattery = Math.max(0, p.padBattery - 2 * dt);
      if (p.padBattery <= 0 || !this.night.has(p, 'fazpad')) this.setTablet(p, false);
    }
    if (p.seated) {
      p.body.yaw = c.yaw;
      p.body.pitch = c.pitch;
      p.body.speed = 0;
      if (c.use) this.night.hold(p, c.use, dt);
      return;
    }
    // Hands on a tablet: no running, no jumping.
    const ev = stepBody(p.body, p.tabletUp ? { ...c, sprint: false, jump: false } : c, dt, this.world);
    for (const e of ev) {
      this.noise(p.body.x, p.body.y, p.body.z, e.radius, p.id);
      if (e.type === 'step') this.emit({ t: 'step', pid: p.id, r: e.radius });
    }
    // Breath refills while not hidden.
    p.breath = Math.min(FR.player.BREATH_HOLD, p.breath + (FR.player.BREATH_HOLD / FR.player.BREATH_REFILL) * dt);
    p.holdingBreath = false;
    // Revive: holding E near a downed teammate.
    if (c.hold) this.tickRevive(p, dt);
    this.tickGolden(p, dt);
    // Held interactions.
    if (c.use) {
      if (p.useTarget !== c.use) p.useProgress = 0;
      p.useTarget = c.use;
      if (this.night.hold(p, c.use, dt) < 0) p.useProgress = 0;
    } else {
      p.useTarget = null;
      p.useProgress = 0;
    }
  }

  private moveGhost(p: FrPlayer, c: FrCmd, dt: number): void {
    const saved = Float32Array.from(this.world.doorOpen);
    this.world.doorOpen.fill(1);
    p.body.forcedCrawl = false;
    stepBody(p.body, { ...c, jump: false }, dt, this.world);
    this.world.doorOpen.set(saved);
  }

  private reviverHolding(target: FrPlayer): boolean {
    for (const q of this.players.values()) {
      if (q === target || !this.alive(q) || q.hidden || !q.cmd.hold) continue;
      if (Math.hypot(q.body.x - target.body.x, q.body.z - target.body.z) <= 1.6) return true;
    }
    return false;
  }

  private tickRevive(p: FrPlayer, dt: number): void {
    for (const q of this.players.values()) {
      if (q === p || !q.downed) continue;
      if (Math.hypot(q.body.x - p.body.x, q.body.z - p.body.z) > 1.6) continue;
      q.reviveProgress += dt;
      if (q.reviveProgress >= FR.player.REVIVE_TIME) {
        q.downed = false;
        q.reviveProgress = 0;
        q.revives++;
        q.body.stamina = 50;
        q.body.forcedCrawl = false;
        this.emit({ t: 'revived', pid: q.id, by: p.id });
      }
      return;
    }
  }

  private tickHidden(p: FrPlayer, c: FrCmd, dt: number): void {
    const h = p.hidden as HiddenState;
    const spot = this.level.hidingSpots[h.spot];
    p.body.yaw = c.yaw;
    p.body.pitch = c.pitch;
    p.hiddenFor += dt;
    h.t -= dt;
    if (h.phase === 'enter' && h.t <= 0) h.phase = 'in';
    if (h.phase === 'exit' && h.t <= 0) {
      const ex = spot.exits[h.exit] ?? spot.exits[0];
      const fy = this.level.roomById[spot.room].floorY;
      Object.assign(p.body, { x: ex.x, z: ex.z, y: fy, vy: 0, grounded: true });
      p.hidden = null;
      p.hiddenFor = 0;
      this.emit({ t: 'hide', pid: p.id, spot: spot.id, enter: false });
      return;
    }
    // Breath: hold to go silent; run out and you gasp.
    if (c.breath && p.breath > 0) {
      p.holdingBreath = true;
      p.breath -= dt;
      if (p.breath <= 0) {
        p.breath = 0;
        p.holdingBreath = false;
        this.emit({ t: 'gasp', pid: p.id });
        this.noise(spot.x, spot.y, spot.z, FR.noise.GASP, p.id);
      }
    } else {
      p.holdingBreath = false;
      p.breath = Math.min(FR.player.BREATH_HOLD, p.breath + (FR.player.BREATH_HOLD / FR.player.BREATH_REFILL) * dt);
    }
    p.body.stamina = Math.min(100, p.body.stamina + FR.player.STAMINA_REGEN_HIDDEN * dt);
  }

  private handleAct(p: FrPlayer, act: FrAct): void {
    const b = p.body;
    const reach = FR.player.INTERACT_RANGE + 1.0;
    if (act.type === 'unhide') {
      if (p.hidden && p.hidden.phase !== 'exit') {
        const spot = this.level.hidingSpots[p.hidden.spot];
        p.hidden = { ...p.hidden, phase: 'exit', t: 0.5, exit: Math.max(0, Math.min(spot.exits.length - 1, act.exit)) };
      }
      return;
    }
    if (p.hidden) return;
    if (act.type === 'pickup') {
      this.night.pickup(p, act.id);
      return;
    }
    if (act.type === 'stand') {
      if (p.seated) this.office.stand(p);
      return;
    }
    if (act.type === 'office') {
      this.office.press(p, act.what);
      return;
    }
    if (act.type === 'tablet') {
      this.setTablet(p, act.up);
      return;
    }
    if (act.type === 'cam') {
      if ((p.tabletUp || (p.seated && this.office.monitorUp)) && camera(act.id)) p.viewCam = act.id;
      return;
    }
    if (p.seated) return;
    if (act.type === 'battery') {
      this.night.useBattery(p);
      return;
    }
    if (act.type === 'drop') {
      this.night.drop(p);
      return;
    }
    if (act.type === 'hide') {
      const spot = this.level.hidingSpots[act.id];
      if (!spot) return;
      const fy = this.level.roomById[spot.room].floorY;
      if (Math.abs(b.y - fy) > 1.2 || Math.hypot(spot.x - b.x, spot.z - b.z) > 2.0) return;
      if (this.spotOccupants(spot.id).length >= spot.capacity) return;
      p.hidden = { spot: spot.id, phase: 'enter', t: spot.enterTime, exit: 0 };
      p.hiddenFor = 0;
      this.emit({ t: 'hide', pid: p.id, spot: spot.id, enter: true });
      // Anyone watching remembers which spot you went into.
      for (const a of this.agents) if ((a.detect[p.id] ?? 0) >= FR.ai.NOTICE_THRESHOLD && a.canSee[p.id]) sawHiding(this, a, p.id, spot.id);
      return;
    }
    if (act.type === 'door') {
      const d = this.level.doors[act.id];
      if (!d) return;
      const mx = d.axis === 'z' ? (d.from + d.to) / 2 : d.line;
      const mz = d.axis === 'z' ? d.line : (d.from + d.to) / 2;
      if (Math.hypot(mx - b.x, mz - b.z) > reach + (d.to - d.from) / 2 || Math.abs(b.y - d.floorY) > 1.5) return;
      if (!this.world.canReach(b.x, b.y + eyeHeight(b), b.z, mx, d.floorY + 1.0, mz, d.id)) return;
      if (d.locked) {
        this.emit({ t: 'locked', pid: p.id, door: d.id, text: d.locked });
        return;
      }
      if (d.kind === 'shutter' && d.circuit && !this.circuitOn(d.circuit)) {
        this.emit({ t: 'nopower', pid: p.id, text: 'No power. The shutter motor is dead.' });
        return;
      }
      this.setDoor(d.id, this.doorTarget[d.id] < 0.5, p.id);
      return;
    }
    if (act.type === 'item') {
      const it = this.level.interactables.find((i) => i.id === act.id);
      if (!it || Math.hypot(it.x - b.x, it.z - b.z) > reach || Math.abs(it.y - (b.y + 1.2)) > 2) return;
      // No pressing a switch, breaker or plate through a wall: the server checks the line, not just the range.
      if (!this.world.canReach(b.x, b.y + eyeHeight(b), b.z, it.x, it.y, it.z)) return;
      if (it.type === 'officeChair') return this.office.sit(p);
      if (it.type === 'phone') return this.office.answer(p);
      if (it.type === 'boothDesk') return this.office.lure(p);
      if (this.night.press(p, it.id)) return;
      if (it.type === 'zoneSwitch' && it.circuit) {
        const err = this.night.zoneSwitch(it.circuit);
        if (err) {
          this.emit({ t: 'nopower', pid: p.id, text: err });
          return;
        }
        const on = !this.power.circuits.has(it.circuit);
        if (on) this.power.circuits.add(it.circuit);
        else this.power.circuits.delete(it.circuit);
        this.emit({ t: 'switch', circuit: it.circuit, on, pid: p.id });
      } else if (it.type === 'honk') {
        this.emit({ t: 'honk', x: it.x, y: it.y, z: it.z });
        this.noise(it.x, it.y, it.z, 4, p.id);
      }
    }
  }

  /**
   * Golden Freddy (Part 6.6): a rare roll when a player looks at the West Corner poster (or sits alone in
   * Old Storage). Next time they turn around, he's slumped two metres in front of them. Stare for three
   * seconds and he takes them out of the night; look away and he's gone; do nothing and he fades.
   */
  private tickGolden(p: FrPlayer, dt: number): void {
    const n = Math.min(7, this.opts.night);
    const odds = this.opts.mode === 'night' ? (FR.ai.GOLDEN_ODDS[n] ?? 0) * (this.opts.goldenBoost ?? 1) : 0;
    const g = p.golden;
    if (!odds || p.hidden) return;
    if (g.phase === 0) {
      if (g.count >= FR.ai.GOLDEN_MAX) return;
      const sees = this.playerSees(p, GOLDEN_POSTER.x, GOLDEN_POSTER.y, GOLDEN_POSTER.z);
      let roll = sees && !g.seenPoster;
      g.seenPoster = sees;
      const alone = n >= 3 && this.roomAt(p.body.x, p.body.y + 0.3, p.body.z) === 'bOld' && [...this.players.values()].every((q) => q === p || this.roomAt(q.body.x, q.body.y + 0.3, q.body.z) !== 'bOld');
      if (alone && this.tickN % (FR.TICK_HZ * 10) === 0) roll = true;
      if (roll && this.rand() < odds) {
        g.phase = 1;
        g.yaw0 = p.body.yaw;
        this.emit({ t: 'golden', pid: p.id, phase: 'poster' });
      }
      return;
    }
    if (g.phase === 1) {
      let d = p.body.yaw - g.yaw0;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      if (Math.abs(d) < (120 * Math.PI) / 180) return;
      const fx = -Math.sin(p.body.yaw);
      const fz = -Math.cos(p.body.yaw);
      const ey = p.body.y + eyeHeight(p.body);
      // Two metres in front if there's room in plain view, otherwise as close as fits.
      const dist = [2, 1.6, 1.2].find((d) => {
        const x = p.body.x + fx * d;
        const z = p.body.z + fz * d;
        return !this.world.blocked(x, p.body.y, z, 0.3, 1.0, 0.35) && this.world.clearLine(p.body.x, ey, p.body.z, x, p.body.y + 0.7, z);
      });
      if (dist === undefined) return;
      const x = p.body.x + fx * dist;
      const z = p.body.z + fz * dist;
      Object.assign(g, { phase: 2, x, y: p.body.y, z, t: 0, stare: 0 });
      g.count++;
      p.lastTell = this.time;
      this.emit({ t: 'golden', pid: p.id, phase: 'appear', x, z });
      return;
    }
    g.t += dt;
    const seen = this.playerSees(p, g.x, g.y + 0.7, g.z, true);
    if (seen) g.stare += dt;
    else if (g.stare > 0.15) {
      g.phase = 0;
      this.emit({ t: 'golden', pid: p.id, phase: 'gone' });
      return;
    }
    if (g.stare >= FR.ai.GOLDEN_WINDOW) {
      g.phase = 0;
      this.emit({ t: 'golden', pid: p.id, phase: 'scream' });
      this.catchPlayer(p, 'golden', 'standard', undefined, true);
      return;
    }
    if (g.t >= FR.ai.GOLDEN_VANISH) {
      g.phase = 0;
      this.emit({ t: 'golden', pid: p.id, phase: 'gone' });
    }
  }

  /** Power-Out Freddy arrives a few seconds into a blackout and leaves when the power comes back. */
  private tickPowerOut(): void {
    const out = this.night.powerOut;
    const po = this.agents.findIndex((a) => a.id === 'powerout');
    if (!out) {
      this.powerOutAt = -1;
      if (po >= 0) {
        this.agents.splice(po, 1);
        this.emit({ t: 'laugh', agent: 'powerout', x: 0, y: 0, z: 0 });
      }
      return;
    }
    if (this.powerOutAt < 0) this.powerOutAt = this.time + FR.ai.POWEROUT_DELAY[0] + this.rand() * (FR.ai.POWEROUT_DELAY[1] - FR.ai.POWEROUT_DELAY[0]);
    if (po < 0 && this.time >= this.powerOutAt) {
      const a = spawnPowerOut(this);
      if (a) this.agents.push(a);
      else this.powerOutAt = this.time + 1;
    }
  }

  /** An animatronic got a player. `fatal` skips the downed state (the Puppet, Golden Freddy). */
  catchPlayer(p: FrPlayer, agent: string, kind: 'standard' | 'hiding', spot?: number, fatal = false): void {
    if (!this.alive(p)) return;
    this.emit({ t: 'catch', agent, pid: p.id, kind, spot });
    p.hidden = null;
    p.catches++;
    if (fatal) {
      p.revives = FR.player.MAX_REVIVES;
      this.toGhost(p);
      return;
    }
    const solo = (this.opts.playerCount ?? this.players.size) <= 1;
    if (p.revives >= FR.player.MAX_REVIVES || (solo && p.catches >= 2)) {
      this.toGhost(p);
      return;
    }
    p.downed = true;
    // Solo players get one free get-up (Part 5.14): a short downed state that ends on its own.
    p.bleed = solo ? 5 : FR.player.BLEED_OUT;
    p.reviveProgress = 0;
    this.emit({ t: 'downed', pid: p.id });
    if (solo) p.revives++;
  }

  setTablet(p: FrPlayer, up: boolean): void {
    if (up && (!this.night.has(p, 'fazpad') || p.padBattery <= 0 || p.seated)) return;
    if (p.tabletUp === up) return;
    p.tabletUp = up;
    p.viewCam = up ? (p.viewCam ?? '1C') : null;
    this.emit({ t: 'tablet', pid: p.id, up });
  }

  /** Walked out through the unlocked front doors: safe, and paid a bonus. */
  exitPlayer(p: FrPlayer): void {
    if (p.exited || !this.alive(p)) return;
    p.exited = true;
    p.hidden = null;
    this.night.dropAll(p);
    this.emit({ t: 'exit', pid: p.id });
  }

  private toGhost(p: FrPlayer): void {
    const solo = (this.opts.playerCount ?? this.players.size) <= 1;
    if (solo && p.downed && p.catches < 2 && p.revives < FR.player.MAX_REVIVES) {
      // The free get-up.
      p.downed = false;
      p.body.forcedCrawl = false;
      p.body.stamina = 50;
      this.emit({ t: 'revived', pid: p.id, by: p.id });
      return;
    }
    p.downed = false;
    p.ghost = true;
    p.hidden = null;
    this.night.dropAll(p);
    this.emit({ t: 'ghost', pid: p.id });
  }

  /** Test hooks: stop the night clock (hours and the 6 AM end) so long network tests can finish. */
  clockHeld = false;

  private tickClock(): void {
    if (this.clockHeld) return;
    const h = Math.floor(this.time / this.hourSeconds);
    if (h !== this.hour) {
      this.hour = h;
      this.emit({ t: 'hour', hour: h });
      const bump = FR.nights.HOURLY[h];
      if (bump) for (const a of this.agents) a.aggression = Math.min(20, a.aggression + (bump[a.id] ?? 0));
    }
    if (this.opts.mode === 'night') {
      const all = [...this.players.values()];
      if (this.hour >= FR.HOURS_PER_NIGHT) this.end(all.some((p) => !p.ghost));
      else if (all.length && all.every((p) => p.ghost || p.exited)) this.end(all.some((p) => p.exited));
    }
  }

  private end(won: boolean): void {
    if (this.over) return;
    this.over = { won };
    this.emit({ t: 'end', won });
  }

  rand(): number {
    return next(this.rng);
  }

  spot(id: number): HidingSpotDef {
    return this.level.hidingSpots[id];
  }
}

export type { Stance };
