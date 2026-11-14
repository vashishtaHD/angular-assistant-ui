// Ported from packages/react/src/primitives/composer/trigger/TriggerPopoverRootContext.tsx @ 7d74276
import { Directive, computed, inject, isDevMode, signal, type Signal } from '@angular/core';
import type { AuiComposerTriggerPopoverDirective } from './trigger-popover.directive';
import type { TriggerBehavior, TriggerMatcher } from './trigger-contracts';

/** One trigger declared by an `[auiComposerTriggerPopover]`. */
export interface RegisteredTrigger {
  readonly char: string;
  readonly matcher?: TriggerMatcher | undefined;
  readonly behavior?: TriggerBehavior;
  /** The live popover state (signals) of the trigger. */
  readonly resource: AuiComposerTriggerPopoverDirective;
}

/** @deprecated Use `RegisteredTrigger`. */
export type Unstable_RegisteredTrigger = RegisteredTrigger;

/** Notified when a trigger is added to or removed from the root. */
export interface TriggerPopoverLifecycleListener {
  added(trigger: RegisteredTrigger): void;
  removed(char: string): void;
}

/**
 * ARIA descriptor of the popover that is currently open, consumed by the focused
 * element (the composer textarea) to advertise the editable combobox pattern.
 */
export interface TriggerPopoverActiveAria {
  popoverId: string;
  highlightedItemId: string | undefined;
}

/** ARIA attributes the composer input receives while a popover is open. */
export interface TriggerPopoverAriaProps {
  'aria-controls'?: string;
  'aria-expanded'?: true;
  'aria-haspopup'?: 'listbox';
  'aria-activedescendant'?: string | undefined;
}

/** @deprecated Use `TriggerPopoverAriaProps`. */
export type Unstable_TriggerPopoverAriaProps = TriggerPopoverAriaProps;

/**
 * A plugin that intercepts keyboard events and cursor changes in the composer
 * input. Trigger popovers register one each; the input directive
 * `[auiComposerTriggerPopoverInput]` feeds them.
 */
export interface ComposerInputPlugin {
  /** Handle a key event. Return true if consumed. */
  handleKeyDown(e: KeyboardEvent): boolean;
  /** Called on every cursor position change. */
  setCursorPosition(pos: number): void;
}

/**
 * Groups one or more `[auiComposerTriggerPopover]` declarations and the
 * `textarea[auiComposerTriggerPopoverInput]` they serve. Each trigger is
 * identified by its `char`, unique within the root. It owns the trigger
 * registry, the key/cursor plugin list and the active ARIA descriptor.
 *
 * @example
 * ```html
 * <div auiComposerTriggerPopoverRoot>
 *   <div auiComposerTriggerPopover char="@" [adapter]="mention.adapter" [directive]="mention.directive">
 *     …
 *   </div>
 *   <form auiComposerRoot>
 *     <textarea auiComposerInput auiComposerTriggerPopoverInput></textarea>
 *   </form>
 * </div>
 * ```
 */
@Directive({
  selector: '[auiComposerTriggerPopoverRoot]',
  standalone: true,
  exportAs: 'auiComposerTriggerPopoverRoot',
})
export class AuiComposerTriggerPopoverRootDirective {
  private readonly triggerMap = signal<ReadonlyMap<string, RegisteredTrigger>>(new Map());
  private readonly lifecycle = new Set<TriggerPopoverLifecycleListener>();
  private plugins: { plugin: ComposerInputPlugin; priority: number }[] = [];

  /** Live map of registered triggers. */
  readonly triggers: Signal<ReadonlyMap<string, RegisteredTrigger>> = this.triggerMap.asReadonly();

  /** ARIA descriptor of the open popover, or null if none is open. */
  readonly activeAria: Signal<TriggerPopoverActiveAria | null> = computed(() => {
    for (const trigger of this.triggerMap().values()) {
      const popover = trigger.resource;
      if (popover.open()) {
        return {
          popoverId: popover.popoverId,
          highlightedItemId: popover.highlightedItemId(),
        };
      }
    }
    return null;
  });

