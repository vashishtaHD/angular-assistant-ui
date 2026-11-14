// Ported from packages/react/src/primitives/composer/trigger/{TriggerPopover,TriggerPopoverResource,triggerNavigationResource,triggerKeyboardResource,triggerSelectionResource,TriggerPopoverAction,TriggerPopoverDirective}.tsx @ 7d74276
import {
  DestroyRef,
  Directive,
  booleanAttribute,
  computed,
  inject,
  input,
  signal,
  type OnChanges,
  type OnInit,
  type Signal,
} from '@angular/core';
import {
  defaultDirectiveFormatter,
  type DirectiveFormatter,
  type TriggerAdapter,
  type TriggerCategory,
  type TriggerItem,
} from '@assistant-ui/core';
import { injectAui } from '../../state/inject-aui';
import { injectAuiState } from '../../state/inject-aui-state';
import {
  detectTrigger,
  matchesTriggerItemQuery,
  type TriggerBehavior,
  type TriggerMatch,
  type TriggerMatcher,
} from './trigger-contracts';
import {
  injectTriggerPopoverRootContext,
  type ComposerInputPlugin,
} from './trigger-popover-root.directive';

let nextPopoverId = 0;

/** `directive` behavior: insert a directive token into the composer on select. */
export interface TriggerDirectiveConfig {
  /** Defaults to `defaultDirectiveFormatter`. */
  readonly formatter?: DirectiveFormatter | undefined;
  /** Fires after an item has been inserted into the composer. */
  readonly onInserted?: ((item: TriggerItem) => void) | undefined;
}

/** `action` behavior: run a handler on select, optionally leaving the token behind. */
export interface TriggerActionConfig {
  /** Defaults to `defaultDirectiveFormatter`. */
  readonly formatter?: DirectiveFormatter | undefined;
  /** Fires the moment an item is selected; runs regardless of `removeOnExecute`. */
  readonly onExecute: (item: TriggerItem) => void;
  /** Strip the trigger text after executing. Defaults to `false` (keeps the token as an audit trail). */
  readonly removeOnExecute?: boolean | undefined;
}

/** A category or an item: one entry of the keyboard-navigable list. */
export type TriggerNavigableEntry = TriggerCategory | TriggerItem;

/** Relies on `TriggerCategory` never carrying a `type` field. */
function isTriggerItem(x: TriggerNavigableEntry): x is TriggerItem {
  return 'type' in x;
}

function flatAdapter(items: readonly TriggerItem[]): TriggerAdapter {
  return {
    categories: () => [],
    categoryItems: () => [],
    search: (query) => {
      const lower = query.toLowerCase();
      return items.filter((item) => matchesTriggerItemQuery(item, lower));
    },
  };
}

/**
 * Declares one trigger (`@`, `/`, ...) and renders its popover container. The
 * container is `role="listbox"` and is hidden unless the trigger character is
 * active at the caret in the composer text. It exposes (as signals) the query,
 * the categories and items, the highlighted index and `select(item)`.
 *
 * Items come from `adapter` (a {@link TriggerAdapter}) or from the flat `items`
 * shortcut. What selecting does is configured by `directive` (insert a token
 * into the composer via `composer.setText`, the default) or `action` (run a
 * handler). Put `[auiComposerTriggerPopoverInput]` on the composer textarea to
 * feed it keys and the caret position.
 *
 * Must be inside `[auiComposerTriggerPopoverRoot]`.
 *
 * @example
 * ```html
 * <div auiComposerTriggerPopover #popover="auiComposerTriggerPopover"
 *      char="@" [items]="people">
 *   @for (item of popover.items(); track item.id) {
 *     <button auiComposerTriggerPopoverItem [item]="item">{{ item.label }}</button>
 *   }
 * </div>
 * ```
 */
@Directive({
  selector: '[auiComposerTriggerPopover]',
  standalone: true,
  exportAs: 'auiComposerTriggerPopover',
  host: {
    role: 'listbox',
    '[id]': 'popoverId',
    '[hidden]': '!open()',
    '[attr.aria-label]': 'ariaLabel()',
    '[attr.aria-activedescendant]': 'highlightedItemId() ?? null',
    '[attr.data-state]': 'open() ? "open" : "closed"',
  },
})
export class AuiComposerTriggerPopoverDirective implements OnInit, OnChanges {
  private readonly aui = injectAui();
  private readonly root = injectTriggerPopoverRootContext();
  private readonly destroyRef = inject(DestroyRef);

