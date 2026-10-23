import { NetShaper } from './netShaper';
import type { Server, Socket } from 'socket.io';
import {
  C2S,
  CALLOUTS,
  ROOM_CODE_ALPHABET,
  DEFAULT_EQUIPPED,
  COSMETICS_BY_ID,
  type LobbyPlayer,
  type LobbyState,
  type LobbySummary,
  type StationId,
  type World,
} from '@fnaf/shared';
import type { Env } from '../env';
import type { Db } from '../db/client';
import { Match, type MatchPlayer } from './match';
import { FrMatch } from './frMatch';
import { persistMatch, type PlayerReward } from './rewards';
import { findById, highestNight, usersByIds, type UserRow } from '../services/users';
import { limits } from '../auth/ratelimit';

interface LPlayer {
  userId: string;
  name: string;
  stars: number;
  station: StationId | null;
  ready: boolean;
  connected: boolean;
  isBot: boolean;
  isGuest: boolean;
  joinedAt: number;
  equipped: Record<string, string>;
  puppeteer: boolean;
  disconnectedAt: number | null;
}

export interface Lobby {
  code: string;
  hostId: string;
  mode: LobbyState['mode'];
  night: number;
  customAi: LobbyState['customAi'];
  puppet: number;
  extended: Record<string, number>;
  options: LobbyState['options'];
  players: Map<string, LPlayer>;
  state: LobbyState['state'];
  match: Match | FrMatch | null;
  emptySince: number | null;
  hostHighest: number;
}

const MAX = 4;
const ROOM = (code: string) => `lobby:${code}`;
const USER = (id: string) => `user:${id}`;

export class LobbyManager {
  lobbies = new Map<string, Lobby>();
  private userLobby = new Map<string, string>();
  private sweepTimer: NodeJS.Timeout;
  /** Test-only per-player lag/jitter/stall shaping of free-roam traffic (fr:net, TEST_HOOKS builds). */
  private readonly shaper = new NetShaper();
  shuttingDown = false;

  constructor(
    private io: Server,
    private db: Db,
    private env: Env,
    private log: { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void; error: (o: unknown, m?: string) => void },
  ) {
    this.sweepTimer = setInterval(() => this.sweep(), 10_000);
  }

  // ---------- connection lifecycle ----------

  async onConnect(socket: Socket, user: UserRow): Promise<void> {
    socket.join(USER(user.id));
    const code = this.userLobby.get(user.id);
    const lobby = code ? this.lobbies.get(code) : undefined;
    if (!lobby) return;
    const p = lobby.players.get(user.id);
    if (!p) return;
    socket.join(ROOM(lobby.code));
    const wasDisconnected = !p.connected;
    p.connected = true;
    p.disconnectedAt = null;
    lobby.emptySince = null;
    this.broadcast(lobby);
    if (lobby.match && !lobby.match.ended) {
      lobby.match.sendStart(user.id);
      if (wasDisconnected) lobby.match.system(user.id, 'reconnect');
    }
  }

  onDisconnect(userId: string): void {
    const code = this.userLobby.get(userId);
    const lobby = code ? this.lobbies.get(code) : undefined;
    if (!lobby) return;
    const stillHere = (this.io.sockets.adapter.rooms.get(USER(userId))?.size ?? 0) > 0;
    if (stillHere) return;
    const p = lobby.players.get(userId);
    if (!p) return;
    p.connected = false;
    p.disconnectedAt = Date.now();
    p.ready = false;
    if (lobby.match && !lobby.match.ended) lobby.match.system(userId, 'disconnect');
    if (lobby.hostId === userId) this.passHost(lobby);
    if (![...lobby.players.values()].some((x) => x.connected && !x.isBot)) lobby.emptySince = Date.now();
    this.broadcast(lobby);
  }

  // ---------- message handling ----------

