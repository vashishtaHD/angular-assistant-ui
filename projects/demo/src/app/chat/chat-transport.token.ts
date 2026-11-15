import { InjectionToken } from '@angular/core';
import type { ChatTransport, UIMessage } from 'ai';

/**
 * Overrides the chat transport of every thread (tests provide a scripted one). When absent,
 * each thread posts to the Mastra chat route through `createMastraTransport`.
 */
export const CHAT_TRANSPORT = new InjectionToken<ChatTransport<UIMessage>>('CHAT_TRANSPORT');
