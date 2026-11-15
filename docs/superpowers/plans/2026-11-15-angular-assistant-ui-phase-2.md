# Angular assistant-ui phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full upstream chat-app parity for the Angular binding, with no gaps. That covers every non-n/a React primitive, a markdown and Shiki pipeline, a Tailwind-free styled kit, and a Mastra-memory thread list with attachments, approval and ask-user tools, demonstrated end to end.

**Architecture:**
- Headless primitives go in the main entry. They are ported from upstream React (`packages/react/src/primitives`), use Vue/Svelte mechanics where those exist, and take their behaviour rules from core predicates.
- Four new secondary entries: `markdown` (vendored `@assistant-ui/markdown` plus an Angular renderer), `shiki`, `ui` (styled kit, plain CSS variables, CDK overlays) and `mastra` (vendored `AISDKThreads`, a `RemoteThreadListAdapter` over Mastra memory, transport and auth).
- The Mastra server gains memory, a whitelisting chat route, server-derived identity and HITL tools.

**Tech Stack:**
- Angular 18.2 toolchain (TS 5.5, ng-packagr 18) and Vitest with analog (zone and zoneless projects)
- `@assistant-ui/core@~0.3.36`, `store@~0.3.23`, `tap@~0.9.26`, `ai-sdk@0.0.18`, `ai@^7`
- `markdown-it@^15`, `shiki`, `@angular/cdk`
- Mastra `@mastra/core@^1.83`, `@mastra/ai-sdk@^1.12`, `@mastra/memory`, `@mastra/libsql`

**Spec:** `docs/superpowers/specs/2026-11-15-angular-assistant-ui-phase-2-design.md`. Research it argues from:
- `docs/superpowers/research/2026-11-15-phase-2-upstream-inventory.md` (**INV**)
- `docs/superpowers/research/2026-11-15-phase-2-mastra-wiring.md` (**MW**)

**Upstream:** SHA `7d7427653f6ba47b0b954510eed9c594d64e74d5`. Work from a read-only local checkout of upstream assistant-ui at that SHA (7d74276). Abbreviations:
- `R` = `packages/react/src`
- `C` = `packages/core/src`
- `V` = `packages/vue/src`
- `SV` = `packages/svelte/src`
- `UI` = `packages/ui/src/components`
- `MD` = `packages/markdown/src`
- `AIS` = `packages/ai-sdk/src`

## Global Constraints

- Peers `@angular/core`, `@angular/common` `>=18.2.0 <23.0.0`. New optional peers: `@angular/cdk >=18.2.0 <23.0.0` (ui entry only), `markdown-it ^15` (markdown entry), `shiki` (shiki entry). The main entry gains no runtime dependency.
- Forbidden in library code: `effect()`, `linkedSignal`, `resource`, `afterRender`, `provideAppInitializer`. Only single-callback `afterNextRender(fn)` is allowed.
- Every component is standalone with `ChangeDetectionStrategy.OnPush`. Use `inject()` only and `host: {}` metadata (no `@HostBinding`/`@HostListener`). Selectors and classes use the `aui` prefix. State flows store subscription → signal → computed. Under zoneless, call `markForCheck()` when views change from callbacks.
- Disabled/enabled rules come from `@assistant-ui/core/store/internal` predicates (INV §0.1). Never re-derive them. Auto-scroll stays on `createThreadViewportAutoScroll`.
- Every ported file starts with `// Ported from packages/<pkg>/src/<path> @ 7d74276`. Vendored MIT code keeps its header. Each vendored package is added to `NOTICE` (both root and `projects/assistant-ui-angular/NOTICE`; `compat.mjs` checks they match).
- TSDoc on every public export. Exports go in a clearly delimited block per task in the relevant `public-api.ts`.
- Tests pass in both the `zone` and `zoneless` Vitest projects with pristine output (no stray console output).
- Each task flips its rows in `docs/porting.md` (Task 1 builds the table) to `ported`, or to `n/a (<reason>)`.
- Gates every task must leave green: `npm run test:lib`, `npm run lint`, `npm run format:check`, `npm run typecheck:lib-spec`, `npm run build:lib` (plus `test:demo` / mastra tests if touched).
- Commits are conventional and carry NO Claude/Anthropic attribution (no Co-Authored-By, no "Generated with", no noreply@anthropic.com).
- Never read, print or commit `.env` files or API keys. Only the controller runs live-model smokes.
- Out of scope, marked `n/a`: voice/speech/dictation, generative UI, MCP apps, devtools, Assistant Cloud, cloud run state (`RefreshRun`, `Resume`), LangGraph/A2A, and the props-only generative/agent "elements".

## Review Focus

1. **Streaming markdown mid-token** (an unclosed `**`, a fence or a link at a chunk boundary) must not flash raw syntax, must not re-render settled blocks, and must not run `javascript:` URLs. Task 11 tests pin this.
2. **Thread switching while a run streams.** The old thread's stream must not write into the new thread's view, and the history must load once per thread with no double-write to Mastra. Task 14 tests pin this.
3. **Identity.** A request whose body or query carries another user's `resourceId` must never read or write that user's threads. Task 13 tests pin this.
4. **Edit, reload or branch switch then send against Mastra memory.** After a reload, the stored log must equal the active branch. Task 13 (route reconciliation) and Task 14 (transport sends ids plus missing messages) pin this.
5. **Keyboard and screen-reader paths in the styled kit.** Covers menu roving focus, dialog focus trap and return, tooltip on focus, Escape to cancel and Enter vs Shift+Enter. Tasks 10 and 15–18 pin this.

---

## Execution notes for the controller

- **Waves:**
  1. Task 1.
  2. Tasks 2–10 (primitive families), Task 11 (markdown), Task 12 (shiki) and Task 13 (Mastra server) run in parallel worktrees. Keep at most 5 implementers in flight.
  3. Task 14 (after 13).
  4. Task 15 (after 2–10), then Tasks 16–18 (after 11, 12, 15).
  5. Tasks 19 and 20.
  6. Task 21.
- **Concurrent edits** touch `public-api.ts` and `docs/porting.md`. Each task appends its own delimited block and edits only its own rows. Resolve merge conflicts by keeping both sides.
- **Reviewers:** per-task and final reviews go to a Codex `gpt-6.1-sol` agent via `delegate_task`, per the user's request. Implementers are subagents.
- **Worktrees:** create them at short paths (a short directory near the drive root, one per task) to avoid Windows long-path failures on cleanup.

---

### Task 1: Parity table rebuild and shared primitive infrastructure

**Files:**
- Modify: `docs/porting.md`
- Create:
  - `projects/assistant-ui-angular/src/lib/primitives/action-button.ts`
  - `projects/assistant-ui-angular/src/lib/scope/index-scope.ts`
  - `projects/assistant-ui-angular/src/lib/scope/index-scope.spec.ts`
  - `projects/assistant-ui-angular/src/lib/primitives/action-button.spec.ts`
- Modify: `projects/assistant-ui-angular/src/testing-internal/test-runtime.ts` (extend it)

