import {
  CONFIG,
  FR,
  FrSim,
  IDLE_CMD,
  eyeHeight,
  levelChecksum,
  type FrCmd,
  type FrEvent,
  type FrSnap,
  type FrSnapAgent,
  type FrSnapPlayer,
  type FrStart,
  type MatchResult,
} from '@fnaf/shared';

export interface FrMatchPlayer {
  pid: string;
  name: string;
  isBot: boolean;
  isHost: boolean;
  equipped: Record<string, string>;
}

export interface FrMatchOptions {
  seed: number;
  night: number;
  fast: boolean;
  testHooks: boolean;
  players: FrMatchPlayer[];
  introMs: number;
  send(pid: string, event: string, payload: unknown): void;
  onEnd(): void;
}

interface Client {
  queue: { seq: number; cmd: FrCmd }[];
  ack: number;
  last: FrCmd;
  events: FrEvent[];
  inputTimes: number[];
  connected: boolean;
  /** Tick the player left the building (ghost or disconnected for good). */
  deathHour: number | null;
  killedBy: string | null;
}

const MAX_QUEUE = 8;
const SNAP_EVERY = FR.TICK_HZ / FR.SNAPSHOT_HZ;

/** One free-roam night on the server: the authoritative FrSim at 30 Hz, per-client snapshots at 20 Hz. */
export class FrMatch {
  readonly sim: FrSim;
  readonly startedAt = new Date();
  readonly kind = 'freeroam' as const;
  private clients = new Map<string, Client>();
  private timer: NodeJS.Timeout | null = null;
  private nextTickAt = 0;
  private snapAcc = 0;
  ended = false;

  constructor(private readonly o: FrMatchOptions) {
    this.sim = new FrSim({ seed: o.seed, night: o.night, mode: 'night', fast: o.fast, playerCount: o.players.length });
    for (const p of o.players) {
      this.sim.addPlayer(p.pid, p.name);
      this.clients.set(p.pid, { queue: [], ack: 0, last: { ...IDLE_CMD }, events: [], inputTimes: [], connected: true, deathHour: null, killedBy: null });
    }
  }

  start(): void {
    const startsAt = Date.now() + this.o.introMs;
    for (const pid of this.clients.keys()) this.sendStart(pid);
    this.nextTickAt = startsAt;
    const loop = () => {
      if (this.ended) return;
      const now = Date.now();
      let n = 0;
      while (now >= this.nextTickAt && n < 5 && !this.ended) {
        this.tick();
        this.nextTickAt += 1000 / FR.TICK_HZ;
        n++;
      }
      if (now - this.nextTickAt > 1000) this.nextTickAt = now;
      this.timer = setTimeout(loop, Math.max(1, this.nextTickAt - Date.now()));
    };
    this.timer = setTimeout(loop, Math.max(1, startsAt - Date.now()));
  }

  sendStart(pid: string): void {
    const start: FrStart = {
      seed: this.o.seed,
      night: this.o.night,
      you: pid,
      players: this.o.players.map((p) => ({ id: p.pid, name: p.name, equipped: p.equipped })),
      hourSeconds: this.sim.hourSeconds,
      tick: this.sim.tickN,
      testHooks: this.o.testHooks,
      loads: this.sim.night.loads,
      band: this.sim.night.band,
      plates: this.sim.night.plates,
      requiredZones: this.sim.night.requiredZones,
      layout: levelChecksum(),
    };
    this.o.send(pid, 'fr:start', start);
  }

  /** A client command. Returns false when dropped (rate limit, stale, queue full). */
  cmd(pid: string, seq: number, cmd: FrCmd): boolean {
    const c = this.clients.get(pid);
    if (!c || this.ended) return false;
    const now = Date.now();
    c.inputTimes = c.inputTimes.filter((t) => now - t < 1000);
    // 30 commands a second plus slack for jitter. More than that is a speed hack or a broken client.
    if (c.inputTimes.length >= FR.TICK_HZ + 15) return false;
    c.inputTimes.push(now);
    const lastSeq = c.queue.length ? c.queue[c.queue.length - 1].seq : c.ack;
    if (seq <= lastSeq) return false;
    if (c.queue.length >= MAX_QUEUE) c.queue.shift();
    c.queue.push({ seq, cmd });
    return true;
  }

