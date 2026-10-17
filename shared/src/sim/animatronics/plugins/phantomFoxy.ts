import { secs } from '../../../config';
import { pick } from '../../../rng';
import type { SimPlugin } from './index';
import { emit, liveStations, newAnim } from '../../world';
import { opportunity } from '../base';
import { failSystem } from '../../maintenance';

// Phantom Fox is a hallucination, unless the vents are down. Then its jumpscare is real:
// it doesn't kill, but it knocks out that guard's tablet for ten seconds and breaks something.
export const phantomFoxyPlugin: SimPlugin = {
  id: 'phantom_foxy',
  init(world, ai) {
    world.anims.push({ ...newAnim('phantom_foxy', world.map.coveNode, ai, 7), active: false });
  },
  onTick(world) {
    const a = world.anims.find((x) => x.id === 'phantom_foxy');
    if (!a || world.powerOut.active) return;
    if (!opportunity(world, a)) return;
    const live = liveStations(world);
    if (!live.length) return;
    const s = pick(world.rng, live);
    const to = s.playerId ? [s.playerId] : [];
    if (world.maintenance.failed.ventilation !== undefined) {
      s.tablet = false;
      s.tabletBlockedUntil = world.tick + secs(10);
      emit(world, { type: 'phantom_jumpscare', anim: 'phantom_foxy', to });
      failSystem(world, 'cameras');
    } else {
      emit(world, { type: 'hallucination', kind: 'phantom', seed: world.tick, to });
    }
  },
};