  async handle(socket: Socket, user: UserRow, event: string, raw: unknown, ack?: (r: unknown) => void): Promise<void> {
    const schema = C2S[event as keyof typeof C2S];
    if (!schema) return;
    const parsed = schema.safeParse(raw ?? {});
    if (!parsed.success) {
      const strikes = ((socket.data.strikes as number) ?? 0) + 1;
      socket.data.strikes = strikes;
      if (strikes >= 3) socket.disconnect(true);
      ack?.({ error: { code: 'invalid', message: 'Malformed message.' } });
      return;
    }
    const msg = parsed.data as Record<string, unknown>;
    const reply = (r: unknown) => ack?.(r);
    const fail = (code: string, message: string) => {
      socket.emit('lobby:error', { code, message });
      reply({ error: { code, message } });
    };
    const lobby = this.lobbyOf(user.id);

    switch (event) {
      case 'ping:clock':
        socket.emit('pong:clock', { t0: msg.t0, t1: Date.now() });
        return;
      case 'lobby:create': {
        if (this.shuttingDown) return fail('shutdown', 'Server restarting for an update. Try again in a moment.');
        if (limits.lobbyCreate.hit(`lobby:${user.id}`)) return fail('rate_limited', 'Too many lobbies. Take a breath.');
        const opts = (msg.options ?? {}) as Partial<Lobby['options']>;
        const l = await this.create(user, msg.mode as Lobby['mode'], msg.night as number, opts);
        this.attach(socket, l);
        reply({ code: l.code });
        this.broadcast(l);
        return;
      }
      case 'lobby:join': {
        const code = String(msg.code).toUpperCase();
        const l = this.lobbies.get(code);
        if (!l) return fail('not_found', "Couldn't find that room. Check the code?");
        const r = await this.join(user, l);
        if (r) return fail(r.code, r.message);
        this.attach(socket, l);
        reply({ code: l.code });
        this.broadcast(l);
        return;
      }
      case 'lobby:quick': {
        const hi = await highestNight(this.db, user.id, 'nightshift');
        const pool = [...this.lobbies.values()]
          .filter((l) => l.options.public && l.state === 'waiting' && l.mode === 'nightshift' && l.players.size < MAX && l.night <= hi + 1)
          .sort((a, b) => b.players.size - a.players.size);
        let l = pool[0];
        if (l) {
          const r = await this.join(user, l);
          if (r) return fail(r.code, r.message);
        } else {
          l = await this.create(user, 'nightshift', Math.max(1, Math.min(5, hi + 1)), { public: true });
        }
        this.attach(socket, l);
        reply({ code: l.code });
        this.broadcast(l);
        return;
      }
      case 'lobby:list':
        reply({ lobbies: this.publicList() });
        return;
      case 'lobby:leave':
        this.leave(user.id);
        socket.rooms.forEach((r) => r.startsWith('lobby:') && socket.leave(r));
        reply({ ok: true });
        return;
    }

    if (!lobby) return fail('no_lobby', "You're not in a lobby.");
    const me = lobby.players.get(user.id);
    if (!me) return;
    const isHost = lobby.hostId === user.id;

    switch (event) {
      case 'lobby:station': {
        if (lobby.state !== 'waiting') return;
        const st = msg.station as StationId;
        if (lobby.mode === 'freeroam') return;
        const allowed = lobby.mode === 'classic' ? ['office'] : ['west', 'east', 'south', 'control'];
        if (!allowed.includes(st)) return fail('bad_station', 'No such station.');
        const taken = [...lobby.players.values()].find((p) => p.station === st && p.userId !== user.id);
        if (taken && !isHost) return fail('taken', 'Someone already has that station.');
        if (taken) taken.station = null;
        me.station = st;
        me.puppeteer = false;
        this.broadcast(lobby);
        return;
      }
      case 'lobby:ready':
        if (lobby.state !== 'waiting') return;
        me.ready = Boolean(msg.ready);
        this.broadcast(lobby);
        return;
      case 'lobby:settings': {
        if (!isHost || lobby.state !== 'waiting') return fail('not_host', 'Only the host can change that.');
        if (msg.mode) {
          lobby.mode = msg.mode as Lobby['mode'];
          for (const p of lobby.players.values()) {
            p.station = lobby.mode === 'classic' ? 'office' : lobby.mode === 'freeroam' ? null : p.station === 'office' ? null : p.station;
            p.puppeteer = false;
          }
          if (lobby.mode === 'showtime') me.puppeteer = true;
        }
        if (msg.night !== undefined) {
          const n = msg.night as number;
          if (!this.nightUnlocked(lobby, n)) return fail('locked', `Beat Night ${n === 7 ? 6 : n - 1} first.`);
          lobby.night = n;
        }
        if (msg.customAi) lobby.customAi = msg.customAi as Lobby['customAi'];
        if (msg.puppet !== undefined) lobby.puppet = msg.puppet as number;
        if (msg.extended) {
          const ext = Object.fromEntries(Object.entries(msg.extended as Record<string, number>).filter(([, v]) => v > 0));
          const coreActive = Object.values(lobby.customAi).filter((v) => v > 0).length;
          if (Object.keys(ext).length + coreActive > 12) return fail('cap', '12/12 active. Turn someone off first.');
          lobby.extended = ext;
        }
        if (msg.options) lobby.options = { ...lobby.options, ...(msg.options as Partial<Lobby['options']>) };
        this.broadcast(lobby);
        return;
      }
      case 'lobby:puppeteer': {
        if (!isHost || lobby.mode !== 'showtime') return;
        for (const p of lobby.players.values()) p.puppeteer = p.userId === msg.userId;
        const pup = lobby.players.get(String(msg.userId));
        if (pup) pup.station = null;
        this.broadcast(lobby);
        return;
      }
      case 'lobby:kick': {
        if (!isHost || msg.userId === user.id) return;
        const target = String(msg.userId);
        this.io.to(USER(target)).emit('lobby:error', { code: 'kicked', message: 'The host sent you home.' });
        this.leave(target);
        this.io.in(USER(target)).socketsLeave(ROOM(lobby.code));
        return;
      }
      case 'lobby:skin':
        await this.refreshPlayer(user.id);
        return;
      case 'lobby:start': {
        if (!isHost) return fail('not_host', 'Only the host can start the shift.');
        const err = this.canStart(lobby);
        if (err) return fail('cant_start', err);
        this.startNight(lobby);
        reply({ ok: true });
        return;
      }
      case 'input': {
        if (!lobby.match || lobby.match.ended || lobby.match instanceof FrMatch) return;
        lobby.match.input(user.id, msg.seq as number, msg.input as never);
        return;
      }
      case 'fr:test': {
        if (!this.env.testHooks || !(lobby.match instanceof FrMatch)) return;
        lobby.match.teleport(user.id, msg.x as number, msg.y as number, msg.z as number);
        reply({ ok: true });
        return;
      }
      case 'fr:cmd': {
        if (!(lobby.match instanceof FrMatch) || lobby.match.ended) return;
        const match = lobby.match;
        this.shaper.deliver(user.id, 'in', () => {
          if (!match.ended) match.cmd(user.id, msg.seq as number, msg.cmd as never);
        });
        return;
      }
      case 'fr:clock': {
        if (!this.env.testHooks || !(lobby.match instanceof FrMatch)) return;
        lobby.match.holdClock(Boolean(msg.hold));
        reply({ ok: true });
        return;
      }
      case 'fr:net': {
        if (!this.env.testHooks) return;
        reply({ ok: true, profile: this.shaper.set(user.id, msg as never) });
        return;
      }
      case 'look':
        return;
      case 'chat': {
        if (limits.chat.hit(`chat:${user.id}`)) return;
        const text = String(msg.text).slice(0, 120);
        this.radio(lobby, user.id, 'chat', { from: me.name, fromId: user.id, text });
        return;
      }
      case 'callout': {
        if (limits.chat.hit(`callout:${user.id}`)) return;
        this.radio(lobby, user.id, 'callout', { from: me.name, fromId: user.id, id: msg.id, text: CALLOUTS[msg.id as number] });
        return;
      }
      case 'voice:signal': {
        const to = String(msg.to);
        if (!lobby.players.has(to)) return;
        this.io.to(USER(to)).emit('voice:signal', { from: user.id, data: msg.data });
        return;
      }
      case 'voice:speaking':
        socket.to(ROOM(lobby.code)).emit('voice:speaking', { from: user.id, on: msg.on });
        return;
      case 'resume': {
        if (lobby.code !== String(msg.lobbyCode).toUpperCase()) return;
        this.attach(socket, lobby);
        socket.emit('lobby:state', this.state(lobby));
        if (lobby.match && !lobby.match.ended) lobby.match.sendStart(user.id);
        return;
      }
    }
  }

