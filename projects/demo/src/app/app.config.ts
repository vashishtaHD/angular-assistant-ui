// Original angular-assistant-ui demo code (no upstream counterpart; no code copied).
import { type ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideRuntimeConfig } from './runtime-config';

/** The demo's application providers: the runtime config loader and the router. */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRuntimeConfig(),
    provideRouter(routes),
  ],
};
