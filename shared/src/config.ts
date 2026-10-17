// Every tunable number in the game lives here. Times are in seconds, power in percent.
// The simulation converts seconds to ticks once, through `secs()`.

export const CONFIG = {
  TICK_HZ: 20,
  HOUR_SECONDS: 89,
  FAST_HOUR_SECONDS: 5,
  HOURS_PER_NIGHT: 6,

  power: {
    BASE_DRAIN_PER_USAGE: { 0: 0, 1: 1 / 9.6, 2: 1 / 4.8, 3: 1 / 3.2, 4: 1 / 2.4, 5: 1 / 1.9, 6: 1 / 1.6 } as Record<
      number,
      number
    >,
    // Tuned with `npm run sim:balance`, see docs/BALANCE.md. The prompt's starting values were 1/0.6/0.45/0.36.
    CO_OP_POWER_SCALE: { 1: 1.0, 2: 0.55, 3: 0.4, 4: 0.3 } as Record<number, number>,
    PASSIVE_DRAIN: { 1: 0, 2: 1 / 6, 3: 1 / 5, 4: 1 / 4, 5: 1 / 3, 6: 1 / 3, 7: 1 / 3 } as Record<number, number>,
    // The prompt's passive table (1% per 3 s on Night 5) drains 178% over a night on its own, which no
    // amount of skill survives. Both modes scale it down; see docs/DECISIONS.md and docs/BALANCE.md.
    CLASSIC_PASSIVE_SCALE: 0.15,
    CO_OP_PASSIVE_SCALE: 0.15,
    FOXY_KNOCK_BASE: 1,
    FOXY_KNOCK_STEP: 5,
    BOOST_DURATION: 20,
    BOOST_COOLDOWN: 60,
    BOOST_FACTOR: 0.5,
    POWER_ROUTING_FAIL_FACTOR: 1.25,
  },

  doors: { TOGGLE_COOLDOWN: 0.1, ANIM_SECONDS: 0.25, MAX_PRESSES_PER_SEC: 10 },
  lights: { HOLD_TO_USE: true, NEAR_FLICKER_CHANCE: 0.15, NEAR_FLICKER_PERIOD: 0.5 },
  tablet: { RAISE_SECONDS: 0.3, STATIC_ON_SWITCH: 0.12, MOVE_GLITCH: 0.6 },

  animatronics: {
    INTERVALS: { freddy: 3.02, bonnie: 4.97, chica: 4.98, foxy: 5.01 } as Record<string, number>,
    IN_OFFICE_ATTACK_DELAY: [1.5, 3.0] as [number, number],
    ATTACK_AFTER_TABLET_DOWN: 0.2,
    TABLET_FORCE_DOWN: [10, 25] as [number, number],
    FOXY_FREEZE: [0.83, 16.67] as [number, number],
    FOXY_SPRINT_SECONDS: 25,
    FOXY_SPRINT_WHEN_SEEN: 1.5,
    FOXY_NEGLECT_SECONDS: 60,
    FOXY_NEGLECT_BONUS: 3,
    GOLDEN_DISMISS_SECONDS: 4,
    GOLDEN_ODDS: { normal: 1 / 10000, night6: 1 / 1000, custom: 1 / 500 },
    PUPPET_SECONDS_PER_EDGE: 8,
    MAX_PER_NODE: 2,
    VENT_TRANSIT: [6, 10] as [number, number],
    BONNIE_SKIP_CHANCE: 0.35,
    CHICA_EAT: [1, 3] as [number, number],
    FREDDY_RUSH_UNWATCHED: 30,
  },

  powerOut: {
    PAUSE: [3, 8] as [number, number],
    SONG_MAX: 20,
    SONG_END_CHANCE: 0.2,
    SONG_END_SLICE: 5,
    FINAL_SLICE: 2,
    FINAL_CHANCE: 0.2,
    FINAL_MAX: 10,
    NEXT_STATION_PAUSE: [2, 5] as [number, number],
  },

  musicBox: {
    UNWIND: { 3: 1.0, 4: 1.3, 5: 1.5, 6: 1.8, 7: 1.8 } as Record<number, number>,
    WIND_RATE: 8,
    REMOTE_WIND_FACTOR: 0.5,
    PUPPET_RECALL_THRESHOLD: 50,
  },

  maintenance: {
    REBOOT_ONE: 5,
    REBOOT_ALL: 12,
    VENT_HALLUCINATE_AFTER: 20,
    MIN_GAP: 25,
    AUTO_REBOOT_CAMERAS: 8,
    PER_NIGHT: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 7, 7: 5 } as Record<number, number>,
    WEIGHTS: { cameras: 3, ventilation: 3, audio: 2, doors: 2, power: 1 },
  },

  hallucination: { INTERVAL: [6, 14] as [number, number] },

  flashlight: { DRAIN_PER_SEC: 4, RECHARGE_PER_SEC: 1, BONNIE_BLIND: 3 },
  mask: { RAISE_SECONDS: 0.4, GRACE_SECONDS: 1.5, VISITOR_STAY: [3, 6] as [number, number] },
  lure: { DURATION: 2, COOLDOWN: 30, PULL_CHANCE: 0.7 },
  ping: { DURATION: 8 },

  scaling: { AI_MULT: { 1: 0.75, 2: 0.85, 3: 0.95, 4: 1.0 } as Record<number, number> },

  disconnect: { AUTOPILOT_SECONDS: 60 },

  showtime: {
    COOLDOWN_SCALE: 2.0,
    UNCONTROLLED_AFTER: 20,
    UNCONTROLLED_AI: 5,
    LIGHTS_OUT: { duration: 10, cooldown: 90 },
    STATIC: { duration: 5, cooldown: 60 },
  },

  rewards: {
    NIGHTSHIFT_WIN_BASE: 40,
    NIGHTSHIFT_WIN_PER_NIGHT: 20,
    LOSS_BASE: 10,
    LOSS_PER_HOUR: 5,
    CLASSIC_WIN_BASE: 30,
    CLASSIC_WIN_PER_NIGHT: 15,
    CUSTOM_WIN_BASE: 100,
    SHOWTIME_GUARD_SURVIVE: 80,
    SHOWTIME_KILL: 30,
    SHOWTIME_WIPE: 100,
    FIRST_WIN_OF_DAY: 100,
    FULL_LOBBY_BONUS: 0.15,
  },

  extended: { MAX_ACTIVE_CUSTOM: 12 },
} as const;

/** Convert seconds to whole simulation ticks (min 1). */
export function secs(s: number): number {
  return Math.max(1, Math.round(s * CONFIG.TICK_HZ));
}

export const TICK_SECONDS = 1 / CONFIG.TICK_HZ;
