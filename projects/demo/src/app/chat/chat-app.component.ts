import { ChangeDetectionStrategy, Component, Directive, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuiProviderDirective, injectAuiState, registerToolUI } from 'angular-assistant-ui';
import { AuiThreadComponent, AuiThreadListSidebarComponent } from 'angular-assistant-ui/ui';
import { injectDemoAuiConfig } from './demo-aui-config';
import { ThemeToggleComponent } from './theme';
import { ToastsComponent } from './toast';
import { WeatherCardComponent } from './weather-card.component';

/**
 * Registers the demo's custom tool UIs with the enclosing provider's `tools` scope. Every other
 * tool (the `bookMeeting` approval, `askUser`) renders through the kit's tool fallback.
 * Must sit under `[auiProvider]`.
 */
@Directive({ selector: '[appChatTools]', standalone: true })
export class ChatToolsDirective {
  constructor() {
    registerToolUI('getWeather', WeatherCardComponent);
  }
}

/** The current thread's title in the header. */
@Component({
  selector: 'app-thread-title',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'min-w-0 truncate text-sm font-medium' },
  template: `{{ title() || 'New Chat' }}`,
})
export class ThreadTitleComponent {
  protected readonly title = injectAuiState((s) => s.optional.threadListItem?.title);
}

/**
 * The full chat app: the Mastra agent's threads in a collapsible sidebar beside the styled
 * thread (markdown with Shiki code blocks, attachments, tool groups, approvals, ask-user,
 * feedback, follow-ups and timing), a dark-mode toggle and toasts.
 */
@Component({
  selector: 'app-chat-app',
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadListSidebarComponent,
    AuiThreadComponent,
    ChatToolsDirective,
    ThreadTitleComponent,
    ThemeToggleComponent,
    ToastsComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
  template: `<div [auiProvider]="config" appChatTools class="h-full">
      <aui-thread-list-sidebar [(collapsed)]="collapsed" class="h-full">
        <div auiSidebarHeader class="flex items-center gap-2 px-2 py-1">
          <span class="size-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
          <span class="text-sm font-semibold tracking-tight">Mastra chat</span>
        </div>
        <div auiSidebarFooter class="px-2 py-1 text-xs opacity-70">
          <a routerLink="/modal" class="underline underline-offset-2">Assistant modal demo</a>
        </div>
        <div class="flex h-full min-h-0 flex-col">
          <header
            class="flex items-center gap-2 border-b px-4 py-2"
            style="border-color: var(--aui-border)"
          >
            <app-thread-title class="flex-1" />
            <app-theme-toggle />
          </header>
          <aui-thread
            class="min-h-0 flex-1"
            [welcome]="{ message: 'How can I help you today?' }"
            composerPlaceholder="Send a message..."
          />
        </div>
      </aui-thread-list-sidebar>
    </div>
    <app-toasts />`,
})
export class ChatAppComponent {
  /** The AUI config: Mastra threads, suggestions and feedback. */
  protected readonly config = injectDemoAuiConfig();
  /** Whether the wide-screen sidebar is collapsed. */
  protected readonly collapsed = signal(false);
}
