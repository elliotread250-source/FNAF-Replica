import type { CallDef, CustomSettings, StationId } from '@fnaf/shared';

export interface NightStart {
  seed: number;
  mode: 'classic' | 'nightshift' | 'showtime';
  night: number;
  map: 'classic' | 'coop';
  hourSeconds: number;
  you: StationId | null;
  role: 'guard' | 'puppeteer';
  stations: { pid: string; name: string; station: StationId | null; role: string; isBot: boolean }[];
  startsAt: number;
  tick: number;
  call: CallDef | null;
  custom: CustomSettings | null;
  extended: string[];
}

export interface NightEnd {
  result: 'win' | 'loss';
  mode: string;
  night: number;
  hour: number;
  power: number;
  team: { pid: string; name: string; station: string | null; role: string; survived: boolean; killedBy: string | null; deathHour: number | null; stats: Record<string, number> }[];
  you?: { tokens: number; achievements: string[]; survived: boolean; killedBy: string | null; deathHour: number | null; stats: Record<string, number> };
  rewards: { tokens: number; firstWinBonus: number; newAchievements: string[]; newCosmetics: string[]; balance: number };
}

export const STATION_DOORS: Record<StationId, { id: string; side: 'left' | 'right'; kind: 'door' | 'vent' }[]> = {
  office: [
    { id: 'left', side: 'left', kind: 'door' },
    { id: 'right', side: 'right', kind: 'door' },
  ],
  solo: [
    { id: 'west', side: 'left', kind: 'door' },
    { id: 'east', side: 'right', kind: 'door' },
  ],
  west: [{ id: 'west', side: 'left', kind: 'door' }],
  east: [{ id: 'east', side: 'right', kind: 'door' }],
  south: [
    { id: 'south_l', side: 'left', kind: 'door' },
    { id: 'south_r', side: 'right', kind: 'door' },
  ],
  control: [{ id: 'vent', side: 'right', kind: 'vent' }],
};
