import { secs } from '../../../config';
import { chance, pick } from '../../../rng';
import type { SimPlugin } from './index';
import { pluginAi } from './index';
import { emit, isLive, liveStations, newAnim, stationDoors } from '../../world';
import { enterOffice } from '../base';

// Toy Freddy sits at the South door and "watches the cameras with you".
// Keep the tablet up for more than six seconds straight while he's there and he comes in.
export const toyFreddyPlugin: SimPlugin = {
  id: 'toy_freddy',
  init(world, ai) {
    const a = newAnim('toy_freddy', 'south_hall', ai, 5);
    world.anims.push(a);
  },
  onTick(world) {
    const a = world.anims.find((x) => x.id === 'toy_freddy');
    if (!a || a.subPos === 'in_office' || world.powerOut.active) return;
    const st = world.plugins.toy_freddy;
    if (a.subPos !== 'at_door' || !a.door || !isLive(world.stations[world.doorStation[a.door]])) {
      if (world.tick < Number(st.returnAt ?? 0)) return;
      const south = world.stations.south;
      const s = isLive(south) ? south : liveStations(world)[0];
      if (!s) return;
      const door = pick(world.rng, stationDoors(world, s.id));
      a.node = world.map.doors[door].from;
      a.subPos = 'at_door';
      a.door = door;
      st.watch = 0;
      return;
    }
    const s = world.stations[world.doorStation[a.door]];
    if (!s) return;
    st.watch = s.tablet ? Number(st.watch ?? 0) + 1 : 0;
    if (Number(st.watch) > secs(6) && world.tick % 20 === 0 && chance(world.rng, Math.max(0.25, pluginAi(world, 'toy_freddy') / 20))) {
      if (world.doors[a.door].closed) return;
      emit(world, { type: 'toy_in', to: s.playerId ? [s.playerId] : [] });
      enterOffice(world, a, a.door);
      st.returnAt = world.tick + secs(25);
    }
  },
};
