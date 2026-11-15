// Ported from packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx @ 7d74276
// (`part.toolUI ?? <ToolFallback />`), resolved as packages/vue/src/primitives/MessagePrimitiveParts.ts does
import { ChangeDetectionStrategy, Component, computed, input, type Type } from '@angular/core';
import { AuiComponentOutletDirective } from '../scope/component-outlet.directive';
import { injectRegisteredToolView } from './tool-call-view';

/**
 * Renders the UI registered for the tool-call part in scope
 * ({@link registerToolUI}, a toolkit `render`/`renderText`, or the MCP app
 * renderer), and `fallback` only when nothing is registered for the tool.
 * The fallback renders in the part scope with no inputs.
 *
 * Use it in an `auiPart="tool-call"` template of
 * `aui-message-grouped-parts`, where the template otherwise takes precedence
 * over registered tool UIs, to keep upstream's
 * `part.toolUI ?? <ToolFallback />` order.
 *
 * @example
 * ```html
 * <ng-template auiPart="tool-call">
 *   <aui-tool-ui-outlet [fallback]="ToolFallbackComponent" />
 * </ng-template>
 * ```
 */
@Component({
  selector: 'aui-tool-ui-outlet',
  standalone: true,
  imports: [AuiComponentOutletDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `@switch (view().kind) {
    @case ('value') {
      {{ value() }}
    }
    @case ('component') {
      <ng-container [auiComponentOutlet]="component()" [auiComponentOutletInputs]="inputs()" />
    }
    @case ('fallback') {
      <ng-container [auiComponentOutlet]="fallback()" />
    }
  }`,
})
export class AuiToolUIOutletComponent {
  /** The component rendered for a tool without a registered UI. */
  readonly fallback = input<Type<unknown> | null>(null);

  private readonly registered = injectRegisteredToolView();

  /** @internal */
  protected readonly view = computed(() => this.registered() ?? { kind: 'fallback' as const });
  /** @internal */
  protected readonly value = computed(() => {
    const view = this.view();
    return view.kind === 'value' ? view.value : '';
  });
  /** @internal */
  protected readonly component = computed(() => {
    const view = this.view();
    return view.kind === 'component' ? view.component : null;
  });
  /** @internal */
  protected readonly inputs = computed(() => {
    const view = this.view();
    return view.kind === 'component' ? view.inputs : undefined;
  });
}
