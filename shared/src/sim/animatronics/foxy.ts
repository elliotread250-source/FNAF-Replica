import { CONFIG, secs } from '../../config';
import { int, range } from '../../rng';
import type { AnimatronicState, World } from '../types';
import { emit, isLive, kill, watchers } from '../world';
import { opportunity } from './base';
import { drainPower } from '../power';

// Foxy doesn't roam. He climbs through cove stages, then sprints the west hall.
export function foxyTick(world: World, a: AnimatronicState): void {
  const A = CONFIG.animatronics;
  const map = world.map;
  const door = world.doors[map.foxyDoor];
  const station = world.stations[world.doorStation[map.foxyDoor]];
  if (!isLive(station)) return;

  // Watching the cove freezes him.
  if (a.stage < 3 && watchers(world, map.coveNode).length > 0) {
    world.lastCoveWatchTick = world.tick;
    if (a.frozenTicks <= 0) a.frozenTicks = secs(range(world.rng, ...A.FOXY_FREEZE));
  }

  if (a.stage < 3) {
    const neglected = world.tick - world.lastCoveWatchTick > secs(A.FOXY_NEGLECT_SECONDS) && world.mode !== 'classic';
    if (opportunity(world, a, neglected ? A.FOXY_NEGLECT_BONUS : 0)) {
      a.stage++;
      emit(world, { type: 'foxy_stage', stage: a.stage });
      if (a.stage === 2) emit(world, { type: 'foxy_hum' });
      if (a.stage === 3) {
        a.flags.sprintTotal = secs(A.FOXY_SPRINT_SECONDS);
        a.flags.sprintLeft = a.flags.sprintTotal;
        a.flags.seen = 0;
        a.node = map.westHallNode;
        emit(world, { type: 'cam_glitch', nodes: [map.coveNode], to: watchers(world, map.coveNode).map((s) => s.playerId as string) });
      }
    }
    return;
  }

  // Sprinting.
  if (!a.flags.seen && watchers(world, map.westHallNode).length > 0) {
    a.flags.seen = 1;
    a.flags.sprintLeft = Math.min(a.flags.sprintLeft, secs(A.FOXY_SPRINT_WHEN_SEEN));
    emit(world, { type: 'foxy_run' });
  }
  a.flags.sprintLeft--;
  const progress = 1 - a.flags.sprintLeft / Math.max(1, a.flags.sprintTotal);
  a.flags.progress = progress;

  // Flashlight in the first half of the sprint sends him home.
  if (station.flashlight && station.battery > 0 && progress < 0.5) {
    station.stats.foxBounces++;
    reset(world, a, 1);
    emit(world, { type: 'foxy_bounce', to: station.playerId ? [station.playerId] : [] });
    return;
  }
  if (a.flags.sprintLeft === secs(2) && !a.flags.seen) emit(world, { type: 'foxy_run', to: station.playerId ? [station.playerId] : [] });

  if (a.flags.sprintLeft <= 0) {
    if (door.closed) {
      const drain = CONFIG.power.FOXY_KNOCK_BASE + CONFIG.power.FOXY_KNOCK_STEP * world.foxyKnocks;
      world.foxyKnocks++;
      station.stats.closeCalls++;
      emit(world, { type: 'knock', door: door.id, drain });
      drainPower(world, drain);
      reset(world, a, int(world.rng, 0, 1));
    } else {
      kill(world, station.id, 'foxy');
      reset(world, a, 0);
    }
  }
}

function reset(world: World, a: AnimatronicState, stage: number): void {
  a.stage = stage;
  a.node = world.map.coveNode;
  a.flags = {};
  a.frozenTicks = 0;
}
