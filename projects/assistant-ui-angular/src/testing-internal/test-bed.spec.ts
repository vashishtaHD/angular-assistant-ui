import { describe, expect, it } from 'vitest';
import { assertTestProjectMatchesEnvironment, isZoneLoaded, isZonelessTestRun } from './test-bed';

describe('test environment', () => {
  it('matches the Vitest project (zone has Zone.js, zoneless does not)', () => {
    expect(isZoneLoaded()).toBe(!isZonelessTestRun());
    expect(() => assertTestProjectMatchesEnvironment()).not.toThrow();
  });
});
