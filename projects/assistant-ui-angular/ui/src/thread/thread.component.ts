// Ported from packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx (Thread, ThreadRoot, ThreadMessage)
// and packages/ui/src/components/vue/assistant-ui/thread.vue @ 7d74276
import { AuiThreadSlotComponent } from './slot.component';
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  AuiEditComposerDirective,
  AuiIfDirective,
  AuiMessageTemplateDirective,
  AuiThreadMessagesComponent,
  AuiThreadRootDirective,
  AuiThreadViewportDirective,
  AuiThreadViewportFooterDirective,
  injectAuiState,
  type AssistantState,
} from 'angular-assistant-ui';
import { AuiStyledMarkdownText } from '../markdown-text.component';
import { AUI_THREAD_COMPONENTS, type AuiThreadComponents } from '../thread-components.token';
import { AuiThreadAssistantMessageComponent } from './assistant-message.component';
import { AuiThreadComposerComponent } from './composer.component';
import { AuiThreadReasoningTextComponent, AuiThreadToolCallComponent } from './default-parts';
import { AuiThreadEditComposerComponent } from './edit-composer.component';
import { AuiThreadHistorySkeletonComponent } from './history-skeleton.component';
import { AuiThreadLoadEarlierComponent } from './load-earlier.component';
import { AuiThreadScrollToBottomComponent } from './scroll-to-bottom.component';
import {
  AuiThreadSettings,
  isHistoryLoadingView,
  isNewChatView,
  type AuiThreadAvatar,
  type AuiThreadWelcomeConfig,
} from './thread-settings';
import { AuiThreadUserMessageComponent } from './user-message.component';
import {
  AuiThreadWelcomeComponent,
  AuiThreadWelcomeSuggestionsComponent,
} from './welcome.component';

export type {
  AuiThreadAvatar,
  AuiThreadWelcomeConfig,
  AuiThreadWelcomeSuggestion,
} from './thread-settings';

const DEFAULT_COMPONENTS: AuiThreadComponents = {
  UserMessage: AuiThreadUserMessageComponent,
  AssistantMessage: AuiThreadAssistantMessageComponent,
  EditComposer: AuiThreadEditComposerComponent,
  Composer: AuiThreadComposerComponent,
  Welcome: AuiThreadWelcomeComponent,
  ToolFallback: AuiThreadToolCallComponent,
  Text: AuiStyledMarkdownText,
  Reasoning: AuiThreadReasoningTextComponent,
};

/**
 * One message row of `aui-thread`: the `EditComposer` slot while the message
 * is being edited, otherwise the `UserMessage` or `AssistantMessage` slot.
 * @internal Part of `aui-thread`.
 */