  /**
   * Registers a trigger. A duplicate `char` is ignored with a dev warning.
   *
   * @returns A function that unregisters it.
   */
  register(trigger: RegisteredTrigger): () => void {
    const { char } = trigger;
    const current = this.triggerMap();
    if (current.has(char)) {
      if (isDevMode()) {
        console.warn(
          `[assistant-ui] Duplicate TriggerPopover for char "${char}". Ignoring the second registration.`,
        );
      }
      return () => undefined;
    }
    if (isDevMode()) {
      for (const existing of current.values()) {
        if (char.startsWith(existing.char) || existing.char.startsWith(char)) {
          console.warn(
            `[assistant-ui] Trigger prefix collision between "${existing.char}" and "${char}". One char is a prefix of the other; only one will match reliably.`,
          );
        }
      }
    }
    const next = new Map(current);
    next.set(char, trigger);
    this.triggerMap.set(next);
    for (const l of this.lifecycle) l.added(trigger);
    return () => {
      const after = new Map(this.triggerMap());
      if (after.get(char) !== trigger) return;
      after.delete(char);
      this.triggerMap.set(after);
      for (const l of this.lifecycle) l.removed(char);
    };
  }

  /** Subscribes to per-trigger add/remove events. */
  subscribeLifecycle(listener: TriggerPopoverLifecycleListener): () => void {
    this.lifecycle.add(listener);
    return () => this.lifecycle.delete(listener);
  }

  /**
   * Registers a key/cursor plugin. Higher `priority` plugins receive events first.
   *
   * @returns A function that unregisters it.
   */
  registerPlugin(plugin: ComposerInputPlugin, options: { priority?: number } = {}): () => void {
    const entry = { plugin, priority: options.priority ?? 0 };
    this.plugins = [...this.plugins, entry].sort((a, b) => b.priority - a.priority);
    return () => {
      this.plugins = this.plugins.filter((e) => e !== entry);
    };
  }

  /** The registered plugins, highest priority first. */
  getPlugins(): readonly ComposerInputPlugin[] {
    return this.plugins.map((e) => e.plugin);
  }
}

/**
 * Injects the enclosing `[auiComposerTriggerPopoverRoot]`.
 *
 * @throws When used outside one.
 */
export function injectTriggerPopoverRootContext(): AuiComposerTriggerPopoverRootDirective {
  const root = inject(AuiComposerTriggerPopoverRootDirective, { optional: true });
  if (!root) {
    throw new Error(
      'injectTriggerPopoverRootContext must be used within [auiComposerTriggerPopoverRoot]',
    );
  }
  return root;
}

/** Like {@link injectTriggerPopoverRootContext} but returns `null` outside a root. */
export function injectTriggerPopoverRootContextOptional(): AuiComposerTriggerPopoverRootDirective | null {
  return inject(AuiComposerTriggerPopoverRootDirective, { optional: true });
}

/**
 * Live map of registered triggers as a signal.
 *
 * @throws When used outside a trigger popover root.
 */
export function injectTriggerPopoverTriggers(): Signal<ReadonlyMap<string, RegisteredTrigger>> {
  return injectTriggerPopoverRootContext().triggers;
}

const EMPTY_TRIGGERS: ReadonlyMap<string, RegisteredTrigger> = new Map();
const EMPTY_TRIGGERS_SIGNAL: Signal<ReadonlyMap<string, RegisteredTrigger>> =
  signal(EMPTY_TRIGGERS).asReadonly();

/** Like {@link injectTriggerPopoverTriggers} but yields an empty map outside a root. */
export function injectTriggerPopoverTriggersOptional(): Signal<
  ReadonlyMap<string, RegisteredTrigger>
> {
  return injectTriggerPopoverRootContextOptional()?.triggers ?? EMPTY_TRIGGERS_SIGNAL;
}

/**
 * ARIA attributes for the focused composer element while a popover is open
 * (`aria-controls`, `aria-expanded`, `aria-haspopup`, `aria-activedescendant`),
 * or an empty object when none is open or outside a root.
 */
export function injectTriggerPopoverAriaProps(): Signal<TriggerPopoverAriaProps> {
  const root = injectTriggerPopoverRootContextOptional();
  return computed(() => {
    const active = root?.activeAria() ?? null;
    if (!active) return {};
    return {
      'aria-controls': active.popoverId,
      'aria-expanded': true as const,
      'aria-haspopup': 'listbox' as const,
      'aria-activedescendant': active.highlightedItemId,
    };
  });
}
