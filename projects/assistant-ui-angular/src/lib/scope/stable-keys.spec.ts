import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { stableKeys } from './stable-keys';

describe('stableKeys', () => {
  it('stableKeys returns the previous array for equal keys', () => {
    const source = signal(['a', 'b']);
    const keys = stableKeys(() => source());
    const first = keys();
    expect(first).toEqual(['a', 'b']);

    source.set(['a', 'b']);
    expect(keys()).toBe(first);

    source.set(['a', 'c']);
    expect(keys()).toEqual(['a', 'c']);
    expect(keys()).not.toBe(first);

    source.set(['a', 'c', 'd']);
    expect(keys()).toEqual(['a', 'c', 'd']);
  });
});
