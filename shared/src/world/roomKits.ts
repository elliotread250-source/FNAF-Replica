// Set dressing for the rest of the building, authored like officeKit.ts: one catalogue that the level build reads
// for collision and the renderer reads for meshes. Every part has a stable id, the room it belongs to, world-axis
// bounds, a collision policy and, if solid, its exact boxes. The canonical 2014 rooms (stage, dining, cove, the
// halls and corners, supply closet, backstage, kitchen, restrooms) come first; the free-roam extensions after.
// docs/MAP_REBUILD_PROGRESS.md has the per-room inventory and what is interpreted rather than seen in 2014.

import { BASEMENT_Y } from './layout';
import type { Collider } from './types';

export type KitPolicy = 'solid' | 'surface' | 'flat' | 'overhead';

export type KitKind =
  | 'poster'
  | 'drawings'
  | 'sign'
  | 'bunting'
  | 'wires'
  | 'shelf'
  | 'cabinet'
  | 'bucket'
  | 'bin'
  | 'wedge'
  | 'truss'
  | 'stars'
  | 'heads'
  | 'endo'
  | 'hood'
  | 'fridge'
  | 'pots'
  | 'sink'
  | 'mirror'
  | 'pipes'
  | 'crates'
  | 'barrels'
  | 'puddle'
  | 'rack'
  | 'board'
  | 'toilet'
  | 'timeclock'
  | 'coats'
  | 'lockers'
  | 'keypad';

export interface KitPart {
  id: string;
  room: string;
  kind: KitKind;
  /** Base for floor and surface items; centre for wall decals and overhead parts. */
  x: number;
  y: number;
  z: number;
  /** World-axis extents (after `ry`). */
  w: number;
  h: number;
  d: number;
  /** Degrees. For wall items, the direction the face points: 0 = +Z, 90 = +X, 180 = -Z, -90 = -X. */
  ry: number;
  policy: KitPolicy;
  boxes?: Collider[];
  p?: Record<string, string | number | boolean>;
  note: string;
}

export const ROOM_KITS: KitPart[] = [];

const box = (x1: number, x2: number, z1: number, z2: number, y1: number, y2: number, low = false): Collider => ({ x1, x2, z1, z2, y1, y2, kind: 'prop', low });

/** A solid floor-standing part whose collider is exactly its bounds. */
function solid(id: string, room: string, kind: KitKind, x: number, z: number, w: number, d: number, h: number, ry: number, note: string, p?: KitPart['p'], y = 0): void {
  ROOM_KITS.push({ id, room, kind, x, y, z, w, h, d, ry, policy: 'solid', boxes: [box(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y, y + h, h <= 1.0)], p, note });
}

/** A flat wall decal (poster, sign, drawing cluster): `ry` is the facing; the plane sits 6 mm off `face`. */
function wall(id: string, room: string, kind: KitKind, axis: 'x' | 'z', face: number, along: number, y: number, w: number, h: number, ry: number, note: string, p?: KitPart['p']): void {
  const n = ry === 0 ? 1 : ry === 180 ? -1 : ry === 90 ? 1 : -1;
  const x = axis === 'x' ? face + n * 0.006 : along;
  const z = axis === 'x' ? along : face + n * 0.006;
  ROOM_KITS.push({ id, room, kind, x, y, z, w: axis === 'x' ? 0.01 : w, h, d: axis === 'x' ? w : 0.01, ry, policy: 'flat', p, note });
}

function over(id: string, room: string, kind: KitKind, x: number, y: number, z: number, w: number, h: number, d: number, note: string, p?: KitPart['p']): void {
  ROOM_KITS.push({ id, room, kind, x, y, z, w, h, d, ry: 0, policy: 'overhead', p, note });
}

function surface(id: string, room: string, kind: KitKind, x: number, y: number, z: number, w: number, h: number, d: number, note: string, p?: KitPart['p']): void {
  ROOM_KITS.push({ id, room, kind, x, y, z, w, h, d, ry: 0, policy: 'surface', p, note });
}

// Internal walls are 0.2 m thick (face 0.1 off the line), exterior walls 0.35 m (face 0.175 off).

