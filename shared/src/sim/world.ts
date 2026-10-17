import { CONFIG, secs } from '../config';
import { createRng, int, range, chance } from '../rng';
import { CLASSIC_MAP } from '../content/map.classic';
import { COOP_MAP } from '../content/map.coop';
import type { DoorId, NodeId, StationId } from '../content/mapTypes';
import { ROSTER_BY_ID } from '../content/roster';
import { CLASSIC_NIGHTS, NIGHTSHIFT_NIGHTS, type CoreAi } from '../content/nights';
import { CALLS, CLASSIC_CALLS } from '../content/calls';
import { CLIPPINGS, CLIPPING_NODES } from '../content/newspapers';
import { matchPresetFull } from './presetMatch';
import type { AnimatronicState, SimEvent, StationState, World, WorldOptions } from './types';
import { buildMaintenanceSchedule } from './maintenance';
import { initPlugins } from './animatronics/plugins';

export const COOP_STATIONS: StationId[] = ['west', 'east', 'south', 'control'];

/** Which stations are in play for a given number of guards (Part 5.6). */
export function activeStationsFor(mode: 'classic' | 'nightshift' | 'showtime', guards: number): StationId[] {
  if (mode === 'classic') return ['office'];
  if (guards <= 1) return ['solo'];
  if (guards === 2) return ['west', 'east'];
  if (guards === 3) return ['west', 'east', 'control'];
  return ['west', 'east', 'south', 'control'];
}

function newStation(id: StationId, playerId: string | null, name: string, cam: NodeId, sealed: boolean): StationState {
  return {
    id,
    playerId,
    name,
    sealed,
    alive: !sealed,
    connected: true,
    abandoned: false,
    disconnectedAt: null,
    tablet: false,
    tabletChangedTick: 0,
    cam,
    camSince: 0,
    flashlight: false,
    battery: 100,
    mic: false,
    mask: false,
    maskTick: 0,
    windHeld: false,
    panel: false,
    rebooting: null,
    boostUntil: 0,
    boostCooldownUntil: 0,
    lureCooldownUntil: 0,
    goldenArmed: false,
    goldenUntil: null,
    staticUntil: 0,
    lightsOutUntil: 0,
    deathTick: null,
    deathHour: null,
    killedBy: null,
    usage: 0,
    stats: {
      cameraChecks: 0,
      doorsClosed: 0,
      tabletTicks: 0,
      ghostTicks: 0,
      powerUsed: 0,
      closeCalls: 0,
      foxBounces: 0,
      maskFools: 0,
      reboots: 0,
      musicBoxMin: 100,
      noseHonks: 0,
      ghostAssist: false,
      lockerClicks: 0,
      secret: false,
    },
    lastPressTicks: [],
    hallucinateAt: 0,
    pingNode: null,
    pingUntil: 0,
    tabletBlockedUntil: 0,
    everClosedDoor: false,
    everRaisedTablet: false,
  };
}

export function newAnim(id: string, node: NodeId, aiLevel: number, interval: number): AnimatronicState {
  return {
    id,
    aiLevel,
    node,
    subPos: 'room',
    door: null,
    station: null,
    targetDoor: null,
    moveTimer: interval * CONFIG.TICK_HZ,
    stage: 0,
    frozenTicks: 0,
    attackTimer: null,
    forceTimer: null,
    enteredTick: 0,
    active: true,
    flags: {},
    controlledTick: 0,
    cooldownUntil: 0,
  };
}

