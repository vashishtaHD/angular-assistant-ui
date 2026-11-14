// Ported from packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx (AssistantMessage) @ 7d74276
import { AuiThreadSlotComponent } from './slot.component';
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AuiIndicatorTemplateDirective,
  AuiMessageGroupedPartsComponent,
  AuiMessageRootDirective,
  AuiPartTemplateDirective,
  groupPartByType,
} from 'angular-assistant-ui';
import { AuiStyledMarkdownText } from '../markdown-text.component';
import { AuiThreadAssistantActionBarComponent } from './action-bars';
import { AuiThreadBranchPickerComponent } from './branch-picker.component';
import { AuiThreadReasoningTextComponent, AuiThreadToolCallComponent } from './default-parts';
import { AuiThreadMessageErrorComponent } from './message-error.component';
import { AuiThreadSettings } from './thread-settings';

/** Upstream's grouping: reasoning and tool calls form chains of thought. */
const MESSAGE_GROUP_BY = groupPartByType({
  reasoning: ['group-chainOfThought', 'group-reasoning'],
  'tool-call': ['group-chainOfThought', 'group-tool'],
  'standalone-tool-call': [],
});

/**
 * An assistant message (the `AssistantMessage` slot): the optional avatar,
 * the parts (text through the `Text` slot, reasoning through `Reasoning`,
 * tool calls without a registered tool UI through `ToolFallback`), a working
 * indicator while it streams, the error banner, and a footer with the branch
 * picker and the action bar.
 * @internal Part of `aui-thread`.
 */
@Component({
  selector: 'aui-thread-assistant-message',
  standalone: true,
  imports: [
    AuiThreadSlotComponent,
    AuiMessageRootDirective,
    AuiMessageGroupedPartsComponent,
    AuiPartTemplateDirective,
    AuiIndicatorTemplateDirective,
    AuiThreadMessageErrorComponent,
    AuiThreadBranchPickerComponent,
    AuiThreadAssistantActionBarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents' },
  template: `<div
    auiMessageRoot
    class="aui-assistant-message-root"
    data-slot="aui_assistant-message-root"
  >
    @if (avatar(); as avatar) {
      <div class="aui-avatar" aria-hidden="true">
        @if (avatar.src && !imageFailed()) {
          <img [src]="avatar.src" [alt]="avatar.alt ?? ''" (error)="imageFailed.set(true)" />
        } @else {
          <span class="aui-avatar-fallback">{{ avatar.fallback }}</span>
        }
      </div>
    }
    <div class="aui-assistant-message-body">
      <div class="aui-assistant-message-content" data-slot="aui_assistant-message-content">
        <aui-message-grouped-parts [groupBy]="groupBy">
          <ng-template auiPart="text">
            <aui-thread-slot [component]="slots().Text" />
          </ng-template>
          <ng-template auiPart="reasoning">
            <aui-thread-slot [component]="slots().Reasoning" />
          </ng-template>
          <ng-template auiPart="tool-call">
            <aui-thread-slot [component]="slots().ToolFallback" />
          </ng-template>
          <ng-template auiIndicator>
            <span
              class="aui-assistant-message-indicator"
              data-slot="aui_assistant-message-indicator"
              role="status"
              aria-label="Assistant is working"
              >●</span
            >
          </ng-template>
        </aui-message-grouped-parts>
        <aui-thread-message-error />
      </div>
      <div class="aui-assistant-message-footer" data-slot="aui_assistant-message-footer">
        <aui-thread-branch-picker />
        <aui-thread-assistant-action-bar />
      </div>
    </div>
  </div>`,
})
export class AuiThreadAssistantMessageComponent {
  private readonly settings = inject(AuiThreadSettings, { optional: true });
  /** @internal */
  protected readonly groupBy = MESSAGE_GROUP_BY;
  /** @internal */
  protected readonly avatar = computed(() => this.settings?.assistantAvatar());
  /** @internal */
  protected readonly imageFailed = signal(false);
  /** @internal The part slots, with the defaults when used outside `aui-thread`. */
  protected readonly slots = computed(() => {
    const components = this.settings?.components();
    return {
      Text: components?.Text ?? AuiStyledMarkdownText,
      Reasoning: components?.Reasoning ?? AuiThreadReasoningTextComponent,
      ToolFallback: components?.ToolFallback ?? AuiThreadToolCallComponent,
    };
  });
}
