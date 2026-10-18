// The pizzeria, authored as data. Rooms are unions of integer rectangles on a 1 m grid; build.ts derives the
// walls from where two different rooms (or a room and the outside) meet, so openings are just intervals on
// those walls. See docs/map.svg for the rendered plan and docs/DECISIONS.md for where this departs from the
// hand-written coordinates in the prompt.

import type { CircuitId, FrDoorDef, InteractableDef, OpeningKind, PropDef, Rect, RoomDef, SpawnDef, StyleId } from './types';

export const BASEMENT_Y = -4.5;

interface RoomSpec {
  id: string;
  name: string;
  zone: string;
  rects: Rect[];
  ceilH: number;
  style: StyleId;
  circuit: CircuitId;
  floorY?: number;
  emergency?: boolean;
  noFloor?: boolean;
  noCeil?: boolean;
  landmark?: string;
}

const spec = (r: RoomSpec): RoomDef => ({ floorY: 0, ...r });

export const ROOMS: RoomDef[] = [
  // ---- Back of house, west ----
  spec({ id: 'staff', name: 'Staff Entrance', zone: 'Z21', rects: [[2, 60, 8, 66]], ceilH: 3, style: 'dirty', circuit: 'staff', emergency: true }),
  spec({ id: 'lounge', name: 'Employee Lounge', zone: 'Z16', rects: [[2, 50, 14, 60]], ceilH: 3, style: 'dirty', circuit: 'staff', emergency: true }),
  spec({ id: 'westHall', name: 'West Hall', zone: 'Z09', rects: [[10, 22, 14, 50]], ceilH: 3.6, style: 'hall', circuit: 'west', landmark: 'the west hall' }),
  spec({ id: 'westCorner', name: 'West Corner', zone: 'Z09', rects: [[14, 48, 22, 52]], ceilH: 3.6, style: 'hall', circuit: 'west' }),
  spec({ id: 'cove', name: 'Pirate Cove', zone: 'Z04', rects: [[4, 10, 14, 22]], ceilH: 3.6, style: 'cove', circuit: 'cove', landmark: 'the cove' }),
  spec({ id: 'party1', name: 'Party Room 1 (Space)', zone: 'Z08', rects: [[3, 22, 10, 29]], ceilH: 3, style: 'party1', circuit: 'party' }),
  spec({ id: 'party2', name: 'Party Room 2 (Pirate)', zone: 'Z08', rects: [[3, 29, 10, 36]], ceilH: 3, style: 'party2', circuit: 'party' }),
  spec({ id: 'party3', name: 'Party Room 3 (Princess)', zone: 'Z08', rects: [[3, 36, 10, 43]], ceilH: 3, style: 'party3', circuit: 'party' }),
  spec({ id: 'party4', name: 'Party Room 4 (Spooky)', zone: 'Z08', rects: [[3, 43, 10, 50]], ceilH: 3, style: 'party4', circuit: 'party', landmark: 'the coffin room' }),

  // ---- Front of house ----
  spec({ id: 'dining', name: 'Dining Hall', zone: 'Z02', rects: [[14, 10, 54, 32]], ceilH: 5, style: 'dining', circuit: 'dining', landmark: 'the dining hall' }),
  spec({ id: 'prize', name: 'Prize Corner', zone: 'Z05', rects: [[14, 0, 30, 10]], ceilH: 3.6, style: 'prize', circuit: 'always', landmark: 'the prize corner' }),
  spec({ id: 'lobby', name: 'Front Entrance', zone: 'Z01', rects: [[30, 0, 50, 10]], ceilH: 3.6, style: 'lobby', circuit: 'lobby', emergency: true, landmark: 'the lobby' }),
  spec({ id: 'arcade', name: 'Arcade', zone: 'Z06', rects: [[50, 0, 64, 10]], ceilH: 3.6, style: 'arcade', circuit: 'always', landmark: 'the arcade' }),
  spec({ id: 'stage', name: 'Show Stage', zone: 'Z03', rects: [[54, 10, 68, 22]], ceilH: 5, style: 'stage', circuit: 'stage', landmark: 'the stage' }),
  spec({ id: 'booth', name: 'Stage Booth', zone: 'Z03', rects: [[54, 22, 68, 28]], ceilH: 3.2, style: 'dirty', circuit: 'stage' }),
  spec({ id: 'play', name: "Kids' Play Zone", zone: 'Z07', rects: [[14, 32, 32, 48]], ceilH: 4.5, style: 'play', circuit: 'play', landmark: 'the ball pit' }),
  spec({ id: 'eastHall', name: 'East Hall', zone: 'Z10', rects: [[32, 32, 36, 52]], ceilH: 3.6, style: 'hall', circuit: 'east', landmark: 'the east hall' }),
  spec({ id: 'eastCorner', name: 'East Corner', zone: 'Z10', rects: [[28, 48, 32, 52]], ceilH: 3.6, style: 'hall', circuit: 'east' }),
  spec({ id: 'office', name: 'Security Office', zone: 'Z13', rects: [[22, 48, 28, 56]], ceilH: 3, style: 'office', circuit: 'office', landmark: 'the office' }),
  spec({ id: 'restCorr', name: 'Restroom Corridor', zone: 'Z11', rects: [[36, 32, 40, 37]], ceilH: 3, style: 'tile', circuit: 'restroom' }),
  spec({ id: 'men', name: "Men's Restroom", zone: 'Z11', rects: [[40, 32, 48, 37]], ceilH: 3, style: 'tile', circuit: 'restroom' }),
  spec({ id: 'women', name: "Women's Restroom", zone: 'Z11', rects: [[36, 37, 48, 44]], ceilH: 3, style: 'tile', circuit: 'restroom' }),
  spec({ id: 'kitchen', name: 'Kitchen', zone: 'Z12', rects: [[36, 44, 52, 52], [40, 52, 48, 56]], ceilH: 3.4, style: 'steel', circuit: 'kitchen', landmark: 'the kitchen' }),
  spec({ id: 'pantry', name: 'Pantry', zone: 'Z12', rects: [[36, 52, 40, 56]], ceilH: 3, style: 'steel', circuit: 'kitchen' }),
  spec({ id: 'freezer', name: 'Walk-in Freezer', zone: 'Z12', rects: [[48, 52, 52, 56]], ceilH: 3, style: 'steel', circuit: 'kitchen' }),
  spec({ id: 'supply', name: 'Supply Closet', zone: 'Z18', rects: [[28, 52, 36, 56]], ceilH: 3, style: 'dirty', circuit: 'boh' }),
  spec({ id: 'manager', name: "Manager's Office", zone: 'Z17', rects: [[52, 50, 58, 56]], ceilH: 3, style: 'office', circuit: 'manager' }),

  // ---- Back of house, east ----
  spec({ id: 'utility', name: 'Utility Corridor', zone: 'Z19', rects: [[14, 56, 66, 59]], ceilH: 3, style: 'concrete', circuit: 'boh', emergency: true }),
  spec({ id: 'stairTop', name: 'Basement Stairs', zone: 'B01', rects: [[34, 59, 38, 64]], ceilH: 3, style: 'concrete', circuit: 'boh', noFloor: true, emergency: true }),
  spec({ id: 'backstage', name: 'Backstage', zone: 'Z14', rects: [[54, 28, 68, 36]], ceilH: 3.2, style: 'dirty', circuit: 'backstage' }),
  spec({ id: 'parts', name: 'Parts & Service', zone: 'Z15', rects: [[68, 24, 82, 36]], ceilH: 2.8, style: 'dirty', circuit: 'parts' }),
  spec({ id: 'svc', name: 'Service Corridor', zone: 'Z19', rects: [[72, 36, 75, 50]], ceilH: 3, style: 'concrete', circuit: 'boh' }),
  spec({ id: 'dock', name: 'Loading Dock', zone: 'Z20', rects: [[66, 50, 82, 62]], ceilH: 4.5, style: 'concrete', circuit: 'dock', landmark: 'the dock' }),

  // ---- Basement ----
  spec({ id: 'bHall', name: 'Basement Hall', zone: 'B01', rects: [[10, 64, 62, 67]], ceilH: 2.8, style: 'basement', circuit: 'basement', floorY: BASEMENT_Y }),
  spec({ id: 'stairBot', name: 'Basement Stairs', zone: 'B01', rects: [[34, 59, 38, 64]], ceilH: 4.5, style: 'basement', circuit: 'basement', floorY: BASEMENT_Y, noCeil: true }),
  spec({ id: 'bOld', name: 'Old Storage', zone: 'B04', rects: [[10, 54, 20, 64]], ceilH: 3, style: 'basement', circuit: 'always', floorY: BASEMENT_Y }),
  spec({ id: 'bBreaker', name: 'Breaker Room', zone: 'B02', rects: [[22, 56, 30, 64]], ceilH: 3.2, style: 'basement', circuit: 'breaker', floorY: BASEMENT_Y, landmark: 'the breaker room' }),
  spec({ id: 'bBoiler', name: 'Boiler Room', zone: 'B03', rects: [[40, 52, 52, 64]], ceilH: 4.4, style: 'basement', circuit: 'boiler', floorY: BASEMENT_Y, landmark: 'the boiler' }),
  spec({ id: 'bServer', name: 'Camera Server Room', zone: 'B06', rects: [[54, 58, 62, 64]], ceilH: 2.8, style: 'basement', circuit: 'server', floorY: BASEMENT_Y }),
];

