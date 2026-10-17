import { CONFIG, secs } from '../config';
import { chance, pick } from '../rng';
import type { StationTool } from '../content/mapTypes';
import { COOP_MAP, SOLO_STATION } from '../content/map.coop';
import { hourlyBumps } from '../content/nights';
import type { PlayerInput, StationState, World } from './types';
import {
  checkAllDead,
  emit,
  endNight,
  isLive,
  kill,
  liveStations,
  sendHome,
  stationDoors,
  stationOfPlayer,
  watchers,
} from './world';
import { stepPower, stepPowerOut } from './power';
import { stepMaintenance, startReboot } from './maintenance';
import { officeTick, opportunity, ventTick, walkerMove } from './animatronics/base';
import { foxyTick } from './animatronics/foxy';
import { golden1987, goldenTick, onCameraView, onTabletChange } from './animatronics/golden';
import { musicBoxTick } from './animatronics/puppet';
import { pluginHooks } from './animatronics/plugins';
import { applyShowtimeInput } from './showtime';

export function stationTools(world: World, s: StationState): readonly StationTool[] {
  if (s.id === 'solo') return SOLO_STATION.tools;
  if (s.id === 'office') return [];
  return COOP_MAP.stations.find((x) => x.id === s.id)?.tools ?? [];
}

function reject(world: World, pid: string, seq: number, reason: string): void {
  emit(world, { type: 'reject', seq, reason, to: [pid] });
}

function rateLimited(world: World, s: StationState): boolean {
  const cutoff = world.tick - CONFIG.TICK_HZ;
  s.lastPressTicks = s.lastPressTicks.filter((t) => t > cutoff);
  if (s.lastPressTicks.length >= CONFIG.doors.MAX_PRESSES_PER_SEC) return true;
  s.lastPressTicks.push(world.tick);
  return false;
}

