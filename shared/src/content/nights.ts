export type CoreAi = { freddy: number; bonnie: number; chica: number; foxy: number };

export interface NightDef {
  ai: CoreAi | ((roll: (min: number, max: number) => number) => CoreAi);
  puppet: boolean;
  goldenOdds: number;
  /** Extended roster characters enabled by default, with their AI. */
  extended?: Record<string, number>;
}

// Classic Office: the FNAF 1 table, as datamined by the community.
export const CLASSIC_NIGHTS: Record<number, NightDef> = {
  1: { ai: { freddy: 0, bonnie: 0, chica: 0, foxy: 0 }, puppet: false, goldenOdds: 1 / 10000 },
  2: { ai: { freddy: 0, bonnie: 3, chica: 1, foxy: 1 }, puppet: false, goldenOdds: 1 / 10000 },
  3: { ai: { freddy: 1, bonnie: 0, chica: 5, foxy: 2 }, puppet: false, goldenOdds: 1 / 10000 },
  4: { ai: (r) => ({ freddy: r(1, 2), bonnie: 2, chica: r(4, 6), foxy: 6 }), puppet: false, goldenOdds: 1 / 10000 },
  5: { ai: { freddy: 3, bonnie: 5, chica: 7, foxy: 5 }, puppet: false, goldenOdds: 1 / 10000 },
  6: { ai: { freddy: 4, bonnie: 10, chica: 12, foxy: 16 }, puppet: false, goldenOdds: 1 / 1000 },
  7: { ai: { freddy: 0, bonnie: 0, chica: 0, foxy: 0 }, puppet: false, goldenOdds: 1 / 500 },
};

// Night Shift (co-op). Values are for a four-guard lobby; scaling.AI_MULT handles smaller ones.
export const NIGHTSHIFT_NIGHTS: Record<number, NightDef> = {
  1: { ai: { freddy: 0, bonnie: 1, chica: 1, foxy: 0 }, puppet: false, goldenOdds: 1 / 10000 },
  2: { ai: { freddy: 0, bonnie: 4, chica: 3, foxy: 2 }, puppet: false, goldenOdds: 1 / 10000 },
  3: { ai: { freddy: 2, bonnie: 4, chica: 6, foxy: 4 }, puppet: true, goldenOdds: 1 / 10000 },
  4: { ai: { freddy: 3, bonnie: 6, chica: 7, foxy: 7 }, puppet: true, goldenOdds: 1 / 10000 },
  5: { ai: { freddy: 5, bonnie: 8, chica: 9, foxy: 8 }, puppet: true, goldenOdds: 1 / 10000 },
  6: {
    ai: { freddy: 6, bonnie: 12, chica: 14, foxy: 16 },
    puppet: true,
    goldenOdds: 1 / 1000,
    extended: { nightmare: 8, bb: 8 },
  },
  7: { ai: { freddy: 0, bonnie: 0, chica: 0, foxy: 0 }, puppet: false, goldenOdds: 1 / 500 },
};

/** Hourly AI bumps. Classic follows FNAF 1; Night Shift adds Freddy +1 at 5 AM. */
export function hourlyBumps(mode: 'classic' | 'nightshift' | 'showtime', hour: number): Partial<CoreAi> {
  const b: Partial<CoreAi> = {};
  if (hour === 2) b.bonnie = 1;
  if (hour === 3 || hour === 4) {
    b.bonnie = 1;
    b.chica = 1;
    b.foxy = 1;
  }
  if (hour === 5 && mode !== 'classic') b.freddy = 1;
  return b;
}
