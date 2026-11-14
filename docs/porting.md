# Porting notes: assistant-ui Vue to Angular

Upstream: https://github.com/assistant-ui/assistant-ui
Ported from commit: `7d7427653f6ba47b0b954510eed9c594d64e74d5` (packages/vue)

## Translation rules

| Vue                       | Angular                                     |
| ------------------------- | ------------------------------------------- |
| slot                      | `ng-template` / content projection          |
| `useX` composable         | `injectX` function                          |
| `onScopeDispose`          | `DestroyRef.onDestroy`                      |
| `computed` / `shallowRef` | `computed` / `signal`                       |
| props                     | `input()` / `input.required()`              |
| emits                     | `output()`                                  |
| `provide` / `inject`      | `InjectionToken` + `providers` / `inject()` |
| `v-if` / `v-for`          | `@if` / `@for`                              |

Ported Vue tests are ported alongside the code where they test behaviour (not
Vue specifics). Library code uses only Angular APIs stable in 18.2.

## Parity table

Keyed by the **React** export (`packages/react/src/primitives/*.ts` and `packages/react/src/index.ts`),
the public contract a chat app uses. Columns: the export, whether the upstream Vue binding has it, the
Angular status and the phase 2 task that owns it.

Status is `ported`, `planned (Task N)` or `n/a (<reason>)`. Each task flips only its own rows.

### Store, context and scope

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| AuiProvider | yes | ported |  |
| AuiIf | yes | ported (as `*auiIf`) |  |
| useAui | yes | ported (as `injectAui`) |  |
| useAuiState | yes | ported (as `injectAuiState`) |  |
| useAuiEvent | yes | ported (as `injectAuiEvent`) |  |
| AuiConfig, Derived, createAssistantClient and the store types (`AssistantClient`, `AssistantState`, `AssistantEvent*`, `Unsubscribe`) | yes | ported (re-exports of `@assistant-ui/store/client`) |  |
| MessageByIdProvider, `ThreadPrimitive.MessageByIndex`, `ThreadPrimitive.Unstable_MessageById` | yes | n/a (internal: `aui-scope-outlet` + `messageScopeConfig`) |  |
| PartByIndexProvider, `MessagePrimitive.PartByIndex` | yes | n/a (internal: `aui-scope-outlet` + `partScopeConfig`) |  |
| AttachmentByIndexProvider, `ComposerPrimitive.AttachmentByIndex`, `MessagePrimitive.AttachmentByIndex` | yes | planned (Task 6) (internal: `indexScopeConfig` kind `attachment`) | Task 6 |
| SuggestionByIndexProvider, `ThreadPrimitive.SuggestionByIndex` | yes | planned (Task 7) (internal: `indexScopeConfig` kind `suggestion`) | Task 7 |
| ThreadListItemByIndexProvider, `ThreadListPrimitive.ItemByIndex` | yes | planned (Task 8) (internal: `indexScopeConfig` kind `threadListItem`) | Task 8 |
| QueueItemByIndexProvider (scope of `ComposerPrimitive.Queue`) | no | planned (Task 5) (internal: `indexScopeConfig` kind `queueItem`) | Task 5 |
| ChainOfThoughtPartByIndexProvider (scope of `ChainOfThoughtPrimitive.Parts`) | yes | planned (Task 9) (internal: `indexScopeConfig` kind `chainOfThoughtPart`) | Task 9 |
| `ThreadPrimitive.ViewportProvider`, `useThreadViewport`, `useThreadViewportStore`, `ThreadViewportState` | no | n/a (Angular has `AUI_VIEWPORT` / `injectAuiViewport`) |  |
| `useThreadRootElementRef` (`ThreadRootElementContext`) | no | n/a (the root directive owns its element; consumers use their own template refs) |  |
| `createActionButton`, `Primitive`, `withRenderProp`, `RequireAtLeastOne`, `DropdownMenuRender*` | no | n/a (React-only plumbing: attribute directives and `injectActionButton` replace asChild and render props) |  |