  // ---------- lobby operations ----------

  private lobbyOf(userId: string): Lobby | undefined {
    const c = this.userLobby.get(userId);
    return c ? this.lobbies.get(c) : undefined;
  }

  private attach(socket: Socket, l: Lobby): void {
    socket.rooms.forEach((r) => r.startsWith('lobby:') && r !== ROOM(l.code) && socket.leave(r));
    socket.join(ROOM(l.code));
  }

  private newCode(): string {
    for (;;) {
      let c = '';
      for (let i = 0; i < 4; i++) c += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
      if (!this.lobbies.has(c)) return c;
    }
  }

  private playerFrom(u: UserRow, isBot = false): LPlayer {
    return {
      userId: u.id,
      name: u.displayName,
      stars: u.stars,
      station: null,
      ready: false,
      connected: true,
      isBot,
      isGuest: u.isGuest,
      joinedAt: Date.now(),
      equipped: { ...DEFAULT_EQUIPPED, ...u.equipped },
      puppeteer: false,
      disconnectedAt: null,
    };
  }

  async create(user: UserRow, mode: Lobby['mode'], night: number, options: Partial<Lobby['options']>): Promise<Lobby> {
    this.leave(user.id);
    const hi = await highestNight(this.db, user.id, mode === 'classic' ? 'classic' : 'nightshift');
    const l: Lobby = {
      code: this.newCode(),
      hostId: user.id,
      mode,
      night: 1,
      customAi: { freddy: 0, bonnie: 0, chica: 0, foxy: 0 },
      puppet: 0,
      extended: {},
      options: { public: false, ghostsTalk: false, fillBots: false, ...options },
      players: new Map(),
      state: 'waiting',
      match: null,
      emptySince: null,
      hostHighest: hi,
    };
    if (this.nightUnlocked(l, night)) l.night = night;
    const p = this.playerFrom(user);
    if (mode === 'classic') p.station = 'office';
    else if (mode === 'showtime') p.puppeteer = true;
    else if (mode === 'nightshift') p.station = 'west';
    l.players.set(user.id, p);
    this.lobbies.set(l.code, l);
    this.userLobby.set(user.id, l.code);
    return l;
  }

