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

Keyed by the **React** export: every `packages/react/src/primitives/*.ts` barrel member and every
name exported from `packages/react/src/index.ts` (including `export * from "./context"`). Names are
listed individually; several names share a row only where they share a status and an owner. Columns:
the export, whether the upstream Vue binding has it, the Angular status, and the phase 2 task that owns it.

Status is `ported`, `planned (Task N)` or `n/a (<reason>)`. Each task flips only its own rows.
Only the agreed out-of-scope list (voice, speech, dictation, generative UI, MCP apps, devtools, Assistant
Cloud, cloud run state, LangGraph/A2A, props-only generative/agent elements) and names that an existing
Angular scope or directive replaces exactly are `n/a`.

### Store, context and scope

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| AuiProvider | yes | ported (as `[auiProvider]`) |  |
| AuiIf | yes | ported (as `*auiIf`) |  |
| useAui | yes | ported (as `injectAui`) |  |
| useAuiState | yes | ported (as `injectAuiState`) |  |
| useAuiEvent | yes | ported (as `injectAuiEvent`) |  |
| AuiConfig | yes | ported (re-export of `@assistant-ui/store/client`) |  |
| AssistantClient, AssistantState, AssistantEventSelector, AssistantEventName, AssistantEventCallback, Unsubscribe | yes | ported (re-exports of `@assistant-ui/store/client`) |  |
| AssistantEventScope, AssistantEventPayload | no | ported (type re-exports of `@assistant-ui/store`) | |
| AssistantRuntimeProvider | no | n/a (replaced by `[auiProvider]` with `AuiConfig({ threads: RuntimeAdapter(runtime) })`) |  |
| MessageByIndexProvider | yes | n/a (replaced by `aui-thread-messages` + `messageScopeConfig`) |  |
| PartByIndexProvider | yes | n/a (replaced by `aui-message-parts` + `partScopeConfig`) |  |
| SuggestionByIndexProvider | yes | ported (via `indexScopeConfig` kind `suggestion`) | Task 7 |
| MessageAttachmentByIndexProvider, ComposerAttachmentByIndexProvider | yes | ported (via `indexScopeConfig` kind `attachment`) | Task 6 |
| ThreadListItemByIndexProvider | yes | ported (via `indexScopeConfig` kind `threadListItem`) | Task 8 |
| ChainOfThoughtByIndicesProvider, ChainOfThoughtPartByIndexProvider | yes | ported (the `auiChainOfThought` template of `aui-message-parts` builds the group scope; parts via `indexScopeConfig` kind `chainOfThoughtPart`) | Task 9 |
| ThreadListItemRuntimeProvider, MessageProvider, TextMessagePartProvider, ReadonlyThreadProvider | no | ported (as `threadListItemRuntimeScope`, `messageObjectScope`, `textMessagePartScope` and `readonlyThreadScope`, scope configs for `[auiProvider]`) | |
| useThreadViewport, useThreadViewportStore, ThreadViewportState | no | n/a (replaced by `AUI_VIEWPORT`, `injectAuiViewport` and `AuiViewport`) |  |
| INTERNAL | no | n/a (upstream-internal namespace, not public API) |  |

### Thread (`ThreadPrimitive`)

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| ThreadPrimitive.Root | yes | ported (as `[auiThreadRoot]`) |  |
| ThreadPrimitive.Viewport | partial (no turnAnchor or clamp) | ported (`turnAnchor` and `topAnchorMessageClamp` inputs) | Task 2 |
| useThreadViewportAutoScroll | yes (via `createThreadViewportAutoScroll`) | ported (built into the viewport directive) |  |
| ThreadPrimitive.ViewportProvider | no | n/a (replaced by `AUI_VIEWPORT`) |  |
| ThreadPrimitive.ViewportFooter | yes | ported (as `[auiThreadViewportFooter]`) | Task 2 |
| ThreadPrimitive.Messages | yes | ported (as `aui-thread-messages`) |  |
| ThreadPrimitive.MessageByIndex, ThreadPrimitive.Unstable_MessageById | provider only | n/a (replaced by `aui-thread-messages` + `messageScopeConfig`) |  |
| ThreadPrimitive.Row, createThreadRowsSelector, ThreadRow, ThreadRowsOptions | no | ported (as `aui-thread-row` and `aui-thread-rows`; selector and types re-exported) | Task 2 |
| ThreadPrimitive.ScrollToBottom | yes | ported (as `button[auiThreadScrollToBottom]`) | Task 2 |
| ThreadPrimitive.LoadEarlier | no | ported (as `button[auiThreadLoadEarlier]`) | Task 2 |
| ThreadPrimitive.Suggestions | yes | ported | Task 7 |
| ThreadPrimitive.SuggestionByIndex | provider | ported | Task 7 |
| ThreadPrimitive.Suggestion | no (use `SuggestionPrimitiveTrigger`) | ported (covered by `button[auiSuggestionTrigger]`; pass `prompt` for an explicit-prompt button outside the list) | Task 7 |
| ThreadPrimitive.Empty, ThreadPrimitive.If | no | n/a (deprecated upstream, replaced by `*auiIf`) |  |
| useScrollLock | yes | ported (as `injectScrollLock`) | Task 2 |
| unstable_useThreadMessageIds | no | ported (as `unstable_injectThreadMessageIds`) | |
| useThreadRootElementRef | no | ported (as `injectThreadRootElementRef`, provided by the thread root directive) | Task 2 |

