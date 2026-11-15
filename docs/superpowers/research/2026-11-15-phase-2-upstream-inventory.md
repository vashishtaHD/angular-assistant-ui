# Phase 2 inventory: what upstream ships that a chat app uses

Upstream SHA `7d7427653f6ba47b0b954510eed9c594d64e74d5`. Paths are relative to the root of a local checkout of
upstream assistant-ui at that SHA. Abbreviations: `R` = `packages/react/src`, `C` = `packages/core/src`,
`CR` = `packages/core/src/react`, `V` = `packages/vue/src`, `S` = `packages/store/src`,
`UI` = `packages/ui/src/components`.

Legend for the Vue column: **yes** = exported by `V/index.ts`; **partial** = exported with fewer props
than React; **provider** = only the internal `*ByIndexProvider` exists; **no** = absent.
Angular column: **done** = ported in phase 1 (per `docs/porting.md`), **todo** = a phase 2 item.
Scope column: **CHAT** = needed for a chat app, **OPT** = optional/nice to have, **n/a** = out of scope by agreement.

## 0. Architecture facts that shape phase 2

1. React primitives are thin. Most behaviour lives in **framework-neutral predicates and clients**:
   - `C/store/primitive-predicates.ts` exports the shared "disabled" selectors (`composerSendDisabled`,
     `composerResumeDisabled`, `composerCancelDisabled`, `composerInputDisabled`, `actionBarEditDisabled`,
     `actionBarReloadDisabled`, `actionBarRefreshRunDisabled`, `actionBarResumeDisabled`, `actionBarCopyDisabled`,
     `actionBarSpeakDisabled`, `branchPickerPreviousDisabled`, `branchPickerNextDisabled`, `suggestionSendMode`,
     `suggestionTriggerDisabled`, `messageErrorText`, `threadListLoadMoreDisabled`,
     `threadListItemUnarchiveDisabled`). Import path used by Vue: `@assistant-ui/core/store/internal`.
     The Angular port should use these, not re-derive the rules.
   - `S/utils/thread-viewport-auto-scroll.ts` exports `createThreadViewportAutoScroll` (via
     `@assistant-ui/store/client`). It is the whole auto-scroll engine (attach, isAtBottom, scrollToBottom,
     messagesPrepended, registerContentInset, setHasMessages, runStarted, threadSwitched, dispose). Vue and Svelte
     both call it. Phase 1 viewport already depends on it.
2. `@assistant-ui/core/react` (`CR/index.ts`) is **not** React-free: it exports tap `resource`s (`Tools`,
   `DataRenderers`, `RemoteThreadList`, `useRemoteThreadListRuntime`, ...) and React components. The Vue binding
   still imports `Tools` from it (`V/__tests__/primitives-tool-ui.test.ts`) and `RuntimeAdapter`/`Suggestions`
   from `@assistant-ui/core/store`, relying on tap's standalone shim. Same approach is available to Angular.
3. The Vue binding is a **subset of React even inside a family**:
   - `V/primitives/ThreadPrimitiveViewport.ts` has only `autoScroll`, `scrollToBottomOnInitialize`,
     `scrollToBottomOnRunStart`, `scrollToBottomOnThreadSwitch`. **No `turnAnchor`/`topAnchorMessageClamp`**
     ("the React viewport's top-anchor system ... is not ported").
   - `V/primitives/ComposerPrimitiveInput.ts` has only `submitOnEnter`. No `submitMode`, `cancelOnEscape`,
     `addAttachmentOnPaste`, focus-on-run-start/thread-switch/scroll, touch-Enter, trigger-popover aria.
   - `ActionBarPrimitiveCopy` has `copiedDuration` only (no `copyToClipboard` injection).
   - No smooth streaming, no markdown, no `MessagePartPrimitive.*`, no `Root` for ComposerPrimitive,
     ActionBarPrimitive or BranchPickerPrimitive. The Vue kit renders markdown with raw `markdown-it`
     (`UI/vue/assistant-ui/markdown-text.vue`).
   - So "port everything Vue has" is **not** "no gaps". Section 1 lists React-only items separately.
4. Svelte binding (`packages/svelte/src`) is a second reference: `primitives/{actionBar,branchPicker,composer,messageParts,observedItem,suggestions,threadList,threadMessages,threadViewport,threadViewportFooter}.ts`.
5. The styled kit is Tailwind v4 + Base UI (default) or Radix (`.radix` twins) + cva + lucide-react. There is
   **no framework-neutral style layer** (no CSS file of component styles; `UI/../globals.css` is just
   `@import "tailwindcss"`). See section 4.
6. The Mastra docs (`apps/docs/content/docs/integrations/frameworks/mastra/{overview,full-stack,separate-server}.mdx`)
   describe no Mastra-specific runtime package: the frontend is `@assistant-ui/ai-sdk` `useChatRuntime` +
   `AssistantChatTransport` against Mastra `chatRoute({ path: "/chat/:agentId", version: "v7" })`. Everything
   the UI depends on (tool approval, attachments, history) therefore flows through the AI SDK runtime
   (`packages/ai-sdk/src`: `AISDKChat`, `AISDKThreads`, `useChatRuntime`, `AssistantChatTransport`,
   `frontendTools`, `AISDKToolkit`, `generativeTools`, `injectQuoteContext`, `getThreadMessageTokenUsage`).

---

## 1. Primitives

Every row: export, props, one-line behaviour, Vue, Angular, scope. Files are under `R/primitives/` unless noted.
"div props" means the element's native props plus `asChild`/`render` (React Slot pattern; Angular equivalent is
an attribute directive on the user's element).

Common mechanics:
- **Action buttons** (`R/utils/createActionButton.tsx`): a `<button type=button>` whose `onClick` is composed with a
  callback from a hook; the hook returns `null` to disable. Named forwarded props are passed to the hook, the rest
  go to the DOM. Behaviour hooks live in `CR/primitive-hooks/*`, predicates in `C/store/primitive-predicates.ts`.
- **Iterators** (`Messages`, `Parts`, `Attachments`, `Suggestions`, `Items`, `Queue`, `Parts` of chain of thought):
  `children` render-function receiving a lazy accessor (`RenderChildrenWithAccessor`) over a `*ByIndexProvider`
  scope; the older `components` config is deprecated. Keys come from stable ids (`getMessagePartKeys`,
  `getSuggestionKeys`).

### 1.1 thread (`R/primitives/thread.ts`)

| Export | Props | Behaviour | Vue | Angular | Scope |
|---|---|---|---|---|---|
| `ThreadPrimitive.Root` (`thread/ThreadRoot.tsx`) | div props | Wrapper; sets `data-aui-thread-root`, provides `ThreadRootElementContext`; Escape stops speech | yes `ThreadPrimitiveRoot` | done | CHAT |
| `.Viewport` (`thread/ThreadViewport.tsx`) | div props, `autoScroll` (default false if `turnAnchor="top"`), `turnAnchor: "top"\|"bottom"`, `topAnchorMessageClamp {tallerThan="10em", visibleHeight="6em"}`, `scrollToBottomOnRunStart/Initialize/ThreadSwitch` (default true) | Scroll container; registers viewport size, drives auto-scroll; top-anchor mode pins the newest user message to the top | partial (no turnAnchor/clamp) | done (scroll options only, check) | CHAT; turnAnchor OPT |
| `.ViewportProvider` (`R/context/providers/ThreadViewportProvider.tsx`) | children | React context provider for the viewport store (zustand `R/context/stores/ThreadViewport.ts`) | no | n/a (Angular has `AUI_VIEWPORT`) | n/a |
| `.ViewportFooter` (`thread/ThreadViewportFooter.tsx`) | div props | Measures own height (+margin-top) and registers it as content inset so auto-scroll clears a sticky composer; heights sum across footers | yes | todo | CHAT |
| `.Messages` (`CR/primitives/thread/ThreadMessages.tsx`) | `children({message})` or deprecated `components {Message, UserMessage, AssistantMessage, SystemMessage, EditComposer, UserEditComposer, AssistantEditComposer, SystemEditComposer}` | Renders one scoped child per message id | yes `ThreadPrimitiveMessages` | done | CHAT |
| `.MessageByIndex` | `index`, `components` | One message slot by index | provider only | n/a (internal) | OPT |
| `.Unstable_MessageById` | `messageId`, `components` | One message slot by id | `MessageByIdProvider` | n/a | OPT |
| `.Row` (`CR/primitives/thread/ThreadRow.tsx`) | `row: ThreadRow`, `children(info)` where info is `{type:"message"}`, `{type:"part"}` or `{type:"turn-end"}` | Renders a flattened row from `createThreadRowsSelector`; for custom/virtualized lists | no | todo | OPT |
| `.ScrollToBottom` (`thread/ThreadScrollToBottom.ts`) | button props, `behavior?: ScrollBehavior` | Button; disabled (callback null) while `isAtBottom` | yes | todo | CHAT |
| `.LoadEarlier` (`thread/ThreadLoadEarlier.tsx`) | button props | Calls `aui.thread().loadEarlier()`; disabled unless `thread.hasEarlier`; second press joins in-flight load; `thread.isLoadingEarlier` for progress | no | todo | CHAT if history is paged |
| `.Suggestions` (`CR/primitives/thread/ThreadSuggestions.tsx`) | `children({suggestion})` or `components {Suggestion}` | One scoped child per suggestion | yes `ThreadPrimitiveSuggestions` | todo | CHAT |
| `.SuggestionByIndex` | `index`, `components` | One suggestion slot | `SuggestionByIndexProvider` | todo | OPT |
| `.Suggestion` (`thread/ThreadSuggestion.ts`) | button props, `prompt` (req), `send?`, `clearComposer?` (default true), deprecated `autoSend`, `method` | Standalone suggestion button (no scope needed): fills or sends `prompt` | no (use `SuggestionPrimitiveTrigger`) | todo | CHAT |
| `.Empty` (deprecated) | children | Renders when `thread.isEmpty`; replaced by `AuiIf` | no | n/a (done via `*auiIf`) | CHAT (as AuiIf) |
| `.If` (deprecated) | at least one of `empty`, `running`, `disabled` (booleans) | Conditional render on thread flags | no | n/a (`*auiIf`) | CHAT (as AuiIf) |
| `useThreadViewportAutoScroll` (hook, `thread/useThreadViewportAutoScroll.ts`) | options `{autoScroll, scrollToBottomOnRunStart, scrollToBottomOnInitialize, scrollToBottomOnThreadSwitch}` | Returns a ref callback; wraps the store auto-scroll controller | via `createThreadViewportAutoScroll` | done | CHAT |
| `useThreadRootElementRef` (`thread/ThreadRootElementContext.ts`) | none | Returns the thread root ref (used for focus decisions) | no | todo (internal) | OPT |
| `topAnchor/*` (`thread/topAnchor/{topAnchorTurn,computeTopAnchorSlack,mountTopAnchorReserve}.ts`) | n/a | Turn-anchor maths; pure functions with tests | no | todo if `turnAnchor` is wanted | OPT |

### 1.2 message (`R/primitives/message.ts`)