// ---- West Hall (CAM 2A): long, dim, posters and kids' art on the east wall, cables along the ceiling --------
wall('westHall.poster.celebrate', 'westHall', 'poster', 'x', 13.9, 35, 1.85, 0.9, 1.2, -90, 'Celebrate! group poster.', { art: 'celebrate', seed: 41 });
wall('westHall.poster.rules', 'westHall', 'poster', 'x', 13.9, 44.5, 1.8, 0.6, 0.8, -90, 'Staff rules sheet near the office end.', { art: 'rules', seed: 42 });
wall('westHall.drawings.1', 'westHall', 'drawings', 'x', 13.9, 39.6, 1.75, 2.2, 0.9, -90, 'A run of children\'s drawings.', { n: 6, seed: 70 });
wall('westHall.drawings.2', 'westHall', 'drawings', 'x', 10.1, 43.5, 1.7, 1.6, 0.8, 90, 'More drawings on the party-room side.', { n: 4, seed: 80 });
over('westHall.wires', 'westHall', 'wires', 12, 3.35, 36, 0.4, 0.4, 27, 'Cable bundle clipped along the ceiling, sagging between clips.', { axis: 'z', from: 22.6, to: 49.4, x: 13.3 });
solid('westHall.bin', 'westHall', 'bin', 13.55, 30.9, 0.42, 0.42, 0.6, 0, 'Dented steel bin against the east wall.');

// ---- West Corner (CAM 2B) ---------------------------------------------------------------------------------
// South wall is the building's exterior (no room south of x 14..22, z 52), so its face is 0.175 in.
wall('westCorner.poster.celebrate', 'westCorner', 'poster', 'z', 51.825, 17.2, 1.85, 0.9, 1.2, 180, 'The corner poster the camera frames.', { art: 'celebrate', seed: 43 });
wall('westCorner.poster.eyeless', 'westCorner', 'poster', 'z', 51.825, 19.3, 1.8, 0.7, 0.95, 180, 'A darker, damaged print of the same poster.', { art: 'eyeless', seed: 44 });
over('westCorner.wires', 'westCorner', 'wires', 18, 3.35, 49.2, 8, 0.4, 0.4, 'Cables continuing toward the office.', { axis: 'x', from: 14.4, to: 21.6, z: 48.6 });

// ---- East Hall (CAM 4A) and East Corner (CAM 4B) ----------------------------------------------------------
wall('eastHall.drawings.1', 'eastHall', 'drawings', 'x', 32.1, 37.5, 1.75, 2.6, 0.9, 90, 'Kids\' drawings, the long run on the west wall.', { n: 7, seed: 90 });
wall('eastHall.poster.celebrate', 'eastHall', 'poster', 'x', 32.1, 42.6, 1.85, 0.9, 1.2, 90, 'Celebrate! poster.', { art: 'celebrate', seed: 45 });
wall('eastHall.poster.rules', 'eastHall', 'poster', 'x', 35.9, 38.6, 1.8, 0.6, 0.8, -90, 'Rules sheet beside the restroom corridor.', { art: 'rules', seed: 46 });
over('eastHall.wires', 'eastHall', 'wires', 34, 3.35, 42, 0.4, 0.4, 19, 'Cable bundle along the ceiling.', { axis: 'z', from: 32.6, to: 51.4, x: 34.7 });
solid('eastHall.bin', 'eastHall', 'bin', 32.45, 45.6, 0.42, 0.42, 0.6, 0, 'Bin by the play-zone wall.');
wall('eastCorner.poster.eat', 'eastCorner', 'poster', 'z', 51.9, 30.2, 1.85, 0.75, 1.0, 180, '"Let\'s eat!" poster (original art).', { art: 'eat', seed: 47 });
wall('eastCorner.drawings', 'eastCorner', 'drawings', 'z', 51.9, 28.9, 1.75, 1.0, 0.7, 180, 'A few drawings beside it.', { n: 3, seed: 100 });

// ---- Dining Hall (CAM 1B) ---------------------------------------------------------------------------------
for (const [i, x] of [15.6, 31.3, 47.6].entries()) wall(`dining.poster.n${i + 1}`, 'dining', 'poster', 'z', 10.1, x, 2.1, 0.9, 1.2, 0, 'Celebrate! poster between the north arches.', { art: 'celebrate', seed: 50 + i });
for (const [i, x] of [17.5, 31.0, 40.5].entries()) wall(`dining.poster.s${i + 1}`, 'dining', 'poster', 'z', 31.9, x, 2.1, 0.9, 1.2, 180, 'Poster on the south wall.', { art: i === 1 ? 'eat' : 'celebrate', seed: 60 + i });
wall('dining.drawings', 'dining', 'drawings', 'z', 31.9, 44.5, 1.8, 2.4, 0.9, 180, 'Kids\' drawings by the soda fountain.', { n: 6, seed: 110 });
for (let i = 0; i < 4; i++) over(`dining.bunting.${i + 1}`, 'dining', 'bunting', 34, 4.15, 13.5 + i * 5, 39, 0.6, 0.2, 'Paper pennant bunting across the hall.', { axis: 'x', from: 14.4, to: 53.6, z: 13.5 + i * 5, seed: i });
over('dining.wires', 'dining', 'wires', 34, 4.85, 30.5, 39, 0.3, 0.3, 'Cable run along the south ceiling edge.', { axis: 'x', from: 14.4, to: 53.6, z: 31.2 });

