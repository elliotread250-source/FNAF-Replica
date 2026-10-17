import { CONFIG } from '../config';
import { PRESETS } from '../content/presets';
import type { StationId } from '../content/mapTypes';
import type { World } from './types';

export interface PlayerResult {
  pid: string;
  station: StationId | null;
  role: 'guard' | 'puppeteer';
  survived: boolean;
  ghost: boolean;
  killedBy: string | null;
  deathHour: number | null;
  tokens: number;
  achievements: string[];
  stats: {
    cameraChecks: number;
    doorsClosed: number;
    tabletSeconds: number;
    powerUsed: number;
    closeCalls: number;
    ghostSeconds: number;
  };
  presetBeaten: string | null;
}

export interface MatchResult {
  mode: World['mode'];
  night: number;
  result: 'win' | 'loss';
  hour: number;
  power: number;
  seed: number;
  players: PlayerResult[];
  presetId: string | null;
}

/** Base rewards per Part 8.6 (first-win-of-day is applied by the server, which knows the account history). */
export function scoreMatch(world: World): MatchResult {
  const R = CONFIG.rewards;
  const win = world.result === 'win';
  const guardCount = Object.values(world.players).filter((p) => p.role === 'guard').length;
  const fullLobby = Object.keys(world.players).length >= 4;
  const totalTabletTicks = Object.values(world.stations).reduce((s, st) => s + (st?.stats.tabletTicks ?? 0), 0);
  const living = Object.values(world.stations).filter((s) => s && !s.sealed && s.alive && !s.abandoned);
  const custom = world.night === 7 && world.custom;
  const aiSum = custom
    ? Object.values(world.custom!.ai).reduce((a, b) => a + b, 0) + Object.values(world.custom!.extended).reduce((a, b) => a + b, 0)
    : 0;

  const players: PlayerResult[] = Object.values(world.players).map((p) => {
    const st = p.station ? world.stations[p.station] : undefined;
    const survived = Boolean(st && st.alive && !(st.abandoned && !st.connected));
    let tokens = 0;
    const ach: string[] = [];
    if (p.role === 'puppeteer') {
      tokens = R.SHOWTIME_KILL * (world.showtime?.kills ?? 0) + (!win && guardCount >= 1 ? R.SHOWTIME_WIPE : 0);
      if (!win) ach.push('puppeteer');
      if (!win && guardCount >= 4) ach.push('wipe');
    } else if (world.mode === 'showtime') {
      tokens = win && survived ? R.SHOWTIME_GUARD_SURVIVE : win ? R.SHOWTIME_GUARD_SURVIVE / 2 : R.LOSS_BASE + R.LOSS_PER_HOUR * world.hour;
    } else if (win) {
      let base: number;
      if (custom) base = R.CUSTOM_WIN_BASE + Math.floor(aiSum / 2);
      else if (world.mode === 'classic') base = R.CLASSIC_WIN_BASE + R.CLASSIC_WIN_PER_NIGHT * world.night;
      else base = R.NIGHTSHIFT_WIN_BASE + R.NIGHTSHIFT_WIN_PER_NIGHT * world.night;
      tokens = survived ? base : Math.floor(base / 2);
    } else {
      tokens = R.LOSS_BASE + R.LOSS_PER_HOUR * world.hour;
    }
    if (fullLobby) tokens = Math.round(tokens * (1 + R.FULL_LOBBY_BONUS));
    if (p.isBot) tokens = 0;

    if (st && p.role === 'guard') {
      if (win && survived) {
        ach.push('first_shift');
        if (world.mode === 'nightshift' && world.night === 5) ach.push('night5');
        if (world.mode === 'classic' && world.night === 5) ach.push('classic5');
        if (world.night === 6) ach.push('night6');
        if (!st.everClosedDoor) ach.push('no_doors');
        if (!st.everRaisedTablet) ach.push('no_cams');
        if (world.power <= 0) ach.push('zero_power');
        if (world.powerOut.active) ach.push('toreador');
        if (guardCount === 4 && living.length === 1) ach.push('last_one_standing');
      }
      if (win && world.night === 5 && world.mode === 'nightshift' && guardCount === 4 && living.length === 4) ach.push('full_team');
      if (win && totalTabletTicks < 60 * CONFIG.TICK_HZ) ach.push('speedrun');
      if (st.stats.foxBounces >= 3) ach.push('fox_bounce');
      if (st.stats.maskFools >= 5) ach.push('mask_master');
      if (st.stats.reboots >= 10) ach.push('technician');
      if (world.night === 5 && world.musicBox.enabled && win && st.stats.musicBoxMin >= 25 && st.id === 'control') ach.push('lullaby');
      if (st.stats.ghostAssist) ach.push('ghost_help');
      if (st.stats.noseHonks > 0) ach.push('honk');
      if (st.stats.secret) ach.push('cipher');
      if (st.stats.ghostTicks >= 300 * CONFIG.TICK_HZ) ach.push('spectator');
      if (st.killedBy === 'golden') ach.push('its_me');
      if (st.killedBy) ach.push('first_blood');
    }
    const presetBeaten = win && survived && custom && world.presetId ? world.presetId : null;
    if (presetBeaten === 'four_twenty') ach.push('four_twenty');
    return {
      pid: p.id,
      station: p.station,
      role: p.role,
      survived: p.role === 'guard' ? survived && win : !win,
      ghost: p.role === 'guard' && !survived,
      killedBy: st?.killedBy ?? null,
      deathHour: st?.deathHour ?? null,
      tokens,
      achievements: [...new Set(ach)],
      stats: {
        cameraChecks: st?.stats.cameraChecks ?? 0,
        doorsClosed: st?.stats.doorsClosed ?? 0,
        tabletSeconds: Math.round((st?.stats.tabletTicks ?? 0) / CONFIG.TICK_HZ),
        powerUsed: Math.round((st?.stats.powerUsed ?? 0) * 10) / 10,
        closeCalls: st?.stats.closeCalls ?? 0,
        ghostSeconds: Math.round((st?.stats.ghostTicks ?? 0) / CONFIG.TICK_HZ),
      },
      presetBeaten,
    };
  });

  return {
    mode: world.mode,
    night: world.night,
    result: win ? 'win' : 'loss',
    hour: world.hour,
    power: Math.round(world.power * 10) / 10,
    seed: world.seed,
    players,
    presetId: world.presetId,
  };
}

export const ALL_PRESET_IDS = PRESETS.map((p) => p.id);
