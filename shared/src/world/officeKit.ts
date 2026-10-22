// The free-roam Security Office, authored as one catalogue that both the collision build and the renderer
// read. Each part has a stable id, a world transform, the box it occupies and an explicit collision policy, so
// what you see is what you bump into. Coordinates are world metres: the office is x 22..28, z 48..56, the
// desk sits against the north wall (z = 48) and the seated guard faces north (yaw 0), with the West and East
// security shutters at x = 22 and x = 28, z 50..52. See docs/MAP_REBUILD_PROGRESS.md for reference notes and
// the deliberate differences from the 2014 office.

import type { Collider } from './types';

/**
 * - `solid`: blocks bodies with the listed boxes.
 * - `surface`: rests on another part (desk clutter); no collider, the part under it already blocks.
 * - `flat`: paper, posters, tape and stickers on a wall or desk; never collides.
 * - `overhead`: ceiling fixtures and cables, all above standing head height; no collider.
 */
export type OfficePolicy = 'solid' | 'surface' | 'flat' | 'overhead';

export type OfficePartKind =
  | 'desk'
  | 'crt'
  | 'fan'
  | 'chair'
  | 'cup'
  | 'papers'
  | 'poster'
  | 'drawing'
  | 'doorPanel'
  | 'shutterFrame'
  | 'cables'
  | 'ceilingGrid'
  | 'lamp'
  | 'bin'
  | 'cabinet'
  | 'cobweb';

export interface OfficePart {
  id: string;
  kind: OfficePartKind;
  /** Base centre (bottom of the part for floor/desk items; centre for wall items). */
  x: number;
  y: number;
  z: number;
  /** World-axis size of the part's bounding box, metres (already accounting for `ry`). */
  w: number;
  h: number;
  d: number;
  /** Degrees about Y. Wall items use it to face away from their wall. */
  ry: number;
  policy: OfficePolicy;
  /** World-space collision boxes for `solid` parts. */
  boxes?: Collider[];
  /** Free parameters for the renderer (screen state, poster kind, side...). */
  p?: Record<string, string | number | boolean>;
  note: string;
}

export const OFFICE_RECT = { x1: 22, z1: 48, x2: 28, z2: 56 } as const;
/** Desk top height. Real reception desks are 0.73..0.76; this one is an old built-in with a thick top. */
export const DESK_TOP = 0.78;
const DESK = { x: 25, z: 49.3, w: 3.4, d: 0.9 };
/** Inner face of the north wall (internal walls are 0.2 thick). */
const NORTH_FACE = 48.1;
const WEST_FACE = 22.1;
const EAST_FACE = 27.9;

const solid = (x1: number, x2: number, z1: number, z2: number, y1: number, y2: number, low = false): Collider => ({ x1, x2, z1, z2, y1, y2, kind: 'prop', low });

const dx1 = DESK.x - DESK.w / 2;
const dx2 = DESK.x + DESK.w / 2;
const dz1 = DESK.z - DESK.d / 2;
const dz2 = DESK.z + DESK.d / 2;

