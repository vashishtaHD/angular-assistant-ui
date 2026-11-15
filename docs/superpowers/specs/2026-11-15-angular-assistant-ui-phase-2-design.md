# Angular assistant-ui: phase 2 design (full chat-app parity)

Date: 2026-11-15. Status: approved to build. The user said "remember no gaps", then "why'd you stop", which hands the remaining calls to the builder. Every call marked **(builder call)** below was made on the user's behalf and can be revisited.

Phase 1 is merged to `main` (8c2d97c). Its design is `docs/superpowers/specs/2026-11-14-angular-assistant-ui-mastra-design.md`. Every phase 1 constraint carries forward unless this document overrides it.

Research this design argues from (committed alongside it):
- `docs/superpowers/research/2026-11-15-phase-2-upstream-inventory.md`: every upstream export, hook, styled component and core API, with file paths. **Inventory** below means this file.
- `docs/superpowers/research/2026-11-15-phase-2-mastra-wiring.md`: how thread lists, attachments, approval and history work over Mastra, with verified and inferred claims marked. **Mastra notes** below means this file.

Upstream source: SHA `7d7427653f6ba47b0b954510eed9c594d64e74d5` (work from a local checkout of upstream assistant-ui at that SHA).

## 1. Intent

The library will be used in production. Its first consumer is crowsnest, an Angular 18.2.13 + Zone.js app with its own auth. It may also be published as a public fork. Phase 1 delivered the headless core: provider, state, thread, messages, parts, composer, tool UIs and a Mastra demo.

Phase 2 makes the Angular binding cover **everything upstream assistant-ui offers a chat app**, with no silent gaps. A team should be able to drop in a styled, themeable chat with:
- markdown and code
- an action bar, edit and branches
- errors and scroll-to-bottom
- suggestions
- attachments
- reasoning and chain of thought
- a thread list persisted in Mastra memory
- tool approval and ask-the-user tools

They should also be able to build their own UI from the same headless primitives.

## 2. Goals

1. **Primitive parity with upstream React, not Vue.** The Vue binding is a subset even inside a family (Inventory §0.3). Every React primitive export becomes one of:
   - ported, or
   - `n/a` with a reason, in `docs/porting.md`.

   The parity table switches its source of truth to the React export list and keeps the Vue column for reference.
2. **Markdown with streaming repair and code highlighting.**
3. **A styled component kit** a consumer can use without Tailwind.
4. **Thread list persisted in Mastra memory**, scoped to the signed-in user of the host app.
5. **Attachments** reach the model through Mastra.
6. **Tool approval and ask-the-user tools** work end to end with Mastra.
7. **The demo** becomes a full chat app exercising all of the above against the real Mastra server. The compat matrix exercises the styled kit on Angular 18, 20 and 22.

## 3. Non-goals and anti-goals

**Out of scope (agreed 2026-11-14), marked `n/a` in the parity table:**
- voice, speech and dictation
- generative UI
- MCP apps
- devtools
- Assistant Cloud and cloud run state (`ActionBar.RefreshRun` / `Resume`)
- LangGraph / A2A / other backends
- the ~100 props-only "elements" that are generative or agent widgets: charts, maps, terminals, diff viewers, agent cards and the like (Inventory §4.2)

**Anti-goals** (these count as failure even if things "work"):
- A styled kit that forces Tailwind, React, Radix or Base UI on the consumer.
- Any primitive silently missing from the parity table.
- A client-trusted user identity in the production path. That is, a browser that can read another user's threads by changing a request field.
- Breaking any phase 1 public API.
- Using Angular APIs outside 18.2-stable in library code.
- Double-writing history: client history adapter plus Mastra memory.

## 4. Constraints (carried from phase 1, plus additions)

