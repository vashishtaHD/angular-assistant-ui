// Ported from packages/ui/src/components/react/assistant-ui/elements/tool-group.aui.tsx @ 7d74276
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  booleanAttribute,
  computed,
  inject,
  input,
  model,
  numberAttribute,
} from '@angular/core';
import { injectScrollLock } from 'angular-assistant-ui';
import {
  AuiCollapsibleComponent,
  AuiCollapsibleContentComponent,
  AuiCollapsibleTriggerDirective,
} from './collapsible/collapsible';
import { AuiIconComponent } from './icons/icon.component';

const ANIMATION_DURATION = 200;

/** Look of `aui-tool-group`: a bordered card, a bare row, or a muted card. */
export type AuiToolGroupVariant = 'outline' | 'ghost' | 'muted';

/**
 * A collapsible group of consecutive tool calls with a "N tool calls"
 * trigger. Project the calls as content. Use it as the group template of
 * `aui-message-grouped-parts` with a `groupBy` that puts tool calls in
 * `group-tool` (a run of adjacent tool calls coalesces into one group). It is
 * closed by default (`open` is a two-way `model`); toggling locks the scroll
 * container while the body animates. While `active`, the trigger shows a
 * spinner and a shimmering label.
 *
 * @example
 * ```html
 * <aui-message-grouped-parts [groupBy]="groupTools">
 *   <ng-template auiGroup="group-tool" let-group>
 *     <aui-tool-group [count]="group.indices.length" [active]="group.status.type === 'running'">
 *       <aui-group-children [group]="group" />
 *     </aui-tool-group>
 *   </ng-template>
 *   <ng-template auiPart="tool-call"><aui-tool-fallback /></ng-template>
 * </aui-message-grouped-parts>
 * ```
 */
@Component({
  selector: 'aui-tool-group',
  standalone: true,
  imports: [
    AuiCollapsibleComponent,
    AuiCollapsibleTriggerDirective,
    AuiCollapsibleContentComponent,
    AuiIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-tool-group' },
  template: `
    <aui-collapsible
      data-slot="aui_tool-group-root"
      class="aui-tool-group-root"
      [attr.data-variant]="variant()"
      [open]="open()"
      (openChange)="setOpen($event)"
    >
      <button
        type="button"
        auiCollapsibleTrigger
        data-slot="aui_tool-group-trigger"
        class="aui-tool-group-trigger"
      >
        @if (active()) {
          <aui-icon
            data-slot="aui_tool-group-trigger-loader"
            class="aui-tool-group-loader"
            name="loader"
          />
        }
        <span
          data-slot="aui_tool-group-trigger-label"
          class="aui-tool-group-label"
          [class.aui-shimmer]="active()"
          >{{ label() }}</span
        >
        <aui-icon
          data-slot="aui_tool-group-trigger-chevron"
          class="aui-tool-group-chevron"
          name="chevron-down"
        />
      </button>
      <aui-collapsible-content data-slot="aui_tool-group-content" class="aui-tool-group-content">
        <div class="aui-tool-group-body"><ng-content /></div>
      </aui-collapsible-content>
    </aui-collapsible>
  `,
})
export class AuiToolGroupComponent {
  /** Number of tool calls in the group, for the trigger label. */
  readonly count = input.required<number, unknown>({ transform: numberAttribute });
  /** Whether a call in the group is running. */
  readonly active = input(false, { transform: booleanAttribute });
  /** Look of the group. Default `outline`. */
  readonly variant = input<AuiToolGroupVariant>('outline');
  /** Whether the group is expanded. */
  readonly open = model(false);

  private readonly lockScroll = injectScrollLock(inject(ElementRef), ANIMATION_DURATION);

  /** @internal */
  protected readonly label = computed(() => {
    const count = this.count();
    return `${count} tool ${count === 1 ? 'call' : 'calls'}`;
  });

  /** @internal */
  protected setOpen(open: boolean): void {
    this.lockScroll();
    this.open.set(open);
  }
}
