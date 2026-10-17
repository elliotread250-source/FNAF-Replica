import { createWorld, step, type PlayerInput, type World, type WorldOptions, type Input, type StationId, CONFIG } from '../src/index';

export function classic(night = 1, seed = 1, extra: Partial<WorldOptions> = {}): World {
  return createWorld({ seed, mode: 'classic', night, hourSeconds: 89, players: [{ id: 'p1', name: 'P1', station: 'office', isHost: true }], ...extra });
}

export function coop(players = 4, night = 1, seed = 1, extra: Partial<WorldOptions> = {}): World {
  const st: StationId[] = ['west', 'east', 'south', 'control'];
  return createWorld({
    seed,
    mode: 'nightshift',
    night,
    hourSeconds: 89,
    players: Array.from({ length: players }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, station: st[i], isHost: i === 0 })),
    ...extra,
  });
}

export function input(world: World, pid: string, i: Input): World['events'] {
  return step(world, [{ pid, seq: 1, input: i } as PlayerInput]);
}

export function run(world: World, seconds: number, each?: (w: World) => void): World['events'] {
  const all: World['events'] = [];
  const n = Math.round(seconds * CONFIG.TICK_HZ);
  for (let i = 0; i < n && !world.ended; i++) {
    all.push(...step(world));
    each?.(world);
  }
  return all;
}

export function anim(world: World, id: string) {
  const a = world.anims.find((x) => x.id === id);
  if (!a) throw new Error(`no anim ${id}`);
  return a;
}

/** Disable every core animatronic so a test can focus on one. */
export function quiet(world: World): World {
  for (const a of world.anims) a.aiLevel = 0;
  world.goldenOdds = 0;
  world.maintenance.schedule = [];
  world.call = null;
  return world;
}
