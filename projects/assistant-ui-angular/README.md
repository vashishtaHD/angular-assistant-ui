# angular-assistant-ui

Headless Angular bindings for [assistant-ui](https://github.com/assistant-ui/assistant-ui),
built over `@assistant-ui/core`, `@assistant-ui/store` and `@assistant-ui/tap`. It is a
port of upstream's Vue binding: directives and components with no styling, which you
compose with your own markup and CSS.

## Install

```bash
npm install angular-assistant-ui @assistant-ui/core @assistant-ui/store @assistant-ui/tap @assistant-ui/ai-sdk ai react
npm install --save-dev @types/react
```

`@types/react` is a required peer (types only), hence the dev install. `@assistant-ui/ai-sdk` is only needed for the AI SDK runtime (`AISDKChat`). `ai` is an
optional peer dependency (also needed by the `angular-assistant-ui/testing` entry point).

### The `react` requirement

`@assistant-ui/ai-sdk` imports `react` at runtime, so `react` must be installed even
though React renders nothing in an Angular app. To avoid shipping React, alias `react`
to `@assistant-ui/tap/standalone-shim` in your bundler (and `paths` in `tsconfig.json`
if you type-check against it).

### Angular 18

Angular 18 consumers need `skipLibCheck: true` in `tsconfig.json` (the default in new
projects).

## Usage

Wrap the chat in `[auiProvider]` with a config, then compose the primitives. This is the
demo's template, trimmed; the library ships no styles.

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AISDKChat, AssistantChatTransport } from '@assistant-ui/ai-sdk';
import {
  AuiComposerInputDirective,
  AuiComposerRootDirective,
  AuiComposerSendDirective,
  AuiConfig,
  AuiMessagePartsComponent,
  AuiMessageRootDirective,
  AuiMessageTemplateDirective,
  AuiPartTemplateDirective,
  AuiProviderDirective,
  AuiThreadMessagesComponent,
  AuiThreadRootDirective,
  AuiThreadViewportDirective,
} from 'angular-assistant-ui';

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
    AuiComposerRootDirective,
    AuiComposerInputDirective,
    AuiComposerSendDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <div auiThreadRoot>
        <div auiThreadViewport>
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
          <button auiComposerSend>Send</button>
        </form>
      </div>
    </ng-container>
  `,
})
export class ChatComponent {
  protected readonly config = AuiConfig({
    threads: AISDKChat({
      transport: new AssistantChatTransport({ api: 'http://localhost:4111/chat/chatAgent' }),
    }),
  });
}
```

### Tool UIs

Register a component for a tool name with `registerToolUI`, called from an injection
context under `[auiProvider]` (for example a directive placed on the thread root). The
component receives the tool-call part through a required `tool` input.

```ts
import { ChangeDetectionStrategy, Component, Directive, computed, input } from '@angular/core';
import { registerToolUI, type ToolUIComponent, type ToolUIProps } from 'angular-assistant-ui';

@Component({
  selector: 'app-weather-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p>{{ city() }}</p>`,
})
export class WeatherCardComponent implements ToolUIComponent {
  readonly tool = input.required<ToolUIProps>();
  protected readonly city = computed(
    () => (this.tool().part.args as { city?: string } | undefined)?.city ?? '…',
  );
}

@Directive({ selector: '[appChatTools]', standalone: true })
export class ChatToolsDirective {
  constructor() {
    registerToolUI('getWeather', WeatherCardComponent);
  }
}
```

Then write `<div auiThreadRoot appChatTools>` in the template above.

### Reading state

```ts
import { Component } from '@angular/core';
import { injectAuiState, type AssistantState } from 'angular-assistant-ui';

@Component({ selector: 'app-status', standalone: true, template: `{{ isRunning() }}` })
export class StatusComponent {
  // Must be created under an [auiProvider].
  protected readonly isRunning = injectAuiState((s: AssistantState) => s.thread.isRunning);
}
```

In templates, `*auiIf="selector"` renders its content while the selector is truthy.
Do not read store state in a constructor: the client is created when the provider first
binds its input. Read inside `computed`, templates or handlers.

### Provider teardown

Destroying an `[auiProvider]` hard-destroys its client, which stops in-flight streams.
This deliberately differs from upstream Vue's release-only behaviour.

## API

From `angular-assistant-ui`:

| Export                                                                                                              | Area                  |
| ------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `AuiProviderDirective` (`[auiProvider]`), `AUI_CONTEXT`, `AuiContext`                                               | Provider and context  |
| `injectAui`, `injectAuiState`, `injectAuiEvent`, `AuiIfDirective` (`*auiIf`)                                        | State access          |
| `AuiThreadRootDirective`, `AuiThreadViewportDirective`, `AUI_VIEWPORT`, `injectAuiViewport`, `AuiViewport`          | Thread                |
| `AuiThreadMessagesComponent`, `AuiMessageTemplateDirective`, `AuiMessageRootDirective`                              | Messages              |
| `AuiMessagePartsComponent`, `AuiPartTemplateDirective`, `AuiPartTemplateContext`                                    | Message parts         |
| `AuiComposerRootDirective`, `AuiComposerInputDirective`, `AuiComposerSendDirective`, `AuiComposerCancelDirective`   | Composer              |
| `registerToolUI`, `ToolUIComponent`, `ToolUIProps`, `DataUIProps`                                                   | Tool UIs              |
| `AuiConfig`, `Derived`, `createAssistantClient` and the `Assistant*` types and `Unsubscribe`                        | Re-exported store API |

From `angular-assistant-ui/testing` (needs the `ai` package):

- `createScriptedChatTransport(script)` and `ScriptedTurn`: an AI SDK `ChatTransport`
  that answers sends from a script, for tests and offline demos.

See [docs/porting.md](../../docs/porting.md) for what is ported and what is planned.

## Supported versions

<!-- compat-table -->

| Angular | Change detection | Status |
| ------- | ---------------- | ------ |
| 18.2 | Zone.js | Verified: demo app, live end-to-end smoke (Mastra, OpenRouter model, tool call, streamed text), and the compatibility matrix (core 18.2.14) |
| 20 | Zone.js | Verified by the compatibility matrix (core 20.3.35) |
| 22 | Zoneless | Verified by the compatibility matrix (core 22.2.6, `provideZonelessChangeDetection()`) |

The compatibility matrix (`npm run compat -- <ng18|ng20|ng22>`, and the `compat` CI job) installs the
packed library into a fresh app per version, builds it, and runs a browser smoke test that streams a
scripted reply. Angular 22's CLI requires Node `^22.22.3` or `^24.15.0`.

<!-- compat-table -->

## Build and test

`npm run build:lib` writes to `dist/assistant-ui-angular`. `npm run test:lib` runs the
specs with [Vitest](https://vitest.dev) in two projects: `zone` (Zone.js change
detection) and `zoneless` (`provideExperimentalZonelessChangeDetection()`).
