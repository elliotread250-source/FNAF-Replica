import { FR, aggr } from '../../frConfig';
import { eyeHeight } from './controller';
import type { NavPathPoint } from './nav';
import type { FrPlayer, FrSim } from './sim';
import { freddyGrace, tickCast } from './cast';

// Animatronic agents: perception (sight and hearing), an explicit state machine, path following with
// doors, searching hiding spots, catching. Per-character rules hang off `id`.

export type AgentState =
  | 'DORMANT'
  | 'PATROL'
  | 'INVESTIGATE'
  | 'CHASE'
  | 'SEARCH'
  | 'CHECK'
  | 'SATISFIED'
  | 'RETURN'
  | 'EAT'
  | 'COVE'
  | 'SPRINT'
  | 'STALK'
  | 'PUPPET'
  | 'SONG'
  | 'HUNT'
  | 'FROZEN';

export interface Agent {
  id: string;
  key: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  home: { x: number; y: number; z: number; yaw: number };
  aggression: number;
  state: AgentState;
  stateT: number;
  activeAt: number;
  path: NavPathPoint[] | null;
  pathI: number;
  goal: { x: number; y: number; z: number } | null;
  replanT: number;
  decisionT: number;
  perceiveT: number;
  pauseT: number;
  detect: Record<string, number>;
  canSee: Record<string, boolean>;
  noticed: Record<string, boolean>;
  sawHide: Record<string, number>;
  target: string | null;
  lastKnown: { x: number; y: number; z: number; t: number } | null;
  lostT: number;
  heard: { x: number; y: number; z: number; t: number; pri: number } | null;
  searchSpots: number[];
  searchUntil: number;
  checkSpot: number;
  checkDur: number;
  checkWarned: boolean;
  checkOccupants: string[];
  checkStart: number;
  /** Victims this agent won't catch again until the given time (it has to leave first). */
  spared: Record<string, number>;
  doorT: number;
  unseenT: number;
  speed: number;
  /** Animation hint for renderers. */
  anim: 'idle' | 'walk' | 'run' | 'open' | 'check' | 'look' | 'catch' | 'eat' | 'float' | 'sing' | 'knock' | 'peek' | 'frozen';
  /** Character-specific state (cast.ts). */
  x2: Record<string, number>;
  log: string[];
}

const HOME: Record<string, { x: number; y: number; z: number; yaw: number }> = {
  // Facing the dining hall (west, -X): yaw +PI/2.
  bonnie: { x: 58.5, y: 1.0, z: 13.5, yaw: Math.PI / 2 },
  freddy: { x: 58.5, y: 1.0, z: 15.5, yaw: Math.PI / 2 },
  chica: { x: 58.5, y: 1.0, z: 17.5, yaw: Math.PI / 2 },
  foxy: { x: 7.2, y: 0.4, z: 16, yaw: -Math.PI / 2 },
  puppet: { x: 22, y: 0.1, z: 5.2, yaw: Math.PI },
  powerout: { x: 30, y: 0, z: 20, yaw: 0 },
};

/** Rooms each character likes to patrol, with weights. */
const PATROL: Record<string, [string, number][]> = {
  bonnie: [
    ['westHall', 4],
    ['westCorner', 2],
    ['supply', 2],
    ['party1', 1],
    ['party2', 1],
    ['party3', 1],
    ['party4', 1],
    ['lounge', 2],
    ['backstage', 2],
    ['dining', 3],
    ['play', 1],
    ['utility', 1],
    ['prize', 1],
  ],
};

PATROL.chica = [
  ['kitchen', 6],
  ['eastHall', 4],
  ['eastCorner', 2],
  ['restCorr', 1],
  ['men', 1],
  ['women', 1],
  ['dining', 3],
  ['pantry', 1],
  ['supply', 1],
];
PATROL.freddy = [
  ['dining', 3],
  ['eastHall', 2],
  ['westHall', 2],
  ['play', 2],
  ['restCorr', 1],
  ['kitchen', 1],
  ['party2', 1],
  ['lobby', 1],
  ['prize', 1],
];
PATROL.powerout = PATROL.freddy;