  /** The character(s) that activate this trigger (for example `@`, `/`). Unique within the root. */
  readonly char = input.required<string>();
  /** Overrides trigger detection. `endOffset` is the exclusive replace bound. */
  readonly matcher = input<TriggerMatcher | undefined>(undefined);
  /** Adapter providing categories and items. */
  readonly adapter = input<TriggerAdapter | undefined>(undefined);
  /** Flat item list shortcut, used when no `adapter` is given. */
  readonly items = input<readonly TriggerItem[] | undefined>(undefined);
  /** Whether the adapter is resolving items (async sources), surfaced as `isLoading()`. */
  readonly isLoading = input(false, { transform: booleanAttribute });
  /** Directive behavior (the default when neither `directive` nor `action` is set). */
  readonly directive = input<TriggerDirectiveConfig | undefined>(undefined);
  /** Action behavior; takes precedence over `directive`. */
  readonly action = input<TriggerActionConfig | undefined>(undefined);
  /** Accessible name of the listbox. */
  readonly ariaLabel = input('Suggestions', { alias: 'aria-label' });

  /** Stable id prefix for the listbox and its options. */
  readonly popoverId = `aui-trigger-popover-${++nextPopoverId}`;

  private readonly text = injectAuiState((s) => s.optional.composer?.text ?? '');
  private readonly cursor = signal<number | null>(null);
  private readonly activeCategory = signal<{ id: string; offset: number } | null>(null);
  private readonly highlight = signal<{
    list: readonly TriggerNavigableEntry[];
    index: number;
  } | null>(null);

  private readonly effectiveAdapter = computed<TriggerAdapter | undefined>(() => {
    const adapter = this.adapter();
    if (adapter) return adapter;
    const items = this.items();
    return items ? flatAdapter(items) : undefined;
  });

  /** The resolved selection behavior. */
  readonly behavior: Signal<TriggerBehavior> = computed(() => {
    const action = this.action();
    if (action) {
      return {
        kind: 'action',
        formatter: action.formatter ?? defaultDirectiveFormatter,
        onExecute: action.onExecute,
        ...(action.removeOnExecute !== undefined
          ? { removeOnExecute: action.removeOnExecute }
          : {}),
      };
    }
    const directive = this.directive();
    return {
      kind: 'directive',
      formatter: directive?.formatter ?? defaultDirectiveFormatter,
      ...(directive?.onInserted ? { onInserted: directive.onInserted } : {}),
    };
  });

  /** The detected trigger span in the composer text, or `null` when inactive. */
  readonly trigger: Signal<TriggerMatch | null> = computed(() => {
    const text = this.text();
    const pos = Math.min(this.cursor() ?? text.length, text.length);
    return detectTrigger(text, this.char(), pos, this.matcher());
  });

  /** Whether the popover is open. */
  readonly open: Signal<boolean> = computed(
    () => this.trigger() !== null && this.effectiveAdapter() !== undefined,
  );

  /** The current query (empty when closed). */
  readonly query: Signal<string> = computed(() => this.trigger()?.query ?? '');

  private readonly topCategories = computed<readonly TriggerCategory[]>(() => {
    const adapter = this.effectiveAdapter();
    return this.open() && adapter ? adapter.categories() : [];
  });

  /** The drilled-into category id, or `null` at the top level. */
  readonly activeCategoryId: Signal<string | null> = computed(() => {
    const active = this.activeCategory();
    const trigger = this.trigger();
    // A category only survives while the same trigger occurrence stays open.
    return this.open() && active && trigger && active.offset === trigger.offset ? active.id : null;
  });

  private readonly categoryItems = computed<readonly TriggerItem[]>(() => {
    const id = this.activeCategoryId();
    const adapter = this.effectiveAdapter();
    return id && adapter ? adapter.categoryItems(id) : [];
  });

