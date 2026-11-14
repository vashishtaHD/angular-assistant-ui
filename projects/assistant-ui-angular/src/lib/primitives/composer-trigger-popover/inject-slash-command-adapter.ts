// Ported from packages/react/src/unstable/useSlashCommandAdapter.ts @ 7d74276
import { assertInInjectionContext, computed, type Signal } from '@angular/core';
import type { TriggerAdapter, TriggerItem } from '@assistant-ui/core';
import type { Unstable_IconComponent } from './inject-mention-adapter';
import { matchesTriggerItemQuery } from './trigger-contracts';

/** @deprecated Experimental since 2026-04-15. Not scheduled for removal; the API may change in any release. */
export interface Unstable_SlashCommand {
  readonly id: string;
  readonly label?: string | undefined;
  readonly description?: string | undefined;
  readonly icon?: string | undefined;
  readonly execute: () => void;
}

/** @deprecated Experimental since 2026-04-06. Not scheduled for removal; the API may change in any release. */
export interface Unstable_UseSlashCommandAdapterOptions {
  readonly commands: readonly Unstable_SlashCommand[];
  /** Strip the trigger text from the composer after executing. @default false */
  readonly removeOnExecute?: boolean | undefined;
  /** Maps `metadata.icon` / `category.id` string keys to components. */
  readonly iconMap?: Record<string, Unstable_IconComponent>;
  /** Fallback icon when no entry in `iconMap` matches. */
  readonly fallbackIcon?: Unstable_IconComponent;
}

/** @deprecated Experimental since 2026-04-15. Not scheduled for removal; the API may change in any release. */
export interface Unstable_SlashCommandAction {
  readonly onExecute: (item: TriggerItem) => void;
  readonly removeOnExecute?: boolean | undefined;
}

/** The bundle returned by {@link injectSlashCommandAdapter}. */
export interface SlashCommandAdapterBundle {
  /** Bind to `[adapter]` of `[auiComposerTriggerPopover]`. */
  readonly adapter: Signal<TriggerAdapter>;
  /** Bind to `[action]` of `[auiComposerTriggerPopover]`. */
  readonly action: Signal<Unstable_SlashCommandAction>;
  readonly iconMap?: Record<string, Unstable_IconComponent>;
  readonly fallbackIcon?: Unstable_IconComponent;
}

/**
 * Bundles slash command definitions (with inline `execute` callbacks) into an
 * `{ adapter, action }` pair for `[auiComposerTriggerPopover]`. `execute` stays
 * in the closure and is never attached to the `TriggerItem`, keeping items
 * serializable. The options may be a plain object or a function returning one.
 *
 * Must be called in an injection context. React name:
 * `unstable_useSlashCommandAdapter`.
 *
 * @deprecated Experimental since 2026-04-06. Not scheduled for removal; the API may change in any release.
 *
 * @example
 * ```ts
 * readonly slash = injectSlashCommandAdapter({
 *   commands: [{ id: 'summarize', execute: () => this.summarize() }],
 * });
 * ```
 * ```html
 * <div auiComposerTriggerPopover char="/" [adapter]="slash.adapter()" [action]="slash.action()">…</div>
 * ```
 */
export function injectSlashCommandAdapter(
  options: Unstable_UseSlashCommandAdapterOptions | (() => Unstable_UseSlashCommandAdapterOptions),
): SlashCommandAdapterBundle {
  assertInInjectionContext(injectSlashCommandAdapter);
  const resolve = () => (typeof options === 'function' ? options() : options);

  // Structurally equal command lists keep the same items (and so the same adapter).
  const items = computed<readonly TriggerItem[]>(() => resolve().commands.map(toItem), {
    equal: areTriggerItemsEqual,
  });

  const adapter = computed<TriggerAdapter>(() => {
    const current = items();
    return {
      categories: () => [],
      categoryItems: () => [],
      search: (query: string) => {
        const lower = query.toLowerCase();
        return current.filter((item) => matchesTriggerItemQuery(item, lower));
      },
    };
  });

  const removeOnExecute = computed(() => resolve().removeOnExecute);
  const action = computed<Unstable_SlashCommandAction>(() => {
    const remove = removeOnExecute();
    return {
      // Commands are read at execution time so the latest `execute` callbacks run.
      onExecute: (item) => {
        resolve()
          .commands.find((c) => c.id === item.id)
          ?.execute();
      },
      ...(remove !== undefined ? { removeOnExecute: remove } : {}),
    };
  });

  const o = resolve();
  return {
    adapter,
    action,
    ...(o.iconMap ? { iconMap: o.iconMap } : {}),
    ...(o.fallbackIcon ? { fallbackIcon: o.fallbackIcon } : {}),
  };
}

function toItem(cmd: Unstable_SlashCommand): TriggerItem {
  return {
    id: cmd.id,
    type: 'command',
    label: cmd.label ?? `/${cmd.id}`,
    ...(cmd.description !== undefined ? { description: cmd.description } : {}),
    ...(cmd.icon !== undefined ? { metadata: { icon: cmd.icon } } : {}),
  };
}

function areTriggerItemsEqual(
  previous: readonly TriggerItem[],
  next: readonly TriggerItem[],
): boolean {
  if (previous.length !== next.length) return false;
  return previous.every((item, index) => {
    const nextItem = next[index];
    return (
      nextItem !== undefined &&
      item.id === nextItem.id &&
      item.label === nextItem.label &&
      item.description === nextItem.description &&
      item.metadata?.['icon'] === nextItem.metadata?.['icon']
    );
  });
}