export function makeAgent(sim: FrSim, id: string, aggression: number, protection: number): Agent {
  const h = HOME[id] ?? HOME.bonnie;
  return {
    id,
    key: `agent:${id}`,
    ...h,
    home: { ...h },
    aggression: Math.max(0, Math.min(20, aggression)),
    state: 'DORMANT',
    stateT: 0,
    activeAt: sim.time + protection,
    path: null,
    pathI: 0,
    goal: null,
    replanT: 0,
    decisionT: 0,
    perceiveT: 0,
    pauseT: 0,
    detect: {},
    canSee: {},
    noticed: {},
    sawHide: {},
    target: null,
    lastKnown: null,
    lostT: 0,
    heard: null,
    searchSpots: [],
    searchUntil: 0,
    checkSpot: -1,
    checkDur: 0,
    checkWarned: false,
    checkOccupants: [],
    checkStart: -1,
    spared: {},
    doorT: 0,
    unseenT: 0,
    speed: 0,
    anim: 'idle',
    x2: {},
    log: [],
  };
}

export function setState(sim: FrSim, a: Agent, to: AgentState, why: string): void {
  if (a.state === to) return;
  sim.emit({ t: 'state', agent: a.id, from: a.state, to, why });
  if (a.log.length > 30) a.log.shift();
  a.log.push(`${sim.time.toFixed(1)} ${a.state} -> ${to} (${why})`);
  a.state = to;
  a.stateT = 0;
  a.path = null;
  a.goal = null;
  a.doorT = 0;
}

// ---- Movement ---------------------------------------------------------------------------------------

export function doorOk(sim: FrSim, a?: Agent) {
  return (id: number) => {
    const d = sim.level.doors[id];
    // Power-Out Freddy can't open doors; the Puppet ignores them (but not shutters).
    if (a?.x2.noDoors) return sim.world.doorOpen[id] >= 0.7;
    if (a?.x2.ghost && d.kind !== 'shutter' && d.kind !== 'roller') return true;
    if (d.locked) return false;
    if (d.kind === 'shutter' || d.kind === 'roller' || d.kind === 'exit') return sim.doorTarget[id] > 0.5;
    return true;
  };
}

export function planTo(sim: FrSim, a: Agent, x: number, y: number, z: number): boolean {
  const from = sim.nav.nearest(a.x, a.y, a.z);
  const to = sim.nav.nearest(x, y, z);
  a.goal = { x, y, z };
  a.replanT = FR.ai.REPLAN_MIN;
  const p = sim.nav.findPath(from, to, doorOk(sim, a));
  a.path = p;
  a.pathI = p && p.length > 1 ? 1 : 0;
  return Boolean(p);
}

/** Walk the current path. Returns true when the goal is reached (or there is no path). */
export function follow(sim: FrSim, a: Agent, speed: number, dt: number): boolean {
  const path = a.path;
  if (!path || a.pathI >= path.length) {
    a.speed = 0;
    return true;
  }
  const wp = path[a.pathI];
  // A door on this segment: open it first (the Puppet drifts straight through regular doors).
  const drifts = a.x2.ghost && wp.door >= 0 && sim.level.doors[wp.door].kind !== 'shutter' && sim.level.doors[wp.door].kind !== 'roller';
  if (wp.door >= 0 && sim.world.doorOpen[wp.door] < 0.7 && !drifts) {
    if (a.x2.noDoors) {
      a.path = null;
      a.speed = 0;
      return false;
    }
    const d = sim.level.doors[wp.door];
    if (d.locked || ((d.kind === 'shutter' || d.kind === 'roller') && sim.doorTarget[wp.door] < 0.5)) {
      a.path = null; // blocked: replan next tick
      a.speed = 0;
      return false;
    }
    const prev = path[a.pathI - 1] ?? { x: a.x, z: a.z };
    // Walk up to the door first.
    const near = Math.hypot(prev.x - a.x, prev.z - a.z) < 0.35;
    if (near) {
      a.speed = 0;
      a.anim = 'open';
      a.doorT += dt;
      if (a.doorT >= FR.ai.DOOR_OPEN_TIME && sim.doorTarget[wp.door] < 0.5) sim.setDoor(wp.door, true, a.key);
      return false;
    }
  }
  a.doorT = 0;
  const dx = wp.x - a.x;
  const dz = wp.z - a.z;
  const d = Math.hypot(dx, dz);
  const step = speed * dt;
  const prev = path[a.pathI - 1];
  if (d <= step) {
    a.x = wp.x;
    a.z = wp.z;
    a.y = wp.y;
    a.pathI++;
  } else {
    a.x += (dx / d) * step;
    a.z += (dz / d) * step;
    if (prev) {
      const segLen = Math.hypot(wp.x - prev.x, wp.z - prev.z) || 1;
      const s = 1 - Math.min(1, (d - step) / segLen);
      a.y = prev.y + (wp.y - prev.y) * s;
    }
  }
  if (d > 0.01) turnToward(a, Math.atan2(-dx, -dz), dt, 7);
  a.speed = Math.min(speed, d / dt);
  a.anim = speed > 3.2 ? 'run' : 'walk';
  return a.pathI >= path.length;
}

