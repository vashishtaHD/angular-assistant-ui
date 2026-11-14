// Ported from packages/core/src/react/model-context/stub-tool.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// and packages/core/src/react/model-context/external-tool.ts, human-tool.ts, provider-tool.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// (re-implemented here so the main entry never imports `@assistant-ui/core/react`)
import type { ProviderToolConfig } from '@assistant-ui/core/react';

const compiled = (name: string, what: string) =>
  new Error(
    `[assistant-ui] ${name}() has no runtime implementation: it marks ${what} and is stripped at ` +
      'build time by the use-generative compiler. Reaching it means this module was not compiled ' +
      `(${name}() used outside a "use generative" file).`,
  );

/**
 * Marks a generative toolkit entry as a frontend tool whose executor will be
 * supplied by `injectAuiToolOverrides(...)`. It has no runtime implementation
 * and must be used in a `"use generative"` toolkit file.
 */
export function stubTool(): never {
  throw compiled('stubTool', 'a tool executor supplied via injectAuiToolOverrides(...)');
}

/**
 * Marks a generative toolkit entry as an externally executed backend tool that
 * assistant-ui only renders. No runtime implementation.
 */
export function externalTool(): never {
  throw compiled('externalTool', 'a tool that executes outside assistant-ui');
}

/**
 * Marks a tool as human-in-the-loop: the UI (`render`) supplies the result
 * instead of code. Use it as the tool's `execute`. No runtime implementation.
 */
export function humanTool(): never {
  throw compiled('humanTool', 'a human-in-the-loop tool');
}

/** @deprecated Use {@link humanTool}. */
export const hitlTool = humanTool;

/** @deprecated Use {@link humanTool}. */
export const hitl = humanTool;

/**
 * Marks a tool as provider-executed. No runtime implementation.
 */
export function providerTool(config: ProviderToolConfig): never {
  void config;
  throw compiled('providerTool', 'a provider-executed tool');
}
