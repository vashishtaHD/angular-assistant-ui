// Angular plumbing for the component slots of packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx @ 7d74276
import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  inject,
  input,
  type Type,
} from '@angular/core';
import { AUI_CONTEXT } from 'angular-assistant-ui';

/**
 * Renders a slot component in the store scope this element sits in. A
 * component created by `*ngComponentOutlet` inside a scoped template (a part
 * template, say) would otherwise resolve the scope of the template's
 * declaration site; this hands it the scope resolved here.
 * @internal Part of `aui-thread`.
 */
@Component({
  selector: 'aui-thread-slot',
  standalone: true,
  imports: [NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `<ng-container *ngComponentOutlet="component(); injector: injector" />`,
})
export class AuiThreadSlotComponent {
  /** The component to render. */
  readonly component = input.required<Type<unknown>>();

  /** @internal */
  protected readonly injector = Injector.create({
    providers: [{ provide: AUI_CONTEXT, useValue: inject(AUI_CONTEXT) }],
    parent: inject(Injector),
  });
}