export function turnToward(a: Agent, yaw: number, dt: number, rate: number): void {
  let d = yaw - a.yaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const m = rate * dt;
  a.yaw += Math.max(-m, Math.min(m, d));
}

export function goTo(sim: FrSim, a: Agent, x: number, y: number, z: number, speed: number, dt: number): boolean {
  if (!a.path || !a.goal || Math.hypot(a.goal.x - x, a.goal.z - z) > 0.6) {
    if (a.replanT > 0 && a.path) {
      a.replanT -= dt;
    } else if (!planTo(sim, a, x, y, z)) {
      a.speed = 0;
      return true; // unreachable: treat as arrived so the state moves on
    }
  }
  a.replanT -= dt;
  return follow(sim, a, speed, dt);
}

// ---- Perception -------------------------------------------------------------------------------------

function coneFor(a: Agent): number {
  return a.id === 'bonnie' ? FR.ai.BONNIE_CONE_H : FR.ai.CONE_H;
}

/** Visibility of a player to an agent, 0..1 (0 = not visible). */
function visibility(sim: FrSim, a: Agent, p: FrPlayer): { vis: number; instant: boolean } {
  const none = { vis: 0, instant: false };
  if (!sim.alive(p)) return none;
  if (p.hidden && p.hidden.phase === 'in') return none;
  const b = p.body;
  const ey = a.y + 1.9;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const flat = Math.hypot(dx, dz);
  const lit = sim.litAt(b.x, b.y, b.z);
  // Flashlight pointed toward the agent?
  const fx = -Math.sin(b.yaw);
  const fz = -Math.cos(b.yaw);
  const toA = flat > 0.01 ? (-dx * fx + -dz * fz) / flat : 1;
  const flashAt = p.flashOn && p.battery > 0 && toA > Math.cos(Math.PI / 3);
  const range = Math.max(lit ? aggr(FR.ai.VISION_LIT, a.aggression) : aggr(FR.ai.VISION_DARK, a.aggression), flashAt ? 30 : 0, p.flashOn ? 14 : 0);
  if (flat > range) return none;
  const ax = -Math.sin(a.yaw);
  const az = -Math.cos(a.yaw);
  const cos = flat > 0.01 ? (dx * ax + dz * az) / flat : 1;
  if (cos < Math.cos(((coneFor(a) / 2) * Math.PI) / 180)) return none;
  // Three rays: head, chest, feet.
  const top = b.y + eyeHeight(b);
  const headOk = sim.world.clearLine(a.x, ey, a.z, b.x, top, b.z);
  const chestOk = sim.world.clearLine(a.x, ey, a.z, b.x, b.y + b.height * 0.55, b.z);
  const feetOk = sim.world.clearLine(a.x, ey, a.z, b.x, b.y + 0.15, b.z);
  if (!headOk && !chestOk && !feetOk) return none;
  if (flat < FR.ai.INSTANT_SPOT_RANGE) return { vis: 1, instant: true };
  const light = flashAt ? 1 : lit ? 1 : p.flashOn ? 0.6 : 0.35;
  // A beam in the face reads no matter how low you crouch.
  const posture = flashAt ? 0.9 : b.stance === 0 ? 1 : b.stance === 1 ? 0.6 : 0.4;
  const motion = b.sprinting ? 1 : b.speed > 0.3 ? 0.8 : 0.5;
  const exposure = chestOk || feetOk ? 1 : 0.5;
  const falloff = 1 - 0.8 * Math.max(0, Math.min(1, (flat - 3) / Math.max(1, range - 3)));
  // A lit flashlight pointed at the agent within 20 m triples detection speed (Part 4.3).
  const beacon = flashAt && flat < 20 ? 3 : 1;
  return { vis: Math.min(1.5, light * posture * motion * exposure * falloff * beacon), instant: false };
}

