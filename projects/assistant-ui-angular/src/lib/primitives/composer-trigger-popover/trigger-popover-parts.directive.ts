// Ported from packages/react/src/primitives/composer/trigger/{TriggerPopoverCategories,TriggerPopoverItems,TriggerPopoverBack}.tsx @ 7d74276
import { Directive, computed, input } from '@angular/core';
import type { TriggerCategory, TriggerItem } from '@assistant-ui/core';
import { injectTriggerPopoverScopeContext } from './trigger-popover.directive';

/**
 * The top-level category group (`role="group"`). Hidden unless the popover is
 * open, no category is drilled into and the list is not search results. Render
 * the entries from `categories()` (also on the popover) with
 * `[auiComposerTriggerPopoverCategoryItem]`.
 */
@Directive({
  selector: '[auiComposerTriggerPopoverCategories]',
  standalone: true,
  exportAs: 'auiComposerTriggerPopoverCategories',
  host: {
    role: 'group',
    '[attr.aria-label]': 'ariaLabel()',
    '[hidden]': '!visible()',
    '[style.display]': 'visible() ? null : "none"',
  },
})
export class AuiComposerTriggerPopoverCategoriesDirective {
  private readonly popover = injectTriggerPopoverScopeContext();

  /** Accessible name of the group. */
  readonly ariaLabel = input('Categories', { alias: 'aria-label' });

  /** Whether the category list applies right now. */
  readonly visible = computed(
    () => this.popover.open() && !this.popover.activeCategoryId() && !this.popover.isSearchMode(),
  );
  /** The categories to render. */
  readonly categories = computed<readonly TriggerCategory[]>(() => this.popover.categories());
}

/**
 * A button that drills into a category. Receives `data-highlighted` while it is
 * the keyboard-highlighted entry.
 */
@Directive({
  selector: 'button[auiComposerTriggerPopoverCategoryItem]',
  standalone: true,
  host: {
    type: 'button',
    role: 'option',
    '[id]': 'popover.optionId(categoryId())',
    '[attr.aria-selected]': 'highlighted()',
    '[attr.data-highlighted]': 'highlighted() ? "" : null',
    '(click)': 'popover.selectCategory(categoryId())',
    '(mousemove)': 'popover.highlightIndex(index())',
  },
})
export class AuiComposerTriggerPopoverCategoryItemDirective {
  /** @internal */
  protected readonly popover = injectTriggerPopoverScopeContext();

  /** The id of the category this button selects. */
  readonly categoryId = input.required<string>();

  /** @internal */
  protected readonly index = computed(() =>
    this.popover.categories().findIndex((c) => c.id === this.categoryId()),
  );
  /** @internal */
  protected readonly highlighted = computed(
    () =>
      !this.popover.activeCategoryId() &&
      !this.popover.isSearchMode() &&
      this.index() === this.popover.highlightedIndex(),
  );
}

/**
 * The item group (`role="group"`). Hidden unless the popover is open and either
 * a category is drilled into or the list is search results. Render the entries
 * from `items()` with `[auiComposerTriggerPopoverItem]`.
 */
@Directive({
  selector: '[auiComposerTriggerPopoverItems]',
  standalone: true,
  exportAs: 'auiComposerTriggerPopoverItems',
  host: {
    role: 'group',
    '[attr.aria-label]': 'ariaLabel()',
    '[hidden]': '!visible()',
    '[style.display]': 'visible() ? null : "none"',
  },
})
export class AuiComposerTriggerPopoverItemsDirective {
  private readonly popover = injectTriggerPopoverScopeContext();

  /** Accessible name of the group. */
  readonly ariaLabel = input('Items', { alias: 'aria-label' });

  /** Whether the item list applies right now. */
  readonly visible = computed(
    () => this.popover.open() && (!!this.popover.activeCategoryId() || this.popover.isSearchMode()),
  );
  /** The items to render. */
  readonly items = computed<readonly TriggerItem[]>(() => this.popover.itemList());
}

/**
 * A button that selects a trigger item. Receives `data-highlighted` while it is
 * the keyboard-highlighted entry.
 */
@Directive({
  selector: 'button[auiComposerTriggerPopoverItem]',
  standalone: true,
  host: {
    type: 'button',
    role: 'option',
    '[id]': 'popover.optionId(item().id)',
    '[attr.aria-selected]': 'highlighted()',
    '[attr.data-highlighted]': 'highlighted() ? "" : null',
    '(click)': 'popover.select(item())',
    '(mousemove)': 'popover.highlightIndex(resolvedIndex())',
  },
})
export class AuiComposerTriggerPopoverItemDirective {
  /** @internal */
  protected readonly popover = injectTriggerPopoverScopeContext();

  /** The item this button selects. */
  readonly item = input.required<TriggerItem>();
  /** Position in the list; looked up by id when omitted. */
  readonly index = input<number | undefined>(undefined);

  /** @internal */
  protected readonly resolvedIndex = computed(
    () => this.index() ?? this.popover.itemList().findIndex((i) => i.id === this.item().id),
  );
  /** @internal */
  protected readonly highlighted = computed(
    () =>
      (this.popover.isSearchMode() || this.popover.activeCategoryId() !== null) &&
      this.resolvedIndex() === this.popover.highlightedIndex(),
  );
}

/**
 * A button that navigates from a category's items back to the category list.
 * Hidden unless a category is drilled into.
 */
@Directive({
  selector: 'button[auiComposerTriggerPopoverBack]',
  standalone: true,
  host: {
    type: 'button',
    '[hidden]': '!visible()',
    '[style.display]': 'visible() ? null : "none"',
    '(click)': 'popover.goBack()',
  },
})
export class AuiComposerTriggerPopoverBackDirective {
  /** @internal */
  protected readonly popover = injectTriggerPopoverScopeContext();

  /** @internal */
  protected readonly visible = computed(
    () => this.popover.open() && !!this.popover.activeCategoryId() && !this.popover.isSearchMode(),
  );
}

/** Deprecated aliases (the React `Unstable_` names), exported under the same Angular names. */
export {
  AuiComposerTriggerPopoverBackDirective as AuiUnstableComposerTriggerPopoverBackDirective,
  AuiComposerTriggerPopoverCategoriesDirective as AuiUnstableComposerTriggerPopoverCategoriesDirective,
  AuiComposerTriggerPopoverCategoryItemDirective as AuiUnstableComposerTriggerPopoverCategoryItemDirective,
  AuiComposerTriggerPopoverItemDirective as AuiUnstableComposerTriggerPopoverItemDirective,
  AuiComposerTriggerPopoverItemsDirective as AuiUnstableComposerTriggerPopoverItemsDirective,
};
