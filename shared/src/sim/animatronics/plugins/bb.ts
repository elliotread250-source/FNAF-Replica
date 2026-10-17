import { CONFIG, secs } from '../../../config';
import { chance, int, pick } from '../../../rng';
import type { SimPlugin } from './index';
import { pluginAi } from './index';
import { emit, liveStations, stationDoors } from '../../world';

// Balloon Kid giggles in a doorway. Turn a light on while he's there and he steals that station's lights.
export const bbPlugin: SimPlugin = {
  id: 'bb',
  init(world) {
    world.plugins.bb.station = null;
    world.plugins.bb.until = 0;
    world.plugins.bb.next = secs(int(world.rng, 20, 50));
  },
  onTick(world) {
    const st = world.plugins.bb;
    if (st.station && world.tick >= Number(st.until)) {
      st.station = null;
      st.next = world.tick + secs(int(world.rng, 15, 40));
    }
    if (st.station || world.tick < Number(st.next)) return;
    st.next = world.tick + secs(5);
    if (!chance(world.rng, pluginAi(world, 'bb') / 20)) return;
    const live = liveStations(world);
    if (!live.length) return;
    const s = pick(world.rng, live);
    st.station = s.id;
    st.until = world.tick + secs(12);
    emit(world, { type: 'bb_giggle', station: s.id, to: s.playerId ? [s.playerId] : [] });
  },
  onLight(world, s) {
    const st = world.plugins.bb;
    if (st.station !== s.id) return;
    for (const d of stationDoors(world, s.id)) {
      world.doors[d].lightDeadUntil = world.tick + secs(20);
      world.doors[d].light = false;
    }
    emit(world, { type: 'bb_steal', to: s.playerId ? [s.playerId] : [] });
    st.station = null;
    st.next = world.tick + secs(30);
    void CONFIG;
  },
};
