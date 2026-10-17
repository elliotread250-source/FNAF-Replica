import type { Rng } from '../rng';
import type { DoorId, MapDef, NodeId, StationId } from '../content/mapTypes';
import type { AnimId } from '../content/roster';

export type Mode = 'classic' | 'nightshift' | 'showtime';
export type SubPos = 'room' | 'at_door' | 'in_office' | 'in_vent';
export type SystemId = 'cameras' | 'audio' | 'ventilation' | 'power' | `doors_${string}`;

export interface AnimatronicState {
  id: AnimId;
  aiLevel: number;
  node: NodeId;
  subPos: SubPos;
  door: DoorId | null;
  station: StationId | null;
  targetDoor: DoorId | null;
  moveTimer: number;
  stage: number;
  frozenTicks: number;
  attackTimer: number | null;
  /** Tick at which an in-office character forces the tablet down and attacks. */
  forceTimer: number | null;
  /** Tick the character entered its current office. */
  enteredTick: number;
  active: boolean;
  flags: Record<string, number>;
  /** Showtime: last tick the Puppeteer moved this character. */
  controlledTick: number;
  cooldownUntil: number;
}

export interface DoorState {
  id: DoorId;
  station: StationId;
  closed: boolean;
  /** Jammed by power outage or maintenance failure: button does nothing. */
  jammed: boolean;
  /** Set while an animatronic sits in the office on this side. */
  blockedBy: AnimId | null;
  light: boolean;
  lastToggleTick: number;
  /** Tick the door was last closed, for door-camping rules. */
  closedSince: number;
  /** Light-steal (Balloon Kid) until tick. */
  lightDeadUntil: number;
  /** Per-approach sting flag. */
  stung: AnimId | null;
  /** Monty-style damage counter. */
  damage: number;
}

export interface StationStats {
  cameraChecks: number;
  doorsClosed: number;
  tabletTicks: number;
  ghostTicks: number;
  powerUsed: number;
  closeCalls: number;
  foxBounces: number;
  maskFools: number;
  reboots: number;
  musicBoxMin: number;
  noseHonks: number;
  ghostAssist: boolean;
  lockerClicks: number;
  secret: boolean;
}

export interface StationState {
  id: StationId;
  playerId: string | null;
  name: string;
  sealed: boolean;
  alive: boolean;
  connected: boolean;
  abandoned: boolean;
  disconnectedAt: number | null;
  tablet: boolean;
  tabletChangedTick: number;
  cam: NodeId;
  camSince: number;
  flashlight: boolean;
  battery: number;
  mic: boolean;
  mask: boolean;
  maskTick: number;
  windHeld: boolean;
  panel: boolean;
  rebooting: { system: SystemId | 'all'; endTick: number } | null;
  boostUntil: number;
  boostCooldownUntil: number;
  lureCooldownUntil: number;
  goldenArmed: boolean;
  goldenUntil: number | null;
  staticUntil: number;
  lightsOutUntil: number;
  deathTick: number | null;
  deathHour: number | null;
  killedBy: AnimId | null;
  usage: number;
  stats: StationStats;
  lastPressTicks: number[];
  hallucinateAt: number;
  pingNode: NodeId | null;
  pingUntil: number;
  /** Tablet blocked until tick (phantom jumpscare etc). */
  tabletBlockedUntil: number;
  everClosedDoor: boolean;
  everRaisedTablet: boolean;
}

export interface PlayerInfo {
  id: string;
  name: string;
  role: 'guard' | 'puppeteer';
  station: StationId | null;
  isHost: boolean;
  isBot: boolean;
  ghostPingUntil: number;
  ghostPingNode: NodeId | null;
}

export interface PowerOutState {
  active: boolean;
  startTick: number;
  queue: StationId[];
  current: StationId | null;
  phase: 'pause' | 'song' | 'dark' | 'between' | 'done';
  phaseEnd: number;
  nextRoll: number;
}

