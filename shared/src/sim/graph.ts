import type { MapDef, NodeId } from '../content/mapTypes';

/** BFS distances from `from` across links, restricted to `allowed` when given. */
export function distances(map: MapDef, from: NodeId, allowed?: Set<NodeId>): Map<NodeId, number> {
  const dist = new Map<NodeId, number>([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const n = queue.shift() as NodeId;
    const d = dist.get(n) as number;
    for (const l of map.nodes[n]?.links ?? []) {
      if (dist.has(l)) continue;
      if (allowed && !allowed.has(l)) continue;
      dist.set(l, d + 1);
      queue.push(l);
    }
  }
  return dist;
}

export function shortestPath(map: MapDef, from: NodeId, to: NodeId): NodeId[] {
  const prev = new Map<NodeId, NodeId | null>([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const n = queue.shift() as NodeId;
    if (n === to) break;
    for (const l of map.nodes[n]?.links ?? []) {
      if (prev.has(l)) continue;
      prev.set(l, n);
      queue.push(l);
    }
  }
  if (!prev.has(to)) return [from];
  const path: NodeId[] = [];
  let cur: NodeId | null = to;
  while (cur) {
    path.unshift(cur);
    cur = prev.get(cur) ?? null;
  }
  return path;
}

const cache = new WeakMap<object, Map<string, Map<NodeId, number>>>();

/** Memoised distance-to-node lookup, keyed by a route allow-list. */
export function distTo(map: MapDef, to: NodeId, allowed: Set<NodeId> | undefined, key: string): Map<NodeId, number> {
  let m = cache.get(map);
  if (!m) cache.set(map, (m = new Map()));
  const k = `${key}|${to}`;
  let d = m.get(k);
  if (!d) {
    d = distances(map, to, allowed);
    m.set(k, d);
  }
  return d;
}
