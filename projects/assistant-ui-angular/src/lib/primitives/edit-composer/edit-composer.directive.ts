// Ported from packages/react/src/primitives/message/MessageRoot.tsx / ComposerPrimitive inside a message (type "edit") @ 7d74276
import {
  ChangeDetectorRef,
  DestroyRef,
  Directive,
  Injector,
  TemplateRef,
  ViewContainerRef,
  inject,
  untracked,
  type OnInit,
} from '@angular/core';
import { AuiConfig, Derived, getProxiedAssistantState } from '@assistant-ui/store/client';
import { AUI_CONTEXT, injectAuiContext } from '../../context/aui-context';
import { createAuiContext, type CreatedAuiContext } from '../../context/create-aui-context';

const EDIT_COMPOSER_CONFIG = AuiConfig({
  composer: Derived({
    source: 'message',
    query: {},
    get: (aui) => aui.message().composer(),
  }),
});

/**
 * Structural directive for the edit UI of a message. While the message is
 * being edited it renders its template in a child scope whose `composer` is
 * the message's edit composer, so `[auiComposerRoot]`, `[auiComposerInput]`,
 * `[auiComposerSend]` and `[auiComposerCancel]` inside it bind to the edit
 * composer (send creates a new branch, cancel restores the original). While
 * the message is not being edited, nothing is rendered.
 *
 * Use it inside a message scope (for example in an `auiMessage` template).
 *
 * @example
 * ```html
 * <form *auiEditComposer auiComposerRoot>
 *   <textarea auiComposerInput></textarea>
 *   <button auiComposerCancel>Cancel</button>
 *   <button auiComposerSend>Save</button>
 * </form>
 * ```
 */
@Directive({
  selector: '[auiEditComposer]',
  standalone: true,
})
export class AuiEditComposerDirective implements OnInit {
  private readonly template = inject(TemplateRef);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly injector = inject(Injector);
  private readonly parent = injectAuiContext().source;
  private inner: CreatedAuiContext | undefined;
  private hasView = false;

  constructor() {
    const unsubscribe = this.parent.subscribe(() => this.update());
    inject(DestroyRef).onDestroy(() => {
      unsubscribe();
      this.teardown();
    });
  }

  /** First evaluation, once the parent scope can be read. */
  ngOnInit(): void {
    this.update();
  }

  private isEditing(): boolean {
    const state = getProxiedAssistantState(this.parent.getClient());
    return state.optional.message !== undefined && state.composer.isEditing;
  }

  private update(): void {
    const show = untracked(() => this.isEditing());
    if (show === this.hasView) return;
    if (show) {
      this.inner = createAuiContext({
        parent: this.parent,
        getConfig: () => EDIT_COMPOSER_CONFIG,
        subscribe: () => () => undefined,
      });
      const injector = Injector.create({
        providers: [{ provide: AUI_CONTEXT, useValue: this.inner.context }],
        parent: this.injector,
      });
      this.viewContainer.createEmbeddedView(this.template, undefined, { injector });
    } else {
      this.viewContainer.clear();
      this.teardown();
    }
    this.hasView = show;
    this.cdr.markForCheck();
  }

  private teardown(): void {
    this.inner?.release();
    this.inner = undefined;
  }
}
