// Ported from packages/react/src/primitives/threadList/ThreadListItems.tsx (ThreadListPrimitiveItemByIndex) @ 7d74276
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  booleanAttribute,
  computed,
  contentChild,
  inject,
  input,
  untracked,
} from '@angular/core';
import { injectAui } from '../../state/inject-aui';
import { indexScopeConfig } from '../../scope/index-scope';
import { AuiScopeOutletComponent } from '../../scope/scope-outlet.component';
import { AuiThreadListItemTemplateDirective } from './thread-list-items.component';

/**
 * Renders the projected `ng-template auiThreadListItem` once, scoped to the
 * thread list item at `index` of `threadIds` (or of `archivedThreadIds` with
 * `archived`). Descendants read it through `s.threadListItem`. Use it to
 * render a filtered or regrouped list in your own order; key the enclosing
 * `@for` by thread id. Adds no box of its own (`display: contents`).
 *
 * @example
 * ```html
 * @for (index of visible(); track ids()[index]) {
 *   <aui-thread-list-item-by-index [index]="index">
 *     <ng-template auiThreadListItem><app-thread-row /></ng-template>
 *   </aui-thread-list-item-by-index>
 * }
 * ```
 */
@Component({
  selector: 'aui-thread-list-item-by-index',
  standalone: true,
  imports: [AuiScopeOutletComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `<aui-scope-outlet [config]="config()" [template]="itemTemplate().templateRef" />`,
})
export class AuiThreadListItemByIndexComponent {
  /** Index into `threadIds` (or `archivedThreadIds`). */
  readonly index = input.required<number>();
  /** Index into the archived threads instead of the regular ones. */
  readonly archived = input(false, { transform: booleanAttribute });

  /** The projected per-item template. */
  protected readonly itemTemplate = contentChild.required(AuiThreadListItemTemplateDirective);

  private readonly aui = injectAui();
  private destroyed = false;

  /**
   * The scope config for the current index; a new index updates the scope in
   * place. The scope stays current while the same thread sits at `index` in
   * the live store, so a list that shrinks before the owner re-renders (and
   * moves or drops this element) is not reported as stale.
   */
  protected readonly config = computed(() => {
    const index = this.index();
    const archived = this.archived();
    const idAt = () => {
      const state = this.aui.threads.getState();
      return (archived ? state.archivedThreadIds : state.threadIds)[index];
    };
    const id = untracked(idAt);
    return indexScopeConfig(
      'threadListItem',
      this.aui,
      index,
      () => !this.destroyed && idAt() === id,
      { archived },
    );
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destroyed = true));
  }
}