| Export | Props | Behaviour | Vue | Angular | Scope |
|---|---|---|---|---|---|
| `MessagePrimitive.Root` (`message/MessageRoot.tsx`) | div props | Wrapper; tracks hover into `message.isHovering`; registers top-anchor refs; sets `data-message-id` | yes | done | CHAT |
| `.Parts` / alias `.Content` (`message/MessageParts.tsx` over `CR/primitives/message/MessageParts.tsx`) | `children({part})` (enriched part state: `toolUI`, `addResult`, `resume`, `respondToApproval`, `unstable_recordInteraction`, `dataRendererUI`) or deprecated `components {Empty, Text, Source, Image, File, Unstable_Audio, data{by_name,Fallback}, Quote, generativeUI, Reasoning, tools{by_name,Fallback}\|{Override}, ToolGroup, ReasoningGroup, ChainOfThought}`; `unstable_showEmptyOnNonTextEnd` (default true) | Renders each part; resolves tool UI by name > registry > Fallback; groups consecutive tool/reasoning parts; web defaults for Text/Image | yes `MessagePrimitiveParts` | done | CHAT |
| `.PartByIndex` | `index`, `components` | One part slot | `PartByIndexProvider` | n/a | OPT |
| `.GroupedParts` (`CR/primitives/message/MessageGroupedParts.tsx`) | `groupBy(part, ctx) => group-key[] \| null` (use `groupPartByType`), `indicator?: "never"\|"empty"\|"no-text"\|"always"` (default "no-text"), `children({part, children})` where `part` is a `GroupPart {type:"group-...", status, counts, indices, timing}`, an `EnrichedPartState` or `{type:"indicator"}` | Adjacent hierarchical grouping with one `switch(part.type)`; replaces `ToolGroup`/`ReasoningGroup`/`ChainOfThought` configs | no | todo | CHAT (tool group, reasoning, chain of thought, "thinking" indicator) |
| `.Attachments` (`CR/.../MessageAttachments.tsx`) | `children({attachment})` or `components {Image, Document, File, Attachment}` | User-message attachments | yes `MessagePrimitiveAttachments` | todo | CHAT |
| `.AttachmentByIndex` | `index`, `components?` | One attachment slot | `AttachmentByIndexProvider` | todo | OPT |
| `.Error` (`message/MessageError.ts`) | children | Renders children when the message has an error (`useMessageError`) | no | todo | CHAT |
| `.If` (deprecated) | at least one of `user`, `assistant`, `system`, `hasBranches`, `copied`, `lastOrHover`, `last`, `speaking`, `hasAttachments`, `hasContent`, `submittedFeedback: "positive"\|"negative"\|null` | Conditional render on message state | no | n/a (`*auiIf`) | CHAT (as AuiIf) |
| `.Quote` (`CR/.../MessageQuote.tsx`) | `children(QuoteInfo)` | Renders the quote attached to a message | no | todo | OPT (selection quote feature) |
| `.GenerativeUI` | n/a | json-render of generative UI parts | no | n/a (generative UI out of scope) | n/a |
| `.Unstable_PartsGrouped`, `.Unstable_PartsGroupedByParentId` (`message/MessagePartsGrouped.tsx`) | `groupingFunction`, `components` | Deprecated non-adjacent grouping by `parentId` | no | n/a (deprecated, prefer `GroupedParts`) | n/a |

### 1.3 messagePart (`R/primitives/messagePart.ts`)

| Export | Props | Behaviour | Vue | Angular | Scope |
|---|---|---|---|---|---|
| `MessagePartPrimitive.Text` | span props, `smooth?: boolean\|SmoothOptions` (default true), `component?: ElementType`, `render` | Renders part text with `useSmooth` typing animation; `data-status` | no | todo | CHAT |
| `.Image` | img props | `<img src=part.image>` | no | todo | CHAT |
| `.InProgress` (`CR/primitives/messagePart/MessagePartInProgress.ts`) | children | Children shown only while the part is running | no | todo | CHAT |
| `.Messages` (`CR/primitives/part/PartMessages.tsx`) | `children({message})` or `components` | Renders messages nested inside a tool-call part (sub-agent) | no | todo | OPT |
| hooks `useMessagePartText/Reasoning/Source/File/Image/Data` (`messagePart/use*.ts`) | none (`name?` for data) | **Deprecated**: use `useAuiState(s => s.part...)` with a type narrow; return frozen empty sentinels, never throw | no | n/a | OPT |

### 1.4 composer (`R/primitives/composer.ts`)

| Export | Props | Behaviour | Vue | Angular | Scope |
|---|---|---|---|---|---|
| `ComposerPrimitive.Root` (`composer/ComposerRoot.tsx`) | form props, `compact?: boolean` | `<form>` that sends on submit; clicking blank space focuses the input; `data-compact` when single line and nothing else | no | done as `AuiComposerRootDirective` (not in Vue; phase 1 added it) | CHAT |
| `.Input` (`composer/ComposerInput.tsx`) | `TextareaAutosize` props, `submitMode: "enter"\|"ctrlEnter"\|"none"` (default "enter", deprecated `submitOnEnter`), `cancelOnEscape` (true), `addAttachmentOnPaste` (true), `unstable_focusOnRunStart`, `unstable_focusOnScrollToBottom`, `unstable_focusOnThreadSwitched` (true), `unstable_insertNewlineOnTouchEnter` (false), `asChild`, `render` | Autosizing textarea bound to composer text; IME-safe Enter; paste files as attachments; Escape cancels edit and restores focus | partial (`submitOnEnter`) | done (check props) | CHAT |
| `.Send` | button props | Disabled via `composerSendDisabled` | yes | done | CHAT |
| `.Cancel` | button props | Cancels run or edit (`composerCancelDisabled`); keyboard activation returns focus to thread composer (`composer/useComposerCancelWithFocus.ts`) | yes | done | CHAT |
| `.Resume` | button props | Resumes an interrupted run when adapter reports `canResume` (`composerResumeDisabled`) | no | todo | OPT (cloud/resumable streams) |
| `.AddAttachment` | button props, `multiple` (true) | Creates hidden `<input type=file>` with `accept=composer.attachmentAccept`, adds each file; guards scope changes | yes | todo | CHAT |
| `.Attachments` (`CR/.../ComposerAttachments.tsx`) | `children({attachment})` or `components {Image, Document, File, Attachment}` | One scoped child per composer attachment | yes | todo | CHAT |
| `.AttachmentByIndex` | `index`, `components?` | One attachment slot | provider | todo | OPT |
| `.AttachmentDropzone` (`composer/ComposerAttachmentDropzone.tsx`) | div props, `disabled`, `asChild`, `render` | Drag-and-drop zone; `data-dragging`; adds dropped files | yes | todo | CHAT |
| `.If` (deprecated, `CR/.../ComposerIf.tsx`) | at least one of `editing`, `dictation` | Conditional render | no | n/a (`*auiIf`) | CHAT (as AuiIf) |
| `.Quote`, `.QuoteText`, `.QuoteDismiss` (`composer/ComposerQuote.tsx`) | div / span / button props | Shows the quote staged on the composer (`composer.quote`), its text, and a dismiss button | no | todo | OPT |
| `.Queue` (`CR/.../ComposerQueue.tsx`) | `children({queueItem})` | Renders queued messages (needs queue adapter / `unstable_enableMessageQueue`) | no | todo | OPT |
| `.TriggerPopoverRoot` / `.TriggerPopover` (+`.Directive`, `.Action`) / `.TriggerPopoverCategories` / `.TriggerPopoverCategoryItem` / `.TriggerPopoverItems` / `.TriggerPopoverItem` / `.TriggerPopoverBack` (`composer/trigger/*`) | Popover: `char`, `matcher?`, `adapter?: TriggerAdapter`, `isLoading?`. Directive: `formatter?`, `onInserted?`. Action: `onExecute`, `removeOnExecute?`, `formatter?`. Categories: `children(categories)`. CategoryItem: `categoryId`. Items: `children(items)`. Item: `item`, `index?`. | `@mention` and `/slash` popovers with keyboard nav, category drill-down, directive insertion (`:type[label]{id}`) | no | todo | OPT (mentions, slash commands) |
| `Unstable_TriggerPopover*` aliases, `unstable_useTriggerPopover*Context*` | deprecated | Back-compat | no | n/a | n/a |
| `Dictate`, `StopDictation`, `DictationTranscript` | button/span props | Voice dictation | no | n/a | n/a (voice/dictation out of scope) |

Composer hooks that are not primitives: `unstable_useComposerInput`, `unstable_useComposerInputHistory`
(terminal-style ArrowUp/Down recall), `unstable_useComposerRunStartFocusGuard` (`R/unstable/*.ts`).

### 1.5 actionBar (`R/primitives/actionBar.ts`)

| Export | Props | Behaviour | Vue | Angular | Scope |
|---|---|---|---|---|---|
| `ActionBarPrimitive.Root` (`actionBar/ActionBarRoot.tsx`) | div props, `hideWhenRunning` (false), `autohide: "always"\|"not-last"\|"never"` (never), `autohideFloat: "always"\|"single-branch"\|"never"` (never) | Container; hides based on hover/last/running (`useActionBarFloatStatus.ts`); `data-floating`; interaction lock keeps it visible while a menu is open | no | todo | CHAT |
| `.Copy` | button props, `copiedDuration` (3000), core `copyToClipboard?` | Copies message text, or composer text while editing; `data-copied`; sets `message.isCopied`; `useActionBarCopy` in `CR/primitive-hooks/useActionBarCopy.ts` | yes (no `copyToClipboard`) | todo | CHAT |
| `.Reload` | button props | `aui.message().reload()`; disabled while running / non-assistant / `!capabilities.reload` | yes | todo | CHAT |
| `.Edit` | button props | `aui.composer().beginEdit()`; disabled while editing or `capabilities.edit === false` | yes | todo | CHAT |
| `.FeedbackPositive`, `.FeedbackNegative` | button props | `aui.message().submitFeedback({type})`; needs `FeedbackAdapter`; `useActionBarFeedback*` returns `{submit,isSubmitted}`; `data-submitted` | no | todo | OPT |
| `.ExportMarkdown` | button props, `filename?`, `onExport?(content)` | Downloads message text as `.md` (Blob + anchor) or calls `onExport` | no | todo | OPT |
| `.Resume`, `.RefreshRun` | button props | Resume a stale run / refresh an in-progress run from another tab (cloud run state) | no | n/a | n/a (cloud/resumable run state) |
| `.Speak`, `.StopSpeaking` | button props | Speech synthesis | no | n/a | n/a (speech out of scope) |

### 1.6 actionBarMore (`R/primitives/actionBarMore.ts`) and threadListItemMore

Radix `DropdownMenu` wrappers with `withRenderProp` (`R/primitives/dropdownMenuRenderPrimitives.ts`).

| Export | Props | Behaviour | Vue | Angular | Scope |
|---|---|---|---|---|---|
| `ActionBarMorePrimitive.Root` | `DropdownMenu.Root` props | Overflow menu state | no | todo | OPT |
| `.Trigger`, `.Content` (+`portalProps`), `.Item`, `.Separator` | Radix `Trigger`/`Content`/`Item`/`Separator` props + `render` | Menu parts | no | todo | OPT |
| `ThreadListItemMorePrimitive.Root` (+`sharedFocusGroup`), `.Trigger`, `.Content`, `.Item`, `.Separator` (`R/primitives/threadListItemMore.ts`) | same shape | Per-thread overflow menu (rename/archive/delete); shares roving focus with the list when `sharedFocusGroup` | no | todo | OPT (Angular needs its own menu/overlay: CDK Menu or custom) |

