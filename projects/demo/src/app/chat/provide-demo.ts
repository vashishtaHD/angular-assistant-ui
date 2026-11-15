// Original angular-assistant-ui demo code (no upstream counterpart; no code copied).
// It wires the Shiki provider (a redesign of packages/ui/src/components/react/assistant-ui/elements/shiki-highlighter.tsx @ 7d74276).
import { inject, type Provider } from '@angular/core';
import { MASTRA_AUTH, type MastraAuth } from 'angular-assistant-ui/mastra';
import { provideShikiHighlighter } from 'angular-assistant-ui/shiki';
import { RUNTIME_CONFIG, mastraAuthFromConfig } from '../runtime-config';

/** Provides `MASTRA_AUTH` from the runtime config (dev mode sends no token). */
export function provideMastraAuthFromConfig(): Provider {
  return {
    provide: MASTRA_AUTH,
    useFactory: (): MastraAuth => mastraAuthFromConfig(inject(RUNTIME_CONFIG)),
  };
}

/**
 * The providers the chat pages need: Shiki code highlighting for the markdown and
 * `MASTRA_AUTH` from the runtime config. The chat routes provide them, so the chat runtime
 * stays out of the initial bundle.
 */
export function provideDemo(): Provider[] {
  return [provideShikiHighlighter(), provideMastraAuthFromConfig()];
}
