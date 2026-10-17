import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { runNight } from './runNight';
import type { BotSkill, Mode } from '@fnaf/shared';

interface Job {
  mode: Mode;
  night: number;
  players: number;
  skill: BotSkill;
  seeds: number[];
}

interface Row {
  key: string;
  mode: Mode;
  night: number;
  players: number;
  skill: BotSkill;
  runs: number;
  wins: number;
  powerAtWin: number[];
  firstDeathHour: number[];
  killers: Record<string, number>;
}

function runJob(j: Job): Row {
  const row: Row = { key: `${j.mode}|${j.night}|${j.players}|${j.skill}`, ...j, runs: 0, wins: 0, powerAtWin: [], firstDeathHour: [], killers: {} };
  for (const seed of j.seeds) {
    const w = runNight({ mode: j.mode, night: j.night, seed, players: j.players, skill: j.skill });
    row.runs++;
    if (w.result === 'win') {
      row.wins++;
      row.powerAtWin.push(w.power);
    }
    const deaths = Object.values(w.stations).filter((s) => s && s.deathHour !== null);
    if (deaths.length) row.firstDeathHour.push(Math.min(...deaths.map((s) => s!.deathHour as number)));
    for (const s of deaths) row.killers[s!.killedBy ?? '?'] = (row.killers[s!.killedBy ?? '?'] ?? 0) + 1;
  }
  return row;
}

if (!isMainThread) {
  const jobs = workerData as Job[];
  parentPort?.postMessage(jobs.map(runJob));
} else {
  const arg = (n: string, d: string) => {
    const i = process.argv.indexOf(`--${n}`);
    return i >= 0 ? process.argv[i + 1] : d;
  };
  process.env.TSX_TSCONFIG_PATH ??= 'tsconfig.base.json';
  const N = Number(arg('runs', '200'));
  const modes = arg('modes', 'nightshift,classic').split(',') as Mode[];
  const skills = arg('skills', 'novice,average,expert').split(',') as BotSkill[];
  const nights = arg('nights', '1,2,3,4,5,6').split(',').map(Number);
  const players = arg('players', '1,2,3,4').split(',').map(Number);
  const jobs: Job[] = [];
  for (const mode of modes)
    for (const night of nights)
      for (const p of mode === 'classic' ? [1] : players)
        for (const skill of skills) jobs.push({ mode, night, players: p, skill, seeds: Array.from({ length: N }, (_, i) => 1000 + i * 7919 + night * 31) });
  const threads = Math.max(1, Math.min(cpus().length, 8));
  const buckets: Job[][] = Array.from({ length: threads }, () => []);
  jobs.forEach((j, i) => buckets[i % threads].push(j));
  const started = Date.now();
  const results = (
    await Promise.all(
      buckets.map(
        (b) =>
          new Promise<Row[]>((resolve, reject) => {
            // Workers need tsx's loader registered inside the thread before importing this file.
            const tsxApi = pathToFileURL(createRequire(import.meta.url).resolve('tsx/esm/api')).href;
            const boot = `import { register } from ${JSON.stringify(tsxApi)}; register({ tsconfig: ${JSON.stringify(process.env.TSX_TSCONFIG_PATH)} }); await import(${JSON.stringify(import.meta.url)});`;
            const w = new Worker(new URL(`data:text/javascript,${encodeURIComponent(boot)}`), { workerData: b });
            w.on('message', resolve);
            w.on('error', reject);
          }),
      ),
    )
  ).flat();
  results.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
  const lines = ['| Mode | Night | Guards | Bots | Survival | Avg power at 6 AM | Avg first death | Top killer |', '|---|---|---|---|---|---|---|---|'];
  for (const r of results) {
    const top = Object.entries(r.killers).sort((a, b) => b[1] - a[1])[0];
    lines.push(
      `| ${r.mode} | ${r.night} | ${r.players} | ${r.skill} | ${Math.round((r.wins / r.runs) * 100)}% | ${isNaN(avg(r.powerAtWin)) ? '-' : avg(r.powerAtWin).toFixed(1) + '%'} | ${isNaN(avg(r.firstDeathHour)) ? '-' : avg(r.firstDeathHour).toFixed(1) + ' AM'} | ${top ? `${top[0]} (${top[1]})` : '-'} |`,
    );
  }
  console.log(lines.join('\n'));
  console.log(`\n${results.reduce((s, r) => s + r.runs, 0)} nights in ${((Date.now() - started) / 1000).toFixed(1)} s`);
}
