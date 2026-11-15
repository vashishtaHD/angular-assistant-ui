// Angular counterpart of rendering a component inside a scoped React subtree
// (packages/react/src/context/react/AssistantApiContext.tsx @ 7d74276): the
// component sees the scope it is rendered in.
import {
  Directive,
  DestroyRef,
  Injector,
  ViewContainerRef,
  inject,
  input,
  type ComponentRef,
  type OnChanges,
  type Type,
} from '@angular/core';
import { AUI_CONTEXT } from '../context/aui-context';

/**
 * Renders a component dynamically, like `*ngComponentOutlet`, in the store
 * scope where the directive sits.
 *
 * Use it instead of `*ngComponentOutlet` for components chosen at run time
 * inside scoped templates: an `ng-template auiPart`, an
 * `ng-template auiEditComposer`, an `auiMessage` template, and so on. A
 * component created by `*ngComponentOutlet` there resolves the scope of the
 * template's declaration site (the message instead of the part, the thread
 * composer instead of the edit composer); this directive hands it the scope
 * the template is rendered in.
 *
 * `auiComponentOutletInputs` sets inputs by name; the component must declare
 * them. A `null` component renders nothing.
 *
 * @example
 * ```html
 * <ng-template auiPart="text">
 *   <ng-container [auiComponentOutlet]="textRenderer" [auiComponentOutletInputs]="{ dense: true }" />
 * </ng-template>
 * ```
 */
@Directive({
  selector: '[auiComponentOutlet]',
  standalone: true,
})
export class AuiComponentOutletDirective implements OnChanges {
  /** The component to render, or `null` for nothing. */
  readonly component = input<Type<unknown> | null | undefined>(undefined, {
    alias: 'auiComponentOutlet',
  });
  /** Inputs set on the component by name. */
  readonly inputs = input<Record<string, unknown> | undefined>(undefined, {
    alias: 'auiComponentOutletInputs',
  });

  private readonly viewContainer = inject(ViewContainerRef);
  /**
   * Re-provides the scope resolved here: the outlet's own parent injector
   * would resolve the declaration site's scope for the created component.
   */
  private readonly injector = Injector.create({
    providers: [{ provide: AUI_CONTEXT, useValue: inject(AUI_CONTEXT) }],
    parent: inject(Injector),
  });
  private ref: ComponentRef<unknown> | null = null;
  private rendered: Type<unknown> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.viewContainer.clear());
  }

  /** Creates the component when it changes and forwards the inputs. */
  ngOnChanges(): void {
    const component = this.component() ?? null;
    if (component !== this.rendered) {
      this.viewContainer.clear();
      this.ref = null;
      this.rendered = component;
      if (component) {
        this.ref = this.viewContainer.createComponent(component, {
          injector: this.injector,
        });
      }
    }
    const inputs = this.inputs();
    if (this.ref && inputs) {
      for (const [name, value] of Object.entries(inputs)) this.ref.setInput(name, value);
    }
  }
}