### Thread (`ThreadPrimitive`)

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| ThreadPrimitive.Root | yes | ported |  |
| ThreadPrimitive.Viewport | partial (no turnAnchor or clamp) | ported; `turnAnchor` and `topAnchorMessageClamp` planned | Task 2 |
| useThreadViewportAutoScroll | yes (via `createThreadViewportAutoScroll`) | ported (built into the viewport directive) |  |
| ThreadPrimitive.ViewportFooter | yes | planned (Task 2) | Task 2 |
| ThreadPrimitive.Messages | yes | ported |  |
| ThreadPrimitive.Row, `createThreadRowsSelector`, `ThreadRow`, `ThreadRowsOptions` | no | n/a (virtualized-list API; optional, not in the agreed scope) |  |
| ThreadPrimitive.ScrollToBottom | yes | planned (Task 2) | Task 2 |
| ThreadPrimitive.LoadEarlier | no | planned (Task 2) | Task 2 |
| ThreadPrimitive.Suggestions | yes | planned (Task 7) | Task 7 |
| ThreadPrimitive.Suggestion | no (use `SuggestionPrimitiveTrigger`) | planned (Task 7) (covered by `button[auiSuggestionTrigger]`) | Task 7 |
| ThreadPrimitive.Empty, ThreadPrimitive.If (deprecated) | no | n/a (deprecated upstream; use `*auiIf`) |  |
| useScrollLock | yes | planned (Task 2) | Task 2 |
| `unstable_useThreadMessageIds`, `useThreadMessages`, `useThreadIsRunning` and the other thread selector hooks | no | n/a (read `injectAuiState((s) => s.thread...)`) |  |

### Message (`MessagePrimitive`)

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| MessagePrimitive.Root | yes | ported |  |
| MessagePrimitive.Parts / Content | yes | ported |  |
| MessagePrimitive.GroupedParts, `groupPartByType`, `GroupByContext` | no | planned (Task 3) | Task 3 |
| MessagePrimitive.Attachments | yes | planned (Task 6) | Task 6 |
| MessagePrimitive.Error, useMessageError | no | planned (Task 3) (via the `messageErrorText` predicate) | Task 3 |
| MessagePrimitive.Quote, `useMessageQuote`, `getMessageQuote` | no | planned (Task 3) | Task 3 |
| MessagePrimitive.If (deprecated) | no | n/a (deprecated upstream; use `*auiIf`) |  |
| MessagePrimitive.GenerativeUI, `GenerativeUIRender`, `generativeUI` parts config | no | n/a (generative UI out of scope) |  |
| MessagePrimitive.Unstable_PartsGrouped, Unstable_PartsGroupedByParentId | no | n/a (deprecated upstream; prefer GroupedParts) |  |
| useMessageTiming | no | planned (Task 18) | Task 18 |
| useToolCallElapsed | no | planned (Task 17) | Task 17 |
| `unstable_useMessageStallDetection` | no | n/a (experimental; no chat-app need) |  |

