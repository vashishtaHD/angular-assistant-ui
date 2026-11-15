// Ported from packages/ui/src/components/react/assistant-ui/elements/thread-list.aui.tsx
// and packages/ui/src/components/vue/assistant-ui/thread-list.vue @ 7d74276
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  booleanAttribute,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  AuiThreadListItemArchiveDirective,
  AuiThreadListItemByIndexComponent,
  AuiThreadListItemDeleteDirective,
  AuiThreadListItemRootDirective,
  AuiThreadListItemTemplateDirective,
  AuiThreadListItemTitleComponent,
  AuiThreadListItemTriggerDirective,
  AuiThreadListItemUnarchiveDirective,
  AuiThreadListLoadMoreDirective,
  AuiThreadListNewDirective,
  AuiThreadListRootDirective,
  injectAui,
  injectAuiState,
  injectThreadListItemFocus,
} from 'angular-assistant-ui';
import { AuiButtonDirective } from '../button.directive';
import {
  AuiDropdownMenuContentDirective,
  AuiDropdownMenuItemDirective,
  AuiDropdownMenuTriggerDirective,
} from '../dropdown-menu/dropdown-menu';
import { AuiIconComponent } from '../icons/icon.component';
import { groupThreadList, injectThreadListGroups } from './thread-list-groups';

let nextListId = 0;

/**
 * Registers the host button as its thread list item's "more" button, so the
 * inline arrows move between the item trigger and it (what
 * `button[auiThreadListItemMoreTrigger]` does for the headless menu).
 * @internal Part of `aui-thread-list`.
 */
@Directive({ selector: 'button[auiThreadListMoreButton]', standalone: true })
export class AuiThreadListMoreButtonDirective {
  constructor() {
    const element = inject<ElementRef<HTMLButtonElement>>(ElementRef).nativeElement;
    const focus = injectThreadListItemFocus();
    if (!focus) return;
    afterNextRender(() => focus.more.set(element));
    inject(DestroyRef).onDestroy(() => {
      if (focus.more() === element) focus.more.set(null);
    });
  }
}

/**
 * The inline rename input of a thread list item. Enter or blur commits the
 * trimmed title (an empty or unchanged title just closes), Escape cancels.
 * @internal Part of `aui-thread-list`.
 */
@Component({
  selector: 'aui-thread-list-item-rename',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents' },
  template: `<input
    #input
    class="aui-thread-list-item-rename"
    data-slot="aui_thread-list-item-rename"
    aria-label="Rename thread"
    [value]="value()"
    (input)="value.set(input.value)"
    (blur)="commit(false)"
    (keydown)="onKeydown($event)"
  />`,
})
export class AuiThreadListItemRenameComponent {
  /** Emits once the rename is over; `true` when focus should return to the item trigger. */
  readonly done = output<boolean>();

  private readonly aui = injectAui();
  private readonly title = injectAuiState((s) => s.threadListItem.title ?? '');
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  /** @internal */
  protected readonly value = signal(this.title());
  private settled = false;

  constructor() {
    afterNextRender(() => {
      const element = this.input().nativeElement;
      element.focus();
      element.select();
    });
  }

  /** @internal */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commit(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (this.settled) return;
      this.settled = true;
      this.done.emit(true);
    }
  }

  /** @internal */
  protected commit(restoreFocus: boolean): void {
    if (this.settled) return;
    this.settled = true;
    const next = this.value().trim();
    if (!next || next === this.title()) {
      this.done.emit(restoreFocus);
      return;
    }
    // Deferred so a synchronous throw lands on the rejection path too.
    Promise.resolve()
      .then(() => this.aui.threadListItem.rename(next))
      .then(
        () => this.done.emit(restoreFocus),
        () => {
          this.settled = false;
          if (restoreFocus) this.input().nativeElement.focus();
        },
      );
  }
}

/**
 * One styled thread list row: the title trigger (with a spinner while the
 * thread runs), an inline rename input, and a "more" menu with Rename,
 * Archive (Unarchive for archived threads) and Delete.
 * @internal Part of `aui-thread-list`.
 */