type DoorOpts = Partial<Pick<FrDoorDef, 'kind' | 'locked' | 'hinge' | 'swing' | 'name' | 'circuit' | 'startsOpen' | 'height'>>;

export interface OpeningSpec {
  axis: 'x' | 'z';
  line: number;
  from: number;
  to: number;
  kind: OpeningKind;
  floorY: number;
  door?: DoorOpts;
}

export const OPENING_SPECS: OpeningSpec[] = [];

function open(axis: 'x' | 'z', line: number, from: number, to: number, kind: OpeningKind = 'doorway', door?: DoorOpts, floorY = 0): void {
  OPENING_SPECS.push({ axis, line, from, to, kind, floorY, door });
}

const D = (name: string, extra: DoorOpts = {}): DoorOpts => ({ kind: 'swing', name, ...extra });
const DD = (name: string, extra: DoorOpts = {}): DoorOpts => ({ kind: 'double', name, ...extra });
const SH = (name: string, circuit: CircuitId, extra: DoorOpts = {}): DoorOpts => ({ kind: 'shutter', name, circuit, ...extra });

// Back of house, west
open('z', 60, 4, 6, 'doorway', D('Staff Entrance interior door'));
open('z', 66, 4, 6, 'doorway', { kind: 'exit', name: 'Staff Door', locked: 'night', height: 2.2 });
open('z', 50, 11, 13, 'doorway', DD('Lounge to West Hall'));
open('x', 14, 57, 58, 'doorway', D('Lounge to Utility'));
open('x', 14, 48, 50, 'arch');
open('x', 10, 25, 26, 'doorway', D('Party Room 1'));
open('x', 10, 32, 33, 'doorway', D('Party Room 2'));
open('x', 10, 39, 40, 'doorway', D('Party Room 3'));
open('x', 10, 46, 47, 'doorway', D('Party Room 4'));
open('z', 22, 11, 13, 'doorway', { kind: 'curtain', name: 'Cove side curtain' });
open('x', 22, 50, 52, 'doorway', SH('Security Door West', 'office', { height: 2.4 }));
open('x', 28, 50, 52, 'doorway', SH('Security Door East', 'office', { height: 2.4 }));
open('z', 56, 24, 25, 'doorway', D('Security Rear', { locked: 'keycard' }));