  private readonly searchResults = computed<readonly TriggerItem[] | null>(() => {
    const adapter = this.effectiveAdapter();
    if (!this.open() || !adapter || this.activeCategoryId()) return null;
    const query = this.query();
    const categories = this.topCategories();
    // With categories and an empty query, show the categories first (not a search).
    if (!query && categories.length > 0) return null;
    if (adapter.search) return adapter.search(query);

    const all: TriggerItem[] = [];
    const lower = query.toLowerCase();
    for (const cat of categories) {
      for (const item of adapter.categoryItems(cat.id)) {
        if (matchesTriggerItemQuery(item, lower)) all.push(item);
      }
    }
    return all;
  });

  /** `true` when the list is search results rather than categories. */
  readonly isSearchMode: Signal<boolean> = computed(() => this.searchResults() !== null);

  /** Filtered categories (empty in search mode). */
  readonly categories: Signal<readonly TriggerCategory[]> = computed(() => {
    if (this.isSearchMode()) return [];
    const query = this.query();
    const categories = this.topCategories();
    if (!query) return categories;
    const lower = query.toLowerCase();
    return categories.filter((cat) => cat.label.toLowerCase().includes(lower));
  });

  /** Filtered items of the active category, or the search results. */
  readonly itemList: Signal<readonly TriggerItem[]> = computed(() => {
    const results = this.searchResults();
    if (results) return results;
    const all = this.categoryItems();
    const query = this.query();
    if (!query) return all;
    const lower = query.toLowerCase();
    return all.filter((item) => matchesTriggerItemQuery(item, lower));
  });

  /** The flat list the keyboard moves through (categories or items). */
  readonly navigableList: Signal<readonly TriggerNavigableEntry[]> = computed(() => {
    if (this.isSearchMode()) return this.searchResults() ?? [];
    if (this.activeCategoryId()) return this.itemList();
    return this.categories();
  });

  /** Index of the highlighted entry within {@link navigableList}. */
  readonly highlightedIndex: Signal<number> = computed(() => {
    const h = this.highlight();
    const list = this.navigableList();
    // The highlight resets whenever the list identity changes.
    return h && h.list === list ? h.index : 0;
  });

  /** Id of the highlighted option, for `aria-activedescendant`. */
  readonly highlightedItemId: Signal<string | undefined> = computed(() => {
    const entry = this.navigableList()[this.highlightedIndex()];
    return this.open() && entry ? this.optionId(entry.id) : undefined;
  });

  private readonly plugin: ComposerInputPlugin = {
    handleKeyDown: (e) => this.handleKeyDown(e),
    setCursorPosition: (pos) => this.setCursorPosition(pos),
  };

  /** @internal */
  ngOnInit(): void {
    const unregisterPlugin = this.root.registerPlugin(this.plugin);
    this.destroyRef.onDestroy(() => {
      unregisterPlugin();
      this.unregisterTrigger?.();
    });
    this.registerTrigger();
  }

  private unregisterTrigger: (() => void) | undefined;
  private registeredChar: string | undefined;
  private registeredHasMatcher = false;

  /** @internal */
  ngOnChanges(): void {
    // The first call precedes ngOnInit; registration happens there.
    if (this.registeredChar === undefined) return;
    this.registerTrigger();
  }

  private registerTrigger(): void {
    const char = this.char();
    const hasMatcher = this.matcher() !== undefined;
    if (char === this.registeredChar && hasMatcher === this.registeredHasMatcher) return;
    this.unregisterTrigger?.();
    this.registeredChar = char;
    this.registeredHasMatcher = hasMatcher;
    const getBehavior = () => this.behavior();
    const getMatcher = () => this.matcher();
    this.unregisterTrigger = this.root.register({
      char,
      // Read lazily so a changed matcher is honoured without re-registering.
      ...(hasMatcher
        ? { matcher: (text: string, c: string, pos: number) => getMatcher()!(text, c, pos) }
        : {}),
      get behavior() {
        return getBehavior();
      },
      resource: this,
    });
  }

  /** The DOM id of the option element for an item or category id. */
  optionId(id: string): string {
    return `${this.popoverId}-option-${id}`;
  }