### 1.7 branchPicker (`R/primitives/branchPicker.ts`)

| Export | Props | Behaviour | Vue | Angular | Scope |
|---|---|---|---|---|---|
| `BranchPickerPrimitive.Root` | div props, `hideWhenSingleBranch` (false) | Container; renders nothing when one branch and flag set | no | todo | CHAT |
| `.Previous`, `.Next` | button props | `aui.message().switchToBranch({position})`; disabled by `branchPickerPreviousDisabled` / `branchPickerNextDisabled` | yes | todo | CHAT |
| `.Number` | none | `message.branchNumber` (1-based) | yes | todo | CHAT |
| `.Count` | none | `message.branchCount` | yes | todo | CHAT |

### 1.8 error (`R/primitives/error.ts`)

| Export | Props | Behaviour | Vue | Angular | Scope |
|---|---|---|---|---|---|
| `ErrorPrimitive.Root` | div props | Container with `role=alert`; `data-run-state` (`stale`/`in-progress`) and status role for runs driven elsewhere | yes | todo | CHAT |
| `.Message` | span props | Renders `messageErrorText` (string, `error.message`, or "An error occurred") | yes | todo | CHAT |

### 1.9 attachment (`R/primitives/attachment.ts`)

| Export | Props | Behaviour | Vue | Angular | Scope |
|---|---|---|---|---|---|
| `AttachmentPrimitive.Root` | div props | Scope wrapper; `data-attachment-type` | yes | todo | CHAT |
| `.Name` | none | Renders `attachment.name` | yes | todo | CHAT |
| `.unstable_Thumb` | div props | Thumbnail placeholder (extension / image) | yes `AttachmentPrimitiveThumb` | todo | CHAT |
| `.Remove` | button props | `aui.attachment().remove()` | yes | todo | CHAT |

### 1.10 suggestion (`R/primitives/suggestion.ts`)

| Export | Props | Behaviour | Vue | Angular | Scope |
|---|---|---|---|---|---|
| `SuggestionPrimitive.Trigger` | button props, `send?` (false), `clearComposer?` (true) | Fills or sends the suggestion prompt; `useSuggestionTrigger` in `CR/primitive-hooks/useSuggestionTrigger.ts`; send queues if `capabilities.queue` | yes | todo | CHAT |
| `.Title` | span props | `suggestion.title` | yes | todo | CHAT |
| `.Description` | span props | `suggestion.label` | yes | todo | CHAT |

### 1.11 threadList, threadListItem (`R/primitives/threadList.ts`, `threadListItem.ts`)

| Export | Props | Behaviour | Vue | Angular | Scope |
|---|---|---|---|---|---|
| `ThreadListPrimitive.Root` | div props | Container with roving-tabindex keyboard nav (`R/primitives/threadListFocusGroup.ts`, Radix `Collection`) | yes | todo | CHAT |
| `.New` | button props | `aui.threads().switchToNewThread()` | yes | todo | CHAT |
| `.Items` (`CR/.../ThreadListItems.tsx`) | `archived?`, `children({threadListItem})` or `components {ThreadListItem}` | One scoped child per thread | yes | todo | CHAT |
| `.ItemByIndex` | `index`, `archived?`, `components` | One slot | provider | todo | OPT |
| `.LoadMore` | button props | `aui.threads().loadMore()`; disabled by `threadListLoadMoreDisabled` | yes | todo | CHAT |
| `ThreadListItemPrimitive.Root` | div props | Scope wrapper; `data-active` when current | yes | todo | CHAT |
| `.Trigger` | button props | `aui.threadListItem().switchTo()` | yes | todo | CHAT |
| `.Title` (`CR/.../ThreadListItemTitle.tsx`) | `fallback?: ReactNode` | Renders `title` or fallback | yes | todo | CHAT |
| `.Archive`, `.Unarchive`, `.Delete` | button props | `archive()`, `unarchive()` (disabled by `threadListItemUnarchiveDisabled`), `delete()` | yes | todo | CHAT |

### 1.12 chainOfThought, reasoning (`R/primitives/chainOfThought.ts`)

| Export | Props | Behaviour | Vue | Angular | Scope |
|---|---|---|---|---|---|
| `ChainOfThoughtPrimitive.Root` | div props | Wrapper; `data-collapsed`/status from `chainOfThought` scope (`C/store/clients/chain-of-thought-client.ts`) | no | todo | CHAT |
| `.AccordionTrigger` | button props | Toggles `chainOfThought.setCollapsed`; `aria-expanded` | yes | todo | CHAT |
| `.Parts` (`CR/.../ChainOfThoughtParts.tsx`) | `children({part})` or deprecated `components {Reasoning, tools{Fallback}, Layout}` | Renders reasoning and tool parts of the chain; nothing when collapsed | yes | todo | CHAT |
| Reasoning | **no `ReasoningPrimitive` exists.** Reasoning is a part type (`ReasoningMessagePart`), rendered by `MessagePrimitive.Parts` `Reasoning`/`ReasoningGroup`, or by `GroupedParts` `group-reasoning`. Only `useScrollLock` lives in `R/primitives/reasoning/useScrollLock.ts` | | `useScrollLock` yes | todo | CHAT |

### 1.13 queueItem, selectionToolbar, assistantModal

| Export | Props | Behaviour | Vue | Angular | Scope |
|---|---|---|---|---|---|
| `QueueItemPrimitive.Text` | span props | Queued message text | no | todo | OPT |
| `.Steer` | button props | `queueItem.steer()` runs it next | no | todo | OPT |
| `.Remove` | button props | `queueItem.remove()` | no | todo | OPT |
| `SelectionToolbarPrimitive.Root` | div props | Floating toolbar on text selection within one message (portal, `getSelectionMessageId`) | no | todo | OPT |
| `.Quote` | button props | Sets composer quote from selection (`composer.setQuote`) | no | todo | OPT |
| `AssistantModalPrimitive.Root` | Radix `Popover.Root` props, `unstable_openOnRunStart` | Popover chat launcher state | no | todo | OPT |
| `.Trigger`, `.Anchor`, `.Content` (`portalProps`, `dissmissOnInteractOutside`) | Radix Popover parts + `render` | Floating chat panel | no | todo | OPT |

### 1.14 Conditions (If / Empty)

All condition primitives are **deprecated** upstream in favour of `AuiIf` (already ported as `*auiIf` /
`AuiIfDirective`): `ThreadPrimitive.If|Empty`, `MessagePrimitive.If`, `ComposerPrimitive.If`. Filters they accept
map 1:1 to `AuiIf` conditions on `s.thread.*`, `s.message.*`, `s.composer.*` (see tables above). No port needed;
document the equivalent `*auiIf` expressions.

### 1.15 Families that matter

| Matters for a chat app | Reason |
|---|---|
| thread (ViewportFooter, ScrollToBottom, Suggestions, Suggestion, LoadEarlier), message (Error, Attachments, GroupedParts), messagePart (Text with smooth, Image, InProgress), composer (AddAttachment, Attachments, AttachmentDropzone), actionBar (Root, Copy, Reload, Edit), branchPicker (all), error (all), attachment (all), suggestion (all), threadList + threadListItem (all), chainOfThought (all) | agreed phase 2 scope; every one of these has a visible, standard UI in the kit |
| actionBar Feedback*/ExportMarkdown, composer Quote*/Queue/TriggerPopover*, message Quote, selectionToolbar, queueItem, assistantModal, actionBarMore, threadListItemMore, thread Row | optional; each is its own small feature and none is in the agreed list. Decide explicitly (port or mark deferred) so there are no silent gaps |
| Out of scope by agreement (mark n/a) | Dictate/StopDictation/DictationTranscript (dictation); ActionBar Speak/StopSpeaking (speech); `MessagePrimitive.GenerativeUI`, `generativeUI` parts config, `GenerativeUIRender` (generative UI); mcp-apps (`R/mcp-apps`), `CloudRendererHost`; `DevToolsHooks` (devtools); `AssistantCloud`, `useCloudThreadListRuntime`, `CloudFileAttachmentAdapter`, `ActionBar.RefreshRun`/`Resume` (cloud run state); LangGraph/A2A runtimes; voice (`useVoice*`, `RealtimeVoiceAdapter`) |

---

## 2. Hooks and utilities

Where: **R** = `packages/react/src`, **C/react** = `packages/core/src/react`, **C** = framework-neutral
`packages/core/src`, **S** = `packages/store`. "Angular" is the injection function/analogue to provide.

### 2.1 Scroll and viewport

| Name | Signature | Behaviour | Lives | Angular |
|---|---|---|---|---|
| `useScrollLock` | `<T extends HTMLElement>(animatedElementRef: RefObject<T\|null>, animationDuration: number) => () => void` | Returns `lockScroll()`: hides scrollbar + freezes `scrollTop` of nearest scrollable ancestor for `animationDuration` ms (ref-counted per container) so collapsing panels do not jump | R `primitives/reasoning/useScrollLock.ts`; Vue copy `V/useScrollLock.ts` | planned; port from Vue file (test `V/useScrollLock.test.ts`) |
| `useThreadViewportAutoScroll` | `<T extends HTMLElement>(opts: {autoScroll?, scrollToBottomOnRunStart?, scrollToBottomOnInitialize?, scrollToBottomOnThreadSwitch?}) => RefCallback<T>` | Wires viewport element to the auto-scroll controller; listens to `thread.runStart`; detects prepended messages | R `primitives/thread/useThreadViewportAutoScroll.ts` | done |
| `createThreadViewportAutoScroll` | `({getOptions, onAtBottomChange, onContentInsetChange?}) => ThreadViewportAutoScroll {attach, isAtBottom, scrollToBottom(behavior?), messagesPrepended(id), setContentInset, registerContentInset(), setHasMessages, runStarted, threadSwitched, dispose}` | Framework-neutral engine | S `utils/thread-viewport-auto-scroll.ts` (exported from `@assistant-ui/store/client`) | done |
| `useThreadViewport` / `useThreadViewportStore` / `ThreadViewportState` | state: `isAtBottom, scrollToBottom({behavior}), onScrollToBottom(cb), turnAnchor, topAnchorMessageClamp, height{viewport,inset}, element{viewport,anchor,target}, topAnchorTurn, registerViewport(), registerContentInset(), registerViewportElement(el), registerAnchorElement(el), registerAnchorTargetElement(el,cfg), setTopAnchorTurn` | Zustand store; the React-only viewport model | R `context/stores/ThreadViewport.ts`, `context/react/ThreadViewportContext.ts` | Angular has `AUI_VIEWPORT` (phase 1); extend for ViewportFooter/ScrollToBottom |
| `useSmooth` | `(state: MessagePartState & (TextMessagePart\|ReasoningMessagePart), smooth: boolean\|SmoothOptions = false) => same` | Reveals streamed text via rAF `TextStreamAnimator`; `SmoothOptions {drainMs=250, maxCharIntervalMs=5, maxCharsPerFrame=Infinity, minCommitMs=0}`; disabled under `prefers-reduced-motion`; publishes running status to `SmoothContext` | R `utils/smooth/useSmooth.ts`, `SmoothContext.tsx` (test `useSmooth.test.tsx`) | todo. The animator class is plain TS and portable |
| `useMediaQuery` | `(query: string) => boolean` | Used by smooth | R `utils/hooks/useMediaQuery.ts` | todo (trivial) |