  /** Test hook: put a player somewhere (only reachable when TEST_HOOKS=1). */
  teleport(pid: string, x: number, y: number, z: number): void {
    const p = this.sim.players.get(pid);
    if (!p) return;
    Object.assign(p.body, { x, y, z, vy: 0, grounded: true, vault: 0 });
    p.hidden = null;
  }

  system(pid: string, action: 'disconnect' | 'reconnect'): void {
    const c = this.clients.get(pid);
    if (!c) return;
    c.connected = action === 'reconnect';
    if (!c.connected) {
      c.queue = [];
      c.last = { ...IDLE_CMD, yaw: c.last.yaw, flash: false };
    }
  }

  private tick(): void {
    for (const [pid, c] of this.clients) {
      const next = c.queue.shift();
      if (next) {
        c.ack = next.seq;
        c.last = next.cmd;
        this.sim.setCmd(pid, next.cmd);
      } else {
        // No command this tick: keep doing the same thing, minus one-shot actions.
        this.sim.setCmd(pid, { ...c.last, jump: false, act: undefined });
      }
    }
    const events = this.sim.tick();
    for (const e of events) {
      if (e.t === 'catch') {
        const c = this.clients.get(e.pid);
        if (c) c.killedBy = e.agent;
      }
      if (e.t === 'ghost') {
        const c = this.clients.get(e.pid);
        if (c && c.deathHour === null) c.deathHour = this.sim.hour;
      }
    }
    for (const [pid, c] of this.clients) for (const e of events) if (this.relevant(pid, e)) c.events.push(e);
    this.snapAcc += 1;
    if (this.snapAcc >= SNAP_EVERY || this.sim.over) {
      this.snapAcc -= SNAP_EVERY;
      for (const pid of this.clients.keys()) this.sendSnap(pid);
    }
    if (this.sim.over) this.finish();
  }

  private relevant(pid: string, e: FrEvent): boolean {
    if (e.t === 'noise') return false;
    if (e.t === 'state') return this.o.testHooks;
    if (e.t === 'step') return e.pid !== pid;
    // Golden Freddy is only ever there for one player.
    if (e.t === 'golden') return e.pid === pid;
    return true;
  }

  /** Interest management: what this client is allowed to know about. */
  snapFor(pid: string): FrSnap {
    const sim = this.sim;
    const me = sim.players.get(pid);
    const c = this.clients.get(pid) as Client;
    const ev = c.events;
    c.events = [];
    const round = (v: number) => Math.round(v * 100) / 100;
    const players: FrSnapPlayer[] = [];
    for (const p of sim.players.values()) {
      if (p.id === pid) continue;
      // Ghosts are visible only to other ghosts.
      if (p.ghost && !me?.ghost) continue;
      const b = p.body;
      players.push({
        id: p.id,
        x: round(b.x),
        y: round(b.y),
        z: round(b.z),
        yaw: round(b.yaw),
        pitch: round(b.pitch),
        st: b.stance,
        h: round(b.height),
        f: p.flashOn && p.battery > 0,
        hid: p.hidden ? p.hidden.spot : -1,
        d: p.downed,
        g: p.ghost,
        sp: round(b.speed),
        rp: round(p.reviveProgress),
      });
    }
    const agents: FrSnapAgent[] = [];
    for (const a of sim.agents) {
      if (me && !me.ghost && !this.canKnowAgent(me.body.x, me.body.y + eyeHeight(me.body), me.body.z, a)) continue;
      agents.push({ id: a.id, x: round(a.x), y: round(a.y), z: round(a.z), yaw: round(a.yaw), s: a.state, a: a.anim, sp: round(a.speed), k: a.x2.stage ?? 0 });
    }
    return {
      tick: sim.tickN,
      time: round(sim.time),
      hour: sim.hour,
      ack: c.ack,
      me: me
        ? {
            body: me.body,
            battery: me.battery,
            breath: me.breath,
            hidden: me.hidden,
            downed: me.downed,
            bleed: me.bleed,
            ghost: me.ghost,
            revives: me.revives,
            reviveProgress: me.reviveProgress,
            useProgress: me.useProgress,
            exited: me.exited,
            seated: me.seated,
            viewCam: me.viewCam,
            tabletUp: me.tabletUp,
            padBattery: round(me.padBattery),
          }
        : (undefined as never),
      players,
      agents,
      doors: Array.from(sim.world.doorOpen, round),
      targets: Array.from(sim.doorTarget),
      power: { main: sim.power.main, circuits: [...sim.power.circuits] },
      night: {
        power: round(sim.night.power),
        breakers: sim.night.breakers,
        blown: [...sim.night.blown],
        cooldown: round(sim.night.masterCooldown),
        musicBox: round(sim.night.musicBox),
        musicFailed: sim.night.musicFailed,
        items: sim.night.items.map((i) => ({ ...i, x: round(i.x), y: round(i.y), z: round(i.z) })),
        frontUnlocked: sim.night.frontUnlocked,
        powerOut: sim.night.powerOut,
      },
      office: {
        seated: sim.office.seated,
        lights: sim.office.lights,
        monitorUp: sim.office.monitorUp,
        phone: sim.office.phone,
        lureCooldown: round(sim.office.lureCooldown),
      },
      ev,
      over: sim.over,
    };
  }

