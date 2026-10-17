import { CONFIG, secs } from '../../config';
import type { NodeId, StationId } from '../../content/mapTypes';
import { shortestPath, distances } from '../graph';
import type { World } from '../types';
import { canWatch, emit, isLive, kill, liveStations, stationDoors } from '../world';
import { failSystem, technicianActive } from '../maintenance';

function stationEntry(world: World, sid: StationId): NodeId | null {
  const d = stationDoors(world, sid)[0];
  return d ? world.map.doors[d].from : null;
}

function pickTarget(world: World, fromNode: NodeId): StationId | null {
  const live = liveStations(world);
  const control = world.stations.control;
  if (isLive(control)) return 'control';
  const dist = distances(world.map, fromNode);
  let best: StationId | null = null;
  let bestD = Infinity;
  for (const s of live) {
    const e = stationEntry(world, s.id);
    const d = e ? (dist.get(e) ?? 99) : 99;
    if (d < bestD) {
      bestD = d;
      best = s.id;
    }
  }
  return best;
}

function routeTo(world: World, from: NodeId, sid: StationId): NodeId[] {
  const e = stationEntry(world, sid);
  if (!e) return [];
  return [...shortestPath(world.map, from, e).slice(1), `office:${sid}`];
}

export function musicBoxTick(world: World): void {
  const mb = world.musicBox;
  if (!mb.enabled || world.powerOut.active) return;
  const C = CONFIG.musicBox;
  const control = world.stations.control;
  const techHere = technicianActive(world);

  let wind = 0;
  if (isLive(control) && control.windHeld && !control.rebooting && !control.tablet) wind += C.WIND_RATE;
  for (const s of liveStations(world)) {
    if (s.id === 'control' && techHere) continue;
    if (s.windHeld && canWatch(world, s) && s.cam === world.map.musicBoxNode) {
      wind += C.WIND_RATE * (techHere && isLive(control) ? C.REMOTE_WIND_FACTOR : 1);
    }
  }
  // Remote winding from the tablet still works if the Technician is dead.
  if (isLive(control) && control.windHeld && control.tablet && canWatch(world, control) && control.cam === world.map.musicBoxNode) {
    wind += C.WIND_RATE * C.REMOTE_WIND_FACTOR;
  }
  mb.level = Math.max(0, Math.min(100, mb.level + (wind - (wind > 0 ? 0 : mb.rate)) / CONFIG.TICK_HZ));
  mb.minLevel = Math.min(mb.minLevel, mb.level);

  const puppet = world.anims.find((a) => a.id === 'puppet');
  if (!puppet) return;

  if (!mb.puppetOut && mb.level <= 0) {
    mb.puppetOut = true;
    mb.puppetNode = world.map.musicBoxNode;
    mb.puppetTarget = pickTarget(world, mb.puppetNode);
    mb.puppetPath = mb.puppetTarget ? routeTo(world, mb.puppetNode, mb.puppetTarget) : [];
    mb.puppetTimer = secs(CONFIG.animatronics.PUPPET_SECONDS_PER_EDGE);
    puppet.active = true;
    puppet.node = mb.puppetNode;
    emit(world, { type: 'puppet_out' });
    failSystem(world, 'audio');
    return;
  }
  if (!mb.puppetOut) return;

  if (mb.level > C.PUPPET_RECALL_THRESHOLD) {
    mb.puppetOut = false;
    puppet.active = false;
    puppet.node = world.map.musicBoxNode;
    mb.puppetNode = world.map.musicBoxNode;
    emit(world, { type: 'puppet_back' });
    return;
  }

  if (!mb.puppetTarget || !isLive(world.stations[mb.puppetTarget])) {
    mb.puppetTarget = pickTarget(world, mb.puppetNode);
    mb.puppetPath = mb.puppetTarget ? routeTo(world, mb.puppetNode, mb.puppetTarget) : [];
  }
  mb.puppetTimer--;
  if (mb.puppetTimer > 0) return;
  mb.puppetTimer = secs(CONFIG.animatronics.PUPPET_SECONDS_PER_EDGE);
  const next = mb.puppetPath.shift();
  if (!next) return;
  if (next.startsWith('office:')) {
    const sid = next.slice(7) as StationId;
    kill(world, sid, 'puppet');
    // Keep going to the next guard.
    const entry = stationEntry(world, sid) ?? mb.puppetNode;
    mb.puppetNode = entry;
    mb.puppetTarget = pickTarget(world, entry);
    mb.puppetPath = mb.puppetTarget ? routeTo(world, entry, mb.puppetTarget) : [];
  } else {
    emit(world, { type: 'moved', anim: 'puppet', from: mb.puppetNode, dst: next });
    mb.puppetNode = next;
  }
  puppet.node = mb.puppetNode;
}

export const PUPPET_EDGE_TICKS = () => secs(CONFIG.animatronics.PUPPET_SECONDS_PER_EDGE);