### Message part (`MessagePartPrimitive`) and tool UI

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| MessagePartPrimitive.Text, useSmooth, `SmoothOptions` | no | planned (Task 3) | Task 3 |
| MessagePartPrimitive.Image | no | planned (Task 3) | Task 3 |
| MessagePartPrimitive.InProgress | no | planned (Task 3) | Task 3 |
| PartPrimitive.Messages | no | n/a (nested sub-thread messages; optional, not in the agreed scope) |  |
| useMessagePartText, useMessagePartReasoning, useMessagePartSource, useMessagePartFile, useMessagePartImage, useMessagePartData | no | n/a (read `injectAuiState((s) => s.part)`) |  |
| makeAssistantToolUI, useAssistantToolUI, `ToolCallMessagePartProps` | yes | ported (as `registerToolUI` and `ToolUIProps`) |  |
| makeAssistantDataUI, useAssistantDataUI, `DataMessagePartProps` | yes | ported (as `registerToolUI` and `DataUIProps`) |  |
| `unstable_recordInteraction` | no | ported (`ToolUIProps.unstable_recordInteraction`) |  |
| useToolArgsStatus, `ToolArgsStatus` | no | planned (Task 17) | Task 17 |
| makeAssistantTool, useAssistantTool, `tool`, `Tools`, `Toolkit`, `ToolDefinition`, `defineToolkit`, `defineMcpToolkit`, `humanTool`, `externalTool`, `useAuiToolOverrides`, `useInlineRender` | no | n/a (React tool-registration plumbing; Angular registers renderers with `registerToolUI` and tools live on the server) |  |
| useAssistantInstructions, useAssistantContext, makeAssistantVisible, `ModelContext*`, `mergeModelContexts`, `ModelContextRegistry` | no | n/a (not needed by a chat app; reachable through `injectAui().modelContext`) |  |
| Interactables (`unstable_Interactables`, `unstable_useInteractable*`, `unstable_interactableTool`) | no | n/a (experimental; no chat-app need) |  |
| AssistantFrameHost, AssistantFrameProvider, `useAssistantFrameHost`, WebMCP `convertTools`, mcp-apps | no | n/a (MCP apps and frames out of scope) |  |

### Composer (`ComposerPrimitive`, `QueueItemPrimitive`)

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| ComposerPrimitive.Root | no | ported; form submit handling planned | Task 5 |
| ComposerPrimitive.Input | partial (`submitOnEnter`) | ported; full props planned | Task 5 |
| ComposerPrimitive.Send | yes | ported |  |
| ComposerPrimitive.Cancel | yes | ported |  |
| ComposerPrimitive.AddAttachment | yes | planned (Task 6) | Task 6 |
| ComposerPrimitive.Attachments | yes | planned (Task 6) | Task 6 |
| ComposerPrimitive.AttachmentDropzone | yes | planned (Task 6) | Task 6 |
| ComposerPrimitive.Quote, QuoteText, QuoteDismiss | no | planned (Task 5) | Task 5 |
| ComposerPrimitive.Queue | no | planned (Task 5) | Task 5 |
| QueueItemPrimitive.Text, Steer, Remove | no | planned (Task 5) | Task 5 |
| ComposerPrimitive.TriggerPopoverRoot, TriggerPopover, TriggerPopoverCategories, TriggerPopoverCategoryItem, TriggerPopoverItems, TriggerPopoverItem, TriggerPopoverBack, `TriggerMatch`, `TriggerMatcher` | no | planned (Task 10) | Task 10 |
| `Unstable_TriggerPopover*` aliases and `unstable_useTriggerPopover*Context` hooks | no | n/a (deprecated aliases and React context hooks) |  |
| ComposerPrimitive.Resume | no | n/a (cloud and resumable run state out of scope) |  |
| ComposerPrimitive.Dictate, StopDictation, DictationTranscript, `DictationAdapter`, `WebSpeechDictationAdapter` | no | n/a (dictation out of scope) |  |
| ComposerPrimitive.If (deprecated) | no | n/a (deprecated upstream; use `*auiIf`) |  |
| useComposerSend, useComposerCancel, useComposerResume, useComposerAddAttachment, useEditComposerSend, useEditComposerCancel | no | n/a (the directives use the core predicates; other code calls `injectAui().composer`) |  |

