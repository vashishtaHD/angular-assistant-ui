// Original angular-assistant-ui demo code (no upstream counterpart; no code copied).
import type { Routes } from '@angular/router';

/**
 * `/` is the full chat app and `/modal` a page with the floating assistant modal. Both load
 * lazily (with the chat providers), so the initial bundle is only the shell and the runtime
 * config loader.
 */
export const routes: Routes = [
  { path: '', loadChildren: () => import('./chat/chat.routes').then((m) => m.CHAT_ROUTES) },
  { path: '**', redirectTo: '' },
];
