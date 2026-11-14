// Ported from packages/core/src/react/primitives/threadListItem/ThreadListItemTitle.tsx @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { injectAuiState } from '../../state/inject-aui-state';

/**
 * Renders the current thread list item's title. When the title is empty it
 * renders the `fallback` string followed by any projected content.
 */
@Component({
  selector: 'aui-thread-list-item-title',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `@if (title()) {
      {{ title() }}
    } @else {
      {{ fallback() }}<ng-content />
    }`,
})
export class AuiThreadListItemTitleComponent {
  /** Text shown while the title is empty. */
  readonly fallback = input('');
  /** @internal */
  protected readonly title = injectAuiState((s) => s.threadListItem.title);
}
