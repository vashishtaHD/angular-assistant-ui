// Original angular-assistant-ui demo code (no upstream counterpart; no code copied).
// The demo is a Zone.js app; its specs run with Zone.js loaded.
import './test-setup.web-streams';
import '@analogjs/vitest-angular/setup-zone';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
