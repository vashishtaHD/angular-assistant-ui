import {
  ChangeDetectorRef,
  DestroyRef,
  Directive,
  TemplateRef,
  ViewContainerRef,
  inject,
  type EmbeddedViewRef,
  type OnInit,
} from '@angular/core';
import { getProxiedAssistantState, type AssistantState } from '@assistant-ui/store/client';
import { injectAuiContext } from '../context/aui-context';

/** The context of a state-gated template: the selected value (`let-value`). */
export interface AuiStateGateContext<T> {
  /** The value the gate selected from the assistant state. */
  $implicit: T;
}

/**
 * Internal base of the structural directives that render their template
 * while a selector yields a value: `*auiMessageError`, `*auiPartInProgress`
 * and `*auiMessageQuote`. A store subscription (not an effect) drives the
 * view, and the context follows the selected value in place.
 */
@Directive()
export abstract class AuiStateGateDirective<T> implements OnInit {
  private readonly template = inject<TemplateRef<AuiStateGateContext<T>>>(TemplateRef);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly source = injectAuiContext().source;
  private view: EmbeddedViewRef<AuiStateGateContext<T>> | undefined;
  private initialized = false;

  constructor() {
    const unsubscribe = this.source.subscribe(() => this.update());
    inject(DestroyRef).onDestroy(unsubscribe);
  }

  /** Selects the value to render with; `undefined` hides the template. */
  protected abstract select(state: AssistantState): T | undefined;

  /** The client is created by the provider's first change, so evaluate from here. */
  ngOnInit(): void {
    this.initialized = true;
    this.update();
  }

  private update(): void {
    if (!this.initialized) return;
    const value = this.select(getProxiedAssistantState(this.source.getClient()));
    if (value === undefined) {
      if (!this.view) return;
      this.viewContainer.clear();
      this.view = undefined;
    } else if (!this.view) {
      this.view = this.viewContainer.createEmbeddedView(this.template, { $implicit: value });
    } else if (this.view.context.$implicit !== value) {
      this.view.context.$implicit = value;
      this.view.markForCheck();
    } else {
      return;
    }
    // Store updates arrive outside change detection; schedule a check so the
    // view change renders (required when zoneless).
    this.cdr.markForCheck();
  }
}
