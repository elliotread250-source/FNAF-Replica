import { CONFIG, secs } from '../../config';
import { int, range, chance, weighted, pick } from '../../rng';
import type { DoorId, NodeId, StationId } from '../../content/mapTypes';
import { ROSTER_BY_ID } from '../../content/roster';
import { distTo } from '../graph';
import type { AnimatronicState, World } from '../types';
import { animAt, emit, isLive, isWatched, kill, liveStations, sendHome, watchers } from '../world';
import { maybeFailOnEvent } from '../maintenance';

/** Nodes a character's route data allows on this map. */
export function allowedNodes(world: World, a: AnimatronicState): Set<NodeId> {
  const table = ROSTER_BY_ID[a.id]?.routes[world.map.id];
  if (!table) return new Set(Object.keys(world.map.nodes));
  const s = new Set<NodeId>(Object.keys(table));
  for (const nexts of Object.values(table)) for (const n of Object.keys(nexts)) s.add(n);
  return s;
}

export function huntedDoors(world: World, a: AnimatronicState): DoorId[] {
  return ROSTER_BY_ID[a.id]?.hunts[world.map.id] ?? [];
}

function doorValid(world: World, d: DoorId | null): boolean {
  if (!d || !world.doors[d]) return false;
  return isLive(world.stations[world.doorStation[d]]);
}

/** Pick a target door, weighted toward stations with fewer attacks, so no one guard gets all the action. */
export function chooseTarget(world: World, a: AnimatronicState, doors = huntedDoors(world, a)): DoorId | null {
  const valid = doors.filter((d) => doorValid(world, d));
  if (!valid.length) return null;
  return weighted(
    world.rng,
    valid.map((d) => {
      const sid = world.doorStation[d];
      const sameStation = valid.filter((x) => world.doorStation[x] === sid).length;
      return { item: d, w: 1 / (1 + (world.attacks[sid] ?? 0)) / sameStation };
    }),
  );
}

/** Rolls a movement opportunity and returns true on success. */
export function opportunity(world: World, a: AnimatronicState, bonus = 0): boolean {
  a.moveTimer -= 1;
  if (a.frozenTicks > 0) a.frozenTicks--;
  if (a.moveTimer > 0) return false;
  a.moveTimer += (ROSTER_BY_ID[a.id]?.interval ?? 5) * CONFIG.TICK_HZ;
  if (a.frozenTicks > 0) return false;
  const level = effectiveAi(world, a);
  return int(world.rng, 1, 20) <= level + bonus;
}

export function effectiveAi(world: World, a: AnimatronicState): number {
  if (world.showtime && a.id !== 'puppet' && a.id !== 'golden') {
    const idle = world.tick - a.controlledTick > secs(CONFIG.showtime.UNCONTROLLED_AFTER);
    return idle ? CONFIG.showtime.UNCONTROLLED_AI : 0;
  }
  return a.aiLevel;
}

function occupied(world: World, node: NodeId, self: AnimatronicState): boolean {
  return animAt(world, node).filter((x) => x !== self).length >= CONFIG.animatronics.MAX_PER_NODE;
}

/** Weighted next node, biased toward the target door. */
export function nextNode(world: World, a: AnimatronicState): NodeId | null {
  const table = ROSTER_BY_ID[a.id]?.routes[world.map.id];
  const here = world.map.nodes[a.node];
  const base: Record<NodeId, number> = table?.[a.node] ?? Object.fromEntries(here.links.map((l) => [l, 1]));
  const allowed = allowedNodes(world, a);
  const target = a.targetDoor ? world.map.doors[a.targetDoor]?.from : undefined;
  const dist = target ? distTo(world.map, target, allowed, a.id) : undefined;
  const hereD = dist?.get(a.node) ?? 99;
  const items = Object.entries(base)
    .filter(([n]) => !occupied(world, n, a))
    .map(([n, w]) => {
      let weight = w;
      if (dist) {
        const d = dist.get(n) ?? 99;
        weight *= d < hereD ? 4 : d === hereD ? 1 : 0.3;
      }
      if (world.lure && world.lure.node === n && world.tick < world.lure.until && a.id !== 'freddy') weight *= 6;
      return { item: n, w: weight };
    });
  return weighted(world.rng, items);
}

export function moveTo(world: World, a: AnimatronicState, node: NodeId): void {
  const from = a.node;
  a.node = node;
  a.subPos = 'room';
  a.door = null;
  emit(world, { type: 'moved', anim: a.id, from, dst: node });
  glitchWatchers(world, from, node);
  stepSound(world, a, node);
  if (node === 'kitchen') emit(world, { type: 'kitchen', anim: a.id });
  if (a.id === 'freddy') emit(world, { type: 'laugh', node });
  if (node === 'parts') maybeFailOnEvent(world, 'cameras', 0.1);
  if (node === 'vent_hub' && a.id === 'bonnie') maybeFailOnEvent(world, 'ventilation', 0.3);
}

