import type { DoorId, MapId, NodeId } from './mapTypes';

export type RosterMode = 'tribute' | 'original';
export type AnimId = string;

/** Body archetype for the procedural builder. */
export type BodyKind = 'bear' | 'rabbit' | 'bird' | 'fox' | 'puppet' | 'human' | 'endo' | 'clown' | 'blob' | 'small' | 'spider';

export interface CharacterLook {
  body: BodyKind;
  fur: string;
  belly: string;
  eye: string;
  accent: string;
  height: number;
  /** Visual style flags. */
  glossy?: boolean;
  withered?: boolean;
  phantom?: boolean;
  nightmare?: boolean;
  shadow?: boolean;
  slumped?: boolean;
  prop?: 'mic' | 'guitar' | 'cupcake' | 'hook' | 'balloon' | 'banjo' | 'tambourine' | 'tray' | 'telescope' | 'none';
  hat?: 'top' | 'bowler' | 'propeller' | 'none';
}

export interface RosterEntry {
  id: AnimId;
  slot: string;
  names: { tribute: string; original: string };
  wave: 1 | 2 | 3 | 4 | 5;
  /** Shipped characters have a sim rule (core or plugin) and a full model. Others show in Archives as silhouettes. */
  shipped: boolean;
  interval: number;
  /** Weighted next-node tables per map. */
  routes: Partial<Record<MapId, Record<NodeId, Record<NodeId, number>>>>;
  /** Doors this character can hunt, per map. */
  hunts: Partial<Record<MapId, DoorId[]>>;
  start: Partial<Record<MapId, NodeId>>;
  maskable: boolean | 'early';
  visibleInLight: boolean;
  frozenWhenWatched: boolean;
  look: CharacterLook;
  sparkRate: number;
  description: string;
  counter: string;
  defaultCustomAi: number;
  /** Sim plugin id for extended-roster rules. */
  plugin?: string;
}