### Action bar and branch picker (`ActionBarPrimitive`, `ActionBarMorePrimitive`, `BranchPickerPrimitive`)

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| ActionBarPrimitive.Root | yes | planned (Task 4) | Task 4 |
| ActionBarPrimitive.Copy, useActionBarCopy, useCopyToClipboard | yes | planned (Task 4) | Task 4 |
| ActionBarPrimitive.Reload, useMessageReload | yes | planned (Task 4) | Task 4 |
| ActionBarPrimitive.Edit | yes | planned (Task 4) | Task 4 |
| ActionBarPrimitive.FeedbackPositive, FeedbackNegative, `FeedbackAdapter`, `SubmitFeedbackOptions` | no | planned (Task 4) | Task 4 |
| ActionBarPrimitive.ExportMarkdown | no | planned (Task 4) | Task 4 |
| ActionBarPrimitive.Speak, StopSpeaking, `SpeechSynthesisAdapter`, `WebSpeechSynthesisAdapter` | no | n/a (speech out of scope) |  |
| ActionBarPrimitive.Resume, RefreshRun | no | n/a (cloud and resumable run state out of scope) |  |
| ActionBarMorePrimitive.Root, Trigger, Content, Item, Separator | no | planned (Task 10) | Task 10 |
| BranchPickerPrimitive.Root | no | planned (Task 4) | Task 4 |
| BranchPickerPrimitive.Previous, Next, useMessageBranching | yes | planned (Task 4) | Task 4 |
| BranchPickerPrimitive.Number | yes | planned (Task 4) | Task 4 |
| BranchPickerPrimitive.Count | yes | planned (Task 4) | Task 4 |

### Error (`ErrorPrimitive`)

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| ErrorPrimitive.Root | yes | planned (Task 3) | Task 3 |
| ErrorPrimitive.Message | yes | planned (Task 3) | Task 3 |

### Attachments (`AttachmentPrimitive`)

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| AttachmentPrimitive.Root | yes | planned (Task 6) | Task 6 |
| AttachmentPrimitive.Name | yes | planned (Task 6) | Task 6 |
| AttachmentPrimitive.unstable_Thumb | yes (`AttachmentPrimitiveThumb`) | planned (Task 6) | Task 6 |
| AttachmentPrimitive.Remove | yes | planned (Task 6) | Task 6 |
| `AttachmentAdapter`, `SimpleImageAttachmentAdapter`, `SimpleTextAttachmentAdapter`, `CompositeAttachmentAdapter` | no | planned (Task 6) (re-exported from core) | Task 6 |
| `CloudFileAttachmentAdapter` | no | n/a (Assistant Cloud out of scope) |  |
| useAttachmentSrc (kit hook) | no | planned (Task 17) | Task 17 |

### Suggestions (`SuggestionPrimitive`)

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| SuggestionPrimitive.Trigger, useSuggestionTrigger | yes | planned (Task 7) | Task 7 |
| SuggestionPrimitive.Title | yes | planned (Task 7) | Task 7 |
| SuggestionPrimitive.Description | yes | planned (Task 7) | Task 7 |
| Suggestions (client), `SuggestionConfig`, `ThreadSuggestion`, createSuggestionAdapter, `SuggestionAdapter` | yes (`Suggestions`) | planned (Task 7) (re-exported from core) | Task 7 |

### Thread list (`ThreadListPrimitive`, `ThreadListItemPrimitive`)

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| ThreadListPrimitive.Root | yes | planned (Task 8) | Task 8 |
| ThreadListPrimitive.New | yes | planned (Task 8) | Task 8 |
| ThreadListPrimitive.Items | yes | planned (Task 8) | Task 8 |
| ThreadListPrimitive.LoadMore | yes | planned (Task 8) | Task 8 |
| ThreadListItemPrimitive.Root | yes | planned (Task 8) | Task 8 |
| ThreadListItemPrimitive.Trigger (and the thread list focus group) | yes | planned (Task 8) | Task 8 |
| ThreadListItemPrimitive.Title | yes | planned (Task 8) | Task 8 |
| ThreadListItemPrimitive.Archive, Unarchive, Delete | yes | planned (Task 8) | Task 8 |
| ThreadListItemMorePrimitive.Root, Trigger, Content, Item, Separator | no | planned (Task 10) | Task 10 |
| InMemoryThreadListAdapter, `RemoteThreadListAdapter`, `ThreadHistoryAdapter` | no | planned (Task 14) (Mastra entry builds on core `RemoteThreadList`) | Task 14 |
| useRemoteThreadListRuntime | no | n/a (React hook; Angular uses `RemoteThreadList` through the Mastra entry) |  |
| useCloudThreadListRuntime, useCloudThreadListAdapter, `AssistantCloud` | no | n/a (Assistant Cloud out of scope) |  |

