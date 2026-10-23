import { describe, expect, it, vi } from 'vitest';
import { NetShaper } from '../src/game/netShaper';

describe('test-only network shaper', () => {
  it('passes traffic straight through when no profile is set', () => {
    const s = new NetShaper();
    const got: number[] = [];
    s.deliver('u', 'out', () => got.push(1));
    expect(got).toEqual([1]);
  });

  it('delays by the lag, keeps per-direction order through jitter, and holds traffic during a stall', () => {
    vi.useFakeTimers();
    const s = new NetShaper();
    s.set('u', { lagMs: 100, jitterMs: 80, stallEveryMs: 0, stallMs: 0 });
    const got: number[] = [];
    for (let i = 0; i < 20; i++) s.deliver('u', 'in', () => got.push(i));
    vi.advanceTimersByTime(99);
    expect(got).toEqual([]);
    vi.advanceTimersByTime(200);
    expect(got).toEqual([...Array(20).keys()]); // TCP order, despite random jitter per message
    s.set('u', { lagMs: 0, jitterMs: 0, stallEveryMs: 1000, stallMs: 400 });
    const late: number[] = [];
    s.deliver('u', 'out', () => late.push(1));
    vi.advanceTimersByTime(50);
    expect(late.length).toBeLessThanOrEqual(1);
    vi.advanceTimersByTime(1000);
    expect(late).toEqual([1]);
    s.set('u', { lagMs: 0, jitterMs: 0, stallEveryMs: 0, stallMs: 0 });
    expect(s.active('u')).toBe(false);
    vi.useRealTimers();
  });
});
