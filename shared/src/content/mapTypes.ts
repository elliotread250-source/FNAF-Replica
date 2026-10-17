export type NodeId = string;
export type DoorId = string;
export type StationId = 'office' | 'solo' | 'west' | 'east' | 'south' | 'control';
export type MapId = 'classic' | 'coop';
export type StationTool = 'flashlight' | 'mic' | 'mask' | 'panel';

export interface MapNode {
  id: NodeId;
  name: string;
  cam: string | null;
  audioOnly?: boolean;
  x: number;
  y: number;
  links: NodeId[];
  /** Kind of room, drives the renderer's room builder. */
  room: RoomKind;
  /** Up to three pose spots in room-local metres (x, z), so animatronics never overlap. */
  poses: [number, number][];
}

export type RoomKind =
  | 'stage'
  | 'dining'
  | 'cove'
  | 'hall'
  | 'corner'
  | 'closet'
  | 'backstage'
  | 'kitchen'
  | 'restrooms'
  | 'arcade'
  | 'party'
  | 'vent'
  | 'parts';

export interface DoorDef {
  id: DoorId;
  station: StationId;
  from: NodeId;
  side: 'left' | 'right';
  kind: 'door' | 'vent';
  label: string;
}

export interface StationDef {
  id: StationId;
  name: string;
  role: string;
  doors: DoorId[];
  tools: StationTool[];
  /** Map position of the office, for the tablet map. */
  x: number;
  y: number;
}

export interface MapDef {
  id: MapId;
  nodes: Record<NodeId, MapNode>;
  doors: Record<DoorId, DoorDef>;
  stations: StationDef[];
  stageNode: NodeId;
  coveNode: NodeId;
  westHallNode: NodeId;
  posterNode: NodeId;
  musicBoxNode: NodeId;
  kitchenNode: NodeId;
  backstageNode: NodeId;
  foxyDoor: DoorId;
}

export function link(nodes: Record<NodeId, MapNode>): Record<NodeId, MapNode> {
  // Make every link bidirectional so data entry mistakes can't strand a node.
  for (const n of Object.values(nodes)) {
    for (const l of n.links) {
      const other = nodes[l];
      if (!other) throw new Error(`map: ${n.id} links to unknown node ${l}`);
      if (!other.links.includes(n.id)) other.links.push(n.id);
    }
  }
  return nodes;
}
