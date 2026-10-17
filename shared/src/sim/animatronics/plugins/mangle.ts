import { secs } from '../../../config';
import { pick } from '../../../rng';
import type { SimPlugin } from './index';
import { pluginAi } from './index';
import { emit, isLive, kill, liveStations } from '../../world';

// Tangle crawls the ceiling toward one station. Radio static rises; close the door right as it peaks.
export const manglePlugin: SimPlugin = {
  id: 'mangle',
  init(world) {
    world.plugins.mangle.progress = 0;
    world.plugins.mangle.station = null;
    world.plugins.mangle.peakUntil = 0;
  },
  onTick(world) {
    const st = world.plugins.mangle;
    if (world.powerOut.active) return;
    let sid = st.station as string | null;
    if (!sid || !isLive(world.stations[sid as 'west'])) {
      const live = liveStations(world);
      if (!live.length) return;
      sid = pick(world.rng, live).id;
      st.station = sid;
      st.progress = 0;
      st.peakUntil = 0;
    }
    const s = world.stations[sid as 'west'];
    if (!s) return;
    const to = s.playerId ? [s.playerId] : [];
    if (Number(st.peakUntil) > 0) {
      if (world.tick >= Number(st.peakUntil)) {
        st.peakUntil = 0;
        st.progress = 0;
        st.station = null;
        kill(world, s.id, 'mangle');
      }
      return;
    }
    st.progress = Number(st.progress) + (pluginAi(world, 'mangle') * 0.25) / 20;
    if (world.tick % 20 === 0) emit(world, { type: 'mangle_static', level: Math.min(1, Number(st.progress) / 100), to });
    if (Number(st.progress) >= 100) {
      st.peakUntil = world.tick + secs(1.5);
      emit(world, { type: 'mangle_peak', to });
    }
  },
  onDoor(world, s, _door, closed) {
    const st = world.plugins.mangle;
    if (!closed || st.station !== s.id || Number(st.peakUntil) <= 0) return;
    emit(world, { type: 'mangle_gone', to: s.playerId ? [s.playerId] : [] });
    st.peakUntil = 0;
    st.progress = 0;
    st.station = null;
  },
};
