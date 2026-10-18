// Free-roam level data. Everything is metres. +X east, +Z south, +Y up.
// The layout is authored as data (layout.ts); build.ts turns it into walls, colliders and fixtures that
// the server, the AI and the client all share.

export interface Box {
  x1: number;
  y1: number;
  z1: number;
  x2: number;
  y2: number;
  z2: number;
}

/** A collision box. `door` ties it to a door so the simulation can switch it off while the door is open. */
export interface Collider extends Box {
  door?: number;
  /** Small things the player can vault over. */
  low?: boolean;
  kind?: 'wall' | 'floor' | 'ceiling' | 'prop' | 'step' | 'door' | 'glass';
}

export type StyleId =
  | 'dining'
  | 'lobby'
  | 'hall'
  | 'tile'
  | 'steel'
  | 'concrete'
  | 'office'
  | 'party1'
  | 'party2'
  | 'party3'
  | 'party4'
  | 'stage'
  | 'arcade'
  | 'wood'
  | 'play'
  | 'basement'
  | 'dirty'
  | 'prize'
  | 'cove';

export type CircuitId =
  | 'always'
  | 'staff'
  | 'boh'
  | 'west'
  | 'east'
  | 'dining'
  | 'lobby'
  | 'stage'
  | 'cove'
  | 'party'
  | 'play'
  | 'restroom'
  | 'kitchen'
  | 'office'
  | 'backstage'
  | 'parts'
  | 'manager'
  | 'dock'
  | 'basement'
  | 'server'
  | 'boiler'
  | 'breaker';

export type Rect = [x1: number, z1: number, x2: number, z2: number];

export interface RoomDef {
  id: string;
  name: string;
  /** Zone id from the spec (Z02, B02...). Several rooms can share one zone. */
  zone: string;
  rects: Rect[];
  floorY: number;
  /** Ceiling height above the floor. */
  ceilH: number;
  style: StyleId;
  circuit: CircuitId;
  /** Starts with emergency light only (red) instead of full dark. */
  emergency?: boolean;
  /** No floor slab (a stairwell void). */
  noFloor?: boolean;
  /** No ceiling slab. */
  noCeil?: boolean;
  /** Short flavour used by the paper map and callouts. */
  landmark?: string;
}

export type OpeningKind = 'doorway' | 'arch' | 'window' | 'glass';

export interface OpeningDef {
  id: string;
  /** 'x': a wall at fixed x running along Z. 'z': a wall at fixed z running along X. */
  axis: 'x' | 'z';
  line: number;
  from: number;
  to: number;
  kind: OpeningKind;
  /** Height of the clear gap above the floor. */
  head: number;
  /** Bottom of the gap (windows). */
  sill: number;
  floorY: number;
}

export type DoorKind = 'swing' | 'double' | 'shutter' | 'roller' | 'curtain' | 'glass' | 'exit';

export interface FrDoorDef {
  id: number;
  name: string;
  kind: DoorKind;
  axis: 'x' | 'z';
  line: number;
  from: number;
  to: number;
  floorY: number;
  height: number;
  /** Which end the hinge is on ('from' or 'to'). */
  hinge: 'from' | 'to';
  /** Door swings toward +/- of the perpendicular axis. */
  swing: 1 | -1;
  locked?: string;
  /** Circuit that powers a shutter; shutters jam open without it. */
  circuit?: CircuitId;
  startsOpen?: boolean;
}

export type LightKind = 'fluoro' | 'pendant' | 'caged' | 'emergency' | 'lamp' | 'neon' | 'strip' | 'flood' | 'bulb';

export type Flicker = 'none' | 'buzz' | 'dead' | 'spark';

export interface LightDef {
  id: number;
  room: string;
  x: number;
  y: number;
  z: number;
  kind: LightKind;
  color: string;
  intensity: number;
  circuit: CircuitId;
  flicker: Flicker;
  /** Casts a real light while this is among the nearest powered ones. */
  real: boolean;
}

export interface PropDef {
  type: string;
  x: number;
  z: number;
  y?: number;
  /** Rotation in degrees. Colliders snap to the nearest 90. */
  ry?: number;
  room: string;
  /** Free-form parameters (colour, label...). */
  p?: Record<string, string | number | boolean>;
}

export interface InteractableDef {
  id: string;
  type: 'zoneSwitch' | 'mainBreaker' | 'breaker' | 'fuseBox' | 'plate' | 'frontDoors' | 'door' | 'musicBox' | 'phone' | 'honk' | 'sign' | 'timeClock';
  /** Breaker, fuse box or plate number. */
  index?: number;
  x: number;
  y: number;
  z: number;
  /** Degrees. The plate's normal is (sin ry, 0, cos ry). */
  ry: number;
  room: string;
  label: string;
  circuit?: CircuitId;
  door?: number;
}

export type ItemType = 'fuse' | 'battery' | 'cupcake';

export interface ItemSpawnDef {
  x: number;
  y: number;
  z: number;
  room: string;
  /** Item types this spot can hold. */
  types: ItemType[];
  /** Always filled at night start with this item. */
  guaranteed?: ItemType;
}

export interface SpawnDef {
  id: string;
  x: number;
  z: number;
  y: number;
  yaw: number;
}

export type HideType =
  | 'locker'
  | 'under_table'
  | 'closet'
  | 'stall'
  | 'cabinet'
  | 'chest'
  | 'ball_pit'
  | 'curtain'
  | 'costume_rack'
  | 'freezer'
  | 'cart'
  | 'coffin'
  | 'booth'
  | 'stealth_alcove'
  | 'sheet'
  | 'desk';

export interface HidingSpotDef {
  id: number;
  type: HideType;
  room: string;
  /** Where the hidden player's eye sits. */
  x: number;
  y: number;
  z: number;
  /** Yaw the hidden player faces (looking out of the spot). */
  yaw: number;
  capacity: 1 | 2;
  /** 0..1: how well it hides. */
  cover: number;
  enterTime: number;
  checkPriority: number;
  /** Where you pop out (feet positions). The first is the default. */
  exits: { x: number; z: number }[];
  hazard: 'none' | 'cold' | 'heat' | 'breath';
}

export interface AudioZone {
  room: string;
  reverb: 'small' | 'hall' | 'big' | 'tunnel' | 'tile' | 'none';
}

export interface WallRun {
  axis: 'x' | 'z';
  line: number;
  a: number;
  b: number;
  y1: number;
  y2: number;
  thick: number;
  /** Rooms on the low and high side of the line (null = outside). */
  lo: string | null;
  hi: string | null;
}

export interface Level {
  rooms: RoomDef[];
  roomById: Record<string, RoomDef>;
  openings: OpeningDef[];
  doors: FrDoorDef[];
  walls: WallRun[];
  /** Lintels above doorways and sills under windows, as wall runs for rendering. */
  lintels: WallRun[];
  props: PropDef[];
  colliders: Collider[];
  lights: LightDef[];
  interactables: InteractableDef[];
  spawns: SpawnDef[];
  hidingSpots: HidingSpotDef[];
  itemSpawns: ItemSpawnDef[];
  audio: AudioZone[];
  bounds: { x1: number; z1: number; x2: number; z2: number };
  /** room id -> adjacent room ids through openings (for graph tests and the AI). */
  links: Record<string, string[]>;
}
