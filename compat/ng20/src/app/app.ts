// Shared compat app source: compat/ng18, ng20 and ng22 carry byte-identical copies of
// this file (scripts/compat.mjs checks it). Only main.ts and app.config.ts (the
// bootstrap: Zone.js or zoneless) differ between the apps.
import { ChangeDetectionStrategy, Component, Directive, computed, input } from '@angular/core';
import { AISDKThreads } from '@assistant-ui/ai-sdk';
import type { UIMessage, UIMessageChunk } from 'ai';
import {
  AuiConfig,
  AuiProviderDirective,
  registerToolUI,
  type ToolUIComponent,
  type ToolUIProps,
} from 'angular-assistant-ui';
import { createScriptedChatTransport } from 'angular-assistant-ui/testing';
import { AuiThreadComponent, AuiThreadListComponent } from 'angular-assistant-ui/ui';

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

/** A `bookMeeting` call that waits for the user's approval (no registered UI: the tool fallback). */
const approvalTurn = (): UIMessageChunk[] => [
  { type: 'start' },
  { type: 'start-step' },
  {
    type: 'tool-input-available',
    toolCallId: 'call-book',
    toolName: 'bookMeeting',
    input: { title: 'Sync', when: 'Monday 10am' },
  },
  { type: 'tool-approval-request', approvalId: 'approval-1', toolCallId: 'call-book' },
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
 * "weather" streams a tool call, "slow" streams slowly (so it can be cancelled),
 * "markdown" answers with bold text and a code block, "book" asks for a tool
 * approval, anything else answers "Hi there!".
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
    case 'markdown':
      return {
        chunks: textTurn('Some **bold** text.\n\n', '```ts\nconst answer = 42;\n```\n'),
      };
    case 'book':
      return { chunks: approvalTurn() };
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
 * Compat smoke app: the styled kit (`aui-thread-list` beside `aui-thread`) over
 * an in-memory thread list (`AISDKThreads`) and a scripted (offline) transport.
 * It covers streaming, markdown, a registered tool UI, the tool fallback's
 * approval, attachments, editing and branches, cancel and thread switching.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AuiProviderDirective, AuiThreadComponent, AuiThreadListComponent, ToolsDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-shell" [auiProvider]="config">
      <aside class="app-sidebar"><aui-thread-list /></aside>
      <main class="app-main" appTools>
        <aui-thread [welcome]="{ message: 'Compat smoke' }" />
      </main>
    </div>
  `,
  styles: `
    .app-shell {
      display: flex;
      height: 100dvh;
    }
    .app-sidebar {
      width: 260px;
      flex: none;
      overflow-y: auto;
    }
    .app-main {
      flex: 1;
      min-width: 0;
    }
  `,
})
export class App {
  protected readonly config = AuiConfig({ threads: AISDKThreads({ transport }) });
}