### 2.2 Message and composer helpers (all take the current scope)

All of these are `useAui`/`useAuiState` wrappers; the Angular analogue is `injectAui()` + `injectAuiState()`.

| Name | Signature / API | Behaviour | Lives |
|---|---|---|---|
| `useMessageTiming` | `() => MessageTiming \| undefined` | `s.message.metadata.timing` for assistant messages (`firstTokenTime`, `totalStreamTime`, `tokenCount`, `tokensPerSecond`, ...) | R `hooks/useMessageTiming.ts` |
| `useToolCallElapsed` | `() => number \| undefined` | Ticking elapsed ms for the current tool-call part (1s interval while running) | R `hooks/useToolCallElapsed.ts` (test exists) |
| `useMessageQuote` / `getMessageQuote` | `() => QuoteInfo \| undefined` | Quote metadata on the message | R `hooks/useMessageQuote.ts`, C/react `utils/getMessageQuote.ts` |
| `unstable_useMessageStallDetection` | `({thresholdMs=2000}?) => {stalled, stalledForMs}` | Flags a running message with no new content | R `unstable/useMessageStallDetection.ts` |
| `useMessageError` | `() => ReadonlyJSONValue \| undefined` | Error text via `messageErrorText` | C/react `primitive-hooks/useMessageError.ts` |
| `useMessageReload` | hook | `aui.message().reload()` | C/react `primitive-hooks/useMessageReload.ts` |
| `useMessageBranching` | `() => {branchNumber, branchCount, goToPrev, goToNext}` | Branch navigation | C/react `primitive-hooks/useMessageBranching.ts` |
| `useThreadMessages`, `unstable_useThreadMessageIds`, `useThreadIsRunning`, `useThreadIsEmpty` | selectors | Thread selectors | C/react `primitive-hooks/*` |
| `useComposerSend/Resume/Cancel/AddAttachment`, `useEditComposerSend/Cancel` | `() => {send/cancel/..., disabled}` | Composer behaviours (edit variants for `message.composer`) | C/react `primitive-hooks/*` |
| `useActionBarCopy({copiedDuration=3000, copyToClipboard?})`, `useActionBarEdit`, `useActionBarReload`, `useActionBarResume`, `useActionBarRefreshRun`, `useActionBarFeedbackPositive/Negative`, `useActionBarSpeak`, `useActionBarStopSpeaking` | each returns `{action, disabled}` | Behaviours behind the action bar | C/react `primitive-hooks/useActionBar*.ts` |
| `useBranchPickerNext/Previous`, `useSuggestionTrigger({send, clearComposer})`, `useThreadListItemArchive/Delete/Unarchive/Trigger`, `useThreadListNew`, `useThreadListLoadMore` | `{action, disabled}` | Behaviours behind list and suggestion buttons | C/react `primitive-hooks/*` |
| `useAttachmentSrc` (kit) | `(attachment) => string \| undefined` | Resolves object URL / data URL for previews | `UI/../hooks/use-attachment-src.ts` |
| `useCopyToClipboard` (kit) | `({copiedDuration=3000}) => {isCopied, copyToClipboard(value)}` | Used by code header | `packages/ui/src/hooks/use-copy-to-clipboard.ts` |

Runtime methods a binding calls (state/method shapes in `C/store/scopes/*.ts`, detail in section 5):
`aui.thread()`, `aui.message()`, `aui.composer()`, `aui.part()`, `aui.attachment()`, `aui.threads()`,
`aui.threadListItem()`, `aui.suggestions()`, `aui.modelContext`, `aui.tools`.

### 2.3 Tool helpers (model context, tool UI, human in the loop)

| Name | Signature | Behaviour | Lives | Notes |
|---|---|---|---|---|
| `tool` | `tool<TSchema extends StandardSchema, TResult>(def: Tool<Input, TResult> & {parameters: TSchema}): Tool<...>` (overload for plain `TArgs`) | Identity helper that types a tool definition (`type: "frontend"\|"backend"\|"human"\|"provider"`, `description`, `parameters`, `execute`, `streamCall`, ...) | C `model-context/tool.ts` | pure TS, reuse |
| `Tools` (client) | `Tools({ toolkit: Toolkit })` resource; state `{toolUIs: Record<name, {render, renderText?, standalone}[]>, mcpApp?}`; method `aui.tools.setToolUI(name, render, {standalone}) => Unsubscribe` | Registers toolkit tools into model context and tool-UI registry; used via `AuiConfig({ tools: Tools({ toolkit }) })` | C/react `client/Tools.ts`, types `types/scopes/tools.ts` | Angular `registerToolUI` is the phase 1 wrapper over `aui.tools.setToolUI` (done) |
| `Toolkit`, `ToolDefinition`, `ToolkitDefinition`, `ToolkitDefinitionEntry`, `ToolCallText` | types | Toolkit shape: `{ [name]: Tool & { render?, renderText?, display? } }` | C/react `model-context/toolbox.ts` | reuse types |
| `defineToolkit` | `(def: ToolkitDefinition) => Toolkit` | Builds a toolkit; companion `"use generative"` compiler (`@assistant-ui/next`/`vite`) strips markers | C/react `model-context/define-toolkit.ts` | compiler not applicable to Angular; see below |
| `humanTool()` (deprecated aliases `hitl`, `hitlTool`), `externalTool()`, `stubTool()`, `providerTool(cfg)`, `defineMcpToolkit` | `() => never` markers | **Throw at runtime**; only meaningful to the compiler. In Angular, define human tools directly as `{type: "human", ...}` entries (see rendering contract below) | C/react `model-context/{human-tool,external-tool,stub-tool,provider-tool,define-mcp-toolkit}.ts` | decide: provide plain-object equivalents |
| `makeAssistantTool` / `useAssistantTool` | `useAssistantTool<TArgs,TResult>(tool: AssistantToolProps)` (`AssistantToolProps = CoreAssistantToolProps & {render?, renderText?}`) ; `makeAssistantTool(tool) => AssistantTool` component | Registers tool in model context while mounted; installs `render` as UI | C/react `model-context/makeAssistantTool.ts`, `useAssistantTool.ts` | **deprecated** upstream in favour of toolkits |
| `makeAssistantToolUI` / `useAssistantToolUI` | `useAssistantToolUI(tool: {toolName, render, display?: "standalone"\|"inline"} \| null)` | Registers a renderer only | C/react `model-context/makeAssistantToolUI.ts`, `useAssistantToolUI.ts` | **deprecated**; phase 1 `registerToolUI` covers it (done) |
| `makeAssistantDataUI` / `useAssistantDataUI` | `useAssistantDataUI({name, render})` | Registers renderer for named `data` parts (`DataRenderers` client) | C/react `model-context/*DataUI.ts`, `client/DataRenderers.ts` | data parts only matter if backend emits them |
| `useAssistantInstructions` | `(config: string \| {instruction: string, disabled?: boolean}) => void` | Registers a system-prompt fragment via `aui.modelContext.register` | C/react `model-context/useAssistantInstructions.ts` | todo |
| `useAssistantContext` | `({getContext: () => string, disabled?}) => void` | Registers dynamic system context | C/react `model-context/useAssistantContext.ts` | todo |
| `makeAssistantVisible` | HOC `(Component, {clickable?, editable?}) => Component` | Exposes a component to the model as tools | R `model-context/makeAssistantVisible.tsx` | OPT; DOM-oriented |
| `useAuiToolOverrides` | `(overrides: Record<string, Partial<Tool>>) => void` | Registers executors at priority 1000, above toolkit defaults (experimental) | C/react `model-context/useAuiToolOverrides.ts` | OPT |
| `useInlineRender` | `(toolUI: FC<ToolCallMessagePartProps>) => FC<...>` | Keeps component identity stable while an inline render fn changes | C/react `model-context/useInlineRender.ts` | React-only concern; n/a |
| `useToolArgsStatus` | `<TArgs>() => {status, argsStatus: "streaming"\|"complete", propStatus: Partial<Record<keyof TArgs, "streaming"\|"complete">>}` | Per-argument streaming status in a tool renderer (uses `getPartialJsonObjectMeta` from `assistant-stream/utils`) | C/react `model-context/useToolArgsStatus.ts` | todo (nice for tool UIs) |
| `ToolCallMessagePartProps<TArgs,TResult>` | part fields (`toolCallId, toolName, args, argsText, result, isError, status, interrupt, approval, timing, ...`) plus `addResult(result \| ToolResponse)`, `resume(payload)`, `respondToApproval(ToolApprovalResponse): Promise<void>`, `unstable_recordInteraction?` | Contract for every tool renderer | C/react `types/MessagePartComponentTypes.ts` | phase 1 `ToolUIProps` (check it carries `resume`, `respondToApproval`) |
| Tool approval | types `ToolApprovalResponse` (`{approved, text?, reason?}` \| `{optionId,...}` \| `{approved, optionId}` \| `{text}` \| `{answers: Record<id,{optionIds?,text?}>}`), `ToolApprovalDisplay = "decision"\|"select"\|"text"\|"questions"`, `ToolApprovalOption {id,label,kind,...}`, `ToolApprovalQuestion {id,prompt,header?,options?,multiple?,allowFreeform?}`, `toolApprovalAcceptsText(approval)`; part field `approval` (`approved?`, `resolution?`, `options?`, `questions?`, `answers?`, `display`, `allowFreeform`); method `aui.part().respondToToolApproval(resp)`; event `thread.toolApprovalAnswered {threadId, messageId, toolCallId, toolName, approved}`; core `resolveToolApprovalResponse` | Server-side tool approval gate (AI SDK `needsApproval`) | C `types/message.ts` lines 179-290, 369-401; `runtime/utils/resolveToolApprovalResponse.ts`; exported `toolApprovalAcceptsText` from R `index.ts` | the kit's `tool-fallback.aui.tsx` has the full approval UI (decision, select, text, questions) |
| Human in the loop / "ask user" / interrupts | A tool call with `interrupt: {type: "human", payload}` and status `{type: "requires-action", reason: "interrupt"}`; the renderer calls `resume(payload)` (maps to `part.resumeToolCall`) or `addResult(result)` (maps to `part.addToolResult`). `LocalRuntimeOptions.unstable_humanToolNames: string[]` pauses a local run until `addToolResult`. Runtime capability `answerToolCall`. | Pause an agent run for user input | C `types/message.ts` (`interrupt`, `ToolCallMessagePartStatus`), `runtime/utils/pending-tool-calls.ts`, `runtime/utils/tool-interactions.ts` (`TOOL_INTERACTION_LIMITS`); kit example `eve-ask-question` registry item and `UI/.../elements/{question-flow,elicitation-form,approval-card,permission-grant}.tsx` | Angular `ToolUIProps` must expose `addResult`, `resume`, `respondToApproval`; wire to `aui.part()` |
| `unstable_recordInteraction` | `(input: Unstable_ToolInteractionInput) => Promise<void>` | Persists what the user did in a tool UI (JSON, size-limited) | C `runtime/utils/tool-interactions.ts` | OPT |

### 2.4 Model context