export const OFFICE_KIT: OfficePart[] = [
  {
    id: 'office.desk',
    kind: 'desk',
    x: DESK.x,
    y: 0,
    z: DESK.z,
    w: DESK.w,
    h: DESK_TOP,
    d: DESK.d,
    ry: 0,
    policy: 'solid',
    // Top slab, two drawer pedestals and a modesty panel. The footwell between the pedestals is open, so a
    // crawling guard (0.6 m) fits under the 0.72 m underside; that is the desk hiding spot.
    boxes: [
      solid(dx1, dx2, dz1, dz2, DESK_TOP - 0.06, DESK_TOP),
      solid(dx1, dx1 + 0.5, dz1, dz2, 0, DESK_TOP - 0.06),
      solid(dx2 - 0.5, dx2, dz1, dz2, 0, DESK_TOP - 0.06),
      solid(dx1 + 0.5, dx2 - 0.5, dz1, dz1 + 0.05, 0.12, DESK_TOP - 0.06),
    ],
    note: 'Old built-in security desk, chipped laminate over particleboard, steel drawer runners.',
  },
  // CRT bank, left of centre: two big sets side by side, a small one on top of the left set, as in the 2014
  // office where the monitors crowd the desk's west half.
  crt('office.crt.1', 24.25, DESK_TOP, 49.12, 0.52, 0.44, 0.48, 8, { screen: 'feed' }),
  crt('office.crt.2', 24.85, DESK_TOP, 49.08, 0.44, 0.38, 0.42, -6, { screen: 'off' }),
  crt('office.crt.3', 24.3, DESK_TOP + 0.44, 49.1, 0.38, 0.32, 0.36, 4, { screen: 'static' }),
  {
    id: 'office.fan',
    kind: 'fan',
    x: 25.55,
    y: DESK_TOP,
    z: 49.35,
    w: 0.42,
    h: 0.56,
    d: 0.3,
    ry: -14,
    policy: 'surface',
    note: 'Pedestal desk fan: stamped wire cage, four blades, heavy base. Spins down with office power.',
  },
  {
    id: 'office.chair',
    kind: 'chair',
    x: 25,
    y: 0,
    z: 50.8,
    w: 0.6,
    h: 1.05,
    d: 0.6,
    ry: 0,
    policy: 'solid',
    // Seat and gas column as one low box; the backrest (south side, the guard faces north) as a thin slab.
    boxes: [solid(24.75, 25.25, 50.55, 51.05, 0, 0.5, true), solid(24.78, 25.22, 51.0, 51.1, 0.5, 1.05)],
    note: 'Five-star swivel chair, split vinyl seat. The seat interaction puts the guard here.',
  },
  { id: 'office.cup.1', kind: 'cup', x: 25.98, y: DESK_TOP, z: 49.62, w: 0.09, h: 0.17, d: 0.09, ry: 0, policy: 'surface', p: { color: 'red' }, note: 'Red and white soda cup, lid and straw.' },
  { id: 'office.cup.2', kind: 'cup', x: 26.58, y: DESK_TOP, z: 49.55, w: 0.08, h: 0.12, d: 0.08, ry: 0, policy: 'surface', p: { color: 'white' }, note: 'Coffee cup, stained rim.' },
  { id: 'office.papers.1', kind: 'papers', x: 24.95, y: DESK_TOP, z: 49.6, w: 0.4, h: 0.01, d: 0.3, ry: 12, policy: 'flat', p: { n: 5 }, note: 'Logbook pages and a fanned stack of incident forms.' },
  { id: 'office.papers.2', kind: 'papers', x: 26.15, y: DESK_TOP, z: 49.0, w: 0.3, h: 0.01, d: 0.3, ry: -20, policy: 'flat', p: { n: 3 }, note: 'Crumpled memos.' },
  {
    id: 'office.poster.celebrate',
    kind: 'poster',
    x: 24.5,
    y: 2.0,
    z: NORTH_FACE + 0.006,
    w: 0.95,
    h: 1.25,
    d: 0.003,
    ry: 0,
    policy: 'flat',
    p: { art: 'leader' },
    note: 'The group poster above the desk. The honk hotspot (24.5, 1.9) is on the nose; keep them together.',
  },
  ...drawings(),
  doorPanel('office.panel.west', WEST_FACE + 0.03, 90, 'L'),
  doorPanel('office.panel.east', EAST_FACE - 0.03, -90, 'R'),
  shutterFrame('office.shutterframe.west', 22, 'W'),
  shutterFrame('office.shutterframe.east', 28, 'E'),
  { id: 'office.cables', kind: 'cables', x: 24.6, y: 2.55, z: 48.4, w: 3.2, h: 0.5, d: 0.6, ry: 0, policy: 'overhead', note: 'Drooping bundle from the ceiling junction box down the wall to the CRTs.' },
  { id: 'office.ceiling', kind: 'ceilingGrid', x: 25, y: 2.98, z: 52, w: 6, h: 0.02, d: 8, ry: 0, policy: 'overhead', note: 'Stained acoustic tile grid with two sagging tiles.' },
  { id: 'office.lamp', kind: 'lamp', x: 25, y: 3, z: 50.3, w: 0.3, h: 0.7, d: 0.3, ry: 0, policy: 'overhead', note: 'Single warm bulb in a tin shade, on a cord. Lowest point 2.3 m.' },
  {
    id: 'office.bin',
    kind: 'bin',
    x: 26.95,
    y: 0,
    z: 50.25,
    w: 0.32,
    h: 0.42,
    d: 0.32,
    ry: 0,
    policy: 'solid',
    boxes: [solid(26.79, 27.11, 50.09, 50.41, 0, 0.42, true)],
    note: 'Dented wastepaper bin, beside the east pedestal.',
  },
  {
    id: 'office.cabinet',
    kind: 'cabinet',
    x: 27.55,
    y: 0,
    z: 55.2,
    w: 0.62,
    h: 1.32,
    d: 0.5,
    ry: -90,
    policy: 'solid',
    boxes: [solid(27.24, 27.86, 54.95, 55.45, 0, 1.32)],
    note: 'Three-drawer filing cabinet in the back corner, away from the rear door at x 24..25.',
  },
  { id: 'office.cobweb.nw', kind: 'cobweb', x: 22.15, y: 2.92, z: 48.15, w: 0.4, h: 0.4, d: 0.4, ry: 45, policy: 'flat', note: 'Corner web.' },
  { id: 'office.cobweb.ne', kind: 'cobweb', x: 27.85, y: 2.92, z: 48.15, w: 0.3, h: 0.3, d: 0.3, ry: -45, policy: 'flat', note: 'Corner web.' },
];

