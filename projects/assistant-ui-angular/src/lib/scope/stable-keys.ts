// Ported from packages/vue/src/primitives/stableKeys.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { computed, type Signal } from '@angular/core';

const sameKeys = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((key, index) => key === b[index]);

/**
 * Returns a `computed` over `getKeys()` that keeps its previous array (and so
 * does not notify) while the keys are the same strings in the same order.
 */
export function stableKeys(getKeys: () => string[]): Signal<string[]> {
  return computed(getKeys, { equal: sameKeys });
}