- **Peers:** `@angular/core` / `@angular/common` `>=18.2.0 <23.0.0`, built on the Angular 18.2 toolchain (TS 5.5, ng-packagr 18).
- **Forbidden in library code:** `effect()`, `linkedSignal`, `resource`, `afterRender`, `provideAppInitializer`. Only single-callback `afterNextRender` is allowed. State flows store subscription → signal → computed.
- **Component rules:** standalone, OnPush everywhere, `inject()`, `host: {}` metadata, `aui` prefix, TSDoc on every public export. Tests run in both the `zone` and `zoneless` Vitest projects with pristine output.
- **Behaviour rules come from core, not re-derived.** Disabled/enabled logic uses the predicates in `@assistant-ui/core/store/internal` (`composerSendDisabled`, `actionBarCopyDisabled`, `branchPickerPreviousDisabled`, `threadListLoadMoreDisabled`, …; Inventory §0.1). Auto-scroll keeps using `createThreadViewportAutoScroll`.
- **Ported files** carry `// Ported from packages/<pkg>/src/<path> @ <sha>`. Vendored MIT code keeps its copyright notice. NOTICE lists every vendored package.
- **New runtime dependencies** live only in the secondary entry point that needs them, as peers or optional peers. The headless main entry gains none.
- **Security:**
  - Never commit secrets.
  - The OpenRouter test key lives outside the repo, and only the controller runs live smokes.
  - The production identity path is server-derived (§6.4).
- **Commits:** no Claude/Anthropic attribution anywhere.

## 5. Approaches considered

### 5.1 Styled kit

| Approach | Trade-off |
|---|---|
| A. Copy-in Tailwind components via an `ng generate` schematic, mirroring upstream's shadcn registry | Closest to upstream markup and classes. Forces Tailwind (v3 vs v4 split) and shadcn tokens on the consumer, and schematics must track 18–22 CLI differences. |
| **B. Packaged components in a secondary entry (`angular-assistant-ui/ui`), styled by one plain-CSS stylesheet with CSS custom properties and stable `aui-*` classes (chosen)** | Works in any app (Material, PrimeNG, SCSS, Tailwind). It is theme-able by overriding variables and classes, and fixes ship with the package. Drifts from upstream's exact Tailwind markup, but structure and class hooks follow upstream. |
| C. Both | Double the surface to test across three Angular versions. Could come later on top of B. |

**(builder call) B.** The user did not know crowsnest's styling stack, and B is the only option that works whatever it is. Overlay, focus and a11y behaviour (tooltip, dialog, popover, dropdown menu, collapsible) uses `@angular/cdk` (overlay, a11y, portal). It is an optional peer `>=18.2.0 <23.0.0` used only by the `ui` entry. Icons are inline SVGs of the lucide icons upstream uses (ISC licence, recorded in NOTICE).

### 5.2 Markdown

| Approach | Trade-off |
|---|---|
| **A. Vendor upstream's framework-neutral `@assistant-ui/markdown` (private, MIT, markdown-it based) into an `angular-assistant-ui/markdown` entry and write an Angular renderer modelled on its `src/vue/Markdown.ts` (chosen)** | It is the only upstream code with incomplete-markdown repair and block-identity streaming (`createMarkdownSession`). The AST keeps renderers free of `innerHTML`, which helps XSS posture. The cost is owning a vendored copy, re-synced by SHA. |
| B. Raw `markdown-it` + `innerHTML`, like upstream's Vue kit | Simple, but re-renders everything per token, has no repair and needs sanitising. |
| C. A third-party Angular markdown lib (ngx-markdown) | Extra dependency with its own Angular version window, and no streaming repair. |

**(builder call) A.** Code highlighting uses `shiki` behind an injectable highlighter token. It is lazy-loaded with a configurable language list, and ships as `angular-assistant-ui/shiki` so the core markdown entry has no highlighter dependency. Without a highlighter, code renders as plain `<pre><code>`. Math delimiter normalisation is vendored from react-markdown `preprocess.ts` and exposed as an optional `preprocess` input. Math rendering itself (KaTeX) stays the consumer's choice through a per-language/math component override, matching upstream, which also leaves KaTeX to the app.

### 5.3 Mastra thread list

| Approach | Trade-off |
|---|---|
| **A. Vendor `AISDKThreads` (+ its `useChatThread`) from `@assistant-ui/ai-sdk` as a `MastraThreads` client in an `angular-assistant-ui/mastra` entry, backed by a `RemoteThreadListAdapter` over Mastra's `/memory/threads` routes (chosen)** | 0.0.18 `AISDKThreads` only accepts `cloud` (Mastra notes §0.2), so a fork is unavoidable. It is small, and it keeps the AI SDK chat per thread. |
| B. Fake an `AssistantCloud` object that talks to Mastra | Large hidden surface, brittle. |
| C. Wait for upstream to add an adapter option | Blocks the goal. |

