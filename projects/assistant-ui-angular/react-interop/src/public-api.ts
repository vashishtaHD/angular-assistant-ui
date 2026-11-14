// Ported from packages/core/src/react/client/Tools.ts and Interactables.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// The scope resources that core ships only in its React barrel. Importing this
// entry loads `@assistant-ui/core/react`, so it needs `react` installed or
// aliased to `@assistant-ui/tap/standalone-shim` (as `RuntimeAdapter` already does);
// an alias must also cover `react/jsx-runtime` (`react/*`), which only this entry pulls in.
export { Interactables, Tools, unstable_Interactables } from '@assistant-ui/core/react';
