// Original (no upstream counterpart): `@assistant-ui/tap/react-shim` ships without type
// declarations. These are the hooks the vendored AI SDK runtime takes from it, as the published
// `@assistant-ui/ai-sdk` build does. Inside a tap resource the shim runs tap's hooks; outside it
// calls React, and `useEffectEvent` falls back to a ref-based shim on React 18 and 19.0/19.1.
// They merge with the main entry's declarations of the same module (function overloads).
declare module '@assistant-ui/tap/react-shim' {
  export function useState<S>(initial: S | (() => S)): [S, (next: S | ((prev: S) => S)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useInsertionEffect(
    effect: () => void | (() => void),
    deps?: readonly unknown[],
  ): void;
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  export function useCallback<T extends (...args: never[]) => unknown>(
    callback: T,
    deps: readonly unknown[],
  ): T;
  export function useRef<T>(initial: T): { current: T };
  export function useRef<T = undefined>(): { current: T | undefined };
  export function useSyncExternalStore<T>(
    subscribe: (onChange: () => void) => () => void,
    getSnapshot: () => T,
    getServerSnapshot?: () => T,
  ): T;
  export function useEffectEvent<T extends (...args: never[]) => unknown>(callback: T): T;
}
