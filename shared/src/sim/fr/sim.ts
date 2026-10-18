import { FR } from '../../frConfig';
import { createRng, next, type Rng } from '../../rng';
import { getLevel } from '../../world/build';
import type { CircuitId, HidingSpotDef, Level } from '../../world/types';
import { CollisionWorld } from './collision';
import { eyeHeight, newBody, stepBody, type Body, type FrInput, type Stance } from './controller';
import { NavGrid } from './nav';
import { Agent, makeAgent, sawHiding, tickAgent } from './ai';

// The free-roam simulation. Deterministic given a seed and the input log; runs headless in Node (server,
// tests, balance script) and in the browser (solo play). It owns players, doors, power, noise, the clock
// and the animatronics. Renderers only read it.

export type FrMode = 'day' | 'night';

export type FrAct =
  | { type: 'door'; id: number }
  | { type: 'item'; id: string }
  | { type: 'hide'; id: number }
  | { type: 'unhide'; exit: number }
  | { type: 'revive'; pid: string };

export interface FrCmd extends FrInput {
  flash: boolean;
  breath: boolean;
  act?: FrAct;
  /** Held interaction (revive) is still being held. */
  hold?: boolean;
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
}

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
  | { t: 'step'; pid: string; r: number };

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
  /** Events produced during the last tick. */
  events: FrEvent[] = [];
  /** Noise heard this tick (also included in events). */
  noises: { x: number; y: number; z: number; r: number; pid?: string }[] = [];
  time = 0;
  tickN = 0;
  hour = 0;
  over: { won: boolean } | null = null;
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
    for (const [id, a] of Object.entries(roster)) {
      if (id !== 'bonnie') continue; // Milestone 5 ships Bonnie; the rest of the cast follows.
      this.agents.push(makeAgent(this, id, a * scale, protection));
    }
  }

  // ---- Queries -----------------------------------------------------------------------------------

  circuitOn(c: CircuitId): boolean {
    if (c === 'always') return true;
    if (c === 'breaker') return this.power.main;
    return this.power.main && this.power.circuits.has(c);
  }

  roomAt(x: number, y: number, z: number): string | null {
    return this.nav.roomAt(x, y, z);
  }

  /** Is the zone at this point lit? */
  litAt(x: number, y: number, z: number): boolean {
    const r = this.roomAt(x, y + 0.3, z);
    if (!r) return false;
    return this.circuitOn(this.level.roomById[r].circuit);
  }

  alive(p: FrPlayer): boolean {
    return !p.ghost && !p.downed;
  }

  /** Can this living player currently see the point (frustum, range, occlusion, light)? */
  playerSees(p: FrPlayer, x: number, y: number, z: number, glowing = false): boolean {
    if (!this.alive(p) || p.hidden) return false;
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
    for (const p of this.players.values()) this.tickPlayer(p, dt);
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
      this.world.doorOpen[i] = cur + Math.sign(tgt - cur) * Math.min(Math.abs(tgt - cur), rate * dt);
    }
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
    const ev = stepBody(p.body, c, dt, this.world);
    for (const e of ev) {
      this.noise(p.body.x, p.body.y, p.body.z, e.radius, p.id);
      if (e.type === 'step') this.emit({ t: 'step', pid: p.id, r: e.radius });
    }
    // Breath refills while not hidden.
    p.breath = Math.min(FR.player.BREATH_HOLD, p.breath + (FR.player.BREATH_HOLD / FR.player.BREATH_REFILL) * dt);
    p.holdingBreath = false;
    // Revive: holding E near a downed teammate.
    if (c.hold) this.tickRevive(p, dt);
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
      if (it.type === 'mainBreaker') {
        this.power.main = !this.power.main;
        this.emit({ t: 'power', main: this.power.main });
        this.noise(it.x, it.y, it.z, this.power.main ? 12 : FR.noise.BREAKER_TRIP, p.id);
      } else if (it.type === 'zoneSwitch' && it.circuit) {
        if (!this.power.main) {
          this.emit({ t: 'nopower', pid: p.id, text: 'Nothing happens. The main breaker is off.' });
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

  /** An animatronic got a player. */
  catchPlayer(p: FrPlayer, agent: string, kind: 'standard' | 'hiding', spot?: number): void {
    if (!this.alive(p)) return;
    this.emit({ t: 'catch', agent, pid: p.id, kind, spot });
    p.hidden = null;
    p.catches++;
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

  private toGhost(p: FrPlayer): void {
    const solo = (this.opts.playerCount ?? this.players.size) <= 1;
    if (solo && p.downed && p.catches < 2) {
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
    this.emit({ t: 'ghost', pid: p.id });
  }

  private tickClock(): void {
    const h = Math.floor(this.time / this.hourSeconds);
    if (h !== this.hour) {
      this.hour = h;
      this.emit({ t: 'hour', hour: h });
      const bump = FR.nights.HOURLY[h];
      if (bump) for (const a of this.agents) a.aggression = Math.min(20, a.aggression + (bump[a.id] ?? 0));
    }
    if (this.opts.mode === 'night') {
      if (this.hour >= FR.HOURS_PER_NIGHT) this.end(true);
      else if (this.players.size && [...this.players.values()].every((p) => p.ghost)) this.end(false);
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
