# Angular assistant-ui + Mastra — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a headless Angular (18.2–22) binding of assistant-ui sufficient for one streaming chat, a Mastra agent server, and a demo app wiring the two together, at production quality.

**Architecture:** The library is a thin port of upstream `packages/vue` onto Angular DI + signals, over the npm packages `@assistant-ui/core|store|tap`. Each scope (provider, message row, part) owns a child `AssistantClient` created by one shared factory; scoped templates are rendered with `ngTemplateOutlet` + an `Injector` that provides the child context. Mastra runs as a separate server exposing `chatRoute(... version: "v7")`; the demo uses `AISDKChat` + `AssistantChatTransport` from `@assistant-ui/ai-sdk`.

**Tech Stack:** Angular 18.2 toolchain (CLI, ng-packagr, TypeScript 5.5), Vitest + `@analogjs/vitest-angular` + jsdom, angular-eslint, Prettier, Tailwind CSS v3 (demo), Mastra (`@mastra/core` ^1.83, `@mastra/ai-sdk` ^1.12), `ai` ^7, Playwright (compat smoke), GitHub Actions, Node 22.

**Spec:** `docs/superpowers/specs/2026-11-14-angular-assistant-ui-mastra-design.md` — read it before starting any task.

**Upstream reference:** port from `assistant-ui/assistant-ui` `packages/vue/src` at the commit recorded in Task 1 (clone it read-only to a scratch dir; never vendor it). Every ported file starts with a one-line comment `// Ported from packages/vue/src/<path> @ <sha>`.

## Global Constraints

