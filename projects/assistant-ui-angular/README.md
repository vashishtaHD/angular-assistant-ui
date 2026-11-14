# angular-assistant-ui

Headless Angular bindings for [assistant-ui](https://github.com/assistant-ui/assistant-ui),
built over `@assistant-ui/core`, `@assistant-ui/store` and `@assistant-ui/tap`.

## Build

Run `npm run build:lib` from the workspace root. The build artifacts are written to
`dist/assistant-ui-angular`.

## Running unit tests

Run `npm run test:lib` from the workspace root (`npm run test:lib:watch` for watch mode).
The specs run with [Vitest](https://vitest.dev) in two projects: `zone` (Zone.js change
detection) and `zoneless` (`provideExperimentalZonelessChangeDetection()`).