// ---- Show Stage (CAM 1A) ----------------------------------------------------------------------------------
// Deck is x 54..68, z 10..20 (top at 1.0). The band stands centre stage; nothing solid goes between x 58..65.
wall('stage.stars', 'stage', 'stars', 'x', 67.54, 15, 3.0, 12.4, 3.6, -90, 'Painted stars on the backdrop.', { n: 40, seed: 7 });
wall('stage.banner', 'stage', 'sign', 'x', 67.53, 15, 4.25, 6.0, 0.7, -90, '"CELEBRATE!" banner over the band (original lettering).', { text: 'CELEBRATE!', bg: '#1a2a6a', fg: '#ffd21a' });
over('stage.truss', 'stage', 'truss', 60, 4.45, 15, 0.25, 0.25, 11, 'Lighting truss with six can lights over the deck.', { axis: 'z', from: 9.8 + 0.4, to: 19.8, x: 60, cans: 6 });
solid('stage.wedge.1', 'stage', 'wedge', 55.0, 15.3, 0.5, 0.6, 0.32, 0, 'Floor monitor wedge at the deck lip.', undefined, 1.0);
solid('stage.wedge.2', 'stage', 'wedge', 55.0, 16.6, 0.5, 0.6, 0.32, 0, 'Second monitor wedge.', undefined, 1.0);

// ---- Pirate Cove (CAM 1C) ---------------------------------------------------------------------------------
wall('cove.sign', 'cove', 'sign', 'x', 13.26, 16, 1.55, 1.0, 0.6, 90, '"SORRY! OUT OF ORDER" sign pinned to the curtain.', { text: 'SORRY! OUT OF ORDER', bg: '#f2ecdc', fg: '#2a1a10' });
wall('cove.stars', 'cove', 'stars', 'x', 4.175, 16, 2.0, 10, 2.6, 90, 'Gold stars painted on the back wall.', { n: 24, seed: 3 });

// ---- Supply Closet (CAM 3) --------------------------------------------------------------------------------
// The fuses and batteries spawn at y 1.1 on these shelves (x 29 and x 35.4), and the "closet" hiding spot at
// (32, 55.3) is inside the cleaning cabinet. Door from East Hall at z 52, x 33..34; back door z 56, x 30..31.
solid('supply.shelf.west', 'supply', 'shelf', 29.0, 54.1, 0.8, 2.2, 1.9, 90, 'Steel shelving: paper towels, cleaner, spare bulbs.', { tiers: 4, top: 1.08 });
solid('supply.shelf.east', 'supply', 'shelf', 35.4, 54.4, 0.8, 2.2, 1.9, -90, 'Steel shelving: boxes, battery packs.', { tiers: 4, top: 1.08 });
solid('supply.cabinet', 'supply', 'cabinet', 32.0, 55.55, 1.1, 0.7, 2.0, 180, 'Tall cleaning cabinet; the hiding spot.', { doors: 2 });
solid('supply.bucket', 'supply', 'bucket', 30.3, 53.0, 0.45, 0.45, 0.42, 0, 'Mop bucket on casters with a wringer and a mop.');

// ---- Backstage (CAM 5) ------------------------------------------------------------------------------------
solid('backstage.shelf.heads', 'backstage', 'heads', 56.6, 28.45, 3.2, 0.5, 1.9, 0, 'Wall shelf of spare costume heads staring out.', { tiers: 3, heads: 5 });
surface('backstage.endo', 'backstage', 'endo', 60, 0.95, 31, 1.6, 0.35, 0.6, 'A bare endoskeleton laid on the workbench (parts, not a character).');
wall('backstage.board', 'backstage', 'board', 'z', 35.825, 60.5, 1.6, 1.8, 1.0, 180, 'Pegboard of tools and wiring diagrams.', { seed: 5 });