export function createWorld(opts: WorldOptions): World {
  const rng = createRng(opts.seed);
  const map = opts.mode === 'classic' ? CLASSIC_MAP : COOP_MAP;
  const guards = opts.players.filter((p) => (p.role ?? 'guard') === 'guard');
  const guardCount = Math.max(1, Math.min(4, guards.length));
  const active = activeStationsFor(opts.mode, guardCount);

  // Assign guards to stations, keeping lobby picks where they're still valid.
  const assigned = new Map<string, StationId>();
  const free = [...active];
  for (const p of guards) {
    if (p.station && free.includes(p.station)) {
      assigned.set(p.id, p.station);
      free.splice(free.indexOf(p.station), 1);
    }
  }
  for (const p of guards) {
    if (!assigned.has(p.id) && free.length) assigned.set(p.id, free.shift() as StationId);
  }

  const stations: World['stations'] = {};
  const stationOrder: StationId[] = [];
  const allStations: StationId[] = opts.mode === 'classic' ? ['office'] : active.includes('solo') ? ['solo', 'south', 'control'] : COOP_STATIONS;
  const defaultCam = map.stageNode;
  for (const sid of allStations) {
    const owner = guards.find((p) => assigned.get(p.id) === sid);
    const sealed = !active.includes(sid);
    stations[sid] = newStation(sid, owner?.id ?? null, owner?.name ?? '', defaultCam, sealed);
    stationOrder.push(sid);
  }

  // Doors, remapped onto the solo station when needed.
  const doorStation: Record<DoorId, StationId> = {};
  for (const d of Object.values(map.doors)) {
    doorStation[d.id] = active.includes('solo') && (d.id === 'west' || d.id === 'east') ? 'solo' : d.station;
  }
  const doors: World['doors'] = {};
  for (const d of Object.values(map.doors)) {
    const st = stations[doorStation[d.id]];
    const sealed = !st || st.sealed;
    doors[d.id] = {
      id: d.id,
      station: doorStation[d.id],
      closed: sealed,
      jammed: sealed,
      blockedBy: null,
      light: false,
      lastToggleTick: -100,
      closedSince: 0,
      lightDeadUntil: 0,
      stung: null,
      damage: 0,
    };
  }

  const players: World['players'] = {};
  for (const p of opts.players) {
    players[p.id] = {
      id: p.id,
      name: p.name,
      role: p.role ?? 'guard',
      station: assigned.get(p.id) ?? null,
      isHost: Boolean(p.isHost),
      isBot: Boolean(p.isBot),
      ghostPingUntil: 0,
      ghostPingNode: null,
    };
  }

  // AI levels.
  const night = Math.max(1, Math.min(7, opts.night));
  const table = opts.mode === 'classic' ? CLASSIC_NIGHTS : NIGHTSHIFT_NIGHTS;
  const def = table[night];
  let ai: CoreAi = typeof def.ai === 'function' ? def.ai((a, b) => int(rng, a, b)) : { ...def.ai };
  if (night === 7 && opts.custom) ai = { ...opts.custom.ai };
  if (opts.mode !== 'classic' && night !== 7) {
    const mult = CONFIG.scaling.AI_MULT[guardCount] ?? 1;
    ai = {
      freddy: Math.round(ai.freddy * mult),
      bonnie: Math.round(ai.bonnie * mult),
      chica: Math.round(ai.chica * mult),
      foxy: Math.round(ai.foxy * mult),
    };
  }

  const anims: AnimatronicState[] = [];
  for (const id of ['freddy', 'bonnie', 'chica', 'foxy'] as const) {
    const r = ROSTER_BY_ID[id];
    const a = newAnim(id, r.start[map.id] ?? map.stageNode, Math.min(20, Math.max(0, ai[id])), r.interval);
    anims.push(a);
  }

  const hourTicks = Math.round(opts.hourSeconds * CONFIG.TICK_HZ);
  const custom = night === 7 ? (opts.custom ?? null) : null;

  // Music box / Puppet.
  const puppetRate =
    opts.mode === 'classic' ? 0 : night === 7 ? (custom?.puppet ?? 0) : def.puppet ? (CONFIG.musicBox.UNWIND[night] ?? 1.5) : 0;
  if (puppetRate > 0) anims.push({ ...newAnim('puppet', map.musicBoxNode, 0, 999), active: false });

  const world: World = {
    tick: 0,
    seed: opts.seed,
    rng,
    mode: opts.mode,
    night,
    map,
    hourTicks,
    hour: 0,
    ended: false,
    result: null,
    power: 100,
    powerOut: { active: false, startTick: 0, queue: [], current: null, phase: 'done', phaseEnd: 0, nextRoll: 0 },
    passiveDrain: CONFIG.power.PASSIVE_DRAIN[night] ?? 0,
    stations,
    stationOrder,
    doors,
    doorStation,
    players,
    anims,
    guardCount,
    musicBox: {
      enabled: puppetRate > 0,
      level: 100,
      rate: puppetRate,
      puppetOut: false,
      puppetNode: map.musicBoxNode,
      puppetPath: [],
      puppetTarget: null,
      puppetTimer: 0,
      minLevel: 100,
    },
    maintenance: { enabled: false, failed: {}, schedule: [], autoReboot: {} },
    call: null,
    lastCoveWatchTick: 0,
    lastStageWatchTick: 0,
    foxyKnocks: 0,
    goldenOdds: night === 7 ? 1 / 500 : def.goldenOdds,
    custom,
    lure: null,
    attacks: {},
    plugins: {},
    events: [],
    showtime: opts.mode === 'showtime' ? { lightsOutReady: 0, staticReady: 0, kills: 0 } : null,
    clippings: {},
    presetId: null,
    ghostPingByNode: {},
  };

  world.presetId = custom ? matchPresetFull(custom) : null;

  // Maintenance only exists in the co-op building.
  if (opts.mode !== 'classic') {
    world.maintenance.enabled = true;
    world.maintenance.schedule = buildMaintenanceSchedule(world);
  }

  // Phone call.
  const calls = opts.mode === 'classic' ? CLASSIC_CALLS : CALLS;
  const call = calls[night];
  if (call && opts.mode !== 'showtime') world.call = { night, startTick: secs(1), duration: call.duration, muted: false, votes: [] };

  // Newspaper clippings for this night.
  for (const node of CLIPPING_NODES) {
    if (!map.nodes[node]) continue;
    const options = CLIPPINGS.filter((c) => (c.onlyNight ? c.onlyNight === night : night >= c.fromNight));
    const rare = options.filter((c) => c.rarity < 1 && chance(rng, c.rarity));
    const common = options.filter((c) => c.rarity >= 1);
    const pickFrom = rare.length ? rare : common;
    if (pickFrom.length) world.clippings[node] = pickFrom[int(rng, 0, pickFrom.length - 1)].id;
  }

  // Extended roster plugins (Night 6 defaults or Custom Night toggles).
  const extended = night === 7 ? (custom?.extended ?? {}) : (def.extended ?? {});
  if (opts.mode !== 'classic') initPlugins(world, extended);

  // Per-station hallucination timers.
  for (const s of Object.values(world.stations)) if (s) s.hallucinateAt = secs(range(rng, ...CONFIG.hallucination.INTERVAL));

  return world;
}

