import { ChangeDetectionStrategy, Component, Directive, inject } from '@angular/core';
import { AISDKChat, AssistantChatTransport } from '@assistant-ui/ai-sdk';
import {
  AuiComposerCancelDirective,
  AuiComposerInputDirective,
  AuiComposerRootDirective,
  AuiComposerSendDirective,
  AuiConfig,
  AuiIfDirective,
  AuiMessagePartsComponent,
  AuiMessageRootDirective,
  AuiMessageTemplateDirective,
  AuiPartTemplateDirective,
  AuiProviderDirective,
  AuiThreadMessagesComponent,
  AuiThreadRootDirective,
  AuiThreadViewportDirective,
  registerToolUI,
  type AssistantState,
} from 'angular-assistant-ui';
import { MASTRA_CHAT_URL } from '../runtime-config';
import { CHAT_TRANSPORT } from './chat-transport.token';
import { WeatherCardComponent } from './weather-card.component';

/**
 * Registers the demo's tool UIs with the enclosing provider's `tools` scope.
 * Must sit under `[auiProvider]`.
 */
@Directive({ selector: '[appChatTools]', standalone: true })
export class ChatToolsDirective {
  constructor() {
    registerToolUI('getWeather', WeatherCardComponent);
  }
}

/** A full-height chat backed by the Mastra `chatAgent` (or `CHAT_TRANSPORT`). */
@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadRootDirective,
    AuiThreadViewportDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessageRootDirective,
    AuiMessagePartsComponent,
    AuiPartTemplateDirective,
    AuiIfDirective,
    AuiComposerRootDirective,
    AuiComposerInputDirective,
    AuiComposerSendDirective,
    AuiComposerCancelDirective,
    ChatToolsDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
  templateUrl: './chat.component.html',
})
export class ChatComponent {
  private readonly transport =
    inject(CHAT_TRANSPORT, { optional: true }) ??
    new AssistantChatTransport({ api: inject(MASTRA_CHAT_URL) });

  /** One AI SDK chat thread over the transport. */
  protected readonly config = AuiConfig({ threads: AISDKChat({ transport: this.transport }) });

  protected readonly isEmpty = (s: AssistantState) => s.thread.messages.length === 0;
  protected readonly isRunning = (s: AssistantState) => s.thread.isRunning;
  protected readonly isIdle = (s: AssistantState) => !s.thread.isRunning;
  /** The last assistant message is still waiting for its first part. */
  protected readonly isWaiting = (s: AssistantState) =>
    s.message.status?.type === 'running' && s.message.parts.length === 0;
  /** The message's run failed (for example the request could not be sent). */
  protected readonly isError = (s: AssistantState) =>
    s.message.status?.type === 'incomplete' && s.message.status.reason === 'error';
}
