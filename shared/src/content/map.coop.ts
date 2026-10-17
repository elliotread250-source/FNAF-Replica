import { link, type MapDef, type MapNode } from './mapTypes';

const P3: [number, number][] = [
  [-1.3, 0],
  [1.3, 0.3],
  [0, -1.2],
];
const P2: [number, number][] = [
  [0, -1.5],
  [0.5, 1],
];

const nodes: Record<string, MapNode> = link({
  stage: { id: 'stage', name: 'Show Stage', cam: 'CAM 01', x: 50, y: 10, links: ['dining', 'backstage'], room: 'stage', poses: [[-1.4, 0], [0, -0.3], [1.4, 0]] },
  backstage: { id: 'backstage', name: 'Backstage', cam: 'CAM 02', x: 72, y: 6, links: ['stage', 'parts'], room: 'backstage', poses: [[0, 0], [1, 0.6]] },
  parts: { id: 'parts', name: 'Parts & Service', cam: 'CAM 03', x: 88, y: 14, links: ['backstage', 'east_hall'], room: 'parts', poses: [[0, 0], [-1, 0.5]] },
  dining: { id: 'dining', name: 'Dining Area', cam: 'CAM 04', x: 50, y: 30, links: ['stage', 'cove', 'west_hall', 'east_hall', 'kitchen', 'arcade', 'party_a'], room: 'dining', poses: P3 },
  cove: { id: 'cove', name: 'Pirate Cove', cam: 'CAM 05', x: 24, y: 22, links: ['dining', 'west_hall'], room: 'cove', poses: [[0, 0]] },
  kitchen: { id: 'kitchen', name: 'Kitchen', cam: 'CAM 06', audioOnly: true, x: 70, y: 34, links: ['dining', 'restrooms', 'east_hall'], room: 'kitchen', poses: P3 },
  restrooms: { id: 'restrooms', name: 'Restrooms', cam: 'CAM 07', x: 86, y: 40, links: ['kitchen', 'east_corner'], room: 'restrooms', poses: P3 },
  arcade: { id: 'arcade', name: 'Prize Corner', cam: 'CAM 08', x: 30, y: 44, links: ['dining', 'west_corner', 'vent_hub'], room: 'arcade', poses: [[-1, 0.5], [1, 0.5]] },
  party_a: { id: 'party_a', name: 'Party Room 1', cam: 'CAM 09', x: 50, y: 50, links: ['dining', 'party_b', 'vent_hub'], room: 'party', poses: P3 },
  party_b: { id: 'party_b', name: 'Party Room 2', cam: 'CAM 10', x: 50, y: 64, links: ['party_a', 'south_hall'], room: 'party', poses: P3 },
  west_hall: { id: 'west_hall', name: 'West Hall', cam: 'CAM 11', x: 14, y: 46, links: ['dining', 'cove', 'west_corner', 'supply'], room: 'hall', poses: P2 },
  supply: { id: 'supply', name: 'Supply Closet', cam: 'CAM 12', x: 6, y: 58, links: ['west_hall'], room: 'closet', poses: [[0, 0]] },
  west_corner: { id: 'west_corner', name: 'W. Hall Corner', cam: 'CAM 13', x: 18, y: 64, links: ['west_hall', 'arcade'], room: 'corner', poses: [[0, 0], [0.6, -1]] },
  east_hall: { id: 'east_hall', name: 'East Hall', cam: 'CAM 14', x: 82, y: 52, links: ['dining', 'kitchen', 'parts', 'east_corner'], room: 'hall', poses: P2 },
  east_corner: { id: 'east_corner', name: 'E. Hall Corner', cam: 'CAM 15', x: 82, y: 66, links: ['east_hall', 'restrooms'], room: 'corner', poses: [[0, 0], [-0.6, -1]] },
  south_hall: { id: 'south_hall', name: 'South Hall', cam: 'CAM 16', x: 50, y: 78, links: ['party_b'], room: 'hall', poses: P2 },
  vent_hub: { id: 'vent_hub', name: 'Vent Junction', cam: 'CAM 17', x: 40, y: 58, links: ['arcade', 'party_a'], room: 'vent', poses: [[0, 0], [0.6, 0.6]] },
});

export const COOP_MAP: MapDef = {
  id: 'coop',
  nodes,
  doors: {
    west: { id: 'west', station: 'west', from: 'west_corner', side: 'left', kind: 'door', label: 'West door' },
    east: { id: 'east', station: 'east', from: 'east_corner', side: 'right', kind: 'door', label: 'East door' },
    south_l: { id: 'south_l', station: 'south', from: 'south_hall', side: 'left', kind: 'door', label: 'South-left door' },
    south_r: { id: 'south_r', station: 'south', from: 'south_hall', side: 'right', kind: 'door', label: 'South-right door' },
    vent: { id: 'vent', station: 'control', from: 'vent_hub', side: 'right', kind: 'vent', label: 'Vent shutter' },
  },
  stations: [
    { id: 'west', name: 'West Office', role: 'Night Guard (West)', doors: ['west'], tools: ['flashlight'], x: 18, y: 82 },
    { id: 'east', name: 'East Office', role: 'Night Guard (East)', doors: ['east'], tools: ['mic'], x: 82, y: 82 },
    { id: 'south', name: 'South Office', role: 'Night Guard (South)', doors: ['south_l', 'south_r'], tools: ['mask'], x: 50, y: 92 },
    { id: 'control', name: 'Control Room', role: 'Technician', doors: ['vent'], tools: ['panel'], x: 34, y: 74 },
  ],
  stageNode: 'stage',
  coveNode: 'cove',
  westHallNode: 'west_hall',
  posterNode: 'west_corner',
  musicBoxNode: 'arcade',
  kitchenNode: 'kitchen',
  backstageNode: 'backstage',
  foxyDoor: 'west',
};

/** The merged one-player Night Shift station: both side doors, flashlight and mic. */
export const SOLO_STATION = {
  id: 'solo' as const,
  name: 'Solo Station',
  role: 'Night Guard',
  doors: ['west', 'east'],
  tools: ['flashlight', 'mic'] as const,
  x: 50,
  y: 88,
};