function perceive(sim: FrSim, a: Agent, dt: number): void {
  const detectTime = aggr(FR.ai.DETECT_TIME, a.aggression);
  for (const p of sim.players.values()) {
    const v = visibility(sim, a, p);
    a.canSee[p.id] = v.vis > 0;
    const cur = a.detect[p.id] ?? 0;
    // Chica spots cupcake carriers 1.5 times faster.
    const smell = a.id === 'chica' && sim.night.has(p, 'cupcake') ? 1.5 : 1;
    let next = v.vis > 0 ? cur + ((v.vis * smell) / Math.max(0.2, detectTime)) * dt : cur - FR.ai.DETECT_DECAY * dt;
    if (v.instant) next = 1;
    next = Math.max(0, Math.min(1, next));
    a.detect[p.id] = next;
    if (next >= FR.ai.NOTICE_THRESHOLD && !a.noticed[p.id] && v.vis > 0) {
      a.noticed[p.id] = true;
      p.lastTell = sim.time;
      sim.emit({ t: 'notice', agent: a.id, pid: p.id });
    }
    if (next < 0.05) a.noticed[p.id] = false;
    if (next >= 1 && v.vis > 0 && canHunt(a) && !OWN_RULES.has(a.id) && (a.spared[p.id] ?? -1) <= sim.time) startChase(sim, a, p, v.instant ? 'within reach' : 'spotted');
  }
  // Is anyone looking at this agent? (Bonnie's relocation, Freddy later.)
  let seen = false;
  for (const p of sim.players.values()) if (sim.playerSees(p, a.x, a.y + 1.6, a.z, true)) seen = true;
  a.unseenT = seen ? 0 : a.unseenT + dt;
}

/** Characters whose hunting is entirely their own rule (cast.ts), never the generic chase. */
const OWN_RULES = new Set(['foxy', 'freddy', 'puppet', 'powerout']);

export function canHunt(a: Agent): boolean {
  return a.state !== 'DORMANT' && a.state !== 'SATISFIED' && a.state !== 'RETURN' && a.state !== 'CHECK';
}

function startChase(sim: FrSim, a: Agent, p: FrPlayer, why: string): void {
  if (a.state === 'CHASE' && a.target === p.id) return;
  setState(sim, a, 'CHASE', `${why} ${p.name}`);
  a.target = p.id;
  a.lostT = 0;
  p.lastTell = sim.time;
  sim.emit({ t: 'chase', agent: a.id, pid: p.id });
}

function hear(sim: FrSim, a: Agent): void {
  const mult = aggr(FR.ai.HEARING_MULT, a.aggression);
  for (const n of sim.noises) {
    if (!n.pid) continue;
    const d = Math.hypot(n.x - a.x, n.y - (a.y + 1), n.z - a.z);
    const loud = n.r >= 14 && a.aggression >= 15;
    if (d > n.r * mult && !loud) continue;
    const c = sim.world.countBetween(a.x, a.y + 1.5, a.z, n.x, n.y + 0.5, n.z);
    const eff = n.r * mult * Math.pow(FR.noise.WALL_FACTOR, Math.min(3, c.walls)) * Math.pow(FR.noise.DOOR_FACTOR, c.doors);
    if (d > eff && !loud) continue;
    const pri = n.r / (d + 1);
    if (!a.heard || pri > a.heard.pri || sim.time - a.heard.t > 4) a.heard = { x: n.x, y: n.y, z: n.z, t: sim.time, pri };
  }
}

// ---- Catching ---------------------------------------------------------------------------------------

export function tryCatch(sim: FrSim, a: Agent): boolean {
  const fx = -Math.sin(a.yaw);
  const fz = -Math.cos(a.yaw);
  for (const p of sim.players.values()) {
    // Hidden players (even mid-way in) are only ever found by checking the spot.
    if (!sim.alive(p) || (p.hidden && p.hidden.phase !== 'exit')) continue;
    if ((a.spared[p.id] ?? -1) > sim.time) continue;
    if (freddyGrace(sim, a, p.id)) continue;
    const b = p.body;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const d = Math.hypot(dx, dz);
    if (d > FR.ai.CATCH_RANGE + FR.player.RADIUS || Math.abs(b.y - a.y) > 1.2) continue;
    const cos = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
    if (cos < Math.cos(((FR.ai.CATCH_ARC / 2) * Math.PI) / 180)) continue;
    if (!sim.world.clearLine(a.x, a.y + 1.2, a.z, b.x, b.y + 1.0, b.z)) continue;
    sim.catchPlayer(p, a.id, 'standard');
    a.spared[p.id] = sim.time + 12;
    afterCatch(sim, a);
    return true;
  }
  return false;
}

