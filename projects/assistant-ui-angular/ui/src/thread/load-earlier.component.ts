// Ported from packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx (ThreadLoadEarlier) @ 7d74276
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { AuiThreadLoadEarlierDirective, injectAuiState } from 'angular-assistant-ui';
import { AuiButtonDirective } from '../button.directive';

/**
 * The Load earlier messages button at the top of a thread with earlier
 * history, plus a live region announcing the load.
 * @internal Part of `aui-thread`.
 */
@Component({
  selector: 'aui-thread-load-earlier',
  standalone: true,
  imports: [AuiThreadLoadEarlierDirective, AuiButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents' },
  template: `<span role="status" class="aui-sr-only">{{
      loading() ? 'Loading earlier messages' : ''
    }}</span>
    @if (visible()) {
      <button
        auiButton
        variant="ghost"
        size="sm"
        auiThreadLoadEarlier
        class="aui-thread-load-earlier"
        data-slot="aui_thread-load-earlier"
      >
        <span [class.aui-shimmer]="loading()">{{
          loading() ? 'Loading earlier messages' : 'Load earlier messages'
        }}</span>
      </button>
    }`,
})
export class AuiThreadLoadEarlierComponent {
  /** @internal */
  protected readonly visible = injectAuiState(
    (s) => s.thread.hasEarlier || s.thread.isLoadingEarlier,
  );
  /** @internal */
  protected readonly loading = injectAuiState((s) => s.thread.isLoadingEarlier);
}