  async join(user: UserRow, l: Lobby): Promise<{ code: string; message: string } | null> {
    if (l.players.has(user.id)) return null;
    const max = l.mode === 'classic' ? 1 : MAX;
    if (l.players.size >= max) return { code: 'full', message: "That room's full. Max four guards per shift." };
    if (l.state !== 'waiting') return { code: 'in_progress', message: 'That shift already started.' };
    this.leave(user.id);
    const fresh = (await findById(this.db, user.id)) ?? user;
    const p = this.playerFrom(fresh);
    const taken = new Set([...l.players.values()].map((x) => x.station));
    p.station = l.mode === 'freeroam' ? null : ((['west', 'east', 'south', 'control'] as StationId[]).find((s) => !taken.has(s)) ?? null);
    l.players.set(user.id, p);
    this.userLobby.set(user.id, l.code);
    return null;
  }

  leave(userId: string): void {
    const l = this.lobbyOf(userId);
    if (!l) return;
    this.userLobby.delete(userId);
    if (l.match && !l.match.ended) l.match.system(userId, 'disconnect');
    l.players.delete(userId);
    if (!l.players.size || ![...l.players.values()].some((p) => !p.isBot)) {
      this.destroy(l);
      return;
    }
    if (l.hostId === userId) this.passHost(l);
    this.broadcast(l);
  }

  private passHost(l: Lobby): void {
    const next = [...l.players.values()].filter((p) => p.connected && !p.isBot).sort((a, b) => a.joinedAt - b.joinedAt)[0];
    if (next) l.hostId = next.userId;
  }

