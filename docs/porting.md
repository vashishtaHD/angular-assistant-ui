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

Status is one of `ported`, `planned`, `n/a`.

| Upstream export                         | Status  |
| --------------------------------------- | ------- |
| AuiProvider                             | ported  |
| AuiIf                                   | ported  |
| useAui                                  | ported  |
| useAuiState                             | ported  |
| useAuiEvent                             | ported  |
| useScrollLock                           | planned |
| MessageByIdProvider                     | n/a (internal: aui-scope-outlet + messageScopeConfig) |
| PartByIndexProvider                     | n/a (internal: aui-scope-outlet + partScopeConfig) |
| ThreadPrimitiveMessages                 | ported  |
| ThreadPrimitiveViewport                 | ported  |
| ThreadPrimitiveViewportFooter           | planned |
| ThreadPrimitiveScrollToBottom           | planned |
| MessagePrimitiveParts                   | planned |
| ChainOfThoughtPrimitiveParts            | planned |
| ChainOfThoughtPrimitiveAccordionTrigger | planned |
| ComposerPrimitiveInput                  | ported  |
| ComposerPrimitiveSend                   | ported  |
| ComposerPrimitiveCancel                 | ported  |
| BranchPickerPrimitivePrevious           | planned |
| BranchPickerPrimitiveNext               | planned |
| BranchPickerPrimitiveNumber             | planned |
| BranchPickerPrimitiveCount              | planned |
| ActionBarPrimitiveEdit                  | planned |
| ActionBarPrimitiveReload                | planned |
| ActionBarPrimitiveCopy                  | planned |
| SuggestionByIndexProvider               | planned |
| ThreadPrimitiveSuggestions              | planned |
| SuggestionPrimitiveTrigger              | planned |
| SuggestionPrimitiveTitle                | planned |
| SuggestionPrimitiveDescription          | planned |
| ThreadListItemByIndexProvider           | planned |
| ThreadListPrimitiveItems                | planned |
| ThreadListPrimitiveNew                  | planned |
| ThreadListItemPrimitiveTitle            | planned |
| ThreadListItemPrimitiveTrigger          | planned |
| ThreadListPrimitiveRoot                 | planned |
| ThreadListItemPrimitiveRoot             | planned |
| AttachmentByIndexProvider               | planned |
| AttachmentPrimitiveRoot                 | planned |
| AttachmentPrimitiveName                 | planned |
| AttachmentPrimitiveThumb                | planned |
| AttachmentPrimitiveRemove               | planned |
| ComposerPrimitiveAttachments            | planned |
| ComposerPrimitiveAddAttachment          | planned |
| ComposerPrimitiveAttachmentDropzone     | planned |
| MessagePrimitiveAttachments             | planned |
| ErrorPrimitiveRoot                      | planned |
| ErrorPrimitiveMessage                   | planned |
| ThreadPrimitiveRoot                     | ported  |
| MessagePrimitiveRoot                    | ported  |
| ThreadListPrimitiveLoadMore             | planned |
| ThreadListItemPrimitiveArchive          | planned |
| ThreadListItemPrimitiveUnarchive        | planned |
| ThreadListItemPrimitiveDelete           | planned |
| AuiConfig                               | planned |
| Derived                                 | planned |
| createAssistantClient                   | planned |
| AssistantClient (type)                  | planned |
| AssistantClientHandle (type)            | planned |
| AssistantClientSource (type)            | planned |
| AssistantConfigSource (type)            | planned |
| AssistantState (type)                   | planned |
| AssistantEventCallback (type)           | planned |
| AssistantEventName (type)               | planned |
| AssistantEventSelector (type)           | planned |
| Unsubscribe (type)                      | planned |
| DataUIProps (type)                      | planned |
| ToolUIProps (type)                      | planned |
