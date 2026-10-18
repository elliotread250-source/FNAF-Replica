// The pizzeria, authored as data. Rooms are unions of integer rectangles on a 1 m grid; build.ts derives the
// walls from where two different rooms (or a room and the outside) meet, so openings are just intervals on
// those walls. See docs/map.svg for the rendered plan and docs/DECISIONS.md for where this departs from the
// hand-written coordinates in the prompt.

import type { CircuitId, FrDoorDef, InteractableDef, ItemSpawnDef, OpeningKind, PropDef, Rect, RoomDef, SecurityCameraDef, SpawnDef, StyleId } from './types';

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
const SH = (name: string, circuit: CircuitId, extra: DoorOpts = {}): DoorOpts => ({ kind: 'shutter', name, circuit, startsOpen: true, ...extra });

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
  { id: 'main-breaker', type: 'mainBreaker', x: 22.65, y: 0.8 + BASEMENT_Y, z: 60, ry: 90, room: 'bBreaker', label: 'Master lever' },
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
  { id: 'musicbox', type: 'musicBox', x: 25, y: 1.15, z: 5.2, ry: 0, room: 'prize', label: 'Music box' },
  { id: 'front-doors', type: 'frontDoors', x: 40, y: 1.2, z: 0.25, ry: 0, room: 'lobby', label: 'Front doors' },
  { id: 'phone', type: 'phone', x: 23.8, y: 0.9, z: 49.2, ry: 0, room: 'office', label: 'Phone' },
  { id: 'office-chair', type: 'officeChair', x: 25, y: 0.7, z: 50.8, ry: 0, room: 'office', label: 'Office chair' },
  { id: 'booth-desk', type: 'boothDesk', x: 61, y: 1.0, z: 23.0, ry: 180, room: 'booth', label: 'Mixing desk' },
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
prop('steps', 'stage', 63, 21.5, 0, { w: 1.4, dir: 'z-', n: 3, run: 0.5 });

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
block('utility', 48, 58.2, 1.0, 1.0, 0.9, 'steel', { label: 'laundry cart' });
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

// ---- Hiding spots ---------------------------------------------------------------------------------------

type HideSpec = Omit<import('./types').HidingSpotDef, 'id' | 'yaw' | 'enterTime' | 'capacity' | 'hazard'> &
  Partial<Pick<import('./types').HidingSpotDef, 'enterTime' | 'capacity' | 'hazard'>>;

export const HIDE_SPECS: HideSpec[] = [];

function hide(spec: HideSpec): void {
  HIDE_SPECS.push(spec);
}

const EYE = { locker: 1.55, under_table: 0.45, closet: 1.55, stall: 1.6, cabinet: 0.6, chest: 0.5, ball_pit: 0.3, curtain: 1.55, costume_rack: 1.55, freezer: 1.55, cart: 0.7, coffin: 0.4, booth: 1.2, stealth_alcove: 1.55, sheet: 0.6, desk: 0.5 } as const;