**(builder call) A.** We will also open an upstream issue or PR proposing an `adapter` option, so the fork can be dropped later. It is recorded as a follow-up, not a blocker.

## 6. The design

### 6.1 Package layout

All entries are secondary entries of the single `angular-assistant-ui` package:

| Entry | Contents | New deps |
|---|---|---|
| `angular-assistant-ui` (existing) | All headless primitives and injectors (§6.2). No new deps. | none |
| `angular-assistant-ui/markdown` | Vendored markdown parser/session + `aui-markdown-text` renderer + code block/header slots + preprocess | `markdown-it` (peer) |
| `angular-assistant-ui/shiki` | `provideShikiHighlighter({ langs, themes })` implementing the highlighter token | `shiki` (peer) |
| `angular-assistant-ui/ui` | Styled kit (§6.3) + `styles.css` (copied to the dist as an asset) | `@angular/cdk` (optional peer) |
| `angular-assistant-ui/mastra` | `MastraThreads`, `mastraThreadListAdapter`, the history adapter, `createMastraTransport`, the `MASTRA_AUTH` token | none beyond the existing `@assistant-ui/ai-sdk`/`ai` peers |
| `angular-assistant-ui/testing` (existing) | Grows scripted helpers for approval, ask-user tools, attachments and thread lists | none |

### 6.2 Headless primitives (main entry)

Port every React primitive in Inventory §1 that is not n/a. Groups:
- **Thread:** `ViewportFooter`, `ScrollToBottom`, `Suggestions`/`Suggestion` (by-index scope), `LoadEarlier`, `Empty` equivalents via `*auiIf` (documented), and React's viewport extras: `turnAnchor`, `topAnchorMessageClamp`.
- **Message:** `Error`, `Attachments`, `GroupedParts`, `Quote`, plus `If` equivalents (documented as `*auiIf`).
- **Message parts:** `Text` with smooth streaming (`SmoothOptions`), `Image`, `InProgress`.
- **Composer:** `Root` (form submit), full `Input` props (`submitMode`, `cancelOnEscape`, `addAttachmentOnPaste`, focus on run start / thread switch / scroll-to-bottom, touch Enter), `AddAttachment`, `Attachments`, `AttachmentDropzone`, `Quote`/`QuoteText`/`QuoteDismiss`, `Queue`, `TriggerPopover*` (mentions/slash commands), `If` equivalents. Edit composer support via the message's composer scope.
- **Action bar:** `Root` (`hideWhenRunning`, `autohide`, `autohideFloat`), `Copy` (`copiedDuration`, injectable clipboard writer), `Reload`, `Edit`, `FeedbackPositive`/`FeedbackNegative`, `ExportMarkdown`.
- **Action bar more**, **thread-list-item more**: dropdown-menu primitives, headless. Keyboard and focus follow the WAI-ARIA menu pattern, implemented without CDK so the main entry stays dependency-free.
- **Branch picker:** `Root` (`hideWhenSingleBranch`), `Previous`, `Next`, `Number`, `Count`.
- **Error:** `Root`, `Message`.
- **Attachment:** by-index scope, `Root`, `Name`, `Thumb`, `Remove`.
- **Suggestion:** `Trigger` (`send`, `clearComposer`), `Title`, `Description`.
- **Thread list / item:** `Root`, `Items`, `New`, `LoadMore`, item `Root`, `Trigger`, `Title`, `Archive`, `Unarchive`, `Delete`, keyboard nav/focus group (port the Vue `threadListFocusGroup` + its test).
- **Chain of thought:** `Root`, `AccordionTrigger`, `Parts`. Reasoning has no primitive upstream; it is a part type rendered through `MessageParts` and the styled `Reasoning`.
- **Queue item:** `Text`, `Steer`, `Remove`.
- **Selection toolbar:** `Root`, `Quote`.
- **Assistant modal:** `Root`, `Trigger`, `Anchor`, `Content` (with `openOnRunStart`). The headless version manages open state and focus. Positioning is the consumer's (or the styled kit's, via CDK).
- **Utilities:**
  - `injectScrollLock` (port of `useScrollLock`)
  - an injectable `injectSmooth` text streamer
  - tool helpers: tool UI props gain `approval`, `respondToApproval`, `addResult`, `resume`, matching upstream's tool UI props
  - `registerTool` / model-context helpers for frontend tools
  - `Suggestions` config passthrough

