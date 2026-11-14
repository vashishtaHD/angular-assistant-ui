import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

// Marks this Vitest project as zoneless; read by `configureTestBed()`.
(globalThis as { __AUI_ZONELESS__?: boolean }).__AUI_ZONELESS__ = true;

getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