**Interfaces:**
- Produces `createActionButton()`, a host-directive helper for attribute-directive buttons:
  - `injectActionButton(opts: { disabled: () => boolean; onClick: (e: MouseEvent) => void }): void`
  - It sets `[attr.disabled]`, `type="button"` when absent, `data-disabled`, and `click`, which calls `onClick` only when enabled.
  - Every action-button directive in Tasks 2–10 uses it.
- Produces `indexScopeConfig(kind: 'attachment' | 'suggestion' | 'threadListItem' | 'queueItem' | 'chainOfThoughtPart', ...)`. It generalises `messageScopeConfig`/`partScopeConfig` (`scope/message-scope.ts`, `scope/part-scope.ts`) for by-index child scopes rendered through `AuiScopeOutletComponent`.
- Produces `createTestRuntime()` extras:
  - `appendBranch(parentId, message)`
  - `setSuggestions(list)`
  - `withAttachments(adapter)`
  - `withThreadList(adapter?)`, which uses core's `InMemoryThreadList` / `RemoteThreadList` + `InMemoryThreadListAdapter`
  - `withFeedback(adapter)`

  Tasks 2–10 test against these.
- Produces the `docs/porting.md` parity table, keyed by **React** export (INV §1). Columns: export | Vue has it | Angular status | task. Every row is `planned (Task N)` or `n/a (reason)`. Phase 1 rows keep `ported`.

- [ ] **Step 1: Write failing tests.**
  - `action-button.spec.ts`: a test directive using `injectActionButton` with `disabled: () => true` renders `disabled=""` and `data-disabled`, and clicking does not call `onClick`. Flipping the signal re-enables it and the click fires once. It adds `type="button"` only when the host has no `type`.
  - `index-scope.spec.ts`: an outlet over a suggestion scope with three items resolves `aui.suggestion().getState()` per index. Removing the middle item keeps the identity of the surviving items' scopes (stable keys).
- [ ] **Step 2: Run them.** `npm run test:lib -- action-button index-scope` should FAIL (modules missing).
- [ ] **Step 3: Implement.** Write `action-button.ts`, `index-scope.ts` and the test-runtime extras. Port the iterator mechanics from `V/primitives/{suggestions,threadList,composerAttachments}.ts`.
- [ ] **Step 4: Rebuild `docs/porting.md`.** Build the parity table from `R/primitives/*.ts` export lists and `R/index.ts` hooks, using INV §1–§2 for scope. Every export from INV §1.15's "out of scope" row is `n/a` with its reason. Add the `markdown`, `shiki`, `ui` and `mastra` entry sections listing their planned exports (Tasks 11–18).
- [ ] **Step 5: Run the gates.** All PASS.
- [ ] **Step 6: Commit.** `feat(lib): shared action-button and index-scope infrastructure; React-keyed parity table`

### Task 2: Thread extras and scroll lock

**Port from:**
- `R/primitives/thread/*`: `ThreadPrimitiveViewportFooter`, `ScrollToBottom`, `LoadEarlier`, and the `turnAnchor` / `topAnchorMessageClamp` viewport props
- `V/primitives/{ThreadPrimitiveViewportFooter,ThreadPrimitiveScrollToBottom}.ts`
- `V/useScrollLock.ts`

**Files:** under `projects/assistant-ui-angular/src/lib/primitives/`, create `thread-viewport-footer.directive.ts`, `thread-scroll-to-bottom.directive.ts`, `thread-load-earlier.directive.ts`, and `lib/utils/scroll-lock.ts`. Modify `thread-viewport.directive.ts` (add inputs). Each gets a spec.

**Interfaces:**
- Consumes `injectAuiViewport()` (`viewport-context.ts`) and `injectActionButton` (Task 1).
- Produces:
  - `[auiThreadViewportFooter]`, which registers its height as a content inset via `registerContentInset`
  - `button[auiThreadScrollToBottom]`, disabled when at bottom, with an optional `behavior` input
  - `button[auiThreadLoadEarlier]`, which calls `aui.thread().loadEarlier()` and is disabled when `!hasEarlier || isLoadingEarlier`
  - viewport inputs `turnAnchor: 'top' | 'bottom'` and `topAnchorMessageClamp`
  - `injectScrollLock(elementRef: ElementRef<HTMLElement>, durationMs: number): () => void`

