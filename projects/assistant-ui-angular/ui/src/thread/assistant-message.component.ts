// Ported from packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx (AssistantMessage) @ 7d74276
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AuiComponentOutletDirective,
  AuiGroupChildrenComponent,
  AuiGroupTemplateDirective,
  AuiIndicatorTemplateDirective,
  AuiMessageGroupedPartsComponent,
  AuiMessageRootDirective,
  AuiPartTemplateDirective,
  AuiToolUIOutletComponent,
  groupPartByType,
} from 'angular-assistant-ui';
import { AuiStyledMarkdownText } from '../markdown-text.component';
import { AuiToolFallbackComponent } from '../tool-fallback/tool-fallback.component';
import { AuiThreadAssistantActionBarComponent } from './action-bars';
import { AuiThreadBranchPickerComponent } from './branch-picker.component';
import {
  AuiThreadReasoningGroupComponent,
  AuiThreadReasoningPartComponent,
} from './default-reasoning.component';
import { AuiThreadToolGroupComponent } from './default-tool-group.component';
import { AuiThreadMessageErrorComponent } from './message-error.component';
import { AuiThreadSlotComponent } from './slot.component';
import { AuiThreadSettings } from './thread-settings';

/** Upstream's grouping: reasoning and tool calls form chains of thought. */
const MESSAGE_GROUP_BY = groupPartByType({
  reasoning: ['group-chainOfThought', 'group-reasoning'],
  'tool-call': ['group-chainOfThought', 'group-tool'],
  'standalone-tool-call': [],
});

/**
 * An assistant message (the `AssistantMessage` slot): the optional avatar,
 * the parts, a working indicator while it streams, the error banner, and a
 * footer with the branch picker and the action bar.
 *
 * The parts are grouped as upstream does: adjacent reasoning parts and tool
 * calls form a chain of thought (`data-slot="aui_chain-of-thought"`), in which
 * each run of tool calls renders through the `ToolGroup` slot and each run of
 * reasoning parts through the `ReasoningGroup` slot, with each reasoning part
 * inside it through `Reasoning`. Text renders through `Text`, and a tool call
 * through its registered tool UI, or `ToolFallback` without one.
 * @internal Part of `aui-thread`.
 */
@Component({
  selector: 'aui-thread-assistant-message',
  standalone: true,
  imports: [
    AuiThreadSlotComponent,
    AuiComponentOutletDirective,
    AuiMessageRootDirective,
    AuiMessageGroupedPartsComponent,
    AuiGroupTemplateDirective,
    AuiGroupChildrenComponent,
    AuiPartTemplateDirective,
    AuiIndicatorTemplateDirective,
    AuiToolUIOutletComponent,
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
          <ng-template auiGroup="group-chainOfThought" let-group>
            <div data-slot="aui_chain-of-thought"><aui-group-children [group]="group" /></div>
          </ng-template>
          <ng-template auiGroup="group-tool" let-group>
            <ng-container
              [auiComponentOutlet]="slots().ToolGroup"
              [auiComponentOutletInputs]="{ group: group }"
            />
          </ng-template>
          <ng-template auiGroup="group-reasoning" let-group>
            <ng-container
              [auiComponentOutlet]="slots().ReasoningGroup"
              [auiComponentOutletInputs]="{ group: group }"
            />
          </ng-template>
          <ng-template auiPart="text">
            <aui-thread-slot [component]="slots().Text" />
          </ng-template>
          <ng-template auiPart="reasoning">
            <aui-thread-slot [component]="slots().Reasoning" />
          </ng-template>
          <ng-template auiPart="tool-call">
            <!-- A registered tool UI wins; ToolFallback renders only without one. -->
            <aui-tool-ui-outlet [fallback]="slots().ToolFallback" />
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
  /** @internal The part and group slots, with the defaults when used outside `aui-thread`. */
  protected readonly slots = computed(() => {
    const components = this.settings?.components();
    return {
      Text: components?.Text ?? AuiStyledMarkdownText,
      Reasoning: components?.Reasoning ?? AuiThreadReasoningPartComponent,
      ToolFallback: components?.ToolFallback ?? AuiToolFallbackComponent,
      ToolGroup: components?.ToolGroup ?? AuiThreadToolGroupComponent,
      ReasoningGroup: components?.ReasoningGroup ?? AuiThreadReasoningGroupComponent,
    };
  });
}
