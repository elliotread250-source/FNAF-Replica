import type { DoorId, NodeId } from '../../../content/mapTypes';
import type { StationState, World } from '../../types';
import { endoPlugin } from './endo';
import { toyFreddyPlugin } from './toyFreddy';
import { manglePlugin } from './mangle';
import { bbPlugin } from './bb';
import { shadowPlugin } from './shadow';
import { springPlugin } from './spring';
import { phantomFoxyPlugin } from './phantomFoxy';
import { nightmarePlugin } from './nightmare';

/** Extended-roster rule. Every hook is optional so Custom Night can stack any subset. */
export interface SimPlugin {
  id: string;
  init(world: World, ai: number): void;
  onTick(world: World): void;
  onLight?(world: World, s: StationState, door: DoorId): void;
  onDoor?(world: World, s: StationState, door: DoorId, closed: boolean): void;
  onLure?(world: World, node: NodeId): void;
  onHour?(world: World, hour: number): void;
}

export const PLUGINS: Record<string, SimPlugin> = {
  endo: endoPlugin,
  toy_freddy: toyFreddyPlugin,
  mangle: manglePlugin,
  bb: bbPlugin,
  shadow: shadowPlugin,
  spring: springPlugin,
  phantom_foxy: phantomFoxyPlugin,
  nightmare: nightmarePlugin,
};

/** Roster id -> plugin id (roster entries name their plugin). */
const ROSTER_TO_PLUGIN: Record<string, string> = {
  endo: 'endo',
  toy_freddy: 'toy_freddy',
  mangle: 'mangle',
  bb: 'bb',
  shadow_freddy: 'shadow',
  springtrap: 'spring',
  phantom_foxy: 'phantom_foxy',
  nightmare: 'nightmare',
};

export function initPlugins(world: World, extended: Record<string, number>): void {
  let active = 0;
  for (const [rosterId, ai] of Object.entries(extended)) {
    const pid = ROSTER_TO_PLUGIN[rosterId] ?? rosterId;
    const p = PLUGINS[pid];
    if (!p || ai <= 0 || active >= 12) continue;
    world.plugins[pid] = { ai };
    p.init(world, ai);
    active++;
  }
}

function each(world: World, fn: (p: SimPlugin) => void): void {
  for (const id of Object.keys(world.plugins)) {
    const p = PLUGINS[id];
    if (p) fn(p);
  }
}

export const pluginHooks = {
  tick: (w: World) => each(w, (p) => p.onTick(w)),
  light: (w: World, s: StationState, d: DoorId) => each(w, (p) => p.onLight?.(w, s, d)),
  door: (w: World, s: StationState, d: DoorId, c: boolean) => each(w, (p) => p.onDoor?.(w, s, d, c)),
  lure: (w: World, n: NodeId) => each(w, (p) => p.onLure?.(w, n)),
  hour: (w: World, h: number) => each(w, (p) => p.onHour?.(w, h)),
};

export function pluginAi(world: World, id: string): number {
  return Number(world.plugins[id]?.ai ?? 0);
}
