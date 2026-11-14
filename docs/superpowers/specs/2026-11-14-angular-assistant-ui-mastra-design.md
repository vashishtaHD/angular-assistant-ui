# Angular assistant-ui + Mastra — Design

Date: 2026-11-14
Status: Draft, awaiting approval

## 1. Intent

Port [assistant-ui](https://github.com/assistant-ui/assistant-ui) to Angular so an Angular app can have a production-grade streaming AI chat, backed by a [Mastra](https://mastra.ai) agent. The code will run in production and may be published or forked for others to use, so it is built as a proper reusable library with Angular best practices, not as app-specific chat code.

Scope grows incrementally: first ship what a single chat screen needs, then port further primitives over time.

## 2. Key findings that shape the design

- Upstream splits into a framework-agnostic runtime (`@assistant-ui/core`, `@assistant-ui/store`, `@assistant-ui/tap`) and thin per-framework bindings. Official **Vue** (`packages/vue`, ~67 files) and **Svelte** (~35 files) bindings already exist on npm. The Angular port is a third binding of the same shape; the Vue binding is the reference implementation to port from, file by file.
- Mastra has **no dedicated assistant-ui adapter**; it integrates through the AI SDK path. Mastra server exposes `chatRoute({ path: "/chat/:agentId", version: "v7" })` from `@mastra/ai-sdk`; the client uses `AISDKChat({ transport })` from `@assistant-ui/ai-sdk`, pointed at that URL.
- `@assistant-ui/ai-sdk` runs on tap's React shim, so `react` must be installed as a dependency even though React renders nothing. The Vue binding accepts the same constraint.
- Upstream's "full-stack" Mastra pattern assumes Next.js API routes. For Angular, the "separate server" pattern applies directly.

Versions at time of writing (npm): `@angular/core` 22.2.x, `@assistant-ui/core` 0.3.36, `@assistant-ui/store` 0.3.23, `@assistant-ui/tap` 0.9.26, `@assistant-ui/ai-sdk` 0.0.18, `@assistant-ui/vue` 0.0.7, `@mastra/core` 1.83.x, `@mastra/ai-sdk` 1.12.x, `ai` 7.0.x, Node 24.

## 3. Goals, non-goals, anti-goals

**Goals (phase 1 / MVP)**
- An Angular library exposing: a provider, state/event injection helpers (signals-based), and headless primitives sufficient for one chat: thread viewport, message list, message, message parts (text + tool-call), composer input/send/cancel, and a conditional (`auiIf`) directive.
- A demo Angular app with a styled chat screen using the library.
- A Mastra server with one agent (with one simple tool, so tool-call rendering is exercised) exposed via `chatRoute`.
- Tests, lint, build and CI at production quality.

**Non-goals for phase 1** (later phases, ported from the Vue binding one area at a time)
- Action bar (copy/reload/edit), branch picker, message editing.
- Attachments (composer and message), dropzone.
- Thread list / multi-thread, Assistant Cloud, persistence/history.
- Suggestions, chain-of-thought, error primitive, scroll-to-bottom button, viewport footer.
- Markdown rendering of text parts (phase 2; phase 1 renders plain text with preserved whitespace, and the text part is overridable by template so apps can plug in a renderer).
- SSR/hydration of the chat itself (provider is browser-only in phase 1, as Vue documents for Nuxt).

**Anti-goals** (a failure even if it works)
- Reimplementing runtime/chat logic in Angular. All behaviour comes from upstream packages; the binding only adapts state and rendering.
- React rendering anything, or the library's own API signatures being written in React types (upstream types re-exported as-is may reference them; see 7.1).
- NgModules, Zone.js dependence, `any`-typed public surface, or patterns that break in zoneless apps.
- An API so Angular-idiosyncratic that porting the next Vue file stops being mechanical.

## 4. Constraints

- **Supported Angular: 18.2 through 22, with Zone.js and zoneless** (decided by user: "18+"). The first production consumer is on Angular 18.2.13 with Zone.js, so that combination is a first-class target, not a compatibility afterthought.
  - The library is **built with the Angular 18.2 toolchain** (ng-packagr 18, TypeScript 5.5). Partially compiled libraries are forward-compatible with newer Angular linkers, not backward-compatible, so building on the floor version is what makes 18–22 work. Peer range: `>=18.2.0 <23.0.0`, raised as new majors pass CI.
  - Only APIs that exist and are stable in 18.2 are used: signals, `computed`, `input()`/`input.required()`/`output()`/`model()`, `inject()`, `DestroyRef`, `afterNextRender`, `@if`/`@for`/`@let`, `NgComponentOutlet` with `ngComponentOutletInputs`. Not used: `linkedSignal`, `resource`, `provideAppInitializer` (19+). **`effect()` is avoided in library code** because its timing semantics changed between 18 and 19; state flows through store subscriptions → signals → `computed` instead.
  - Verified (2026-11-14): upstream packages type-check under TypeScript 5.5 with `skipLibCheck: true` (Angular's default). Without it, some `Uint8Array<…>` generics in `ai` / `assistant-stream` require TS ≥ 5.7; none are on the binding's surface. The README states `skipLibCheck: true` as a requirement for Angular 18.
  - Toolchain Node version pinned to 22 (`.nvmrc` / `engines`), the newest Node Angular 18 supports.
- Standalone only, signals for state, `ChangeDetectionStrategy.OnPush` on every component, works under both Zone.js and zoneless change detection.
- TypeScript `strict` plus Angular `strictTemplates`; no `any` in public API.
- Library built with ng-packagr (Angular Package Format), published-ready, tree-shakeable, `sideEffects: false`.
- Lint: angular-eslint + typescript-eslint; Prettier formatting. Angular style guide naming (`aui` selector prefix for library, `app` for demo).
- Tests: Vitest via `@analogjs/vitest-angular` (builder's call: Angular 18's default Karma is deprecated, and the CLI's built-in Vitest runner only exists from 21).
- License: MIT. Code ported from upstream Vue binding is a derivative work; keep upstream's copyright notice in `LICENSE` / `NOTICE` alongside ours.
- Never attribute commits/PRs to Claude/Anthropic (user instruction).

## 5. Approaches considered

| Approach | Trade-off | Decision |
| --- | --- | --- |
| **A. Thin Angular binding over upstream npm packages, modelled on the Vue binding** | Upstream owns all logic and fixes; growth is porting one Vue file at a time. Cost: `react` in `node_modules` via `@assistant-ui/ai-sdk`. | **Chosen** (by user) — fits "start small, expand", production use, and forkability. |
| B. Vendor upstream source into the repo and adapt | Full control, could remove the react dep, but we own ~500 files of core logic and drift on every upstream release. | Rejected. |
| C. Skip assistant-ui; build on the AI SDK's Angular `Chat` class | Smallest/fastest, but not a port: no path to branching, thread lists, tool UI registry, or upstream parity. | Rejected. |

## 6. Repository layout (decided as builder's call, stated to user)

npm workspaces monorepo, Angular CLI workspace at the root:

```
/                         Angular workspace (angular.json), root package.json with workspaces
projects/
  assistant-ui-angular/   the library (ng-packagr)
  demo/                   demo Angular app, styled chat
mastra-server/            standalone Mastra project (own package.json, .env), port 4111
docs/                     specs, plans, porting notes, parity table
.github/workflows/ci.yml  lint, test, build for library + demo + mastra-server typecheck
```

Package name for the library: placeholder `angular-assistant-ui` (unscoped) until the user picks a published name/scope.

## 7. Library design

### 7.1 Dependencies
- `peerDependencies`: `@angular/core`, `@angular/common` (`>=18.2.0 <23.0.0`), `@assistant-ui/core`, `@assistant-ui/store`, `@assistant-ui/tap` (tilde-pinned to the minor versions above — these are 0.x and break across minors). *Builder's call, deliberate departure from Vue*, which lists the upstream packages as regular `dependencies`: peers guarantee a single copy of the store/runtime in the consumer's app, which matters because the runtime relies on shared module identity.
- `@types/react` is a required peer (as in `@assistant-ui/vue`). Upstream's type graph needs it: the `tools` scope type lives in `@assistant-ui/core/react` and `setToolUI` is typed against React's `ToolCallMessagePartComponent`. Following Vue, the library bridges that seam with casts at tool-UI registration and render, and exposes only Angular-facing types (`ToolUIProps`, `Type<unknown>` components) in its own signatures. React types may appear transitively through re-exported upstream types; that is accepted.
- At runtime the upstream runtime adapter mounts `Tools({})` from `core/react`, which imports `react`. Consumers therefore either install `react` (automatic when using `@assistant-ui/ai-sdk`) or alias `react` to `@assistant-ui/tap/standalone-shim`, exactly as the Vue README documents. The library README states this; the library's own tests use the same setup as the demo.
- `@assistant-ui/ai-sdk`, `ai`, `react` are **not** dependencies of the library; they are the app's runtime choice (the demo installs them). The library must compile and be usable with any `AuiConfig` threads source.

### 7.2 Core bridge (port of `context.ts`, `AuiProvider.ts`, `useAui.ts`, `useAuiState.ts`, `useAuiEvent.ts`)
- `AUI_CONTEXT`: `InjectionToken<AuiContext>` where `AuiContext = { source: AssistantClientSource; aui: AssistantClient }`. Default (no provider) mirrors Vue: `DefaultAssistantClient` with a no-op subscribe.
- `AuiProviderDirective` — selector `[auiProvider]`, input `config: AuiConfig` (required), optional `extends: AssistantClient | null` with the same parent/isolation rule and dev error as Vue. Creates the client with `createAssistantClient`, provides `AUI_CONTEXT` to its subtree via the directive's `providers`, updates element args in place when `config` changes, and disposes on `DestroyRef`. A directive (not a wrapper component) so it adds no DOM.
- `injectAui(): AssistantClient` — stable client facade (`createClientFacade`) resolving to the nearest provider's current client.
- `injectAuiState<T>(selector): Signal<T>` — subscribes to `source`, bumps a version signal on every store update, returns `computed(() => selector(getProxiedAssistantState(client)))` with `Object.is` equality; throws on returning the whole state like Vue; unsubscribes via `DestroyRef`. Must be called in an injection context (documented, asserted with `assertInInjectionContext`).
- `injectAuiEvent(event, callback)` — subscription for the lifetime of the current injection context.
- All of these must work under both Zone.js and zoneless change detection: signal writes from the store subscription are what schedule rendering (Angular marks OnPush views reading a changed signal for check in both modes). Store updates arriving from stream callbacks outside the Angular zone must still render under Zone.js; this is an explicit test case.

### 7.3 Scope providers (port of `MessageByIdProvider`, `PartByIndexProvider`, `lastValidCache`, `stableKeys`)
Internal directives that re-provide `AUI_CONTEXT` for a child scope (`message` by id, `part` by index), deriving the child client with `Derived` / `AuiConfig` exactly as the Vue versions do, including the last-valid cache and stale reporting.

### 7.4 Primitives (phase 1)
Headless: no styles, expose state via `data-*` attributes on host elements where upstream does (e.g. `data-role`, `data-status`), so apps style with CSS/Tailwind.

| Upstream (Vue) | Angular | Form |
| --- | --- | --- |
| `ThreadPrimitiveRoot` / `Viewport` | `[auiThreadRoot]`, `[auiThreadViewport]` | attribute directives (viewport includes autoscroll / scroll lock from `useScrollLock`) |
| `ThreadPrimitiveMessages` | `<aui-thread-messages>` + `<ng-template auiMessage>` | component iterating message ids with `@for (id; track id)`, each row wrapped in the message scope provider, rendering the projected template |
| `MessagePrimitiveRoot` | `[auiMessageRoot]` | attribute directive, `data-role` |
| `MessagePrimitiveParts` | `<aui-message-parts>` + `<ng-template auiPart="text|tool-call|reasoning|…">` | per-type template override; text falls back to plain text; tool-call first resolves a registered tool UI |
| tool UI registry (`aui.tools.setToolUI`) | Angular component types rendered via `NgComponentOutlet`, receiving one `tool` input of type `ToolUIProps` (same contract as Vue) | helper `provideToolUI(name, Component)` / `registerToolUI` |
| `ComposerPrimitiveRoot` | `form[auiComposerRoot]` | submit → send |
| `ComposerPrimitiveInput` | `textarea[auiComposerInput]` | two-way bound to composer text; Enter sends, Shift+Enter newline, IME-safe; autosize |
| `ComposerPrimitiveSend` / `Cancel` | `button[auiComposerSend]`, `button[auiComposerCancel]` | disabled state from `useComposerSendState` port |
| `AuiIf` | `*auiIf="selector"` | structural directive driven by `injectAuiState` |

Public API is exported from a single `public-api.ts`, with TSDoc on every export.

### 7.5 Porting discipline (for future phases)
- `docs/porting.md`: Vue→Angular translation rules (slot → `ng-template`/content projection, `useX` composable → `injectX`, `onScopeDispose` → `DestroyRef`, `computed`/`shallowRef` → `computed`/`signal`, props → `input()`), and a **parity table** listing every Vue primitive with status (ported / planned / n/a) and the upstream commit it was ported from.
- Ported Vue tests are ported alongside the code where they test behaviour (not Vue specifics).

## 8. Mastra integration

- `mastra-server/` scaffolded per Mastra docs; agent `chatAgent` with instructions and one tool (e.g. `getWeather` or similar deterministic tool) so tool calls stream to the UI.
- `src/mastra/index.ts`: `new Mastra({ agents: { chatAgent }, server: { cors: { origin: FRONTEND_ORIGIN, credentials: true }, apiRoutes: [chatRoute({ path: "/chat/:agentId", version: "v7" })] } })`. `version: "v7"` must match the `ai` major used by the frontend. `:agentId` is the JS key (`chatAgent`).
- Model provider keys in `mastra-server/.env` (gitignored, `.env.example` committed). Model id is configurable via env.
- Demo app: `AISDKChat({ transport: new AssistantChatTransport({ api }) })` (or the transport exported by `@assistant-ui/ai-sdk` at the pinned version), where `api` comes from an injection token `MASTRA_CHAT_URL` populated by **runtime config** (`/config.json` loaded via `APP_INITIALIZER`, which works on 18–22) so one build can target any environment. Dev default `http://localhost:4111/chat/chatAgent`.
- Auth: phase 1 open in dev; the transport's `headers`/`credentials` options are wired through so a production deployment can forward auth. Gating the Mastra route is the deploying app's responsibility and is documented.

## 9. Demo app
- Angular 18.2 with Zone.js (mirrors the first production consumer), standalone, Tailwind CSS v3 (v4 needs newer tooling than Angular 18 ships with; builder's call).
- One page: full-height chat — scrolling message list (user/assistant bubbles), plain-text assistant parts, a styled tool-call card for the demo tool, composer with send/stop, running indicator.
- Not part of the published package.

## 10. Testing and quality
- Library unit tests (Vitest + TestBed): state bridge (subscription, equality, cleanup on destroy, zoneless rendering), provider (config update, extends rule), each primitive's behaviour.
- Integration test: demo-like host component driven by a **fake chat transport** that streams scripted UI-message chunks (text + tool call) — no network or model key needed, runs in CI.
- **Required** smoke test against a real Mastra server before phase 1 is called done (needs a model key; scripted, not in CI). Upstream's Mastra docs only show the React `useChatRuntime` path; `AISDKChat` + `AssistantChatTransport` (which accepts `transport`, `headers`, `credentials` at the pinned version) is verified in source but has no documented Mastra example, so it must be proven end to end.
- CI on GitHub Actions: install, lint, test, build library (Angular 18.2), build demo, typecheck mastra-server.
- **Compatibility matrix job:** the built library tarball is installed into small generated consumer apps on Angular 18.2 (Zone.js), 20 (Zone.js) and 22 (zoneless); each builds and runs the integration test. A version is only "supported" once it passes this job.

## 10a. Deployment
Not in phase 1 (assumed; user did not ask for it). Phase 1 ends with everything verified locally and in CI. Deployment notes (hosting the Mastra server, secrets, production CORS origin, per-environment `/config.json`) are documented for whoever deploys.

## 11. Phasing
1. **Phase 1 (this design):** workspace + tooling + CI, core bridge, phase-1 primitives, tool UI registry, Mastra server, demo, tests, docs (README, porting guide, parity table).
2. Later phases, in suggested order: markdown text rendering; action bar + error primitive; scroll-to-bottom / viewport footer; branch picker + edit; suggestions; attachments; thread list + persistence (Mastra memory / Assistant Cloud); SSR guidance.

## 12. Left to the builder
- Exact file split inside the library and internal naming, within the conventions above.
- Choice of demo tool and agent instructions.
- Autosize and scroll-lock implementation details (port Vue's where possible).
- How the fake transport is built, as long as it exercises text and tool-call streaming.
