// Ported from packages/ui/src/components/react/assistant-ui/elements/composer-trigger-popover.aui.tsx @ 7d74276
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  inject,
  input,
  isDevMode,
  type OnInit,
} from '@angular/core';
import {
  AuiComposerTriggerPopoverBackDirective,
  AuiComposerTriggerPopoverCategoriesDirective,
  AuiComposerTriggerPopoverCategoryItemDirective,
  AuiComposerTriggerPopoverDirective,
  AuiComposerTriggerPopoverItemDirective,
  AuiComposerTriggerPopoverItemsDirective,
} from 'angular-assistant-ui';
import type { AuiIconName } from './icons/icon-shapes';
import { AuiIconComponent } from './icons/icon.component';

/**
 * The styled picker for a composer trigger (`@` mentions, `/` commands, …):
 * the categories (each drills into its items), the items with an icon,
 * label and description, a Back button, and empty and loading labels. It
 * carries `[auiComposerTriggerPopover]` itself, so it takes that directive's
 * inputs (`char`, `adapter` or `items`, `matcher`, `isLoading`, `directive`
 * or `action`, `aria-label`) and is hidden (inline `display: none`) while the
 * trigger is inactive. Pass exactly one of `directive` (insert a chip) or
 * `action` (run a handler); a dev-mode warning flags anything else.
 *
 * Place it inside `[auiComposerTriggerPopoverRoot]`, next to the composer
 * whose textarea has `[auiComposerTriggerPopoverInput]`. It is absolutely
 * positioned above its containing block (give that `position: relative`).
 * Icons come from `iconMap`: items look up `item.metadata.icon`, categories
 * their `id`; anything unmapped shows `fallbackIcon`.
 *
 * @example
 * ```html
 * <div auiComposerTriggerPopoverRoot style="position: relative">
 *   <aui-composer-trigger-popover-styled char="@" [adapter]="mention.adapter" [directive]="mention.directive" />
 *   <form auiComposerRoot><textarea auiComposerInput auiComposerTriggerPopoverInput></textarea></form>
 * </div>
 * ```
 */
@Component({
  selector: 'aui-composer-trigger-popover-styled',
  standalone: true,
  imports: [
    AuiIconComponent,
    AuiComposerTriggerPopoverCategoriesDirective,
    AuiComposerTriggerPopoverCategoryItemDirective,
    AuiComposerTriggerPopoverItemsDirective,
    AuiComposerTriggerPopoverItemDirective,
    AuiComposerTriggerPopoverBackDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: AuiComposerTriggerPopoverDirective,
      inputs: [
        'char',
        'matcher',
        'adapter',
        'items',
        'isLoading',
        'directive',
        'action',
        'aria-label',
      ],
    },
  ],
  host: {
    class: 'aui-root aui-composer-trigger-popover',
    'data-slot': 'composer-trigger-popover',
  },
  template: `<div
      auiComposerTriggerPopoverCategories
      #categories="auiComposerTriggerPopoverCategories"
      class="aui-composer-trigger-popover-categories"
      data-slot="composer-trigger-popover-categories"
    >
      @for (category of categories.categories(); track category.id) {
        <button
          auiComposerTriggerPopoverCategoryItem
          [categoryId]="category.id"
          class="aui-composer-trigger-popover-category"
          data-slot="composer-trigger-popover-category"
        >
          <span class="aui-composer-trigger-popover-category-label">
            <aui-icon
              [name]="icon(category.id)"
              [attr.data-icon]="icon(category.id)"
              class="aui-composer-trigger-popover-icon"
            />
            {{ category.label }}
          </span>
          <aui-icon
            name="chevron-right"
            data-icon="chevron-right"
            class="aui-composer-trigger-popover-icon"
          />
        </button>
      } @empty {
        <div class="aui-composer-trigger-popover-empty" data-slot="composer-trigger-popover-empty">
          {{ emptyCategoriesLabel() }}
        </div>
      }
    </div>
    <div
      auiComposerTriggerPopoverItems
      #items="auiComposerTriggerPopoverItems"
      class="aui-composer-trigger-popover-items"
      data-slot="composer-trigger-popover-items"
    >
      <button
        auiComposerTriggerPopoverBack
        class="aui-composer-trigger-popover-back"
        data-slot="composer-trigger-popover-back"
      >
        <aui-icon name="chevron-left" />{{ backLabel() }}
      </button>
      <div class="aui-composer-trigger-popover-item-list">
        @for (item of items.items(); track item.id; let index = $index) {
          <button
            auiComposerTriggerPopoverItem
            [item]="item"
            [index]="index"
            class="aui-composer-trigger-popover-item"
            data-slot="composer-trigger-popover-item"
          >
            <span class="aui-composer-trigger-popover-item-label">
              <aui-icon
                [name]="itemIcon(item.metadata)"
                [attr.data-icon]="itemIcon(item.metadata)"
                class="aui-composer-trigger-popover-item-icon"
              />
              {{ item.label }}
            </span>
            @if (item.description) {
              <span class="aui-composer-trigger-popover-item-description">{{
                item.description
              }}</span>
            }
          </button>
        } @empty {
          <div
            class="aui-composer-trigger-popover-empty"
            data-slot="composer-trigger-popover-empty"
          >
            {{ popover.isLoading() ? loadingLabel() : emptyItemsLabel() }}
          </div>
        }
      </div>
    </div>`,
})
export class AuiComposerTriggerPopoverStyledComponent implements OnInit {
  /** Icon names by key: `item.metadata.icon` for items, `id` for categories. */
  readonly iconMap = input<Readonly<Record<string, AuiIconName>> | undefined>(undefined);
  /** The icon used when `iconMap` has no entry. */
  readonly fallbackIcon = input<AuiIconName>('sparkles');
  /** Label of the back button. */
  readonly backLabel = input('Back');
  /** Shown when there are no categories. */
  readonly emptyCategoriesLabel = input('No items available');
  /** Shown when no items match. */
  readonly emptyItemsLabel = input('No matching items');
  /** Shown instead of the empty label while `isLoading` is set. */
  readonly loadingLabel = input('Loading…');

  /** @internal */
  protected readonly popover = inject(AuiComposerTriggerPopoverDirective);

  /** @internal */
  ngOnInit(): void {
    if (isDevMode() && Boolean(this.popover.directive()) === Boolean(this.popover.action())) {
      console.warn(
        '[assistant-ui] ComposerTriggerPopover requires exactly one of `directive` or `action` props.',
      );
    }
  }

  /** @internal */
  protected icon(key: string | undefined): AuiIconName {
    const mapped = key ? this.iconMap()?.[key] : undefined;
    return mapped ?? this.fallbackIcon();
  }

  /** @internal */
  protected itemIcon(metadata: Readonly<Record<string, unknown>> | undefined): AuiIconName {
    const key = metadata?.['icon'];
    return this.icon(typeof key === 'string' ? key : undefined);
  }
}