// Lounge lockers that stand ajar.
for (const p of PROPS.filter((q) => q.type === 'locker' && q.p?.usable)) {
  hide({ type: 'locker', room: 'lounge', x: p.x, y: EYE.locker, z: p.z, cover: 0.9, checkPriority: 0.9, exits: [{ x: p.x + 0.75, z: p.z }] });
}
// Under every table: two exits, either long side.
for (const p of PROPS.filter((q) => q.type === 'table')) {
  const alongZ = (p.ry ?? 0) % 180 !== 0;
  const off = 1.0;
  const exits = alongZ ? [{ x: p.x + off, z: p.z }, { x: p.x - off, z: p.z }] : [{ x: p.x, z: p.z + off }, { x: p.x, z: p.z - off }];
  hide({ type: 'under_table', room: p.room, x: p.x, y: EYE.under_table, z: p.z, cover: 0.6, checkPriority: 0.6, exits, enterTime: 0.7 });
}
hide({ type: 'coffin', room: 'party4', x: 4.0, y: EYE.coffin, z: 48.4, cover: 1, checkPriority: 0.15, exits: [{ x: 5.0, z: 48.4 }] });
hide({ type: 'desk', room: 'office', x: 25, y: EYE.desk, z: 49.3, cover: 0.7, checkPriority: 0.5, exits: [{ x: 25, z: 50.5 }] });
for (let i = 0; i < 3; i++) hide({ type: 'stall', room: 'men', x: 43 + i * 2, y: EYE.stall, z: 33.0, cover: 0.75, checkPriority: 0.7, exits: [{ x: 43 + i * 2, z: 34.6 }] });
for (let i = 0; i < 3; i++) hide({ type: 'stall', room: 'women', x: 40.25 + i * 2.5, y: EYE.stall, z: 38.0, cover: 0.75, checkPriority: 0.7, exits: [{ x: 40.25 + i * 2.5, z: 39.7 }] });
hide({ type: 'freezer', room: 'freezer', x: 50.3, y: EYE.freezer, z: 54.3, cover: 0.85, checkPriority: 0.6, capacity: 2, hazard: 'cold', exits: [{ x: 49.2, z: 53.5 }] });
hide({ type: 'chest', room: 'cove', x: 5.2, y: 0.4 + EYE.chest, z: 19.4, cover: 0.95, checkPriority: 0.4, exits: [{ x: 6.4, z: 18.6 }] });
hide({ type: 'curtain', room: 'stage', x: 66.6, y: 1.0 + EYE.curtain, z: 11.4, cover: 0.8, checkPriority: 0.5, exits: [{ x: 65.2, z: 11.6 }] });
hide({ type: 'curtain', room: 'stage', x: 66.6, y: 1.0 + EYE.curtain, z: 18.6, cover: 0.8, checkPriority: 0.5, exits: [{ x: 65.2, z: 18.4 }] });
hide({ type: 'costume_rack', room: 'backstage', x: 66.8, y: EYE.costume_rack, z: 31, cover: 0.8, checkPriority: 0.6, exits: [{ x: 65.6, z: 31 }] });
hide({ type: 'cabinet', room: 'lobby', x: 40, y: EYE.cabinet, z: 7.6, cover: 0.7, checkPriority: 0.5, exits: [{ x: 40, z: 8.6 }] });
hide({ type: 'closet', room: 'supply', x: 32, y: EYE.closet, z: 55.3, cover: 0.85, checkPriority: 0.8, exits: [{ x: 32, z: 54.2 }] });
hide({ type: 'sheet', room: 'parts', x: 77.5, y: EYE.sheet, z: 32.8, cover: 0.7, checkPriority: 0.5, exits: [{ x: 77.5, z: 34.2 }] });
hide({ type: 'cart', room: 'utility', x: 48, y: EYE.cart, z: 58.2, cover: 0.75, checkPriority: 0.6, exits: [{ x: 46.8, z: 57.5 }] });
hide({ type: 'cabinet', room: 'kitchen', x: 44, y: EYE.cabinet, z: 44.6, cover: 0.8, checkPriority: 0.5, exits: [{ x: 44, z: 45.8 }] });
hide({ type: 'stealth_alcove', room: 'bBoiler', x: 49.5, y: BASEMENT_Y + EYE.stealth_alcove, z: 58.5, cover: 0.7, checkPriority: 0.4, hazard: 'heat', exits: [{ x: 48.6, z: 60 }] });
hide({ type: 'stealth_alcove', room: 'bServer', x: 61, y: BASEMENT_Y + EYE.stealth_alcove, z: 61.5, cover: 0.55, checkPriority: 0.4, exits: [{ x: 60, z: 62.5 }] });
hide({ type: 'cabinet', room: 'bBreaker', x: 29.4, y: BASEMENT_Y + EYE.cabinet, z: 63.2, cover: 0.6, checkPriority: 0.5, exits: [{ x: 28.4, z: 63 }] });

// ---- Power: breaker groups, the panel and the fuse boxes (Part 5.2, 5.3) ------------------------------

/** The twelve breakers on the main panel; each powers a group of circuits. */
export const BREAKER_GROUPS: { id: string; circuits: CircuitId[] }[] = [
  { id: 'dining', circuits: ['dining'] },
  { id: 'stage', circuits: ['stage', 'cove'] },
  { id: 'west', circuits: ['west', 'party'] },
  { id: 'east', circuits: ['east', 'restroom'] },
  { id: 'kitchen', circuits: ['kitchen'] },
  { id: 'play', circuits: ['play', 'lobby'] },
  { id: 'staff', circuits: ['staff'] },
  { id: 'boh', circuits: ['boh', 'manager'] },
  { id: 'backstage', circuits: ['backstage', 'parts'] },
  { id: 'dock', circuits: ['dock'] },
  { id: 'basement', circuits: ['basement', 'boiler', 'server'] },
  { id: 'office', circuits: ['office'] },
];

