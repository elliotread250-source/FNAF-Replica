import { CONFIG, secs } from '../config';
import { int, weighted, chance, range } from '../rng';
import type { StationId } from '../content/mapTypes';
import type { SystemId, World } from './types';
import { emit, isLive, liveStations, stationDoors } from './world';

export function technicianActive(world: World): boolean {
  const c = world.stations.control;
  return Boolean(c && !c.sealed);
}

/** N failures between 1 AM and 5:30 AM, at least MIN_GAP apart. */
export function buildMaintenanceSchedule(world: World): { tick: number; system: SystemId }[] {
  const n = world.night === 7 ? (world.custom ? 5 : 0) : (CONFIG.maintenance.PER_NIGHT[world.night] ?? 0);
  const start = world.hourTicks * 1;
  const end = Math.floor(world.hourTicks * 5.5);
  const gap = Math.min(secs(CONFIG.maintenance.MIN_GAP), Math.floor((end - start) / Math.max(1, n + 1)));
  const ticks: number[] = [];
  let guard = 0;
  while (ticks.length < n && guard++ < 500) {
    const t = int(world.rng, start, end);
    if (ticks.every((x) => Math.abs(x - t) >= gap)) ticks.push(t);
  }
  ticks.sort((a, b) => a - b);
  return ticks.map((tick) => ({ tick, system: rollSystem(world) }));
}

function rollSystem(world: World): SystemId {
  if (!technicianActive(world)) return 'cameras';
  const w = CONFIG.maintenance.WEIGHTS;
  const occupied = world.stationOrder.filter((s) => {
    const st = world.stations[s];
    return st && !st.sealed && s !== 'control';
  });
  const items: { item: SystemId; w: number }[] = [
    { item: 'cameras', w: w.cameras },
    { item: 'ventilation', w: w.ventilation },
    { item: 'audio', w: w.audio },
    { item: 'power', w: w.power },
    ...occupied.map((s) => ({ item: `doors_${s}` as SystemId, w: w.doors / Math.max(1, occupied.length) })),
  ];
  return weighted(world.rng, items) ?? 'cameras';
}

export function failSystem(world: World, system: SystemId): void {
  const m = world.maintenance;
  if (!m.enabled || m.failed[system] !== undefined) return;
  if (!technicianActive(world) && system !== 'cameras') return;
  m.failed[system] = world.tick;
  if (!technicianActive(world)) m.autoReboot[system] = world.tick + secs(CONFIG.maintenance.AUTO_REBOOT_CAMERAS);
  if (system.startsWith('doors_')) {
    const sid = system.slice(6) as StationId;
    for (const d of stationDoors(world, sid)) world.doors[d].jammed = true;
  }
  emit(world, { type: 'system_fail', system });
}

export function repairSystem(world: World, system: SystemId): void {
  const m = world.maintenance;
  if (m.failed[system] === undefined) return;
  delete m.failed[system];
  delete m.autoReboot[system];
  if (system.startsWith('doors_') && !world.powerOut.active) {
    const sid = system.slice(6) as StationId;
    const st = world.stations[sid];
    for (const d of stationDoors(world, sid)) world.doors[d].jammed = Boolean(st?.sealed);
  }
  emit(world, { type: 'system_ok', system });
}

export function startReboot(world: World, system: SystemId | 'all'): boolean {
  const c = world.stations.control;
  if (!isLive(c) || c.rebooting) return false;
  if (system !== 'all' && world.maintenance.failed[system] === undefined) return false;
  c.rebooting = { system, endTick: world.tick + secs(system === 'all' ? CONFIG.maintenance.REBOOT_ALL : CONFIG.maintenance.REBOOT_ONE) };
  c.tablet = false;
  emit(world, { type: 'rebooting', system, to: c.playerId ? [c.playerId] : [] });
  return true;
}

export function stepMaintenance(world: World): void {
  const m = world.maintenance;
  if (!m.enabled) return;
  while (m.schedule.length && m.schedule[0].tick <= world.tick) {
    const ev = m.schedule.shift();
    if (ev) failSystem(world, ev.system);
  }
  for (const [sys, t] of Object.entries(m.autoReboot)) if (t !== undefined && world.tick >= t) repairSystem(world, sys as SystemId);

  const c = world.stations.control;
  if (c?.rebooting && world.tick >= c.rebooting.endTick) {
    const sys = c.rebooting.system;
    if (sys === 'all') {
      for (const s of Object.keys(m.failed)) {
        repairSystem(world, s as SystemId);
        c.stats.reboots++;
      }
    } else {
      repairSystem(world, sys);
      c.stats.reboots++;
    }
    c.rebooting = null;
    emit(world, { type: 'reboot_done', system: sys, to: c.playerId ? [c.playerId] : [] });
  }
  if (c && (!c.alive || c.abandoned)) c.rebooting = null;

  // Ventilation failure: hallucinations after VENT_HALLUCINATE_AFTER seconds.
  const vent = m.failed.ventilation;
  if (vent !== undefined && world.tick - vent >= secs(CONFIG.maintenance.VENT_HALLUCINATE_AFTER)) {
    for (const s of liveStations(world)) {
      if (world.tick >= s.hallucinateAt) {
        const kinds = ['face', 'red', 'fake_cam', 'its_me', 'wobble'];
        emit(world, {
          type: 'hallucination',
          kind: kinds[int(world.rng, 0, kinds.length - 1)],
          seed: int(world.rng, 0, 1e6),
          to: s.playerId ? [s.playerId] : [],
        });
        s.hallucinateAt = world.tick + secs(range(world.rng, ...CONFIG.hallucination.INTERVAL));
      }
    }
  }
}

export function hallucinating(world: World): boolean {
  const vent = world.maintenance.failed.ventilation;
  return vent !== undefined && world.tick - vent >= secs(CONFIG.maintenance.VENT_HALLUCINATE_AFTER);
}

export function maybeFailOnEvent(world: World, system: SystemId, p: number): void {
  if (chance(world.rng, p)) failSystem(world, system);
}
