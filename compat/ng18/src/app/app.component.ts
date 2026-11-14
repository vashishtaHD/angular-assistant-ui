import { ChangeDetectionStrategy, Component, Directive, computed, input } from '@angular/core';
import { AISDKChat } from '@assistant-ui/ai-sdk';
import type { UIMessage, UIMessageChunk } from 'ai';
import type { AssistantState } from '@assistant-ui/store/client';
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
  type ToolUIComponent,
  type ToolUIProps,
} from 'angular-assistant-ui';
import { createScriptedChatTransport } from 'angular-assistant-ui/testing';

const textTurn = (...deltas: string[]): UIMessageChunk[] => [
  { type: 'start' },
  { type: 'text-start', id: 't1' },
  ...deltas.map((delta): UIMessageChunk => ({ type: 'text-delta', id: 't1', delta })),
  { type: 'text-end', id: 't1' },
  { type: 'finish' },
];

/** A provider-executed `getWeather` call with its result, then a text answer. */
const weatherTurn = (): UIMessageChunk[] => [
  { type: 'start' },
  { type: 'start-step' },
  {
    type: 'tool-input-available',
    toolCallId: 'call-1',
    toolName: 'getWeather',
    input: { city: 'Paris' },
    providerExecuted: true,
  },
  {
    type: 'tool-output-available',
    toolCallId: 'call-1',
    output: { city: 'Paris', temperatureC: 18, condition: 'Sunny' },
    providerExecuted: true,
  },
  { type: 'finish-step' },
  { type: 'start-step' },
  { type: 'text-start', id: 't1' },
  { type: 'text-delta', id: 't1', delta: 'It is sunny in Paris.' },
  { type: 'text-end', id: 't1' },
  { type: 'finish-step' },
  { type: 'finish' },
];

const lastUserText = (messages: UIMessage[]): string =>
  messages
    .filter((message) => message.role === 'user')
    .at(-1)
    ?.parts.map((part) => (part.type === 'text' ? part.text : ''))
    .join('') ?? '';

/**
 * Scripted (offline) replies, chosen by the last user message:
 * "weather" streams a tool call, "slow" streams slowly (so it can be
 * cancelled), anything else answers "Hi there!".
 */
const transport = createScriptedChatTransport((messages) => {
  switch (lastUserText(messages)) {
    case 'weather':
      return { chunks: weatherTurn(), delayMs: 500 };
    case 'slow':
      return {
        chunks: textTurn('one ', 'two ', 'three ', 'four ', 'the end'),
        delayMs: 300,
      };
    default:
      return { chunks: textTurn('Hi ', 'there!') };
  }
});

/** Tool UI for `getWeather`: shows the city until the result arrives. */
@Component({
  selector: 'app-weather-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-testid="weather-card" [attr.data-state]="result() ? 'done' : 'loading'">
      @if (result(); as r) {
        {{ r.city }}: {{ r.temperatureC }}C {{ r.condition }}
      } @else {
        Checking {{ city() }}
      }
    </div>
  `,
})
export class WeatherCardComponent implements ToolUIComponent {
  readonly tool = input.required<ToolUIProps>();

  protected readonly city = computed(() => (this.tool().part.args as { city?: string }).city);
  protected readonly result = computed(
    () =>
      this.tool().part.result as
        { city: string; temperatureC: number; condition: string } | undefined,
  );
}

/** Registers the tool UI with the enclosing provider. */
@Directive({ selector: '[appTools]', standalone: true })
export class ToolsDirective {
  constructor() {
    registerToolUI('getWeather', WeatherCardComponent);
  }
}

/**
 * Compat smoke app: a chat over a scripted (offline) transport that covers
 * text streaming, a registered tool UI, `*auiIf` (Send/Stop) and cancel.
 */
@Component({
  selector: 'app-root',
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
    ToolsDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <div auiThreadRoot appTools>
        <div auiThreadViewport style="height: 320px; overflow-y: auto">
          <aui-thread-messages>
            <ng-template auiMessage>
              <div auiMessageRoot>
                <aui-message-parts>
                  <ng-template auiPart="text" let-part>
                    <p>{{ part.type === 'text' ? part.text : '' }}</p>
                  </ng-template>
                </aui-message-parts>
              </div>
            </ng-template>
          </aui-thread-messages>
        </div>
        <form auiComposerRoot>
          <textarea auiComposerInput aria-label="Message"></textarea>
          <button *auiIf="isIdle" auiComposerSend aria-label="Send">Send</button>
          <button *auiIf="isRunning" auiComposerCancel type="button" aria-label="Stop">Stop</button>
        </form>
      </div>
    </ng-container>
  `,
})
export class AppComponent {
  protected readonly config = AuiConfig({ threads: AISDKChat({ transport }) });

  protected readonly isRunning = (s: AssistantState) => s.thread.isRunning;
  protected readonly isIdle = (s: AssistantState) => !s.thread.isRunning;
}