// Front of house
open('x', 14, 26, 28, 'doorway', SH('Shutter S1 (West)', 'boh', { height: 2.6 }));
open('z', 32, 33, 35, 'doorway', SH('Shutter S2 (East)', 'boh', { height: 2.6 }));
open('z', 32, 22, 28, 'arch');
open('z', 10, 18, 26, 'arch');
open('z', 10, 36, 44, 'arch');
open('z', 10, 50, 54, 'arch');
open('x', 50, 3, 5, 'doorway', D('Lobby to Arcade'));
open('z', 0, 38, 42, 'glass', { kind: 'glass', name: 'Front Doors', locked: 'chain', height: 2.4 });
open('z', 0, 32, 36, 'window');
open('z', 0, 44, 48, 'window');
open('x', 14, 12, 20, 'arch');
open('x', 54, 12, 20, 'arch');
open('z', 22, 62, 64, 'doorway', D('Backstage passage'));
open('z', 28, 60, 62, 'doorway', D('Booth to Backstage'));
open('x', 68, 31, 33, 'doorway', DD('Backstage to Parts'));
open('z', 36, 73, 74, 'doorway', D('Parts to Service'));
open('z', 50, 73, 74, 'doorway', D('Service to Dock'));
open('x', 66, 57, 59, 'doorway', DD('Utility to Dock'));
open('z', 62, 70, 76, 'doorway', { kind: 'roller', name: 'Dock roller door', locked: 'night', height: 3 });
open('z', 56, 30, 31, 'doorway', D('Supply Closet back'));
open('z', 56, 43, 44, 'doorway', D('Kitchen back door'));
open('z', 56, 54, 55, 'doorway', D('Manager door', { locked: 'keycard' }));
open('z', 59, 35, 37, 'doorway', SH('Shutter S4 (Basement)', 'boh', { height: 2.6 }));
open('x', 32, 48, 52, 'arch');
open('x', 36, 46, 48, 'doorway', DD('Kitchen front doors'));
open('x', 36, 34, 35, 'doorway', D('Restroom door'));
open('x', 40, 34, 35, 'doorway', D("Men's door"));
open('z', 37, 37, 38, 'doorway', D("Women's door"));
open('z', 52, 33, 34, 'doorway', D('Supply Closet door'));
open('x', 40, 53, 55, 'doorway', D('Pantry door'));
open('x', 48, 53, 54, 'doorway', D('Freezer door', { height: 2.1 }));