/** Fuse boxes and the breaker groups each one protects. */
export const FUSE_BOXES: { x: number; y: number; z: number; ry: number; room: string; groups: string[] }[] = [
  { x: 23, y: 1.5, z: 56.13, ry: 0, room: 'utility', groups: ['dining', 'staff', 'boh', 'office'] },
  { x: 75, y: 1.5, z: 24.13, ry: 0, room: 'parts', groups: ['stage', 'backstage', 'dock'] },
  { x: 48.4, y: 1.5, z: 44.13, ry: 0, room: 'kitchen', groups: ['kitchen', 'east', 'play'] },
  { x: 31, y: 1.5 + BASEMENT_Y, z: 64.13, ry: 0, room: 'bHall', groups: ['west', 'basement'] },
];

BREAKER_GROUPS.forEach((g, i) => {
  INTERACTABLES.push({
    id: `breaker:${i}`,
    type: 'breaker',
    index: i,
    x: 22.65,
    y: BASEMENT_Y + (i < 6 ? 1.95 : 1.4),
    z: 57.6 + (i % 6) * 0.96,
    ry: 90,
    room: 'bBreaker',
    label: `${g.id} breaker`,
  });
});
FUSE_BOXES.forEach((f, i) => INTERACTABLES.push({ id: `fusebox:${i}`, type: 'fuseBox', index: i, x: f.x, y: f.y, z: f.z, ry: f.ry, room: f.room, label: `Fuse box ${i + 1}` }));

/** Plates on tables that can be birthday tables; the night picks five. */
export const PLATE_TABLES = PROPS.filter((p) => p.type === 'table' && (p.room === 'dining' || p.room === 'party1' || p.room === 'party3'));
PLATE_TABLES.forEach((t, i) => INTERACTABLES.push({ id: `plate:${i}`, type: 'plate', index: i, x: t.x, y: 0.85, z: t.z, ry: 0, room: t.room, label: 'Birthday plate' }));

export const ITEM_SPAWNS: ItemSpawnDef[] = [
  // Supply closet: the reliable shelf.
  { x: 29, y: 1.1, z: 53.6, room: 'supply', types: ['fuse'], guaranteed: 'fuse' },
  { x: 29, y: 1.1, z: 54.6, room: 'supply', types: ['fuse'], guaranteed: 'fuse' },
  { x: 35.4, y: 1.1, z: 53.8, room: 'supply', types: ['battery'], guaranteed: 'battery' },
  { x: 35.4, y: 1.1, z: 55.0, room: 'supply', types: ['battery'], guaranteed: 'battery' },
  // Cupcakes on the decorating station.
  ...[0, 1, 2, 3, 4].map((i): ItemSpawnDef => ({ x: 50.7, y: 1.05, z: 47.4 + i * 0.8, room: 'kitchen', types: ['cupcake'], guaranteed: 'cupcake' })),
  // Random spots around the building.
  { x: 6, y: 0.8, z: 54, room: 'lounge', types: ['battery', 'fuse'] },
  { x: 25.8, y: 0.83, z: 49.3, room: 'office', types: ['battery'] },
  { x: 16, y: 0.05, z: 57.5, room: 'utility', types: ['fuse', 'battery'] },
  { x: 40, y: 0.05, z: 57.5, room: 'utility', types: ['fuse'] },
  { x: 80, y: 1.25, z: 54.5, room: 'dock', types: ['fuse', 'battery'] },
  { x: 60, y: 1.0, z: 31, room: 'backstage', types: ['fuse', 'battery'] },
  { x: 40, y: 1.1, z: 6.8, room: 'lobby', types: ['battery'] },
  { x: 55, y: 0.83, z: 51.2, room: 'manager', types: ['battery', 'fuse'] },
  { x: 26, y: 1.15, z: 2.0, room: 'prize', types: ['battery'] },
  { x: 58, y: 2.05, z: 59.4, room: 'bServer', types: ['fuse'] },
  { x: 12, y: 1.65 + BASEMENT_Y, z: 58, room: 'bOld', types: ['battery'] },
  { x: 72, y: 0.05, z: 30, room: 'parts', types: ['fuse'] },
];