// ---- Kitchen (CAM 6, audio only in 2014; interpreted) -----------------------------------------------------
over('kitchen.hood', 'kitchen', 'hood', 44, 2.65, 44.75, 6.2, 0.6, 1.2, 'Extraction hood over the range; underside 2.35 m.');
solid('kitchen.fridge', 'kitchen', 'fridge', 51.35, 45.1, 0.9, 0.8, 2.0, -90, 'Two-door upright fridge.');
surface('kitchen.pots', 'kitchen', 'pots', 44, 1.0, 44.7, 4.0, 0.3, 0.6, 'Stock pots and a pan on the range.');
wall('kitchen.board', 'kitchen', 'board', 'z', 44.1, 39.5, 1.6, 1.6, 0.9, 0, 'Order rail and a utensil rack.', { seed: 9 });
solid('kitchen.bin', 'kitchen', 'bin', 47.0, 51.55, 0.5, 0.5, 0.75, 0, 'Grease-stained kitchen bin.');

// ---- Restrooms (CAM 7) -------------------------------------------------------------------------------------
solid('men.sinks', 'men', 'sink', 45.75, 36.63, 3.5, 0.55, 0.86, 180, 'Counter with two sinks along the south wall.', { n: 2 });
wall('men.mirror', 'men', 'mirror', 'z', 36.9, 45.75, 1.55, 3.0, 0.8, 180, 'Fogged, spotted mirror.');
solid('women.sinks', 'women', 'sink', 40.25, 43.63, 3.5, 0.55, 0.86, 180, 'Counter with two sinks.', { n: 2 });
wall('women.mirror', 'women', 'mirror', 'z', 43.9, 40.25, 1.55, 3.0, 0.8, 180, 'Mirror.');
// Toilets at the back of each stall (the hiding spots stand in front of them).
for (const [i, x] of [43, 45, 47].entries()) solid(`men.toilet.${i + 1}`, 'men', 'toilet', x, 32.45, 0.4, 0.66, 0.45, 0, 'Toilet with a cracked seat.');
for (const [i, x] of [40.25, 42.75, 45.25].entries()) solid(`women.toilet.${i + 1}`, 'women', 'toilet', x, 37.45, 0.4, 0.66, 0.45, 0, 'Toilet.');
wall('restCorr.sign', 'restCorr', 'sign', 'x', 39.9, 33.2, 2.2, 1.2, 0.3, -90, '"RESTROOMS" sign.', { text: 'RESTROOMS', bg: '#1a3a5a', fg: '#e8f0ff' });
ROOM_KITS.push({ id: 'restCorr.puddle', room: 'restCorr', kind: 'puddle', x: 37.6, y: 0.004, z: 35.6, w: 1.1, h: 0.002, d: 0.8, ry: 0, policy: 'flat', note: 'A puddle from a leaking cistern.' });

