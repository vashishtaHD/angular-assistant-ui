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
 * them. Like `NgComponentOutlet`, each change of the map sets only the keys
 * whose values changed and resets removed keys to `undefined`; a new
 * component type is created afresh. A `null` component renders nothing.
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
  /** The inputs last set on {@link ref}, to diff the next map against. */
  private applied = new Map<string, unknown>();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.viewContainer.clear());
  }

  /**
   * Creates the component when its type changes, then applies the inputs
   * diff: changed or added keys are set, removed keys are reset to
   * `undefined` (as `NgComponentOutlet` does), unchanged keys are left alone.
   */
  ngOnChanges(): void {
    const component = this.component() ?? null;
    if (component !== this.rendered) {
      this.viewContainer.clear();
      this.ref = null;
      this.applied = new Map();
      this.rendered = component;
      if (component) {
        this.ref = this.viewContainer.createComponent(component, {
          injector: this.injector,
        });
      }
    }
    const ref = this.ref;
    if (!ref) return;
    const inputs = this.inputs() ?? {};
    for (const name of [...this.applied.keys()]) {
      if (!Object.prototype.hasOwnProperty.call(inputs, name)) {
        ref.setInput(name, undefined);
        this.applied.delete(name);
      }
    }
    for (const [name, value] of Object.entries(inputs)) {
      if (this.applied.has(name) && Object.is(this.applied.get(name), value)) continue;
      ref.setInput(name, value);
      this.applied.set(name, value);
    }
  }
}
