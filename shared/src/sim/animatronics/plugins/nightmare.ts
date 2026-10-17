import { secs } from '../../../config';
import { chance } from '../../../rng';
import type { SimPlugin } from './index';
import { pluginAi } from './index';
import { emit, isLive, kill } from '../../world';

// The Hollow punishes door camping: a door shut for 30 s straight starts breathing.
// Open it within eight seconds of the breathing or the thing behind it comes through.
export const nightmarePlugin: SimPlugin = {
  id: 'nightmare',
  init() {},
  onTick(world) {
    const st = world.plugins.nightmare;
    if (world.powerOut.active || world.tick % 20 !== 0) return;
    for (const door of Object.values(world.doors)) {
      const s = world.stations[door.station];
      if (!isLive(s)) continue;
      const key = `breath_${door.id}`;
      const breathing = Number(st[key] ?? 0);
      if (!door.closed) {
        st[key] = 0;
        continue;
      }
      if (breathing > 0) {
        if (world.tick >= breathing) {
          st[key] = 0;
          kill(world, s.id, 'nightmare');
        }
        continue;
      }
      if (world.tick - door.closedSince >= secs(30) && chance(world.rng, Math.max(0.2, pluginAi(world, 'nightmare') / 20))) {
        st[key] = world.tick + secs(8);
        emit(world, { type: 'nightmare_breath', door: door.id, to: s.playerId ? [s.playerId] : [] });
      }
    }
  },
  onDoor(world, _s, door, closed) {
    if (!closed) world.plugins.nightmare[`breath_${door}`] = 0;
  },
};
