import { CONFIG, secs } from '../../config';
import { chance, int } from '../../rng';
import type { StationState, World } from '../types';
import { emit, isLive, kill, liveStations } from '../world';

/** Called when a station switches its camera, or raises the tablet onto a camera. */
export function onCameraView(world: World, s: StationState): void {
  if (s.cam !== world.map.posterNode || s.goldenArmed || s.goldenUntil !== null) return;
  if (chance(world.rng, world.goldenOdds)) {
    s.goldenArmed = true;
    emit(world, { type: 'golden_poster', to: s.playerId ? [s.playerId] : [] });
  }
}

export function onTabletChange(world: World, s: StationState): void {
  if (!s.tablet && s.goldenArmed) {
    s.goldenArmed = false;
    s.goldenUntil = world.tick + secs(CONFIG.animatronics.GOLDEN_DISMISS_SECONDS);
    emit(world, { type: 'golden_in_office', to: s.playerId ? [s.playerId] : [] });
  } else if (s.tablet && s.goldenUntil !== null) {
    s.goldenUntil = null;
    emit(world, { type: 'golden_gone', to: s.playerId ? [s.playerId] : [] });
  }
}

export function goldenTick(world: World): void {
  for (const s of liveStations(world)) {
    if (s.goldenArmed && world.tick % secs(1.5) === 0 && chance(world.rng, 0.3)) {
      emit(world, { type: 'its_me', to: s.playerId ? [s.playerId] : [] });
    }
    if (s.goldenUntil !== null && world.tick >= s.goldenUntil) {
      s.goldenUntil = null;
      kill(world, s.id, 'golden');
    }
  }
}

/** 1/9/8/7: the host meets him immediately. */
export function golden1987(world: World): void {
  const c = world.custom?.ai;
  if (!c || c.freddy !== 1 || c.bonnie !== 9 || c.chica !== 8 || c.foxy !== 7) return;
  const host = Object.values(world.players).find((p) => p.isHost);
  const s = host?.station ? world.stations[host.station] : liveStations(world)[0];
  if (!isLive(s)) return;
  emit(world, { type: 'radio', text: "...it's me...", seed: int(world.rng, 0, 999) });
  kill(world, s.id, 'golden');
}
