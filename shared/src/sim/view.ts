import { ROSTER_BY_ID } from '../content/roster';
import type { NodeId, StationId } from '../content/mapTypes';
import type { AnimatronicState, World } from './types';
import { canWatch, camerasDown } from './world';
import { puppeteerVision, showtimeCooldown } from './showtime';
import { hallucinating } from './maintenance';
import { drainPerSecond } from './power';

export interface AnimView {
  id: string;
  n: NodeId;
  s: AnimatronicState['subPos'];
  d?: string | null;
  st?: number;
  pr?: number;
  run?: 1;
  out?: 1;
  cd?: number;
  /** Showtime: this character currently obeys the AI, not the Puppeteer. */
  ai?: number;
}

export interface StationSummary {
  id: StationId;
  name: string;
  pid: string | null;
  alive: boolean;
  sealed: boolean;
  tab: boolean;
  usage: number;
  conn: boolean;
  ab: boolean;
  ping: NodeId | null;
  boost: boolean;
  deathHour: number | null;
  killedBy: string | null;
}

export interface PlayerView {
  t: number;
  h: number;
  p: number;
  drain: number;
  po: { on: boolean; mine: 'song' | 'dark' | null };
  ended: boolean;
  result: World['result'];
  me: {
    st: StationId | null;
    role: 'guard' | 'puppeteer';
    alive: boolean;
    tablet: boolean;
    cam: NodeId;
    battery: number;
    flash: boolean;
    mic: boolean;
    mask: boolean;
    wind: boolean;
    panel: boolean;
    reboot: { sys: string; left: number } | null;
    boostCd: number;
    lureCd: number;
    golden: boolean;
    poster: boolean;
    staticT: number;
    lightsOut: number;
    blocked: number;
    usage: number;
  };
  doors: Record<string, { c: boolean; j: boolean; b: boolean; l: boolean; ld: boolean; st: StationId }>;
  stations: StationSummary[];
  mb: { on: boolean; lvl: number; out: boolean; rate: number };
  failed: string[];
  halluc: boolean;
  camsDown: boolean;
  an: AnimView[];
  call: { night: number; start: number; muted: boolean; votes: number } | null;
  lure: NodeId | null;
  clips: Record<NodeId, number>;
  shadowNode: NodeId | null;
  vision?: NodeId[];
  stime?: { lightsOut: number; static: number; kills: number };
}

function animView(world: World, a: AnimatronicState, full = false): AnimView {
  const v: AnimView = { id: a.id, n: a.node, s: a.subPos };
  if (a.door) v.d = a.door;
  if (a.id === 'foxy') {
    v.st = a.stage;
    if (a.stage >= 3) {
      v.run = 1;
      v.pr = Math.round((a.flags.progress ?? 0) * 100) / 100;
    }
  }
  if (full && world.showtime) {
    v.cd = Math.max(0, a.cooldownUntil - world.tick);
    v.ai = world.tick - a.controlledTick > 400 ? 1 : 0;
    void showtimeCooldown;
  }
  return v;
}

