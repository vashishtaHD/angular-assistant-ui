# Contributing

Thanks for helping with `angular-assistant-ui`. Bug reports, fixes, ported primitives and docs are all
welcome. Please follow the [code of conduct](CODE_OF_CONDUCT.md), and report security issues as
[SECURITY.md](SECURITY.md) describes, not in a public issue.

## Setup

- Node `>=22.13` (`.nvmrc` says 22; Mastra 1.x needs `>=22.13`). The Angular 22 compat app also needs
  Node `^22.22.3`, `^24.15.0` or `>=26`.
- Install from the lockfile:

  ```bash
  npm ci
  ```

The repository is an npm workspace: the library in `projects/assistant-ui-angular`, the demo in
`projects/demo` and the reference Mastra server in `mastra-server`. The consumer apps in `compat/` have
their own lockfiles and are installed by `npm run compat`.

## Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Builds the library, then runs the Mastra server (`:4111`) and the demo (`:4200`) |
| `npm test` | `test:lib`, `test:demo` and the Mastra server tests |
| `npm run test:lib` | Library specs, in the `zone` and `zoneless` Vitest projects |
| `npm run test:demo` | Demo specs |
| `npm run test:scripts` | Tests of the repository scripts in `scripts/` |
| `npm run lint` | ESLint (`ng lint`) |
| `npm run format` / `npm run format:check` | Prettier |
| `npm run typecheck:lib-spec` | Type-checks the library specs |
| `npm run typecheck:mastra` | Type-checks the Mastra server |
| `npm run build:lib` | Builds the library and every secondary entry to `dist/assistant-ui-angular` |
| `npm run build:demo` | Builds the demo |
| `npm run check:ui-styles` | The built `ui/styles.css` exists and has the kit tokens (after `build:lib`) |
| `npm run check:react-compat` | No bundle imports a React-19-only API from `react` (after `build:lib`) |
| `npm run check:package` | The packed tarball has every entry, `README.md`, `LICENSE`, `NOTICE` and `ui/styles.css`, no stray files, and a publishable `package.json` (after `build:lib`) |
| `npm run check:readme-samples` | Type-checks the TypeScript samples of both READMEs against the build (after `build:lib`) |
| `npm run check:parity` | Every row of the parity table in `docs/porting.md` is `ported` or `n/a (reason)` |
| `npm run check:headers` | Every non-spec `.ts` source starts with a provenance header (see below) |
| `npm run compat -- <ng18\|ng20\|ng22>` | The compatibility matrix for one Angular major (see below) |

CI (`.github/workflows/ci.yml`) runs all of these on every push and pull request.

## Tests in both change-detection modes

The library supports Zone.js and zoneless apps, so every library spec runs twice. `npm run test:lib`
runs both Vitest projects: `zone` (Zone.js) and `zoneless`
(`provideExperimentalZonelessChangeDetection()`). To run one of them, or one file:

```bash
npx vitest run --root projects/assistant-ui-angular --project zone
npx vitest run --root projects/assistant-ui-angular --project zoneless src/lib/aui-if.directive.spec.ts
```

A change is done when both projects pass with no warnings in the output. Under zoneless, code that
creates or destroys views from a callback must call `markForCheck()`.

## Compatibility matrix

`npm run compat -- ng18` (or `ng20`, `ng22`) packs the library as it would be published, installs the
tarball into a fresh consumer app (Angular 18.2 and 20 with Zone.js, 22 zoneless), builds it and runs
the Playwright smoke test in `compat/smoke.spec.ts`. Install Chromium for Playwright once with
`npx playwright install chromium` in `compat/`. The three apps share `src/app/app.ts` and differ only
in their bootstrap. CI runs all three.

## Angular 18.2 API floor

The library supports Angular 18.2 to 22, so library code may use only APIs that Angular 18.2 has: no
`effect()`, `linkedSignal`, `resource` or `afterRender`. State flows as store subscription, then
signal, then `computed`. Components are standalone and `OnPush`, use `inject()` and `host: {}`
metadata, and use the `aui` selector prefix. The demo and the compat apps may use newer APIs.

## Porting a primitive

New primitives are ported from upstream assistant-ui (the Vue binding first). Follow the checklist in
[docs/porting.md](docs/porting.md#porting-the-next-primitive), and flip the primitive's row in the
parity table to `ported`. `npm run check:parity` fails while any row is `planned`.

## Provenance headers

Every non-spec `.ts` file under `projects/assistant-ui-angular`, `projects/demo/src` and
`mastra-server/src` starts with a one-line header that names where it came from:

```ts
// Ported from packages/vue/src/<path> @ <sha>
// Original (no upstream counterpart): <what it is>
```

`scripts/check-headers.mjs` lists the accepted forms (`Ported from`, `Original`, `Derived from`,
`Vendored from`, and a few more). Run `npm run check:headers` before you commit.

## Commits and pull requests

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/), as the history
  does: `feat(thread-list): ...`, `fix(mastra-server): ...`, `docs: ...`, `test(compat): ...`,
  `chore: ...`.
- Keep a pull request to one change. Fill in the pull request template: tests in both modes, lint and
  format, headers, the parity row, docs and the changelog.
- Add user-facing changes to the `Unreleased` section of [CHANGELOG.md](CHANGELOG.md).

## Releases

Maintainers release from `main`:

1. Set `version` in `projects/assistant-ui-angular/package.json` (and run `npm install
   --package-lock-only` so the lockfile matches).
2. Move the `Unreleased` entries of `CHANGELOG.md` into a `## [x.y.z] - YYYY-MM-DD` section.
3. Commit, then push a tag `vx.y.z` that matches the version.

The tag starts `.github/workflows/release.yml`. It runs the CI workflow, checks that the tag matches
the library version and that `CHANGELOG.md` has its section, builds the library, publishes
`dist/assistant-ui-angular` to npm with provenance, and creates a GitHub Release with the changelog
section as its notes. A prerelease tag such as `v0.2.0-beta.1` publishes under the npm dist-tag `next`
and is marked as a prerelease on GitHub.
