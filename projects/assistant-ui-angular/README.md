# angular-assistant-ui

Headless Angular bindings for [assistant-ui](https://github.com/assistant-ui/assistant-ui),
built over `@assistant-ui/core`, `@assistant-ui/store` and `@assistant-ui/tap`. It is a
port of upstream's Vue binding: directives and components with no styling, which you
compose with your own markup and CSS.

## Install

The main entry and the store packages:

```bash
npm install angular-assistant-ui @assistant-ui/core @assistant-ui/store @assistant-ui/tap react
npm install --save-dev @types/react
```

`@types/react` is a required peer (types only), hence the dev install. `react` is needed at run time even
though React renders nothing (see below). Each secondary entry adds its own optional peers:

| Entry | What | Also install |
| --- | --- | --- |
| `angular-assistant-ui` | Headless primitives, `[auiProvider]`, runtimes, tool UIs | `@assistant-ui/ai-sdk ai` for the AI SDK runtime (`AISDKChat`, `AISDKThreads`) |
| `angular-assistant-ui/ui` | Styled kit: `aui-thread`, `aui-thread-list`, `aui-thread-list-sidebar`, `aui-assistant-modal`, the tool fallback, attachments; `ui/styles.css` | `@angular/cdk markdown-it` (and `@angular/platform-browser`, usually present) |
| `angular-assistant-ui/markdown` | Streaming markdown (`aui-markdown-text`) | `markdown-it` (and `@angular/platform-browser`) |
| `angular-assistant-ui/shiki` | `provideShikiHighlighter()` for code blocks | `shiki` |
| `angular-assistant-ui/mastra` | `MastraThreads`, transport, thread list, history, `MASTRA_AUTH` | `ai @ai-sdk/react @assistant-ui/ai-sdk@0.0.18 assistant-stream` |
| `angular-assistant-ui/testing` | `createScriptedChatTransport` and scripted turn, attachment and thread-list helpers, `createMockMastraServer` | `ai` |
| `angular-assistant-ui/react-interop` | `Tools`, `Interactables` and `unstable_Interactables` scope resources | nothing more (`react`, with `react/jsx-runtime` covered by any alias) |

`@assistant-ui/ai-sdk` is pinned to `0.0.18` because the mastra entry vendors code from it.

### The `react` requirement

`@assistant-ui/ai-sdk` imports `react` at runtime, so `react` must be installed even
though React renders nothing in an Angular app. To avoid shipping React, alias `react`
to `@assistant-ui/tap/standalone-shim` in your bundler (and `paths` in `tsconfig.json`
if you type-check against it).

The main entry never imports core's React barrel (`@assistant-ui/core/react`). It does
still load `@assistant-ui/tap/react-shim`, which imports `react` (the same shim
`@assistant-ui/core/store` uses), so the requirement above applies to every runtime, not
only the AI SDK one.

The scope resources that core ships only in that barrel (`Tools`, `Interactables` and
`unstable_Interactables`) are exported from the secondary entry
`angular-assistant-ui/react-interop`. Use it for `AuiConfig({ unstable_interactables:
unstable_Interactables() })`. It additionally imports `react/jsx-runtime`, so an alias
must cover every `react/*` subpath (for example `paths: { "react/*": [...] }`), not only
`react`.

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

### Components chosen at run time

Inside a scoped template (`ng-template auiPart`, `ng-template auiEditComposer`, an
`auiMessage` template), render a component chosen at run time with
`[auiComponentOutlet]` instead of `*ngComponentOutlet`. A component created by
`*ngComponentOutlet` there resolves the scope of the template's declaration site (the
message instead of the part, the thread composer instead of the edit composer).

```html
<ng-template auiPart="text">
  <ng-container [auiComponentOutlet]="textRenderer" [auiComponentOutletInputs]="{ dense: true }" />
</ng-template>
```

In an `auiPart="tool-call"` template of `aui-message-grouped-parts` (where the template
wins over registered tool UIs), `<aui-tool-ui-outlet [fallback]="MyToolFallback" />`
renders the registered tool UI and the fallback only for tools without one.

### Styled kit