export function applyInput(world: World, pi: PlayerInput): void {
  const { pid, seq, input } = pi;
  const player = world.players[pid];
  if (!player) return;
  if (input.action === 'showtime_move' || input.action === 'showtime_ability') {
    applyShowtimeInput(world, pid, input, seq);
    return;
  }
  const s = stationOfPlayer(world, pid);
  if (!s) return;

  // Ghost and connection actions first.
  if (input.action === 'disconnect') {
    if (!s.connected) return;
    s.connected = false;
    s.disconnectedAt = world.tick;
    s.tablet = false;
    s.flashlight = false;
    s.mic = false;
    s.windHeld = false;
    for (const d of stationDoors(world, s.id)) world.doors[d].light = false;
    emit(world, { type: 'autopilot', station: s.id });
    return;
  }
  if (input.action === 'reconnect') {
    s.connected = true;
    s.disconnectedAt = null;
    emit(world, { type: 'reconnected', station: s.id });
    return;
  }
  if (input.action === 'ping') {
    if (!world.map.nodes[input.node]) return;
    s.pingNode = input.node;
    s.pingUntil = world.tick + secs(CONFIG.ping.DURATION);
    const ghost = !s.alive;
    if (ghost) world.ghostPingByNode[input.node] = { tick: world.tick, by: s.id };
    emit(world, { type: 'ping', node: input.node, from: pid, name: s.name, station: s.id, ghost });
    return;
  }
  if (input.action === 'camera') {
    if (!world.map.nodes[input.node]?.cam) return reject(world, pid, seq, 'bad_camera');
    if (s.alive && !s.tablet) return reject(world, pid, seq, 'tablet_down');
    if (s.cam !== input.node) {
      s.cam = input.node;
      s.camSince = world.tick;
      if (s.alive) {
        s.stats.cameraChecks++;
        onCameraView(world, s);
      }
    }
    return;
  }
  if (input.action === 'vote_mute') {
    const c = world.call;
    if (!c || c.muted || !isLive(s) || c.votes.includes(pid)) return;
    c.votes.push(pid);
    const living = liveStations(world).length;
    emit(world, { type: 'mute_vote', votes: c.votes.length, needed: Math.ceil(living / 2) });
    if (c.votes.length >= Math.ceil(living / 2)) {
      c.muted = true;
      emit(world, { type: 'call_muted' });
    }
    return;
  }
  if (input.action === 'nose') {
    s.stats.noseHonks++;
    emit(world, { type: 'honk', to: [pid] });
    return;
  }

  if (!isLive(s) || !s.connected) return reject(world, pid, seq, 'dead');
  if (s.rebooting) return reject(world, pid, seq, 'rebooting');

  switch (input.action) {
    case 'locker_click': {
      if (s.tablet && s.cam === world.map.backstageNode && world.night === 5 && world.hour === 3) {
        s.stats.lockerClicks++;
        if (s.stats.lockerClicks >= 5 && !s.stats.secret) {
          s.stats.secret = true;
          emit(world, { type: 'secret_found', to: [pid] });
        }
      }
      return;
    }
    case 'door': {
      const door = world.doors[input.door];
      if (!door || world.doorStation[input.door] !== s.id) return reject(world, pid, seq, 'not_yours');
      if (door.closed === input.closed) return;
      if (s.tablet) return reject(world, pid, seq, 'tablet_up');
      if (s.mask) return reject(world, pid, seq, 'masked');
      if (door.jammed || door.blockedBy) {
        emit(world, { type: 'error_buzz', door: door.id, to: [pid] });
        return reject(world, pid, seq, 'jammed');
      }
      if (world.tick - door.lastToggleTick < secs(CONFIG.doors.TOGGLE_COOLDOWN)) return reject(world, pid, seq, 'cooldown');
      if (rateLimited(world, s)) return reject(world, pid, seq, 'rate');
      door.closed = input.closed;
      door.lastToggleTick = world.tick;
      if (door.closed) {
        door.closedSince = world.tick;
        s.stats.doorsClosed++;
        s.everClosedDoor = true;
        ghostAssistCheck(world, door.id);
      }
      emit(world, { type: 'door', door: door.id, closed: door.closed, station: s.id });
      pluginHooks.door(world, s, door.id, door.closed);
      return;
    }
    case 'light': {
      const door = world.doors[input.door];
      if (!door || world.doorStation[input.door] !== s.id) return reject(world, pid, seq, 'not_yours');
      if (!input.on) {
        door.light = false;
        return;
      }
      if (s.tablet) return reject(world, pid, seq, 'tablet_up');
      if (s.mask) return reject(world, pid, seq, 'masked');
      if (door.blockedBy || world.powerOut.active) {
        emit(world, { type: 'error_buzz', door: door.id, to: [pid] });
        return reject(world, pid, seq, 'jammed');
      }
      if (door.lightDeadUntil > world.tick || s.lightsOutUntil > world.tick) {
        emit(world, { type: 'error_buzz', door: door.id, to: [pid] });
        return reject(world, pid, seq, 'lights_dead');
      }
      if (rateLimited(world, s)) return reject(world, pid, seq, 'rate');
      door.light = true;
      pluginHooks.light(world, s, door.id);
      return;
    }
    case 'tablet': {
      if (s.tablet === input.up) return;
      if (input.up) {
        if (s.mask) return reject(world, pid, seq, 'masked');
        if (world.powerOut.active) return reject(world, pid, seq, 'no_power');
        if (s.tabletBlockedUntil > world.tick) return reject(world, pid, seq, 'blocked');
        for (const d of stationDoors(world, s.id)) world.doors[d].light = false;
        s.flashlight = false;
        s.everRaisedTablet = true;
      }
      s.tablet = input.up;
      s.tabletChangedTick = world.tick;
      if (s.tablet) {
        s.stats.cameraChecks++;
        onCameraView(world, s);
      }
      onTabletChange(world, s);
      return;
    }
    case 'tool': {
      const tools = stationTools(world, s);
      switch (input.tool) {
        case 'flashlight':
          if (!tools.includes('flashlight')) return reject(world, pid, seq, 'no_tool');
          if (input.on && (s.tablet || s.battery <= 0 || world.powerOut.active)) return reject(world, pid, seq, 'cant');
          s.flashlight = input.on;
          return;
        case 'mic':
          if (!tools.includes('mic')) return reject(world, pid, seq, 'no_tool');
          s.mic = input.on && !world.powerOut.active;
          return;
        case 'mask':
          if (!tools.includes('mask')) return reject(world, pid, seq, 'no_tool');
          if (input.on && s.tablet) return reject(world, pid, seq, 'tablet_up');
          s.mask = input.on;
          if (input.on) {
            s.maskTick = world.tick;
            for (const d of stationDoors(world, s.id)) world.doors[d].light = false;
          }
          return;
        case 'wind':
          s.windHeld = input.on;
          return;
        case 'panel':
          if (!tools.includes('panel')) return reject(world, pid, seq, 'no_tool');
          s.panel = input.on;
          return;
        case 'reboot':
          if (s.id !== 'control') return reject(world, pid, seq, 'no_tool');
          if (!startReboot(world, input.system)) return reject(world, pid, seq, 'cant');
          return;
        case 'lure': {
          if (s.id !== 'control') return reject(world, pid, seq, 'no_tool');
          if (world.maintenance.failed.audio !== undefined) return reject(world, pid, seq, 'audio_down');
          if (s.lureCooldownUntil > world.tick) return reject(world, pid, seq, 'cooldown');
          if (!world.map.nodes[input.node]) return reject(world, pid, seq, 'bad_node');
          s.lureCooldownUntil = world.tick + secs(CONFIG.lure.COOLDOWN);
          world.lure = { node: input.node, until: world.tick + secs(CONFIG.lure.DURATION) };
          emit(world, { type: 'lure', node: input.node });
          const near = world.anims.filter(
            (a) =>
              a.active &&
              a.subPos === 'room' &&
              ['bonnie', 'chica'].includes(a.id) &&
              world.map.nodes[a.node].links.includes(input.node),
          );
          if (near.length && chance(world.rng, CONFIG.lure.PULL_CHANCE)) {
            const a = pick(world.rng, near);
            emit(world, { type: 'moved', anim: a.id, from: a.node, dst: input.node });
            a.node = input.node;
          }
          pluginHooks.lure(world, input.node);
          return;
        }
        case 'boost': {
          if (s.id !== 'control') return reject(world, pid, seq, 'no_tool');
          if (s.boostCooldownUntil > world.tick) return reject(world, pid, seq, 'cooldown');
          const target = world.stations[input.station];
          if (!isLive(target)) return reject(world, pid, seq, 'bad_station');
          target.boostUntil = world.tick + secs(CONFIG.power.BOOST_DURATION);
          s.boostCooldownUntil = world.tick + secs(CONFIG.power.BOOST_COOLDOWN);
          emit(world, { type: 'boost', station: input.station });
          return;
        }
      }
      return;
    }
  }
}