// Basement
open('z', 64, 14, 16, 'doorway', D('Old Storage door', { locked: 'basement' }), BASEMENT_Y);
open('z', 64, 25, 27, 'doorway', D('Breaker Room door'), BASEMENT_Y);
open('z', 64, 35, 37, 'arch', undefined, BASEMENT_Y);
open('z', 64, 44, 46, 'doorway', DD('Boiler Room doors'), BASEMENT_Y);
open('z', 64, 57, 59, 'doorway', D('Server Room door'), BASEMENT_Y);

export const SPAWNS: SpawnDef[] = [
  { id: 'p1', x: 3.5, z: 63.5, y: 0, yaw: -Math.PI / 2 },
  { id: 'p2', x: 3.5, z: 61.5, y: 0, yaw: -Math.PI / 2 },
  { id: 'p3', x: 6.5, z: 63.5, y: 0, yaw: Math.PI / 2 },
  { id: 'p4', x: 6.5, z: 61.5, y: 0, yaw: Math.PI / 2 },
];

const sw = (circuit: CircuitId, room: string, x: number, z: number, ry: number, y = 1.3): InteractableDef => ({
  id: `switch:${circuit}`,
  type: 'zoneSwitch',
  x,
  y,
  z,
  ry,
  room,
  label: `${circuit} lights`,
  circuit,
});

export const INTERACTABLES: InteractableDef[] = [
  { id: 'main-breaker', type: 'mainBreaker', x: 22.15, y: 1.4 + BASEMENT_Y, z: 60, ry: 90, room: 'bBreaker', label: 'Main breaker' },
  sw('staff', 'staff', 7.9, 62.5, -90),
  sw('boh', 'utility', 20, 56.1, 0),
  sw('west', 'westHall', 10.1, 37.5, 90),
  sw('east', 'eastHall', 35.9, 40, -90),
  sw('dining', 'dining', 34.5, 10.1, 0),
  sw('lobby', 'lobby', 30.1, 6, 90),
  sw('stage', 'booth', 67.9, 25, -90),
  sw('cove', 'cove', 4.1, 14, 90),
  sw('party', 'westHall', 10.1, 29.6, 90),
  sw('play', 'play', 20, 47.9, 180),
  sw('restroom', 'restCorr', 39.9, 36, -90),
  sw('kitchen', 'kitchen', 50, 44.1, 0),
  sw('office', 'office', 22.1, 49, 90),
  sw('backstage', 'backstage', 54.1, 33, 90),
  sw('parts', 'parts', 70, 35.9, 180),
  sw('manager', 'manager', 52.1, 52, 90),
  sw('dock', 'dock', 66.1, 52, 90),
  sw('basement', 'bHall', 12, 64.1, 0, 1.3 + BASEMENT_Y),
  sw('server', 'bServer', 54.1, 61, 90, 1.3 + BASEMENT_Y),
  sw('boiler', 'bBoiler', 40.1, 56, 90, 1.3 + BASEMENT_Y),
  { id: 'honk', type: 'honk', x: 24.5, y: 1.9, z: 48.15, ry: 0, room: 'office', label: 'Honk' },
];

// ---- Props ---------------------------------------------------------------------------------------------

export const PROPS: PropDef[] = [];

function prop(type: string, room: string, x: number, z: number, ry = 0, p?: PropDef['p'], y?: number): void {
  PROPS.push({ type, room, x, z, ry, p, y });
}

/** A solid block with a colour and a size. The client picks materials from `mat`. */
function block(room: string, x: number, z: number, w: number, d: number, h: number, mat: string, extra: PropDef['p'] = {}, y = 0): void {
  prop('block', room, x, z, 0, { w, d, h, mat, ...extra }, y);
}

