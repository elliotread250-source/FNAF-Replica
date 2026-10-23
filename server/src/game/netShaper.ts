// Test-only network shaping for free-roam traffic (TEST_HOOKS builds; never reachable in production). Each player
// can be given a one-way delay, random jitter and periodic stalls, applied to their commands on the way in and to
// their snapshots and events on the way out. Socket.IO runs over TCP, so lost packets show up as a stall followed
// by a burst, never as a missing message; stalls model exactly that. Delivery order per player and direction is
// kept, as TCP would.

export interface NetProfile {
  /** One-way delay, milliseconds. */
  lagMs: number;
  /** Extra random delay, 0..jitterMs, per message. */
  jitterMs: number;
  /** Every `stallEveryMs`, hold all traffic for `stallMs` (loss and retransmit on a TCP link). 0 disables. */
  stallEveryMs: number;
  stallMs: number;
}

const NONE: NetProfile = { lagMs: 0, jitterMs: 0, stallEveryMs: 0, stallMs: 0 };

export class NetShaper {
  private profiles = new Map<string, NetProfile>();
  private last = new Map<string, number>();
  private epoch = Date.now();
  /** Seeded so a shaped run is repeatable. */
  private rng = 0x9e3779b9;

  set(userId: string, p: Partial<NetProfile>): NetProfile {
    const next = { ...NONE, ...p };
    if (next.lagMs <= 0 && next.jitterMs <= 0 && next.stallEveryMs <= 0) this.profiles.delete(userId);
    else this.profiles.set(userId, next);
    return next;
  }

  active(userId: string): boolean {
    return this.profiles.has(userId);
  }

  /** Run `fn` when the shaped message for `userId` in direction `dir` would arrive. */
  deliver(userId: string, dir: 'in' | 'out', fn: () => void): void {
    const p = this.profiles.get(userId);
    if (!p) return fn();
    const now = Date.now();
    this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0;
    let at = now + p.lagMs + (this.rng / 2 ** 32) * p.jitterMs;
    if (p.stallEveryMs > 0 && p.stallMs > 0) {
      const phase = (now - this.epoch) % p.stallEveryMs;
      if (phase < p.stallMs) at = Math.max(at, now + (p.stallMs - phase) + p.lagMs);
    }
    const key = `${userId}:${dir}`;
    at = Math.max(at, this.last.get(key) ?? 0);
    this.last.set(key, at);
    setTimeout(fn, Math.max(0, at - now));
  }
}
