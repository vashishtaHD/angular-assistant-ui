// Ported from packages/ui/src/components/vue/assistant-ui/tool-fallback.vue @ 7d74276
// and packages/ui/src/components/react/assistant-ui/elements/tool-fallback.aui.tsx @ 7d74276
// (root, trigger, duration, args, result and error; the approval area is tool-fallback-approval)
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  injectAuiState,
  injectScrollLock,
  injectToolCallElapsed,
  type ToolUIProps,
} from 'angular-assistant-ui';
import {
  AuiCollapsibleComponent,
  AuiCollapsibleContentComponent,
  AuiCollapsibleTriggerDirective,
} from '../collapsible/collapsible';
import { AuiIconComponent } from '../icons/icon.component';
import type { AuiIconName } from '../icons/icon-shapes';
import { AuiToolFallbackApprovalComponent } from './tool-fallback-approval.component';
import { AuiToolFallbackAskUserComponent } from './tool-fallback-ask-user.component';
import {
  formatToolDuration,
  formatUnknownValue,
  isApprovalSettled,
  isPendingAskUser,
  offersInterruptAction,
  type AuiToolCallPart,
} from './tool-fallback-utils';

const ANIMATION_DURATION = 200;

type StatusType = AuiToolCallPart['status']['type'];

const STATUS_ICONS: Record<StatusType, AuiIconName> = {
  running: 'loader',
  complete: 'check',
  incomplete: 'x',
  'requires-action': 'alert-circle',
};

/**
 * The styled fallback for a tool call without its own UI. It reads the
 * tool-call part of the enclosing part scope, so it works as a part template
 * (`<ng-template auiPart="tool-call"><aui-tool-fallback /></ng-template>`),
 * as the `ToolFallback` slot of the styled thread, and as a UI registered with
 * `registerToolUI(name, AuiToolFallbackComponent)`.
 *
 * A collapsible trigger names the tool and its state: running (a spinning icon
 * and a shimmering label), waiting, failed, cancelled (only when the part's
 * status is `incomplete` with reason `cancelled`), done, or a queued reply,
 * with the call's duration when the runtime records timing. The body shows the
 * error, the arguments, the result and, while the call waits on the user, the
 * approval card (`aui-tool-fallback-approval`) or, for an ask-user call, its
 * answer form (`aui-tool-fallback-ask-user`). A call that starts waiting on
 * the user opens itself. Toggling locks the scroll container while the body
 * animates.
 *
 * State hooks: `data-status`, `data-running` and `data-cancelled` on the root
 * (`[data-slot="aui_tool-fallback-root"]`).
 */
