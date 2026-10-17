import {
  CALLS,
  CLASSIC_CALLS,
  CONFIG,
  botTick,
  createBot,
  createWorld,
  eventsFor,
  scoreMatch,
  step,
  viewFor,
  type Bot,
  type CustomSettings,
  type InputMsg,
  type Mode,
  type PlayerInput,
  type SimEvent,
  type StationId,
  type World,
} from '@fnaf/shared';

export interface MatchPlayer {
  pid: string;
  name: string;
  station: StationId | null;
  role: 'guard' | 'puppeteer';
  isHost: boolean;
  isBot: boolean;
}

export interface MatchOptions {
  seed: number;
  mode: Mode;
  night: number;
  hourSeconds: number;
  players: MatchPlayer[];
  custom?: CustomSettings;
  /** Milliseconds of intro before the clock starts. */
  introMs: number;
  send(pid: string, event: string, payload: unknown): void;
  onEnd(world: World): void;
  log?: (msg: string, data?: unknown) => void;
}

interface Client {
  lastView: string;
  lastSentTick: number;
  lastSeq: number;
  inputTimes: number[];
}

/** Owns one World and runs its fixed 20 Hz loop. */
export class Match {
  readonly world: World;
  readonly startedAt = new Date();
  private queue: PlayerInput[] = [];
  private timer: NodeJS.Timeout | null = null;
  private clients = new Map<string, Client>();
  private bots: Bot[] = [];
  private lastEvents: SimEvent[] = [];
  private nextTickAt = 0;
  ended = false;

  constructor(private readonly o: MatchOptions) {
    this.world = createWorld({
      seed: o.seed,
      mode: o.mode,
      night: o.night,
      hourSeconds: o.hourSeconds,
      players: o.players.map((p) => ({ id: p.pid, name: p.name, station: p.station, role: p.role, isHost: p.isHost, isBot: p.isBot })),
      custom: o.custom,
    });
    for (const p of o.players) {
      if (p.isBot) this.bots.push(createBot(p.pid, 'average', o.seed + this.bots.length * 97));
      else this.clients.set(p.pid, { lastView: '', lastSentTick: -100, lastSeq: 0, inputTimes: [] });
    }
  }

  stationOf(pid: string): StationId | null {
    return this.world.players[pid]?.station ?? null;
  }

  start(): void {
    const startsAt = Date.now() + this.o.introMs;
    for (const pid of this.clients.keys()) this.sendStart(pid, startsAt);
    this.nextTickAt = startsAt;
    const loop = () => {
      if (this.ended) return;
      const now = Date.now();
      // Catch up if the event loop stalled, but never more than 5 ticks at once.
      let n = 0;
      while (now >= this.nextTickAt && n < 5 && !this.ended) {
        this.tick();
        this.nextTickAt += 1000 / CONFIG.TICK_HZ;
        n++;
      }
      if (now - this.nextTickAt > 1000) this.nextTickAt = now;
      this.timer = setTimeout(loop, Math.max(1, this.nextTickAt - Date.now()));
    };
    this.timer = setTimeout(loop, Math.max(1, startsAt - Date.now()));
  }

  sendStart(pid: string, startsAt = Date.now()): void {
    const w = this.world;
    const calls = w.mode === 'classic' ? CLASSIC_CALLS : CALLS;
    this.o.send(pid, 'night:start', {
      seed: w.seed,
      mode: w.mode,
      night: w.night,
      map: w.map.id,
      hourSeconds: w.hourTicks / CONFIG.TICK_HZ,
      you: w.players[pid]?.station ?? null,
      role: w.players[pid]?.role ?? 'guard',
      stations: Object.values(w.players).map((p) => ({ pid: p.id, name: p.name, station: p.station, role: p.role, isBot: p.isBot })),
      startsAt,
      tick: w.tick,
      call: w.call ? calls[w.call.night] : null,
      custom: w.custom,
      extended: Object.keys(w.plugins),
    });
    const c = this.clients.get(pid);
    if (c) c.lastView = '';
  }

  input(pid: string, seq: number, input: InputMsg): boolean {
    const c = this.clients.get(pid);
    if (!c) return false;
    const now = Date.now();
    c.inputTimes = c.inputTimes.filter((t) => now - t < 1000);
    if (c.inputTimes.length >= 20) return false;
    c.inputTimes.push(now);
    c.lastSeq = Math.max(c.lastSeq, seq);
    this.queue.push({ pid, seq, input: input as PlayerInput['input'] });
    return true;
  }

  system(pid: string, action: 'disconnect' | 'reconnect'): void {
    this.queue.push({ pid, seq: 0, input: { action } });
  }

  private tick(): void {
    const inputs = this.queue;
    this.queue = [];
    for (const b of this.bots) {
      const v = viewFor(this.world, b.pid);
      for (const input of botTick(b, v, eventsFor(this.lastEvents, b.pid), this.world.tick)) inputs.push({ pid: b.pid, seq: 0, input });
    }
    const events = step(this.world, inputs);
    this.lastEvents = events;
    for (const [pid, c] of this.clients) {
      const view = viewFor(this.world, pid);
      const { t: _t, drain: _d, ...rest } = view;
      const key = JSON.stringify(rest);
      const ev = eventsFor(events, pid);
      const changed = key !== c.lastView;
      if (changed || ev.length || this.world.tick - c.lastSentTick >= CONFIG.TICK_HZ || this.world.ended) {
        this.o.send(pid, 'snap', { tick: this.world.tick, ack: c.lastSeq, v: changed ? view : undefined, t: view.t, drain: view.drain, ev });
        c.lastView = key;
        c.lastSentTick = this.world.tick;
      }
    }
    if (this.world.ended) this.finish();
  }

  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    if (this.timer) clearTimeout(this.timer);
    this.o.onEnd(this.world);
  }

  stop(): void {
    this.ended = true;
    if (this.timer) clearTimeout(this.timer);
  }

  result() {
    return scoreMatch(this.world);
  }

  elapsedSeconds(): number {
    return this.world.tick / CONFIG.TICK_HZ;
  }
}