function crt(id: string, x: number, y: number, z: number, w: number, h: number, d: number, ry: number, p: OfficePart['p']): OfficePart {
  return {
    id,
    kind: 'crt',
    x,
    y,
    z,
    w,
    h,
    d,
    ry,
    policy: 'solid',
    // Monitors sit on the desk; the box keeps hands, rays and dropped items out of the sets.
    boxes: [solid(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y, y + h)],
    p,
    note: '1990s CRT: thick bevel, curved glass, tapered rear, vent slots.',
  };
}

function drawings(): OfficePart[] {
  // Children's crayon drawings taped right of the poster, at uneven heights and tilts.
  const spots: [number, number, number][] = [
    [25.55, 2.18, -5],
    [26.05, 2.32, 4],
    [26.55, 2.12, -3],
    [27.1, 2.28, 6],
    [25.8, 1.68, 3],
    [26.4, 1.62, -7],
    [27.0, 1.72, 2],
  ];
  return spots.map(([x, y, tilt], i) => ({
    id: `office.drawing.${i + 1}`,
    kind: 'drawing' as const,
    x,
    y,
    z: NORTH_FACE + 0.004 + i * 0.0006,
    w: 0.36,
    h: 0.44,
    d: 0.002,
    ry: 0,
    policy: 'flat' as const,
    p: { tilt, seed: 60 + i },
    note: "Child's drawing, taped corners.",
  }));
}

function doorPanel(id: string, x: number, ry: number, side: 'L' | 'R'): OfficePart {
  // On the jamb wall just north of each shutter (z 50..52), at hand height for a standing guard.
  return {
    id,
    kind: 'doorPanel',
    x,
    y: 1.32,
    z: 49.62,
    w: 0.2,
    h: 0.46,
    d: 0.05,
    ry,
    policy: 'flat',
    p: { side },
    note: 'Steel faceplate: red DOOR button over white LIGHT button, lamps above each, wiring sheath to the ceiling.',
  };
}

function shutterFrame(id: string, x: number, side: 'W' | 'E'): OfficePart {
  return {
    id,
    kind: 'shutterFrame',
    x,
    y: 0,
    z: 51,
    w: 0.36,
    h: 3,
    d: 2.3,
    ry: 0,
    policy: 'flat',
    p: { side },
    note: 'Steel guide channels in the jambs, hazard-striped header housing, rusted sill track. Sits inside the wall thickness.',
  };
}

/** All solid boxes of the kit, for the level build. */
export function officeKitColliders(): Collider[] {
  return OFFICE_KIT.flatMap((p) => (p.policy === 'solid' ? (p.boxes ?? []) : []));
}