function ghostAssistCheck(world: World, doorId: string): void {
  const from = world.map.doors[doorId]?.from;
  if (!from) return;
  const nearby = world.anims.some((a) => a.active && (a.node === from || a.door === doorId));
  const p = world.ghostPingByNode[from];
  if (nearby && p && world.tick - p.tick <= secs(5)) {
    const g = world.stations[p.by as 'west'];
    if (g && !g.alive) g.stats.ghostAssist = true;
  }
}

/** Advance the world by one fixed tick. Pure apart from mutating `world`; returns the tick's events. */
export function step(world: World, inputs: PlayerInput[] = []): World['events'] {
  world.events = [];
  for (const i of inputs) applyInput(world, i);
  if (world.ended) return world.events;

  world.tick++;
  if (world.tick === 1) golden1987(world);
  if (world.call && world.tick === world.call.startTick) emit(world, { type: 'call_start', night: world.call.night });

  // Clock.
  const hour = Math.floor(world.tick / world.hourTicks);
  if (hour !== world.hour) {
    world.hour = hour;
    if (hour >= CONFIG.HOURS_PER_NIGHT) {
      const anyone = world.stationOrder.some((id) => {
        const s = world.stations[id];
        return s && !s.sealed && s.alive && !(s.abandoned && !s.connected);
      });
      endNight(world, anyone ? 'win' : 'loss');
      return world.events;
    }
    emit(world, { type: 'hour', hour });
    const bumps = hourlyBumps(world.mode, hour);
    for (const a of world.anims) {
      const b = bumps[a.id as keyof typeof bumps];
      if (b) a.aiLevel = Math.min(20, a.aiLevel + b);
    }
    pluginHooks.hour(world, hour);
  }

  stepStations(world);
  stepPower(world);
  stepMaintenance(world);
  musicBoxTick(world);

  if (!world.powerOut.active) {
    stepAnimatronics(world);
    pluginHooks.tick(world);
    goldenTick(world);
    tells(world);
  } else {
    stepPowerOut(world, (sid) => kill(world, sid, 'freddy', 'powerout'));
  }

  if (world.lure && world.tick >= world.lure.until) world.lure = null;
  checkAllDead(world);
  return world.events;
}