Mechanics follow phase 1:
- action buttons are attribute directives on the consumer's `<button>`, disabled via core predicates
- iterators use `aui-scope-outlet` + `ng-template` with stable keys
- every new scope gets a `*ByIndex` scope config like `messageScopeConfig`

### 6.3 Styled kit (`angular-assistant-ui/ui`)

Components mirror the upstream chat-core kit (Inventory §4.1, §4.5), built only from the headless primitives:
- **`aui-thread`.** Welcome, suggestions, load-earlier, messages, scroll-to-bottom, composer, user message, assistant message, edit composer, branch picker, action bars, message error and a history skeleton. Components are overridable through an injection token (the Angular stand-in for upstream's `ThreadComponents` context).
- **Message content:**
  - `aui-markdown-text` styled with a code header and a copy button
  - `aui-reasoning`, using scroll lock
  - `aui-tool-fallback`, including the approval card, ask-user questions/options, args, result and error states
  - `aui-tool-group`
- **Attachments:** composer attachments, add-attachment, message attachments, an image/file preview dialog.
- **Thread list:** `aui-thread-list` with new, items, archive/unarchive/delete, the more-menu, load more, client-side search and date grouping (port `useThreadListGroups`).
- **Layout:** `aui-thread-list-sidebar` and `aui-assistant-modal`.
- **Extras:** `aui-follow-up-suggestions`, `aui-quote` (composer quote + selection toolbar), feedback buttons, `aui-tooltip-icon-button`, collapsible, `aui-message-timing`.

**Theming.** One `styles.css` defines tokens as CSS custom properties on `:root` and `.aui-theme-dark` / `prefers-color-scheme`: background, foreground, muted, border, accent, radius, font and spacing scale. All component styles hang off stable `aui-*` classes and `data-*` state attributes, so consumers restyle without `::ng-deep`. Components use `ViewEncapsulation.None` with class-scoped selectors. Light and dark themes ship. A Tailwind consumer can map the variables to its theme.

Accessibility: keyboard paths, focus management and ARIA roles match upstream's Radix/Base UI behaviour (dialog focus trap, menu roving focus, tooltip on focus and hover).

### 6.4 Mastra integration

**Server (`mastra-server`):**
1. Add `@mastra/memory` + `@mastra/libsql` at versions compatible with `@mastra/core` 1.83. Configure `storage: LibSQLStore` (file URL from env; in-memory for tests) and give `chatAgent` `memory: new Memory({ options: { lastMessages: 20, generateTitle: true } })`.
2. Replace the bare `chatRoute` with a custom route built on `handleChatStream({ version: "v7" })`. It **whitelists** body fields: messages, memory thread id, trigger, message id, resume data / run id, and the frontend tool schemas mapped to `clientTools`. It must drop `system`, `instructions`, `toolsets`, `requireToolApproval`, `maxSteps`, `hooks` and any other agent option (Mastra notes §0.3).
3. **Identity.** `server.auth` with `mapUserToResourceId`. The resource id always comes from the verified request, never from the body or query. Ship two modes:
   - **dev:** a fixed dev user, gated behind an explicit `MASTRA_DEV_AUTH=1`
   - **token:** a pluggable verifier, with a documented JWT example; this is the shape crowsnest plugs into
   
   CORS allows `Authorization`.
4. **Tools.** Keep `getWeather`. Add a `requireApproval: true` demo tool (e.g. `bookMeeting`) and an ask-the-user tool with no `execute` (`askUser { question, options?, multiple? }`), whose result the frontend supplies.
5. **Edit/reload against a linear log.** On `trigger: "regenerate-message"` or an edit (a user message whose id already exists, or that has a parent), the route deletes the stored messages after the branch point before streaming. Mastra memory then matches the active branch. Other branches survive client-side for the session, but only the active branch persists. Document this limitation.
   **Branch switching (builder call): reconcile on the next send, not on switch.** Selecting a branch changes nothing on the server. On the next send, the transport sends the active branch's message ids, plus the full messages the server has not stored. The route keeps the longest stored prefix that matches those ids, deletes the stored messages after it, then streams with the missing messages included. Reopening a thread therefore restores the branch that was last *sent*, not the last one viewed.
   - **Why:** switching is read-only and cheap, and one reconciliation path covers edit, reload and switch.
   - **What it costs if wrong:** a user who switches and closes without sending sees the previous branch on reopen.
6. Optional history route returning v7 UI messages (via `toAISdkMessages(..., { version: "v7" })`), used if the stock messages endpoint's `uiMessages` shape proves wrong. The spike decides.

**Frontend (`angular-assistant-ui/mastra`):**
- **`MASTRA_AUTH` token:** `{ getHeaders(): Promise<Record<string,string>> | Record<string,string>; credentials?: RequestCredentials }`, provided by the host app.
- **`createMastraTransport({ api, agentId })`:** an `AssistantChatTransport` that adds auth headers. Its `prepareSendMessagesRequest` sends the last message (or the last assistant message for approval/tool-result resubmits) plus `memory: { thread: remoteId }`.
- **`MastraThreads(...)`:** a vendored `AISDKThreads` over `RemoteThreadList({ adapter, backgroundThreads: true })` with a `withKey`'d thread factory. It sets `sendAutomaticallyWhen` to (approval responses complete) OR (client tool calls complete).
- **`mastraThreadListAdapter`:**
  - list (paged, `updatedAt` desc; `nextCursor` = next page)
  - initialize (`POST /memory/threads` with `metadata.archived = false`)
  - rename / archive / unarchive / updateCustom (`PATCH`, merging metadata)
  - delete, fetch
  - `generateTitle`, which polls the thread until Mastra's async title lands (≈15 s timeout)
  - per-thread history via `unstable_useAdapters` → a read-only `ThreadHistoryAdapter.withFormat` that loads messages in ascending order and chains `parentId`; append/update/delete are no-ops
- **Attachments:** the AI SDK default vercel adapter (data-URL `file` parts). Expose an `attachments` adapter option for host upload storage (https URLs). Document model multimodality and the size limit.

### 6.5 Demo and compat

- **Demo:** sidebar thread list plus the styled thread, with markdown and shiki, attachments, the approval tool, the ask-user tool, the weather tool UI, suggestions, feedback, edit/branch/reload, a dark-mode toggle and an assistant-modal page.
- **Compat apps:** render the styled `aui-thread` with the scripted transport. The smoke test adds markdown rendering, branch switching, attachment chip display, an approval click-through and the thread list (in-memory adapter).

## 7. Order of work (for the plan)

1. **Spikes (throwaway, findings recorded):**
   - React hooks inside `unstable_useAdapters` under the Angular host + React shim
   - the real `GET /memory/threads/:id/messages` payload shape for text, tool, approval and file parts
   - a POST with `memory` + last-message-only, plus an `approval-responded` resubmit
   - `clientTools` from frontend tool schemas
   - the request body size limit with base64
   - vendoring `@assistant-ui/markdown` compiles under TS 5.5
   
   Spike results can change §6.4 items 5/6 and the transport details; they are recorded in the plan's ledger as rulings.
2. Headless primitives, family by family (parallelisable in worktrees as in phase 1).
3. Markdown + shiki entries.
4. Mastra server changes (memory, custom route, identity, tools, edit truncation).
5. Mastra frontend entry.
6. Styled kit (after the primitives it composes).
7. Demo, compat, docs (`docs/porting.md` switched to the React export list with every row ported or n/a), CI.
8. Final review on a second model (the user asked for gpt-6.1-sol reviewers), the fix wave, and a live end-to-end smoke by the controller.

## 8. Left to the builder

These are decided in the plan; none changes what gets built:
- exact file layout inside each entry
- naming of the injection tokens (beyond `MASTRA_AUTH`)
- the CSS token names
- the shiki default language list
- which demo tool names to use
- test split per family

## 9. Follow-ups (not phase 2)

- Upstream PR: an `adapter` option on `AISDKThreads`.
- Resumable streams (`resumable: true`) for reload during a run.
- Server-side attachment upload storage.
- A copy-in Tailwind schematic (approach 5.1-C) if a consumer wants upstream-exact markup.