export function glitchWatchers(world: World, ...nodes: NodeId[]): void {
  const to = new Set<string>();
  for (const n of nodes) for (const s of watchers(world, n)) if (s.playerId) to.add(s.playerId);
  if (to.size) emit(world, { type: 'cam_glitch', nodes, to: [...to] });
}

/** Footsteps reach stations whose door approach is within two rooms, louder with the kitchen mic. */
function stepSound(world: World, a: AnimatronicState, node: NodeId): void {
  for (const s of liveStations(world)) {
    if (!s.playerId) continue;
    let near = 99;
    for (const d of Object.keys(world.doors)) {
      if (world.doorStation[d] !== s.id) continue;
      const from = world.map.doors[d].from;
      const dd = distTo(world.map, from, undefined, 'all').get(node) ?? 99;
      near = Math.min(near, dd);
    }
    const micNode = s.mic && ['east_hall', 'kitchen', 'restrooms', 'east_corner'].includes(node);
    if (near <= 2 || micNode) emit(world, { type: 'step', anim: a.id, node, near, clear: micNode, to: [s.playerId] });
  }
}

/** Retreat two or three rooms back along the route. */
export function retreat(world: World, a: AnimatronicState): void {
  const door = a.door ? world.doors[a.door] : null;
  if (door && door.blockedBy === a.id) door.blockedBy = null;
  if (door) door.stung = null;
  const allowed = allowedNodes(world, a);
  const from = a.door ? world.map.doors[a.door].from : a.node;
  const d = distTo(world.map, from, allowed, a.id);
  const back = [...d.entries()].filter(([n, x]) => (x === 2 || x === 3) && !occupied(world, n, a)).map(([n]) => n);
  const fallback = [...d.entries()].filter(([n, x]) => x >= 1 && !occupied(world, n, a)).map(([n]) => n);
  const dest = back.length ? pick(world.rng, back) : fallback.length ? pick(world.rng, fallback) : world.map.stageNode;
  emit(world, { type: 'retreat', anim: a.id, door: a.door });
  a.subPos = 'room';
  a.door = null;
  a.station = null;
  a.flags.blinded = 0;
  a.node = dest;
  glitchWatchers(world, dest);
}

/** Generic roaming behaviour shared by Freddy, Bonnie, Chica and the extended walkers. */
export function walkerMove(world: World, a: AnimatronicState): void {
  if (a.subPos === 'in_office' || a.subPos === 'in_vent') return;
  if (!doorValid(world, a.targetDoor)) a.targetDoor = chooseTarget(world, a);

  if (a.subPos === 'at_door' && a.door) {
    attemptEntry(world, a, a.door);
    return;
  }

  const target = a.targetDoor;
  if (target && world.map.doors[target].from === a.node) {
    // South hall has two doors: pick whichever one the target station owns at random.
    const options = Object.values(world.map.doors).filter((d) => d.from === a.node && world.doorStation[d.id] === world.doorStation[target]);
    const door = options.length > 1 ? pick(world.rng, options).id : target;
    approachDoor(world, a, door);
    return;
  }

  // Chica eats.
  if (a.id === 'chica' && (a.flags.eat ?? 0) > 0) {
    a.flags.eat--;
    emit(world, { type: 'kitchen', anim: a.id, loud: 1 });
    return;
  }

  const n = nextNode(world, a);
  if (!n) return;
  moveTo(world, a, n);
  if (a.id === 'chica' && n === 'kitchen') a.flags.eat = int(world.rng, ...CONFIG.animatronics.CHICA_EAT);

  // Bonnie's skip: a second edge if the intermediate room isn't watched.
  const rushing = a.id === 'freddy' && a.flags.rush === 1;
  if ((a.id === 'bonnie' && chance(world.rng, CONFIG.animatronics.BONNIE_SKIP_CHANCE)) || rushing) {
    if (isWatched(world, n)) return;
    if (a.targetDoor && world.map.doors[a.targetDoor].from === n) return;
    const n2 = nextNode(world, a);
    if (n2) moveTo(world, a, n2);
  }
}

export function approachDoor(world: World, a: AnimatronicState, door: DoorId): void {
  const def = world.map.doors[door];
  glitchWatchers(world, a.node);
  a.door = door;
  if (def.kind === 'vent') {
    a.subPos = 'in_vent';
    a.flags.ventUntil = world.tick + secs(range(world.rng, ...CONFIG.animatronics.VENT_TRANSIT));
    emit(world, { type: 'vent_enter', anim: a.id });
  } else {
    a.subPos = 'at_door';
    const s = world.stations[world.doorStation[door]];
    if (s?.playerId) emit(world, { type: 'at_door', anim: a.id, door, to: [s.playerId] });
  }
}