const core: RosterEntry[] = [
  {
    id: 'freddy',
    slot: 'leader',
    names: { tribute: 'Freddy', original: 'Barnaby' },
    wave: 1,
    shipped: true,
    interval: 3.02,
    routes: {
      classic: {
        stage: { dining: 1 },
        dining: { restrooms: 1 },
        restrooms: { kitchen: 1 },
        kitchen: { east_hall: 1 },
        east_hall: { east_corner: 1 },
        east_corner: { east_hall: 0 },
      },
      coop: {
        stage: { dining: 1 },
        dining: { kitchen: 3, party_a: 2 },
        kitchen: { restrooms: 2, east_hall: 2, dining: 0.3 },
        restrooms: { east_corner: 2, kitchen: 0.4 },
        east_hall: { east_corner: 2, kitchen: 0.4 },
        east_corner: { east_hall: 0.3 },
        party_a: { party_b: 2, dining: 0.3 },
        party_b: { south_hall: 2, party_a: 0.3 },
        south_hall: { party_b: 0.3 },
      },
    },
    hunts: { classic: ['right'], coop: ['east', 'south_l', 'south_r'] },
    start: { classic: 'stage', coop: 'stage' },
    maskable: 'early',
    visibleInLight: false,
    frozenWhenWatched: true,
    look: { body: 'bear', fur: '#6b4423', belly: '#c9a172', eye: '#7fd4ff', accent: '#111111', height: 2.0, prop: 'mic', hat: 'top' },
    sparkRate: 0.05,
    description: 'The bandleader. Patient, mostly invisible, deadly late. Laughs when he moves.',
    counter: "Watch his camera and he can't move. He only gets in while you're on the tablet with the door open.",
    defaultCustomAi: 0,
  },
  {
    id: 'bonnie',
    slot: 'rabbit',
    names: { tribute: 'Bonnie', original: 'Rosie' },
    wave: 1,
    shipped: true,
    interval: 4.97,
    routes: {
      classic: {
        stage: { dining: 2, backstage: 1 },
        dining: { backstage: 1, west_hall: 3 },
        backstage: { dining: 1, west_hall: 2 },
        west_hall: { supply: 1, west_corner: 3 },
        supply: { west_hall: 1, west_corner: 2 },
        west_corner: { west_hall: 1, supply: 1 },
      },
      coop: {
        stage: { dining: 3, backstage: 1 },
        backstage: { stage: 1 },
        dining: { west_hall: 4, arcade: 3, stage: 0.5 },
        west_hall: { west_corner: 3, supply: 1, dining: 0.5 },
        supply: { west_hall: 2 },
        arcade: { west_corner: 2, vent_hub: 2, dining: 0.5 },
        west_corner: { west_hall: 1, arcade: 1 },
        vent_hub: { arcade: 1 },
      },
    },
    hunts: { classic: ['left'], coop: ['west', 'vent'] },
    start: { classic: 'stage', coop: 'stage' },
    maskable: true,
    visibleInLight: true,
    frozenWhenWatched: false,
    look: { body: 'rabbit', fur: '#5b5fb8', belly: '#b9b2e6', eye: '#ff3366', accent: '#c41e1e', height: 2.1, prop: 'guitar' },
    sparkRate: 0.05,
    description: 'Fast, visible and teleport-happy. Always comes from the west.',
    counter: 'Check the west light. Close the door when he fills the doorway, then wait him out.',
    defaultCustomAi: 0,
  },
  {
    id: 'chica',
    slot: 'bird',
    names: { tribute: 'Chica', original: 'Peggy' },
    wave: 1,
    shipped: true,
    interval: 4.98,
    routes: {
      classic: {
        stage: { dining: 1 },
        dining: { restrooms: 2, kitchen: 2 },
        restrooms: { kitchen: 1, east_hall: 2 },
        kitchen: { restrooms: 1, east_hall: 2 },
        east_hall: { east_corner: 3, dining: 1 },
        east_corner: { east_hall: 1 },
      },
      coop: {
        stage: { dining: 1 },
        dining: { kitchen: 3, party_a: 2, stage: 0.3 },
        kitchen: { restrooms: 2, east_hall: 2, dining: 0.4 },
        restrooms: { east_corner: 2, kitchen: 1 },
        east_hall: { east_corner: 3, kitchen: 1 },
        east_corner: { east_hall: 1, restrooms: 1 },
        party_a: { party_b: 2, dining: 0.5 },
        party_b: { south_hall: 2, party_a: 0.5 },
        south_hall: { party_b: 0.5 },
      },
    },
    hunts: { classic: ['right'], coop: ['east', 'south_l', 'south_r'] },
    start: { classic: 'stage', coop: 'stage' },
    maskable: true,
    visibleInLight: true,
    frozenWhenWatched: false,
    look: { body: 'bird', fur: '#e8c22c', belly: '#ffffff', eye: '#c44fd0', accent: '#ff7a1a', height: 1.9, prop: 'cupcake' },
    sparkRate: 0.05,
    description: 'Noisy and hungry. Lingers in the kitchen, then commits to the east or the south.',
    counter: 'Listen for the pans. Check the east light, close the door when she breathes outside.',
    defaultCustomAi: 0,
  },
  {
    id: 'foxy',
    slot: 'fox',
    names: { tribute: 'Foxy', original: 'Captain Rusty' },
    wave: 1,
    shipped: true,
    interval: 5.01,
    routes: {},
    hunts: { classic: ['left'], coop: ['west'] },
    start: { classic: 'cove', coop: 'cove' },
    maskable: false,
    visibleInLight: true,
    frozenWhenWatched: false,
    look: { body: 'fox', fur: '#9c2d1f', belly: '#d9a27a', eye: '#ffd21a', accent: '#5a3a22', height: 1.95, prop: 'hook', withered: true },
    sparkRate: 0.4,
    description: "Punishes neglect. Hates being watched, hates being ignored more. Sprints down the west hall.",
    counter: 'Glance at the cove now and then. If the cove is empty, the west door shuts. Now.',
    defaultCustomAi: 0,
  },
  {
    id: 'golden',
    slot: 'golden',
    names: { tribute: 'Golden Freddy', original: 'The Gilded One' },
    wave: 1,
    shipped: true,
    interval: 999,
    routes: {},
    hunts: {},
    start: {},
    maskable: false,
    visibleInLight: false,
    frozenWhenWatched: false,
    look: { body: 'bear', fur: '#b8962e', belly: '#d8c07a', eye: '#ffffff', accent: '#5a2a7a', height: 2.0, slumped: true, withered: true, hat: 'top' },
    sparkRate: 0.2,
    description: "A rumour in a yellow suit. Shows up on a poster, then in your office.",
    counter: 'If he is sitting in your office, raise your tablet. Fast.',
    defaultCustomAi: 0,
  },
  {
    id: 'puppet',
    slot: 'puppet',
    names: { tribute: 'The Puppet', original: 'The Jester' },
    wave: 2,
    shipped: true,
    interval: 999,
    routes: {},
    hunts: {},
    start: { coop: 'arcade' },
    maskable: false,
    visibleInLight: true,
    frozenWhenWatched: false,
    look: { body: 'puppet', fur: '#111111', belly: '#ffffff', eye: '#ffffff', accent: '#c41e3a', height: 2.4 },
    sparkRate: 0,
    description: 'Lives in the gift box in the Prize Corner. Sleeps as long as the music plays.',
    counter: 'Keep the music box wound. If it gets out, wind it past halfway before it reaches anyone.',
    defaultCustomAi: 0,
  },
];

