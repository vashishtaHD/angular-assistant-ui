// Original (no upstream counterpart): tests for scripts/release-notes.mjs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { changelogSection } from './release-notes.mjs';

const changelog = `# Changelog

## [Unreleased]

## [0.2.0-beta.1] - 2027-01-01

### Fixed

- A beta fix.

## [0.1.0] - 2026-11-15

### Added

- The first release.

[Unreleased]: https://example.org/compare/v0.1.0...HEAD
[0.1.0]: https://example.org/releases/tag/v0.1.0
`;

test('returns the section of a version, without link definitions', () => {
  assert.equal(changelogSection(changelog, '0.1.0'), '### Added\n\n- The first release.');
});

test('matches prerelease versions exactly', () => {
  assert.equal(changelogSection(changelog, '0.2.0-beta.1'), '### Fixed\n\n- A beta fix.');
  assert.equal(changelogSection(changelog, '0.2.0'), undefined);
});

test('an empty or missing section is undefined', () => {
  assert.equal(changelogSection(changelog, 'Unreleased'), undefined);
  assert.equal(changelogSection(changelog, '9.9.9'), undefined);
});

test('CHANGELOG.md has a section for the library version', () => {
  const { version } = JSON.parse(
    readFileSync(new URL('../projects/assistant-ui-angular/package.json', import.meta.url), 'utf8'),
  );
  const section = changelogSection(
    readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'),
    version,
  );
  assert.ok(section, `CHANGELOG.md has no section for ${version}`);
});
