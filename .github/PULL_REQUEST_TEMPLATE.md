## What and why

<!-- What this changes, and the issue it fixes, if any. -->

## Checklist

- [ ] Tests added or updated, and `npm run test:lib` passes in both the `zone` and `zoneless` projects
      (plus `npm run test:demo` and the Mastra tests when they are touched)
- [ ] `npm run lint` and `npm run format:check` pass
- [ ] New `.ts` files start with a provenance header (`npm run check:headers`)
- [ ] Ported or changed upstream exports have their row in `docs/porting.md` updated
      (`npm run check:parity`)
- [ ] Library code uses only Angular 18.2 APIs
- [ ] Docs updated (READMEs, `docs/`), and the README samples still type-check
      (`npm run build:lib && npm run check:readme-samples`)
- [ ] User-facing changes added under `Unreleased` in `CHANGELOG.md`
