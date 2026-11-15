// Ported from packages/react/src/unstable/useMentionAdapter.ts @ 7d74276
import { assertInInjectionContext, computed, signal, type Signal, type Type } from '@angular/core';
import {
  defaultDirectiveFormatter,
  type DirectiveFormatter,
  type TriggerAdapter,
  type TriggerCategory,
  type TriggerItem,
} from '@assistant-ui/core';
import { injectAui } from '../../state/inject-aui';
import { injectAuiEvent } from '../../state/inject-aui-event';
import { matchesTriggerItemQuery } from './trigger-contracts';
import type { TriggerDirectiveConfig } from './trigger-popover.directive';

/**
 * Icon component consumed by styled popovers' `iconMap`.
 *
 * @deprecated Experimental since 2026-04-15. Not scheduled for removal; the API may change in any release.
 */
export type Unstable_IconComponent = Type<unknown>;

/** @deprecated Experimental since 2026-04-15. Not scheduled for removal; the API may change in any release. */
export interface Unstable_Mention {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly description?: string | undefined;
  /** Shortcut for `metadata.icon`; merged with `metadata` if both are given. */
  readonly icon?: string | undefined;
  readonly metadata?: TriggerItem['metadata'];
}

/** @deprecated Experimental since 2026-03-16. Not scheduled for removal; the API may change in any release. */
export interface Unstable_MentionCategory {
  readonly id: string;
  readonly label: string;
  readonly items: readonly Unstable_Mention[];
}

/** @deprecated Experimental since 2026-04-15. Not scheduled for removal; the API may change in any release. */
export interface Unstable_ModelContextToolsOptions {
  /**
   * Wrap tools in a dedicated category. Selects drill-down mode on its own
   * when `categories` is unset and `items` is omitted.
   */
  readonly category?: { readonly id: string; readonly label: string };
  /** Format tool name for display. */
  readonly formatLabel?: (toolName: string) => string;
  /** Default icon key for each tool. */
  readonly icon?: string;
}

/** @deprecated Experimental since 2026-04-15. Not scheduled for removal; the API may change in any release. */
export interface Unstable_UseMentionAdapterOptions {
  /**
   * Flat mention list. Ignored when `categories` is set, and keeps the
   * adapter flat when a tool `category` is configured.
   */
  readonly items?: readonly Unstable_Mention[];
  /** Categorized mentions for drill-down navigation. */
  readonly categories?: readonly Unstable_MentionCategory[];
  /**
   * How tools registered in model context integrate: `false` excludes them,
   * `true` includes them (the default when there are no `items`/`categories`),
   * an object configures them (and `category` also selects drill-down mode).
   */
  readonly includeModelContextTools?: boolean | Unstable_ModelContextToolsOptions;
  /** Directive formatter. @default defaultDirectiveFormatter */
  readonly formatter?: DirectiveFormatter;
  /** Fires after an item is inserted into the composer. */
  readonly onInserted?: (item: TriggerItem) => void;
  /** Maps `metadata.icon` / `category.id` string keys to components. */
  readonly iconMap?: Record<string, Unstable_IconComponent>;
  /** Fallback icon when no entry in `iconMap` matches. */
  readonly fallbackIcon?: Unstable_IconComponent;
}

/** @deprecated Experimental since 2026-04-15. Not scheduled for removal; the API may change in any release. */
export type Unstable_MentionDirective = TriggerDirectiveConfig & {
  readonly formatter: DirectiveFormatter;
};

/** The bundle returned by {@link injectMentionAdapter}. */
export interface MentionAdapterBundle {
  /** Bind to `[adapter]` of `[auiComposerTriggerPopover]`. */
  readonly adapter: Signal<TriggerAdapter>;
  /** Bind to `[directive]` of `[auiComposerTriggerPopover]`. */
  readonly directive: Signal<Unstable_MentionDirective>;
  readonly iconMap?: Record<string, Unstable_IconComponent>;
  readonly fallbackIcon?: Unstable_IconComponent;
}

type ToolDescriptions = Readonly<Record<string, string | undefined>>;
const EMPTY_TOOL_MENTIONS: ToolDescriptions = Object.freeze({});

function shallowEqualRecords(a: ToolDescriptions, b: ToolDescriptions): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((key) => key in b && a[key] === b[key]);
}

/**
 * Creates the `{ adapter, directive }` bundle for `@` mentions. Supports tools
 * registered in model context, explicit items, or both, flat or categorized.
 * The options may be a plain object or a function returning one (read inside
 * computed signals, so it can depend on signals). `iconMap` and `fallbackIcon` are
 * read once, when the bundle is created.
 *
 * Must be called in an injection context inside an `[auiProvider]`. React name:
 * `unstable_useMentionAdapter`.
 *
 * @deprecated Experimental since 2026-04-15. Not scheduled for removal; the API may change in any release.
 *
 * @example
 * ```ts
 * readonly mention = injectMentionAdapter({ items: people });
 * ```
 * ```html
 * <div auiComposerTriggerPopover char="@"
 *      [adapter]="mention.adapter()" [directive]="mention.directive()">…</div>
 * ```
 */
