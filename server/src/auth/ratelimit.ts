/** Sliding-window in-memory limiter. One instance, so in-memory is enough (see DECISIONS.md). */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    public limit: number,
    private readonly windowMs: number,
  ) {}

  /** Returns true when the key is over its limit (and records the hit otherwise). */
  hit(key: string, now = Date.now()): boolean {
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (arr.length >= this.limit) {
      this.hits.set(key, arr);
      return true;
    }
    arr.push(now);
    this.hits.set(key, arr);
    return false;
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  sweep(now = Date.now()): void {
    for (const [k, arr] of this.hits) if (arr.every((t) => now - t >= this.windowMs)) this.hits.delete(k);
  }
}

export const limits = {
  loginIp: new RateLimiter(10, 15 * 60_000),
  loginUser: new RateLimiter(5, 15 * 60_000),
  signupIp: new RateLimiter(5, 60 * 60_000),
  guestIp: new RateLimiter(30, 60 * 60_000),
  forgotIp: new RateLimiter(5, 60 * 60_000),
  lobbyCreate: new RateLimiter(10, 10 * 60_000),
  chat: new RateLimiter(1, 1000),
};

export function resetAllLimits(): void {
  for (const l of Object.values(limits)) (l as unknown as { hits: Map<string, number[]> }).hits.clear();
}

/** Outside production, sign-up and guest limits are relaxed so tests and local multi-tab play work. */
export function relaxSignupLimits(): void {
  limits.signupIp.limit = 1000;
  limits.guestIp.limit = 1000;
}
