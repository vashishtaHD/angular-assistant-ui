import { inject } from '@angular/core';
import { AuiConfig, Suggestions, type FeedbackAdapter } from 'angular-assistant-ui';
import {
  MastraThreads,
  createMastraTransport,
  mastraThreadListAdapter,
} from 'angular-assistant-ui/mastra';
import { RUNTIME_CONFIG } from '../runtime-config';
import { CHAT_TRANSPORT } from './chat-transport.token';
import { ToastService } from './toast';

/** The starter suggestions of an empty thread. */
export const DEMO_SUGGESTIONS = [
  {
    title: "What's the weather",
    label: 'in Paris?',
    prompt: "What's the weather in Paris?",
  },
  {
    title: 'Book a meeting',
    label: 'with my team tomorrow at 3pm',
    prompt: 'Book a meeting called Team sync tomorrow at 3pm.',
  },
  {
    title: 'Write a TypeScript function',
    label: 'that debounces another',
    prompt: 'Write a TypeScript debounce function and explain it briefly.',
  },
] as const;

/** Logs feedback to the console and thanks the user with a toast. */
export function demoFeedbackAdapter(toasts: ToastService): FeedbackAdapter {
  return {
    submit: ({ message, type }) => {
      console.info('[feedback]', { messageId: message.id, type });
      toasts.show(type === 'positive' ? 'Thanks for the feedback!' : 'Thanks for the feedback.');
    },
  };
}

/**
 * The demo's `AuiConfig`: the Mastra agent's memory threads (`MastraThreads` over
 * `mastraThreadListAdapter` and one `createMastraTransport` per thread, both authenticated by
 * `MASTRA_AUTH`), three starter suggestions and the feedback adapter. Call it in an injection
 * context (a component field initializer). `CHAT_TRANSPORT`, when provided, replaces the Mastra
 * transport (the thread list still uses the server).
 */
export function injectDemoAuiConfig() {
  const { mastraUrl, agentId } = inject(RUNTIME_CONFIG);
  const override = inject(CHAT_TRANSPORT, { optional: true });
  const toasts = inject(ToastService);
  return AuiConfig({
    threads: MastraThreads({
      adapter: mastraThreadListAdapter({ baseUrl: mastraUrl, agentId }),
      transport: () => override ?? createMastraTransport({ api: mastraUrl, agentId }),
      adapters: { feedback: demoFeedbackAdapter(toasts) },
    }),
    suggestions: Suggestions([...DEMO_SUGGESTIONS]),
  });
}