  /** Updates the tracked caret position (wired by `[auiComposerTriggerPopoverInput]`). */
  setCursorPosition(pos: number): void {
    this.cursor.set(pos);
    if (!this.open()) this.activeCategory.set(null);
  }

  /** Drills into a category. */
  selectCategory(categoryId: string): void {
    const trigger = this.trigger();
    if (trigger) this.activeCategory.set({ id: categoryId, offset: trigger.offset });
    this.highlight.set(null);
  }

  /** Returns to the top-level category list. */
  goBack(): void {
    this.activeCategory.set(null);
    this.highlight.set(null);
  }

  /** Moves the highlight to an entry index (pointer hover). Out-of-range values are ignored. */
  highlightIndex(index: number): void {
    const list = this.navigableList();
    if (index < 0 || index >= list.length || index === this.highlightedIndex()) return;
    this.highlight.set({ list, index });
  }

  /**
   * Selects an item: inserts its directive token into the composer (or runs the
   * action handler), then returns to the top level.
   */
  select(item: TriggerItem): void {
    const trigger = this.trigger();
    if (!trigger) return;
    const behavior = this.behavior();
    const composer = this.aui.composer;
    const currentText = composer.getState().text;
    const before = currentText.slice(0, trigger.offset);
    const after = currentText.slice(trigger.endOffset);

    const insertDirective = () => {
      const directive = behavior.formatter.serialize(item);
      composer.setText(before + directive + (after.startsWith(' ') ? after : ` ${after}`), {
        origin: 'user',
      });
      this.cursor.set(before.length + directive.length + 1);
    };

    if (behavior.kind === 'directive') {
      insertDirective();
      behavior.onInserted?.(item);
    } else {
      if (behavior.removeOnExecute) {
        composer.setText(before + (after.startsWith(' ') ? after.slice(1) : after), {
          origin: 'user',
        });
        this.cursor.set(before.length);
      } else {
        // Leave the directive token in the composer as an audit trail.
        insertDirective();
      }
      behavior.onExecute(item);
    }
    this.activeCategory.set(null);
    this.highlight.set(null);
  }

  /**
   * Closes the popover by moving the caret before the trigger, which
   * deactivates detection.
   */
  close(): void {
    this.activeCategory.set(null);
    this.highlight.set(null);
    const trigger = this.trigger();
    if (trigger) this.cursor.set(trigger.offset);
  }

  /** Handles a key event; returns `true` when it was consumed. */
  handleKeyDown(e: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault'>): boolean {
    if (!this.open()) return false;
    const list = this.navigableList();
    const len = list.length;
    const index = this.highlightedIndex();

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (len > 0) this.highlight.set({ list, index: index < len - 1 ? index + 1 : 0 });
        return true;
      case 'ArrowUp':
        e.preventDefault();
        if (len > 0) this.highlight.set({ list, index: index > 0 ? index - 1 : len - 1 });
        return true;
      case 'Enter':
      case 'Tab': {
        if (e.shiftKey) return false;
        e.preventDefault();
        const entry = list[index];
        if (!entry) return true;
        if (isTriggerItem(entry)) this.select(entry);
        else this.selectCategory(entry.id);
        return true;
      }
      case 'Escape':
        e.preventDefault();
        this.close();
        return true;
      case 'Backspace':
        if (this.activeCategoryId() && this.query() === '') {
          e.preventDefault();
          this.goBack();
          return true;
        }
        return false;
      default:
        return false;
    }
  }
}

/**
 * Injects the enclosing `[auiComposerTriggerPopover]`.
 *
 * @throws When used outside one.
 */
export function injectTriggerPopoverScopeContext(): AuiComposerTriggerPopoverDirective {
  const popover = inject(AuiComposerTriggerPopoverDirective, { optional: true });
  if (!popover) {
    throw new Error(
      'injectTriggerPopoverScopeContext must be used within [auiComposerTriggerPopover]',
    );
  }
  return popover;
}

/** Like {@link injectTriggerPopoverScopeContext} but returns `null` outside a popover. */
export function injectTriggerPopoverScopeContextOptional(): AuiComposerTriggerPopoverDirective | null {
  return inject(AuiComposerTriggerPopoverDirective, { optional: true });
}
