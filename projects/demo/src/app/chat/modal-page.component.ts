import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuiProviderDirective } from 'angular-assistant-ui';
import { AuiAssistantModalComponent } from 'angular-assistant-ui/ui';
import { ChatToolsDirective } from './chat-app.component';
import { injectDemoAuiConfig } from './demo-aui-config';
import { ThemeToggleComponent } from './theme';
import { ToastsComponent } from './toast';

/** A content page with the floating assistant modal (`/modal`). */
@Component({
  selector: 'app-modal-page',
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiAssistantModalComponent,
    ChatToolsDirective,
    ThemeToggleComponent,
    ToastsComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full overflow-y-auto' },
  template: `<div [auiProvider]="config" appChatTools class="min-h-full">
      <header
        class="flex items-center gap-3 border-b px-6 py-3"
        style="border-color: var(--aui-border)"
      >
        <span class="text-sm font-semibold">Assistant modal</span>
        <a routerLink="/" class="text-sm underline underline-offset-2 opacity-70">Full chat app</a>
        <span class="flex-1"></span>
        <app-theme-toggle />
      </header>
      <main class="mx-auto max-w-2xl px-6 py-10">
        <h1 class="text-2xl font-semibold tracking-tight">Your page, with an assistant</h1>
        <p class="mt-3 leading-relaxed opacity-80">
          The launcher in the bottom corner opens the chat in a floating panel. It uses the same
          Mastra threads as the full app: switch threads from the panel's Threads button or start a
          new one.
        </p>
      </main>
      <aui-assistant-modal />
    </div>
    <app-toasts />`,
})
export class ModalPageComponent {
  /** The AUI config: Mastra threads, suggestions and feedback. */
  protected readonly config = injectDemoAuiConfig();
}