  private destroy(l: Lobby): void {
    l.match?.stop();
    for (const p of l.players.values()) if (this.userLobby.get(p.userId) === l.code) this.userLobby.delete(p.userId);
    this.lobbies.delete(l.code);
    this.io.in(ROOM(l.code)).socketsLeave(ROOM(l.code));
  }

  private sweep(): void {
    const now = Date.now();
    for (const l of this.lobbies.values()) {
      if (l.emptySince && now - l.emptySince > 120_000) this.destroy(l);
    }
    for (const lim of Object.values(limits)) lim.sweep();
  }

  async refreshPlayer(userId: string): Promise<void> {
    const l = this.lobbyOf(userId);
    if (!l) return;
    const p = l.players.get(userId);
    const u = await findById(this.db, userId);
    if (!p || !u) return;
    if (l.state === 'waiting') p.equipped = { ...DEFAULT_EQUIPPED, ...u.equipped };
    p.name = u.displayName;
    p.stars = u.stars;
    this.broadcast(l);
  }

  private nightUnlocked(l: Lobby, n: number): boolean {
    if (n <= 1) return true;
    if (!this.env.isProd && this.env.FAST_NIGHT === '1') return true;
    if (l.mode === 'showtime') return n <= 5;
    if (n === 7) return l.hostHighest >= 6;
    return l.hostHighest >= n - 1;
  }

  private canStart(l: Lobby): string | null {
    if (l.state !== 'waiting') return 'Already on shift.';
    const humans = [...l.players.values()];
    if (humans.some((p) => !p.ready && p.userId !== l.hostId && p.connected)) return 'Waiting for staff...';
    if (l.mode === 'showtime') {
      if (humans.length < 2) return 'Showtime needs a Puppeteer and at least one guard.';
      if (!humans.some((p) => p.puppeteer)) return 'Pick a Puppeteer.';
    }
    return null;
  }

  private startNight(l: Lobby): void {
    l.state = 'in_night';
    if (l.mode === 'freeroam') {
      this.startFreeRoam(l);
      return;
    }
    const players: MatchPlayer[] = [...l.players.values()].map((p) => ({
      pid: p.userId,
      name: p.name,
      station: p.puppeteer ? null : p.station,
      role: p.puppeteer ? 'puppeteer' : 'guard',
      isHost: p.userId === l.hostId,
      isBot: p.isBot,
    }));
    // Fill with bots: empty stations count for scaling but earn nothing.
    if (l.options.fillBots && l.mode !== 'classic') {
      const used = new Set(players.map((p) => p.station));
      const guardCount = players.filter((p) => p.role === 'guard').length;
      let i = 0;
      for (const st of ['west', 'east', 'south', 'control'] as StationId[]) {
        if (guardCount + i >= 4) break;
        if (used.has(st)) continue;
        players.push({ pid: `bot:${l.code}:${st}`, name: `Bot ${st}`, station: st, role: 'guard', isHost: false, isBot: true });
        i++;
      }
    }
    const seed = this.env.TEST_SEED ?? Math.floor(Math.random() * 2 ** 31);
    const hourSeconds = this.env.fastNight ? 5 : 89;
    const match = new Match({
      seed,
      mode: l.mode,
      night: l.night,
      hourSeconds,
      players,
      custom: l.night === 7 ? { ai: { ...l.customAi }, puppet: l.puppet, extended: { ...l.extended } } : undefined,
      introMs: this.env.fastNight ? 1500 : 3500,
      send: (pid, ev, payload) => this.io.to(USER(pid)).emit(ev, payload),
      onEnd: (w) => void this.endNight(l, match, w, players),
    });
    l.match = match;
    match.start();
    this.broadcast(l);
  }

  private startFreeRoam(l: Lobby): void {
    const players = [...l.players.values()].map((p) => ({ pid: p.userId, name: p.name, isBot: p.isBot, isHost: p.userId === l.hostId, equipped: p.equipped }));
    const seed = this.env.TEST_SEED ?? Math.floor(Math.random() * 2 ** 31);
    const match: FrMatch = new FrMatch({
      seed,
      night: Math.min(6, l.night),
      fast: this.env.fastNight,
      testHooks: this.env.testHooks,
      players,
      introMs: this.env.fastNight ? 500 : 1500,
      send: (pid, ev, payload) => this.shaper.deliver(pid, 'out', () => this.io.to(USER(pid)).emit(ev, payload)),
      onEnd: () => void this.endFreeRoam(l, match, players),
    });
    l.match = match;
    match.start();
    this.broadcast(l);
  }