// ---------- shared helpers ----------

export function emit(world: World, ev: SimEvent): void {
  world.events.push({ ...ev, tick: world.tick });
}

export function station(world: World, id: StationId | null | undefined): StationState | undefined {
  return id ? world.stations[id] : undefined;
}

export function stationOfPlayer(world: World, pid: string): StationState | undefined {
  const p = world.players[pid];
  return p?.station ? world.stations[p.station] : undefined;
}

/** A station still in the fight: alive, not sealed, not abandoned. */
export function isLive(s: StationState | undefined): s is StationState {
  return Boolean(s && s.alive && !s.sealed && !s.abandoned);
}

export function liveStations(world: World): StationState[] {
  return world.stationOrder.map((id) => world.stations[id]).filter(isLive);
}

export function camerasDown(world: World): boolean {
  return world.maintenance.failed.cameras !== undefined;
}

/** Can this station see camera feeds right now? */
export function canWatch(world: World, s: StationState): boolean {
  return s.tablet && !camerasDown(world) && s.staticUntil <= world.tick && !world.powerOut.active;
}

export function watchers(world: World, node: NodeId): StationState[] {
  return liveStations(world).filter((s) => s.cam === node && canWatch(world, s));
}

export function isWatched(world: World, node: NodeId): boolean {
  return watchers(world, node).length > 0;
}

export function stationDoors(world: World, sid: StationId): DoorId[] {
  return Object.keys(world.doors).filter((d) => world.doorStation[d] === sid);
}

export function animAt(world: World, node: NodeId): AnimatronicState[] {
  return world.anims.filter((a) => a.active && a.node === node && (a.subPos === 'room' || a.subPos === 'at_door'));
}

export function playerName(world: World, s: StationState): string {
  return s.name || s.id;
}

/** Kill the guard at a station. */
export function kill(world: World, sid: StationId, by: string, kind: string = by): void {
  const s = world.stations[sid];
  if (!s || !s.alive || s.sealed) return;
  s.alive = false;
  s.deathTick = world.tick;
  s.deathHour = world.hour;
  s.killedBy = by;
  s.tablet = false;
  s.flashlight = false;
  s.mic = false;
  s.mask = false;
  s.windHeld = false;
  s.goldenArmed = false;
  s.goldenUntil = null;
  world.attacks[sid] = (world.attacks[sid] ?? 0) + 1;
  for (const d of stationDoors(world, sid)) {
    const door = world.doors[d];
    door.light = false;
    door.blockedBy = null;
  }
  emit(world, { type: 'jumpscare', to: s.playerId ? [s.playerId] : [], by, kind, station: sid });
  emit(world, { type: 'death', station: sid, by, hour: world.hour, player: s.playerId, name: s.name });
  // Whoever did it goes home, so the remaining guards aren't punished for a teammate's death.
  for (const a of world.anims) {
    if (a.station === sid && a.subPos === 'in_office') sendHome(world, a);
    if (a.targetDoor && world.doorStation[a.targetDoor] === sid) a.targetDoor = null;
  }
  if (world.showtime) world.showtime.kills++;
  checkAllDead(world);
}

export function sendHome(world: World, a: AnimatronicState): void {
  const r = ROSTER_BY_ID[a.id];
  if (a.door) {
    const door = world.doors[a.door];
    if (door && door.blockedBy === a.id) door.blockedBy = null;
  }
  a.node = r?.start[world.map.id] ?? world.map.stageNode;
  a.subPos = 'room';
  a.door = null;
  a.station = null;
  a.targetDoor = null;
  a.attackTimer = null;
  a.forceTimer = null;
  a.stage = 0;
  a.flags = {};
}

export function checkAllDead(world: World): void {
  if (world.ended) return;
  const anyAlive = world.stationOrder.some((id) => {
    const s = world.stations[id];
    return s && !s.sealed && s.alive && !(s.abandoned && !s.connected);
  });
  if (!anyAlive) endNight(world, 'loss');
}

export function endNight(world: World, result: 'win' | 'loss'): void {
  if (world.ended) return;
  world.ended = true;
  world.result = result;
  emit(world, { type: result === 'win' ? 'six_am' : 'game_over', hour: world.hour });
}