// Dining Hall: eight tables in two rows, benches either side, a dance floor, soda fountain.
for (const [row, zc] of [[0, 17], [1, 25]] as const) {
  for (let i = 0; i < 4; i++) {
    const x = 22 + i * 8.5 + (row ? 2 : 0);
    prop('table', 'dining', x, zc, 0, { birthday: (row + i) % 2 === 0, hats: true });
  }
}
block('dining', 24, 30.4, 5, 0.9, 1.1, 'steel', { label: 'salad bar' });
block('dining', 46, 30.6, 3.5, 0.9, 1.5, 'steel', { label: 'soda fountain' });
block('dining', 52.7, 28, 0.9, 1.6, 1.0, 'case', { label: 'road case' });

// Prize Corner
block('prize', 22, 1.2, 8, 1.0, 1.1, 'glass', { label: 'prize counter' });
block('prize', 17, 0.7, 3, 0.7, 2.0, 'wood', { label: 'plush shelves' });
block('prize', 27, 0.7, 3, 0.7, 2.0, 'wood', { label: 'balloon rack' });
prop('giftbox', 'prize', 22, 5.2, 0);
prop('musicbox', 'prize', 25, 5.2, 0);
block('prize', 16.2, 6, 1.0, 1.0, 1.6, 'plush', { label: 'giant bear' });

// Lobby
block('lobby', 40, 6.8, 6, 0.9, 1.05, 'wood', { label: 'hostess counter' });
block('lobby', 31, 4, 0.8, 4, 1.6, 'wood', { label: 'merch shelf' });
block('lobby', 47.5, 1.0, 1.4, 0.6, 1.2, 'steel', { label: 'coat check' });

// Arcade: twelve cabinets in two rows
for (let i = 0; i < 6; i++) {
  prop('cabinet', 'arcade', 52.5 + i * 1.8, 1.0, 180, { screen: i % 4 });
  prop('cabinet', 'arcade', 52.5 + i * 1.8, 5.3, 0, { screen: (i + 2) % 4 });
}
block('arcade', 62.4, 7.5, 1.2, 2.2, 1.3, 'glass', { label: 'claw machine' });
block('arcade', 56, 8.8, 4, 0.9, 1.0, 'wood', { label: 'skee-ball' });

// Show stage
prop('deck', 'stage', 61, 15, 0, { w: 14, d: 10, h: 1.0 });
block('stage', 55.0, 11.2, 0.8, 1.0, 1.6, 'speaker');
block('stage', 55.0, 20.3, 0.8, 1.0, 1.6, 'speaker');
block('stage', 66.7, 12, 1.0, 1.2, 1.6, 'speaker', {}, 1.0);
prop('steps', 'dining', 52, 13.5, 0, { w: 1.6, dir: 'x+', n: 3, run: 0.667 });
prop('steps', 'dining', 52, 18.5, 0, { w: 1.6, dir: 'x+', n: 3, run: 0.667 });
prop('steps', 'stage', 63, 22, 0, { w: 1.4, dir: 'z-', n: 3, run: 0.667 });

// Lounge: lockers along the west wall, benches, table, vending
for (let i = 0; i < 14; i++) prop('locker', 'lounge', 2.3, 51.0 + i * 0.6, 90, { n: i + 1, usable: [0, 2, 4, 6, 9, 12].includes(i) });
block('lounge', 6, 54, 2.2, 1.0, 0.75, 'wood', { label: 'break table' });
block('lounge', 12.6, 51, 0.9, 0.8, 1.9, 'vending', { label: 'vending machine' });
block('lounge', 8.5, 58.6, 3, 0.5, 0.45, 'wood', { label: 'bench' });

// Kitchen: prep island, ovens, range, shelving, decorating station
block('kitchen', 44, 48, 6, 1.4, 0.95, 'steel', { label: 'prep island' });
block('kitchen', 37.5, 46.5, 1.2, 4.5, 1.0, 'steel', { label: 'ovens' });
block('kitchen', 44, 44.7, 6, 0.9, 1.0, 'steel', { label: 'range' });
block('kitchen', 50.7, 49, 0.8, 4, 1.0, 'steel', { label: 'decorating station' });
block('pantry', 36.5, 54, 0.6, 3, 2.0, 'steel', { label: 'pantry shelves' });