### Message (`MessagePrimitive`)

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| MessagePrimitive.Root | yes | ported (as `[auiMessageRoot]`) |  |
| MessagePrimitive.Parts, MessagePrimitive.Content | yes | ported (as `aui-message-parts`) |  |
| MessagePrimitive.PartByIndex | provider | n/a (replaced by `aui-message-parts` + `partScopeConfig`) |  |
| MessagePrimitive.GroupedParts, groupPartByType, GroupByContext | no | ported (as `aui-message-grouped-parts` with `ng-template auiGroup` / `auiPart` / `auiIndicator` slots and `aui-group-children`; `groupPartByType`, `GroupByContext`) |  |
| MessagePrimitive.Attachments | yes | ported | Task 6 |
| MessagePrimitive.AttachmentByIndex | provider | ported | Task 6 |
| MessagePrimitive.Error | no | ported (as `*auiMessageError`) |  |
| MessagePrimitive.Quote, useMessageQuote | no | ported (as `*auiMessageQuote` and `injectMessageQuote`) |  |
| MessagePrimitive.If | no | n/a (deprecated upstream, replaced by `*auiIf`) |  |
| MessagePrimitive.GenerativeUI, GenerativeUIRender, GenerativeUIRenderError, GenerativeUIRenderProps, GenerativeUIComponentRegistry, GenerativeUIMessagePartComponent, GenerativeUIMessagePartProps, GenerativeUIMessagePart, GenerativeUINode, GenerativeUISpec | no | n/a (generative UI out of scope) |  |
| MessagePrimitive.Unstable_PartsGrouped, MessagePrimitive.Unstable_PartsGroupedByParentId | no | ported (as `aui-message-parts-grouped` with `groupingFunction` and `groupMessagePartsByParentId`; `ng-template auiEmpty` is the `components.Empty` slot (without it the `auiPart="text"` template or the default paragraph renders in a static empty text part scope), unkeyed groups render through the `default` group template) |  |
| useMessageTiming | no | planned (Task 18) | Task 18 |
| useToolCallElapsed | no | ported (as `injectToolCallElapsed`) | Task 17 |
| unstable_useMessageStallDetection, Unstable_MessageStallDetection, Unstable_MessageStallDetectionOptions | no | ported (as `injectMessageStallDetection`, `MessageStallDetection`, `MessageStallDetectionOptions`) |  |

