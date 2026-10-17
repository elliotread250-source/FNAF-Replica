import { secs } from '../../../config';
import { chance, int, pick } from '../../../rng';
import type { SimPlugin } from './index';
import { pluginAi } from './index';
import { emit, watchers } from '../../world';
import { failSystem } from '../../maintenance';

// Shadow Bear appears on a random camera. Stare at it for two seconds and every camera dies.
export const shadowPlugin: SimPlugin = {
  id: 'shadow',
  init(world) {
    world.plugins.shadow.node = null;
    world.plugins.shadow.until = 0;
    world.plugins.shadow.next = secs(int(world.rng, 15, 40));
    world.plugins.shadow.stare = 0;
  },
  onTick(world) {
    const st = world.plugins.shadow;
    if (st.node) {
      const node = st.node as string;
      const w = watchers(world, node);
      st.stare = w.length ? Number(st.stare) + 1 : 0;
      if (Number(st.stare) > secs(2)) {
        emit(world, { type: 'shadow_stare', to: w.map((s) => s.playerId as string) });
        failSystem(world, 'cameras');
        st.node = null;
        st.next = world.tick + secs(30);
        return;
      }
      if (world.tick >= Number(st.until)) {
        st.node = null;
        st.next = world.tick + secs(int(world.rng, 10, 30));
      }
      return;
    }
    if (world.tick < Number(st.next)) return;
    st.next = world.tick + secs(5);
    if (!chance(world.rng, pluginAi(world, 'shadow') / 20)) return;
    const cams = Object.values(world.map.nodes).filter((n) => n.cam && !n.audioOnly);
    st.node = pick(world.rng, cams).id;
    st.until = world.tick + secs(8);
    st.stare = 0;
  },
};
