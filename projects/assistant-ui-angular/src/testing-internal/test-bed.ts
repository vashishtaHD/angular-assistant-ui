import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { TestBed, type TestModuleMetadata } from '@angular/core/testing';

/** True when running in the `zoneless` Vitest project. */
export function isZonelessTestRun(): boolean {
  return (globalThis as { __AUI_ZONELESS__?: boolean }).__AUI_ZONELESS__ === true;
}

/**
 * Configures TestBed for specs that run in both Vitest projects (`zone` and
 * `zoneless`). In the zoneless project it adds
 * `provideExperimentalZonelessChangeDetection()` (the Angular 18 name).
 */
export function configureTestBed(extra: TestModuleMetadata = {}): typeof TestBed {
  const providers = [
    ...(isZonelessTestRun() ? [provideExperimentalZonelessChangeDetection()] : []),
    ...(extra.providers ?? []),
  ];
  return TestBed.configureTestingModule({ ...extra, providers });
}