@Component({
  selector: 'aui-tool-fallback',
  standalone: true,
  imports: [
    AuiCollapsibleComponent,
    AuiCollapsibleTriggerDirective,
    AuiCollapsibleContentComponent,
    AuiIconComponent,
    AuiToolFallbackApprovalComponent,
    AuiToolFallbackAskUserComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-tool-fallback' },
  template: `
    @if (part(); as part) {
      <aui-collapsible
        data-slot="aui_tool-fallback-root"
        class="aui-tool-fallback-root"
        [open]="open()"
        (openChange)="setOpen($event)"
        [attr.data-status]="statusType()"
        [attr.data-running]="isRunning() ? '' : null"
        [attr.data-cancelled]="isCancelled() ? '' : null"
      >
        <button
          type="button"
          auiCollapsibleTrigger
          data-slot="aui_tool-fallback-trigger"
          class="aui-tool-fallback-trigger"
        >
          <aui-icon
            data-slot="aui_tool-fallback-trigger-icon"
            class="aui-tool-fallback-trigger-icon"
            [name]="statusIcon()"
          />
          <span
            data-slot="aui_tool-fallback-trigger-label"
            class="aui-tool-fallback-trigger-label"
            [class.aui-shimmer]="isRunning()"
            >{{ label() }}: <b>{{ part.toolName }}</b></span
          >
          @if (duration(); as text) {
            <span data-slot="aui_tool-fallback-duration" class="aui-tool-fallback-duration">{{
              text
            }}</span>
          }
          <aui-icon
            data-slot="aui_tool-fallback-trigger-chevron"
            class="aui-tool-fallback-chevron"
            name="chevron-down"
          />
        </button>
        <aui-collapsible-content
          data-slot="aui_tool-fallback-content"
          class="aui-tool-fallback-content"
        >
          <div class="aui-tool-fallback-body">
            @if (errorText(); as error) {
              <div data-slot="aui_tool-fallback-error" class="aui-tool-fallback-error">
                <p class="aui-tool-fallback-strong aui-tool-fallback-muted">
                  {{ isCancelled() ? 'Cancelled reason:' : 'Error:' }}
                </p>
                <p class="aui-tool-fallback-muted aui-tool-fallback-pre">{{ error }}</p>
              </div>
            }
            @if (part.argsText) {
              <pre data-slot="aui_tool-fallback-args" class="aui-tool-fallback-code">{{
                part.argsText
              }}</pre>
            }
            @if (showAskUser()) {
              <aui-tool-fallback-ask-user />
            } @else if (showApproval()) {
              <aui-tool-fallback-approval />
            }
            @if (part.result !== undefined) {
              <div data-slot="aui_tool-fallback-result" class="aui-tool-fallback-result">
                <p class="aui-tool-fallback-result-header">Result:</p>
                <pre class="aui-tool-fallback-code">{{ resultText() }}</pre>
              </div>
            }
          </div>
        </aui-collapsible-content>
      </aui-collapsible>
    }
  `,
})
export class AuiToolFallbackComponent {
  /**
   * The tool UI props, accepted so the component satisfies the
   * `registerToolUI` contract. The component reads the enclosing part scope
   * instead, so the input may be left unset.
   */
  readonly tool = input<ToolUIProps>(undefined as unknown as ToolUIProps);

  private readonly lockScroll = injectScrollLock(inject(ElementRef), ANIMATION_DURATION);
  private readonly elapsed = injectToolCallElapsed();

  /** @internal */
  protected readonly part = injectAuiState((s): AuiToolCallPart | null =>
    s.part.type === 'tool-call' ? s.part : null,
  );

  /** @internal */
  protected readonly statusType = computed<StatusType>(() => {
    const part = this.part();
    const reported = part?.status.type ?? 'complete';
    return reported === 'complete' && part?.isError ? 'incomplete' : reported;
  });
  /** @internal */
  protected readonly isRunning = computed(() => this.statusType() === 'running');
  /** @internal */
  protected readonly isCancelled = computed(() => {
    const status = this.part()?.status;
    return status?.type === 'incomplete' && status.reason === 'cancelled';
  });
  private readonly requiresAction = computed(() => this.statusType() === 'requires-action');

  /** @internal */
  protected readonly label = computed(() => {
    if (this.part()?.responseDeliveryStatus === 'queued') return 'Reply queued, not sent yet';
    switch (this.statusType()) {
      case 'running':
        return 'Running tool';
      case 'requires-action':
        return 'Waiting on tool';
      case 'incomplete':
        return `${this.isCancelled() ? 'Cancelled' : 'Failed'} tool`;
      default:
        return 'Used tool';
    }
  });
  /** @internal */
  protected readonly statusIcon = computed(() => STATUS_ICONS[this.statusType()]);
  /** @internal */
  protected readonly duration = computed(() => {
    const ms = this.elapsed();
    return ms === undefined ? undefined : formatToolDuration(ms);
  });

  /** @internal */
  protected readonly errorText = computed(() => {
    const status = this.part()?.status;
    if (status?.type !== 'incomplete') return null;
    if (status.error === undefined || status.error === null) return null;
    return formatUnknownValue(status.error) || null;
  });
  /** @internal */
  protected readonly resultText = computed(() => formatUnknownValue(this.part()?.result, 2));

  /** @internal */
  protected readonly showAskUser = computed(() => {
    const part = this.part();
    return part != null && isPendingAskUser(part);
  });
  /** @internal */
  protected readonly showApproval = computed(() => {
    const part = this.part();
    if (!part) return false;
    return (
      (this.requiresAction() && offersInterruptAction(part)) || isApprovalSettled(part.approval)
    );
  });

  // Each time the call starts waiting on the user it opens, overriding an
  // earlier toggle; a toggle holds until the next time.
  private waitingRuns = 0;
  private wasWaiting = false;
  private readonly waitingEpoch = computed(() => {
    const waiting = this.requiresAction();
    if (waiting && !this.wasWaiting) this.waitingRuns++;
    this.wasWaiting = waiting;
    return this.waitingRuns;
  });
  private readonly userOpen = signal<{ readonly epoch: number; readonly open: boolean } | null>(
    null,
  );
  /** @internal */
  protected readonly open = computed(() => {
    const epoch = this.waitingEpoch();
    const choice = this.userOpen();
    return choice !== null && choice.epoch === epoch ? choice.open : epoch > 0;
  });

  /** @internal */
  protected setOpen(open: boolean): void {
    this.lockScroll();
    this.userOpen.set({ epoch: this.waitingEpoch(), open });
  }
}