### Chain of thought (`ChainOfThoughtPrimitive`)

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| ChainOfThoughtPrimitive.Root | yes (via scope) | planned (Task 9) | Task 9 |
| ChainOfThoughtPrimitive.AccordionTrigger | yes | planned (Task 9) | Task 9 |
| ChainOfThoughtPrimitive.Parts | yes | planned (Task 9) | Task 9 |

### Selection toolbar and assistant modal

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| SelectionToolbarPrimitive.Root, Quote, `getSelectionMessageId` | no | planned (Task 10) | Task 10 |
| AssistantModalPrimitive.Root, Trigger, Anchor, Content | no | planned (Task 10) | Task 10 |

### Runtimes, adapters and utilities re-exported by the React index

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| useLocalRuntime, useExternalStoreRuntime, useAISDKRuntime, useChatRuntime, useAssistantTransportRuntime | no | n/a (React runtime hooks; Angular binds `AssistantRuntimeImpl` through the provider and the Mastra entry) |  |
| `ExternalStoreAdapter` and related types, `ExportedMessageRepository`, `ThreadMessageLike`, `fromThreadMessageLike`, `generateId` | no | n/a (import from `@assistant-ui/core`) |  |
| Runtime, message, part and attachment types (`AssistantRuntime`, `ThreadRuntime`, `ComposerRuntime`, ...) | no | n/a (import from `@assistant-ui/core`) |  |
| `MessageNotSentError`, `isMessageNotSentError`, `toolApprovalAcceptsText` | no | n/a (import from `@assistant-ui/core`) |  |
| useMediaQuery | no | n/a (use `matchMedia` or the CDK `BreakpointObserver`) |  |
| OpenAIRealtimeVoiceAdapter, GeminiLiveVoiceAdapter, createVoiceSession, useVoiceState, useVoiceVolume, useVoiceControls, `RealtimeVoiceAdapter` | no | n/a (voice out of scope) |  |
| DevToolsHooks | no | n/a (devtools out of scope) |  |
| LangGraph and A2A runtimes | no | n/a (out of scope) |  |

### Entry points added in phase 2

The secondary entries have no upstream package at the same granularity; their planned exports are listed
here so the table covers them.

| Entry | Planned exports | Status |
| --- | --- | --- |
| `angular-assistant-ui/markdown` | `aui-markdown-text` (inputs `smooth`, `preprocess`, `components`, `componentsByLanguage`), `AuiCodeHeader`, `AUI_SYNTAX_HIGHLIGHTER`, `AuiSyntaxHighlighter`, `AuiMarkdownComponents`, vendored `createMarkdownSession`, `normalizeMathDelimiters`, `escapeCurrencyDollars` | planned (Task 11) |
| `angular-assistant-ui/shiki` | `provideShikiHighlighter` | planned (Task 12) |
| `angular-assistant-ui/mastra` | `MastraThreads`, `createMastraTransport`, `mastraThreadListAdapter`, `MASTRA_AUTH`, `MastraAuth` (and `createMockMastraServer` in the testing entry) | planned (Task 14) |
| `angular-assistant-ui/ui` (foundation) | `styles.css` tokens, `aui-icon`, `button[auiButton]`, `aui-tooltip-icon-button`, collapsible, dialog, dropdown menu | planned (Task 15) |
| `angular-assistant-ui/ui` (thread) | `aui-thread`, `AUI_THREAD_COMPONENTS`, `AuiThreadComponents`, `aui-markdown-text-styled` (`AuiStyledMarkdownText`) | planned (Task 16) |
| `angular-assistant-ui/ui` (tools and media) | `aui-tool-fallback` (approval card, ask-user form), `aui-tool-group`, `aui-reasoning`, `aui-composer-attachments-styled`, `aui-composer-add-attachment-styled`, `aui-message-attachments-styled` | planned (Task 17) |
| `angular-assistant-ui/ui` (thread list and extras) | `aui-thread-list`, `aui-thread-list-sidebar`, `aui-assistant-modal`, `aui-quote-composer`, `aui-selection-toolbar-styled`, `aui-follow-up-suggestions`, `aui-message-timing`, `aui-composer-trigger-popover-styled` | planned (Task 18) |
| `angular-assistant-ui/testing` | `createScriptedChatTransport` (no upstream counterpart); approval, ask-user, attachment and thread-list helpers | ported; extensions planned (Tasks 4-9, 14) |

