// Original angular-assistant-ui demo code (no upstream counterpart; no code copied).
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { renderStartupError } from './app/runtime-config';

// A rejected bootstrap (for example an invalid /config.json) shows its reasons in the page.
bootstrapApplication(AppComponent, appConfig).catch((err) => renderStartupError(err));