@Component({
  selector: 'aui-thread-message',
  standalone: true,
  imports: [AuiThreadSlotComponent, AuiEditComposerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `<ng-template auiEditComposer>
      <aui-thread-slot [component]="components().EditComposer" />
    </ng-template>
    @if (!isEditing()) {
      @if (role() === 'user') {
        <aui-thread-slot [component]="components().UserMessage" />
      } @else {
        <aui-thread-slot [component]="components().AssistantMessage" />
      }
    }`,
})
export class AuiThreadMessageComponent {
  /** @internal */
  protected readonly components = inject(AuiThreadSettings).components;
  /** @internal */
  protected readonly role = injectAuiState((s) => s.message.role);
  /** @internal */
  protected readonly isEditing = injectAuiState((s) => s.message.composer.isEditing);
}

/**
 * The styled chat thread: welcome and suggestions while empty, a history
 * skeleton while a thread loads, Load earlier, the messages (user bubbles
 * with an edit action, assistant messages with markdown, an error banner,
 * a branch picker and copy/refresh/feedback/more actions, and an edit
 * composer in place of a message being edited), a scroll-to-bottom button
 * and the composer docked at the bottom.
 *
 * Use it inside `[auiProvider]` and give it a height (it fills its parent).
 * Import `angular-assistant-ui/ui/styles.css` once. Replace sections through
 * {@link AUI_THREAD_COMPONENTS}.
 *
 * @example
 * ```html
 * <div [auiProvider]="config" style="height: 100dvh">
 *   <aui-thread
 *     [welcome]="{ message: 'Ask me anything', suggestions: [{ prompt: 'What can you do?' }] }"
 *     composerPlaceholder="Ask a question..."
 *   />
 * </div>
 * ```
 */
@Component({
  selector: 'aui-thread',
  standalone: true,
  imports: [
    AuiThreadSlotComponent,
    AuiIfDirective,
    AuiThreadRootDirective,
    AuiThreadViewportDirective,
    AuiThreadViewportFooterDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiThreadMessageComponent,
    AuiThreadHistorySkeletonComponent,
    AuiThreadLoadEarlierComponent,
    AuiThreadScrollToBottomComponent,
    AuiThreadWelcomeSuggestionsComponent,
  ],
  providers: [AuiThreadSettings],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-thread' },
  template: `<div auiThreadRoot class="aui-root aui-thread-root">
    <div
      auiThreadViewport
      turnAnchor="top"
      class="aui-thread-viewport"
      data-slot="aui_thread-viewport"
    >
      <div class="aui-thread-viewport-inner" [attr.data-empty]="isEmpty() ? '' : null">
        <ng-container *auiIf="newChat">
          <aui-thread-slot [component]="components().Welcome" />
        </ng-container>
        <aui-thread-history-skeleton *auiIf="historyLoading" />
        <aui-thread-load-earlier />
        <div class="aui-thread-message-group" data-slot="aui_message-group">
          <aui-thread-messages>
            <ng-template auiMessage><aui-thread-message /></ng-template>
          </aui-thread-messages>
        </div>
        <div
          auiThreadViewportFooter
          class="aui-thread-viewport-footer"
          [attr.data-empty]="isEmpty() ? '' : null"
        >
          <aui-thread-scroll-to-bottom />
          <aui-thread-slot [component]="components().Composer" />
          <aui-thread-welcome-suggestions *auiIf="showSuggestions" />
        </div>
      </div>
    </div>
  </div>`,
})
export class AuiThreadComponent {
  /** The welcome heading and suggestions shown while the thread is empty. */
  readonly welcome = input<AuiThreadWelcomeConfig | undefined>(undefined);
  /** An avatar shown beside assistant messages. None by default. */
  readonly assistantAvatar = input<AuiThreadAvatar | undefined>(undefined);
  /** The placeholder of the composer input. */
  readonly composerPlaceholder = input<string>('Send a message...');

  private readonly settings = inject(AuiThreadSettings, { self: true });
  /** @internal The resolved section components. */
  protected readonly components = signal<AuiThreadComponents>(resolveComponents()).asReadonly();
  /** @internal */
  protected readonly isEmpty = injectAuiState(isNewChatView);
  /** @internal */
  protected readonly newChat = isNewChatView;
  /** @internal */
  protected readonly historyLoading = isHistoryLoadingView;
  /** @internal */
  protected readonly showSuggestions = (s: AssistantState): boolean =>
    isNewChatView(s) && s.composer.isEmpty;

  constructor() {
    this.settings.components = this.components;
    this.settings.welcome = this.welcome;
    this.settings.assistantAvatar = this.assistantAvatar;
    this.settings.composerPlaceholder = this.composerPlaceholder;
  }
}

/** The defaults with the `AUI_THREAD_COMPONENTS` overrides that are set. */
function resolveComponents(): AuiThreadComponents {
  const overrides = inject(AUI_THREAD_COMPONENTS, { optional: true }) ?? {};
  const resolved: AuiThreadComponents = { ...DEFAULT_COMPONENTS };
  for (const key of Object.keys(overrides) as (keyof AuiThreadComponents)[]) {
    const component = overrides[key];
    if (component) resolved[key] = component;
  }
  return resolved;
}
