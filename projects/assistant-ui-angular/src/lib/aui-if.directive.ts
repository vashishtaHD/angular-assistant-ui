// Ported from packages/vue/src/AuiIf.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import {
  ChangeDetectorRef,
  DestroyRef,
  Directive,
  TemplateRef,
  ViewContainerRef,
  inject,
  input,
  type OnChanges,
} from '@angular/core';
import { getProxiedAssistantState, type AssistantState } from '@assistant-ui/store/client';
import { injectAuiContext } from './context/aui-context';

/**
 * Renders its template while `auiIf` selects `true` from the assistant
 * state. Structural: use it with the `*` syntax.
 *
 * The condition is re-evaluated on every store update and whenever the input
 * changes; rendering works with Zone.js and zoneless change detection.
 *
 * @example
 * ```html
 * <button *auiIf="isRunning" type="button">Stop</button>
 * ```
 * ```ts
 * readonly isRunning = (s: AssistantState) => s.thread.isRunning;
 * ```
 */
@Directive({
  selector: '[auiIf]',
  standalone: true,
})
export class AuiIfDirective implements OnChanges {
  /** Selects whether the template is rendered. */
  readonly auiIf = input.required<(state: AssistantState) => boolean>();

  private readonly template = inject(TemplateRef);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly source = injectAuiContext().source;
  private initialized = false;
  private hasView = false;

  constructor() {
    // A store subscription (not an effect) drives the view, so timing is the
    // same on every supported Angular version.
    const unsubscribe = this.source.subscribe(() => this.update());
    inject(DestroyRef).onDestroy(unsubscribe);
  }

  /** Re-evaluates the condition when the input changes. */
  ngOnChanges(): void {
    this.initialized = true;
    this.update();
  }

  private update(): void {
    if (!this.initialized) return;
    const show = !!this.auiIf()(getProxiedAssistantState(this.source.getClient()));
    if (show === this.hasView) return;
    this.hasView = show;
    if (show) this.viewContainer.createEmbeddedView(this.template);
    else this.viewContainer.clear();
    // Store updates arrive outside change detection; schedule a check so the
    // new embedded view renders (required when zoneless).
    this.cdr.markForCheck();
  }
}
