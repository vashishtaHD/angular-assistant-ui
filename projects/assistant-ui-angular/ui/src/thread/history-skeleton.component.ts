// Ported from packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx (ThreadHistorySkeleton) @ 7d74276
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

/**
 * The placeholder shown while a switched-to thread fetches its history.
 * @internal Part of `aui-thread`.
 */
@Component({
  selector: 'aui-thread-history-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'aui-thread-history-skeleton',
    'data-slot': 'aui_thread-history-skeleton',
    role: 'status',
  },
  template: `<span class="aui-sr-only">Loading conversation</span>
    <div class="aui-skeleton aui-skeleton-bubble" style="width: 40%"></div>
    <div class="aui-skeleton-lines">
      <div class="aui-skeleton aui-skeleton-line" style="width: 92%"></div>
      <div class="aui-skeleton aui-skeleton-line" style="width: 80%"></div>
      <div class="aui-skeleton aui-skeleton-line" style="width: 60%"></div>
    </div>
    <div class="aui-skeleton aui-skeleton-bubble" style="width: 33%"></div>
    <div class="aui-skeleton-lines">
      <div class="aui-skeleton aui-skeleton-line" style="width: 83%"></div>
      <div class="aui-skeleton aui-skeleton-line" style="width: 66%"></div>
    </div>`,
})
export class AuiThreadHistorySkeletonComponent {}
