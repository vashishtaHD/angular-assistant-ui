# Changelog

All notable changes to `angular-assistant-ui` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Before 1.0.0, a minor version
may contain breaking changes.

## [Unreleased]

## [0.1.0] - 2026-11-15

The first release: an Angular port of [assistant-ui](https://github.com/assistant-ui/assistant-ui)
over `@assistant-ui/core`, `@assistant-ui/store` and `@assistant-ui/tap`.

### Added

- **`angular-assistant-ui`**: the headless primitives as directives and components, ported from
  upstream's Vue binding and React primitives (thread, viewport and scroll, messages and parts,
  composer and queue, action bar, branch picker, edit composer, attachments, suggestions, thread list,
  chain of thought, error, menus, selection toolbar and assistant modal), plus `[auiProvider]`,
  `injectAui`, `injectAuiState`, `injectAuiEvent`, `*auiIf`, `registerToolUI`, `[auiComponentOutlet]`
  and the re-exported store API. Runtimes: `createLocalRuntime`, `createExternalStoreRuntime`,
  `createAssistantTransportRuntime`, and the AI SDK runtimes (`AISDKChat`, `AISDKThreads`) from
  `@assistant-ui/ai-sdk`. The parity table is in
  [docs/porting.md](https://github.com/vashishtaHD/angular-assistant-ui/blob/main/docs/porting.md).
- **`angular-assistant-ui/ui`**: a styled kit with `ui/styles.css` (CSS tokens, dark mode): `aui-thread`,
  `aui-thread-list`, `aui-thread-list-sidebar`, `aui-assistant-modal`, the tool fallback with approval
  and ask-user forms, tool and reasoning groups, attachments, follow-up suggestions and replaceable
  thread sections through `AUI_THREAD_COMPONENTS`.
- **`angular-assistant-ui/markdown`**: streaming markdown (`aui-markdown-text`) on `markdown-it`.
- **`angular-assistant-ui/shiki`**: `provideShikiHighlighter()` for code blocks.
- **`angular-assistant-ui/mastra`**: `MastraThreads`, `createMastraTransport`,
  `mastraThreadListAdapter`, `mastraHistoryAdapter` and `MASTRA_AUTH`, for persistent threads and
  history on a Mastra server, with a reference server (`mastra-server/`) in the repository.
- **`angular-assistant-ui/testing`**: `createScriptedChatTransport` and turn builders for text,
  approval, tool output and ask-user turns, a scripted attachment adapter, a scripted thread-list
  adapter and `createMockMastraServer`.
- **`angular-assistant-ui/react-interop`**: the `Tools`, `Interactables` and `unstable_Interactables`
  scope resources that core ships only in its React barrel.
- Support for Angular 18.2 to 22, with Zone.js or zoneless change detection, verified by consumer apps
  on Angular 18.2 and 20 (Zone.js) and 22 (zoneless).

[Unreleased]: https://github.com/vashishtaHD/angular-assistant-ui/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/vashishtaHD/angular-assistant-ui/releases/tag/v0.1.0