  private async endFreeRoam(l: Lobby, match: FrMatch, players: { pid: string; name: string; isBot: boolean }[]): Promise<void> {
    const r = match.result();
    let rewards: Record<string, PlayerReward> = {};
    try {
      const rows = await usersByIds(this.db, players.filter((p) => !p.isBot).map((p) => p.pid));
      rewards = await persistMatch(this.db, r, {
        startedAt: match.startedAt,
        players: players.map((p) => ({ pid: p.pid, userId: rows.find((u) => u.id === p.pid)?.id ?? null, isBot: p.isBot })),
        customAi: null,
        seconds: match.elapsedSeconds(),
      });
    } catch (err) {
      this.log.error({ err }, 'persisting free-roam match failed');
    }
    const team = r.players.map((p) => ({
      pid: p.pid,
      name: players.find((q) => q.pid === p.pid)?.name ?? '?',
      station: null,
      role: p.role,
      survived: p.survived,
      killedBy: p.killedBy,
      deathHour: p.deathHour,
      stats: p.stats,
    }));
    for (const p of players) {
      if (p.isBot) continue;
      const mine = r.players.find((x) => x.pid === p.pid);
      this.io.to(USER(p.pid)).emit('night:end', {
        result: r.result,
        mode: 'freeroam',
        night: r.night,
        hour: r.hour,
        power: r.power,
        team,
        you: mine,
        rewards: rewards[p.pid] ?? { tokens: mine?.tokens ?? 0, firstWinBonus: 0, newAchievements: [], newCosmetics: [], balance: 0 },
      });
    }
    l.match = null;
    l.state = 'waiting';
    for (const p of l.players.values()) p.ready = false;
    if (this.lobbies.has(l.code)) {
      const host = l.players.get(l.hostId);
      if (host) l.hostHighest = await highestNight(this.db, host.userId, 'nightshift');
      this.broadcast(l);
    }
  }

  private async endNight(l: Lobby, match: Match, w: World, players: MatchPlayer[]): Promise<void> {
    const r = match.result();
    let rewards: Record<string, PlayerReward> = {};
    try {
      const rows = await usersByIds(this.db, players.filter((p) => !p.isBot).map((p) => p.pid));
      rewards = await persistMatch(this.db, r, {
        startedAt: match.startedAt,
        players: players.map((p) => ({ pid: p.pid, userId: rows.find((u) => u.id === p.pid)?.id ?? null, isBot: p.isBot })),
        customAi: w.custom,
        seconds: match.elapsedSeconds(),
      });
    } catch (err) {
      this.log.error({ err }, 'persisting match failed');
    }
    const team = r.players.map((p) => ({
      pid: p.pid,
      name: w.players[p.pid]?.name ?? '?',
      station: p.station,
      role: p.role,
      survived: p.survived,
      killedBy: p.killedBy,
      deathHour: p.deathHour,
      stats: p.stats,
    }));
    for (const p of players) {
      if (p.isBot) continue;
      const mine = r.players.find((x) => x.pid === p.pid);
      const rw = rewards[p.pid];
      this.io.to(USER(p.pid)).emit('night:end', {
        result: r.result,
        mode: r.mode,
        night: r.night,
        hour: r.hour,
        power: r.power,
        team,
        you: mine,
        rewards: rw ?? { tokens: mine?.tokens ?? 0, firstWinBonus: 0, newAchievements: [], newCosmetics: [], balance: 0 },
      });
    }
    l.match = null;
    l.state = 'waiting';
    for (const p of l.players.values()) p.ready = false;
    // Drop players who never came back.
    for (const p of [...l.players.values()]) if (!p.connected && p.disconnectedAt && Date.now() - p.disconnectedAt > 60_000) this.leave(p.userId);
    if (this.lobbies.has(l.code)) {
      const host = l.players.get(l.hostId);
      if (host) l.hostHighest = await highestNight(this.db, host.userId, l.mode === 'classic' ? 'classic' : 'nightshift');
      this.broadcast(l);
    }
  }