export function injectMentionAdapter(
  options?:
    Unstable_UseMentionAdapterOptions | (() => Unstable_UseMentionAdapterOptions | undefined),
): MentionAdapterBundle {
  assertInInjectionContext(injectMentionAdapter);
  const aui = injectAui();
  const resolve = () => (typeof options === 'function' ? options() : options);

  const wantsTools = computed(() => {
    const o = resolve();
    return (o?.includeModelContextTools ?? (!o?.items && !o?.categories)) !== false;
  });

  // Model context lives in a provider, not in state: re-read it on its update event and
  // when a thread switch may have swapped providers.
  const version = signal(0);
  const bump = () => version.update((v) => v + 1);
  injectAuiEvent('thread.modelContextUpdate', bump);
  injectAuiEvent({ scope: '*', event: 'threads.selectionChanged' }, bump);

  const toolMentions = computed<ToolDescriptions>(
    () => {
      version();
      if (!wantsTools()) return EMPTY_TOOL_MENTIONS;
      // Only a missing thread scope means "no tools"; errors from providers propagate.
      if (aui.thread.source === null) return EMPTY_TOOL_MENTIONS;
      const tools = aui.thread.getModelContext().tools;
      if (!tools) return EMPTY_TOOL_MENTIONS;
      const mentions = Object.create(null) as Record<string, string | undefined>;
      for (const [name, tool] of Object.entries(tools)) mentions[name] = tool.description;
      return mentions;
    },
    { equal: shallowEqualRecords },
  );

  const adapter = computed<TriggerAdapter>(() => {
    const o = resolve();
    const items = o?.items;
    const categories = o?.categories;
    const includeTools = o?.includeModelContextTools ?? (!items && !categories);
    const toolsConfig = typeof includeTools === 'object' ? includeTools : undefined;
    const isCategorized =
      categories !== undefined || (toolsConfig?.category !== undefined && items === undefined);

    const toolItems = wantsTools()
      ? Object.entries(toolMentions()).map(([name, description]) =>
          toTriggerItem({
            id: name,
            type: 'tool',
            label: toolsConfig?.formatLabel ? toolsConfig.formatLabel(name) : name,
            description,
            icon: toolsConfig?.icon,
          }),
        )
      : [];

    // Categorized: drill-down mode.
    if (isCategorized) {
      const groups = (categories ?? []).map((cat) => ({
        id: cat.id,
        label: cat.label,
        items: cat.items.map(toTriggerItem),
      }));
      const allGroups =
        toolItems.length > 0
          ? [
              ...groups,
              {
                id: toolsConfig?.category?.id ?? 'tools',
                label: toolsConfig?.category?.label ?? 'Tools',
                items: toolItems,
              },
            ]
          : groups;

      return {
        categories: (): readonly TriggerCategory[] =>
          allGroups.map(({ id, label }) => ({ id, label })),
        categoryItems: (id) => allGroups.find((g) => g.id === id)?.items ?? [],
        search: (query) => {
          const lower = query.toLowerCase();
          return allGroups
            .flatMap((g) => g.items)
            .filter((item) => matchesTriggerItemQuery(item, lower));
        },
      };
    }

    // Flat: items + (optionally) tools, all in one search pool.
    const flatItems = (items ?? []).map(toTriggerItem);
    // Dedupe by id: explicit items win.
    const seen = new Set(flatItems.map((i) => i.id));
    const flatPool = [...flatItems, ...toolItems.filter((t) => !seen.has(t.id))];

    return {
      categories: (): readonly TriggerCategory[] => [],
      categoryItems: () => [],
      search: (query) => {
        const lower = query.toLowerCase();
        return flatPool.filter((item) => matchesTriggerItemQuery(item, lower));
      },
    };
  });

  const directive = computed<Unstable_MentionDirective>(() => {
    const o = resolve();
    return {
      formatter: o?.formatter ?? defaultDirectiveFormatter,
      ...(o?.onInserted ? { onInserted: o.onInserted } : {}),
    };
  });

  const o = resolve();
  return {
    adapter,
    directive,
    ...(o?.iconMap ? { iconMap: o.iconMap } : {}),
    ...(o?.fallbackIcon ? { fallbackIcon: o.fallbackIcon } : {}),
  };
}

function toTriggerItem(m: Unstable_Mention): TriggerItem {
  const metadata = m.icon !== undefined ? { ...(m.metadata ?? {}), icon: m.icon } : m.metadata;
  return {
    id: m.id,
    type: m.type,
    label: m.label,
    ...(m.description !== undefined ? { description: m.description } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  };
}
