import {
  botTick,
  createBot,
  createWorld,
  eventsFor,
  step,
  viewFor,
  type BotSkill,
  type Mode,
  type PlayerInput,
  type SimEvent,
  type StationId,
  type World,
} from '@fnaf/shared';

export interface RunOptions {
  mode: Mode;
  night: number;
  seed: number;
  players: number;
  skill: BotSkill;
  hourSeconds?: number;
  log?: (w: World, e: SimEvent) => void;
}

const STATIONS: StationId[] = ['west', 'east', 'south', 'control'];

/** Run one full headless night with bot guards. Used by the CLI, the balance script and tests. */
export function runNight(o: RunOptions): World {
  const players = Array.from({ length: o.players }, (_, i) => ({
    id: `bot${i}`,
    name: `Bot ${i + 1}`,
    station: o.mode === 'classic' ? ('office' as StationId) : STATIONS[i],
    isHost: i === 0,
    isBot: true,
  }));
  const world = createWorld({ seed: o.seed, mode: o.mode, night: o.night, hourSeconds: o.hourSeconds ?? 89, players });
  const bots = players.map((p, i) => createBot(p.id, o.skill, o.seed * 31 + i));
  let events: SimEvent[] = [];
  let guard = 0;
  while (!world.ended && guard++ < 200000) {
    const inputs: PlayerInput[] = [];
    for (const b of bots) {
      const v = viewFor(world, b.pid);
      for (const input of botTick(b, v, eventsFor(events, b.pid), world.tick)) inputs.push({ pid: b.pid, seq: 0, input });
    }
    events = step(world, inputs);
    if (o.log) for (const e of events) o.log(world, e);
  }
  return world;
}