function stepStations(world: World): void {
  for (const id of world.stationOrder) {
    const s = world.stations[id];
    if (!s || s.sealed) continue;
    if (!s.alive) {
      s.stats.ghostTicks++;
      continue;
    }
    if (s.tablet) s.stats.tabletTicks++;
    // Flashlight battery.
    if (s.flashlight) {
      s.battery = Math.max(0, s.battery - CONFIG.flashlight.DRAIN_PER_SEC / CONFIG.TICK_HZ);
      if (s.battery <= 0) s.flashlight = false;
    } else {
      s.battery = Math.min(100, s.battery + CONFIG.flashlight.RECHARGE_PER_SEC / CONFIG.TICK_HZ);
    }
    if (s.tablet && s.tabletBlockedUntil > world.tick) s.tablet = false;
    // Disconnect autopilot.
    if (!s.connected && !s.abandoned && s.disconnectedAt !== null && world.tick - s.disconnectedAt >= secs(CONFIG.disconnect.AUTOPILOT_SECONDS)) {
      s.abandoned = true;
      for (const d of stationDoors(world, s.id)) {
        world.doors[d].closed = true;
        world.doors[d].jammed = true;
        world.doors[d].light = false;
      }
      for (const a of world.anims) {
        if (a.station === s.id) sendHome(world, a);
        if (a.targetDoor && world.doorStation[a.targetDoor] === s.id) a.targetDoor = null;
      }
      emit(world, { type: 'abandoned', station: s.id });
    }
    if (s.pingUntil && world.tick >= s.pingUntil) {
      s.pingNode = null;
      s.pingUntil = 0;
    }
  }
  for (const s of Object.values(world.stations)) {
    if (s && !s.alive && s.pingUntil && world.tick >= s.pingUntil) {
      s.pingNode = null;
      s.pingUntil = 0;
    }
  }
  if (world.musicBox.enabled) {
    for (const s of liveStations(world)) s.stats.musicBoxMin = Math.min(s.stats.musicBoxMin, world.musicBox.level);
  }
}

function stepAnimatronics(world: World): void {
  const A = CONFIG.animatronics;
  if (watchers(world, world.map.stageNode).length) world.lastStageWatchTick = world.tick;
  for (const a of world.anims) {
    if (!a.active) continue;
    if (a.subPos === 'in_office') {
      officeTick(world, a);
      continue;
    }
    if (a.subPos === 'in_vent') {
      ventTick(world, a);
      continue;
    }
    switch (a.id) {
      case 'foxy':
        foxyTick(world, a);
        break;
      case 'freddy': {
        // Rush: late, high AI, stage unwatched for 30 s.
        a.flags.rush =
          world.night >= 5 && world.hour >= 4 && a.node === world.map.stageNode && world.tick - world.lastStageWatchTick > secs(A.FREDDY_RUSH_UNWATCHED)
            ? 1
            : 0;
        const watched = watchers(world, a.node).length > 0;
        if (watched) {
          // Can't take opportunities while watched; his timer still runs.
          a.moveTimer -= 1;
          if (a.moveTimer <= 0) a.moveTimer += A.INTERVALS.freddy * CONFIG.TICK_HZ;
          break;
        }
        if (opportunity(world, a)) walkerMove(world, a);
        break;
      }
      case 'bonnie':
      case 'chica':
        if (opportunity(world, a)) walkerMove(world, a);
        break;
      default:
        break; // puppet, golden and plugins run elsewhere
    }
  }
}

/** Flicker tells, window stings, flashlight blinding. */
function tells(world: World): void {
  const period = secs(CONFIG.lights.NEAR_FLICKER_PERIOD);
  for (const door of Object.values(world.doors)) {
    const s = world.stations[door.station];
    if (!isLive(s) || !s.playerId) continue;
    const from = world.map.doors[door.id].from;
    if (world.tick % period === 0) {
      const near = world.anims.some((a) => a.active && a.node === from && a.subPos === 'room' && a.targetDoor === door.id);
      if (near && chance(world.rng, CONFIG.lights.NEAR_FLICKER_CHANCE)) emit(world, { type: 'flicker', door: door.id, to: [s.playerId] });
    }
    if (door.light) {
      for (const a of world.anims) {
        if (!a.active || a.subPos !== 'at_door' || a.door !== door.id) continue;
        if (a.id === 'freddy') continue;
        if (door.stung !== a.id) {
          door.stung = a.id;
          emit(world, { type: 'sting', anim: a.id, door: door.id, to: [s.playerId] });
        }
      }
    }
  }
  // West flashlight blinds Bonnie in the corner, once per approach.
  for (const s of liveStations(world)) {
    if (!s.flashlight) continue;
    for (const a of world.anims) {
      if (a.id !== 'bonnie' || a.node !== world.map.posterNode || a.flags.blinded) continue;
      a.flags.blinded = 1;
      a.moveTimer += secs(CONFIG.flashlight.BONNIE_BLIND);
      emit(world, { type: 'bonnie_blind', to: s.playerId ? [s.playerId] : [] });
    }
  }
}