| Name | Signature | Behaviour | Lives |
|---|---|---|---|
| `ModelContext`, `ModelContextProvider`, `ModelContextOptions` | `ModelContext {priority?, system?, tools?, callSettings?, config?}`; `ModelContextProvider {getModelContext(): ModelContext, subscribe?(cb): Unsubscribe}` | What is sent to the model each run | C `model-context/types.ts` |
| `mergeModelContexts` | `(providers) => ModelContext` | Priority merge | C `model-context/types.ts` (exported from `@assistant-ui/core`) |
| `ModelContextRegistry` (+ handles) | `addTool(name, tool)`, `addInstruction(text)`, `addContext(provider)` returning handles with `update/remove` | Imperative registry | C `model-context/registry.ts`, `registry-handles.ts` |
| `aui.modelContext` (`ModelContextClient`) | `register(provider): Unsubscribe`, `getModelContext()`, state `{modelName?, toolNames}` | Client scope | C `store/clients/model-context-client.ts`, `store/scopes/model-context.ts` |
| `AssistantFrameHost`/`AssistantFrameProvider` | iframe bridge | Model context across iframes | C `model-context/frame/*` | n/a (not chat-app essential) |
| `injectQuoteContext` | `(...)` | Adds quote to model context for AI SDK | `packages/ai-sdk/src/model-context/injectQuoteContext.ts` | OPT with quote |

### 2.5 Suggestions config

| Name | Signature | Behaviour | Lives |
|---|---|---|---|
| `Suggestions` (client) | `Suggestions(config: SuggestionConfig[])`, `SuggestionConfig = string \| {title, label, prompt}` (string becomes `{title: s, label: "", prompt: s}`); registered with `AuiConfig({ suggestions: Suggestions([...]) })` | Static suggestions scope; `aui.suggestions().getState().suggestions`, `.suggestion({index})` | C `store/clients/suggestions.ts` (exported from `@assistant-ui/core/store` and R `index.ts`) |
| `ThreadSuggestions` (client resource) | `(suggestions: readonly ThreadSuggestion[])` | Runtime-provided suggestions (from adapter or external store) | same file |
| `ThreadSuggestion` | `{prompt: string, title?, label?}` | Runtime suggestion type | C `runtime/interfaces/thread-runtime-core.ts` |
| `SuggestionAdapter`, `createSuggestionAdapter({complete({prompt,signal}) => Promise<string[]>, count=3, instructions?, maxMessages=10, key?})` | `generate({messages, signal})` returns promise or async generator | LLM-generated follow-ups; set `LocalRuntimeOptions.adapters.suggestion` | C `adapters/suggestion.ts` |
| docs | | | `apps/docs/content/docs/guides/suggestions.mdx`, `primitives/suggestion.mdx` |

### 2.6 Other utilities worth knowing

`groupPartByType` (`CR/utils/groupParts.ts`: map `part.type` / `tool-call:<name>` / `standalone-tool-call` to group-key paths, with memo fingerprint `GROUPBY_MEMO_KEY`), `createThreadRowsSelector` (`CR/utils/threadRows.ts`), `getMessagePartKeys` / `getSuggestionKeys` (`C/utils`), `getGroupStatus` (`C/utils/getGroupStatus.ts`), `resolveToolRender` (`C/utils/resolveToolRender.ts`), `getSelectionMessageId` (`R/utils/getSelectionMessageId.ts`), `isCompositionKey` (`R/utils/isCompositionKey.ts`), `Primitive`/`withRenderProp`/`createActionButton` (React-only plumbing), `RequireAtLeastOne`.

---

## 3. Markdown and highlighting

Three packages, only one of which is framework-neutral.

### 3.1 `packages/markdown` = `@assistant-ui/markdown` (private, unpublished)

README: "This package is private and not published to npm. Its API can change ... without notice." Version `0.0.0`.

- Parser: **markdown-it ^15** (`src/tokenizer/markdown-it.ts`, 375 lines), configured with `extensions: true` = tables, strikethrough, task lists, autolinks (incl. bare `www.`), and **math** via the in-repo plugin `src/tokenizer/math.ts` (`$..$`, `$$..$$`, `\(..\)`, `\[..\]`; currency heuristics so `$5 to $10` stays text). Output is a framework-neutral AST (`src/ast.ts`: root, paragraph, heading, blockquote, list, listItem, codeBlock, mathBlock, thematicBreak, table/tableRow/tableCell, htmlBlock; inline text, softBreak, hardBreak, emphasis, strong, strikethrough, codeSpan, mathInline, link, image, htmlInline; every block has `lines: {start,end}`).
- API: `parseMarkdown(source): RootNode` (`src/parse.ts`); `createMarkdownSession(): MarkdownSession` with `update(text, {final?}): RootNode` (`src/session.ts`).
- **Streaming/incomplete markdown**: `session.update` re-parses only the unsettled tail blocks; earlier blocks keep object identity, so renderers can skip them. `src/complete.ts` (`closeOpenBlock`) closes open emphasis, strong, strikethrough, code spans and links provisionally until `final: true`; an unfinished link carries no `url`; wrapper nesting bounded (`MAX_DEPTH = 4`). Reference definitions force a whole-text re-parse. A block on the unfinished last line can fuse with the previous one, so two blocks stay open.
- URL safety: link/image URLs must be relative or non-`javascript:|vbscript:|file:|data:` (except `data:image/{gif,png,jpeg,webp}`); failures stay as literal text. Raw HTML is never sanitised; kept as `htmlBlock`/`htmlInline` for the renderer (default renders as text).
- Renderers: `src/react/Markdown.tsx`, `src/vue/Markdown.ts` (307 lines, `components` map per node type, props `{text, final?, components?}`), `src/react-native`, `src/ink`. Math renders as `<code class="language-math math-inline|math-display">`. Tables get `text-align` from alignment.
- Tests: `src/{complete,parse,session,text-node}.test.ts`, `src/tokenizer/{commonmark,markdown-it,math}.test.ts` (CommonMark spec via `commonmark-spec`), `src/{react,vue,react-native,ink}/Markdown.test.*`, bench `src/session.bench.ts`.
- **Framework-agnostic: everything except the four renderers.** An Angular renderer would be a fifth renderer copying `src/vue/Markdown.ts` (recursive component or `@switch` over the AST). Risk: the package is private and not on npm, so Angular would have to vendor it (MIT) or depend on a git ref. Do not assume an npm install.
- The Vue kit does **not** use it: `UI/vue/assistant-ui/markdown-text.vue` uses `markdown-it` directly (`html:false, linkify:true, breaks:true`), no streaming optimisation.

### 3.2 `packages/react-markdown` = `@assistant-ui/react-markdown` (published; React only)

- Parser: **react-markdown ^10.1** (unified/remark/rehype). Plugins are caller-supplied via `remarkPlugins` / `rehypePlugins` (all react-markdown `Options`). Kit uses `remark-gfm`. Math guide (`guides/latex.mdx`) uses `remark-math` + `rehype-katex` + `katex` css. Streamdown is an alternative renderer (`guides/streamdown.mdx`).
- Exports (`src/index.ts`): `MarkdownTextPrimitive`, `MarkdownTextPrimitiveProps`, `CodeHeaderProps`, `SyntaxHighlighterProps`, `useIsMarkdownCodeBlock`, `memoizeMarkdownComponents`, `rewriteLatexBracketDelimiters`, `rewriteCustomMathTags`, `normalizeMathDelimiters`, `escapeCurrencyDollars`; CSS `styles/dot.css` (streaming dot).
- `MarkdownTextPrimitive` props: all react-markdown `Options` minus `components`/`children`, plus `className`, `containerProps`, `containerComponent` (default `div`), `components` (react-markdown map plus `SyntaxHighlighter`, `CodeHeader`, `pre`, `code`), `componentsByLanguage: Record<lang, {CodeHeader?, SyntaxHighlighter?}>` (e.g. `mermaid`), `smooth` (default true, `SmoothOptions`), `defer` (default false; `useDeferredValue`), `preprocess(text) => string`. Reads text via `useMessagePartText()` + `useSmooth`; sets `data-status`.
- **Streaming**: react-markdown re-parses the whole text each render, so (a) `MarkdownRenderer` is `memo`ed and props are stabilised (`useStableProps`, `useStableValue`) so unchanged text bails out; (b) `memoizeMarkdownComponents` (`src/memoization.tsx`) memoises each element override with `areNodesEqual` on hast nodes so only changed blocks re-render; (c) smooth reveal; (d) optional `defer`. There is **no incomplete-markdown repair** here (that exists only in `@assistant-ui/markdown`).
- **Preprocess** (`src/preprocess.ts`, ~2000 lines, pure string functions): `normalizeMathDelimiters` (rewrites `\(..\)`, `\[..\]`, custom math tags to `$`/`$$`, re-indents `$$` in list items), `rewriteLatexBracketDelimiters`, `rewriteCustomMathTags`, `escapeCurrencyDollars`. These are framework-agnostic in content but the package entry imports React, so Angular would copy the file.
- Code blocks: `PreOverride` (context `PreContext`, `useIsMarkdownCodeBlock`) detects fenced blocks; `CodeOverride` picks `componentsByLanguage[lang]` else `components`; `DefaultCodeBlock` composes `CodeHeader` + `SyntaxHighlighter` (`src/overrides/{CodeBlock,CodeOverride,PreOverride,defaultComponents,withDefaults}.tsx`, `src/code-fence.ts`: `parseLanguageClass` reads `language-xxx`). Defaults: `CodeHeader` renders nothing; `SyntaxHighlighter` renders plain `<pre><code>`.
- **Code header and copy**: user-supplied `CodeHeader({language, code, node})`. The kit's version (`UI/react/assistant-ui/elements/markdown-text.tsx`, `CodeHeader`) shows the lowercase language label and a `TooltipIconButton` toggling `CopyIcon`/`CheckIcon` via `useCopyToClipboard` (copiedDuration 3000). Class hooks `aui-code-header-root`, `aui-code-header-language`.
- Tests: none inside `packages/react-markdown` (no `*.test.*` found); benches `src/memoization.bench.ts`. Behaviour is exercised via the kit.
- **Framework-agnostic: `preprocess.ts`, `code-fence.ts` (`parseLanguageClass`), the `SyntaxHighlighterProps`/`CodeHeaderProps` contract shape.** Everything else is React.

### 3.3 `packages/react-syntax-highlighter` = `@assistant-ui/react-syntax-highlighter` (published; React only)

- Wraps `react-syntax-highlighter` ^16 (Prism/hljs). API (`src/index.ts` -> `react-syntax-highlighter-light.ts`): `makeLightSyntaxHighlighter`, `makeLightAsyncSyntaxHighlighter`, `makePrismLightSyntaxHighlighter`, `makePrismAsyncLightSyntaxHighlighter`. Each is `(config: Omit<SyntaxHighlighterProps, "language"|"children">) => FC<SyntaxHighlighterProps>`; the returned component renders `<SyntaxHighlighter PreTag={Pre} CodeTag={Code} language={language}>{code}</SyntaxHighlighter>` (`src/make-syntax-highlighter.tsx`). `full` sub-package (`/full`) bundles all languages.
- Integration contract with markdown: pass the result as `components.SyntaxHighlighter` (or per-language through `componentsByLanguage`). The component receives `{language, code, node, components: {Pre, Code}}`; it must render `Pre`/`Code` so block styling and `useIsMarkdownCodeBlock` work.
- Kit usage: `UI/react/assistant-ui/elements/syntax-highlighter.tsx` (PrismAsyncLight + registered languages tsx, python, ...), `shiki-highlighter.tsx` / `shiki-highlighter.aui.tsx` (react-shiki + shiki; props-only and aui-bound versions), `mermaid-diagram.aui.tsx` (via `componentsByLanguage.mermaid`).
- Framework-agnostic: nothing in the package; the underlying engines (`prismjs`, `shiki`) are. For Angular, highlight with `shiki` (async, framework-free, returns HTML/hast) or `prismjs`, behind a `SyntaxHighlighter` token mirroring `{language, code}`.

