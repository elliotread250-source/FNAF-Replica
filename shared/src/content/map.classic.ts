import { link, type MapDef, type MapNode } from './mapTypes';

// The FNAF 1 layout, camera codes and all. One office, two doors.
const P: [number, number][] = [
  [-1.2, 0],
  [1.2, 0.4],
  [0, -1],
];

const nodes: Record<string, MapNode> = link({
  stage: { id: 'stage', name: 'Show Stage', cam: 'CAM 1A', x: 50, y: 8, links: ['dining'], room: 'stage', poses: [[-1.4, 0], [0, -0.3], [1.4, 0]] },
  dining: { id: 'dining', name: 'Dining Area', cam: 'CAM 1B', x: 50, y: 28, links: ['stage', 'backstage', 'cove', 'west_hall', 'restrooms', 'kitchen', 'east_hall'], room: 'dining', poses: P },
  cove: { id: 'cove', name: 'Pirate Cove', cam: 'CAM 1C', x: 26, y: 30, links: ['dining'], room: 'cove', poses: [[0, 0]] },
  west_hall: { id: 'west_hall', name: 'West Hall', cam: 'CAM 2A', x: 34, y: 62, links: ['dining', 'supply', 'west_corner'], room: 'hall', poses: [[0, -2], [0.4, 1]] },
  west_corner: { id: 'west_corner', name: 'W. Hall Corner', cam: 'CAM 2B', x: 34, y: 80, links: ['west_hall'], room: 'corner', poses: [[0, 0], [0.6, -1]] },
  supply: { id: 'supply', name: 'Supply Closet', cam: 'CAM 3', x: 18, y: 64, links: ['west_hall'], room: 'closet', poses: [[0, 0]] },
  east_hall: { id: 'east_hall', name: 'East Hall', cam: 'CAM 4A', x: 66, y: 62, links: ['dining', 'east_corner', 'kitchen', 'restrooms'], room: 'hall', poses: [[0, -2], [-0.4, 1]] },
  east_corner: { id: 'east_corner', name: 'E. Hall Corner', cam: 'CAM 4B', x: 66, y: 80, links: ['east_hall'], room: 'corner', poses: [[0, 0], [-0.6, -1]] },
  backstage: { id: 'backstage', name: 'Backstage', cam: 'CAM 5', x: 14, y: 22, links: ['dining', 'stage'], room: 'backstage', poses: [[0, 0], [1, 0.6]] },
  kitchen: { id: 'kitchen', name: 'Kitchen', cam: 'CAM 6', audioOnly: true, x: 74, y: 44, links: ['dining', 'restrooms', 'east_hall'], room: 'kitchen', poses: P },
  restrooms: { id: 'restrooms', name: 'Restrooms', cam: 'CAM 7', x: 86, y: 28, links: ['dining', 'kitchen', 'east_hall'], room: 'restrooms', poses: P },
});

export const CLASSIC_MAP: MapDef = {
  id: 'classic',
  nodes,
  doors: {
    left: { id: 'left', station: 'office', from: 'west_corner', side: 'left', kind: 'door', label: 'Left door' },
    right: { id: 'right', station: 'office', from: 'east_corner', side: 'right', kind: 'door', label: 'Right door' },
  },
  stations: [{ id: 'office', name: 'The Office', role: 'Night Guard', doors: ['left', 'right'], tools: [], x: 50, y: 90 }],
  stageNode: 'stage',
  coveNode: 'cove',
  westHallNode: 'west_hall',
  posterNode: 'west_corner',
  musicBoxNode: 'stage',
  kitchenNode: 'kitchen',
  backstageNode: 'backstage',
  foxyDoor: 'left',
};