The store re-exports (`AuiConfig`, `Derived`, `createAssistantClient` and the store types) are
`@assistant-ui/store/client` re-exports, as upstream's Vue binding does.

## Porting the next primitive

1. Find the Vue source in `packages/vue/src` and its tests (also check
   `packages/svelte/src` for extra cases). Start the Angular file with
   `// Ported from packages/vue/src/<path> @ <sha>`.
2. Apply the translation rules above. Library code may use only Angular APIs
   available in 18.2: no `effect()`, `linkedSignal`, `resource` or `afterRender`.
3. Make it standalone with `ChangeDetectionStrategy.OnPush`, `inject()` only,
   `host: {}` metadata (no `@HostBinding`/`@HostListener`) and the `aui` selector
   prefix. Prefer attribute directives on the user's own elements over wrapper
   components.
4. Flow state as store subscription, then signal, then `computed`. Never read store
   state in a constructor: the client is created on the provider's first
   `ngOnChanges`. Under zoneless, call `markForCheck()` when creating or
   destroying views from a callback.
5. Port the relevant tests. They must pass in both the `zone` and `zoneless`
   projects (`npm run test:lib`) with pristine output.
6. Add TSDoc, export from `projects/assistant-ui-angular/src/public-api.ts`, flip the
   parity row to `ported`, and run `npm run lint` and `npm run build:lib`.

## Known follow-ups

Found in the phase 1 final review and deliberately not done in phase 1.

- Demo runtime config is not validated, and a missing `mastraChatUrl` silently falls back to
  localhost in production builds. Validate it as a non-empty absolute URL and `console.error` when
  falling back in a non-dev build.
- `docs/deployment.md` has no middleware snippet. Add a `server.middleware` bearer-token check example.
- No test for an explicit `extends` client that differs from the injected context.
- No test for `scrollToBottomOnThreadSwitch` or `threads.selectionChanged` (thread lists are phase 2).
- Composer autosize ignores padding and border, so a padded textarea can scroll one line early at
  `maxRows`; the autosize test bound also passes trivially.
- The empty-text send test does not assert the `onNew` call count.
- No test for the "no `tools` scope" dev warning in `registerToolUI`.
- The message config memo in `aui-thread-messages` is not pruned when the id list becomes empty (harmless).
- An early store listener that throws in `create()` stops notifying the remaining early listeners.
  No current listener throws; wrapping each in `try/catch` would harden it.
- CI (`.github/workflows/ci.yml`) has never run: no remote exists yet. Push, get a green `verify` and
  three `compat` jobs, and record the run before relying on the compat table.
- The compat smoke covers tool UI, `*auiIf` and cancel, but the Angular 22 (zoneless) app has so far
  only been type-checked with its own `ngc` locally, because the Angular 22 CLI needs Node
  `^22.22.3` or `^24.15.0`. Run `npm run compat -- ng22` on such a Node.
- Before any npm publish, add `description`, `repository`, `author` and `keywords` to the library
  `package.json` and pick the final package name.