/** Extended roster. Rules marked with `plugin` live in shared/src/sim/animatronics/plugins. */
function ext(
  id: string,
  tribute: string,
  original: string,
  wave: RosterEntry['wave'],
  look: CharacterLook,
  description: string,
  counter: string,
  plugin?: string,
): RosterEntry {
  return {
    id,
    slot: id,
    names: { tribute, original },
    wave,
    shipped: Boolean(plugin),
    interval: 5,
    routes: {},
    hunts: {},
    start: {},
    maskable: false,
    visibleInLight: true,
    frozenWhenWatched: false,
    look,
    sparkRate: look.withered || look.phantom ? 0.5 : look.glossy ? 0 : 0.1,
    description,
    counter,
    defaultCustomAi: plugin ? 10 : 0,
    plugin,
  };
}

const L = (body: BodyKind, fur: string, belly: string, eye: string, accent: string, height: number, extra: Partial<CharacterLook> = {}): CharacterLook => ({
  body,
  fur,
  belly,
  eye,
  accent,
  height,
  ...extra,
});

const extended: RosterEntry[] = [
  // Wave 1 extras
  ext('endo', 'Endo-01', 'Frame Unit', 1, L('endo', '#3a3d42', '#3a3d42', '#ff2a2a', '#555', 1.9), 'A bare endoskeleton from the backstage table. Drawn to current.', 'Keep your station usage under four bars.', 'endo'),
  // Wave 2
  ext('toy_freddy', 'Toy Freddy', 'Shiny Bear', 2, L('bear', '#a0582a', '#f1c896', '#3fa9ff', '#111', 1.9, { glossy: true, prop: 'mic', hat: 'top' }), 'A newer, shinier bear. Watches the cameras with you.', 'Keep camera glances at the South Office short.', 'toy_freddy'),
  ext('toy_bonnie', 'Toy Bonnie', 'Sky Rabbit', 2, L('rabbit', '#6fb6e8', '#e6f2fb', '#3ed46b', '#c41e1e', 2.0, { glossy: true, prop: 'guitar' }), 'Glossy and grinning. Prefers the vents.', 'Shut the vent shutter.'),
  ext('toy_chica', 'Toy Chica', 'Party Hen', 2, L('bird', '#f7d23a', '#ffffff', '#5cc8ff', '#ff7a1a', 1.85, { glossy: true, prop: 'cupcake' }), 'Lost her beak somewhere.', 'Mask or door.'),
  ext('mangle', 'Mangle', 'Tangle', 2, L('fox', '#f2f2f2', '#ff8ac8', '#ffe066', '#ff3a6a', 1.6, { withered: true }), 'A jumble of parts crawling across the ceiling. Radio static rises as it nears.', 'Close the door at the exact moment the static peaks.', 'mangle'),
  ext('bb', 'Balloon Kid', 'Bobby Balloon', 2, L('small', '#d8b49a', '#c43a3a', '#2a5bd8', '#2a5bd8', 1.1, { prop: 'balloon', hat: 'propeller' }), 'Giggles in doorways. Steals your lights.', "Don't use lights while you hear him giggle.", 'bb'),
  ext('jj', 'Jay-Jay', 'Polly Balloon', 2, L('small', '#d8b49a', '#7a3ac4', '#2a5bd8', '#7a3ac4', 1.1, { prop: 'balloon', hat: 'propeller' }), "Balloon Kid's quieter sister.", 'Same as her brother.'),
  ext('withered_freddy', 'Withered Freddy', 'Rotten Barnaby', 2, L('bear', '#4f3420', '#8f7552', '#7fd4ff', '#111', 2.0, { withered: true, hat: 'top' }), 'The old bandleader, decayed.', 'Mask.'),
  ext('withered_bonnie', 'Withered Bonnie', 'Faceless Rosie', 2, L('rabbit', '#3b3f7a', '#6d6aa0', '#ff2a2a', '#7a1a1a', 2.1, { withered: true }), 'No face. Just a jaw and two lights in the dark.', 'Mask.'),
  ext('withered_chica', 'Withered Chica', 'Hollow Peggy', 2, L('bird', '#a88a24', '#ccc', '#c44fd0', '#ff7a1a', 1.9, { withered: true }), 'Jaw hanging, wrists bare to the metal.', 'Mask.'),
  ext('withered_foxy', 'Withered Foxy', 'Tattered Rusty', 2, L('fox', '#6f2017', '#a0705a', '#ffd21a', '#3a2a1a', 1.95, { withered: true, prop: 'hook' }), 'More endo than fox.', 'Flashlight only.'),
  ext('withered_golden', 'Withered Golden Freddy', 'Tarnished One', 2, L('bear', '#8a6e22', '#a99050', '#ffffff', '#4a1a6a', 2.0, { withered: true, slumped: true }), 'Appears in an office, slumped and patient.', 'Tablet up.'),
  ext('shadow_freddy', 'Shadow Freddy', 'Shade', 2, L('bear', '#1a0f2a', '#1a0f2a', '#ffffff', '#000', 2.0, { shadow: true }), 'A flat purple silhouette on a random camera.', "Don't stare at it.", 'shadow'),
  ext('shadow_bonnie', 'Shadow Bonnie', 'Umbra Rabbit', 2, L('rabbit', '#120a1e', '#120a1e', '#ffffff', '#000', 2.1, { shadow: true }), 'A rumour on the party room camera.', 'Look away.'),
  ext('endo02', 'Endo-02', 'Frame Unit B', 2, L('endo', '#55585e', '#55585e', '#ffffff', '#666', 1.9), 'A plain endoskeleton that visits offices.', 'Mask.'),
  ext('paperpals', 'Paperpals', 'Cutouts', 2, L('small', '#f0e6d0', '#f0e6d0', '#000', '#000', 1.0), 'Paper cutouts on the walls that turn their heads.', 'Ignore them. They are only paper.'),
  // Wave 3
  ext('springtrap', 'Springtrap', 'Rot Rabbit', 3, L('rabbit', '#6b7a3a', '#8f8a5a', '#ffffff', '#3a3a20', 2.1, { withered: true }), 'A slow, single-minded hunter that only listens to audio lures.', 'Technician lures it away. Doors only hold it for ten seconds.', 'spring'),
  ext('phantom_freddy', 'Phantom Freddy', 'Ashen Bear', 3, L('bear', '#2a1a10', '#4a3420', '#ff8a2a', '#000', 2.0, { phantom: true }), 'Burnt. Walks past windows when the air goes bad.', 'Keep ventilation up.'),
  ext('phantom_foxy', 'Phantom Foxy', 'Ashen Fox', 3, L('fox', '#2a120c', '#4a2a1a', '#ff8a2a', '#000', 1.95, { phantom: true, prop: 'hook' }), 'Hallucination-only, unless the vents are down.', 'Reboot ventilation.', 'phantom_foxy'),
  ext('phantom_chica', 'Phantom Chica', 'Ashen Peggy', 3, L('bird', '#3a2a0c', '#4a3a2a', '#ff8a2a', '#000', 1.9, { phantom: true }), 'Shows up on the arcade camera.', 'Reboot ventilation.'),
  ext('phantom_bb', 'Phantom BB', 'Ashen Bobby', 3, L('small', '#2a1a14', '#3a1a14', '#ff8a2a', '#000', 1.1, { phantom: true }), 'Screams if watched.', 'Look away.'),
  ext('phantom_mangle', 'Phantom Mangle', 'Ashen Tangle', 3, L('fox', '#2a2a2a', '#4a2a3a', '#ff8a2a', '#000', 1.6, { phantom: true }), 'Its static drowns out the radio.', 'Reboot ventilation.'),
  ext('phantom_puppet', 'Phantom Puppet', 'Ashen Jester', 3, L('puppet', '#120a08', '#4a3a2a', '#ff8a2a', '#000', 2.4, { phantom: true }), 'Blocks your screen with its face.', 'Wait it out.'),
  ext('nightmare', 'Nightmare', 'The Hollow', 3, L('bear', '#0a0a10', '#1a1a2a', '#ffffff', '#000', 2.3, { nightmare: true }), 'Breathes behind doors that stay shut too long.', 'Open the door briefly. Door campers get visited.', 'nightmare'),
  ext('nightmare_freddy', 'Nightmare Freddy', 'Night Barnaby', 3, L('bear', '#3a2412', '#5a4020', '#ff8a2a', '#111', 2.3, { nightmare: true, hat: 'top' }), 'Sheds tiny copies of himself onto your desk.', 'Flash the little ones away.'),
  ext('nightmare_bonnie', 'Nightmare Bonnie', 'Night Rosie', 3, L('rabbit', '#2a2a6a', '#4a4a8a', '#ff2a6a', '#111', 2.3, { nightmare: true }), 'All teeth and claws.', 'Listen before you light.'),
  ext('nightmare_chica', 'Nightmare Chica', 'Night Peggy', 3, L('bird', '#a88a14', '#c8c8a0', '#ff2a6a', '#111', 2.2, { nightmare: true, prop: 'cupcake' }), 'Her cupcake has teeth too.', 'Listen before you light.'),
  ext('nightmare_foxy', 'Nightmare Foxy', 'Night Rusty', 3, L('fox', '#6a1a10', '#8a4a3a', '#ffd21a', '#111', 2.3, { nightmare: true, prop: 'hook' }), 'Hides in the closet.', 'Listen before you light.'),
  ext('nightmare_fredbear', 'Nightmare Fredbear', 'Night Gilded', 3, L('bear', '#b8962e', '#c8a850', '#ff2a2a', '#5a2a7a', 2.4, { nightmare: true, hat: 'top' }), 'Gold and purple and very large.', 'Listen before you light.'),
  ext('plushtrap', 'Plushtrap', 'Rot Plush', 3, L('small', '#6b7a3a', '#8f8a5a', '#ffffff', '#3a3a20', 0.8), 'A small plush that runs the south hall.', 'Catch it on the X with your light.'),
  ext('nightmare_bb', 'Nightmare BB', 'Night Bobby', 3, L('small', '#2a1a14', '#6a1a1a', '#ffffff', '#2a5bd8', 1.2, { nightmare: true }), 'Grins under the desk.', 'Do not look at him.'),
  ext('nightmarionne', 'Nightmarionne', 'Night Jester', 3, L('puppet', '#050505', '#ffffff', '#ffffff', '#c41e3a', 2.6, { nightmare: true }), "The Puppet's nightmare. No travelling, just death.", 'Never let the music box run out.'),
  // Wave 4
  ext('circus_baby', 'Circus Baby', 'Ringmaster Unit', 4, L('clown', '#f0d0c0', '#c41e1e', '#3ed46b', '#c41e1e', 2.0, { glossy: true }), 'Asks politely for you to stay still.', 'Freeze. Press nothing for five seconds.'),
  ext('ballora', 'Ballora', 'Ballerina Unit', 4, L('clown', '#5a6ad8', '#b0a0e8', '#5a6ad8', '#d8c0f0', 2.0, { glossy: true }), 'You hear her music before you see her.', "If her music swells on your side, don't move."),
  ext('funtime_freddy', 'Funtime Freddy', 'Funtime Bear', 4, L('bear', '#f2f2f2', '#ff8ac8', '#5a8aff', '#7a2ac4', 2.0, { glossy: true }), 'Calls Showtime. Brought a friend for his hand.', 'Play party noise within five seconds of the call.'),
  ext('bonbon', 'Bon-Bon', 'Hand Bunny', 4, L('small', '#5a8ae8', '#ffffff', '#ff4ad8', '#ffffff', 0.6), 'A hand puppet with ambitions.', 'Do not let it reach your feet.'),
  ext('funtime_foxy', 'Funtime Foxy', 'Funtime Fox', 4, L('fox', '#f2f2f2', '#ff8ac8', '#ffd21a', '#ff3a6a', 2.0, { glossy: true }), 'Runs on a show schedule.', 'Open the door only at showtime.'),
  ext('minireena', 'Minireenas', 'Mini Dancers', 4, L('small', '#f2f2f2', '#c8c8f0', '#000', '#000', 0.5), 'Tiny dancers that climb your screen.', 'Shake them off.'),
  ext('bidybab', 'Bidybabs', 'Crib Units', 4, L('small', '#e0b090', '#c8c8f0', '#5a8aff', '#ff7a7a', 0.7), 'Small and persistent at the vent.', 'Hold the vent shutter.'),
  ext('ennard', 'Ennard', 'Tangle Mass', 4, L('endo', '#4a4a50', '#4a4a50', '#5a8aff', '#ffffff', 2.2, { withered: true }), 'Every wire in the building, wearing a mask.', 'Vent shutter and silence.'),
  ext('electrobab', 'Electrobab', 'Spark Unit', 4, L('small', '#e0b090', '#5a8aff', '#5af0ff', '#5af0ff', 0.8), 'Crackling with blue arcs.', 'Cut power to the door it is at.'),
  ext('yenndo', 'Yenndo', 'Gold Frame', 4, L('endo', '#c8a830', '#c8a830', '#ffffff', '#888', 1.9), 'A yellow endoskeleton standing in a corner.', "Don't look twice."),
  ext('lolbit', 'Lolbit', 'Static Fox', 4, L('fox', '#ff8a2a', '#f2f2f2', '#000', '#7a2ac4', 1.8), 'PLEASE STAND BY.', 'Type L-O-L.'),
  ext('molten_freddy', 'Molten Freddy', 'Molten Bear', 4, L('endo', '#f2f2f2', '#ff8ac8', '#5a8aff', '#ffffff', 2.0, { withered: true }), 'Laughs in the vents.', 'Vent shutter, right on time.'),
  ext('scrap_baby', 'Scrap Baby', 'Scrap Ringmaster', 4, L('clown', '#a07050', '#7a1a1a', '#3ed46b', '#c41e1e', 2.0, { withered: true }), 'Rebuilt from scrap, on wheels.', 'Controlled shock.'),
  ext('scraptrap', 'Scraptrap', 'Husk Rabbit', 4, L('rabbit', '#5a5a3a', '#6a6a4a', '#ffffff', '#2a2a1a', 2.1, { withered: true }), 'Thinner, more metal than costume.', 'Flashlight in the vent.'),
  ext('lefty', 'Lefty', 'Black Bear', 4, L('bear', '#1a1a1a', '#3a3a3a', '#ffd21a', '#c41e1e', 2.0, { prop: 'mic' }), 'One eye always covered.', 'Keep the room cool and the music calm.'),
  ext('rockstar_freddy', 'Rockstar Freddy', 'Headliner Bear', 4, L('bear', '#8a4a2a', '#d8a070', '#5a8aff', '#2a2a8a', 2.0, { glossy: true, hat: 'top' }), 'Demands five coins.', 'Pay up or overheat him.'),
  ext('rockstar_bonnie', 'Rockstar Bonnie', 'Headliner Rabbit', 4, L('rabbit', '#3a4ac8', '#a0a8f0', '#3ed46b', '#ffd21a', 2.1, { glossy: true, prop: 'guitar' }), 'Lost his guitar.', 'Find his guitar on the cameras.'),
  ext('rockstar_chica', 'Rockstar Chica', 'Headliner Hen', 4, L('bird', '#ffd21a', '#ffffff', '#5a8aff', '#ff3a6a', 1.9, { glossy: true }), 'Wet floor signs confuse her.', 'Move the wet floor sign.'),
  ext('rockstar_foxy', 'Rockstar Foxy', 'Headliner Fox', 4, L('fox', '#c83a2a', '#e8b090', '#ffd21a', '#3a8a3a', 2.0, { glossy: true, prop: 'hook' }), 'Sometimes helps. His parrot always does.', 'Click the parrot.'),
  ext('happy_frog', 'Happy Frog', 'Cheery Frog', 4, L('blob', '#5ac83a', '#d8f0a0', '#000', '#ff3a3a', 1.6), 'Cheap, cheerful, in the vents.', 'Vent shutter.'),
  ext('mr_hippo', 'Mr. Hippo', 'Mister Hippo', 4, L('blob', '#8a8ac8', '#c8c8f0', '#000', '#3a3a8a', 1.7), 'Will not stop talking.', 'Vent shutter.'),
  ext('pigpatch', 'Pigpatch', 'Patchwork Pig', 4, L('blob', '#e88ab0', '#f8c8d8', '#000', '#5a3a1a', 1.7), 'Plays a banjo badly.', 'Vent shutter.'),
  ext('nedd_bear', 'Nedd Bear', 'Ned Cub', 4, L('bear', '#8a5a2a', '#c8a070', '#000', '#5a8a3a', 1.7), 'A cheap knock-off bear.', 'Vent shutter.'),
  ext('orville', 'Orville Elephant', 'Orson Elephant', 4, L('blob', '#5a8ae8', '#c8d8f8', '#000', '#ffd21a', 1.8), 'Clumsy and blue.', 'Vent shutter.'),
  ext('music_man', 'Music Man', 'Cymbal Spider', 4, L('spider', '#2a2a2a', '#ffffff', '#ff2a2a', '#c8a830', 2.6), 'Six arms, two cymbals each.', 'Make no noise.'),
  ext('el_chip', 'El Chip', 'Señor Beaver', 4, L('blob', '#8a5a2a', '#c8a070', '#000', '#c41e1e', 1.7), 'Sales pitches on your screen.', 'Click skip.'),
  ext('helpy', 'Helpy', 'Tiny Helper', 4, L('small', '#f2f2f2', '#ff8ac8', '#5a8aff', '#7a2ac4', 0.4), 'Small. Has an airhorn.', 'Click him before he honks.'),
  // Wave 5
  ext('omc', 'Old Man Consequences', 'Old Croc', 5, L('blob', '#c41e1e', '#7a1a1a', '#ffd21a', '#000', 1.8), 'Fishing in a dark pond.', 'Catch the fish.'),
  ext('dee_dee', 'Dee Dee', 'Chaos Girl', 5, L('human', '#ff8ac8', '#ffd21a', '#000', '#5a8aff', 1.3), 'Adds surprises mid-night.', 'Endure.'),
  ext('xor', 'XOR', 'Shadow Girl', 5, L('human', '#1a0f2a', '#1a0f2a', '#ffffff', '#000', 1.3, { shadow: true }), 'Adds shadow surprises.', 'Endure.'),
  ext('glitchtrap', 'Glitchtrap', 'Glitch Rabbit', 5, L('rabbit', '#d8b030', '#a070c8', '#7a2ac4', '#3ed46b', 2.0), 'A digital rabbit in the camera system.', 'Technician runs Antivirus.'),
  ext('vanny', 'Vanny', 'Pale Rabbit', 5, L('human', '#f2f2f2', '#f2f2f2', '#ff2a2a', '#c41e1e', 1.8), 'Hops between cameras.', 'Switch away within two seconds.'),
  ext('glamrock_freddy', 'Glamrock Freddy', 'Neon Bear', 5, L('bear', '#c86a2a', '#f0c890', '#5af0ff', '#ff3ad8', 2.1, { glossy: true }), 'A friend. Guards one door per hour.', 'He helps you.'),
  ext('glamrock_chica', 'Glamrock Chica', 'Neon Hen', 5, L('bird', '#ffe03a', '#ffffff', '#ff3ad8', '#ff3ad8', 2.0, { glossy: true }), 'Lures guards with food sounds.', 'Kitchen Mic.'),
  ext('monty', 'Montgomery Gator', 'Neon Gator', 5, L('fox', '#3ac83a', '#f0e04a', '#ff3a3a', '#ff3ad8', 2.2, { glossy: true }), 'Smashes doors after three hits.', 'Technician reroute.'),
  ext('roxy', 'Roxanne Wolf', 'Neon Wolf', 5, L('fox', '#8a8ac8', '#e0e0f0', '#ffd21a', '#ff3ad8', 2.1, { glossy: true }), 'Notices you when you look too long.', 'Glance, never stare.'),
  ext('sun_moon', 'Daycare Attendant', 'Sun & Moon', 5, L('clown', '#ffd21a', '#ff8a2a', '#000', '#2a2a8a', 2.2), 'Sun with the lights on. Moon without.', 'Turn the light on when he comes.'),
  ext('burntrap', 'Burntrap', 'Cinder Rabbit', 5, L('endo', '#3a2a1a', '#3a2a1a', '#ffffff', '#ff8a2a', 2.1, { withered: true, phantom: true }), 'Wires like tendrils.', 'Full flashlight beam.'),
  ext('mimic', 'The Mimic', 'The Copy', 5, L('endo', '#6a6a70', '#6a6a70', '#ffffff', '#aaa', 2.4), 'Copies another character each hour.', 'Work out who it is copying by its tells.'),
  ext('staff_bot', 'STAFF Bots', 'Helper Bots', 5, L('human', '#3a3a3a', '#ffd21a', '#5af0ff', '#5af0ff', 1.8, { glossy: true }), 'They flag your station.', 'Stay unflagged.'),
  ext('yellow_rabbit', 'Yellow Rabbit (Into the Pit)', 'Ball-Pit Rabbit', 5, L('rabbit', '#c8a830', '#d8c070', '#ffffff', '#5a2a1a', 2.0, { withered: true }), 'A stalker from a story about a ball pit.', 'Archives only.'),
];

