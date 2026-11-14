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
| MessagePrimitiveParts                   | ported  |
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
| AuiConfig                               | ported  |
| Derived                                 | ported  |
| createAssistantClient                   | ported  |
| AssistantClient (type)                  | ported  |
| AssistantClientHandle (type)            | ported  |
| AssistantClientSource (type)            | ported  |
| AssistantConfigSource (type)            | ported  |
| AssistantState (type)                   | ported  |
| AssistantEventCallback (type)           | ported  |
| AssistantEventName (type)               | ported  |
| AssistantEventSelector (type)           | ported  |
| Unsubscribe (type)                      | ported  |
| DataUIProps (type)                      | ported  |
| ToolUIProps (type)                      | ported  |

`AuiConfig`, `Derived`, `createAssistantClient` and the store types are re-exports
of `@assistant-ui/store/client`, as upstream's Vue binding does. The
`testing` secondary entry point (`createScriptedChatTransport`) has no upstream
counterpart.

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
