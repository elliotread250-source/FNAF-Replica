import { pick } from '../../../rng';
import type { SimPlugin } from './index';
import { newAnim, liveStations, stationDoors } from '../../world';
import { opportunity, walkerMove } from '../base';
import { stationUsage } from '../../power';

// Endo-01: drawn to the current. Only moves toward a station using four or more bars.
export const endoPlugin: SimPlugin = {
  id: 'endo',
  init(world, ai) {
    world.anims.push(newAnim('endo', world.map.backstageNode, ai, 5));
  },
  onTick(world) {
    const a = world.anims.find((x) => x.id === 'endo');
    if (!a || a.subPos === 'in_office') return;
    const hot = liveStations(world).filter((s) => stationUsage(world, s) >= 4);
    if (!opportunity(world, a)) return;
    if (!hot.length) return;
    const tgt = hot.find((s) => a.targetDoor && world.doorStation[a.targetDoor] === s.id) ?? pick(world.rng, hot);
    if (!a.targetDoor || world.doorStation[a.targetDoor] !== tgt.id) a.targetDoor = stationDoors(world, tgt.id)[0] ?? null;
    walkerMove(world, a);
  },
};