@Component({
  selector: 'aui-thread-list-item-styled',
  standalone: true,
  imports: [
    AuiThreadListItemRootDirective,
    AuiThreadListItemTriggerDirective,
    AuiThreadListItemTitleComponent,
    AuiThreadListItemArchiveDirective,
    AuiThreadListItemUnarchiveDirective,
    AuiThreadListItemDeleteDirective,
    AuiThreadListItemRenameComponent,
    AuiThreadListMoreButtonDirective,
    AuiButtonDirective,
    AuiIconComponent,
    AuiDropdownMenuTriggerDirective,
    AuiDropdownMenuContentDirective,
    AuiDropdownMenuItemDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents' },
  template: `<div
    auiThreadListItemRoot
    class="aui-thread-list-item"
    data-slot="aui_thread-list-item"
    [attr.data-menu-open]="more.isOpen() ? '' : null"
  >
    @if (renaming()) {
      <aui-thread-list-item-rename (done)="endRename($event)" />
    } @else {
      <button
        #trigger
        type="button"
        auiThreadListItemTrigger
        class="aui-thread-list-item-trigger"
        data-slot="aui_thread-list-item-trigger"
        (click)="selected.emit()"
      >
        @if (isRunning()) {
          <aui-icon
            name="loader"
            class="aui-thread-list-item-running"
            data-slot="aui_thread-list-item-running"
          />
        }
        <span class="aui-thread-list-item-title" data-slot="aui_thread-list-item-title"
          ><aui-thread-list-item-title fallback="New Chat"
        /></span>
        @if (isRunning()) {
          <span class="aui-sr-only">Running</span>
        }
      </button>
    }
    <button
      auiButton
      variant="ghost"
      size="icon"
      auiThreadListMoreButton
      [auiDropdownMenuTrigger]="menu"
      #more="auiDropdownMenuTrigger"
      sideKeys
      align="end"
      class="aui-thread-list-item-more"
      data-slot="aui_thread-list-item-more"
      [attr.data-state]="more.isOpen() ? 'open' : 'closed'"
      aria-label="More options"
    >
      <aui-icon name="more-horizontal" />
    </button>
    <ng-template #menu>
      <div
        auiDropdownMenuContent
        class="aui-thread-list-item-more-content"
        data-slot="aui_thread-list-item-more-content"
      >
        <button
          type="button"
          auiDropdownMenuItem
          class="aui-thread-list-item-more-item"
          data-slot="aui_thread-list-item-more-item"
          (itemSelect)="renaming.set(true)"
        >
          <aui-icon name="pencil" />Rename
        </button>
        @if (archived()) {
          <button
            type="button"
            auiDropdownMenuItem
            auiThreadListItemUnarchive
            class="aui-thread-list-item-more-item"
            data-slot="aui_thread-list-item-more-item"
          >
            <aui-icon name="archive" />Unarchive
          </button>
        } @else {
          <button
            type="button"
            auiDropdownMenuItem
            auiThreadListItemArchive
            class="aui-thread-list-item-more-item"
            data-slot="aui_thread-list-item-more-item"
          >
            <aui-icon name="archive" />Archive
          </button>
        }
        <button
          type="button"
          auiDropdownMenuItem
          auiThreadListItemDelete
          class="aui-thread-list-item-more-item aui-thread-list-item-more-item-destructive"
          data-slot="aui_thread-list-item-more-item"
        >
          <aui-icon name="trash" />Delete
        </button>
      </div>
    </ng-template>
  </div>`,
})
export class AuiThreadListItemStyledComponent {
  /** Emits when the row's trigger is clicked (the thread is chosen). */
  readonly selected = output<void>();

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  /** @internal */
  protected readonly isRunning = injectAuiState((s) => s.threadListItem.isRunning);
  /** @internal */
  protected readonly archived = injectAuiState((s) => s.threadListItem.status === 'archived');
  /** @internal */
  protected readonly renaming = signal(false);

  /** @internal */
  protected endRename(restoreFocus: boolean): void {
    this.renaming.set(false);
    if (!restoreFocus) return;
    // Render the trigger back now so it can take focus from the removed input.
    this.cdr.detectChanges();
    this.trigger()?.nativeElement.focus();
  }
}

/**
 * The styled thread list: a New Thread button, a title search, the threads
 * grouped by last activity (Today, Yesterday, Previous 7 days, Previous 30
 * days, Older), each with a "more" menu (rename, archive, delete), skeletons
 * while the list loads, Load more while the adapter has more pages, and a
 * toggle that shows the archived threads (each with Unarchive).
 *
 * Use it inside an `[auiProvider]` whose runtime has a thread list (for
 * example `remoteThreadListConfig` or `MastraThreads`). Import
 * `angular-assistant-ui/ui/styles.css` once.
 *
 * @example
 * ```html
 * <nav [auiProvider]="config"><aui-thread-list /></nav>
 * ```
 */
@Component({
  selector: 'aui-thread-list',
  standalone: true,
  imports: [
    AuiThreadListRootDirective,
    AuiThreadListNewDirective,
    AuiThreadListLoadMoreDirective,
    AuiThreadListItemByIndexComponent,
    AuiThreadListItemTemplateDirective,
    AuiThreadListItemStyledComponent,
    AuiButtonDirective,
    AuiIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-thread-list' },
  template: `<div
    auiThreadListRoot
    class="aui-root aui-thread-list-root"
    data-slot="aui_thread-list-root"
  >
    @if (showNew()) {
      <button
        auiButton
        variant="ghost"
        auiThreadListNew
        class="aui-thread-list-new"
        data-slot="aui_thread-list-new"
        (click)="threadSelect.emit()"
      >
        <aui-icon
          name="plus"
          class="aui-thread-list-new-icon"
          data-slot="aui_thread-list-new-icon"
        />
        <span class="aui-thread-list-new-label" data-slot="aui_thread-list-new-label"
          >New Thread</span
        >
      </button>
    }
    @if (hasThreads()) {
      <div class="aui-thread-list-search" data-slot="aui_thread-list-search">
        <aui-icon
          name="search"
          class="aui-thread-list-search-icon"
          data-slot="aui_thread-list-search-icon"
        />
        <input
          #searchInput
          type="search"
          class="aui-thread-list-search-input"
          aria-label="Search threads"
          placeholder="Search threads"
          [value]="search()"
          (input)="searchText.set(searchInput.value)"
        />
      </div>
    }
    <div class="aui-thread-list-items" data-slot="aui_thread-list-items">
      @if (isLoading()) {
        <div role="status" aria-label="Loading threads" class="aui-thread-list-skeletons">
          @for (row of skeletonRows; track row) {
            <div
              aria-hidden="true"
              class="aui-thread-list-skeleton-wrapper"
              data-slot="aui_thread-list-skeleton-wrapper"
            >
              <div
                class="aui-skeleton aui-thread-list-skeleton"
                data-slot="aui_thread-list-skeleton"
              ></div>
            </div>
          }
        </div>
      } @else if (query() && list().filteredIndices.length === 0) {
        <div class="aui-thread-list-empty" data-slot="aui_thread-list-empty">No threads found</div>
      } @else if (groups().length > 0) {
        @for (group of groups(); track group.label) {
          <div
            role="group"
            class="aui-thread-list-group"
            data-slot="aui_thread-list-group"
            [attr.aria-label]="group.label"
          >
            <div class="aui-thread-list-group-label" data-slot="aui_thread-list-group-label">
              {{ group.label }}
            </div>
            @for (index of group.indices; track list().threadIds[index]) {
              <aui-thread-list-item-by-index [index]="index">
                <ng-template auiThreadListItem>
                  <aui-thread-list-item-styled (selected)="threadSelect.emit()" />
                </ng-template>
              </aui-thread-list-item-by-index>
            }
          </div>
        }
      } @else {
        @for (index of list().filteredIndices; track list().threadIds[index]) {
          <aui-thread-list-item-by-index [index]="index">
            <ng-template auiThreadListItem>
              <aui-thread-list-item-styled (selected)="threadSelect.emit()" />
            </ng-template>
          </aui-thread-list-item-by-index>
        }
      }
    </div>
    @if (hasMore() && !isLoading()) {
      <button
        auiButton
        variant="ghost"
        size="sm"
        auiThreadListLoadMore
        class="aui-thread-list-load-more"
        data-slot="aui_thread-list-load-more"
        [attr.data-loading]="isLoadingMore() ? '' : null"
      >
        @if (isLoadingMore()) {
          <aui-icon name="loader" class="aui-thread-list-load-more-spinner" />
        }
        Load more
      </button>
    }
    @if (showArchived() && archivedIds().length > 0) {
      <button
        type="button"
        class="aui-thread-list-archived-toggle"
        data-slot="aui_thread-list-archived-toggle"
        [attr.aria-expanded]="archivedOpen()"
        [attr.aria-controls]="archivedOpen() ? archivedId : null"
        [attr.data-open]="archivedOpen() ? '' : null"
        (click)="archivedOpen.set(!archivedOpen())"
      >
        <aui-icon name="chevron-right" class="aui-thread-list-archived-chevron" />
        <span>Archived</span>
        <span class="aui-thread-list-archived-count">{{ archivedIds().length }}</span>
      </button>
      @if (archivedOpen()) {
        <div
          role="group"
          aria-label="Archived threads"
          class="aui-thread-list-archived"
          data-slot="aui_thread-list-archived"
          [id]="archivedId"
        >
          @for (index of archivedIndices(); track archivedIds()[index]) {
            <aui-thread-list-item-by-index [index]="index" archived>
              <ng-template auiThreadListItem>
                <aui-thread-list-item-styled (selected)="threadSelect.emit()" />
              </ng-template>
            </aui-thread-list-item-by-index>
          } @empty {
            <div class="aui-thread-list-empty" data-slot="aui_thread-list-empty">
              No threads found
            </div>
          }
        </div>
      }
    }
  </div>`,
})
export class AuiThreadListComponent {
  /** Show the New Thread button. */
  readonly showNew = input(true, { transform: booleanAttribute });
  /** Show the archived threads toggle (only while there are archived threads). */
  readonly showArchived = input(true, { transform: booleanAttribute });
  /** Emits when a thread is chosen: an item, or New Thread. */
  readonly threadSelect = output<void>();

  /** @internal */
  protected readonly skeletonRows = [0, 1, 2, 3, 4];
  /** @internal */
  protected readonly archivedId = `aui-thread-list-archived-${++nextListId}`;
  /** @internal */
  protected readonly searchText = signal('');
  /** @internal */
  protected readonly hasThreads = injectAuiState((s) => s.threads.threadIds.length > 0);
  /** @internal */
  protected readonly isLoading = injectAuiState((s) => s.threads.isLoading);
  /** @internal */
  protected readonly isLoadingMore = injectAuiState((s) => s.threads.isLoadingMore);
  /** @internal */
  protected readonly hasMore = injectAuiState((s) => s.threads.hasMore);
  /** @internal */
  protected readonly archivedIds = injectAuiState((s) => s.threads.archivedThreadIds);
  private readonly threadItems = injectAuiState((s) => s.threads.threadItems);
  /** @internal */
  protected readonly archivedOpen = signal(false);

  /** @internal The query applies only while there are threads, as upstream. */
  protected readonly search = computed(() => (this.hasThreads() ? this.searchText() : ''));
  /** @internal */
  protected readonly query = computed(() => this.search().trim());
  /** @internal */
  protected readonly list = injectThreadListGroups(() => this.search());
  /** @internal The date groups; empty while the list is shown in runtime order. */
  protected readonly groups = computed(() => this.list().groups ?? []);
  /** @internal The archived threads matching the query, in runtime order. */
  protected readonly archivedIndices = computed(
    () =>
      groupThreadList(this.archivedIds(), this.threadItems(), this.searchText(), undefined)
        .filteredIndices,
  );
}