export function afterCatch(sim: FrSim, a: Agent): void {
  setState(sim, a, 'SATISFIED', 'caught someone');
  a.target = null;
  a.lastKnown = null;
  a.heard = null;
  a.pauseT = FR.ai.SATISFIED[0] + sim.rand() * (FR.ai.SATISFIED[1] - FR.ai.SATISFIED[0]) + (a.id === 'chica' ? 3 : 0);
  a.anim = 'catch';
  for (const k of Object.keys(a.detect)) a.detect[k] = 0;
}

// ---- Decisions --------------------------------------------------------------------------------------

export function patrolTarget(sim: FrSim, a: Agent, minDist = 0): { x: number; y: number; z: number } | null {
  const list = PATROL[a.id] ?? PATROL.bonnie;
  const here = sim.roomAt(a.x, a.y + 0.3, a.z);
  for (let tries = 0; tries < 8; tries++) {
    const total = list.reduce((s, [, w]) => s + w, 0);
    let roll = sim.rand() * total;
    let room = list[0][0];
    for (const [r, w] of list) {
      roll -= w;
      if (roll <= 0) {
        room = r;
        break;
      }
    }
    if (room === here && tries < 6) continue;
    const n = sim.nav.nodeInRoom(room, sim.rand());
    if (n < 0) continue;
    const t = { x: sim.nav.xs[n], y: sim.nav.ys[n], z: sim.nav.zs[n] };
    if (Math.hypot(t.x - a.x, t.z - a.z) < minDist && tries < 6) continue;
    return t;
  }
  return null;
}

/** FNAF-style move opportunity: roll 1..20 against aggression. */
export function decide(sim: FrSim, a: Agent): void {
  const roll = 1 + Math.floor(sim.rand() * 20);
  const hunting = roll <= a.aggression;
  if (hunting) {
    if (a.heard && sim.time - a.heard.t < 15) {
      investigate(sim, a, a.heard, 'move opportunity: noise');
      return;
    }
    if (a.lastKnown && sim.time - a.lastKnown.t < 30) {
      investigate(sim, a, a.lastKnown, 'move opportunity: last seen');
      return;
    }
    if (sim.rand() < aggr(FR.ai.HUNT_CHANCE, a.aggression)) {
      // Blurred heat map: only the room a random living player is in, never their exact spot.
      const living = [...sim.players.values()].filter((p) => sim.alive(p));
      if (living.length) {
        const p = living[Math.floor(sim.rand() * living.length)];
        const room = sim.roomAt(p.body.x, p.body.y + 0.3, p.body.z);
        const n = room ? sim.nav.nodeInRoom(room, sim.rand()) : -1;
        if (n >= 0) {
          investigate(sim, a, { x: sim.nav.xs[n], y: sim.nav.ys[n], z: sim.nav.zs[n] }, 'move opportunity: players about');
          return;
        }
      }
    }
  }
  const t = patrolTarget(sim, a);
  if (t) {
    if (a.state !== 'PATROL') setState(sim, a, 'PATROL', hunting ? 'nothing to hunt' : 'idle roll');
    planTo(sim, a, t.x, t.y, t.z);
  }
}

export function investigate(sim: FrSim, a: Agent, at: { x: number; y: number; z: number }, why: string): void {
  setState(sim, a, 'INVESTIGATE', why);
  a.goal = { x: at.x, y: at.y, z: at.z };
  a.pauseT = 0;
  planTo(sim, a, at.x, at.y, at.z);
}

function beginSearch(sim: FrSim, a: Agent, why: string): void {
  setState(sim, a, 'SEARCH', why);
  const lk = a.lastKnown ?? { x: a.x, y: a.y, z: a.z, t: sim.time };
  const n = Math.round(Math.max(1, aggr(FR.ai.SPOTS_PER_SEARCH, a.aggression)));
  const spots = sim.level.hidingSpots
    .filter((s) => Math.abs(sim.level.roomById[s.room].floorY - lk.y) < 2 && Math.hypot(s.x - lk.x, s.z - lk.z) < 18)
    .map((s) => ({ id: s.id, score: Math.hypot(s.x - lk.x, s.z - lk.z) / (s.checkPriority + 0.15) }))
    .sort((p, q) => p.score - q.score)
    .slice(0, n)
    .map((s) => s.id);
  a.searchSpots = spots;
  a.searchUntil = sim.time + Math.max(8, aggr(FR.ai.SEARCH_DURATION, a.aggression));
}

