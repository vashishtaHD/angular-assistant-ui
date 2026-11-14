import { InjectionToken } from '@angular/core';
import type { ChatTransport, UIMessage } from 'ai';

/**
 * Overrides the chat transport (tests provide a scripted one). When absent,
 * the chat posts to `MASTRA_CHAT_URL` with `AssistantChatTransport`.
 */
export const CHAT_TRANSPORT = new InjectionToken<ChatTransport<UIMessage>>('CHAT_TRANSPORT');