for (const e of extended) {
  if (['toy_freddy', 'toy_chica', 'endo02', 'withered_freddy', 'withered_bonnie', 'withered_chica'].includes(e.id)) e.maskable = true;
}

export const ROSTER: RosterEntry[] = [...core, ...extended];
export const ROSTER_BY_ID: Record<string, RosterEntry> = Object.fromEntries(ROSTER.map((r) => [r.id, r]));
export const CORE_IDS = ['freddy', 'bonnie', 'chica', 'foxy'] as const;
export const PLUGIN_IDS = ROSTER.filter((r) => r.plugin).map((r) => r.id);

export interface VenueNames {
  venue: string;
  company: string;
  currency: string;
}

export const VENUE: Record<RosterMode, VenueNames> = {
  tribute: { venue: "Freddy Fazbear's Pizza", company: 'Fazbear Entertainment', currency: 'Faz-Tokens' },
  original: { venue: "Barnaby's Big Bite Pizza Palace", company: 'Big Bite Entertainment, Inc.', currency: 'Bite Tokens' },
};

/** Roster lookups. Every character name shown anywhere must come through here. */
export function makeRoster(mode: RosterMode) {
  return {
    mode,
    name(id: AnimId): string {
      return ROSTER_BY_ID[id]?.names[mode] ?? id;
    },
    slot(slot: string): string {
      const e = ROSTER.find((r) => r.slot === slot);
      return e ? e.names[mode] : slot;
    },
    venue: () => VENUE[mode].venue,
    company: () => VENUE[mode].company,
    currency: () => VENUE[mode].currency,
    /** Fill {venue}, {leader}, ... placeholders. */
    fill(text: string): string {
      return text.replace(/\{(\w+)\}/g, (_m, key: string) => {
        if (key === 'venue') return VENUE[mode].venue;
        if (key === 'company') return VENUE[mode].company;
        if (key === 'currency') return VENUE[mode].currency;
        const e = ROSTER.find((r) => r.slot === key || r.id === key);
        return e ? e.names[mode] : `{${key}}`;
      });
    },
  };
}
export type Roster = ReturnType<typeof makeRoster>;
