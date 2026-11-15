import type { Routes } from '@angular/router';
import { ChatAppComponent } from './chat-app.component';
import { ModalPageComponent } from './modal-page.component';
import { provideDemo } from './provide-demo';

/** The chat pages, loaded lazily with their providers. */
export const CHAT_ROUTES: Routes = [
  {
    path: '',
    providers: [provideDemo()],
    children: [
      { path: '', pathMatch: 'full', title: 'Mastra chat', component: ChatAppComponent },
      { path: 'modal', title: 'Assistant modal', component: ModalPageComponent },
    ],
  },
];
