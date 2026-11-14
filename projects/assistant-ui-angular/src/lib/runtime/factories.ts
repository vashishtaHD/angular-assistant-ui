// Ported from packages/core/src/react/runtimes/useExternalStoreRuntime.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// and packages/core/src/react/runtimes/useLocalRuntime.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// and packages/core/src/react/runtimes/useRemoteThreadListRuntime.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { DestroyRef, assertInInjectionContext, inject } from '@angular/core';
import type {
  AssistantRuntime,
  ChatModelAdapter,
  ExternalStoreAdapter,
  LocalRuntimeOptionsBase,
  ThreadMessageLike,
  ThreadRuntime,
} from '@assistant-ui/core';
import {
  AssistantRuntimeImpl,
  ExternalStoreRuntimeCore,
  LocalRuntimeCore,
} from '@assistant-ui/core/internal';
import { RemoteThreadList, type RemoteThreadListProps } from '@assistant-ui/core/store';
import { ThreadClient } from '@assistant-ui/core/store/internal';
import { AuiConfig } from '@assistant-ui/store/client';
import { withKey } from '@assistant-ui/tap';

/** A runtime built by one of the `create*Runtime` factories, with its lifecycle. */
export interface ManagedRuntime<TInput> {
  /** The runtime; mount it with `AuiConfig({ threads: RuntimeAdapter(runtime) })`. */
  readonly runtime: AssistantRuntime;
  /** Pushes new options or an updated adapter into the running runtime. */
  update(input: TInput): void;
  /** Detaches the runtime. Called automatically by the `inject*` variants. */
  destroy(): void;
}

/**
 * Creates a runtime over an external store (React's `useExternalStoreRuntime`):
 * the host owns the messages and run state, and calls `update` with a new
 * adapter whenever they change.
 *
 * @example
 * ```ts
 * const store = createExternalStoreRuntime({ messages: [], onNew: async (m) => { ... } });
 * const config = AuiConfig({ threads: RuntimeAdapter(store.runtime) });
 * store.update({ ...adapter, messages: next });
 * ```
 */
export function createExternalStoreRuntime<T = ThreadMessageLike>(
  adapter: ExternalStoreAdapter<T>,
): ManagedRuntime<ExternalStoreAdapter<T>> {
  const core = new ExternalStoreRuntimeCore(adapter);
  const runtime = new AssistantRuntimeImpl(core);
  return {
    runtime,
    update: (next) => core.setAdapter(next),
    destroy: () => undefined,
  };
}

/**
 * Like {@link createExternalStoreRuntime}, for an injection context. The
 * runtime lives as long as the context.
 */
export function injectExternalStoreRuntime<T = ThreadMessageLike>(
  adapter: ExternalStoreAdapter<T>,
): ManagedRuntime<ExternalStoreAdapter<T>> {
  assertInInjectionContext(injectExternalStoreRuntime);
  const managed = createExternalStoreRuntime(adapter);
  inject(DestroyRef).onDestroy(() => managed.destroy());
  return managed;
}

/** Options of {@link createLocalRuntime} (React's `LocalRuntimeOptions`). */
export type LocalRuntimeFactoryOptions = Omit<LocalRuntimeOptionsBase, 'adapters'> & {
  /** Messages the thread starts with. */
  initialMessages?: readonly ThreadMessageLike[] | undefined;
  /** Adapters other than the chat model. */
  adapters?: Omit<LocalRuntimeOptionsBase['adapters'], 'chatModel'> | undefined;
};

/**
 * Creates a runtime that runs the chat model in the browser (React's
 * `useLocalRuntime`, without the cloud thread list). `update` swaps the chat
 * model or options.
 *
 * @example
 * ```ts
 * const local = createLocalRuntime({ async *run({ messages, abortSignal }) { yield { content: [...] }; } });
 * ```
 */
export function createLocalRuntime(
  chatModel: ChatModelAdapter,
  options: LocalRuntimeFactoryOptions = {},
): ManagedRuntime<{ chatModel?: ChatModelAdapter; options?: LocalRuntimeFactoryOptions }> {
  const build = (model: ChatModelAdapter, opts: LocalRuntimeFactoryOptions) => {
    const rest: Partial<LocalRuntimeFactoryOptions> = { ...opts };
    delete rest.initialMessages;
    return { ...rest, adapters: { ...opts.adapters, chatModel: model } } as LocalRuntimeOptionsBase;
  };
  const core = new LocalRuntimeCore(build(chatModel, options), options.initialMessages);
  const runtime = new AssistantRuntimeImpl(core);
  const main = core.threads.getMainThreadRuntimeCore();
  main.__internal_load().catch((error: unknown) => {
    console.error('[assistant-ui] local thread history load failed:', error);
  });
  let model = chatModel;
  let current = options;
  return {
    runtime,
    update: (next) => {
      model = next.chatModel ?? model;
      current = next.options ?? current;
      main.__internal_setOptions(build(model, current));
    },
    destroy: () => main.detach(),
  };
}

/**
 * Like {@link createLocalRuntime}, for an injection context; the runtime is
 * detached when the context is destroyed.
 */
export function injectLocalRuntime(
  chatModel: ChatModelAdapter,
  options: LocalRuntimeFactoryOptions = {},
): ManagedRuntime<{ chatModel?: ChatModelAdapter; options?: LocalRuntimeFactoryOptions }> {
  assertInInjectionContext(injectLocalRuntime);
  const managed = createLocalRuntime(chatModel, options);
  inject(DestroyRef).onDestroy(() => managed.destroy());
  return managed;
}

/** Options of {@link remoteThreadListConfig}. */
export interface RemoteThreadListConfigOptions extends Omit<RemoteThreadListProps, 'thread'> {
  /**
   * Returns the runtime of the thread `threadId` (create it once per id; the
   * list keeps the one for the visible thread mounted). Typically built with
   * {@link createLocalRuntime} or {@link createExternalStoreRuntime}.
   */
  runtime: (threadId: string) => { readonly thread: ThreadRuntime };
}

/**
 * The `AuiConfig` for a thread list backed by a `RemoteThreadListAdapter`
 * (the Angular face of React's `useRemoteThreadListRuntime`): each thread's
 * runtime comes from `runtime(threadId)`.
 *
 * @example
 * ```ts
 * protected readonly config = remoteThreadListConfig({
 *   adapter: new InMemoryThreadListAdapter(),
 *   runtime: (id) => runtimes.get(id) ?? create(id),
 * });
 * ```
 */
export function remoteThreadListConfig(options: RemoteThreadListConfigOptions): AuiConfig {
  const { runtime, ...rest } = options;
  return AuiConfig({
    threads: RemoteThreadList({
      ...rest,
      thread: (threadId) => withKey(threadId, ThreadClient({ runtime: runtime(threadId).thread })),
    }),
  });
}
