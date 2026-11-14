// Ported from packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx
// (ThreadWelcome, ThreadSuggestions, ThreadSuggestionItem) @ 7d74276
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
} from '@angular/core';
import {
  AuiSuggestionDescriptionComponent,
  AuiSuggestionTemplateDirective,
  AuiSuggestionTitleComponent,
  AuiSuggestionTriggerDirective,
  AuiThreadSuggestionsComponent,
} from 'angular-assistant-ui';
import { AuiThreadSettings, DEFAULT_WELCOME_MESSAGE } from './thread-settings';

/**
 * The welcome heading shown while the thread is empty (the `Welcome` slot).
 * Shows `welcome.message` of `aui-thread`, or `How can I help you today?`.
 * @internal Part of `aui-thread`.
 */
@Component({
  selector: 'aui-thread-welcome',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-thread-welcome-root' },
  template: `<p class="aui-thread-welcome-message">{{ message() }}</p>`,
})
export class AuiThreadWelcomeComponent {
  private readonly settings = inject(AuiThreadSettings, { optional: true });
  /** @internal */
  protected readonly message = computed(
    () => this.settings?.welcome()?.message ?? DEFAULT_WELCOME_MESSAGE,
  );
}

/**
 * The suggestion buttons under the composer of an empty thread: the
 * `welcome.suggestions` of `aui-thread`, or the thread's own suggestions.
 * Each sends its prompt.
 * @internal Part of `aui-thread`.
 */
@Component({
  selector: 'aui-thread-welcome-suggestions',
  standalone: true,
  imports: [
    AuiThreadSuggestionsComponent,
    AuiSuggestionTemplateDirective,
    AuiSuggestionTriggerDirective,
    AuiSuggestionTitleComponent,
    AuiSuggestionDescriptionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-thread-welcome-suggestions' },
  template: `@if (configured(); as list) {
      @for (item of list; track $index) {
        <div class="aui-thread-welcome-suggestion-display">
          <button
            type="button"
            auiSuggestionTrigger
            send
            [prompt]="item.prompt"
            class="aui-thread-welcome-suggestion"
          >
            <span aria-hidden="true" class="aui-thread-welcome-suggestion-marker">&gt;</span>
            <span class="aui-thread-welcome-suggestion-text">
              <span class="aui-thread-welcome-suggestion-text-1">{{
                item.title ?? item.prompt
              }}</span>
              @if (item.description) {
                {{ ' '
                }}<span class="aui-thread-welcome-suggestion-text-2">{{ item.description }}</span>
              }
            </span>
          </button>
        </div>
      }
    } @else {
      <aui-thread-suggestions>
        <ng-template auiSuggestion>
          <div class="aui-thread-welcome-suggestion-display">
            <button type="button" auiSuggestionTrigger send class="aui-thread-welcome-suggestion">
              <span aria-hidden="true" class="aui-thread-welcome-suggestion-marker">&gt;</span>
              <span class="aui-thread-welcome-suggestion-text">
                <aui-suggestion-title class="aui-thread-welcome-suggestion-text-1" />
                {{ ' ' }}
                <aui-suggestion-description class="aui-thread-welcome-suggestion-text-2" />
              </span>
            </button>
          </div>
        </ng-template>
      </aui-thread-suggestions>
    }`,
})
export class AuiThreadWelcomeSuggestionsComponent {
  private readonly settings = inject(AuiThreadSettings, { optional: true });
  /** @internal */
  protected readonly configured = computed(() => this.settings?.welcome()?.suggestions);
}
