import { CONFIG, secs } from '../config';
import type { DoorId, NodeId, StationId } from '../content/mapTypes';
import { ROSTER_BY_ID } from '../content/roster';
import type { Input, World } from './types';
import { emit, isLive, isWatched, watchers } from './world';
import { approachDoor, attemptEntry, moveTo } from './animatronics/base';

const CONTROLLABLE = ['freddy', 'bonnie', 'chica', 'foxy'];

export function showtimeCooldown(id: string): number {
  return secs((ROSTER_BY_ID[id]?.interval ?? 5) * CONFIG.showtime.COOLDOWN_SCALE);
}

export function applyShowtimeInput(world: World, pid: string, input: Input, seq: number): void {
  const p = world.players[pid];
  if (!world.showtime || !p || p.role !== 'puppeteer' || world.powerOut.active) return;
  const rej = (reason: string) => emit(world, { type: 'reject', seq, reason, to: [pid] });

  if (input.action === 'showtime_ability') {
    const s = world.stations[input.station as StationId];
    if (!isLive(s)) return rej('bad_station');
    if (input.ability === 'lights_out') {
      if (world.tick < world.showtime.lightsOutReady) return rej('cooldown');
      s.lightsOutUntil = world.tick + secs(CONFIG.showtime.LIGHTS_OUT.duration);
      for (const d of Object.values(world.doors)) if (d.station === s.id) d.light = false;
      world.showtime.lightsOutReady = world.tick + secs(CONFIG.showtime.LIGHTS_OUT.cooldown);
      emit(world, { type: 'lights_out', station: s.id });
    } else {
      if (world.tick < world.showtime.staticReady) return rej('cooldown');
      s.staticUntil = world.tick + secs(CONFIG.showtime.STATIC.duration);
      world.showtime.staticReady = world.tick + secs(CONFIG.showtime.STATIC.cooldown);
      emit(world, { type: 'static_attack', station: s.id, to: s.playerId ? [s.playerId] : [] });
    }
    return;
  }
  if (input.action !== 'showtime_move') return;
  const a = world.anims.find((x) => x.id === input.anim);
  if (!a || !CONTROLLABLE.includes(a.id) || !a.active) return rej('bad_anim');
  if (world.tick < a.cooldownUntil) return rej('cooldown');
  if (a.subPos === 'in_office') return rej('busy');
  if (a.id === 'freddy' && isWatched(world, a.node)) return rej('watched');

  const used = () => {
    a.controlledTick = world.tick;
    a.cooldownUntil = world.tick + showtimeCooldown(a.id);
  };

  if (a.id === 'foxy') {
    if (a.stage >= 3) return rej('running');
    if (a.frozenTicks > 0 || watchers(world, world.map.coveNode).length) return rej('watched');
    a.stage++;
    if (a.stage === 3) {
      a.flags.sprintTotal = secs(CONFIG.animatronics.FOXY_SPRINT_SECONDS);
      a.flags.sprintLeft = a.flags.sprintTotal;
      a.flags.seen = 0;
      a.node = world.map.westHallNode;
    }
    emit(world, { type: 'foxy_stage', stage: a.stage });
    used();
    return;
  }

  if (input.door) {
    const door = input.door as DoorId;
    const def = world.map.doors[door];
    if (!def) return rej('bad_door');
    if (a.subPos === 'at_door' && a.door === door) {
      attemptEntry(world, a, door);
      used();
      return;
    }
    if (a.node !== def.from) return rej('not_adjacent');
    if (!(ROSTER_BY_ID[a.id]?.hunts[world.map.id] ?? []).includes(door)) return rej('cant_hunt');
    a.targetDoor = door;
    approachDoor(world, a, door);
    used();
    return;
  }
  const node = input.node as NodeId;
  if (!node || !world.map.nodes[node]) return rej('bad_node');
  if (a.subPos !== 'room') return rej('busy');
  if (!world.map.nodes[a.node].links.includes(node)) return rej('not_adjacent');
  if (node === world.map.coveNode && a.id !== 'foxy') return rej('cant');
  moveTo(world, a, node);
  used();
}

/** Nodes the Puppeteer can see: each animatronic's node and its neighbours. */
export function puppeteerVision(world: World): Set<NodeId> {
  const v = new Set<NodeId>();
  for (const a of world.anims) {
    if (!a.active) continue;
    v.add(a.node);
    for (const l of world.map.nodes[a.node]?.links ?? []) v.add(l);
  }
  return v;
}
