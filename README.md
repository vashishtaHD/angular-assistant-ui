<img src="assets/icon.svg" width="64" height="64" alt="">

# angular-assistant-ui

<p>
  <a href="https://www.npmjs.com/package/angular-assistant-ui"><img src="https://img.shields.io/npm/v/angular-assistant-ui" alt="npm version"></a>
  <a href="https://github.com/vashishtaHD/angular-assistant-ui/actions/workflows/ci.yml"><img src="https://github.com/vashishtaHD/angular-assistant-ui/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/github/license/vashishtaHD/angular-assistant-ui" alt="MIT license">
  <img src="https://img.shields.io/badge/Angular-18.2%20%E2%80%93%2022-dd0031" alt="Angular 18.2 to 22">
  <img src="https://img.shields.io/badge/Zone.js%20%26%20zoneless-supported-1f6feb" alt="Zone.js and zoneless">
</p>

## The UX of ChatGPT in your Angular app

**angular-assistant-ui** is an Angular port of [assistant-ui](https://github.com/assistant-ui/assistant-ui).
It gives you production-grade AI chat in Angular 18.2 to 22, with Zone.js or zoneless. It runs on
upstream's framework-agnostic packages (`@assistant-ui/core`, `store` and `tap`), so state, runtimes and
behaviour match assistant-ui. The Angular layer is directives, components and DI.

It ships:

- a headless primitives entry, for building any chat UX with your own markup;
- a styled kit that is ready to drop in;
- first-class [Mastra](https://mastra.ai) support, with a reference server in this repo.

## What you get

- **A styled kit.** `aui-thread`, `aui-thread-list`, `aui-thread-list-sidebar` and
  `aui-assistant-modal` are drop-in components: one stylesheet, CSS tokens, dark mode.
- **Composable primitives.** Thread, message, composer, action bar, branch picker, attachments, thread list,
  suggestions, menus and more, as unstyled directives you place on your own elements.
- **Production chat UX.** Streaming, auto-scroll, stop and retry, edit with branches, attachments,
  markdown, code highlighting (Shiki), keyboard handling and accessibility.
- **Generative UI.** Render tool calls as your own components, approve tool calls inline and
  answer ask-user questions. Tools without a component get a fallback card.
- **Mastra.** Persistent threads and history, an auth token hook and per-user memory, with a reference
  server.
- **Testable.** The `testing` entry has a scripted (offline) chat transport, scenario helpers and a mock
  Mastra server.

## Installation

Install the package with the peers for the styled kit and the AI SDK runtime:

```bash
npm install angular-assistant-ui \
  @assistant-ui/core@~0.3.36 @assistant-ui/store@~0.3.23 @assistant-ui/tap@~0.9.26 \
  @assistant-ui/ai-sdk@0.0.18 ai react @angular/cdk markdown-it
npm install --save-dev @types/react
```

`react` is needed at run time even though React renders nothing: `@assistant-ui/ai-sdk` imports it.
Add it to `allowedCommonJsDependencies` in `angular.json` to silence the CommonJS warning. To keep
React out of the bundle entirely, see [the `react` requirement](projects/assistant-ui-angular/README.md#the-react-requirement).
Angular 18 projects need `skipLibCheck: true`, which new projects have by default. Each entry point's
peers are listed under [Entry points](#entry-points).

### From source

```bash
git clone https://github.com/vashishtaHD/angular-assistant-ui.git
cd angular-assistant-ui
npm ci
npm run build:lib
npm pack ./dist/assistant-ui-angular      # writes angular-assistant-ui-<version>.tgz
```

Then install that tarball in your app (`npm install /path/to/angular-assistant-ui-<version>.tgz`) with
the same peers.

## Usage

### 1. Load the stylesheet once

Add it in `angular.json`, under `"styles"`, or in your global stylesheet:

```css
@import 'angular-assistant-ui/ui/styles.css';
```

### 2. Drop in a chat

This is a thread list beside a thread, talking to any [AI SDK](https://ai-sdk.dev) chat endpoint:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AISDKThreads, AssistantChatTransport } from '@assistant-ui/ai-sdk';
import { AuiConfig, AuiProviderDirective } from 'angular-assistant-ui';
import { AuiThreadComponent, AuiThreadListComponent } from 'angular-assistant-ui/ui';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [AuiProviderDirective, AuiThreadListComponent, AuiThreadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [auiProvider]="config" style="display: flex; height: 100dvh">
      <aui-thread-list style="width: 260px" />
      <aui-thread style="flex: 1; min-width: 0" />
    </div>
  `,
})
export class ChatComponent {
  protected readonly config = AuiConfig({
    threads: AISDKThreads({
      transport: () => new AssistantChatTransport({ api: '/api/chat' }),
    }),
  });
}
```

`AISDKThreads` keeps the thread list in memory and runs one AI SDK chat per thread. `AISDKChat` is the
single-thread version. For persistent threads, use Mastra (below) or a remote thread-list adapter.

### 3. Optional: highlight code blocks

```bash
npm install shiki
```

```ts
import type { ApplicationConfig } from '@angular/core';
import { provideShikiHighlighter } from 'angular-assistant-ui/shiki';

// Passed to bootstrapApplication(AppComponent, appConfig).
export const appConfig: ApplicationConfig = { providers: [provideShikiHighlighter()] };
```

### With Mastra

Run the reference server from this repo, or point the client at your own Mastra server that exposes the
same routes. See [docs/mastra.md](docs/mastra.md).

```bash
npm install @ai-sdk/react assistant-stream   # in addition to the peers above
```

```ts
import { ChangeDetectionStrategy, Component, type ApplicationConfig } from '@angular/core';
import { AuiConfig, AuiProviderDirective } from 'angular-assistant-ui';
import {
  MASTRA_AUTH,
  MastraThreads,
  createMastraTransport,
  mastraThreadListAdapter,
} from 'angular-assistant-ui/mastra';
import { AuiThreadComponent, AuiThreadListComponent } from 'angular-assistant-ui/ui';

const api = 'http://localhost:4111';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [AuiProviderDirective, AuiThreadListComponent, AuiThreadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [auiProvider]="config" style="display: flex; height: 100dvh">
      <aui-thread-list style="width: 260px" />
      <aui-thread style="flex: 1; min-width: 0" />
    </div>
  `,
})
export class ChatComponent {
  // A field initializer is an injection context, so the transports find MASTRA_AUTH.
  protected readonly config = AuiConfig({
    threads: MastraThreads({
      adapter: mastraThreadListAdapter({ baseUrl: api, agentId: 'chatAgent' }),
      transport: () => createMastraTransport({ api, agentId: 'chatAgent' }),
    }),
  });
}

// When the server runs with token auth (`MASTRA_AUTH_MODE=jwt`), send the user's token.
const getToken = () => sessionStorage.getItem('token') ?? '';

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: MASTRA_AUTH,
      useValue: { getHeaders: () => ({ Authorization: `Bearer ${getToken()}` }) },
    },
  ],
};
```

Threads, titles and history are stored by Mastra memory per user, and switching threads loads their
history. The server stores the branch that was last sent; other branches stay in the browser for the
session (see [docs/mastra.md](docs/mastra.md)).

### Render a tool call as your own component

```ts
import { ChangeDetectionStrategy, Component, Directive, input } from '@angular/core';
import { registerToolUI, type ToolUIComponent, type ToolUIProps } from 'angular-assistant-ui';

@Component({
  selector: 'app-weather-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p>Weather: {{ $any(tool().part.args)?.city }}</p>`,
})
export class WeatherCardComponent implements ToolUIComponent {
  readonly tool = input.required<ToolUIProps>();
}

/** Put it on an element under [auiProvider], e.g. <aui-thread appChatTools />. */
@Directive({ selector: '[appChatTools]', standalone: true })
export class ChatToolsDirective {
  constructor() {
    registerToolUI('getWeather', WeatherCardComponent);
  }
}
```

Tools without a registered UI fall back to `aui-tool-fallback`. It shows the arguments and the result,
an approval card for tools that need approval, and an answer form for ask-user tools.

## Entry points

| Import from | What it gives you | Extra peers |
| --- | --- | --- |
| `angular-assistant-ui` | Headless primitives, `[auiProvider]`, `injectAuiState`, `registerToolUI`, runtimes | `@assistant-ui/ai-sdk ai` for the AI SDK runtime |
| `angular-assistant-ui/ui` | Styled kit and `ui/styles.css` | `@angular/cdk markdown-it` |
| `angular-assistant-ui/markdown` | Streaming markdown (`aui-markdown-text`) | `markdown-it` |
| `angular-assistant-ui/shiki` | `provideShikiHighlighter()` | `shiki markdown-it` |
| `angular-assistant-ui/mastra` | `MastraThreads`, transport, thread list, history, `MASTRA_AUTH` | `ai @ai-sdk/react @assistant-ui/ai-sdk@0.0.18 assistant-stream` |
| `angular-assistant-ui/testing` | Scripted transport, scenario helpers, mock Mastra server | `ai` |
| `angular-assistant-ui/react-interop` | `Tools`, `Interactables` scope resources | none |

The full library guide covers the headless primitives, reading state, tool UIs, the slots in
`AUI_THREAD_COMPONENTS` and the API table:
[projects/assistant-ui-angular/README.md](projects/assistant-ui-angular/README.md).

## Backends

| Backend | Use |
| --- | --- |
| Any AI SDK endpoint (`streamText(...).toUIMessageStreamResponse()`) | `AISDKThreads` / `AISDKChat` with `AssistantChatTransport` |
| Mastra | `MastraThreads` from `angular-assistant-ui/mastra` |
| A custom streaming backend | `createAssistantTransportRuntime` from the main entry |
| Tests and offline demos | `createScriptedChatTransport` from `angular-assistant-ui/testing` |

Any model the AI SDK or Mastra supports works: OpenAI, Anthropic, Google, OpenRouter and others.

## Customization

- **Theme.** CSS tokens such as `--aui-background` and `--aui-primary`. Dark mode follows the OS by
  default, and `.aui-dark` or `.aui-light` forces one. Override the `aui-*` classes, or map the tokens
  into Tailwind. See [docs/styling.md](docs/styling.md).
- **Replace parts of the thread.** Provide `AUI_THREAD_COMPONENTS` with your own `UserMessage`,
  `AssistantMessage`, `Composer`, `Welcome`, `ToolFallback`, `Reasoning`, attachments and more.
- **Go fully headless.** Compose the primitives (`auiThreadRoot`, `auiThreadViewport`, `aui-thread-messages`,
  `auiComposerInput` and the rest) with your own markup and CSS.

## Supported versions

| Angular | Change detection | Verified by |
| --- | --- | --- |
| 18.2 | Zone.js | The compat matrix, plus a live end-to-end smoke test against Mastra and a real model |
| 20 | Zone.js | The compat matrix |
| 22 | Zoneless | The compat matrix (Node `^22.22.3`, `^24.15.0` or `>=26`) |

The compat matrix (`npm run compat -- ng18|ng20|ng22`) packs the library, installs it into a fresh app for
each Angular version, builds that app and runs a browser smoke test. The test covers the stylesheet,
streaming, markdown, tool UIs, Send and Stop, edit and branches, attachments, approvals, ask-user and
the thread list.

## Try the demo

The demo is a full chat app: sidebar, threads, markdown with Shiki, approvals, ask-user, attachments,
a weather tool card and dark mode. It runs against the reference Mastra server.

```bash
npm ci
cp mastra-server/.env.example mastra-server/.env   # dev auth is preset; add a provider key
npm run dev                                        # Mastra on :4111, the demo on :4200
```

For the provider key, set either `OPENAI_API_KEY` with the default model, or `OPENROUTER_API_KEY` with
`MASTRA_MODEL=openrouter/<vendor>/<model>`. Then ask "What's the weather in Paris?" or "Book a meeting
tomorrow at 3pm". [docs/deployment.md](docs/deployment.md) covers hosting, CORS and runtime config.

## Docs

| Doc | Covers |
| --- | --- |
| [Library guide](projects/assistant-ui-angular/README.md) | Install per entry, headless usage, tool UIs, the styled kit, API |
| [docs/styling.md](docs/styling.md) | Tokens, dark mode, overriding classes, Tailwind |
| [docs/mastra.md](docs/mastra.md) | Server setup, auth modes, memory, branches, attachments, approvals, ask-user |
| [docs/deployment.md](docs/deployment.md) | Hosting, CORS, runtime config, gating the chat route |
| [docs/porting.md](docs/porting.md) | Upstream parity table and how to port a primitive |

## Development

Node `>=22.13` (see `.nvmrc`). Run `npm ci` once.

| Script | Does |
| --- | --- |
| `npm run dev` | Build the library, then run Mastra and the demo |
| `npm test` | Library (zone and zoneless), demo and Mastra tests |
| `npm run build:lib` | Build the library to `dist/assistant-ui-angular` |
| `npm run lint` / `npm run format:check` | ESLint and Prettier |
| `npm run check:parity` | Fail on any upstream parity row that is not ported or n/a |
| `npm run compat -- ng18` | Compat smoke test for one Angular major (`ng20`, `ng22`) |

| Path | What |
| --- | --- |
| `projects/assistant-ui-angular` | The library and its secondary entries |
| `projects/demo` | The demo chat app |
| `mastra-server` | The reference Mastra server |
| `compat/` | Angular 18.2, 20 and 22 consumer apps and their smoke test |

New primitives are ported from upstream. Follow the checklist in [docs/porting.md](docs/porting.md).
Keep library code to Angular 18.2 APIs, and make the tests pass in both change-detection modes.
[CONTRIBUTING.md](CONTRIBUTING.md) has every script and check, and how releases happen. Changes are
listed in [CHANGELOG.md](CHANGELOG.md); report vulnerabilities as [SECURITY.md](SECURITY.md) describes.

## License

MIT. See `LICENSE` and `NOTICE`. Built on [assistant-ui](https://github.com/assistant-ui/assistant-ui),
MIT, by the assistant-ui authors. This is an independent community port.

Created in [T3 Code](https://t3.codes).