export function viewFor(world: World, pid: string): PlayerView {
  const p = world.players[pid];
  const s = p?.station ? world.stations[p.station] : undefined;
  const ghost = !s || !s.alive;
  const puppeteer = p?.role === 'puppeteer';
  const an: AnimView[] = [];
  const add = (a: AnimatronicState) => {
    if (!an.some((x) => x.id === a.id)) an.push(animView(world, a, puppeteer));
  };

  if (puppeteer) {
    for (const a of world.anims) if (a.active || a.id === 'foxy') add(a);
  } else if (ghost) {
    for (const a of world.anims) if (a.active) add(a);
  } else if (s) {
    const watching = canWatch(world, s);
    for (const a of world.anims) {
      if (!a.active && a.id !== 'puppet') continue;
      // Camera feed.
      if (watching && a.subPos === 'room') {
        if (a.id === 'foxy') {
          if (s.cam === world.map.coveNode || (a.stage >= 3 && s.cam === world.map.westHallNode)) add(a);
        } else if (a.id === 'puppet') {
          if (s.cam === world.map.musicBoxNode || (world.musicBox.puppetOut && s.cam === a.node)) add(a);
        } else if (a.node === s.cam) add(a);
      }
      // Own office.
      if (a.subPos === 'in_office' && a.station === s.id) add(a);
      // Door lights.
      if ((a.subPos === 'at_door' || a.subPos === 'in_vent') && a.door && world.doors[a.door]?.station === s.id) {
        const lit = world.doors[a.door].light;
        if (lit && (ROSTER_BY_ID[a.id]?.visibleInLight ?? true) && (a.subPos === 'at_door' || world.map.doors[a.door].kind === 'vent')) add(a);
      }
      // West flashlight looks straight down the hall.
      if (s.flashlight && (a.node === world.map.posterNode || a.node === world.map.westHallNode || (a.id === 'foxy' && a.stage >= 3)) && a.subPos !== 'in_office') {
        if (a.id !== 'freddy') add(a);
      }
    }
  }

  const doors: PlayerView['doors'] = {};
  for (const d of Object.values(world.doors)) {
    doors[d.id] = { c: d.closed, j: d.jammed, b: Boolean(d.blockedBy), l: d.light, ld: d.lightDeadUntil > world.tick, st: d.station };
  }
  const vision = puppeteer ? puppeteerVision(world) : null;

  const stations: StationSummary[] = world.stationOrder.map((id) => {
    const st = world.stations[id]!;
    const adjacentSeen =
      !puppeteer ||
      Object.values(world.doors).some((d) => d.station === id && vision?.has(world.map.doors[d.id].from));
    return {
      id,
      name: st.name,
      pid: st.playerId,
      alive: st.alive,
      sealed: st.sealed,
      tab: adjacentSeen ? st.tablet : false,
      usage: st.usage,
      conn: st.connected,
      ab: st.abandoned,
      ping: st.pingNode,
      boost: st.boostUntil > world.tick,
      deathHour: st.deathHour,
      killedBy: st.killedBy,
    };
  });

  const po = world.powerOut;
  const shadow = world.plugins.shadow?.node as NodeId | null | undefined;
  const view: PlayerView = {
    t: world.tick,
    h: world.hour,
    p: Math.round(world.power * 10) / 10,
    drain: Math.round(drainPerSecond(world) * 1000) / 1000,
    po: { on: po.active, mine: po.active && s && po.current === s.id ? (po.phase === 'song' ? 'song' : po.phase === 'dark' ? 'dark' : null) : null },
    ended: world.ended,
    result: world.result,
    me: {
      st: s?.id ?? null,
      role: p?.role ?? 'guard',
      alive: Boolean(s?.alive),
      tablet: Boolean(s?.tablet),
      cam: s?.cam ?? world.map.stageNode,
      battery: Math.round(s?.battery ?? 0),
      flash: Boolean(s?.flashlight),
      mic: Boolean(s?.mic),
      mask: Boolean(s?.mask),
      wind: Boolean(s?.windHeld),
      panel: Boolean(s?.panel),
      reboot: s?.rebooting ? { sys: s.rebooting.system, left: s.rebooting.endTick - world.tick } : null,
      boostCd: Math.max(0, (s?.boostCooldownUntil ?? 0) - world.tick),
      lureCd: Math.max(0, (s?.lureCooldownUntil ?? 0) - world.tick),
      golden: Boolean(s && s.goldenUntil !== null),
      poster: Boolean(s?.goldenArmed),
      staticT: Math.max(0, (s?.staticUntil ?? 0) - world.tick),
      lightsOut: Math.max(0, (s?.lightsOutUntil ?? 0) - world.tick),
      blocked: Math.max(0, (s?.tabletBlockedUntil ?? 0) - world.tick),
      usage: s?.usage ?? 0,
    },
    doors,
    stations,
    mb: { on: world.musicBox.enabled, lvl: Math.round(world.musicBox.level * 10) / 10, out: world.musicBox.puppetOut, rate: world.musicBox.rate },
    failed: Object.keys(world.maintenance.failed),
    halluc: hallucinating(world),
    camsDown: camerasDown(world),
    an,
    call: world.call ? { night: world.call.night, start: world.call.startTick, muted: world.call.muted, votes: world.call.votes.length } : null,
    lure: world.lure?.node ?? null,
    clips: world.clippings,
    shadowNode: shadow && (ghost || (s && s.cam === shadow && canWatch(world, s))) ? shadow : null,
  };
  if (puppeteer && vision && world.showtime) {
    view.vision = [...vision];
    view.stime = {
      lightsOut: Math.max(0, world.showtime.lightsOutReady - world.tick),
      static: Math.max(0, world.showtime.staticReady - world.tick),
      kills: world.showtime.kills,
    };
  }
  return view;
}

/** Filter a tick's events down to one player's. */
export function eventsFor(events: World['events'], pid: string): World['events'] {
  return events.filter((e) => !e.to || e.to.includes(pid)).map(({ to: _to, ...rest }) => rest as World['events'][number]);
}