### Message part (`MessagePartPrimitive`) and tool UI

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| MessagePartPrimitive.Text, useSmooth, SmoothOptions | no | ported (as `aui-part-text`, `injectSmooth` / `injectSmoothState`, `SmoothOptions`) |  |
| MessagePartPrimitive.Image | no | ported (as `img[auiPartImage]`) |  |
| MessagePartPrimitive.InProgress | no | ported (as `*auiPartInProgress`) |  |
| MessagePartPrimitive.Messages | no | ported (as `aui-part-messages`) |  |
| useMessagePartText, useMessagePartReasoning, useMessagePartSource, useMessagePartFile, useMessagePartImage, useMessagePartData | no | ported (as `injectMessagePartText`, `injectMessagePartReasoning`, `injectMessagePartSource`, `injectMessagePartFile`, `injectMessagePartImage`, `injectMessagePartData`) |  |
| makeAssistantToolUI, useAssistantToolUI, AssistantToolUI, AssistantToolUIProps | yes | ported (as `registerToolUI` and `ToolUIProps`) |  |
| makeAssistantDataUI, useAssistantDataUI, AssistantDataUI, AssistantDataUIProps, DataRenderers | yes | ported (as `registerToolUI` and `DataUIProps`) |  |
| ToolCallMessagePartComponent, ToolCallMessagePartProps | yes | ported (as `ToolUIComponent` and `ToolUIProps`) |  |
| EmptyMessagePartComponent, EmptyMessagePartProps, TextMessagePartComponent, TextMessagePartProps, ReasoningMessagePartComponent, ReasoningMessagePartProps, SourceMessagePartComponent, SourceMessagePartProps, ImageMessagePartComponent, ImageMessagePartProps, FileMessagePartComponent, FileMessagePartProps, DataMessagePartComponent, DataMessagePartProps, QuoteMessagePartComponent, QuoteMessagePartProps | yes | ported (as `AuiPartTemplateDirective` and `AuiPartTemplateContext`) |  |
| Unstable_AudioMessagePartComponent, Unstable_AudioMessagePartProps | no | ported (as `ng-template auiPart="audio"`) |  |
| ReasoningGroupComponent, ReasoningGroupProps | no | ported (as `ng-template auiGroup` and `AuiGroupTemplateContext`) |  |
| useToolArgsStatus, ToolArgsStatus | no | ported (as `injectToolArgsStatus`, `computeToolArgsStatus`, `ToolArgsStatus`; reads assistant-stream's partial-JSON tag without importing the optional peer) | Task 17 |
| EnrichedPartState, PartState | no | ported (type re-exports) | |
| ToolExecutionStatus | no | ported (type re-export) | |
| Unstable_InteractableToolRenderProps | no | ported (the `interactable` input of `unstable_interactableTool` render components) | |

### Model context, frontend tools and interactables

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| useAssistantInstructions | no | ported (as `injectAssistantInstructions`) | |
| useAssistantContext, AssistantContextConfig | no | ported (as `injectAssistantContext`) | |
| makeAssistantVisible | no | ported (as `[auiAssistantVisible]`) | |
| makeAssistantTool, useAssistantTool, AssistantTool, AssistantToolProps | no | ported (as `registerTool`; `makeAssistantTool` returns a registrar to call in an injection context) | |
| tool, Tool, stubTool, Tools, Toolkit, ToolDefinition, ToolkitDefinition, ToolkitDefinitionEntry, ProviderToolConfig, ToolCallText, defineToolkit, providerTool, externalTool, humanTool, hitl, hitlTool | no | ported (`tool` and `Tool` re-exported; `registerToolkit` mounts a toolkit, and plain-object toolkits use `defineToolkit`, `stubTool`, `humanTool`, `hitl`, `hitlTool`, `providerTool`, `externalTool` re-exported; `Tools` is re-exported from `angular-assistant-ui/react-interop` for `AuiConfig`; the marker functions are re-implemented) | |
| defineMcpToolkit, McpToolkitEntry, McpToolkitDefinition, McpToolkitToolConfig | no | ported (re-exported; `registerToolkit` skips `mcp` entries for model context) | |
| useAuiToolOverrides | no | ported (as `injectAuiToolOverrides`) | |
| useInlineRender | no | n/a (a tool UI is an Angular component with a `tool` input, so changing inline state is ordinary signal or input change detection; no stable-wrapper hook is needed) | |
| ModelContext, ModelContextOptions, ModelContextProvider, SystemPart, LanguageModelConfig, LanguageModelV1CallSettings, mergeModelContexts, ModelContextClient | no | ported (contracts and helpers re-exported; `ModelContextClient` is core's `ModelContext` store resource) | |
| ModelContextRegistry, ModelContextRegistryToolHandle, ModelContextRegistryInstructionHandle, ModelContextRegistryProviderHandle, SerializedTool, SerializedModelContext | no | ported (re-exported) | |
| AssistantFrameHost, AssistantFrameProvider, useAssistantFrameHost, FRAME_MESSAGE_CHANNEL, FrameMessageType, FrameMessage | no | n/a (MCP / generative UI — out of scope by agreement) |  |
| unstable_useWebMcpProvider, unstable_defaultWebMcpFilter, Unstable_WebMcpProviderOptions, Unstable_WebMcpProviderResult | no | n/a (MCP / generative UI — out of scope by agreement) |  |
| Interactables, unstable_Interactables, useAssistantInteractable, AssistantInteractableProps | no | ported (the `Interactables` and `unstable_Interactables` scope resources are re-exported from the secondary entry `angular-assistant-ui/react-interop`, which needs `react` or the tap shim; `injectAssistantInteractable`, `unstable_injectInteractable`) | |
| useInteractableState, unstable_useInteractable, unstable_useInteractableState, unstable_useInteractableVersions, unstable_interactableTool | no | ported (as `injectInteractableState`, `unstable_injectInteractable`, `unstable_injectInteractableState`, `unstable_injectInteractableVersions` and `unstable_interactableTool`) | |
| unstable_getInteractableSnapshots, unstable_formatInteractableSnapshot, unstable_getInteractableVersions, Unstable_InteractableSnapshotEntry, Unstable_InteractableVersion | no | ported (re-exported) | |
| Unstable_InteractableConfig, Unstable_InferInteractableState, Unstable_InteractableVersionInfo, Unstable_InteractableToolConfig, Unstable_InteractableStateSchema, Unstable_InteractablesState, Unstable_InteractableDefinition, Unstable_InteractableRegistration, Unstable_InteractablesMethods, Unstable_InteractablePersistedState, Unstable_InteractablePersistenceAdapter, Unstable_InteractablePersistenceStatus, Unstable_InteractablesClientSchema, Unstable_InteractablesConfig | no | ported (interactable types re-exported; `InteractableConfig` is the Angular config) | |
| McpAppRenderer, McpAppsRemoteHost, getMcpAppFromToolPart, McpAppPartOptions, McpAppRendererOptions, McpAppMetadata, McpAppResource, McpAppResourceMeta, McpAppResourceCSP, McpAppSandboxConfig, McpAppHostInfo, McpAppHostContext, McpAppDisplayMode, McpAppsHost, McpAppsRemoteHostOptions, McpAppToolCallParams, McpAppInitializeParams, McpAppBridgeHandlers, ToolCallMessagePartMcpMetadata, McpAppResourceOutput, ShimLoadError, ShimLoadErrorCode | no | n/a (MCP apps out of scope) |  |

### Composer (`ComposerPrimitive`, `QueueItemPrimitive`)

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| ComposerPrimitive.Root | no | ported (as `form[auiComposerRoot]`: submit, click-to-focus, `data-aui-composer-type`, `compact`) |  |
| ComposerPrimitive.Input | partial (`submitOnEnter`) | ported (as `textarea[auiComposerInput]`: `submitMode`, deprecated `submitOnEnter`, `cancelOnEscape`, `addAttachmentOnPaste`, `autoFocus`, `focusOnRunStart`, `focusOnThreadSwitch`, `focusOnScrollToBottom`, `insertNewlineOnTouchEnter`, steer hotkey, IME) |  |
| ComposerPrimitive.Send | yes | ported (as `button[auiComposerSend]`) |  |
| ComposerPrimitive.Cancel | yes | ported (as `button[auiComposerCancel]`) |  |
| ComposerPrimitive.AddAttachment | yes | ported | Task 6 |
| ComposerPrimitive.Attachments | yes | ported | Task 6 |
| ComposerPrimitive.AttachmentByIndex | provider | ported | Task 6 |
| ComposerPrimitive.AttachmentDropzone | yes | ported | Task 6 |
| ComposerPrimitive.Quote, ComposerPrimitive.QuoteText, ComposerPrimitive.QuoteDismiss | no | ported (as `*auiComposerQuote`, `[auiComposerQuoteText]`, `button[auiComposerQuoteDismiss]`) |  |
| ComposerPrimitive.Queue | no | ported (as `<aui-composer-queue>` with `ng-template[auiQueueItem]`) |  |
| QueueItemPrimitive.Text, QueueItemPrimitive.Steer, QueueItemPrimitive.Remove | no | ported (as `[auiQueueItemText]`, `button[auiQueueItemSteer]`, `button[auiQueueItemRemove]`) |  |
| unstable_useComposerInputHistory, Unstable_ComposerInputHistory | no | ported (as `injectComposerInputHistory()` / `ComposerInputHistory`) |  |
| unstable_useComposerInput, Unstable_UseComposerInputOptions, Unstable_ComposerInput | no | ported (as `injectComposerInput()` / `ComposerInputOptions` / `ComposerInputBridge`) |  |
| unstable_useComposerRunStartFocusGuard, Unstable_ComposerRunStartFocusGuard | no | ported (as `injectComposerRunStartFocusGuard()` / `ComposerRunStartFocusGuard`) |  |
| ComposerPrimitive.TriggerPopoverRoot, ComposerPrimitive.TriggerPopover, ComposerPrimitive.TriggerPopoverCategories, ComposerPrimitive.TriggerPopoverCategoryItem, ComposerPrimitive.TriggerPopoverItems, ComposerPrimitive.TriggerPopoverItem, ComposerPrimitive.TriggerPopoverBack | no | ported (as `[auiComposerTriggerPopoverRoot]`, `[auiComposerTriggerPopover]` with `char`, `adapter`/`items`, `directive`/`action` inputs, `[auiComposerTriggerPopoverCategories]`, `button[auiComposerTriggerPopoverCategoryItem]`, `[auiComposerTriggerPopoverItems]`, `button[auiComposerTriggerPopoverItem]`, `button[auiComposerTriggerPopoverBack]`; the composer textarea gets `[auiComposerTriggerPopoverInput]`) | Task 10 |
| ComposerPrimitive.Unstable_TriggerPopoverRoot, ComposerPrimitive.Unstable_TriggerPopover, ComposerPrimitive.Unstable_TriggerPopoverCategories, ComposerPrimitive.Unstable_TriggerPopoverCategoryItem, ComposerPrimitive.Unstable_TriggerPopoverItems, ComposerPrimitive.Unstable_TriggerPopoverItem, ComposerPrimitive.Unstable_TriggerPopoverBack | no | ported (the `Unstable_` names are exported as `AuiUnstableComposerTriggerPopover{Root,Categories,CategoryItem,Items,Item,Back}Directive` and `AuiUnstableComposerTriggerPopoverDirective` aliases of the same classes) | Task 10 |
| unstable_useTriggerPopoverRootContext, unstable_useTriggerPopoverRootContextOptional, unstable_useTriggerPopoverScopeContext, unstable_useTriggerPopoverScopeContextOptional, unstable_useTriggerPopoverTriggers, unstable_useTriggerPopoverTriggersOptional | no | ported (as `injectTriggerPopoverRootContext`, `injectTriggerPopoverRootContextOptional`, `injectTriggerPopoverScopeContext`, `injectTriggerPopoverScopeContextOptional`, `injectTriggerPopoverTriggers`, `injectTriggerPopoverTriggersOptional`; the triggers are a `Signal`) | Task 10 |
| unstable_useTriggerPopoverAriaProps, Unstable_TriggerPopoverAriaProps | no | ported (as `injectTriggerPopoverAriaProps()` returning a `Signal`, applied by `[auiComposerTriggerPopoverInput]`; type `TriggerPopoverAriaProps` and the `Unstable_` alias) | Task 10 |
| unstable_useMentionAdapter, Unstable_UseMentionAdapterOptions, Unstable_Mention, Unstable_MentionCategory, Unstable_MentionDirective, Unstable_IconComponent, Unstable_ModelContextToolsOptions | no | ported (as `injectMentionAdapter()` returning `{ adapter, directive }` signals; `Unstable_IconComponent` is an Angular `Type<unknown>`; tools come from `aui.thread.getModelContext()`) | Task 10 |
| unstable_useSlashCommandAdapter, Unstable_UseSlashCommandAdapterOptions, Unstable_SlashCommand, Unstable_SlashCommandAction | no | ported (as `injectSlashCommandAdapter()` returning `{ adapter, action }` signals) | Task 10 |
| unstable_useLiveCompletionAdapter, Unstable_UseLiveCompletionAdapterOptions | no | ported (as `injectLiveCompletionAdapter()` returning `{ adapter, isLoading }` signals) | Task 10 |
| defaultDirectiveFormatter, unstable_defaultDirectiveFormatter, DirectiveFormatter, DirectiveSegment, TriggerAdapter, TriggerCategory, TriggerItem, Unstable_DirectiveFormatter, Unstable_DirectiveSegment, Unstable_TriggerItem, Unstable_RegisteredTrigger, TriggerMatch, TriggerMatcher, Unstable_TriggerMatch, Unstable_TriggerMatcher, Unstable_TriggerBehavior | no | ported (re-exported from `@assistant-ui/core`, plus `TriggerMatch`, `TriggerMatcher`, `TriggerBehavior`, `RegisteredTrigger` and their `Unstable_` aliases defined in the library; the `detectTrigger` helper is also exported) | Task 10 |
| ComposerPrimitive.Resume | no | n/a (cloud and resumable run state out of scope) |  |
| ComposerPrimitive.Dictate, ComposerPrimitive.StopDictation, ComposerPrimitive.DictationTranscript, DictationAdapter, DictationState, WebSpeechDictationAdapter | no | n/a (dictation out of scope) |  |
| ComposerPrimitive.If | no | n/a (deprecated upstream, replaced by `*auiIf`) |  |
| ComposerSubmission, ComposerSendOptions, ComposerTextOrigin, ComposerState, ThreadComposerState, EditComposerState, ComposerRuntimeState | no | ported (type re-exports) | |
| createMessageQueue, MessageQueueDriver, MessageQueueController, ExternalThreadQueueAdapter, ExternalThreadBranchAdapter, QueueItemState, QueueItemMethods, TaskState, TaskMethods | no | ported (queue helpers and types re-exported) | |

### Action bar and branch picker (`ActionBarPrimitive`, `ActionBarMorePrimitive`, `BranchPickerPrimitive`)

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| ActionBarPrimitive.Root | yes | ported | Task 4 |
| ActionBarPrimitive.Copy | yes | ported | Task 4 |
| ActionBarPrimitive.Reload | yes | ported | Task 4 |
| ActionBarPrimitive.Edit | yes | ported | Task 4 |
| ActionBarPrimitive.FeedbackPositive, ActionBarPrimitive.FeedbackNegative, FeedbackAdapter, SubmitFeedbackOptions | no | ported | Task 4 |
| ActionBarPrimitive.ExportMarkdown | no | ported | Task 4 |
| ActionBarPrimitive.Speak, ActionBarPrimitive.StopSpeaking, SpeechSynthesisAdapter, WebSpeechSynthesisAdapter | no | n/a (speech out of scope) |  |
| ActionBarPrimitive.Resume, ActionBarPrimitive.RefreshRun | no | n/a (cloud and resumable run state out of scope) |  |
| ActionBarMorePrimitive.Root, ActionBarMorePrimitive.Trigger, ActionBarMorePrimitive.Content, ActionBarMorePrimitive.Item, ActionBarMorePrimitive.Separator | no | ported (menu, roving focus and aliases; `[auiActionBarMoreRoot]` holds the enclosing `[auiActionBarRoot]` interaction lock while open, following the actual open state for both interaction and the `open` binding, and releases it on close or destroy) | Task 10, integration |
| BranchPickerPrimitive.Root | no | ported | Task 4 |
| BranchPickerPrimitive.Previous, BranchPickerPrimitive.Next | yes | ported | Task 4 |
| BranchPickerPrimitive.Number | yes | ported | Task 4 |
| BranchPickerPrimitive.Count | yes | ported | Task 4 |

### Error (`ErrorPrimitive`)

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| ErrorPrimitive.Root | yes | ported (as `[auiErrorRoot]`) |  |
| ErrorPrimitive.Message | yes | ported (as `[auiErrorMessage]`) |  |

### Attachments (`AttachmentPrimitive`)

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| AttachmentPrimitive.Root | yes | ported | Task 6 |
| AttachmentPrimitive.Name | yes | ported | Task 6 |
| AttachmentPrimitive.unstable_Thumb | yes (`AttachmentPrimitiveThumb`) | ported (`aui-attachment-thumb-label` is upstream's extension/type label; `img[auiAttachmentThumb]` adds the image preview) | Task 6 |
| AttachmentPrimitive.Remove | yes | ported | Task 6 |
| AttachmentAdapter, SimpleImageAttachmentAdapter, SimpleTextAttachmentAdapter, CompositeAttachmentAdapter | no | ported (re-exported from core) | Task 6 |
| Attachment, PendingAttachment, CompleteAttachment, AttachmentStatus, CreateAttachment, AttachmentRuntime, AttachmentState, AttachmentRuntimeState | no | ported (type re-exports) | Task 6 |
| CloudFileAttachmentAdapter | no | n/a (Assistant Cloud out of scope) |  |
| useAttachmentSrc (kit hook) | no | ported (as `injectAttachmentSrc` in `angular-assistant-ui/ui`) | Task 17 |

### Suggestions (`SuggestionPrimitive`)

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| SuggestionPrimitive.Trigger | yes | ported | Task 7 |
| SuggestionPrimitive.Title | yes | ported | Task 7 |
| SuggestionPrimitive.Description | yes | ported | Task 7 |
| Suggestions, SuggestionConfig, ThreadSuggestion, createSuggestionAdapter, SuggestionAdapter, SuggestionAdapterGenerateOptions, CreateSuggestionAdapterOptions | yes (`Suggestions`) | ported (re-exported from core) | Task 7 |

### Thread list (`ThreadListPrimitive`, `ThreadListItemPrimitive`)

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| ThreadListPrimitive.Root | yes | ported | Task 8 |
| ThreadListPrimitive.New | yes | ported | Task 8 |
| ThreadListPrimitive.Items | yes | ported | Task 8 |
| ThreadListPrimitive.ItemByIndex | provider | ported | Task 8 |
| ThreadListPrimitive.LoadMore | yes | ported | Task 8 |
| ThreadListItemPrimitive.Root | yes | ported | Task 8 |
| ThreadListItemPrimitive.Trigger | yes | ported | Task 8 |
| ThreadListCollection, useThreadListCollection, ThreadListItemFocusProvider, useThreadListItemFocus | yes (`threadListFocusGroup`) | ported (thread list focus group) | Task 8 |
| ThreadListItemPrimitive.Title | yes | ported | Task 8 |
| ThreadListItemPrimitive.Archive, ThreadListItemPrimitive.Unarchive, ThreadListItemPrimitive.Delete | yes | ported | Task 8 |
| ThreadListItemMorePrimitive.Root, ThreadListItemMorePrimitive.Trigger, ThreadListItemMorePrimitive.Content, ThreadListItemMorePrimitive.Item, ThreadListItemMorePrimitive.Separator | no | ported (menu, `sharedFocusGroup` arrow keys and aliases; `button[auiThreadListItemMoreTrigger]` registers as the item's `more` button in the thread list item focus group, so the inline arrows move between the item trigger and it) | Task 10, integration |
| InMemoryThreadListAdapter, RemoteThreadListAdapter, RemoteThreadListProviderComponent, RemoteThreadListOptions, ThreadHistoryAdapter, GenericThreadHistoryAdapter, MessageFormatAdapter, MessageFormatItem, MessageFormatRepository, MessageStorageEntry, RuntimeAdapters, RuntimeAdapterProvider, useRuntimeAdapters | no | ported (consumed from `@assistant-ui/core`, not re-exported: `angular-assistant-ui/mastra` implements `RemoteThreadListAdapter` and a read-only `ThreadHistoryAdapter.withFormat` on core's `RemoteThreadList`, with per-thread adapters through `unstable_useAdapters`; apps import these types and `InMemoryThreadListAdapter` from core directly, and React's `RuntimeAdapterProvider` / `useRuntimeAdapters` are replaced by `unstable_useAdapters`) | Task 14 |
| ExternalThread, ExternalThreadProps, ExternalThreadMessage, InMemoryThreadList, InMemoryThreadListProps, RemoteThreadList, RemoteThreadListProps, SingleThreadList, ChainOfThoughtClient | no | ported (core store clients re-exported) | |
| ThreadListRuntime, ThreadListState, ThreadListItemRuntime, ThreadListItemState, ThreadListItemRuntimeState, ThreadListItemStatus, ThreadsState | no | ported (type re-exports) | |
| createSimpleTitleAdapter, TitleGenerationAdapter, JoinStrategy | no | ported (re-exported) | |
| useRemoteThreadListRuntime | no | ported (as `remoteThreadListConfig`, an `AuiConfig` over core `RemoteThreadList`) | |
| useCloudThreadListRuntime, useCloudThreadListAdapter, AssistantCloud, readAnonymousRefreshToken | no | n/a (Assistant Cloud out of scope) |  |

### Chain of thought (`ChainOfThoughtPrimitive`)

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| ChainOfThoughtPrimitive.Root, ChainOfThoughtPrimitive.RootPrimitive | yes (via scope) | ported (`[auiChainOfThoughtRoot]`, sets `data-collapsed`) | Task 9 |
| ChainOfThoughtPrimitive.AccordionTrigger, ChainOfThoughtPrimitive.AccordionTriggerPrimitive | yes | ported (`button[auiChainOfThoughtAccordionTrigger]`, `aria-expanded`) | Task 9 |
| ChainOfThoughtPrimitive.Parts, ChainOfThoughtPrimitive.PartsPrimitive | yes | ported (`aui-chain-of-thought-parts` with `ng-template auiPart` children) | Task 9 |

Reasoning has no upstream primitive: a `reasoning` part renders through `auiPartTemplate`
(`<ng-template auiPart="reasoning" let-part>`) like any other part type, in `aui-message-parts`
and in `aui-chain-of-thought-parts`. React's `components.ChainOfThought` is the
`<ng-template auiChainOfThought>` child of `aui-message-parts`: when present, each run of
consecutive `reasoning` and `tool-call` parts renders as one chain of thought.

### Selection toolbar and assistant modal

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| SelectionToolbarPrimitive.Root, SelectionToolbarPrimitive.SelectionToolbarPrimitiveRoot, SelectionToolbarPrimitive.Quote, SelectionToolbarPrimitive.SelectionToolbarPrimitiveQuote, getSelectionMessageId | no | ported (as `[auiSelectionToolbarRoot]`, `button[auiSelectionToolbarQuote]` and `getSelectionMessageId`; the `SelectionToolbarPrimitiveRoot`/`SelectionToolbarPrimitiveQuote` type exports are the directive classes `AuiSelectionToolbarRootDirective` and `AuiSelectionToolbarQuoteDirective`) | Task 10 |
| AssistantModalPrimitive.Root, AssistantModalPrimitive.Trigger, AssistantModalPrimitive.Anchor, AssistantModalPrimitive.Content | no | ported (as `[auiAssistantModalRoot]` (`open`, `openOnRunStart`), `button[auiAssistantModalTrigger]`, `[auiAssistantModalAnchor]`, `[auiAssistantModalContent]`; `dismissOnInteractOutside` (upstream's misspelled `dissmissOnInteractOutside`) defaults to false as upstream; Escape closes from anywhere) | Task 10 |
| DropdownMenuRenderTrigger, DropdownMenuRenderContent, DropdownMenuRenderItem, DropdownMenuRenderSeparator | no | n/a (replaced by the Task 10 `button[auiMenuTrigger]`, `[auiMenuContent]`, `[auiMenuItem]` and `[auiMenuSeparator]`) | Task 10 |

### Runtimes, external store and transport

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| useLocalRuntime, LocalRuntimeOptions, LocalRuntimeOptionsBase, ChatModelAdapter, ChatModelRunOptions, ChatModelRunResult, ChatModelRunUpdate | no | ported (as `createLocalRuntime` and `injectLocalRuntime`; options and adapter types re-exported) | |
| useExternalStoreRuntime, useExternalStoreSharedOptions, ExternalStoreAdapter, ExternalStoreMessageConverter, ExternalStoreSharedOptions, ExternalStoreThreadListAdapter, ExternalStoreThreadData, ExternalStoreBranchChange, pickExternalStoreSharedOptions, getExternalStoreMessages, bindExternalStoreMessage | no | ported (as `createExternalStoreRuntime` and `injectExternalStoreRuntime`; `useExternalStoreSharedOptions` is `pickExternalStoreSharedOptions`; contracts re-exported) | |
| useExternalMessageConverter, unstable_convertExternalMessages, unstable_createExternalMessageConversionCache, unstable_createMessageConverter, Unstable_ExternalMessageConversionCache | no | ported (as `createExternalMessageConverter`, running core's hook in a tap root so `joinStrategy` and `getMetadataKey` work; `unstable_convertExternalMessages` and `unstable_createExternalMessageConversionCache` re-exported, `unstable_createMessageConverter` re-implemented) | |
| useAssistantTransportRuntime, useAssistantTransportSendCommand, useAssistantTransportState, AssistantTransportConnectionMetadata, AssistantTransportCommand, AssistantTransportProtocol, SendCommandsRequestBody | no | ported (as `createAssistantTransportRuntime`, which returns an `AuiConfig` over an in-memory thread list with one transport runtime per thread, plus `injectAssistantTransportSendCommand` and `injectAssistantTransportState`; no Assistant Cloud) | |
| ThreadMessageLike, fromThreadMessageLike, generateId, ExportedMessageRepository, ExportedMessageRepositoryItem, MessageNotSentError, isMessageNotSentError, toolApprovalAcceptsText, AddToolResultOptions, RunConfig, RuntimeCapabilities, MessageRole | no | ported (core helpers and types re-exported) | |
| AssistantRuntime, ThreadRuntime, ThreadState, ThreadRuntimeState, CreateAppendMessage, CreateStartRunConfig, CreateResumeRunConfig, MessageRuntime, MessageState, MessageRuntimeState, MessagePartRuntime, MessagePartState, ComposerRuntime, ThreadComposerRuntime, EditComposerRuntime | no | ported (runtime type re-exports) | |
| AppendMessage, TextMessagePart, ReasoningMessagePart, PartProviderMetadata, SourceProviderMetadata, SourceMessagePart, ImageMessagePart, FileMessagePart, DataMessagePart, Unstable_AudioMessagePart, ToolCallMessagePart, MessagePartTiming, ToolCallTiming, ToolModelContentPart, MessageStatus, MessagePartStatus, MessagePartStreamStatus, ToolCallMessagePartStatus, MessageTiming, MessageModality, ThreadUserMessagePart, ThreadAssistantMessagePart, ThreadSystemMessage, ThreadAssistantMessage, ThreadUserMessage, ThreadMessage, QuoteInfo | no | ported (message and part type re-exports) | |
| RespondToToolApprovalOptions, ToolApprovalDisplay, ToolApprovalOption, ToolApprovalOptionKind, ToolApprovalAnswer, ToolApprovalQuestion, ToolApprovalQuestionOption, ToolApprovalResponse | no | ported (approval type re-exports) | |
| useMediaQuery | no | n/a (not exported from the React index; use `matchMedia` or the CDK `BreakpointObserver`) |  |

### Out of scope by agreement

| React export | Vue has it | Angular status | Task |
| --- | --- | --- | --- |
| createVoiceSession, OpenAIRealtimeVoiceAdapter, GeminiLiveVoiceAdapter, useVoiceState, useVoiceVolume, useVoiceControls, RealtimeVoiceAdapter, OpenAIRealtimeVoiceAdapterOptions, GeminiLiveVoiceAdapterOptions, VoiceSessionControls, VoiceSessionHelpers, VoiceSessionState | no | n/a (voice out of scope) |  |
| DevToolsHooks, DevToolsProviderApi | no | n/a (devtools out of scope) |  |
| CloudRendererHost, CloudRendererHostProps | no | n/a (Assistant Cloud out of scope) |  |
| Assistant | no | ported (type re-export; augment `@assistant-ui/core` as upstream documents) | |

### Entry points added in phase 2

The secondary entries have no upstream package at the same granularity; their planned exports are listed
here so the table covers them.

| Entry | Planned exports | Status |
| --- | --- | --- |
| `angular-assistant-ui/markdown` | `aui-markdown-text` (inputs `smooth`, `preprocess`, `components`, `componentsByLanguage`), `AuiCodeHeader`, `AUI_SYNTAX_HIGHLIGHTER`, `AuiSyntaxHighlighter`, `AuiMarkdownComponents`, vendored `createMarkdownSession`, `normalizeMathDelimiters`, `escapeCurrencyDollars` | ported |
| `angular-assistant-ui/shiki` | `provideShikiHighlighter` | ported (Angular-native DI redesign of upstream shiki-highlighter; limits: bundled grammars/themes only, no embedded-language guessing, code is not trimmed, github-light/dark themes; the kit needs `color-scheme: light dark` for dark mode, Task 16) |
| `angular-assistant-ui/mastra` | `MastraThreads`, `createMastraTransport`, `mastraThreadListAdapter`, `MASTRA_AUTH`, `MastraAuth`, `MastraChatTransport`, `mastraHistoryAdapter`, `mastraSendAutomaticallyWhen`, `MastraHttpError`, `clearMastraStoredIds` (and `createMockMastraServer` in the testing entry). `mastra/src/vendor/` is vendored from `@assistant-ui/ai-sdk@0.0.18`, so that peer is pinned exactly; re-vendor it (and re-check the NOTICE) before raising the pin | ported |
| `angular-assistant-ui/ui` (foundation) | `styles.css` tokens, `aui-icon`, `button[auiButton]`, `aui-tooltip-icon-button`, collapsible, dialog, dropdown menu | ported (the dropdown menu is built on the main entry's headless menu, `[auiMenuRoot]`/`[auiMenuTrigger]`/`[auiMenuContent]`/`[auiMenuItem]`, Ruling R10, and unmounts its content on close rather than hiding it; limits: Tailwind classes become `aui-*` CSS in `ui/styles.css`) |
| `angular-assistant-ui/ui` (tools and media) | `aui-tool-fallback` (approval card, ask-user form), `aui-tool-group`, `aui-reasoning`, `aui-composer-attachments-styled`, `aui-composer-add-attachment-styled`, `aui-message-attachments-styled` | ported (also `aui-tool-fallback-approval`, `aui-tool-fallback-ask-user`, `aui-attachment-tile` and `AuiToolFallbackToolUIComponent`, the `registerToolUI` adapter; reasoning renders each part through `aui-markdown-text` in its own part scope, as upstream Vue does; attachment tiles, their remove buttons and the add-attachment button use the styled `[auiTooltip]`; `aui-thread` renders all of these by default) |
| `angular-assistant-ui/ui` (thread) | `aui-thread`, `AUI_THREAD_COMPONENTS`, `AuiThreadComponents`, `aui-markdown-text-styled` (`AuiStyledMarkdownText`), `AuiStyledCodeHeader`, `[auiTooltip]` (`AuiTooltipDirective`); in the main entry `[auiComponentOutlet]` (`AuiComponentOutletDirective`, scope-safe dynamic rendering, no upstream counterpart) and `aui-tool-ui-outlet` (`AuiToolUIOutletComponent`, upstream's `part.toolUI ?? <ToolFallback />`) | ported (assistant parts group as upstream: a chain of thought holding `aui-reasoning` and the `ToolGroup` slot, a ghost `aui-tool-group` of `aui-tool-fallback`s, with registered tool UIs first; user messages show `aui-message-attachments-styled`, and the composer is a file drop zone with `aui-composer-attachments-styled` and `aui-composer-add-attachment-styled`; `AuiThreadComponents` adds `ToolGroup`, the only slot with an input, `group`; limits: voice/spoken messages, dictation and `Resume`/`RefreshRun` are not rendered, and there is no `ReasoningGroup` slot because `aui-reasoning` renders each reasoning run itself; Tailwind classes become `aui-*` CSS in `ui/styles.css`) |
| `angular-assistant-ui/ui` (thread list and extras) | `aui-thread-list`, `aui-thread-list-sidebar`, `aui-assistant-modal`, `aui-quote-composer`, `aui-selection-toolbar-styled`, `aui-follow-up-suggestions`, `aui-message-timing`, `aui-composer-trigger-popover-styled` | planned (Task 18) |
| `angular-assistant-ui/testing` | `createScriptedChatTransport` (no upstream counterpart); approval, ask-user, attachment and thread-list helpers | ported; extensions planned (Tasks 4-9, 14) |

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