export function attemptEntry(world: World, a: AnimatronicState, doorId: DoorId): void {
  const door = world.doors[doorId];
  const sid = world.doorStation[doorId];
  const s = world.stations[sid];
  if (!isLive(s)) {
    retreat(world, a);
    return;
  }
  if (door.closed) {
    // Freddy waits patiently at a closed door sometimes; everyone else gives up.
    if (a.id === 'freddy' && chance(world.rng, 0.5)) return;
    s.stats.closeCalls++;
    retreat(world, a);
    return;
  }
  if (a.id === 'freddy' && !s.tablet) return; // only slips in while you're on the tablet
  enterOffice(world, a, doorId);
}

export function enterOffice(world: World, a: AnimatronicState, doorId: DoorId): void {
  const door = world.doors[doorId];
  const sid = world.doorStation[doorId];
  const s = world.stations[sid];
  if (!s) return;
  a.subPos = 'in_office';
  a.station = sid;
  a.door = doorId;
  a.enteredTick = world.tick;
  a.attackTimer = null;
  a.forceTimer = null;
  door.blockedBy = a.id;
  door.light = false;
  a.flags.sawTablet = 0;
  a.flags.fooledUntil = 0;
  a.flags.maskGrace = world.tick + secs(CONFIG.mask.GRACE_SECONDS);
  if (s.playerId) emit(world, { type: s.tablet ? 'groan' : 'in_office', anim: a.id, door: doorId, to: [s.playerId] });
}

export function isMaskable(world: World, id: string): boolean {
  const m = ROSTER_BY_ID[id]?.maskable;
  if (m === 'early') return world.night <= 4;
  return Boolean(m);
}

/** Per-tick logic for a character sitting in an office. */
export function officeTick(world: World, a: AnimatronicState): void {
  if (a.subPos !== 'in_office' || !a.station) return;
  const s = world.stations[a.station];
  if (!isLive(s)) {
    sendHome(world, a);
    return;
  }
  if (world.powerOut.active) return;

  // The mask (South Office).
  if (s.id === 'south' && isMaskable(world, a.id)) {
    const masked = s.mask && world.tick >= s.maskTick + secs(CONFIG.mask.RAISE_SECONDS);
    if (a.flags.fooledUntil) {
      if (!s.mask) {
        a.flags.fooledUntil = 0; // took it off too soon
      } else if (world.tick >= a.flags.fooledUntil) {
        if (a.door) world.doors[a.door].blockedBy = null;
        emit(world, { type: 'fooled_leave', anim: a.id, to: s.playerId ? [s.playerId] : [] });
        a.subPos = 'room';
        a.station = null;
        a.door = null;
        a.node = 'south_hall';
        a.flags = {};
        a.targetDoor = null;
        return;
      } else return;
    } else if (masked && world.tick <= (a.flags.maskGrace ?? 0) + secs(CONFIG.mask.RAISE_SECONDS)) {
      a.flags.fooledUntil = world.tick + secs(range(world.rng, ...CONFIG.mask.VISITOR_STAY));
      s.stats.maskFools++;
      a.attackTimer = null;
      emit(world, { type: 'fooled', anim: a.id, to: s.playerId ? [s.playerId] : [] });
      return;
    } else if (world.tick <= (a.flags.maskGrace ?? 0)) {
      return; // still inside the grace window
    }
  }

  if (s.tablet) {
    a.flags.sawTablet = 1;
    if (a.forceTimer === null) a.forceTimer = world.tick + secs(range(world.rng, ...CONFIG.animatronics.TABLET_FORCE_DOWN));
    if (world.tick >= a.forceTimer && a.attackTimer === null) {
      s.tablet = false;
      s.tabletChangedTick = world.tick;
      emit(world, { type: 'tablet_forced', to: s.playerId ? [s.playerId] : [] });
      a.attackTimer = world.tick + secs(CONFIG.animatronics.ATTACK_AFTER_TABLET_DOWN);
    }
  } else if (a.attackTimer === null) {
    // Lowering the tablet with one of them inside: 0.2 s. Never raised it: a short random beat.
    a.attackTimer =
      world.tick +
      (a.flags.sawTablet
        ? secs(CONFIG.animatronics.ATTACK_AFTER_TABLET_DOWN)
        : secs(range(world.rng, ...CONFIG.animatronics.IN_OFFICE_ATTACK_DELAY)));
  }
  if (a.attackTimer !== null && world.tick >= a.attackTimer) kill(world, s.id, a.id);
}

/** Vent crawlers arrive at the vent opening after their transit time. */
export function ventTick(world: World, a: AnimatronicState): void {
  if (a.subPos !== 'in_vent' || !a.door) return;
  if (world.tick >= (a.flags.ventUntil ?? 0)) {
    a.subPos = 'at_door';
    const s = world.stations[world.doorStation[a.door]];
    if (s?.playerId) emit(world, { type: 'at_door', anim: a.id, door: a.door, vent: 1, to: [s.playerId] });
  }
}

/** Track which station a character is hunting, for the debug view and pings. */
export function targetStation(world: World, a: AnimatronicState): StationId | null {
  return a.targetDoor ? world.doorStation[a.targetDoor] : null;
}
