// Ported from packages/react/src/primitives/queueItem/QueueItemText.tsx @ 7d74276
import { Directive } from '@angular/core';
import { injectAuiState } from '../../state/inject-aui-state';

/** Renders the prompt text of a queue item as the element's text content. */
@Directive({
  selector: '[auiQueueItemText]',
  standalone: true,
  host: { '[textContent]': 'text()' },
})
export class AuiQueueItemTextDirective {
  /** @internal */
  protected readonly text = injectAuiState((s) =>
    // Hosts on the pre-parts adapter shape may omit the field at runtime.
    (s.queueItem.parts ?? [])
      .filter((part) => part.type === 'text')
      .map((part) => (part as { text: string }).text)
      .join('\n\n'),
  );
}