// ---- Extensions -------------------------------------------------------------------------------------------
wall('lobby.sign', 'lobby', 'sign', 'z', 9.9, 33, 2.6, 4.2, 0.6, 180, 'Welcome sign beside the way into the dining hall.', { text: 'WELCOME! PIZZA & FUN', bg: '#3a0a1a', fg: '#ffd21a' });
wall('lobby.poster', 'lobby', 'poster', 'x', 30.1, 8.0, 1.8, 0.8, 1.1, 90, 'Birthday packages poster.', { art: 'celebrate', seed: 71 });
wall('arcade.sign', 'arcade', 'sign', 'z', 9.9, 57, 2.6, 3.2, 0.5, 180, '"PRIZE TICKETS" sign.', { text: 'WIN TICKETS!', bg: '#200028', fg: '#ff60d0' });
wall('prize.sign', 'prize', 'sign', 'z', 9.9, 28, 2.6, 3.2, 0.5, 180, 'Prize corner sign.', { text: 'PRIZE CORNER', bg: '#3a0a2a', fg: '#ffffff' });
for (const [i, room] of ['party1', 'party2', 'party3', 'party4'].entries()) {
  const zc = 22.5 + i * 7;
  for (let k = 0; k < 2; k++) over(`${room}.bunting.${k + 1}`, room, 'bunting', 6.5, 2.55, zc + 2 + k * 3, 6.6, 0.5, 0.2, 'Pennants across the party room.', { axis: 'x', from: 3.3, to: 9.7, z: zc + 2 + k * 3, seed: 10 + i * 2 + k });
  wall(`${room}.poster`, room, 'poster', 'x', 3.175, zc + 5.2, 1.8, 0.8, 1.1, 90, 'Theme poster.', { art: i === 3 ? 'eyeless' : 'celebrate', seed: 80 + i });
}
wall('staff.board', 'staff', 'board', 'x', 2.175, 63, 1.6, 1.4, 0.9, 90, 'Noticeboard: rotas, a missing-child flyer, safety notices.', { seed: 12 });
// Staff Entrance: exterior walls on three sides (faces 0.175 in). Spawns stand at x 3.5 / 6.5, z 61.5 / 63.5.
wall('staff.timeclock', 'staff', 'timeclock', 'x', 7.825, 64.7, 1.35, 0.32, 0.42, -90, 'Punch clock with a rack of time cards.');
wall('staff.coats', 'staff', 'coats', 'x', 2.175, 61.0, 1.55, 1.3, 0.9, 90, 'Coat hooks: two jackets and a stained apron. Soft cloth, no collider.');
solid('staff.lockers', 'staff', 'lockers', 2.45, 64.95, 0.5, 1.3, 1.8, 90, 'Three scuffed half-height staff lockers.');
wall('staff.keypad', 'staff', 'keypad', 'z', 65.825, 6.65, 1.4, 0.16, 0.22, 180, 'Alarm keypad beside the exit, one red LED.');
ROOM_KITS.push({ id: 'staff.mat', room: 'staff', kind: 'puddle', x: 5, y: 0.004, z: 65.2, w: 1.4, h: 0.002, d: 0.8, ry: 0, policy: 'flat', p: { mat: true }, note: 'Rubber doormat by the exit.' });
wall('lounge.board', 'lounge', 'board', 'z', 59.825, 10.5, 1.6, 1.6, 0.9, 180, 'Employee of the month board.', { seed: 13 });
solid('utility.crates', 'utility', 'crates', 58.5, 58.35, 1.6, 0.9, 1.2, 0, 'Stacked supply crates against the south wall.');
over('utility.pipes', 'utility', 'pipes', 40, 2.75, 56.4, 51, 0.25, 0.25, 'Water and gas pipes along the ceiling.', { axis: 'x', from: 14.4, to: 65.6, z: 56.4 });
solid('dock.pallets', 'dock', 'crates', 79.5, 52.5, 2.4, 1.6, 1.4, 0, 'Shrink-wrapped pallets of pizza boxes.');
solid('dock.barrels', 'dock', 'barrels', 80.8, 59.8, 1.2, 1.2, 1.0, 0, 'Oil drums.');
solid('parts.rack', 'parts', 'rack', 81.2, 33.6, 0.9, 2.8, 2.0, -90, 'Rack of spare limbs and servo boxes.');
wall('booth.board', 'booth', 'board', 'z', 27.9, 57, 1.6, 1.4, 0.8, 180, 'Show schedules and cue sheets.', { seed: 14 });

// ---- Basement: concrete, pipes, damp ------------------------------------------------------------------------
const B = BASEMENT_Y;
over('bHall.pipes', 'bHall', 'pipes', 36, B + 2.45, 66.4, 51, 0.3, 0.3, 'Heavy pipes along the hall ceiling, lowest point 2.3 m.', { axis: 'x', from: 10.4, to: 61.6, z: 66.4 });
ROOM_KITS.push({ id: 'bHall.puddle', room: 'bHall', kind: 'puddle', x: 30, y: B + 0.004, z: 65.6, w: 2.4, h: 0.002, d: 1.2, ry: 0, policy: 'flat', note: 'Standing water under a weeping joint.' });
solid('bOld.crates', 'bOld', 'crates', 11.2, 55.2, 1.6, 1.4, 1.5, 0, 'Old crates of decorations.', undefined, B);
solid('bOld.barrels', 'bOld', 'barrels', 18.8, 55.0, 1.2, 1.2, 1.0, 0, 'Drums of cleaning chemicals.', undefined, B);
over('bBoiler.pipes', 'bBoiler', 'pipes', 46, B + 3.9, 52.6, 11, 0.4, 0.4, 'Boiler flue and feed pipes.', { axis: 'x', from: 40.4, to: 51.6, z: 52.6 });
over('bServer.wires', 'bServer', 'wires', 58, B + 2.6, 58.5, 7, 0.2, 0.2, 'Camera cable trunk.', { axis: 'x', from: 54.4, to: 61.6, z: 58.5 });

/** All solid boxes, for the level build. */
export function roomKitColliders(): Collider[] {
  return ROOM_KITS.flatMap((p) => (p.policy === 'solid' ? (p.boxes ?? []) : []));
}
