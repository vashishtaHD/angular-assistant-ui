// Ported from packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx (ThreadComponents slots) @ 7d74276
import { ChangeDetectionStrategy, Component, input, type Type } from '@angular/core';
import { AuiComponentOutletDirective } from 'angular-assistant-ui';

/**
 * Renders a slot component of `aui-thread` in the store scope this element
 * sits in, through the main entry's scope-safe `[auiComponentOutlet]`.
 * @internal Part of `aui-thread`.
 */
@Component({
  selector: 'aui-thread-slot',
  standalone: true,
  imports: [AuiComponentOutletDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `<ng-container [auiComponentOutlet]="component()" />`,
})
export class AuiThreadSlotComponent {
  /** The component to render. */
  readonly component = input.required<Type<unknown>>();
}
