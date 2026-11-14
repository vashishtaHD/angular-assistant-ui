import { describe, expect, it, vi } from 'vitest';
import { createLastValidCache } from './last-valid-cache';

describe('createLastValidCache', () => {
  it('serves the last valid item until a microtask, then reports once', async () => {
    const reportStale = vi.fn();
    const cache = createLastValidCache<string>(reportStale);
    const fail = () => {
      throw new Error('out of bounds');
    };

    expect(cache.resolve(true, () => 'a')).toBe('a');
    expect(cache.resolve(false, fail)).toBe('a');
    expect(reportStale).not.toHaveBeenCalled();

    await Promise.resolve();
    expect(reportStale).toHaveBeenCalledTimes(1);
    expect(() => cache.resolve(false, fail)).toThrow('out of bounds');
  });

  it('a valid resolution before the microtask voids the expiry', async () => {
    const reportStale = vi.fn();
    const cache = createLastValidCache<string>(reportStale);
    cache.resolve(true, () => 'a');
    cache.resolve(false, () => 'never');
    expect(cache.resolve(true, () => 'b')).toBe('b');

    await Promise.resolve();
    expect(reportStale).not.toHaveBeenCalled();
  });
});
