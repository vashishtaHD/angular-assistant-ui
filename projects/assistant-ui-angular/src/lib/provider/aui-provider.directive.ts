// Ported from packages/vue/src/AuiProvider.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import {
  DestroyRef,
  Directive,
  inject,
  input,
  isDevMode,
  untracked,
  type OnChanges,
  type SimpleChanges,
} from '@angular/core';
import {
  DefaultAssistantClient,
  createClientFacade,
  type AssistantClient,
  type AssistantClientSource,
  type AuiConfig,
  type Unsubscribe,
} from '@assistant-ui/store/client';
import { AUI_CONTEXT, type AuiContext } from '../context/aui-context';
import {
  createAuiContext,
  registerForwardingSource,
  type CreatedAuiContext,
} from '../context/create-aui-context';

interface PendingSubscription {
  listener: () => void;
  off?: Unsubscribe;
}

/**
 * Creates an `AssistantClient` from the given config and provides it to the
 * element's subtree. Adds no DOM; use it on an element or `<ng-container>`.
 *
 * At the top level, `[auiProvider]="config"` alone creates this subtree's own
 * client. Under a parent provider, `[auiProviderExtends]` is mandatory: pass
 * the parent's client (`injectAui()`) to extend it or `null` to isolate from
 * it (enforced with a dev-mode error).
 *
 * The `auiProvider` input is live: binding a new config object updates
 * element args in place (scopes keep their state) and mounts or unmounts added
 * and removed scopes. `auiProviderExtends` is captured on the first change
 * detection; recreate the provider (for example with `@if`) to change the
 * parent. Binding `undefined` to it is the same as not binding it.
 *
 * The client is created on the provider's first change detection, when its
 * inputs are available. Descendants may inject it earlier (for example in
 * constructors); they are notified once the client exists, so read state in
 * templates, `computed`s or event handlers rather than in constructors.
 *
 * @example
 * ```html
 * <ng-container [auiProvider]="config">
 *   <app-thread />
 * </ng-container>
 * ```
 */
@Directive({
  selector: '[auiProvider]',
  standalone: true,
  providers: [{ provide: AUI_CONTEXT, useFactory: () => inject(AuiProviderDirective).context }],
})
export class AuiProviderDirective implements OnChanges {
  /** The config this provider's client is built from. */
  readonly auiProvider = input.required<AuiConfig>();

  /**
   * The parent client to extend, or `null` to isolate. Required under a
   * parent provider; `undefined` means "not provided".
   */
  readonly auiProviderExtends = input<AssistantClient | null | undefined>(undefined);

  // `skipSelf`: this directive's own injector provides AUI_CONTEXT.
  private readonly injected = inject(AUI_CONTEXT, { skipSelf: true, optional: true });
  private readonly configListeners = new Set<() => void>();
  private readonly pending = new Set<PendingSubscription>();
  private inner: CreatedAuiContext | undefined;
  private destroyed = false;

  private readonly source: AssistantClientSource = {
    getClient: () => this.inner?.context.source.getClient() ?? DefaultAssistantClient,
    subscribe: (listener) => {
      if (this.inner) return this.inner.context.source.subscribe(listener);
      // Subscribed before the client exists (descendant constructors run
      // before this directive's inputs are set): attach once it is created.
      const entry: PendingSubscription = { listener };
      this.pending.add(entry);
      return () => {
        this.pending.delete(entry);
        entry.off?.();
        entry.off = undefined;
      };
    },
  };

  /**
   * The context provided to descendants through {@link AUI_CONTEXT}. Stable
   * for the provider's lifetime.
   */
  readonly context: AuiContext = { source: this.source, aui: createClientFacade(this.source) };

  constructor() {
    // Nested providers and scopes receive `this.source` as their parent; let
    // `createAuiContext` unwrap it to the real handle (the store's
    // parent-snapshot fast path only applies to real handles).
    registerForwardingSource(this.source, () => this.inner?.handle);
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.pending.clear();
      this.inner?.release();
    });
  }

  /** Creates the client on first run; afterwards forwards config changes. */
  ngOnChanges(changes: SimpleChanges): void {
    if (!this.inner) {
      this.create();
      return;
    }
    if (changes['auiProvider']) {
      for (const listener of [...this.configListeners]) listener();
    }
  }

  private create(): void {
    if (this.destroyed) return;
    const injected = this.injected;
    const ext = this.auiProviderExtends();
    const hasExtends = ext !== undefined;

    if (isDevMode()) {
      if (injected && !hasExtends) {
        throw new Error(
          'A parent AuiProvider exists. Pass [auiProviderExtends]="aui" to inherit it or [auiProviderExtends]="null" to isolate.',
        );
      }
    }

    const parent = !hasExtends
      ? injected?.source
      : ext === null
        ? undefined
        : injected && ext === injected.aui
          ? injected.source
          : ext;

    this.inner = createAuiContext({
      getConfig: () => untracked(() => this.auiProvider()),
      subscribe: (listener) => {
        this.configListeners.add(listener);
        return () => {
          this.configListeners.delete(listener);
        };
      },
      parent,
    });

    // Early subscribers saw the placeholder client; attach them to the real
    // one and tell them the client changed.
    const early = [...this.pending];
    this.pending.clear();
    for (const entry of early) {
      entry.off = this.inner.context.source.subscribe(entry.listener);
    }
    for (const entry of early) {
      if (entry.off) entry.listener();
    }
  }
}