The `angular-assistant-ui/ui` entry is a styled kit. `@angular/cdk` is for overlays and focus;
`markdown-it` and `@angular/platform-browser` are there because the thread renders assistant text
through the `angular-assistant-ui/markdown` entry. Import the stylesheet once, for example in
`angular.json` `styles` or with `@import 'angular-assistant-ui/ui/styles.css';`. Then place the
components under a provider that has a height:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AISDKThreads } from '@assistant-ui/ai-sdk';
import { AuiConfig, AuiProviderDirective } from 'angular-assistant-ui';
import { AuiThreadComponent, AuiThreadListComponent } from 'angular-assistant-ui/ui';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [AuiProviderDirective, AuiThreadListComponent, AuiThreadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [auiProvider]="config" style="display: flex; height: 100dvh">
    <aui-thread-list style="width: 260px" />
    <aui-thread style="flex: 1; min-width: 0" />
  </div>`,
})
export class ChatComponent {
  // An in-memory thread list with one AI SDK chat per thread.
  protected readonly config = AuiConfig({ threads: AISDKThreads() });
}
```

| Component | What |
| --- | --- |
| `aui-thread` | The full thread: welcome, messages with markdown, tool groups and the tool fallback, reasoning, attachments, edit and branch picker, action bars, follow-ups, and the composer with attachments |
| `aui-thread-list` | New Thread, search, threads grouped by date, rename, archive and delete, and an archived section |
| `aui-thread-list-sidebar` | A collapsible sidebar around the thread list that becomes a drawer on narrow screens |
| `aui-assistant-modal` | A floating launcher button that opens the thread in a popover panel |
| `aui-tool-fallback` | The UI for tool calls without a registered one: arguments, result, the approval card and its receipt, and the ask-user answer form |
| `aui-composer-attachments-styled`, `aui-composer-add-attachment-styled`, `aui-message-attachments-styled` | Attachment tiles and the attach button (`aui-thread` renders them by default) |

To replace sections of `aui-thread`, provide `AUI_THREAD_COMPONENTS` with any of `UserMessage`,
`AssistantMessage`, `EditComposer`, `Composer`, `Welcome`, `ToolFallback`, `Text`, `Reasoning`,
`ToolGroup`, `ReasoningGroup`, `UserMessageAttachments`, `ComposerAttachments` and
`ComposerAddAttachment`. Theming (tokens, `.aui-dark`, class overrides, Tailwind) is in
[docs/styling.md](../../docs/styling.md); the Mastra server and the `mastra` entry are in
[docs/mastra.md](../../docs/mastra.md).

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
| `registerToolUI`, `ToolUIComponent`, `ToolUIProps`, `DataUIProps`, `AuiToolUIOutletComponent`                        | Tool UIs              |
| `AuiComponentOutletDirective` (`[auiComponentOutlet]`)                                                              | Scope-safe rendering  |
| `AuiConfig`, `Derived`, `createAssistantClient` and the `Assistant*` types and `Unsubscribe`                        | Re-exported store API |

From `angular-assistant-ui/testing` (needs the `ai` package):

- `createScriptedChatTransport(script)` and `ScriptedTurn`: an AI SDK `ChatTransport`
  that answers sends from a script, for tests and offline demos.
- Turn builders for the script: `scriptedTextTurn`, `scriptedApprovalTurn` (a tool call waiting
  for approval), `scriptedToolOutputTurn` (the continuation after an answer) and
  `scriptedAskUserTurn` (an `askUser` client tool call). `toolApprovalOf`, `askUserAnswerOf` and
  `findToolPart` read the user's answer from the messages a resubmit sends.
- `createScriptedAttachmentAdapter(options)` and `scriptedFile(name, content)`: an offline
  attachment adapter (deterministic ids, scripted rejections, upload progress and failed sends) and
  test files.
- `createScriptedThreadListAdapter(options)`: a seeded in-memory thread-list adapter with scripted
  titles, a call log and one-shot failures.
- `createMockMastraServer(options)`: an in-memory fake of the Mastra server contract
  (chat, history and memory thread routes) behind `fetch`, for testing the `mastra` entry.

```ts
import { AISDKChat } from '@assistant-ui/ai-sdk';
import { lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai';
import { AuiConfig } from 'angular-assistant-ui';
import {
  createScriptedAttachmentAdapter,
  createScriptedChatTransport,
  scriptedApprovalTurn,
  scriptedTextTurn,
  scriptedToolOutputTurn,
  toolApprovalOf,
} from 'angular-assistant-ui/testing';

const transport = createScriptedChatTransport((messages) => {
  const approval = toolApprovalOf(messages, 'call-1');
  if (!approval) {
    return scriptedApprovalTurn({ toolCallId: 'call-1', toolName: 'bookMeeting', input: {} });
  }
  return approval.approved
    ? scriptedToolOutputTurn({ toolCallId: 'call-1', output: { confirmed: true }, text: 'Booked.' })
    : scriptedTextTurn('Not booked.');
});

export const config = AuiConfig({
  threads: AISDKChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    adapters: { attachments: createScriptedAttachmentAdapter() },
  }),
});
```

The compat apps (`compat/ng*/src/app/app.ts`) use these helpers for text, markdown, approval,
ask-user and attachment scenarios.

See [docs/porting.md](../../docs/porting.md) for the upstream parity table.

## Supported versions

<!-- compat-table -->

| Angular | Change detection | Status |
| ------- | ---------------- | ------ |
| 18.2 | Zone.js | Verified: demo app, live end-to-end smoke (Mastra, OpenRouter model, tool call, streamed text), and the compatibility matrix (core 18.2.14, CDK 18.2) |
| 20 | Zone.js | Verified by the compatibility matrix (core 20.3.35, CDK 20.2) |
| 22 | Zoneless | Verified by the compatibility matrix (core 22.2.6, CDK 22.2, `provideZonelessChangeDetection()`, Node 24.15) |

The compatibility matrix (`npm run compat -- <ng18|ng20|ng22>`, and the `compat` CI job) packs the
library and checks that the tarball carries every secondary entry, `ui/styles.css`, `LICENSE` and
`NOTICE`, then installs it into a fresh app per version, builds it and runs a browser smoke test. The
three apps share one source file (`src/app/app.ts`) and differ only in their bootstrap. Each renders
`aui-thread-list` beside `aui-thread` over an in-memory thread list (`AISDKThreads`) and the scripted
(offline) transport. The smoke test checks that `styles.css` loads (the `--aui-background` token
resolves), a streamed reply, markdown bold and a code block, a registered tool UI updated in place, Send
and Stop swapping and cancelling a run, editing a message (branch picker `2 / 2`, then `1 / 2` after
Previous), an attachment tile after choosing a file, approving a tool call (the receipt renders), and
creating and switching threads in the thread list. Angular 22's CLI requires Node `^22.22.3`,
`^24.15.0` or `>=26`.

<!-- compat-table -->

## Build and test

`npm run build:lib` writes to `dist/assistant-ui-angular`. `npm run test:lib` runs the
specs with [Vitest](https://vitest.dev) in two projects: `zone` (Zone.js change
detection) and `zoneless` (`provideExperimentalZonelessChangeDetection()`).
