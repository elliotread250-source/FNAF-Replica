import { runNight } from './runNight';
import type { BotSkill, Mode } from '@fnaf/shared';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

const mode = arg('mode', 'classic') as Mode;
const night = Number(arg('night', '1'));
const seed = Number(arg('seed', '42'));
const bot = arg('bot', 'average') as BotSkill;
const players = Number(arg('players', mode === 'classic' ? '1' : '4'));
const quiet = new Set(['step', 'flicker', 'mute_vote']);

const fmt = (tick: number) => {
  const s = tick / 20;
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;
};

const w = runNight({
  mode,
  night,
  seed,
  players,
  skill: bot,
  log: (world, e) => {
    if (quiet.has(e.type)) return;
    const { type, tick: _t, to: _to, ...rest } = e as Record<string, unknown>;
    console.log(`[${fmt(world.tick)}] ${world.hour === 0 ? 12 : world.hour} AM  power ${world.power.toFixed(1)}%  ${String(type).padEnd(16)} ${JSON.stringify(rest)}`);
  },
});
console.log(`\nResult: ${w.result} at ${w.hour === 0 ? 12 : w.hour} AM with ${w.power.toFixed(1)}% power.`);
for (const s of Object.values(w.stations)) {
  if (s && !s.sealed) console.log(`  ${s.id}: ${s.alive ? 'survived' : `caught by ${s.killedBy} at ${s.deathHour} AM`}`);
}