// The Faz-Pad charges on the security desk.
ITEM_SPAWNS.push({ x: 26.3, y: 0.83, z: 49.2, room: 'office', types: ['fazpad'], guaranteed: 'fazpad' });

// ---- Security cameras (Part 3.33) ----------------------------------------------------------------------

const look = (x: number, z: number, tx: number, tz: number) => Math.atan2(-(tx - x), -(tz - z));
export const CAMERAS: SecurityCameraDef[] = [
  { id: '1A', name: 'Show Stage', x: 47, y: 4.2, z: 15.5, yaw: -Math.PI / 2, pitch: -0.18, room: 'dining' },
  { id: '1B', name: 'Dining Hall', x: 34, y: 4.6, z: 10.4, yaw: Math.PI, pitch: -0.35, room: 'dining' },
  { id: '1C', name: 'Pirate Cove', x: 17.5, y: 3.4, z: 11.5, yaw: look(17.5, 11.5, 8, 16), pitch: -0.25, room: 'dining' },
  { id: '2A', name: 'West Hall', x: 12, y: 3.2, z: 22.6, yaw: Math.PI, pitch: -0.22, room: 'westHall' },
  { id: '2B', name: 'West Corner', x: 21.6, y: 3.2, z: 48.4, yaw: look(21.6, 48.4, 16, 51.5), pitch: -0.3, room: 'westCorner' },
  { id: '3', name: 'Parts & Service', x: 81.5, y: 2.5, z: 24.5, yaw: look(81.5, 24.5, 70, 34), pitch: -0.2, room: 'parts' },
  { id: '4A', name: 'East Hall', x: 34, y: 3.2, z: 32.6, yaw: Math.PI, pitch: -0.22, room: 'eastHall' },
  { id: '4B', name: 'East Corner', x: 31.6, y: 3.2, z: 48.4, yaw: look(31.6, 48.4, 28, 51), pitch: -0.3, room: 'eastCorner' },
  { id: '5', name: 'Backstage', x: 67.5, y: 3.0, z: 35.5, yaw: look(67.5, 35.5, 56, 29), pitch: -0.25, room: 'backstage' },
  { id: '6', name: 'Kitchen', x: 44, y: 3.2, z: 44.4, yaw: Math.PI, pitch: -0.3, room: 'kitchen', audioOnly: true },
  { id: '7', name: 'Restrooms', x: 39.6, y: 2.8, z: 32.4, yaw: look(39.6, 32.4, 37, 36), pitch: -0.3, room: 'restCorr' },
  { id: '8', name: 'Prize Corner', x: 28.5, y: 3.2, z: 9.5, yaw: look(28.5, 9.5, 22, 5), pitch: -0.3, room: 'prize' },
  { id: '9', name: 'Arcade', x: 63.5, y: 3.2, z: 9.5, yaw: look(63.5, 9.5, 54, 3), pitch: -0.25, room: 'arcade' },
  { id: '10', name: 'Lobby', x: 49.5, y: 3.2, z: 9.5, yaw: look(49.5, 9.5, 38, 2), pitch: -0.25, room: 'lobby' },
  { id: '11', name: 'Play Zone', x: 31.5, y: 4.2, z: 47.5, yaw: look(31.5, 47.5, 22, 38), pitch: -0.3, room: 'play' },
  { id: '12', name: 'Party Rooms Hall', x: 12, y: 3.2, z: 49.4, yaw: 0, pitch: -0.22, room: 'westHall' },
  { id: '13', name: 'Utility Corridor', x: 65.5, y: 2.7, z: 57.5, yaw: Math.PI / 2, pitch: -0.15, room: 'utility' },
  { id: '14', name: 'Loading Dock', x: 81.5, y: 4.0, z: 61.5, yaw: look(81.5, 61.5, 70, 52), pitch: -0.25, room: 'dock' },
  { id: '15', name: 'Basement Hall', x: 61.5, y: BASEMENT_Y + 2.5, z: 65.5, yaw: Math.PI / 2, pitch: -0.15, room: 'bHall' },
  { id: '16', name: 'Breaker Room', x: 29.5, y: BASEMENT_Y + 2.9, z: 56.5, yaw: look(29.5, 56.5, 22.5, 60), pitch: -0.35, room: 'bBreaker' },
];
