import { CONFIG } from '../config';
import { range } from '../rng';
import type { StationState, World } from './types';
import { emit, isLive, liveStations, stationDoors } from './world';
import { secs } from '../config';

export function stationUsage(world: World, s: StationState): number {
  if (s.sealed || !s.alive || s.abandoned) return 0;
  let u = 1;
  for (const d of stationDoors(world, s.id)) {
    const door = world.doors[d];
    if (door.closed) u++;
    if (door.light) u++;
  }
  if (!s.connected) return u; // autopilot: present, passive
  if (s.tablet) u++;
  if (s.flashlight) u++;
  if (s.mic) u++;
  return u;
}

/** Percent of power drained per second right now. */
export function drainPerSecond(world: World): number {
  const scale = world.mode === 'classic' ? 1 : (CONFIG.power.CO_OP_POWER_SCALE[world.guardCount] ?? 1);
  let total = 0;
  for (const id of world.stationOrder) {
    const s = world.stations[id];
    if (!s) continue;
    s.usage = stationUsage(world, s);
    if (s.usage === 0) continue;
    let d = (CONFIG.power.BASE_DRAIN_PER_USAGE[Math.min(6, s.usage)] ?? 0) * scale;
    if (s.boostUntil > world.tick) d *= CONFIG.power.BOOST_FACTOR;
    total += d;
  }
  if (world.maintenance.failed.power !== undefined) total *= CONFIG.power.POWER_ROUTING_FAIL_FACTOR;
  const passive = world.passiveDrain * (world.mode === 'classic' ? CONFIG.power.CLASSIC_PASSIVE_SCALE : CONFIG.power.CO_OP_PASSIVE_SCALE);
  return total + passive;
}

export function stepPower(world: World): void {
  if (world.powerOut.active) return;
  const perTick = drainPerSecond(world) / CONFIG.TICK_HZ;
  world.power = Math.max(0, world.power - perTick);
  for (const s of liveStations(world)) s.stats.powerUsed += perTick / Math.max(1, liveStations(world).length);
  if (world.power <= 0) startPowerOut(world);
}

export function drainPower(world: World, pct: number): void {
  world.power = Math.max(0, world.power - pct);
  if (world.power <= 0 && !world.powerOut.active) startPowerOut(world);
}

export function startPowerOut(world: World): void {
  const po = world.powerOut;
  po.active = true;
  po.startTick = world.tick;
  world.power = 0;
  for (const door of Object.values(world.doors)) {
    door.closed = false;
    door.jammed = true;
    door.light = false;
  }
  for (const s of Object.values(world.stations)) {
    if (!s) continue;
    s.tablet = false;
    s.flashlight = false;
    s.mic = false;
    s.mask = false;
  }
  // Only Freddy's sequence matters now.
  for (const a of world.anims) {
    if (a.subPos === 'in_office') {
      a.attackTimer = null;
      a.forceTimer = null;
    }
  }
  const order = liveStations(world).map((s) => s.id);
  // Shuffle the order so a random living guard goes first.
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(range(world.rng, 0, i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  po.queue = order;
  po.current = null;
  po.phase = 'between';
  po.phaseEnd = world.tick + secs(range(world.rng, ...CONFIG.powerOut.PAUSE));
  emit(world, { type: 'power_out' });
}

export function stepPowerOut(world: World, killFn: (sid: StationState['id']) => void): void {
  const po = world.powerOut;
  if (!po.active || world.ended) return;
  const C = CONFIG.powerOut;
  if (po.current && !isLive(world.stations[po.current])) {
    po.current = null;
    po.phase = 'between';
    po.phaseEnd = world.tick + secs(range(world.rng, ...C.NEXT_STATION_PAUSE));
  }
  if (world.tick < po.phaseEnd && po.phase !== 'song' && po.phase !== 'dark') return;
  switch (po.phase) {
    case 'between': {
      const next = po.queue.find((id) => isLive(world.stations[id]));
      po.queue = po.queue.filter((id) => id !== next);
      if (!next) {
        po.phase = 'done';
        return;
      }
      po.current = next;
      po.phase = 'song';
      po.phaseEnd = world.tick + secs(C.SONG_MAX);
      po.nextRoll = world.tick + secs(C.SONG_END_SLICE);
      const s = world.stations[next];
      emit(world, { type: 'po_song', station: next, to: s?.playerId ? [s.playerId] : [] });
      emit(world, { type: 'po_song_far', station: next });
      return;
    }
    case 'song': {
      let end = world.tick >= po.phaseEnd;
      if (!end && world.tick >= po.nextRoll) {
        po.nextRoll = world.tick + secs(C.SONG_END_SLICE);
        end = range(world.rng, 0, 1) < C.SONG_END_CHANCE;
      }
      if (end) {
        po.phase = 'dark';
        po.phaseEnd = world.tick + secs(C.FINAL_MAX);
        po.nextRoll = world.tick + secs(C.FINAL_SLICE);
        const s = po.current ? world.stations[po.current] : undefined;
        emit(world, { type: 'po_dark', station: po.current, to: s?.playerId ? [s.playerId] : [] });
      }
      return;
    }
    case 'dark': {
      let strike = world.tick >= po.phaseEnd;
      if (!strike && world.tick >= po.nextRoll) {
        po.nextRoll = world.tick + secs(C.FINAL_SLICE);
        strike = range(world.rng, 0, 1) < C.FINAL_CHANCE;
      }
      if (strike && po.current) {
        killFn(po.current);
        po.current = null;
        po.phase = 'between';
        po.phaseEnd = world.tick + secs(range(world.rng, ...C.NEXT_STATION_PAUSE));
      }
      return;
    }
    default:
      return;
  }
}