### 3.4 Other relevant pieces
- `useSmooth`/`SmoothOptions` (section 2.1) is the "smooth streaming" feature.
- `MessagePartPrimitive.Text` also smooths (default `smooth=true`).
- Docs: `guides/latex.mdx`, `guides/streamdown.mdx`, `guides/scrollbar.mdx`.

---

## 4. Styled component kit

Source of truth: `packages/ui/src/components/react/assistant-ui/elements/*` (React), `packages/ui/src/components/vue/assistant-ui/*.vue` (Vue, 6 files), `react-native/...` (not relevant). The registry (`apps/registry/src/registry.ts`, 2920 lines) publishes shadcn-style items (`https://r.assistant-ui.com/<name>.json`) that copy these files into the consumer's repo. `packages/ui/AGENTS.md` rules: variants by suffix, an unmarked file is the props-only source, `.radix.tsx` Radix twin, `.aui.tsx` runtime-bound, `.aui.radix.tsx` both; animations are CSS only; behaviour belongs in `assistant-ui/**` not in `ui/**`.

**Styling tech (all React kit files):** Tailwind CSS v4 utility classes inline (`cn` = clsx+twMerge from `src/lib/utils.ts`), `cva` variants, shadcn design tokens (`bg-background`, `border-border`, `text-muted-foreground`, `bg-muted`, `bg-popover`, ...), stable `aui-*` class names for overriding, `data-*` attribute selectors (`data-open`, `data-closed`, `data-status`), custom variants and keyframes injected by the registry (`collapsibleStateCss`: `@custom-variant data-open|data-closed`, `collapsible-down|up`), `tw-shimmer` for shimmer, and `elements/surfaces.tsx` (shared class strings: `paper`, `floating`, `field`, `fieldInteractive`, `pressable`, `ghostButton`, `inkButton`, `iconSwap`...). No CSS-variable theme file ships with the kit (consumer's shadcn tokens). Dependencies: `lucide-react` icons, `@base-ui/react` (default primitives) or `radix-ui` (twin), `class-variance-authority`, `tw-shimmer`.

### 4.1 Chat-core components (used by the `thread` item)

| Component | File (`elements/`) | Composes | Styling / deps | Chat app? |
|---|---|---|---|---|
| `Thread` (+ internal `ThreadRoot`, `ThreadWelcome`, `ThreadSuggestions`, `ThreadLoadEarlier`, `ThreadScrollToBottom`, `Composer`, `ComposerAction`, `UserMessage`, `AssistantMessage`, `EditComposer`, `BranchPicker`, `AssistantActionBar`, `UserActionBar`, `MessageError`, `ThreadHistorySkeleton`, `DefaultToolGroup`, `SpokenMessage`) | `thread.aui.tsx` (998 lines) | Primitives: `ThreadPrimitive.{Root,Viewport,ViewportFooter,Messages,Suggestions,ScrollToBottom,LoadEarlier}`, `MessagePrimitive.{Root,Parts,GroupedParts,Error}`, `ComposerPrimitive.{Root,Input,Send,Cancel,AttachmentDropzone,Dictate,StopDictation,Resume}`, `ActionBarPrimitive.{Root,Copy,Edit,Reload,Resume,RefreshRun,ExportMarkdown,FeedbackPositive,FeedbackNegative}`, `ActionBarMorePrimitive.*`, `BranchPickerPrimitive.*`, `ErrorPrimitive.*`, `SuggestionPrimitive.*`, `AuiIf`. Elements: attachment, file, image, markdown-text, reasoning, tool-fallback, tool-group, tooltip-icon-button, follow-up-suggestions | Tailwind; lucide-react; `ui/button`, `ui/skeleton`; exports `Thread`, `ThreadProps`, `ThreadComponents`, `ThreadGroupPart` (components override via React context `ThreadComponentsContext`) | **CHAT (main)** |
| `MarkdownText` | `markdown-text.tsx` (279) | `MarkdownTextPrimitive` from react-markdown, `remarkGfm`, `CodeHeader`, `TooltipIconButton`, `useCopyToClipboard`; element map h1-h6, p, a, blockquote, ul/ol/li, table parts, hr, pre, code (`aui-md-*` classes), `defer` | Tailwind + `@assistant-ui/react-markdown/styles/dot.css`; lucide; remark-gfm | **CHAT** |
| `TooltipIconButton` | `tooltip-icon-button.tsx` / `.radix.tsx` | `ui/button` (ghost icon) + `ui/tooltip`; props `tooltip`, `side` | Base UI tooltip (or Radix) | **CHAT** |
| `Reasoning` (`ReasoningRoot/Fade/Trigger/Content/Text`) | `reasoning.tsx` (props-only), `reasoning.aui.tsx` (binds `MessagePrimitive.Parts/GroupedParts`, `MarkdownText`) | `CollapsibleRoot`, `useScrollLock`, cva | Tailwind; lucide; animation duration const 200 ms | **CHAT** |
| `ToolFallback` (`Root/Duration/Trigger/Content/Args/Result/Error/Approval/ApprovalReceipt/ApprovalQuestions`) | `tool-fallback.aui.tsx` (1336) | `CollapsibleRoot`, `ui/button`, `ui/textarea`; reads `useAuiState` for part, status, approval; calls `respondToApproval`, `addResult` | Tailwind; lucide; `tw-shimmer`; registry css `collapsibleStateCss` | **CHAT** (also the tool approval and human-in-the-loop UI) |
| `ToolGroup` (`Root/Trigger/Content`) | `tool-group.aui.tsx`, `tool-group.tsx` | `CollapsibleRoot`, `useScrollLock`, `MessagePrimitive.GroupedParts` | Tailwind; cva; lucide; tw-shimmer | **CHAT** |
| `CollapsibleRoot/Trigger/Content` | `collapsible-root.tsx` / `.radix.tsx` | Base UI Collapsible (`@base-ui/react/collapsible`) or Radix | data-open/closed variants | **CHAT** (support) |
| `UserMessageAttachments`, `ComposerAttachments`, `ComposerAddAttachment` | `attachment.aui.tsx` / `.aui.radix.tsx`, `attachment-state.ts` | `AttachmentPrimitive.{Root,Name,Remove}`, `ComposerPrimitive.{Attachments,AddAttachment}`, `MessagePrimitive.Attachments`, `ui/dialog`, `ui/tooltip`, `ui/avatar`, `TooltipIconButton`, hook `use-attachment-src` (zustand) | Tailwind; lucide | **CHAT** |
| `ThreadList`, `ThreadListItem`, `ThreadListNew`, `ThreadListSearch`, `ThreadListRoot`, `ThreadListItems`, `useThreadListGroups` | `thread-list.aui.tsx` (490) | `ThreadListPrimitive.{Root,New,ItemByIndex}`, `ThreadListItemPrimitive.{Root,Trigger,Title,Archive,Delete}`, `ThreadListItemMorePrimitive.*`, `AuiIf`; `ui/button`, `ui/input`, `ui/skeleton` | Tailwind; lucide; client-side search and date grouping | **CHAT** |
| `ThreadFollowupSuggestions` | `follow-up-suggestions.aui.tsx` | `ThreadPrimitive.Suggestion`, `AuiIf`, `useAuiState` | Tailwind | **CHAT** (follow-ups) |
| `SyntaxHighlighter` (Prism) | `syntax-highlighter.tsx` | `makePrismAsyncLightSyntaxHighlighter` | react-syntax-highlighter | **CHAT** (code) |
| `SyntaxHighlighter` (Shiki) | `shiki-highlighter.tsx`, `.aui.tsx` | react-shiki / shiki | shiki | **CHAT** (alternative) |
| `Image`, `File` | `image.tsx` (681), `file.tsx` (415) | `href` util; `media-player` (file); Base/cva | Tailwind; cva | **CHAT** (attachments, image parts) |
| `Sources` | `sources.aui.tsx`, `sources.tsx` | `Badge`, `CollapsibleRoot`, href util | Tailwind; cva; lucide | OPT |
| `MessageTiming` | `message-timing.aui.tsx`, `message-timing.tsx` | `useMessageTiming`, `ui/tooltip` | Tailwind | OPT |
| `Quote` (composer quote + selection toolbar + message quote) | `quote.aui.tsx` (290) | `ComposerPrimitive.{Quote,QuoteText,QuoteDismiss}`, `SelectionToolbarPrimitive.*`, `MessagePrimitive.Quote` | Tailwind; lucide | OPT |
| `AssistantModal` | `assistant-modal.aui.tsx` / `.aui.radix.tsx`, `utils/modal-size.ts` | `@base-ui/react/popover` (not `AssistantModalPrimitive`), `Thread`, `ThreadList`, `TooltipIconButton` | Tailwind; lucide | OPT |
| `AssistantSidebar`, `ThreadListSidebar` | `assistant-sidebar.aui.tsx`, `threadlist-sidebar.aui.tsx` | `ui/sidebar`, `ThreadList`; `react-resizable-panels` | Tailwind | OPT (layout) |
| `ComposerTriggerPopover`, `DirectiveText` | `composer-trigger-popover.aui.tsx`, `directive-text.aui.tsx` | `ComposerPrimitive.TriggerPopover*`, `Badge` | Tailwind | OPT (mentions) |
| `ContextDisplay`, `ModelSelector`, `MCPConfig` | `context-display.aui.tsx`, `model-selector.aui.tsx`, `mcp-config.aui.tsx` | token usage, model radio list, MCP panel | | OPT / MCP n/a |
| `MermaidDiagram`, `DiffViewer`, `VoiceConversation`, `Voice` | `mermaid-diagram.aui.tsx`, `ui/base/diff-viewer.tsx`, `voice*.tsx` | `componentsByLanguage.mermaid`; voice | | OPT / voice n/a |
| `ConversationMap`, `TaskCard`, `AgentStatus` | `*.aui.tsx` | agent UI | | OPT |

### 4.2 Props-only "elements" (no runtime binding; ~100 files, registered as `elements-<slug>`)

Pure presentational pieces driven by props, listed in `apps/registry/src/registry.ts` lines 190-1062. Chat-relevant
ones: `composer`, `message-pair`, `message-actions`, `message-branches`, `edit-message`, `suggestions`, `empty-state`,
`error-state`, `stopped-run`, `loading-state`, `thinking-indicator`, `typing-indicator`, `streaming-text`,
`scroll-anchor`, `thread-list`, `message-attachment`, `message-queue`, `tool-call`, `tool-error`, `tool-group`,
`reasoning-panel`, `approval-card`, `question-flow`, `option-list`, `elicitation-form`, `permission-grant`,
`feedback-dialog`, `regenerate-menu`, `quote-reply`, `day-separator`, `connection-state`, `draft-restore`,
`sources`, `inline-citation`, `web-search`, `message-timing`, `chat-panel`, `conversation-search`, `thread-search`.
The rest (charts, maps, flow graphs, data tables, code runner, terminal, agent cards, cost meters, research report,
etc.: `chart`, `geo-map`, `flow-graph`, `data-table`, `terminal-block`, `code-diff`, `reviewable-diff`, `file-tree`,
`media-player`, `trace-waterfall`, `agent-*`, `schedule-card`, `command-palette`, ...) are generative-UI/agent
widgets and out of scope.

### 4.3 Underlying shadcn-style primitives (`packages/ui/src/components/react/ui/{base,radix}`)

A chat app needs: `button`, `tooltip`, `dialog`, `avatar`, `skeleton`, `input`, `textarea`, `collapsible`,
`popover`, `badge`, `separator`, `sidebar`, `sheet` (sidebar), `dropdown-menu` (action bar more), `scroll-area`.
Base UI wrappers in `ui/base/*`, Radix in `ui/radix/*`. `hooks/use-mobile.ts` supports `sidebar`.

### 4.4 Vue kit (closest to an Angular target)

`UI/vue/assistant-ui/`: `thread.vue` (137), `message.vue` (161), `markdown-text.vue` (85, raw markdown-it),
`reasoning.vue` (195), `thread-list.vue` (253), `tool-fallback.vue` (865), plus tests `thread.test.ts`,
`thread-list.test.ts`, `tool-fallback.test.ts`. Template for an Angular styled kit: these compose the Vue
primitives directly with Tailwind classes.

### 4.5 Needs matrix (target of "a ready-made styled kit")

| Piece | Need | Framework-independent portion |
|---|---|---|
| thread, composer, message, action bar, branch picker | yes | Tailwind class strings in `thread.aui.tsx` (copyable verbatim) |
| markdown-text + code header + copy | yes | class strings, element map |
| tooltip-icon-button | yes | needs an Angular tooltip |
| attachment (composer + message, dialog preview) | yes | |
| thread-list (+ search, grouping) | yes | grouping logic in `useThreadListGroups` |
| reasoning, tool-fallback (incl. approval), tool-group | yes | |
| follow-up suggestions, scroll-to-bottom, empty state, error | yes | |
| assistant modal / sidebar | no (layout) | |
| quote, mentions popover, model selector, context display, timing | optional | |

---

## 5. Core-provided runtime features the UI depends on

Everything below is in `packages/core/src` (framework-neutral TS unless noted). State and method shapes are in
`store/scopes/*.ts`; runtime implementations in `runtime/*` and `runtimes/*`. Phase 1 consumes the AI SDK runtime
(`AISDKChat`, `AISDKThreads` in `packages/ai-sdk/src/runtime/`) which sits on the external-store core.

| Feature | Names a binding needs to call / read | Notes |
|---|---|---|
| **Branch switching** | `aui.message().switchToBranch({position: "previous"\|"next"} \| {branchId})`; state `message.branchNumber`, `message.branchCount`, `message.parentId`; capabilities `switchToBranch`, `switchBranchDuringRun`; event `message.branchSwitched`; predicates `branchPickerPreviousDisabled/NextDisabled`; external-store `ExternalThreadBranchAdapter {getBranches(messageId), switchToBranch(branchId)}` (`runtime/branch/external-thread-branch-adapter.ts`), `ExternalStoreBranchChange` / `unstable_onBranchChange` | AI SDK runtime keeps branches client-side in `MessageRepository` (`runtime/utils/message-repository.ts`); `ExportedMessageRepository` for persistence |
| **Edit composer** | `aui.composer().beginEdit()` (from message scope; edit composer is `aui.message().composer()`), then `setText`, `send()`, `cancel()`; state `message.composer` (`ComposerState` with `type: "edit"`, `isEditing`); `aui.thread().message({id}).composer()`; hooks `useEditComposerSend/Cancel`; predicate `actionBarEditDisabled`; capability `edit`; adapter hook `ExternalStoreAdapter.onEdit(message: AppendMessage)`; `parentId`/`sourceId` on `AppendMessage` | Edit creates a new branch. Core: `runtime/base/default-edit-composer-runtime-core.ts`. Tests `core/src/tests/default-edit-composer-runtime-core.test.ts`, `runtimes/local/local-thread-runtime-core.edit-cancellation.test.ts`, `runtimes/external-store/external-store-thread-runtime-core.edit-recovery.test.ts` |
| **Reload** | `aui.message().reload({runConfig?})`; `aui.thread().startRun({parentId, runConfig, sourceId?})`; capability `reload`; predicate `actionBarReloadDisabled`; event `message.reload`; adapter `onReload(parentId, config)` | Resume variant: `aui.thread().resumeRun(config)`, `canResume`, `onResume` |
| **Copy** | `aui.message().getCopyText()`, `setIsCopied(bool)`, state `message.isCopied`; event `message.copied`; predicate `actionBarCopyDisabled`; `unstable_capabilities.copy` | Clipboard write itself is a UI concern (`navigator.clipboard.writeText`); timer + scope-change cancellation lives in `useActionBarCopy` (copy its semantics, test `useActionBarCopy.test.ts`, `.scope-change.test.tsx`) |
| **Feedback** | `aui.message().submitFeedback({type: "positive"\|"negative", comment?})`; state `message.metadata.submittedFeedback.type`; adapter `FeedbackAdapter {submit({message, type, comment?})}` (`adapters/feedback.ts`); capability `feedback`; `SubmitFeedbackOptions` type | Pass via `adapters.feedback` on the runtime |
| **Attachments adapters** | `AttachmentAdapter {accept: string; add({file}) => Promise<PendingAttachment> \| AsyncGenerator<PendingAttachment>; remove(attachment); send(pending, {signal?}) => Promise<CompleteAttachment>}`; built-ins `SimpleImageAttachmentAdapter` (accept `image/*`, sends data URL as `image` part), `SimpleTextAttachmentAdapter` (text/plain,html,markdown,csv,xml,json,css; wraps content in `<attachment name="...">` text part), `CompositeAttachmentAdapter` (routes by `accept`; constructor takes adapters); helpers `fileMatchesAccept(file, accept)`, `getFileDataURL(file, {signal})`, `partToCompleteAttachment`; composer methods `addAttachment(File \| CreateAttachment)`, `clearAttachments()`, `attachment({index}\|{id}).remove()`; state `composer.attachments`, `composer.attachmentAccept`, `message.attachments`; event `composer.attachmentAdd`, `composer.attachmentAddError {reason: AttachmentAddErrorReason}`; types `Attachment`, `PendingAttachment`, `CompleteAttachment`, `AttachmentStatus` (`requires-action`/`running`/`complete`/`incomplete`) | Files: `adapters/attachment.ts`, `runtime/utils/attachment-add-operations.ts`, `attachment-send-operations.ts`. Cloud variant `CloudFileAttachmentAdapter` is out of scope. Tests `core/src/tests/{attachment,attachment-adapters,base-composer-runtime-core-addAttachment}.test.ts`, `adapters/attachment.test.ts`, `runtime/utils/attachment-send-operations.test.ts`. Mastra file handling goes through the AI SDK message `file` parts (`packages/ai-sdk/src/converters`) |
| **Suggestion adapters** | `SuggestionAdapter {key?, generate({messages, signal}) => Promise<ThreadSuggestion[]> \| AsyncGenerator}`; `createSuggestionAdapter({complete, count, instructions, maxMessages, key})`; `consumeSuggestionResult`; runtime option `adapters.suggestion`; external store `suggestions?: readonly ThreadSuggestion[]`; `aui.thread().getState().suggestions` and `aui.suggestions()` scope; static `Suggestions([...])` client | See 2.5. Tests `adapters/suggestion.test.ts`, `store/clients/suggestions.test.ts`, `core/src/tests/external-thread-suggestions.test.ts`, `runtimes/local/local-thread-runtime-core.detach-suggestions.test.ts` |
| **Thread list adapters** | `RemoteThreadListAdapter {list({after?}) => {threads: RemoteThreadMetadata[], nextCursor?}; rename(remoteId, title); updateCustom?(remoteId, custom); archive(remoteId); unarchive?(remoteId); delete(remoteId); initialize(threadId, {custom?}) => {remoteId, externalId?}; generateTitle(remoteId, messages) => Promise<AssistantStream>; fetch(threadId) => RemoteThreadMetadata; unstable_Provider?; unstable_useAdapters?}`; `RemoteThreadMetadata {status: "regular"\|"archived", remoteId, externalId?, title?, lastMessageAt?, custom?}`; `RemoteThreadListOptions {runtimeHook, adapter, initialThreadId?, threadId?, onThreadIdChange?, allowNesting?}` (`runtimes/remote-thread-list/types.ts`); implementations `InMemoryThreadListAdapter` (`runtimes/remote-thread-list/adapter/in-memory.ts`), `createLocalStorageAdapter` and `createSimpleTitleAdapter` (C/react `adapters/`); store clients `RemoteThreadList`, `InMemoryThreadList`, `SingleThreadList`, `ExternalThread` (`C/store`, `C/react/client`); `useRemoteThreadListRuntime` (React hook wrapper); `ExternalStoreThreadListAdapter {threadId, isLoading, threads, archivedThreads, onSwitchToNewThread, onSwitchToThread, onRename, onUpdateCustom, onArchive, onUnarchive, onDelete}` | Binding calls: `aui.threads().switchToThread(id, {unarchive?})`, `switchToNewThread()`, `item("main"\|{id}\|{index, archived?})` -> `switchTo/rename/archive/unarchive/delete/generateTitle/updateCustom/initialize/detach`, `loadMore()`, `reload()`, `reloadMainThread()`, `getLoadThreadsPromise()`; state `threads.{threadIds, archivedThreadIds, threadItems, mainThreadId, newThreadId, isLoading, isLoadingMore, hasMore, loadError, switchError, canUnarchive}`; events `threads.selectionChanged`, `threadListItem.switchedTo/Away`. For Mastra memory persistence implement `RemoteThreadListAdapter` against Mastra memory threads (`AISDKThreads` accepts an adapter) |
| **Message queue** | `createMessageQueue(driver: MessageQueueDriver {run(message, {steer}), cancel?}) => MessageQueueController {adapter, hold, release, notifyBusy, notifyIdle, notifyCancelled, clear, subscribe}`; `ExternalThreadQueueAdapter` (`runtime/queue/external-thread-queue-adapter.ts`, `QueuePlacement`); `QueueItemState {id, prompt, parts}`; `queueItem({index}\|{id})` -> `steer()`, `move(placement)`, `remove()`; state `composer.queue`; `composer.send({steer?})`; capability `queue`; `LocalRuntimeOptions.unstable_enableMessageQueue`, `unstable_queueClearOnRewind`; predicate `suggestionSendMode` ("now"/"queued"/"blocked") | Optional feature; sending while running is blocked unless `capabilities.queue`. Tests `core/src/tests/message-queue.test.ts`, `react/src/tests/local-runtime-queue.test.tsx` |
| **Speech** (note only) | `SpeechSynthesisAdapter`, `WebSpeechSynthesisAdapter`, `DictationAdapter`, `WebSpeechDictationAdapter`; `message.speech`, `speak()`, `stopSpeaking()`; composer `startDictation/stopDictation`, `composer.dictation` | n/a, out of scope. Note `ThreadPrimitive.Root` Escape handler and `Dictate` keep touching it; skip |
| **Run lifecycle / composer** | `aui.thread().append(CreateAppendMessage)`, `cancelRun()`, `startRun`, `resumeRun`, `deleteMessage(id)`, `reset(initial?)`, `export()`/`import(repo)`, `loadEarlier()`, `unstable_refetchThread()`, `getModelContext()`; state `thread.{isEmpty,isDisabled,isSendDisabled,isLoading,hasEarlier,isLoadingEarlier,isRunning,canResume,capabilities,messages,suggestions,state,extras}`; composer `setText(text, {origin?})`, `setRole`, `setRunConfig`, `send({steer?})`, `cancel()`, `reset()`, `setQuote`; state `composer.{text,role,attachments,runConfig,isEditing,canCancel,canSend,attachmentAccept,isEmpty,type,quote,queue,submission,inTransit}`; events `thread.runStart|runEnd|cancelRun|initialize|historyWriteError|toolApprovalAnswered|modelContextUpdate`, `composer.send|attachmentAdd|attachmentAddError|cancel|textChange`, `message.*` | `RuntimeCapabilities {switchToBranch, switchBranchDuringRun, edit, reload, refetchThread, delete, cancel, unstable_copy, speech, dictation, voice, attachments, feedback, queue, answerToolCall}` gate button availability |
| **Chain of thought** | `chainOfThought` scope: state `{parts, collapsed, status}`; `setCollapsed(bool)`; `part({index})` (`store/scopes/chain-of-thought.ts`, `store/clients/chain-of-thought-client.ts`) | Provided by `ChainOfThoughtByIndicesProvider` (C/react) under `MessagePrimitive.Parts` when `ChainOfThought` config, or by `GroupedParts` groups |
| **Tool call parts** | `aui.part().addToolResult(result)`, `resumeToolCall(payload)`, `respondToToolApproval(resp)`, `unstable_recordInteraction`; `aui.message().part({index}\|{toolCallId})` | Phase 1 `registerToolUI` plus renderers |
| **History persistence** | `ThreadHistoryAdapter {scopeId?, unstable_copy?, load(), append(item), update?, delete?, resume?...}`; `GenericThreadHistoryAdapter`, `MessageFormatAdapter`; `ExportedMessageRepository` | AI SDK runtime wraps this; relevant for Mastra memory restore |
| **Run config / local runtime** | `ChatModelAdapter {run({messages, runConfig, abortSignal, context, ...}) => Promise<result> \| AsyncGenerator}`, `LocalRuntimeOptionsBase {maxSteps, adapters{chatModel,history,attachments,speech,dictation,voice,feedback,suggestion}, unstable_humanToolNames, unstable_enableMessageQueue}` | Not needed with AI SDK runtime but useful for tests (`testing` entry uses a scripted transport) |
| **Smooth / timing** | `useStreamingTiming` (`C/react/runtimes/useStreamingTiming.ts`), `streaming-timing.ts`, `message.metadata.timing` | Feeds `useMessageTiming` |

---

## 6. Upstream tests worth mirroring (by family)

Angular runs every ported test in both zone and zoneless projects; prefer behaviour tests (not React/Vue specifics).

**Thread / viewport / scroll**
- `R/primitives/thread/ThreadRoot.test.tsx`, `ThreadViewport.thread-scope.test.tsx`, `useThreadViewportAutoScroll.test.tsx`
- `R/primitives/thread/topAnchor/{topAnchorTurn,computeTopAnchorSlack,mountTopAnchorReserve}.test.ts` (only if turnAnchor)
- `R/context/stores/ThreadViewport.test.ts`
- `V/primitives/ThreadPrimitiveViewportFooter.test.ts`, `V/useScrollLock.test.ts`, `R/primitives/reasoning/useScrollLock.test.tsx`
- `S/__tests__` thread-viewport-auto-scroll tests (search `thread-viewport-auto-scroll` under `packages/store`)
- `C/react/primitives/thread/{ThreadMessages,ThreadRow,ThreadSuggestions}.test.tsx`, `R/tests/threadMessageById.test.tsx`
- Svelte reference: `packages/svelte/src/__tests__/primitives-viewport.test.ts`

**Message / parts / tool UI**
- `C/react/primitives/message/{MessageParts,MessageParts.tool-interaction,MessageGroupedParts,MessageAttachments}.test.tsx`
- `R/primitives/message/{MessageRoot,MessageIf,MessagePartsGrouped}.test.tsx`
- `R/tests/{MessageParts.loading,MessageParts.rendererOptions,messagePartSwitchRace,messagePartTypeMismatch,toolCallTiming}.test.tsx`
- `C/react/model-context/{useToolArgsStatus,toolbox,define-toolkit,modelContextHooks,useInlineRender}.test.*`, `C/tests/{groupMessageParts,groupParts,tools-scope-migration}.test.ts*`
- `C/runtime/utils/{resolveToolApprovalResponse,pending-tool-calls,tool-interactions,tool-call-tree}.test.ts`
- Vue: `V/__tests__/{primitives-content,primitives-tool-ui,primitives-keyed-messages,primitives-keyed-items,byindex-shrink-race}.test.ts`, `V/primitives/{MessagePrimitiveParts.tool-interaction,ChainOfThoughtPrimitiveParts,ChainOfThoughtPrimitiveAccordionTrigger,stableKeys}.test.ts`
- Svelte: `primitives-parts.test.ts`, `primitives-messages.test.ts`

**messagePart / smooth / markdown**
- `R/primitives/messagePart/MessagePartText.test.tsx`, `R/utils/smooth/useSmooth.test.tsx`, `R/utils/hooks/useMediaQuery.test.tsx`
- `packages/markdown/src/{complete,parse,session,text-node}.test.ts`, `tokenizer/{markdown-it,math,commonmark}.test.ts`, `vue/Markdown.test.ts` (template for the Angular renderer test), `react/Markdown.test.tsx`
- Kit: `UI/react/assistant-ui/elements` tests (search `*.test.tsx` there), `UI/vue/assistant-ui/{thread,thread-list,tool-fallback}.test.ts`

**Composer / attachments**
- `R/primitives/composer/{ComposerInput,ComposerInput.text-change,ComposerInput.focus-on-run-start,ComposerInput.thread-scope,ComposerRoot,ComposerCancel.focus,ComposerDisabledThread,ComposerAddAttachment,ComposerAddAttachment.thread-scope,ComposerAttachmentDropzone}.test.tsx`, `useAuiState.composer.test.tsx`
- `C/react/primitives/composer/{ComposerAttachments,ComposerQueue}.test.tsx`, `R/primitives/attachment/AttachmentThumb.test.tsx`
- Core: `C/tests/{base-composer-runtime-core,base-composer-runtime-core-send,base-composer-runtime-core-addAttachment,composer-can-send,composer-can-cancel,attachment,attachment-adapters,composer-submission}.test.ts*`, `C/adapters/attachment.test.ts`, `C/runtime/utils/{attachment-send-operations,composer-submission,append-message}.test.ts`
- Vue: `V/__tests__/primitives-attachment.test.ts`, `V/primitives/composerAttachments.thread-scope.test.ts`; Svelte: `primitives-composer.test.ts`
- Trigger popover (if ported): `R/primitives/composer/trigger/*.test.*`, `R/unstable/{useMentionAdapter,useSlashCommandAdapter,useLiveCompletionAdapter,useComposerInput,useComposerInputHistory}.test.tsx`

**Action bar / branch picker / feedback / edit / error**
- `R/primitives/actionBar/{ActionBarCopy,ActionBarFeedback,ActionBarExportMarkdown}.test.tsx`
- `C/react/primitive-hooks/{useActionBarCopy,useActionBarCopy.scope-change,useMessageError}.test.*`, `C/store/primitive-predicates.test.ts`
- Core: `C/tests/{external-thread-branches,external-thread-feedback,default-edit-composer-runtime-core}.test.ts*`, `C/runtime/api/message-runtime.test.ts`, `C/runtimes/local/local-thread-runtime-core.edit-cancellation.test.ts`, `C/runtimes/external-store/external-store-thread-runtime-core.edit-recovery.test.ts`
- Vue: `V/__tests__/primitives-actionbar.test.ts`; Svelte: `primitives-actionbar.test.ts`
- Error primitive: no dedicated test; `C/react/primitive-hooks/useMessageError.test.ts`

**Suggestions**
- `C/react/primitive-hooks/useSuggestionTrigger.test.ts`, `C/store/clients/suggestions.test.ts`, `C/adapters/suggestion.test.ts`, `C/tests/external-thread-suggestions.test.tsx`, `C/react/runtimes/useExternalStoreRuntime.suggestions.test.tsx`
- Vue: `V/__tests__/primitives-suggestions.test.ts`; Svelte: `primitives-suggestions.test.ts`

**Thread list**
- `R/primitives/threadListItem/{ThreadListItemTitle,ThreadListItemUnarchive,ThreadListKeyboardNav}.test.tsx`, `C/react/primitives/threadList/ThreadListItems.test.tsx`, `R/tests/{threadListItemIsRunning,in-memory-thread-list}.test.tsx`, `C/react/client/InMemoryThreadList.test.tsx`
- Core remote list: `C/tests/RemoteThreadListThreadListRuntimeCore-*.test.ts` (loadMore, switchToThread-*, reload, title-race, errors), `C/react/client/RemoteThreadList*.test.ts*`, `C/runtimes/remote-thread-list/*.test.ts`, `C/tests/thread-switch-events.test.tsx`, `C/store/runtime-clients/handle-thread-list-action.test.ts`
- Vue: `V/__tests__/primitives-threadlist.test.ts`, `V/primitives/{ThreadListKeyboardNav,threadListStructural.unarchive}.test.ts`; Svelte: `primitives-threadlist.test.ts`

**Chain of thought / reasoning**
- `C/react/primitives/chainOfThought/ChainOfThoughtParts.test.tsx`, `R/primitives/chainOfThought/ChainOfThoughtAccordionTrigger.test.tsx`, `V/primitives/ChainOfThoughtPrimitive*.test.ts`, `C/utils/getGroupStatus.test.ts`

**Store / provider (already done, for reference)**
- `V/__tests__/{AuiProvider,AuiIf,useAuiState,useAuiEvent}.test.ts`, `packages/store/src/__tests__`

**Selection toolbar / assistant modal / queue (if ported)**
- `R/primitives/selectionToolbar/SelectionToolbarRoot.test.tsx`, `R/utils/getSelectionMessageId.test.ts`, `R/primitives/assistantModal/{AssistantModalRoot,AssistantModalTrigger}.test.tsx`, `C/react/primitives/composer/ComposerQueue.test.tsx`, `C/tests/message-queue.test.ts`

**Docs pages to port as Angular docs** (`apps/docs/content/docs/`): `primitives/{thread,message,composer,action-bar,branch-picker,attachment,suggestion,thread-list,error,chain-of-thought,selection-toolbar,assistant-modal}.mdx`, `guides/{attachments,branching,chain-of-thought,editing,suggestions,part-grouping,message-timing,scrollbar,latex,quoting,mentions,slash-commands,input-history,headless-composer-input}.mdx`, `(reference)/api-reference/{primitives,hooks,tools,adapters,runtimes}/*`, `integrations/frameworks/mastra/*`.