- Supported Angular `>=18.2.0 <23.0.0`, Zone.js and zoneless. Library built with Angular 18.2 toolchain, TypeScript 5.5.
- Only Angular APIs stable in 18.2. Forbidden in library code: `effect()`, `linkedSignal`, `resource`, `provideAppInitializer`, `provideZonelessChangeDetection` (tests on 18 use `provideExperimentalZonelessChangeDetection`).
- Standalone only, `ChangeDetectionStrategy.OnPush` on every component, `inject()` not constructor injection, `input()`/`output()`, `@if`/`@for`, `host: {}` metadata (no `@HostBinding`/`@HostListener`).
- Library selector prefix `aui`; demo prefix `app`. Public API exported only through `projects/assistant-ui-angular/src/public-api.ts`, TSDoc on every export.
- TypeScript `strict`, `strictTemplates`, no `any` in public signatures; `skipLibCheck: true`.
- Peer deps: `@angular/core` and `@angular/common` `>=18.2.0 <23.0.0`; `@assistant-ui/core ~0.3.36`, `@assistant-ui/store ~0.3.23`, `@assistant-ui/tap ~0.9.26`, `@types/react *`. `@assistant-ui/ai-sdk`, `ai`, `react` are NOT library deps.
- Library unit tests alias `react` → `@assistant-ui/tap/standalone-shim` and `react/compiler-runtime` → `@assistant-ui/tap/standalone-shim/compiler-runtime` (as upstream Vue's vitest config).
- Every library behaviour test runs under two Vitest projects: `zone` (Zone.js TestBed) and `zoneless` (`provideExperimentalZonelessChangeDetection()`).
- MIT license with upstream's copyright notice retained in `NOTICE`.
- Commits: conventional-commit style, author is the repo-local git identity. **Never** add Claude/Anthropic attribution (no Co-Authored-By, no "Generated with" lines) in commits, PRs, or comments.
- Node 22 for all tooling (`.nvmrc` = `22`, `engines.node` = `>=20.11 <23`).

## Review Focus

1. **Sending while the assistant is still streaming** — send button disabled, Enter in the input does nothing, no duplicate user message. Test: Task 5 `does not send while running`.
2. **IME composition Enter** (Japanese/Chinese input) must never send. Test: Task 5 `ignores Enter during IME composition`.
3. **Backend unreachable / stream error / CORS failure** — run ends, composer re-enabled, the demo shows an error on the assistant message instead of spinning forever. Test: Task 8 `recovers from transport error`.
4. **Component destroyed mid-stream** (user navigates away) — store listeners released, no errors after destroy. Test: Task 2 `releases subscription on destroy` and Task 8 `destroy while streaming`.
5. **Streaming tokens must not recreate DOM rows** — a message row's element identity is stable across text deltas. Test: Task 3 `keeps row element identity across updates`.

## Execution graph (for parallel subagents)

```
T1 ─┬─ T2 ─┬─ T3 ── T4 ─┐
    │      ├─ T5 ───────┼─ T8 ─┬─ T9
    │      └─ T6 ───────┘      └─ T10
    └─ T7 (Mastra, independent) ┘
```
Each parallel task runs in its own git worktree branched from `main` after its prerequisites are merged; merge back to `main` with a fast-forward or merge commit after review. T1 pre-creates every shared config file (root `package.json` workspaces, `angular.json` projects, `public-api.ts`) so parallel tasks only *append* exports/lines, minimising conflicts.

## File Structure

```
package.json                     npm workspaces: ["projects/*", "mastra-server"]; scripts lint/test/build/compat
angular.json                     projects: assistant-ui-angular (library), demo (application)
tsconfig.json                    strict, strictTemplates, skipLibCheck, paths: angular-assistant-ui → dist
.nvmrc .prettierrc eslint.config.js .gitattributes .gitignore LICENSE NOTICE
.github/workflows/ci.yml         lint, test, build, mastra typecheck, compat matrix
projects/assistant-ui-angular/
  package.json ng-package.json vitest.config.ts src/test-setup.zone.ts src/test-setup.zoneless.ts
  src/public-api.ts
  src/lib/context/aui-context.ts            AUI_CONTEXT, AuiContext, injectAuiContext
  src/lib/context/create-aui-context.ts     createAuiContext (shared by provider + scopes)
  src/lib/provider/aui-provider.directive.ts
  src/lib/state/inject-aui.ts | inject-aui-state.ts | inject-aui-event.ts
  src/lib/aui-if.directive.ts
  src/lib/scope/last-valid-cache.ts | stable-keys.ts | scope-outlet.component.ts
  src/lib/scope/message-scope.ts | part-scope.ts
  src/lib/primitives/thread-root.directive.ts | thread-viewport.directive.ts | viewport-context.ts
  src/lib/primitives/thread-messages.component.ts | message-root.directive.ts
  src/lib/primitives/message-parts.component.ts | part-view.component.ts
  src/lib/primitives/composer-root.directive.ts | composer-input.directive.ts
  src/lib/primitives/composer-send.directive.ts | composer-cancel.directive.ts
  src/lib/tools/tool-ui.ts
  src/lib/**/*.spec.ts, src/testing-internal/ (test runtime helpers, not published)
  testing/  (secondary entry point `angular-assistant-ui/testing`: scripted ChatTransport)
projects/demo/                 Angular 18.2 app (Zone.js), Tailwind v3
mastra-server/                 Mastra project, port 4111
compat/ng18 compat/ng20 compat/ng22  minimal consumer apps + shared Playwright smoke
docs/porting.md docs/deployment.md
```

---

### Task 1: Workspace, tooling, and CI baseline

**Files:**
- Create: everything at repo root listed above except library `src/lib/*`, `demo` app code beyond CLI defaults, `mastra-server/src`, `compat/`.
- Test: `projects/assistant-ui-angular/src/lib/smoke.spec.ts` (deleted in Task 2)

**Interfaces:**
- Produces: npm scripts `lint`, `test` (library + demo + mastra), `build:lib`, `build:demo`, `typecheck:mastra`; Vitest projects `zone` / `zoneless`; empty `public-api.ts`; workspace `mastra-server` with `package.json` stub; `docs/porting.md` with the upstream SHA recorded at top.

- [ ] **Step 1:** Record upstream SHA: `git ls-remote https://github.com/assistant-ui/assistant-ui HEAD` → write it to the top of `docs/porting.md` with the translation rules from spec §7.5 and an empty parity table (rows: every export of upstream `packages/vue/src/index.ts`, status `planned`).
- [ ] **Step 2:** Ensure Node 22 is active (`node -v` → `v22.*`; install via nvm-windows/fnm if not). Scaffold with `npx @angular/cli@18.2 new angular-assistant-ui --directory . --create-application=false --skip-git --strict`, then `ng g library assistant-ui-angular`, `ng g application demo --style=css --routing=false --ssr=false`. Set library `package.json` name `angular-assistant-ui`, version `0.0.0`, `sideEffects: false`, peers exactly per Global Constraints.
- [ ] **Step 3:** Remove Karma; add `vitest`, `@analogjs/vitest-angular`, `@analogjs/vite-plugin-angular`, `jsdom`, `zone.js`. `projects/assistant-ui-angular/vitest.config.ts` defines two projects (`zone` with setup `src/test-setup.zone.ts` importing `zone.js`, `zone.js/testing` and initialising TestBed; `zoneless` with setup that initialises TestBed and whose specs get `provideExperimentalZonelessChangeDetection()` via a shared `configureTestBed()` helper in `src/testing-internal/test-bed.ts`), environment `jsdom`, and the `react` aliases from Global Constraints. Install dev deps `@assistant-ui/core@0.3.36 @assistant-ui/store@0.3.23 @assistant-ui/tap@0.9.26 @types/react`.
- [ ] **Step 4: Write the smoke test** `smoke.spec.ts`: imports `createAssistantClient` from `@assistant-ui/store/client` and asserts `typeof createAssistantClient === "function"`; renders a trivial OnPush standalone component via TestBed and asserts its text.
- [ ] **Step 5:** Run `npm test -w angular-assistant-ui` → PASS in both `zone` and `zoneless` projects.
- [ ] **Step 6:** angular-eslint flat config + Prettier; `npm run lint` → 0 errors. `npm run build:lib` → `dist/assistant-ui-angular` produced, `fesm2022/angular-assistant-ui.mjs` exists.
- [ ] **Step 7:** `LICENSE` (MIT, repo owner), `NOTICE` (upstream MIT text + "Portions ported from assistant-ui, Copyright (c) 2026 AgentbaseAI Inc."), `.nvmrc`, `.gitignore` (node_modules, dist, .env, .angular, coverage). `mastra-server/package.json` stub (`"name": "mastra-server", "private": true`). `.github/workflows/ci.yml`: Node 22, `npm ci`, lint, test, build:lib, build:demo, typecheck:mastra (jobs added later run as no-ops until their tasks land).
- [ ] **Step 8: Commit** `chore: scaffold Angular 18.2 workspace, tooling, and CI`

### Task 2: Core bridge — context, provider, state and event injection

**Files:**
- Create: `src/lib/context/aui-context.ts`, `src/lib/context/create-aui-context.ts`, `src/lib/provider/aui-provider.directive.ts`, `src/lib/state/inject-aui.ts`, `src/lib/state/inject-aui-state.ts`, `src/lib/state/inject-aui-event.ts`, `src/lib/aui-if.directive.ts`, `src/testing-internal/test-runtime.ts`
- Port from: Vue `context.ts`, `AuiProvider.ts`, `useAui.ts`, `useAuiState.ts`, `useAuiEvent.ts`, `AuiIf.ts`, and their tests `__tests__/AuiProvider.test.ts`, `useAuiState`/`AuiIf` tests.
- Test: matching `*.spec.ts` beside each file.

**Interfaces:**
- Produces:
  - `type AuiContext = { source: AssistantClientSource; aui: AssistantClient }`
  - `const AUI_CONTEXT: InjectionToken<AuiContext>`; `injectAuiContext(): AuiContext` (falls back to a default context over `DefaultAssistantClient` with no-op subscribe, like Vue).
  - `createAuiContext(options: { getConfig: () => AuiConfig; subscribe: (listener: () => void) => () => void; parent?: AssistantClientSource }): { context: AuiContext; release: () => void }` — wraps `createAssistantClient` + lifetime `handle.subscribe(() => {})` + `createClientFacade`.
  - `AuiProviderDirective` — selector `[auiProvider]`, `auiProvider = input.required<AuiConfig>()`, `auiProviderExtends = input<AssistantClient | null | undefined>(undefined)`, `providers: [{ provide: AUI_CONTEXT, useFactory: () => inject(AuiProviderDirective).context }]`. Config changes notify the client's subscribe listeners from `ngOnChanges`. Same parent/`extends` resolution and dev error text as Vue (message adapted: `Pass [auiProviderExtends]="aui" to inherit it or [auiProviderExtends]="null" to isolate.`). Release on `DestroyRef`.
  - `injectAui(): AssistantClient`
  - `injectAuiState<T>(selector: (state: AssistantState) => T): Signal<T>` — version signal bumped by `source.subscribe`, `computed` with `Object.is`, throws the Vue error text when the whole state is returned; asserts injection context; unsubscribes on `DestroyRef`.
  - `injectAuiEvent<TEvent extends AssistantEventName>(selector: AssistantEventSelector<TEvent>, callback: AssistantEventCallback<TEvent>): void` — rebinding logic identical to Vue.
  - `AuiIfDirective` — selector `[auiIf]`, structural, `auiIf = input.required<(state: AssistantState) => boolean>()`.
  - `createTestRuntime()` in `testing-internal/test-runtime.ts`: port of the Vue test helper (ExternalStoreRuntimeCore + AssistantRuntimeImpl) returning `{ runtime, config: AuiConfig, append(message), setRunning(value) }` where `config = AuiConfig({ threads: RuntimeAdapter(runtime) })`.

- [ ] **Step 1: Write failing tests** (`inject-aui-state.spec.ts`, `aui-provider.directive.spec.ts`, `inject-aui-event.spec.ts`, `aui-if.directive.spec.ts`):
  - `renders selected state and updates on store change`: host `<div [auiProvider]="config"><span>{{ count() }}</span></div>` with `count = injectAuiState(s => s.thread.messages.length)` in a child component; after `append(...)` and `fixture.detectChanges()/whenStable()`, text goes `0` → `1`.
  - `updates when the store changes outside the Angular zone` (zone project only): perform `append` inside `NgZone.runOutsideAngular`, `fixture.autoDetectChanges()`, `await fixture.whenStable()` → text `1`.
  - `throws when selecting the whole state`: `injectAuiState(s => s)` read → throws `"You tried to return the entire AssistantState. This is not supported due to technical limitations."`.
  - `releases subscription on destroy`: spy on `source.subscribe`'s returned unsubscribe; `fixture.destroy()` → called once; a subsequent `append` throws nothing and logs no error (spy `console.error` not called).
  - `nested provider without extends throws in dev` and `extends null isolates / extends aui inherits` (port Vue AuiProvider tests).
  - `config change updates scopes in place` (port Vue test).
  - `injectAuiEvent fires callback on thread.runStart and stops after destroy`.
  - `auiIf renders only while condition is true` (toggle via `setRunning`).
- [ ] **Step 2:** Run `npm test -w angular-assistant-ui` → FAIL (modules missing).
- [ ] **Step 3:** Implement the files per Interfaces. Delete `smoke.spec.ts`. Export all Produces items (except `createAuiContext`, `injectAuiContext`, test runtime) from `public-api.ts`, plus re-export `AuiConfig`, `Derived`, `createAssistantClient` and the types Vue's `index.ts` re-exports from `@assistant-ui/store/client`.
- [ ] **Step 4:** Run tests → PASS in both projects; `npm run lint` and `npm run build:lib` clean.
- [ ] **Step 5:** Update parity table rows (`AuiProvider`, `AuiIf`, `useAui`, `useAuiState`, `useAuiEvent`) to `ported`. **Commit** `feat(lib): add provider and signal-based state/event bridge`

### Task 3: Scoped rendering — message list, message and thread roots

**Files:**
- Create: `src/lib/scope/last-valid-cache.ts`, `stable-keys.ts`, `scope-outlet.component.ts`, `message-scope.ts`, `part-scope.ts`, `src/lib/primitives/thread-messages.component.ts`, `message-root.directive.ts`, `thread-root.directive.ts`
- Port from: Vue `primitives/lastValidCache.ts`, `stableKeys.ts`, `MessageByIdProvider.ts`, `PartByIndexProvider.ts`, `ThreadPrimitiveMessages.ts`, `message.ts`, `thread.ts`; tests `primitives-keyed-messages.test.ts`, `byindex-shrink-race.test.ts`.

**Interfaces:**
- Consumes: Task 2 `createAuiContext`, `injectAuiContext`, `injectAui`, `injectAuiState`, `createTestRuntime`.
- Produces:
  - `createLastValidCache<T>(reportStale: (() => void) | null)` — upstream neutral cache with `scheduleExpiry = (cb) => queueMicrotask(cb)`.
  - `stableKeys(getKeys: () => string[]): Signal<string[]>` — `computed` whose `equal` treats same-length, same-order arrays as equal.
  - `messageScopeConfig(aui: AssistantClient, id: string, isCurrent: () => boolean): AuiConfig` and `partScopeConfig(aui: AssistantClient, index: number, isCurrent: () => boolean): AuiConfig` — the `AuiConfig({...Derived...})` bodies from the Vue providers.
  - `AuiScopeOutletComponent` (internal, not exported) — selector `aui-scope-outlet`, inputs `config: AuiConfig` (required), `template: TemplateRef<unknown>` (required); creates a child context via `createAuiContext({ parent: injectAuiContext().source, ... })`, builds `Injector.create({ providers: [{ provide: AUI_CONTEXT, useValue: context }], parent: inject(Injector) })`, renders `<ng-container *ngTemplateOutlet="template(); injector: scopeInjector" />`; host `style: display: contents`.
  - `AuiMessageTemplateDirective` — selector `ng-template[auiMessage]`, exposes `templateRef`.
  - `AuiThreadMessagesComponent` — selector `aui-thread-messages`, `contentChild.required(AuiMessageTemplateDirective)`, renders `@for (id of ids(); track id) { <aui-scope-outlet [config]="configFor(id)" [template]="tpl" /> }` with per-id config memoised in a `Map` pruned when ids drop; host `display: contents`.
  - `AuiMessageRootDirective` — selector `[auiMessageRoot]`, host `[attr.data-message-id]`, `[attr.data-role]` (= `s.message.role`), `(mouseenter)`/`(mouseleave)` → `aui.message.setIsHovering`, initial `:hover` check and `setIsHovering(false)` on destroy (as Vue).
  - `AuiThreadRootDirective` — selector `[auiThreadRoot]`, host `(document:keydown.escape)` → stop speaking with Vue's guard and error filter.

- [ ] **Step 1: Write failing tests** (`thread-messages.component.spec.ts`, `message-root.directive.spec.ts`, `thread-root.directive.spec.ts`, `stable-keys.spec.ts`):
  - `renders one row per message in order with role`: template `<aui-thread-messages><ng-template auiMessage><div auiMessageRoot>{{ text() }}</div></ng-template></aui-thread-messages>` where a row child reads `injectAuiState(s => s.message.role)`; after appending user "hi" + assistant "yo" → two rows, `data-role` `user`,`assistant`.
  - `keeps row element identity across updates`: capture the first row's element, append a third message and update an existing message's content → `querySelectorAll('[auiMessageRoot]')[0]` is the same object (`toBe`).
  - `drops the row when its message is removed` without console errors (port shrink-race test).
  - `stableKeys returns the previous array for equal keys`.
  - `mouseenter sets isHovering` and `destroy resets isHovering`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement per Interfaces.
- [ ] **Step 4:** Run → PASS (both projects), lint + build clean.
- [ ] **Step 5:** Export `AuiThreadMessagesComponent`, `AuiMessageTemplateDirective`, `AuiMessageRootDirective`, `AuiThreadRootDirective`; parity rows → `ported`. **Commit** `feat(lib): add scoped message list and roots`

### Task 4: Message parts and tool UI registry

**Files:**
- Create: `src/lib/primitives/message-parts.component.ts`, `part-view.component.ts`, `src/lib/tools/tool-ui.ts`
- Port from: Vue `primitives/MessagePrimitiveParts.ts`; tests `primitives-tool-ui.test.ts`, `MessagePrimitiveParts.tool-interaction.test.ts`, `primitives-content.test.ts` (parts cases).

**Interfaces:**
- Consumes: Task 3 `AuiScopeOutletComponent`, `partScopeConfig`, `stableKeys`; Task 2 state helpers.
- Produces:
  - `type ToolUIProps` — identical fields to Vue's (`part`, `addResult`, `resume`, `respondToApproval`, optional `unstable_recordInteraction`).
  - `type DataUIProps<T = unknown>` — as Vue.
  - `interface ToolUIComponent { tool: InputSignal<ToolUIProps> }` — the contract a tool UI component implements (`tool = input.required<ToolUIProps>()`).
  - `registerToolUI(toolName: string, component: Type<ToolUIComponent>): void` — must run in an injection context under a provider; registers via `aui.tools.setToolUI(...)` (cast at the seam as Vue does) and unregisters on `DestroyRef`.
  - `AuiPartTemplateDirective` — selector `ng-template[auiPart]`, `auiPart = input.required<string>()` (part type: `text`, `tool-call`, `reasoning`, `data`, … or `default`), context `{ $implicit: AssistantState['part'] }`.
  - `AuiMessagePartsComponent` — selector `aui-message-parts`, `contentChildren(AuiPartTemplateDirective)`, renders each part key through `aui-scope-outlet` + internal `AuiPartViewComponent`. Resolution order exactly as Vue: tool-call → `renderText` descriptor (string/number) → registered component via `NgComponentOutlet` with `ngComponentOutletInputs: { tool }` → MCP app renderer; data → data renderer; text → `text` template or `<p style="white-space: pre-line">`; else template for the type, else `default`, else nothing + one-time dev `console.warn` with Vue's message adapted to `Add an <ng-template auiPart="<type>"> or auiPart="default" template.`

- [ ] **Step 1: Write failing tests** (`message-parts.component.spec.ts`, `tool-ui.spec.ts`):
  - `renders text parts as pre-line paragraphs` (assistant message with text `"a\nb"` → `<p>` with `white-space: pre-line`, text `a\nb`).
  - `uses the text template when provided`.
  - `renders a registered tool UI with the tool input`: register a test `WeatherCard` for `getWeather`; message with tool-call part `{ toolName: "getWeather", args: { city: "Paris" } }` → card shows `Paris`; `tool().addResult` is a function.
  - `falls back to the tool-call template when no UI is registered`, then `default`, then renders nothing and warns once.
  - `unregisters tool UI on destroy` → after destroying the registering component, the tool-call template is used again.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement per Interfaces.
- [ ] **Step 4:** Run → PASS, lint + build clean.
- [ ] **Step 5:** Export the produced types/APIs; parity rows → `ported`. **Commit** `feat(lib): add message parts and tool UI registry`

### Task 5: Composer primitives

**Files:**
- Create: `src/lib/primitives/composer-root.directive.ts`, `composer-input.directive.ts`, `composer-send.directive.ts`, `composer-cancel.directive.ts`
- Port from: Vue `ComposerPrimitiveInput.ts`, `ComposerPrimitiveSend.ts`, `ComposerPrimitiveCancel.ts`, `useComposerSendState.ts`; Svelte `__tests__/primitives-composer.test.ts` for cases.

**Interfaces:**
- Consumes: Task 2 helpers; predicates `composerSendDisabled`, `composerCancelDisabled`, `composerInputDisabled` from `@assistant-ui/core/store/internal`; `flushTapSync` from `@assistant-ui/tap`.
- Produces:
  - `AuiComposerRootDirective` — `form[auiComposerRoot]`, `(submit)` → `preventDefault` + send unless disabled.
  - `AuiComposerInputDirective` — `textarea[auiComposerInput]`, `submitOnEnter = input(true, { transform: booleanAttribute })`, `disabled = input(false, { transform: booleanAttribute })`, host `[value]`, `[disabled]`, `name="input"`, `(input)`, `(keydown)` with Vue's exact Enter/Shift/`isComposing`/`keyCode 229` rules; autosize: host `rows` default 1 and height recomputed from `scrollHeight` on value change in an `afterRender` callback, capped by `maxRows = input(8)`.
  - `AuiComposerSendDirective` — `button[auiComposerSend]`, host `type="button"`, `[disabled]`, `(click)`.
  - `AuiComposerCancelDirective` — `button[auiComposerCancel]`, same shape, calls `aui.composer.cancel()`.
- [ ] **Step 1: Write failing tests** (`composer.spec.ts`):
  - `typing updates composer text` (input event → `aui.composer.getState().text`).
  - `Enter sends and clears; Shift+Enter does not send`.
  - `ignores Enter during IME composition` (`isComposing: true`, and separately `keyCode: 229`) → no new message.
  - `does not send while running`: `setRunning(true)` → send button `disabled`, Enter does nothing, message count unchanged.
  - `send button disabled for empty text`; `respects the consumer disabled attribute`.
  - `cancel enabled only while running and calls cancel`.
  - `form submit sends`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS, lint + build clean.
- [ ] **Step 5:** Export; parity rows → `ported`. **Commit** `feat(lib): add composer primitives`

### Task 6: Thread viewport with auto-scroll

**Files:**
- Create: `src/lib/primitives/thread-viewport.directive.ts`, `viewport-context.ts`
- Port from: Vue `ThreadPrimitiveViewport.ts`, `viewportContext.ts`; `primitives-content.test.ts` viewport cases incl. `mockViewportGeometry`.

**Interfaces:**
- Consumes: Task 2 `injectAuiState`, `injectAuiEvent`; `createThreadViewportAutoScroll` from `@assistant-ui/store/client`.
- Produces:
  - `type AuiViewport = { isAtBottom: Signal<boolean>; scrollToBottom(behavior?: ScrollBehavior): void; registerContentInset: ThreadViewportAutoScroll['registerContentInset'] }`; `AUI_VIEWPORT: InjectionToken<AuiViewport>`; `injectAuiViewport(): AuiViewport`.
  - `AuiThreadViewportDirective` — `[auiThreadViewport]`, boolean inputs `autoScroll`, `scrollToBottomOnInitialize`, `scrollToBottomOnRunStart`, `scrollToBottomOnThreadSwitch` (all default `true`, `booleanAttribute`), provides `AUI_VIEWPORT`; attaches in `afterNextRender`, detaches + disposes on destroy; `setHasMessages` driven from a store subscription (not `effect`).
- [ ] **Step 1: Write failing tests** (`thread-viewport.directive.spec.ts`): `scrolls to bottom on initialize`, `scrolls on run start`, `does not auto-scroll when autoScroll is false`, `isAtBottom reflects scroll position`, `detaches on destroy` (port Vue cases with mocked geometry).
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS, lint + build clean.
- [ ] **Step 5:** Export; parity rows → `ported`. **Commit** `feat(lib): add thread viewport with auto-scroll`

### Task 7: Mastra agent server (independent of T2–T6)

**Files:**
- Create: `mastra-server/package.json`, `tsconfig.json`, `.env.example`, `src/mastra/index.ts`, `src/mastra/agents/chat-agent.ts`, `src/mastra/tools/get-weather.ts`, `src/mastra/tools/get-weather.spec.ts`, `src/mastra/index.spec.ts`, `vitest.config.ts`

**Interfaces:**
- Produces: HTTP `POST http://localhost:4111/chat/chatAgent` speaking AI SDK v7 UI-message stream; agent key `chatAgent`; tool id `getWeather` with input `{ city: string }` and output `{ city: string; temperatureC: number; condition: "sunny" | "cloudy" | "rainy" }`.

Use the `mastra` skill to verify current APIs (`Agent`, `createTool`, `Mastra` `server.cors` / `server.apiRoutes`, `chatRoute`) before writing code; spec §8 has the shape.

- [ ] **Step 1: Write failing tests:** `getWeather returns deterministic output for a city` (`"Paris"` → same object on two calls, `temperatureC` integer in `[-10, 35]`, derived from a hash of the lowercased city); `registers chatAgent and the chat route` (instance exposes agent key `chatAgent`; `server.apiRoutes` contains path `/chat/:agentId`; CORS origin = `process.env.FRONTEND_ORIGIN ?? "http://localhost:4200"`).
- [ ] **Step 2:** `npm test -w mastra-server` → FAIL.
- [ ] **Step 3:** Implement. Agent model = `process.env.MASTRA_MODEL ?? "openai/gpt-6-luna"`; instructions: concise helpful assistant that uses `getWeather` for weather questions. `chatRoute({ path: "/chat/:agentId", version: "v7" })`. `.env.example`: `OPENAI_API_KEY=`, `MASTRA_MODEL=`, `FRONTEND_ORIGIN=http://localhost:4200`.
- [ ] **Step 4:** Tests PASS; `npm run typecheck:mastra` clean; `npm run dev -w mastra-server` starts on 4111 (manual check, Ctrl+C).
- [ ] **Step 5: Commit** `feat(mastra): add chat agent server with weather tool`

### Task 8: Demo app + scripted transport + integration tests

**Files:**
- Create: `projects/assistant-ui-angular/testing/` secondary entry (`ng-package.json`, `src/public-api.ts`, `src/scripted-chat-transport.ts`), `projects/demo/src/app/app.config.ts`, `runtime-config.ts`, `chat/chat.component.{ts,html}`, `chat/weather-card.component.ts`, `chat/chat.component.spec.ts`, `projects/demo/public/config.json`, Tailwind config.
- Modify: `projects/demo/src/main.ts`, `styles.css`, root `package.json` (demo deps `@assistant-ui/ai-sdk@0.0.18 ai@^7 react`).

**Interfaces:**
- Consumes: all library exports from Tasks 2–6; Task 7 endpoint.
- Produces:
  - `createScriptedChatTransport(script: ScriptedTurn[] | ((messages: UIMessage[]) => ScriptedTurn)): ChatTransport<UIMessage>` exported from `angular-assistant-ui/testing`, where `type ScriptedTurn = { chunks: UIMessageChunk[]; delayMs?: number } | { error: Error }`; `reconnectToStream` resolves `null`. Peer `ai` optional for this entry only.
  - `RuntimeConfig = { mastraChatUrl: string }`; `MASTRA_CHAT_URL: InjectionToken<string>`; `APP_INITIALIZER` fetches `/config.json` (default `{"mastraChatUrl": "http://localhost:4111/chat/chatAgent"}`).
  - `ChatComponent` (`app-chat`) builds `AuiConfig({ threads: AISDKChat({ transport }) })`; transport = `new AssistantChatTransport({ api: inject(MASTRA_CHAT_URL) })` unless a `CHAT_TRANSPORT` token override is provided (tests use it).
- [ ] **Step 1: Write failing tests** (`chat.component.spec.ts`, providing `CHAT_TRANSPORT` = scripted transport, Zone.js since the demo is a zone app):
  - `streams an assistant reply`: type "hello", click send → user bubble "hello"; assistant bubble ends with "Hi there!" after chunks `start, text-start, text-delta "Hi ", text-delta "there!", text-end, finish`.
  - `renders the weather card for a getWeather tool call` (chunks with `tool-input-available` `{ city: "Paris" }` + `tool-output-available`) → card shows `Paris` and the temperature.
  - `shows stop while running and cancels`.
  - `recovers from transport error`: turn `{ error: new Error("network") }` → assistant message shows the text `Something went wrong` (rendered when `s.message.status?.type === "incomplete" && s.message.status.reason === "error"`), send button re-enabled after typing.
  - `destroy while streaming`: destroy fixture mid-stream (`delayMs`) → no `console.error`.
- [ ] **Step 2:** FAIL → **Step 3:** implement demo: Zone.js (`provideZoneChangeDetection({ eventCoalescing: true })`), full-height layout, user/assistant bubbles, viewport, composer with send/stop (`*auiIf` on `s.thread.isRunning`), registered `WeatherCard` via `registerToolUI("getWeather", WeatherCardComponent)`, Tailwind v3.
- [ ] **Step 4:** Tests PASS; `npm run build:demo` clean; lint clean.
- [ ] **Step 5: Manual end-to-end smoke (required by spec §10):** with `mastra-server/.env` holding a real key, run both dev servers, ask "What's the weather in Paris?" → text streams, weather card renders, network tab shows `POST :4111/chat/chatAgent`, no CORS errors. Record the result in the PR/merge description. If no key is available, stop and ask the user — do not mark done.
- [ ] **Step 6: Commit** `feat(demo): add Mastra-backed chat demo and scripted transport`

### Task 9: Angular version compatibility matrix

**Files:**
- Create: `compat/ng18/`, `compat/ng20/`, `compat/ng22/` (minimal standalone apps: one component using `[auiProvider]`, `aui-thread-messages`, `aui-message-parts`, composer directives, `AISDKChat` with `createScriptedChatTransport`), `compat/smoke.spec.ts` (Playwright), `compat/playwright.config.ts`, `scripts/compat.mjs`
- Modify: `.github/workflows/ci.yml` (matrix job), root `package.json` script `compat`.

**Interfaces:**
- Consumes: built tarball from `npm pack dist/assistant-ui-angular`; Task 8 testing entry.
- [ ] **Step 1: Write the smoke spec:** load the served app, fill `textarea` with "hello", press Enter → `[data-role="assistant"]` contains "Hi there!" within 5 s; no page errors.
- [ ] **Step 2:** `scripts/compat.mjs <ng18|ng20|ng22>`: pack the library, install the tarball into the compat app, `ng build`, serve `dist/` statically, run Playwright. ng18 + ng20 use Zone.js; ng22 uses `provideZonelessChangeDetection()`.
- [ ] **Step 3:** Run `npm run compat -- ng18`, `ng20`, `ng22` locally → all PASS.
- [ ] **Step 4:** CI matrix job over the three apps, depends on `build:lib`.
- [ ] **Step 5: Commit** `ci: add Angular 18/20/22 compatibility matrix`

### Task 10: Documentation

**Files:**
- Create/Modify: `README.md`, `projects/assistant-ui-angular/README.md`, `docs/porting.md`, `docs/deployment.md`

- [ ] **Step 1:** Library README: install (`angular-assistant-ui @assistant-ui/core @assistant-ui/store @assistant-ui/tap @assistant-ui/ai-sdk ai react`), the react-runtime note and standalone-shim alias option, `skipLibCheck: true` requirement on Angular 18, minimal usage example (the demo's template trimmed), API list, supported versions table (from Task 9 results only).
- [ ] **Step 2:** Root README: repo layout, `npm ci`, running demo + Mastra (`.env` setup), scripts, contributing/porting pointer.
- [ ] **Step 3:** `docs/porting.md`: finalize parity table; `docs/deployment.md`: Mastra hosting, secrets, production `FRONTEND_ORIGIN`, per-environment `/config.json`, gating the chat route and forwarding auth via transport `headers`/`credentials`.
- [ ] **Step 4:** Verify every code snippet in the READMEs compiles by copying it into `compat/ng18` temporarily and running `ng build` (revert after).
- [ ] **Step 5: Commit** `docs: add library, repo, porting, and deployment docs`