function nearestExit(sim: FrSim, a: Agent, spot: number): { x: number; z: number } {
  const s = sim.spot(spot);
  let best = s.exits[0];
  let bd = Infinity;
  for (const e of s.exits) {
    const d = Math.hypot(e.x - a.x, e.z - a.z);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

function beginCheck(sim: FrSim, a: Agent, spot: number, why: string): void {
  setState(sim, a, 'CHECK', why);
  a.checkSpot = spot;
  a.checkWarned = false;
  a.checkDur = FR.ai.CHECK_TIME[0] + sim.rand() * (FR.ai.CHECK_TIME[1] - FR.ai.CHECK_TIME[0]);
  a.checkOccupants = [];
  a.checkStart = -1;
}

/** Called by the sim when this agent watched a player climb into a hiding spot. */
export function sawHiding(sim: FrSim, a: Agent, pid: string, spot: number): void {
  a.sawHide[pid] = spot;
  if (!canHunt(a) || (a.spared[pid] ?? -1) > sim.time) return;
  const p = sim.players.get(pid);
  if (p) p.lastTell = sim.time;
  a.target = pid;
  beginCheck(sim, a, spot, `saw ${p?.name ?? pid} hide`);
}

// ---- The tick ---------------------------------------------------------------------------------------

export function tickAgent(sim: FrSim, a: Agent, dt: number): void {
  a.stateT += dt;
  if (tickCast(sim, a, dt)) {
    if (a.speed > 0.5) for (const p of sim.players.values()) if (Math.hypot(p.body.x - a.x, p.body.z - a.z) < 25) p.lastTell = sim.time;
    return;
  }
  a.perceiveT -= dt;
  if (a.state !== 'DORMANT' && a.perceiveT <= 0) {
    a.perceiveT = 1 / FR.ai.PERCEPTION_HZ;
    perceive(sim, a, 1 / FR.ai.PERCEPTION_HZ);
  }
  if (a.state !== 'DORMANT') hear(sim, a);
  // Footsteps are a tell for anyone within 25 m.
  if (a.speed > 0.5) for (const p of sim.players.values()) if (Math.hypot(p.body.x - a.x, p.body.z - a.z) < 25) p.lastTell = sim.time;

  const patrol = aggr(FR.ai.PATROL_SPEED, a.aggression);
  const chase = aggr(FR.ai.CHASE_SPEED, a.aggression);
  a.decisionT -= dt;

  switch (a.state) {
    case 'DORMANT': {
      a.anim = 'idle';
      a.speed = 0;
      if (a.aggression > 0 && sim.time >= a.activeAt && a.decisionT <= 0) {
        a.decisionT = aggr(FR.ai.DECISION_INTERVAL, a.aggression);
        if (1 + Math.floor(sim.rand() * 20) <= Math.max(1, a.aggression)) decide(sim, a);
      }
      return;
    }
    case 'PATROL': {
      if (tryCatch(sim, a)) return;
      if (reactToNoise(sim, a)) return;
      if (a.path && a.pathI < a.path.length) {
        bonnieRelocate(sim, a);
        if (follow(sim, a, patrol, dt)) a.pauseT = FR.ai.PATROL_PAUSE[0] + sim.rand() * (FR.ai.PATROL_PAUSE[1] - FR.ai.PATROL_PAUSE[0]);
      } else if (!a.path && a.goal) {
        if (!planTo(sim, a, a.goal.x, a.goal.y, a.goal.z)) a.goal = null;
      } else {
        a.speed = 0;
        a.anim = 'look';
        a.pauseT -= dt;
        a.yaw += Math.sin(sim.time * 0.9) * dt * 0.8;
      }
      if (a.decisionT <= 0 && (a.pauseT <= 0 || !a.path)) {
        a.decisionT = aggr(FR.ai.DECISION_INTERVAL, a.aggression);
        decide(sim, a);
      }
      return;
    }
    case 'INVESTIGATE': {
      if (tryCatch(sim, a)) return;
      if (reactToNoise(sim, a)) return;
      const g = a.goal;
      if (!g) {
        decide(sim, a);
        return;
      }
      if (a.path === null && a.pauseT <= 0 && a.stateT < 0.1) planTo(sim, a, g.x, g.y, g.z);
      const arrived = a.pauseT > 0 || follow(sim, a, patrol * 1.2, dt);
      if (arrived) {
        if (a.pauseT <= 0) {
          a.pauseT = FR.ai.INVESTIGATE_LOOK[0] + sim.rand() * (FR.ai.INVESTIGATE_LOOK[1] - FR.ai.INVESTIGATE_LOOK[0]);
          a.path = [];
          // Peek into a nearby hiding spot if hunting hard enough.
          if (a.aggression >= 8) {
            const spot = sim.level.hidingSpots.find((s) => Math.hypot(s.x - a.x, s.z - a.z) < 4 && Math.abs(sim.level.roomById[s.room].floorY - a.y) < 1.5);
            if (spot && sim.rand() < 0.6) {
              beginCheck(sim, a, spot.id, 'investigating nearby spot');
              return;
            }
          }
        }
        a.speed = 0;
        a.anim = 'look';
        a.yaw += dt * 1.6 * Math.sin(a.stateT * 1.3);
        a.pauseT -= dt;
        if (a.pauseT <= 0) {
          a.heard = null;
          decide(sim, a);
        }
      }
      return;
    }
    case 'CHASE': {
      const p = a.target ? sim.players.get(a.target) : undefined;
      if (!p || !sim.alive(p)) {
        beginSearch(sim, a, 'target gone');
        return;
      }
      if (tryCatch(sim, a)) return;
      // Saw them dive into a hiding spot: go straight there.
      if (p.hidden && a.sawHide[p.id] === p.hidden.spot) {
        beginCheck(sim, a, p.hidden.spot, `saw ${p.name} hide`);
        return;
      }
      if (a.canSee[p.id]) {
        a.lastKnown = { x: p.body.x, y: p.body.y, z: p.body.z, t: sim.time };
        a.lostT = 0;
      } else a.lostT += dt;
      if (a.lostT > FR.ai.LOST_SIGHT_TO_SEARCH) {
        sim.emit({ t: 'lost', agent: a.id });
        beginSearch(sim, a, 'lost sight');
        return;
      }
      const lk = a.lastKnown ?? { x: p.body.x, y: p.body.y, z: p.body.z };
      if (a.replanT <= 0 || !a.path) planTo(sim, a, lk.x, lk.y, lk.z);
      a.replanT -= dt;
      follow(sim, a, chase, dt);
      // Face the target when close.
      if (a.canSee[p.id]) turnToward(a, Math.atan2(-(p.body.x - a.x), -(p.body.z - a.z)), dt, 9);
      return;
    }
    case 'SEARCH': {
      if (tryCatch(sim, a)) return;
      if (reactToNoise(sim, a)) return;
      if (sim.time > a.searchUntil || !a.searchSpots.length) {
        a.sawHide = {};
        const t = patrolTarget(sim, a);
        setState(sim, a, 'PATROL', 'search over');
        if (t) planTo(sim, a, t.x, t.y, t.z);
        return;
      }
      const spot = a.searchSpots[0];
      const ex = nearestExit(sim, a, spot);
      const s = sim.spot(spot);
      if (goTo(sim, a, ex.x, sim.level.roomById[s.room].floorY, ex.z, patrol * 1.3, dt)) {
        a.searchSpots.shift();
        const keep = { spots: a.searchSpots, until: a.searchUntil };
        beginCheck(sim, a, spot, 'searching');
        a.searchSpots = keep.spots;
        a.searchUntil = keep.until;
      }
      return;
    }
    case 'CHECK': {
      const s = sim.spot(a.checkSpot);
      const ex = nearestExit(sim, a, a.checkSpot);
      const fy = sim.level.roomById[s.room].floorY;
      const atSpot = Math.hypot(ex.x - a.x, ex.z - a.z) < 0.6;
      if (!atSpot && a.checkStart < 0) {
        if (a.stateT > 12) {
          const tg = patrolTarget(sim, a);
          setState(sim, a, 'PATROL', 'could not reach spot');
          if (tg) planTo(sim, a, tg.x, tg.y, tg.z);
          return;
        }
        if (tryCatch(sim, a)) return;
        goTo(sim, a, ex.x, fy, ex.z, a.target ? chase : patrol * 1.3, dt);
        return;
      }
      if (a.checkStart < 0) a.checkStart = sim.time;
      const start = a.checkStart;
      const t = sim.time - start;
      a.speed = 0;
      a.anim = 'check';
      turnToward(a, Math.atan2(-(s.x - a.x), -(s.z - a.z)), dt, 8);
      if (!a.checkWarned) {
        a.checkWarned = true;
        a.checkOccupants = sim.spotOccupants(s.id).map((p) => p.id);
        for (const id of a.checkOccupants) {
          const p = sim.players.get(id);
          if (p) p.lastTell = sim.time;
        }
        sim.emit({ t: 'checkWarn', agent: a.id, spot: s.id });
      }
      let dur = FR.ai.CHECK_WARNING + a.checkDur;
      // Someone burst out during the warning: the agent is still mid-animation for a moment.
      const escaped = a.checkOccupants.some((id) => !sim.spotOccupants(s.id).some((p) => p.id === id));
      if (escaped) dur += FR.ai.CHECK_HEADSTART;
      if (t < dur) return;
      const found = sim.spotOccupants(s.id).filter((p) => p.hidden && p.hidden.phase !== 'exit');
      sim.emit({ t: 'check', agent: a.id, spot: s.id, found: found.length > 0 });
      if (found.length) {
        for (const p of found) {
          sim.catchPlayer(p, a.id, 'hiding', s.id);
          a.spared[p.id] = sim.time + 12;
        }
        afterCatch(sim, a);
        return;
      }
      for (const id of a.checkOccupants) delete a.sawHide[id];
      if (a.searchSpots.length && sim.time < a.searchUntil) {
        const keep = { spots: a.searchSpots, until: a.searchUntil };
        setState(sim, a, 'SEARCH', 'spot empty');
        a.searchSpots = keep.spots;
        a.searchUntil = keep.until;
      } else if (escaped) {
        a.lastKnown = null;
        beginSearch(sim, a, 'heard them run');
      } else {
        const tg = patrolTarget(sim, a);
        setState(sim, a, 'PATROL', 'nothing there');
        if (tg) planTo(sim, a, tg.x, tg.y, tg.z);
      }
      return;
    }
    case 'SATISFIED': {
      a.speed = 0;
      a.pauseT -= dt;
      if (a.pauseT > 0) return;
      if (a.id === 'foxy') {
        setState(sim, a, 'RETURN', 'back to the cove');
        return;
      }
      const t = patrolTarget(sim, a, FR.ai.AWAY_AFTER_CATCH);
      setState(sim, a, 'PATROL', 'moving on');
      if (t) planTo(sim, a, t.x, t.y, t.z);
      return;
    }
    case 'RETURN': {
      if (goTo(sim, a, a.home.x, a.home.y, a.home.z, patrol * 0.8, dt)) {
        a.yaw = a.home.yaw;
        setState(sim, a, 'DORMANT', 'home');
      }
      return;
    }
  }
}

function reactToNoise(sim: FrSim, a: Agent): boolean {
  if (!a.heard || sim.time - a.heard.t > 0.2) return false;
  if (a.state === 'INVESTIGATE' && a.goal && Math.hypot(a.goal.x - a.heard.x, a.goal.z - a.heard.z) < 3) return false;
  const h = a.heard;
  investigate(sim, a, h, `heard noise ${h.pri.toFixed(1)}`);
  return true;
}

/**
 * Bonnie appears out of nowhere: unseen for 20 s while patrolling, he skips up to two waypoints ahead,
 * only between points nobody can see and never into a room with a player in it.
 */
function bonnieRelocate(sim: FrSim, a: Agent): void {
  if (a.id !== 'bonnie' || a.unseenT < FR.ai.BONNIE_RELOCATE_AFTER || !a.path) return;
  // Walk up to 12 m along the path from here, stopping before any door.
  let left = 12;
  let x = a.x;
  let y = a.y;
  let z = a.z;
  let i = a.pathI;
  while (i < a.path.length && left > 0) {
    const wp = a.path[i];
    if (wp.door >= 0) break;
    const d = Math.hypot(wp.x - x, wp.z - z);
    if (d <= left) {
      left -= d;
      x = wp.x;
      y = wp.y;
      z = wp.z;
      i++;
    } else {
      x += ((wp.x - x) / d) * left;
      z += ((wp.z - z) / d) * left;
      y = wp.y;
      left = 0;
    }
  }
  if (Math.hypot(x - a.x, z - a.z) < 4) return;
  const room = sim.roomAt(x, y + 0.3, z);
  for (const p of sim.players.values()) {
    if (sim.playerSees(p, x, y + 1.6, z, true)) return;
    if (room && sim.roomAt(p.body.x, p.body.y + 0.3, p.body.z) === room) return;
  }
  a.x = x;
  a.y = y;
  a.z = z;
  a.pathI = i;
  a.unseenT = 0;
  sim.emit({ t: 'relocate', agent: a.id });
}
