import { FR, aggr } from '../../frConfig';
import { eyeHeight } from './controller';
import {
  afterCatch,
  goTo,
  investigate,
  makeAgent,
  patrolTarget,
  planTo,
  setState,
  tryCatch,
  turnToward,
  follow,
  type Agent,
} from './ai';
import type { FrPlayer, FrSim } from './sim';

// The core cast's rules (Part 6.5 to 6.8). Each returns true when it fully handled the agent this tick;
// otherwise the generic state machine in ai.ts runs.

const COVE_LOOK = { x: 8.5, y: 1.6, z: 16 };
const FOXY_LANE_END = { x: 18, y: 0, z: 50 };

function nearestLiving(sim: FrSim, a: Agent, opts: { includeHidden?: boolean; maxDist?: number } = {}): FrPlayer | null {
  let best: FrPlayer | null = null;
  let bd = opts.maxDist ?? Infinity;
  for (const p of sim.players.values()) {
    if (!sim.alive(p)) continue;
    if (p.hidden && !opts.includeHidden) continue;
    if (Math.abs(p.body.y - a.y) > 3) continue;
    const d = Math.hypot(p.body.x - a.x, p.body.z - a.z);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

export function tickCast(sim: FrSim, a: Agent, dt: number): boolean {
  // A blackout freezes everyone except Power-Out Freddy where they stand.
  if (sim.night.powerOut && a.id !== 'powerout') {
    if (a.state !== 'FROZEN') {
      setState(sim, a, 'FROZEN', 'blackout');
      a.target = null;
    }
    a.speed = 0;
    a.anim = 'frozen';
    return true;
  }
  if (a.state === 'FROZEN') {
    const home = a.id === 'foxy' || a.id === 'puppet';
    setState(sim, a, home ? 'RETURN' : 'PATROL', 'power back');
    if (!home) {
      const t = patrolTarget(sim, a);
      if (t) planTo(sim, a, t.x, t.y, t.z);
    }
  }
  switch (a.id) {
    case 'chica':
      return chica(sim, a, dt);
    case 'foxy':
      return foxy(sim, a, dt);
    case 'freddy':
      return freddy(sim, a, dt);
    case 'puppet':
      return puppet(sim, a, dt);
    case 'powerout':
      return powerOut(sim, a, dt);
    default:
      return false;
  }
}

// ---- Chica: food ------------------------------------------------------------------------------------

function chica(sim: FrSim, a: Agent, dt: number): boolean {
  const x = a.x2;
  if (a.state === 'EAT') {
    if (tryCatch(sim, a)) return true;
    a.speed = 0;
    a.anim = 'eat';
    x.clatter = (x.clatter ?? 0) - dt;
    if (x.clatter <= 0) {
      x.clatter = 1.2 + sim.rand() * 1.4;
      sim.emit({ t: 'clatter', agent: a.id, x: a.x, y: a.y, z: a.z });
    }
    if (sim.time >= (x.eatUntil ?? 0)) {
      x.ateAt = sim.time;
      const t = patrolTarget(sim, a);
      setState(sim, a, 'PATROL', 'full');
      if (t) planTo(sim, a, t.x, t.y, t.z);
    }
    return true;
  }
  if (a.state !== 'PATROL' && a.state !== 'INVESTIGATE') return false;
  // Smell: anyone carrying cupcakes within 20 m, through walls.
  x.smell = (x.smell ?? 0) - dt;
  if (x.smell <= 0) {
    x.smell = 1;
    for (const p of sim.players.values()) {
      if (!sim.alive(p) || !sim.night.has(p, 'cupcake')) continue;
      if (Math.hypot(p.body.x - a.x, p.body.z - a.z) > FR.ai.CHICA_SMELL || Math.abs(p.body.y - a.y) > 3) continue;
      investigate(sim, a, { x: p.body.x, y: p.body.y, z: p.body.z }, `smells cupcakes on ${p.name}`);
      return false;
    }
    // Placed birthday cupcakes: stop and admire each once.
    for (const it of sim.night.items) {
      if (it.plate < 0 || x[`admired${it.plate}`]) continue;
      if (Math.hypot(it.x - a.x, it.z - a.z) > 10) continue;
      x[`admired${it.plate}`] = 1;
      investigate(sim, a, { x: it.x + 0.9, y: 0, z: it.z }, 'a birthday cupcake');
      return false;
    }
  }
  // In the kitchen with nothing better to do: eat at the range.
  if (a.state === 'PATROL' && sim.roomAt(a.x, a.y + 0.3, a.z) === 'kitchen' && sim.time - (x.ateAt ?? -999) > 50 && (!a.path || a.pathI >= a.path.length)) {
    setState(sim, a, 'EAT', 'hungry');
    x.eatUntil = sim.time + FR.ai.CHICA_EAT[0] + sim.rand() * (FR.ai.CHICA_EAT[1] - FR.ai.CHICA_EAT[0]);
    return true;
  }
  return false;
}

// ---- Foxy: the cove and the sprint ------------------------------------------------------------------

function foxy(sim: FrSim, a: Agent, dt: number): boolean {
  const x = a.x2;
  if (a.state === 'DORMANT') {
    setState(sim, a, 'COVE', 'curtains closed');
    x.stage = 0;
    x.lastLook = sim.time;
  }
  if (a.state === 'COVE') {
    a.speed = 0;
    a.anim = x.stage >= 1 ? 'peek' : 'idle';
    let seen = false;
    for (const p of sim.players.values()) if (sim.playerSees(p, COVE_LOOK.x, COVE_LOOK.y, COVE_LOOK.z, true)) seen = true;
    if (seen) {
      x.lastLook = sim.time;
      if (!x.seenPrev) x.freezeUntil = sim.time + FR.ai.FOXY_FREEZE[0] + sim.rand() * (FR.ai.FOXY_FREEZE[1] - FR.ai.FOXY_FREEZE[0]);
    }
    x.seenPrev = seen ? 1 : 0;
    a.decisionT -= dt;
    if (a.decisionT > 0 || a.aggression <= 0 || sim.time < a.activeAt) return true;
    a.decisionT = aggr(FR.ai.DECISION_INTERVAL, a.aggression);
    if (sim.time < (x.freezeUntil ?? 0)) return true;
    const bonus = sim.time - (x.lastLook ?? 0) > FR.ai.FOXY_NEGLECT ? FR.ai.FOXY_NEGLECT_BONUS : 0;
    if (1 + Math.floor(sim.rand() * 20) > a.aggression + bonus) return true;
    x.stage = (x.stage ?? 0) + 1;
    sim.emit({ t: 'cove', stage: x.stage });
    if (x.stage >= 3) startSprint(sim, a);
    return true;
  }
  if (a.state === 'SPRINT') {
    x.sprintT = (x.sprintT ?? 0) + dt;
    // A focused beam in his face in the first two seconds sends him back (FNAF 2 rule).
    if (x.sprintT < 2) {
      for (const p of sim.players.values()) {
        if (!sim.alive(p) || !p.flashOn || p.battery <= 0) continue;
        const dx = a.x - p.body.x;
        const dz = a.z - p.body.z;
        const d = Math.hypot(dx, dz);
        const cos = (dx * -Math.sin(p.body.yaw) + dz * -Math.cos(p.body.yaw)) / (d || 1);
        if (d < 12 && cos > 0.96 && sim.world.clearLine(p.body.x, p.body.y + eyeHeight(p.body), p.body.z, a.x, a.y + 1.4, a.z)) {
          sim.emit({ t: 'foxyBack', agent: a.id, why: 'light' });
          endSprint(sim, a, 'the light');
          return true;
        }
      }
    }
    if (tryCatch(sim, a)) {
      x.stage = 0;
      return true;
    }
    const target = nearestLiving(sim, a);
    if (!target) {
      x.lost = (x.lost ?? 0) + dt;
      if (x.lost > 4) {
        endSprint(sim, a, 'lost everyone');
        return true;
      }
    } else x.lost = 0;
    x.replan = (x.replan ?? 0) - dt;
    if (x.replan <= 0 || !a.path) {
      x.replan = 0.5;
      const t = target ? target.body : FOXY_LANE_END;
      planTo(sim, a, t.x, t.y, t.z);
    }
    // Doors on the way: he smashes swing doors and bangs on closed shutters.
    const wp = a.path && a.path[a.pathI];
    if (wp && wp.door >= 0 && sim.world.doorOpen[wp.door] < 0.7) {
      const d = sim.level.doors[wp.door];
      const prev = a.path?.[a.pathI - 1] ?? { x: a.x, z: a.z };
      if (Math.hypot(prev.x - a.x, prev.z - a.z) < 0.6) {
        if (d.kind === 'shutter' || d.kind === 'roller' || d.locked) {
          knock(sim, a, wp.door);
          return true;
        }
        sim.world.doorOpen[wp.door] = 1;
        sim.setDoor(wp.door, true, a.key);
        const mx = d.axis === 'z' ? (d.from + d.to) / 2 : d.line;
        const mz = d.axis === 'z' ? d.line : (d.from + d.to) / 2;
        sim.noise(mx, d.floorY + 1, mz, FR.noise.DOOR_FORCE);
      }
    }
    const bx = a.x;
    const bz = a.z;
    follow(sim, a, FR.ai.FOXY_SPRINT_SPEED, dt);
    a.anim = 'run';
    x.dist = (x.dist ?? 0) + Math.hypot(a.x - bx, a.z - bz);
    if (x.dist > FR.ai.FOXY_SPRINT_MAX) endSprint(sim, a, 'ran out of steam');
    return true;
  }
  if (a.state === 'RETURN' && sim.roomAt(a.x, a.y + 0.3, a.z) === 'cove' && Math.hypot(a.x - a.home.x, a.z - a.home.z) < 0.8) {
    a.yaw = a.home.yaw;
    setState(sim, a, 'COVE', 'back behind the curtain');
    x.stage = sim.rand() < 0.5 ? 0 : 1;
    return true;
  }
  // Foxy never searches or patrols: anything else sends him home.
  if (a.state !== 'RETURN' && a.state !== 'SATISFIED') {
    setState(sim, a, 'RETURN', 'nothing to sprint at');
    return false;
  }
  return false;
}

function startSprint(sim: FrSim, a: Agent): void {
  setState(sim, a, 'SPRINT', 'out of the cove');
  a.x2.sprintT = 0;
  a.x2.dist = 0;
  a.x2.lost = 0;
  a.x2.replan = 0;
  sim.emit({ t: 'foxyRun', agent: a.id });
  // Everyone near the lane gets the shriek as a tell.
  for (const p of sim.players.values()) p.lastTell = sim.time;
}

function endSprint(sim: FrSim, a: Agent, why: string): void {
  setState(sim, a, 'RETURN', why);
  a.x2.stage = 0;
}

function knock(sim: FrSim, a: Agent, door: number): void {
  const n = sim.night;
  const count = (sim.knocks = (sim.knocks ?? 0) + 1);
  const drain = FR.ai.FOXY_KNOCK_DRAIN_START + FR.ai.FOXY_KNOCK_DRAIN_STEP * (count - 1);
  n.power = Math.max(0, n.power - drain);
  sim.emit({ t: 'foxyKnock', door, drain });
  const d = sim.level.doors[door];
  const mx = d.axis === 'z' ? (d.from + d.to) / 2 : d.line;
  const mz = d.axis === 'z' ? d.line : (d.from + d.to) / 2;
  sim.noise(mx, d.floorY + 1, mz, FR.noise.DOOR_SLAM);
  a.anim = 'knock';
  endSprint(sim, a, 'a closed door');
}

// ---- Freddy: the weeping angel ----------------------------------------------------------------------

function freddy(sim: FrSim, a: Agent, dt: number): boolean {
  const x = a.x2;
  if (a.state === 'DORMANT') {
    if (a.aggression > 0 && sim.time >= a.activeAt) setState(sim, a, 'STALK', 'awake');
    return true;
  }
  if (a.state === 'SATISFIED' || a.state === 'RETURN') return false;
  if (a.state !== 'STALK') setState(sim, a, 'STALK', 'stalking');
  // Is anyone looking? Then he doesn't move at all.
  let seen = false;
  for (const p of sim.players.values()) {
    if (sim.playerSees(p, a.x, a.y + 1.7, a.z, true) || sim.playerSees(p, a.x, a.y + 1.0, a.z, true)) {
      seen = true;
      x[`saw:${p.id}`] = sim.time;
    }
  }
  if (seen) {
    if (x.moving) {
      x.moving = 0;
      sim.emit({ t: 'laugh', agent: a.id, x: a.x, y: a.y, z: a.z });
    }
    a.speed = 0;
    a.anim = 'frozen';
    return true;
  }
  if (tryCatch(sim, a)) return true;
  x.moving = 1;
  const target = nearestLiving(sim, a, { maxDist: 25 });
  x.replan = (x.replan ?? 0) - dt;
  if (target) {
    if (x.replan <= 0 || !a.path) {
      x.replan = 0.4;
      planTo(sim, a, target.body.x, target.body.y, target.body.z);
    }
    // Never more than 6 m per unseen second.
    follow(sim, a, Math.min(FR.ai.FREDDY_MAX_UNSEEN_STEP, aggr(FR.ai.CHASE_SPEED, a.aggression)), dt);
    if (Math.hypot(target.body.x - a.x, target.body.z - a.z) < 3) turnToward(a, Math.atan2(-(target.body.x - a.x), -(target.body.z - a.z)), dt, 8);
  } else {
    if (!a.path || a.pathI >= a.path.length) {
      const t = patrolTarget(sim, a);
      if (t) planTo(sim, a, t.x, t.y, t.z);
    }
    follow(sim, a, aggr(FR.ai.PATROL_SPEED, a.aggression), dt);
  }
  return true;
}

/** Freddy can't catch a player who had him on screen in the last 0.4 s (a quick glance back is enough). */
export function freddyGrace(sim: FrSim, a: Agent, pid: string): boolean {
  return a.id === 'freddy' && sim.time - (a.x2[`saw:${pid}`] ?? -99) < FR.ai.FREDDY_GRACE;
}

// ---- The Puppet: the music box ----------------------------------------------------------------------

function puppet(sim: FrSim, a: Agent, dt: number): boolean {
  const x = a.x2;
  const box = sim.night.musicBox;
  if (a.state === 'DORMANT') {
    a.speed = 0;
    a.anim = 'idle';
    if (sim.night.musicFailed && box <= 0 && sim.time >= a.activeAt) {
      setState(sim, a, 'PUPPET', 'the music stopped');
      x.rise = 2.5;
      sim.emit({ t: 'puppetOut' });
      for (const p of sim.players.values()) p.lastTell = sim.time;
    }
    return true;
  }
  if (a.state === 'PUPPET') {
    if (box > FR.ai.PUPPET_RECALL) {
      setState(sim, a, 'RETURN', 'wound back up');
      sim.emit({ t: 'puppetBack' });
      return true;
    }
    a.anim = 'float';
    if (x.rise > 0) {
      x.rise -= dt;
      a.speed = 0;
      return true;
    }
    // It knows where you are, hidden or not.
    const target = nearestLiving(sim, a, { includeHidden: true });
    if (!target) {
      a.speed = 0;
      return true;
    }
    const d = Math.hypot(target.body.x - a.x, target.body.z - a.z);
    if (d < FR.ai.CATCH_RANGE + FR.player.RADIUS && Math.abs(target.body.y - a.y) < 1.5) {
      sim.catchPlayer(target, 'puppet', target.hidden ? 'hiding' : 'standard', target.hidden?.spot, true);
      a.spared[target.id] = sim.time + 4;
      return true;
    }
    x.replan = (x.replan ?? 0) - dt;
    if (x.replan <= 0 || !a.path) {
      x.replan = 0.5;
      planTo(sim, a, target.body.x, target.body.y, target.body.z);
    }
    x.ghost = 1;
    follow(sim, a, FR.ai.PUPPET_SPEED, dt);
    a.anim = 'float';
    return true;
  }
  if (a.state === 'RETURN') {
    a.x2.ghost = 1;
    if (goTo(sim, a, a.home.x, a.home.y, a.home.z, FR.ai.PUPPET_RETURN_SPEED, dt)) {
      a.yaw = a.home.yaw;
      setState(sim, a, 'DORMANT', 'folded back into the box');
    }
    a.anim = 'float';
    return true;
  }
  setState(sim, a, 'RETURN', 'back to the box');
  return true;
}

// ---- Power-Out Freddy -------------------------------------------------------------------------------

/** Called by the sim a few seconds after the blackout starts. */
export function spawnPowerOut(sim: FrSim): Agent | null {
  // The zone with the most living players; a spot 8 to 16 m from them that nobody can see.
  const living = [...sim.players.values()].filter((p) => sim.alive(p));
  if (!living.length) return null;
  const count = new Map<string, number>();
  for (const p of living) {
    const r = sim.roomAt(p.body.x, p.body.y + 0.3, p.body.z);
    if (r) count.set(r, (count.get(r) ?? 0) + 1);
  }
  const busiest = [...count.entries()].sort((q, w) => w[1] - q[1])[0]?.[0] ?? 'dining';
  const focus = living.find((p) => sim.roomAt(p.body.x, p.body.y + 0.3, p.body.z) === busiest) ?? living[0];
  let best = -1;
  for (let tries = 0; tries < 400; tries++) {
    const n = Math.floor(sim.rand() * sim.nav.size);
    const d = Math.hypot(sim.nav.xs[n] - focus.body.x, sim.nav.zs[n] - focus.body.z);
    if (d < 8 || d > 16 || Math.abs(sim.nav.ys[n] - focus.body.y) > 1) continue;
    if (living.some((p) => sim.playerSees(p, sim.nav.xs[n], sim.nav.ys[n] + 1.6, sim.nav.zs[n]))) continue;
    best = n;
    break;
  }
  if (best < 0) return null;
  const a = makeAgent(sim, 'powerout', 15, 0);
  a.x = sim.nav.xs[best];
  a.y = sim.nav.ys[best];
  a.z = sim.nav.zs[best];
  a.yaw = Math.atan2(-(focus.body.x - a.x), -(focus.body.z - a.z));
  setState(sim, a, 'SONG', 'the lights are out');
  a.x2.songUntil = sim.time + FR.ai.POWEROUT_SONG[0] + sim.rand() * (FR.ai.POWEROUT_SONG[1] - FR.ai.POWEROUT_SONG[0]);
  sim.emit({ t: 'toreador', x: a.x, y: a.y, z: a.z });
  for (const p of sim.players.values()) p.lastTell = sim.time;
  return a;
}

function powerOut(sim: FrSim, a: Agent, dt: number): boolean {
  if (a.state === 'SONG') {
    a.speed = 0;
    a.anim = 'sing';
    if (sim.time >= (a.x2.songUntil ?? 0)) {
      setState(sim, a, 'HUNT', 'the song ended');
      sim.emit({ t: 'songEnd' });
    }
    return true;
  }
  if (a.state === 'SATISFIED') return false;
  if (a.state !== 'HUNT') setState(sim, a, 'HUNT', 'hunting');
  if (tryCatch(sim, a)) return true;
  const target = nearestLiving(sim, a);
  a.x2.replan = (a.x2.replan ?? 0) - dt;
  if (target && (a.x2.replan <= 0 || !a.path)) {
    a.x2.replan = 0.5;
    planTo(sim, a, target.body.x, target.body.y, target.body.z);
  }
  // He can't open doors: a closed door is a real defence in the dark.
  a.x2.noDoors = 1;
  follow(sim, a, FR.ai.POWEROUT_SPEED, dt);
  if (target && Math.hypot(target.body.x - a.x, target.body.z - a.z) < 3) turnToward(a, Math.atan2(-(target.body.x - a.x), -(target.body.z - a.z)), dt, 8);
  return true;
}

export { afterCatch };
