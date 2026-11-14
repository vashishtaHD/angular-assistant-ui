import { type ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRuntimeConfig } from './runtime-config';

export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true }), provideRuntimeConfig()],
};
