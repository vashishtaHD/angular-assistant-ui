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
