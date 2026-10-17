import { secs } from '../../../config';
import type { SimPlugin } from './index';
import { emit, isLive, liveStations, newAnim, stationDoors } from '../../world';
import { opportunity, enterOffice, moveTo } from '../base';
import { shortestPath } from '../../graph';
import { pick } from '../../../rng';

// Spring Rabbit: one slow hunter. Only audio lures steer it. Doors hold it for ten seconds.
export const springPlugin: SimPlugin = {
  id: 'spring',
  init(world, ai) {
    world.anims.push(newAnim('springtrap', world.map.backstageNode, ai, 6));
  },
  onTick(world) {
    const a = world.anims.find((x) => x.id === 'springtrap');
    if (!a || a.subPos === 'in_office' || world.powerOut.active) return;
    if (a.subPos === 'at_door' && a.door) {
      const door = world.doors[a.door];
      if (!isLive(world.stations[world.doorStation[a.door]])) {
        a.subPos = 'room';
        a.door = null;
        return;
      }
      if (!door.closed) {
        enterOffice(world, a, a.door);
        return;
      }
      a.flags.doorWait = (a.flags.doorWait ?? 0) + 1;
      if (a.flags.doorWait >= secs(10)) {
        door.closed = false;
        emit(world, { type: 'door_forced', door: door.id });
        enterOffice(world, a, a.door);
      }
      return;
    }
    if (!opportunity(world, a)) return;
    if (world.tick < (a.flags.luredUntil ?? 0)) return;
    const live = liveStations(world);
    if (!live.length) return;
    if (!a.targetDoor || !isLive(world.stations[world.doorStation[a.targetDoor]])) {
      a.targetDoor = pick(world.rng, stationDoors(world, pick(world.rng, live).id));
    }
    const from = world.map.doors[a.targetDoor].from;
    if (a.node === from) {
      a.subPos = 'at_door';
      a.door = a.targetDoor;
      a.flags.doorWait = 0;
      return;
    }
    const path = shortestPath(world.map, a.node, from);
    if (path[1]) moveTo(world, a, path[1]);
  },
  onLure(world, node) {
    const a = world.anims.find((x) => x.id === 'springtrap');
    if (!a || a.subPos !== 'room') return;
    if (world.map.nodes[a.node].links.includes(node) || a.node === node) {
      moveTo(world, a, node);
      a.flags.luredUntil = world.tick + secs(15);
      a.targetDoor = null;
    }
  },
};
