import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { TestBed, type TestModuleMetadata } from '@angular/core/testing';

/** True when running in the `zoneless` Vitest project. */
export function isZonelessTestRun(): boolean {
  return (globalThis as { __AUI_ZONELESS__?: boolean }).__AUI_ZONELESS__ === true;
}

/** True when Zone.js is loaded in the current test environment. */
export function isZoneLoaded(): boolean {
  return typeof (globalThis as { Zone?: unknown }).Zone !== 'undefined';
}

/**
 * Throws when the Vitest project does not match the environment: the `zone`
 * project must have Zone.js loaded and the `zoneless` project must not.
 */
export function assertTestProjectMatchesEnvironment(): void {
  const zoneless = isZonelessTestRun();
  const zoneLoaded = isZoneLoaded();
  if (zoneless === zoneLoaded) {
    throw new Error(
      zoneless
        ? 'zoneless test project has Zone.js loaded'
        : 'zone test project does not have Zone.js loaded',
    );
  }
}

/**
 * Configures TestBed for specs that run in both Vitest projects (`zone` and
 * `zoneless`). In the zoneless project it adds
 * `provideExperimentalZonelessChangeDetection()` (the Angular 18 name).
 */
export function configureTestBed(extra: TestModuleMetadata = {}): typeof TestBed {
  assertTestProjectMatchesEnvironment();
  const providers = [
    ...(isZonelessTestRun() ? [provideExperimentalZonelessChangeDetection()] : []),
    ...(extra.providers ?? []),
  ];
  return TestBed.configureTestingModule({ ...extra, providers });
}
