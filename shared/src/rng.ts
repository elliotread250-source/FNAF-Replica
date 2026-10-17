// mulberry32: tiny, fast, seedable. Every random roll in the simulation goes through this.
export interface Rng {
  state: number;
}

export function createRng(seed: number): Rng {
  return { state: seed >>> 0 || 0x9e3779b9 };
}

export function next(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Inclusive integer in [min, max]. */
export function int(rng: Rng, min: number, max: number): number {
  return min + Math.floor(next(rng) * (max - min + 1));
}

export function range(rng: Rng, min: number, max: number): number {
  return min + next(rng) * (max - min);
}

export function chance(rng: Rng, p: number): boolean {
  return next(rng) < p;
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(next(rng) * items.length)];
}

export function weighted<T>(rng: Rng, items: readonly { item: T; w: number }[]): T | null {
  const total = items.reduce((s, i) => s + Math.max(0, i.w), 0);
  if (total <= 0) return null;
  let r = next(rng) * total;
  for (const i of items) {
    r -= Math.max(0, i.w);
    if (r <= 0) return i.item;
  }
  return items[items.length - 1].item;
}

/** Deterministic string hash, used for daily shop seeds and texture seeds. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