export interface MaintenanceState {
  enabled: boolean;
  failed: Partial<Record<SystemId, number>>; // system -> tick failed
  schedule: { tick: number; system: SystemId }[];
  autoReboot: Partial<Record<SystemId, number>>;
}

export interface MusicBoxState {
  enabled: boolean;
  level: number;
  rate: number;
  puppetOut: boolean;
  puppetNode: NodeId;
  puppetPath: NodeId[];
  puppetTarget: StationId | null;
  puppetTimer: number;
  minLevel: number;
}

export interface CustomSettings {
  ai: { freddy: number; bonnie: number; chica: number; foxy: number };
  puppet: number; // unwind %/s, 0 = off
  extended: Record<string, number>;
}

export interface WorldOptions {
  seed: number;
  mode: Mode;
  night: number;
  hourSeconds: number;
  players: { id: string; name: string; station: StationId | null; role?: 'guard' | 'puppeteer'; isHost?: boolean; isBot?: boolean }[];
  custom?: CustomSettings;
  /** Bot-filled stations count for scaling. */
}

export interface SimEvent {
  type: string;
  /** If set, only these players receive it. */
  to?: string[];
  [k: string]: unknown;
}

export interface World {
  tick: number;
  seed: number;
  rng: Rng;
  mode: Mode;
  night: number;
  map: MapDef;
  hourTicks: number;
  hour: number;
  ended: boolean;
  result: 'win' | 'loss' | null;
  power: number;
  powerOut: PowerOutState;
  passiveDrain: number;
  stations: Partial<Record<StationId, StationState>>;
  stationOrder: StationId[];
  doors: Record<DoorId, DoorState>;
  doorStation: Record<DoorId, StationId>;
  players: Record<string, PlayerInfo>;
  anims: AnimatronicState[];
  guardCount: number;
  musicBox: MusicBoxState;
  maintenance: MaintenanceState;
  call: { night: number; startTick: number; duration: number; muted: boolean; votes: string[] } | null;
  lastCoveWatchTick: number;
  lastStageWatchTick: number;
  foxyKnocks: number;
  goldenOdds: number;
  custom: CustomSettings | null;
  /** Lure: node and expiry. */
  lure: { node: NodeId; until: number } | null;
  /** Count of attacks per station, for target spreading. */
  attacks: Partial<Record<StationId, number>>;
  /** Plugin state bags. */
  plugins: Record<string, Record<string, number | string | null>>;
  events: SimEvent[];
  /** Showtime abilities cooldowns. */
  showtime: { lightsOutReady: number; staticReady: number; kills: number } | null;
  clippings: Record<NodeId, number>;
  presetId: string | null;
  /** Last tick each door had a ghost ping on its approach node, for the Ghost Whisperer achievement. */
  ghostPingByNode: Record<NodeId, { tick: number; by: string }>;
}

export type Input =
  | { action: 'door'; door: DoorId; closed: boolean }
  | { action: 'light'; door: DoorId; on: boolean }
  | { action: 'tablet'; up: boolean }
  | { action: 'camera'; node: NodeId }
  | { action: 'ping'; node: NodeId }
  | { action: 'tool'; tool: 'flashlight' | 'mic' | 'mask' | 'wind' | 'panel'; on: boolean }
  | { action: 'tool'; tool: 'reboot'; system: SystemId | 'all' }
  | { action: 'tool'; tool: 'lure'; node: NodeId }
  | { action: 'tool'; tool: 'boost'; station: StationId }
  | { action: 'nose' }
  | { action: 'vote_mute' }
  | { action: 'locker_click' }
  | { action: 'showtime_move'; anim: string; node?: NodeId; door?: DoorId }
  | { action: 'showtime_ability'; ability: 'lights_out' | 'static'; station: StationId }
  | { action: 'disconnect' }
  | { action: 'reconnect' };

export interface PlayerInput {
  pid: string;
  seq: number;
  input: Input;
}