- [ ] **Step 1: Write failing specs** mirroring `V/primitives/ThreadPrimitiveViewportFooter.test.ts` and `V/useScrollLock.test.ts`. Cases:
  - The footer's inset changes when its height changes.
  - The scroll-to-bottom button is disabled at bottom and enabled after a scroll-up.
  - Clicking it calls `scrollToBottom`.
  - `turnAnchor='top'` keeps the last user message pinned on run start (port React's top-anchor tests from `R/primitives/thread/*.test.tsx` if present).
  - Scroll lock freezes `scrollTop` for the duration, then releases it.
  - Nested locks are ref-counted.
- [ ] **Step 2: Run** `npm run test:lib -- thread-viewport-footer scroll-to-bottom load-earlier scroll-lock`. It should FAIL.
- [ ] **Step 3: Implement** the directives and the util.
- [ ] **Step 4: Run the gates.** All PASS. Flip the porting.md rows.
- [ ] **Step 5: Commit.** `feat(lib): viewport footer, scroll-to-bottom, load-earlier, top anchor, scroll lock`

### Task 3: Message error, grouped parts, quote, and part primitives with smooth streaming

**Port from:**
- `R/primitives/error.ts`
- `R/primitives/message.ts`: `Error`, `GroupedParts`, `Quote`, `Attachments` (Attachments is left to Task 6)
- `R/primitives/messagePart.ts`: `Text`, `Image`, `InProgress`
- `R/utils/smooth/*`: `useSmooth`, `SmoothOptions`
- `V/primitives/error.ts`

**Files:** `lib/primitives/error.directive.ts` (Root + Message), `message-error.directive.ts`, `message-grouped-parts.component.ts`, `message-quote.directive.ts`, `part-text.component.ts`, `part-image.directive.ts`, `part-in-progress.directive.ts`, `lib/utils/smooth.ts`, each with a spec.

**Interfaces:**
- Produces:
  - `[auiErrorRoot]` (`role="alert"`)
  - `[auiErrorMessage]`, whose text comes from the `messageErrorText` predicate
  - `*auiMessageError`, a structural directive rendered only when the message status is an error
  - `aui-message-grouped-parts` with a `groupBy` input matching React's `GroupedParts` contract; `ng-template` slots receive the group plus its parts
  - `[auiMessageQuote]`
  - `aui-part-text` with `smooth: boolean | SmoothOptions` (default true), setting `data-status`
  - `img[auiPartImage]`
  - `*auiPartInProgress`
  - `injectSmooth(text: Signal<string>, status: Signal<PartStatus>, opts?): Signal<string>`, implemented with `requestAnimationFrame` (no `effect`)

- [ ] **Step 1: Write failing specs.**
  - The error root shows the run's error text, and nothing on success.
  - Grouped parts group consecutive tool calls per the React grouping rule (copy its test cases).
  - Smooth text reveals progressively while running and snaps to full text on `complete`.
  - Image renders `src` from the part.
  - InProgress renders only while the part is running.
- [ ] **Step 2: Run them.** They should FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the gates.** Flip the rows.
- [ ] **Step 5: Commit.** `feat(lib): error, grouped parts, quote, and part text/image/in-progress primitives with smooth streaming`

### Task 4: Action bar, branch picker, feedback, export markdown, edit composer

**Port from:**
- `R/primitives/actionBar.ts` and `C/react/primitive-hooks/useActionBar*`
- `R/primitives/branchPicker.ts`
- `V/primitives/{actionBar,branchPicker}.ts` and `SV/primitives/{actionBar,branchPicker}.ts`
- tests `R/**/useActionBarCopy*.test.*`

**Files:** `lib/primitives/action-bar/*.ts` (root, copy, reload, edit, feedback-positive, feedback-negative, export-markdown), `lib/primitives/branch-picker/*.ts` (root, previous, next, number, count) and specs.

**Interfaces:**
- Produces:
  - `[auiActionBarRoot]` with `hideWhenRunning`, `autohide: 'always' | 'not-last' | 'never'` and `autohideFloat: 'always' | 'single-branch' | 'never'`. It sets `data-floating` and is hidden via the `hidden` attribute per React's rules.
  - `button[auiActionBarCopy]` with `copiedDuration` (default 3000). It sets `data-copied` and writes text through a `AUI_CLIPBOARD` injection token (default `navigator.clipboard.writeText`). Moving to a new message scope cancels the copied timer.
  - `button[auiActionBarReload]`, `[auiActionBarEdit]`, `[auiActionBarFeedbackPositive]`, `[auiActionBarFeedbackNegative]` (with `data-submitted`), and `[auiActionBarExportMarkdown]` (with an `onExport` output; the default downloads `.md`).
  - Branch picker: `[auiBranchPickerRoot]` (`hideWhenSingleBranch`), `button[auiBranchPickerPrevious]`, `button[auiBranchPickerNext]`, `aui-branch-picker-number`, `aui-branch-picker-count`.
  - Edit composer: inside a message scope, phase 1's `[auiComposerRoot]`/`[auiComposerInput]`/`[auiComposerSend]`/`[auiComposerCancel]` bind to `aui.message().composer()` when an `editing` scope is active. Add an `[auiEditComposer]` scope directive, which sets the composer scope to the message's edit composer.
- [ ] **Step 1: Write failing specs.**
  - Copy writes the message text, sets `data-copied` for the duration, and clears it on scope change.
  - Reload is disabled while running and calls `reload()`.
  - Edit → typing → send creates a branch: `branchCount` becomes 2 and Number shows "2", Previous shows "1".
  - Edit cancel restores the original.
  - Autohide hides a non-last message's bar until hover/focus-within.
  - Feedback calls the adapter with `positive`, then sets `data-submitted`.
  - Export emits markdown of the message.
- [ ] **Step 2: Run them.** They should FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the gates.** Flip the rows.
- [ ] **Step 5: Commit.** `feat(lib): action bar, branch picker, feedback, export markdown and edit composer`

### Task 5: Full composer: root form, full input props, quote, queue

**Port from:** `R/primitives/composer.ts` (`Root`, `Input` full props, `Quote`, `QuoteText`, `QuoteDismiss`, `Queue`), `R/primitives/queueItem.ts`, `C/runtime/queue/*`, and the tests `C/tests/message-queue.test.ts` and `R/tests/local-runtime-queue.test.tsx`.

**Files:** modify `composer-root.directive.ts` and `composer-input.directive.ts`. Create `composer-quote*.ts`, `composer-queue.component.ts`, `queue-item/{text,steer,remove}.ts` and specs.

**Interfaces:**
- `[auiComposerRoot]` becomes a `form` handler: submit calls send, and it honours `composerSendDisabled`.
- `[auiComposerInput]` adds these inputs:
  - `submitMode: 'enter' | 'ctrlEnter' | 'none'` (keep the phase 1 `submitOnEnter` as a deprecated alias)
  - `cancelOnEscape` (default true)
  - `addAttachmentOnPaste` (default true; Task 6 wires the adapter)
  - `focusOnRunStart`, `focusOnThreadSwitch`, `focusOnScrollToBottom`, and the touch-Enter rule from React
- Quote and queue primitives per INV §1.4 / §1.13.
- [ ] **Step 1: Write failing specs.**
  - `ctrlEnter` sends on Ctrl/Cmd+Enter only.
  - Escape cancels a running run.
  - Shift+Enter inserts a newline.
  - Focus returns to the input on thread switch.
  - A quote set via `composer.setQuote` renders `QuoteText`, and Dismiss clears it.
  - With queue enabled, sending while running enqueues. QueueItem Steer runs it next, and Remove removes it.
- [ ] **Step 2: Run them.** They should FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the gates.**
- [ ] **Step 5: Commit.** `feat(lib): composer form root, full input props, quote and message queue primitives`

### Task 6: Attachments

**Port from:** `R/primitives/attachment.ts`, composer `AddAttachment`/`Attachments`/`AttachmentDropzone`, message `Attachments`, `V/primitives/{attachment,composerAttachments,messageAttachments,AttachmentByIndexProvider}.ts`, and the test `V/primitives/composerAttachments.thread-scope.test.ts`.

**Files:** `lib/primitives/attachment/*.ts` (root, name, thumb, remove), `composer-add-attachment.directive.ts`, `composer-attachments.component.ts`, `composer-attachment-dropzone.directive.ts`, `message-attachments.component.ts` and specs.

**Interfaces:**
- Produces:
  - `aui-composer-attachments` and `aui-message-attachments`, with an `ng-template` per attachment that receives the attachment scope via `indexScopeConfig('attachment')`
  - `[auiAttachmentRoot]` (`data-type`, `data-status`), `aui-attachment-name`, `img[auiAttachmentThumb]` (an object-URL thumb with revoke on destroy), `button[auiAttachmentRemove]`
  - `button[auiComposerAddAttachment]` with `multiple` (default true), which opens a hidden file input using `accept` from `composer.attachmentAccept`
  - `[auiComposerAttachmentDropzone]`, which sets `data-dragging` and adds dropped files
  - paste-to-attach in `[auiComposerInput]`
  - an `attachmentAddError` event surfaced as an `(attachmentError)` output on the dropzone/add-button
- [ ] **Step 1: Write failing specs.**
  - Adding a `File` via the hidden input shows a chip with the name.
  - Remove deletes it.
  - Sending moves the attachments onto the user message, which renders through `aui-message-attachments`.
  - A rejected type emits `attachmentError` with its reason.
  - Drag-over sets `data-dragging`.
  - Thumb object URLs are revoked on destroy.
- [ ] **Step 2: Run them.** They should FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the gates.**
- [ ] **Step 5: Commit.** `feat(lib): attachment, composer attachment, dropzone and message attachment primitives`

### Task 7: Suggestions

**Port from:** `R/primitives/suggestion.ts`, thread `Suggestions`/`Suggestion`, `V/primitives/suggestions.ts`, and `C/store/clients/suggestions.ts`. Tests: `C/adapters/suggestion.test.ts` and the Vue suggestions tests.

**Files:** `thread-suggestions.component.ts`, `suggestion/{trigger,title,description}.ts` and specs. Add `Suggestions` re-exports to `public-api.ts`.

**Interfaces:**
- Produces:
  - `aui-thread-suggestions` with an `ng-template` per suggestion (`indexScopeConfig('suggestion')`)
  - `button[auiSuggestionTrigger]` with `send` (default false) and `clearComposer` (default true). Its send mode comes from the `suggestionSendMode` predicate.
  - `aui-suggestion-title`, `aui-suggestion-description`
- Re-exports core's `Suggestions` client and `createSuggestionAdapter`.
- [ ] **Step 1: Write failing specs.**
  - Three configured suggestions render.
  - Trigger without `send` fills the composer.
  - Trigger with `send` appends and starts a run.
  - It is disabled per the predicate while running.
- [ ] **Step 2: Run them.** They should FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the gates.**
- [ ] **Step 5: Commit.** `feat(lib): thread suggestions and suggestion primitives`

### Task 8: Thread list and thread list item

**Port from:** `R/primitives/{threadList,threadListItem}.ts`, `V/primitives/{threadList,threadListStructural,threadListFocusGroup,ThreadListPrimitiveRoot,ThreadListItemPrimitiveRoot,ThreadListItemPrimitiveTrigger}.ts`, and the tests `V/primitives/ThreadListKeyboardNav.test.ts` and `threadListStructural.unarchive.test.ts`.

**Files:** `lib/primitives/thread-list/*.ts` and specs.

**Interfaces:**
- Produces:
  - `[auiThreadListRoot]` (focus group, roving `tabindex`)
  - `aui-thread-list-items` with an `archived` input and an `ng-template` per item (`indexScopeConfig('threadListItem')`)
  - `button[auiThreadListNew]`
  - `button[auiThreadListLoadMore]`, using the `threadListLoadMoreDisabled` predicate
  - `[auiThreadListItemRoot]`, which sets `data-active` / `data-archived`
  - `button[auiThreadListItemTrigger]`
  - `aui-thread-list-item-title` with a `fallback` input
  - `button[auiThreadListItemArchive]`, `[auiThreadListItemUnarchive]`, `[auiThreadListItemDelete]`
- [ ] **Step 1: Write failing specs** using `createTestRuntime().withThreadList()`. Cases:
  - New creates and switches thread.
  - Trigger switches, and `data-active` moves.
  - Archive moves the item to the archived list.
  - Unarchive moves it back (port the Vue unarchive test).
  - Delete removes it.
  - Load more appends the next page and is disabled when `!hasMore`.
  - Arrow keys move focus between items, and Home/End jump to the ends (port the Vue keyboard-nav test).
- [ ] **Step 2: Run them.** They should FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the gates.**
- [ ] **Step 5: Commit.** `feat(lib): thread list and thread list item primitives with keyboard navigation`

### Task 9: Chain of thought and reasoning parts

**Port from:** `R/primitives/chainOfThought.ts`, `V/primitives/{ChainOfThoughtPrimitiveParts,ChainOfThoughtPrimitiveAccordionTrigger}.ts` and their tests, plus `C/store/clients/chain-of-thought-client.ts`.

**Files:** `lib/primitives/chain-of-thought/{root,accordion-trigger,parts}.ts` and specs. Modify `message-parts.component.ts` to accept a `chainOfThought` grouping config, as React's `MessagePrimitive.Parts` does.

**Interfaces:**
- Produces:
  - `[auiChainOfThoughtRoot]` (`data-collapsed`)
  - `button[auiChainOfThoughtAccordionTrigger]` (`aria-expanded`, toggles `setCollapsed`)
  - `aui-chain-of-thought-parts`, with templates per part type
- Reasoning parts render through the existing `auiPartTemplate` for `type: 'reasoning'`. Document this in porting.md: reasoning has no upstream primitive.
- [ ] **Step 1: Write failing specs** (port the Vue tests).
  - Consecutive reasoning and tool parts collapse into one chain of thought.
  - The trigger toggles `aria-expanded` and hides/shows the parts.
  - It auto-collapses on completion per the upstream rule.
- [ ] **Step 2: Run them.** They should FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the gates.**
- [ ] **Step 5: Commit.** `feat(lib): chain of thought primitives and reasoning grouping`

### Task 10: Menus, trigger popovers, selection toolbar, assistant modal (headless)

**Port from:** `R/primitives/{actionBarMore,threadListItemMore,selectionToolbar,assistantModal}.ts`, composer `TriggerPopover*` (in `R/primitives/composer`), and `R/primitives/dropdownMenuRenderPrimitives.ts` with its test.

**Files:** `lib/primitives/menu/*.ts` (shared headless menu: trigger, content, item, separator), `action-bar-more.ts`, `thread-list-item-more.ts`, `composer-trigger-popover/*.ts`, `selection-toolbar/{root,quote}.ts`, `assistant-modal/{root,trigger,anchor,content}.ts` and specs.

**Interfaces:**
- Produces a headless WAI-ARIA menu (no CDK):
  - `button[auiMenuTrigger]` (`aria-haspopup="menu"`, `aria-expanded`)
  - `[auiMenuContent]` (`role="menu"`, roving focus, Escape closes and returns focus, typeahead)
  - `[auiMenuItem]` (`role="menuitem"`)

  ActionBarMore and ThreadListItemMore are thin aliases bound to their scopes.
- Trigger popover: `[auiComposerTriggerPopover]` with a `char` input (e.g. `@`, `/`) and an `items` input/adapter. It exposes the active query, the highlighted index and `select(item)`, and inserts a directive token via composer `setText`. The aria-activedescendant wiring on the input follows React.
- Selection toolbar: `[auiSelectionToolbarRoot]` shows while a text selection lies inside a single message (positioning is the consumer's; it exposes the `rect` signal), plus `button[auiSelectionToolbarQuote]`.
- Assistant modal: `[auiAssistantModalRoot]` (`open` model and `openOnRunStart`), `button[auiAssistantModalTrigger]`, `[auiAssistantModalAnchor]`, and `[auiAssistantModalContent]` (`role="dialog"`, Escape and outside-click dismiss, focus moved in and returned).
- [ ] **Step 1: Write failing specs.**
  - Menu: arrow/Home/End/typeahead, Escape returns focus to the trigger, and selecting an item runs its action and closes.
  - Trigger popover: typing `@ma` opens with query `ma`, Enter selects and inserts the token, Escape closes.
  - Selection toolbar: a selection within one message shows the toolbar, a selection across two messages hides it, and Quote sets the composer quote.
  - Assistant modal: the trigger toggles, Escape closes and focuses the trigger, and `openOnRunStart` opens on `thread.runStart`.
- [ ] **Step 2: Run them.** They should FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the gates.**
- [ ] **Step 5: Commit.** `feat(lib): headless menus, composer trigger popover, selection toolbar and assistant modal`

### Task 11: Markdown entry (`angular-assistant-ui/markdown`)

**Port from:** vendor `MD/` (everything except the `react`, `vue`, `react-native` and `ink` renderers, keeping its tests) and `packages/react-markdown/src/{preprocess.ts,code-fence.ts}`. Model the renderer on `MD/vue/Markdown.ts`.

**Files:** `projects/assistant-ui-angular/markdown/ng-package.json`, `markdown/src/public-api.ts`, `markdown/src/vendor/**` (the vendored parser, session and tests), `markdown/src/markdown-text.component.ts`, `markdown/src/markdown-node.component.ts`, `markdown/src/code-block.ts`, `markdown/src/highlighter.token.ts` and specs. Add `markdown-it` as a peer and a devDependency. Update NOTICE.

**Interfaces:**
- Produces `aui-markdown-text`. It reads the current text part, uses `injectSmooth` (Task 3) unless `smooth=false`, and keeps a `createMarkdownSession()` per part instance, calling `update(text, { final: status === 'complete' })`.
  - Inputs: `smooth`, `preprocess: (text: string) => string`, `components: Partial<AuiMarkdownComponents>`, `componentsByLanguage: Record<string, { codeHeader?: Type; highlighter?: Type }>`.
  - Each block renders through a recursive `@switch` on the node type. Blocks whose node identity is unchanged are skipped via `@for` track-by-identity.
  - Raw HTML renders as text.
- Produces `AUI_SYNTAX_HIGHLIGHTER: InjectionToken<AuiSyntaxHighlighter>` with `{ highlight(code: string, language: string): Promise<string /* trusted HTML */> | null }`. The default is plain `<pre><code>`. Highlighter output is bound via `DomSanitizer.bypassSecurityTrustHtml` ONLY for highlighter-produced markup.
- Produces `AuiCodeHeader` (inputs `language`, `code`), whose default renders nothing; re-exports `normalizeMathDelimiters`, `escapeCurrencyDollars`; and the `aui-md-*` classes.
- [ ] **Step 1: Write failing specs.**
  - The vendored tests run green under Vitest after vendoring.
  - Streaming `"**bo"` then `"**bold**"` never renders literal `**`.
  - A settled first paragraph keeps its DOM node identity while the second streams.
  - `[x](javascript:alert(1))` renders as text, not an anchor.
  - A fenced `ts` block calls the highlighter with `('…', 'ts')`.
  - `componentsByLanguage.mermaid` overrides only mermaid blocks.
  - Tables align per column.
  - Raw `<script>` appears as text.
- [ ] **Step 2: Run them.** They should FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Gates.** Run the gates. `build:lib` emits the `markdown` entry.
- [ ] **Step 5: Commit.** `feat(markdown): vendored streaming markdown parser and Angular renderer`

### Task 12: Shiki entry (`angular-assistant-ui/shiki`)

**Files:** `projects/assistant-ui-angular/shiki/{ng-package.json,src/public-api.ts,src/provide-shiki.ts,src/provide-shiki.spec.ts}`. Add `shiki` as a peer and a devDependency.

**Interfaces:**
- Consumes `AUI_SYNTAX_HIGHLIGHTER` (Task 11). Task 11 and this task can run in parallel if this task creates the token stub identically. **The interface is fixed:** `export const AUI_SYNTAX_HIGHLIGHTER = new InjectionToken<AuiSyntaxHighlighter>('AUI_SYNTAX_HIGHLIGHTER')` in `markdown/src/highlighter.token.ts`, and this entry imports it from `angular-assistant-ui/markdown`.
- Produces `provideShikiHighlighter(opts?: { langs?: string[]; themes?: { light: string; dark: string }; loadHighlighter?: () => Promise<HighlighterCore> }): Provider[]`.
  - The default langs are `ts, tsx, js, jsx, json, bash, shell, python, html, css, scss, sql, yaml, markdown, diff, java, go, rust, csharp`.
  - It lazy-loads on first highlight, returns dual-theme HTML (CSS variables for dark mode), and returns `null` for unknown languages, which fall back to plain.
- [ ] **Step 1: Write failing specs.**
  - Highlighting `const a = 1` in `ts` returns HTML containing `shiki` spans.
  - An unknown language returns null.
  - Concurrent first calls create one highlighter.
- [ ] **Step 2: Run them.** They should FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the gates.**
- [ ] **Step 5: Commit.** `feat(shiki): lazy Shiki syntax highlighter provider`

### Task 13: Mastra server: memory, whitelisting route, identity, HITL tools, branch reconciliation

**Files:**
- Modify: `mastra-server/package.json`, `mastra-server/src/mastra/index.ts`, `mastra-server/src/mastra/agents/chat-agent.ts`, `mastra-server/.env.example`
- Create:
  - `mastra-server/src/mastra/routes/chat-route.ts`
  - `mastra-server/src/mastra/auth.ts`
  - `mastra-server/src/mastra/tools/book-meeting.ts`
  - `mastra-server/src/mastra/tools/ask-user.ts`
  - `mastra-server/src/mastra/reconcile.ts`
  - specs under `mastra-server/src/**/*.spec.ts`

**Interfaces (consumed by Task 14):**
- `POST /chat/:agentId` (same path as phase 1). The body accepts ONLY:
  - `messages` (UIMessage[]), which are the active-branch messages the server lacks
  - `messageIds: string[]` (the full active branch, in order)
  - `memory: { thread: string }`
  - `trigger`, `messageId`
  - `resumeData`, `runId`
  - `tools` (frontend tool JSON schemas), mapped to `clientTools`

  Every other field is dropped. It streams AI SDK v7 UI message chunks via `handleChatStream({ version: 'v7' })`.
- Branch reconciliation (`reconcile.ts`): it loads the stored thread messages and keeps the longest stored prefix whose ids equal the `messageIds` prefix. It deletes the stored messages after that prefix (Mastra memory delete), then streams with the missing messages. This is a pure function `planReconcile(storedIds: string[], activeIds: string[]): { keep: number; deleteIds: string[] }` with unit tests, plus the side-effecting wrapper.
- Identity (`auth.ts`):
  - `server.auth` with `mapUserToResourceId`. Modes come from env: `MASTRA_AUTH_MODE=dev`, which requires `MASTRA_DEV_AUTH=1` and assigns the fixed user `dev-user`, or `MASTRA_AUTH_MODE=jwt`, which uses a `verifyToken(token)` hook (HS256 with `MASTRA_JWT_SECRET` as the example).
  - A body or query `resourceId` is ignored.
  - CORS allows `Authorization`.
- Memory: `LibSQLStore` with `url = process.env.MASTRA_DB_URL ?? 'file:./mastra.db'` (tests use `:memory:`), and `Memory({ options: { lastMessages: 20, generateTitle: true } })` on `chatAgent`.
- Tools:
  - `bookMeeting({ title, when })` with `requireApproval: true`, returning `{ confirmed: true, title, when }`
  - `askUser({ question, options?: string[], multiple?: boolean })` with no `execute` (a client-supplied result)
  - the agent instructions mention both tools
- [ ] **Step 1: Spike first** (a throwaway script in `mastra-server/scratch/`, git-ignored). Use the AI SDK `MockLanguageModelV3` (or the version installed) as the agent model and record findings in the task report. If findings change an interface above, record the change as `Ruling:` in the report and adapt Task 14's brief.
  - the real `GET /memory/threads/:id/messages` response for a turn with text, a tool call, an approval and a file part
  - whether `uiMessages` is v7-shaped
  - a v7 `approval-responded` resubmit resuming `bookMeeting`
  - `clientTools` built from frontend tool schemas
  - the request body limit with a 2 MB base64 image
- [ ] **Step 2: Write failing specs** (mock model, `:memory:` storage, in-process server via the Mastra test harness or `app.request`).
  - A body with `system: "x"` or `requireToolApproval: false` has no effect on the agent call.
  - A request authenticated as user A with `memory.resource = 'B'` writes to A's thread, and `GET /memory/threads?resourceId=B` as A returns 403 or empty.
  - Without auth in jwt mode, the route returns 401.
  - `bookMeeting` streams a `tool-approval-request`; a resubmit with approval resumes it and streams the result.
  - `askUser` ends with `input-available`; a resubmit with the tool output continues.
  - `planReconcile(['a','b','c'], ['a','b','x'])` returns `{ keep: 2, deleteIds: ['c'] }`.
  - Reload after reconciliation lists exactly the active branch.
- [ ] **Step 3: Run them.** `npm test -w mastra-server` (or the existing mastra test script) should FAIL.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Run the gates.** Mastra tests and typecheck PASS, and `format:check` PASS. Update `.env.example` (no real values) and `docs/deployment.md` (auth modes, storage URL, CORS, body-size note).
- [ ] **Step 6: Commit.** `feat(mastra-server): memory storage, whitelisting chat route, server-derived identity, approval and ask-user tools, branch reconciliation`

### Task 14: Mastra frontend entry (`angular-assistant-ui/mastra`)

**Port from:** vendor `AIS/runtime/AISDKThreads.ts`, `AIS/runtime/useChatThread.ts` and the helpers they import (MIT; add to NOTICE). Use `RemoteThreadList` from `@assistant-ui/core/store` and `ThreadClient` from `@assistant-ui/core/store/internal` (MW §0.2).

**Files:** `projects/assistant-ui-angular/mastra/{ng-package.json,src/public-api.ts,src/mastra-threads.ts,src/vendor/**,src/thread-list-adapter.ts,src/history-adapter.ts,src/transport.ts,src/auth.token.ts}` with specs. Extend `testing/` with `createMockMastraServer()`, an in-memory fake of the Task 13 HTTP contract built on `fetch` interception.

**Interfaces:**
- `MASTRA_AUTH: InjectionToken<MastraAuth>`, where `MastraAuth = { getHeaders(): Record<string,string> | Promise<Record<string,string>>; credentials?: RequestCredentials }`.
- `createMastraTransport(opts: { api: string; agentId: string; auth?: MastraAuth; tools?: ... })` returns an `AssistantChatTransport`.
  - `prepareSendMessagesRequest` sends `{ messages: <messages the server lacks>, messageIds: <active branch ids>, memory: { thread: id }, trigger, messageId, tools }`.
  - It tracks the last-known stored ids per thread, seeded from the history load and updated after each completed run.
- `mastraThreadListAdapter(opts: { baseUrl: string; agentId: string; auth?: MastraAuth; pageSize?: number /*20*/ }): RemoteThreadListAdapter`:
  - `list` maps `nextCursor` to the next page and `status` to `metadata.archived`
  - `initialize` POSTs with `metadata.archived = false`
  - `rename`/`archive`/`unarchive`/`updateCustom` PATCH with merged metadata
  - `delete` and `fetch` call the matching routes
  - `generateTitle` polls `GET /memory/threads/:id` every 1 s for up to 15 s, then emits the title through `createAssistantStream`
  - `unstable_useAdapters` returns `{ history }` (read-only, `withFormat`, ascending load, chained `parentId`; append/update/delete are no-ops)
- `MastraThreads(opts: { transport factory; adapter; threadId?; onThreadIdChange?; sendAutomaticallyWhen? })` is a vendored `AISDKThreads` using `RemoteThreadList({ adapter, backgroundThreads: true })` with a `withKey`'d thread. Its default `sendAutomaticallyWhen` is `lastAssistantMessageIsCompleteWithApprovalResponses || lastAssistantMessageIsCompleteWithToolCalls`.
- [ ] **Step 1: Spike** `unstable_useAdapters` (React hooks) under the Angular host and React shim. If it fails, call the history adapter through `RemoteThreadList`'s non-hook path, or provide adapters per thread from the `thread` factory instead, and record it as a `Ruling:`.
- [ ] **Step 2: Write failing specs** against `createMockMastraServer()`.
  - The list shows the server's threads newest first, and load more fetches page 2.
  - Archive PATCHes `metadata.archived=true` while preserving other metadata keys.
  - Switching threads loads that thread's history once; a second switch back does not refetch.
  - The history adapter never POSTs messages.
  - Switching threads mid-stream does not append chunks to the new thread.
  - Edit then send POSTs `messageIds` = the active branch and `messages` = only the new ones.
  - Auth headers from `MASTRA_AUTH` appear on every request (chat and memory).
  - `generateTitle` resolves after the mock sets a title.
  - Approval: `respondToApproval({ approved: true })` triggers an automatic resubmit.
  - Ask-user: `addResult` triggers an automatic resubmit.
- [ ] **Step 3: Run them.** They should FAIL.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Run the gates.**
- [ ] **Step 6: Commit.** `feat(mastra): Mastra memory thread list, history, transport and auth for Angular`

### Task 15: Styled kit foundation (`angular-assistant-ui/ui`)

**Files:** `projects/assistant-ui-angular/ui/{ng-package.json,src/public-api.ts,src/styles.css,src/icons/*.ts,src/tooltip-icon-button.component.ts,src/collapsible/*.ts,src/dialog/*.ts,src/dropdown-menu/*.ts,src/button.directive.ts}` with specs. Ship `styles.css` as an asset at `angular-assistant-ui/ui/styles.css`. Add `@angular/cdk` as an optional peer and a devDependency. Add lucide (ISC) to NOTICE.

**Interfaces:**
- Tokens in `styles.css` on `:root`:
  - `--aui-background`, `--aui-foreground`, `--aui-muted`, `--aui-muted-foreground`, `--aui-border`, `--aui-accent`, `--aui-accent-foreground`, `--aui-primary`, `--aui-primary-foreground`, `--aui-destructive`, `--aui-ring`
  - `--aui-radius`, `--aui-font-sans`, `--aui-font-mono`, `--aui-space-1..8`, `--aui-shadow`

  Dark values go under `.aui-dark` and `@media (prefers-color-scheme: dark) { :root:not(.aui-light) }`. Component classes are `aui-*` with `data-*` state.
- Produces:
  - `aui-icon` (`name` input, inline SVG for the lucide icons used upstream: copy, check, refresh-cw, pencil, chevron-left/right, arrow-down, arrow-up, square, paperclip, x, file, thumbs-up/down, more-horizontal, archive, trash, plus, chevron-down, brain, wrench, loader, alert-circle)
  - `button[auiButton]` with variants `default | ghost | outline | destructive` and sizes `sm | md | icon`
  - `aui-tooltip-icon-button` with a `tooltip` input and `side`, using a CDK overlay tooltip on hover and focus
  - collapsible (root, trigger, content, `data-open`/`data-closed`, height animation via CSS)
  - dialog (CDK Dialog with a focus trap that restores focus)
  - dropdown menu (CDK overlay over Task 10's headless menu)
- [ ] **Step 1: Write failing specs.**
  - The tooltip appears on focus and on hover, and Escape hides it.
  - The dialog traps Tab and returns focus on close.
  - The collapsible toggles `data-open` and `aria-expanded`.
  - The dropdown menu opens below its trigger and supports arrow navigation.
  - The `styles.css` asset exists in `dist/` after the build (asserted by a build-output check script in `scripts/`).
- [ ] **Step 2: Run them.** They should FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the gates.**
- [ ] **Step 5: Commit.** `feat(ui): styled kit foundation: theme tokens, icons, button, tooltip, collapsible, dialog, dropdown`

### Task 16: Styled thread

**Port from:** the structure and class names in `UI/react/assistant-ui/elements/thread.aui.tsx` and `markdown-text.tsx`, plus `UI/vue/assistant-ui/{thread,message,markdown-text}.vue`. Translate the Tailwind classes to `styles.css` rules under the matching `aui-*` classes.

**Files:** `ui/src/thread/*.ts` (thread, welcome, composer, user-message, assistant-message, edit-composer, branch-picker, action-bars, message-error, scroll-to-bottom, history-skeleton), `ui/src/markdown-text.component.ts` (styled code header + copy), `ui/src/thread-components.token.ts` and specs.

**Interfaces:**
- Produces `aui-thread`.
  - Inputs: `welcome?: { message?: string; suggestions?: ... }`, `assistantAvatar?`, `composerPlaceholder` (default `"Send a message..."`).
  - Content slots are overridable through `AUI_THREAD_COMPONENTS: InjectionToken<Partial<AuiThreadComponents>>`, where `AuiThreadComponents = { UserMessage; AssistantMessage; EditComposer; Composer; Welcome; ToolFallback; Text; Reasoning }`, each a component `Type`.
- `aui-markdown-text-styled` (exported as `AuiStyledMarkdownText`) wraps Task 11's renderer. Its code header shows the language and a copy button (copied state lasts 3000 ms).
- [ ] **Step 1: Write failing specs** (scripted runtime).
  - The welcome shows when the thread is empty and hides after the first message.
  - The user message shows its edit action, and the edit composer replaces it.
  - The assistant message shows copy and reload plus the branch picker when there are two or more branches.
  - The scroll-to-bottom button appears after scrolling up.
  - The error banner appears on an errored run.
  - The code block copy button flips its icon to check.
  - An override via `AUI_THREAD_COMPONENTS` replaces `UserMessage`.
  - axe-style checks: buttons have accessible names; tab order composer → send.
- [ ] **Step 2: Run them.** They should FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the gates.**
- [ ] **Step 5: Commit.** `feat(ui): styled thread, messages, composer, action bars, branch picker and markdown text`

### Task 17: Styled tool fallback (approval and ask-user), tool group, reasoning, attachments

**Port from:** `UI/react/assistant-ui/elements/{tool-fallback.aui.tsx,tool-group.aui.tsx,reasoning.aui.tsx,attachment.aui.tsx,image.tsx,file.tsx}` and `UI/vue/assistant-ui/{tool-fallback,reasoning}.vue` with their tests.

**Files:** `ui/src/tool-fallback/*.ts`, `ui/src/tool-group.component.ts`, `ui/src/reasoning.component.ts`, `ui/src/attachments/*.ts` and specs.

**Interfaces:**
- Produces `aui-tool-fallback` (usable as `AUI_THREAD_COMPONENTS.ToolFallback` and via `registerToolUI` fallback):
  - collapsible args and result
  - a running shimmer
  - an error state
  - a cancelled state, shown only when `status.reason === 'cancelled'`; never inferred from an idle thread (fixes the phase 1 demo issue)
  - an **approval card** (Approve/Deny and an optional reason textarea, calling `respondToApproval({ approved, reason })`)
  - an **approval receipt**
  - an **ask-user** form rendered when the part is `input-available` with an `askUser` shape (question, options as radio or checkbox per `multiple`, free-text fallback, submit calling `addResult`)
- Produces:
  - `aui-tool-group`, which collapses consecutive tool calls and uses scroll lock
  - `aui-reasoning`, a collapsible streaming reasoning text with a duration label and scroll lock
  - `aui-composer-attachments-styled`, `aui-composer-add-attachment-styled` and `aui-message-attachments-styled`, with image thumbs and a dialog preview
- [ ] **Step 1: Write failing specs** (port the Vue `tool-fallback.test.ts` cases).
  - The approval card's Approve calls `respondToApproval({ approved: true })` and shows the receipt.
  - Deny with a reason passes the reason.
  - Ask-user with options and `multiple=false` submits the selected option through `addResult`.
  - A running tool shows the shimmer, and an errored one shows the error.
  - The cancelled state only appears when cancelled.
  - The reasoning collapses after completion.
  - Clicking an attachment thumb opens the dialog, and Escape closes it, returning focus.
- [ ] **Step 2: Run them.** They should FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the gates.**
- [ ] **Step 5: Commit.** `feat(ui): tool fallback with approval and ask-user, tool group, reasoning and attachments`

### Task 18: Styled thread list, sidebar, assistant modal, quote, follow-ups, feedback, timing

**Port from:** `UI/react/assistant-ui/elements/{thread-list.aui.tsx,threadlist-sidebar.aui.tsx,assistant-sidebar.aui.tsx,assistant-modal.aui.tsx,quote.aui.tsx,follow-up-suggestions.aui.tsx,message-timing.aui.tsx,composer-trigger-popover.aui.tsx}`, `UI/vue/assistant-ui/thread-list.vue` and its test, and `useThreadListGroups`.

**Files:** `ui/src/thread-list/*.ts`, `ui/src/thread-list-sidebar.component.ts`, `ui/src/assistant-modal.component.ts`, `ui/src/quote/*.ts`, `ui/src/follow-up-suggestions.component.ts`, `ui/src/message-timing.component.ts`, `ui/src/composer-trigger-popover.component.ts` and specs.

**Interfaces:**
- Produces:
  - `aui-thread-list`: new button, search input, date groups (Today, Yesterday, Previous 7 days, Previous 30 days, Older), items with a more-menu (rename, archive, delete), an archived section toggle, load-more and skeletons while loading
  - `aui-thread-list-sidebar`: a responsive layout with the thread list plus a projected main area; it collapses to a toggleable drawer below 768px
  - `aui-assistant-modal`: a floating launcher with a CDK-overlay panel holding `aui-thread`
  - `aui-quote-composer` and `aui-selection-toolbar-styled`
  - `aui-follow-up-suggestions`
  - `aui-message-timing`
  - `aui-composer-trigger-popover-styled`
- [ ] **Step 1: Write failing specs.**
  - Search filters titles case-insensitively.
  - Grouping places a thread from 3 days ago under "Previous 7 days" (fake clock).
  - Rename via the more-menu calls `rename`.
  - The archived toggle shows archived threads.
  - The sidebar drawer toggles below 768px.
  - The modal launcher opens and closes, trapping focus.
  - Follow-ups render after a completed run.
- [ ] **Step 2: Run them.** They should FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the gates.**
- [ ] **Step 5: Commit.** `feat(ui): thread list, sidebar, assistant modal, quote, follow-ups, timing, trigger popover`

### Task 19: Demo: the full chat app

**Files:** under `projects/demo/src/app/`: `chat/*`, `app.config.ts`, `app.routes.ts` (routes `/` full app and `/modal` assistant-modal page), `public/config.json` (adds `agentId`), `styles` (import `angular-assistant-ui/ui/styles.css`), and demo specs. Remove the hand-rolled weather spinner in favour of the kit's tool states, keeping the custom `WeatherCard` tool UI.

**Interfaces:**
- Consumes Tasks 11–18.
- Provides `MASTRA_AUTH` from runtime config (dev mode sends no token; the server runs `MASTRA_AUTH_MODE=dev`), `provideShikiHighlighter()`, `MastraThreads` + `mastraThreadListAdapter` + `createMastraTransport`, suggestions (3 starters), the feedback adapter (console + toast) and a dark-mode toggle.
- [ ] **Step 1: Write failing demo specs** (scripted transport plus the mock Mastra server).
  - The app renders the sidebar and thread.
  - New thread works.
  - Sending shows markdown with a highlighted code block.
  - The approval tool card approve path works.
  - The ask-user path works.
  - The dark toggle sets `.aui-dark`.
- [ ] **Step 2: Run them.** `npm run test:demo` should FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run test:demo`, `npm run build:demo` and the gates. All PASS.
- [ ] **Step 5: Commit.** `feat(demo): full chat app with thread list, markdown, attachments, approvals and ask-user tools`

### Task 20: Compat, CI and docs

**Files:** `compat/ng18|ng20|ng22/src/**`, `compat/smoke.spec.ts`, `scripts/compat.mjs`, `.github/workflows/ci.yml`, `README.md`, `projects/assistant-ui-angular/README.md`, `docs/porting.md`, `docs/deployment.md`, a new `docs/styling.md` and a new `docs/mastra.md`.

- [ ] **Step 1: Extend the compat apps.** Each renders `aui-thread` + `aui-thread-list` (with the in-memory thread list) against the scripted transport, with identical source apart from the bootstrap.
- [ ] **Step 2: Add smoke tests.**
  - Markdown bold and a code block render.
  - Edit → branch picker shows "2/2" and Previous shows "1/2".
  - An attachment chip appears after `setInputFiles`.
  - An approval click-through renders the receipt.
  - The thread list new/switch works.
  - `styles.css` loads (computed `--aui-background` is non-empty).
- [ ] **Step 3: Run compat.** `npm run compat -- ng18` and `-- ng20` must PASS. For ng22, run `npx -y -p node@24.15.0 -- node scripts/compat.mjs ng22`; it must PASS.
- [ ] **Step 4: Update CI.** CI builds and packs all secondary entries. The compat job checks the `ui/styles.css` asset and LICENSE/NOTICE in the pack.
- [ ] **Step 5: Docs.**
  - `docs/porting.md`: every row is `ported` or `n/a (reason)`. Zero `planned` rows. A script check, `scripts/check-parity.mjs`, fails CI on any `planned`.
  - `docs/styling.md`: tokens, dark mode, overriding classes, Tailwind mapping.
  - `docs/mastra.md`: the server setup, auth modes (crowsnest plugs in a jwt verifier), memory, branch persistence semantics, attachments and size limits, approvals and ask-user.
  - READMEs: install per entry and the compat table.
- [ ] **Step 6: Run the gates** plus `node scripts/check-parity.mjs`. All PASS.
- [ ] **Step 7: Commit.** `test(compat): styled kit smoke across Angular 18/20/22; docs and parity gate`

### Task 22: Model context, frontend tools, interactables, runtime helpers

_Added during execution by ledger ruling R7 (Task 1 review). It runs in wave 3._

**Port from:**
- `C/react/model-context/*`: `useAssistantInstructions`, `useAssistantContext`, `makeAssistantVisible`, `useAssistantTool`, `makeAssistantTool`, `useAssistantToolUI`
- the tool, toolkit and interactable sources named in `docs/porting.md`'s Task 22 rows
- `V/__tests__/primitives-tool-ui.test.ts` (the `Tools` usage)

**Files:**
- `lib/model-context/{instructions,context,visible}.ts`
- `lib/tools/{register-tool,toolkit}.ts`
- `lib/interactables/*.ts`
- `lib/runtime/re-exports.ts`
- specs for each

**Interfaces:**
- `injectAssistantInstructions(instructions: string | Signal<string> | { instruction; disabled? })` registers model-context instructions for the injector's lifetime.
- `injectAssistantContext(getContext: () => string)` and `[auiAssistantVisible]`, the Angular equivalent of `makeAssistantVisible`.
- `registerTool(tool: ToolDefinition)` and `registerToolkit(toolkit)` register frontend tools (execute in the browser, `type: 'frontend' | 'human'`) in model context and unregister on destroy. They combine with `registerToolUI`.
- The tool-override and interactable registration and state injectors follow the porting.md rows.
- Re-exports of the core runtime contracts and clients listed in porting.md, with Angular-shaped factories wherever the React hook only wraps a core function.

**Steps:**
- [ ] **Step 1: Write failing specs.**
  - Registered instructions appear in `aui.thread().getModelContext().system`, and destroying the component removes them.
  - A registered frontend tool appears in `getModelContext().tools`; when the scripted transport emits a call to it, its `execute` runs and the result is added.
  - A `human` tool waits for `addResult`.
  - Interactable state round-trips.
- [ ] **Step 2: Run them.** All should FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the gates.**
- [ ] **Step 5: Commit** with `feat(lib): model context, frontend tools, interactables and runtime helpers`.

### Task 21: Final review, fix wave, live smoke (controller)

- [ ] **Step 1: Whole-branch review** of `main..phase-2` on Codex `gpt-6.1-sol` (reasoningEffort `high`), using the requesting-code-review `code-reviewer.md` template, the spec, this plan and the ledger.
- [ ] **Step 2: One fix wave** with all findings, then one scoped re-review on `gpt-6.1-sol`.
- [ ] **Step 3: Live smoke** (the controller only, with the OpenRouter key copied into the git-ignored `mastra-server/.env`, then deleted). Run the server with `MASTRA_AUTH_MODE=dev MASTRA_DEV_AUTH=1` and the demo. Verify:
  - a thread is created and titled
  - markdown and code highlight
  - the weather tool card
  - `bookMeeting` approval end to end
  - `askUser` end to end
  - an image attachment is described by a vision-capable free model (or recorded as unsupported)
  - reload restores history
  - edit then reload shows the active branch
  - archive and delete
- [ ] **Step 4: Finish.** Push `phase-2`, open a PR, wait for CI, then merge per the user's standing instruction ("set it up properly, then start phase 2").