  private radio(l: Lobby, fromId: string, ev: 'chat' | 'callout', payload: Record<string, unknown>): void {
    if (l.match instanceof FrMatch) {
      const sim = l.match.sim;
      const senderGhost = sim.players.get(fromId)?.ghost ?? false;
      for (const p of l.players.values()) {
        const ghost = sim.players.get(p.userId)?.ghost ?? false;
        if (senderGhost && !ghost && !l.options.ghostsTalk) continue;
        this.io.to(USER(p.userId)).emit(ev, { ...payload, ghost: senderGhost });
      }
      return;
    }
    const w = l.match?.world;
    if (!w || l.options.ghostsTalk) {
      this.io.to(ROOM(l.code)).emit(ev, payload);
      return;
    }
    const st = w.players[fromId]?.station;
    const senderDead = st ? !w.stations[st]?.alive : false;
    for (const p of l.players.values()) {
      const pst = w.players[p.userId]?.station;
      const dead = pst ? !w.stations[pst]?.alive : false;
      // Ghosts only talk to ghosts; the living hear the living.
      if (senderDead && !dead) continue;
      this.io.to(USER(p.userId)).emit(ev, { ...payload, ghost: senderDead });
    }
  }

  state(l: Lobby): LobbyState {
    const players: LobbyPlayer[] = [...l.players.values()].map((p) => ({
      userId: p.userId,
      name: p.name,
      stars: p.stars,
      station: p.station,
      ready: p.ready,
      connected: p.connected,
      isHost: p.userId === l.hostId,
      isBot: p.isBot,
      puppeteer: p.puppeteer,
      equipped: p.equipped,
      badge: COSMETICS_BY_ID[p.equipped.badge ?? '']?.id ?? null,
      title: (COSMETICS_BY_ID[p.equipped.title ?? '']?.params.text as string) ?? null,
    }));
    return {
      code: l.code,
      hostId: l.hostId,
      mode: l.mode,
      night: l.night,
      customAi: l.customAi,
      puppet: l.puppet,
      extended: l.extended,
      options: l.options,
      players,
      state: l.state,
      rosterMode: this.env.ROSTER_MODE,
      hostHighestNight: l.hostHighest,
    };
  }

  broadcast(l: Lobby): void {
    this.io.to(ROOM(l.code)).emit('lobby:state', this.state(l));
  }

  publicList(): LobbySummary[] {
    return [...this.lobbies.values()]
      .filter((l) => l.options.public && l.state === 'waiting')
      .map((l) => {
        const host = l.players.get(l.hostId);
        return { code: l.code, mode: l.mode, night: l.night, players: l.players.size, max: l.mode === 'classic' ? 1 : MAX, host: host?.name ?? '?', stars: host?.stars ?? 0 };
      });
  }

  /** SIGTERM: tell everyone, record in-progress nights as abandoned (no penalties). */
  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    clearInterval(this.sweepTimer);
    this.io.emit('server:notice', { text: 'Server restarting for an update. Your progress is saved.' });
    const jobs: Promise<unknown>[] = [];
    for (const l of this.lobbies.values()) {
      const m = l.match;
      if (m && !m.ended) {
        m.stop();
        const r = m.result();
        jobs.push(
          persistMatch(this.db, r, {
            startedAt: m.startedAt,
            players: [...l.players.values()].map((p) => ({ pid: p.userId, userId: p.isBot ? null : p.userId, isBot: p.isBot })),
            customAi: m instanceof FrMatch ? null : m.world.custom,
            abandoned: true,
            seconds: m.elapsedSeconds(),
          }).catch((err: unknown) => this.log.warn({ err }, 'abandon persist failed')),
        );
      }
    }
    await Promise.all(jobs);
  }

  stopTimers(): void {
    clearInterval(this.sweepTimer);
    for (const l of this.lobbies.values()) l.match?.stop();
  }

  async userIdsInLobbyWith(userId: string): Promise<string[]> {
    const l = this.lobbyOf(userId);
    return l ? [...l.players.keys()] : [];
  }
}