  /**
   * A client hears about an animatronic only within 35 m, and only if it could see it or hear it moving
   * (footsteps carry 25 m). Anything else stays server-side, so wallhacks have nothing to show.
   */
  canKnowAgent(ex: number, ey: number, ez: number, a: { x: number; y: number; z: number; speed: number; state: string }): boolean {
    // At home (on stage, in the cove, in the gift box) is public knowledge.
    if (a.state === 'DORMANT' || a.state === 'COVE') return true;
    const d = Math.hypot(a.x - ex, a.y - ey, a.z - ez);
    if (d > 35) return false;
    if (a.speed > 0.2 && d < 25) return true;
    return this.sim.world.clearLine(ex, ey, ez, a.x, a.y + 1.6, a.z) || this.sim.world.clearLine(ex, ey, ez, a.x, a.y + 0.8, a.z);
  }

  private sendSnap(pid: string): void {
    const c = this.clients.get(pid);
    if (!c?.connected) return;
    this.o.send(pid, 'fr:snap', this.snapFor(pid));
  }

  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    if (this.timer) clearTimeout(this.timer);
    this.o.onEnd();
  }

  stop(): void {
    this.ended = true;
    if (this.timer) clearTimeout(this.timer);
  }

  /** Rewards and stats in the same shape as the office game, counted as Night Shift progress. */
  result(): MatchResult {
    const R = CONFIG.rewards;
    const won = Boolean(this.sim.over?.won);
    const full = this.clients.size >= 4;
    const n = this.o.night;
    return {
      mode: 'nightshift',
      night: n,
      result: won ? 'win' : 'loss',
      hour: this.sim.hour,
      power: 100,
      seed: this.o.seed,
      presetId: null,
      players: [...this.sim.players.values()].map((p) => {
        const c = this.clients.get(p.id) as Client;
        const survived = won && !p.ghost;
        let tokens = won ? R.NIGHTSHIFT_WIN_BASE + R.NIGHTSHIFT_WIN_PER_NIGHT * Math.min(6, n) : R.LOSS_BASE + R.LOSS_PER_HOUR * this.sim.hour;
        if (won && p.ghost) tokens = Math.round(tokens / 2);
        if (p.exited) tokens = Math.round(tokens * (1 + FR.objectives.EARLY_EXIT_BONUS));
        if (full) tokens = Math.round(tokens * (1 + R.FULL_LOBBY_BONUS));
        return {
          pid: p.id,
          station: null,
          role: 'guard' as const,
          survived,
          ghost: p.ghost,
          killedBy: p.ghost ? c.killedBy : null,
          deathHour: c.deathHour,
          tokens,
          achievements: [],
          stats: { cameraChecks: 0, doorsClosed: 0, tabletSeconds: 0, powerUsed: 0, closeCalls: 0, ghostSeconds: 0 },
          presetBeaten: null,
        };
      }),
    };
  }

  elapsedSeconds(): number {
    return this.sim.time;
  }
}
