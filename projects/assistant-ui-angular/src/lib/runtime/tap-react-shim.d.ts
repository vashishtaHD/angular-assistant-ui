// `@assistant-ui/tap/react-shim` ships without type declarations. These are the
// two hooks the library uses inside tap resources (the same shim core uses).
declare module '@assistant-ui/tap/react-shim' {
  export function useState<S>(initial: S | (() => S)): [S, (next: S | ((prev: S) => S)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
}