// Party rooms: a long table each
for (const [i, room] of ['party1', 'party2', 'party3', 'party4'].entries()) {
  const zc = 25.5 + i * 7;
  prop('table', room, 6.5, zc, 90, { birthday: i % 2 === 0, hats: true, long: true });
  block(room, 3.6, zc - 2.4, 0.8, 0.8, 0.8, 'gift', { label: 'gift pile' });
}
prop('coffin', 'party4', 4.0, 48.4, 90);

// Cove
prop('deck', 'cove', 8.5, 15, 0, { w: 8, d: 8, h: 0.4 });
block('cove', 5.2, 19.4, 1.2, 0.8, 0.8, 'wood', { label: 'treasure chest' }, 0.4);

// Play zone: a two-storey frame, a ball pit, shoe cubbies
block('play', 22, 40, 9, 5, 0.35, 'play', { label: 'ball pit rim' });
block('play', 17, 36, 4, 4, 1.2, 'play', { label: 'soft-play platform' });
block('play', 27, 36, 4, 4, 1.2, 'play', { label: 'slide base' });
block('play', 29.8, 44, 3, 0.8, 0.9, 'wood', { label: 'shoe cubbies' });

// Security office: desk with monitors
block('office', 25, 49.3, 3.4, 0.9, 0.78, 'wood', { label: 'security desk' });
prop('chair', 'office', 25, 50.8, 0);

// Restrooms
for (let i = 0; i < 3; i++) block('men', 42 + i * 2, 33.2, 0.1, 2.2, 2.0, 'tile', { label: 'stall' });
for (let i = 0; i < 3; i++) block('women', 39 + i * 2.5, 38.2, 0.1, 2.2, 2.0, 'tile', { label: 'stall' });

// Backstage and parts
block('backstage', 60, 31, 6, 1.0, 0.95, 'wood', { label: 'workbench' });
block('backstage', 66.8, 30, 0.6, 5, 1.8, 'wood', { label: 'costume rack' });
for (let i = 0; i < 4; i++) block('parts', 70.5 + i * 3, 31, 1.4, 1.4, 1.9, 'sheet', { label: 'withered animatronic' });
block('parts', 80.4, 28, 0.8, 5, 2.0, 'steel', { label: 'crates' });

// Supply closet, manager, dock
block('supply', 29, 54.5, 0.8, 3, 2.0, 'wood', { label: 'shelves' });
block('supply', 35.4, 54.5, 0.8, 3, 2.0, 'wood', { label: 'shelves' });
block('manager', 55, 51.2, 2.4, 1.0, 0.78, 'wood', { label: 'desk' });
block('manager', 57.5, 54.6, 0.8, 0.8, 1.4, 'steel', { label: 'filing cabinet' });
for (let i = 0; i < 5; i++) block('dock', 70 + (i % 3) * 1.2, 52 + Math.floor(i / 3) * 1.2, 1.0, 1.0, 1.0 + (i % 2) * 0.8, 'crate', {});
block('dock', 80, 56, 1.4, 4, 1.2, 'steel', { label: 'charging cart' });

// Utility corridor clutter
block('utility', 48, 57.7, 1.0, 1.0, 0.9, 'steel', { label: 'laundry cart' });
block('utility', 58, 56.7, 0.6, 0.6, 0.5, 'steel', { label: 'mop bucket' });

// Basement
prop('stairs', 'stairTop', 36, 59, 0, { w: 4, run: 5, drop: -BASEMENT_Y });
block('bBreaker', 22.3, 60, 0.6, 6, 2.4, 'steel', { label: 'main breaker panel' }, BASEMENT_Y);
block('bBreaker', 29.4, 60, 1.0, 5, 1.2, 'steel', { label: 'battery bank' }, BASEMENT_Y);
block('bBoiler', 46, 56, 4, 4, 3.6, 'steel', { label: 'boiler' }, BASEMENT_Y);
block('bBoiler', 41, 62, 1.5, 1.5, 1.2, 'steel', { label: 'generator' }, BASEMENT_Y);
block('bServer', 58, 59.4, 5, 0.9, 2.0, 'steel', { label: 'server racks' }, BASEMENT_Y);
block('bOld', 12, 58, 1.6, 1.6, 1.6, 'wood', { label: 'old stage' }, BASEMENT_Y);
block('bOld', 18.6, 62, 0.8, 2, 1.8, 'wood', { label: 'old cabinets' }, BASEMENT_Y);
block('bHall', 22, 66.4, 8, 0.4, 0.4, 'steel', { label: 'pipes' }, BASEMENT_Y);
