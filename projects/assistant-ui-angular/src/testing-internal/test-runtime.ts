// Ported from packages/vue/src/__tests__/primitives-content.test.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import {
  ExportedMessageRepository,
  InMemoryThreadListAdapter,
  type AttachmentAdapter,
  type ExternalStoreAdapter,
  type FeedbackAdapter,
  type RemoteThreadListAdapter,
  type ThreadMessageLike,
  type ThreadSuggestion,
} from '@assistant-ui/core';
import { AssistantRuntimeImpl, ExternalStoreRuntimeCore } from '@assistant-ui/core/internal';
import { RemoteThreadList, RuntimeAdapter } from '@assistant-ui/core/store';
import { ThreadClient } from '@assistant-ui/core/store/internal';
import { AuiConfig } from '@assistant-ui/store/client';
import { withKey } from '@assistant-ui/tap';

/** A minimal message accepted by the test runtime's external store adapter. */
export interface DemoMessage {
  /** Stable message id; omit to let the runtime generate one. */
  id?: string;
  role: 'user' | 'assistant';
  content: ThreadMessageLike['content'];
}

/** A real assistant runtime over an in-memory external store, for specs. */
export interface TestRuntime {
  runtime: AssistantRuntimeImpl;
  /** `AuiConfig({ threads: RuntimeAdapter(runtime) })`. */
  config: AuiConfig;
  append(message: DemoMessage): void;
  setRunning(value: boolean): void;
  /** Replaces the whole message list (update in place, remove, reorder). */
  setMessages(next: DemoMessage[]): void;
  /**
   * Adds `message` as a new child of `parentId` and makes it the head, so the
   * parent now has a second branch. Switches the runtime to repository mode
   * (messages without an id get one first). Pass `null` to branch off the root.
   */
  appendBranch(parentId: string | null, message: DemoMessage & { id: string }): void;
  /** Sets the thread's suggestions (what `aui.suggestions` reads). */
  setSuggestions(list: readonly ThreadSuggestion[]): void;
  /** Installs an attachment adapter; the composer can then add attachments. */
  withAttachments(adapter: AttachmentAdapter): void;
  /** Installs a feedback adapter; the action bar feedback buttons then submit to it. */
  withFeedback(adapter: FeedbackAdapter): void;
  /**
   * Builds a thread list on core's `RemoteThreadList` over `adapter` (default:
   * a fresh `InMemoryThreadListAdapter`), each thread a real external-store
   * runtime behind `ThreadClient`. It does not touch this runtime or `config`:
   * mount the returned `config` in place of `config`. `runtimeFor(threadId)`
   * returns that thread's `TestRuntime` (created lazily).
   */
  withThreadList(adapter?: RemoteThreadListAdapter): TestThreadList;
}

/** A thread list built by {@link TestRuntime.withThreadList}. */
export interface TestThreadList {
  /** `AuiConfig({ threads: RemoteThreadList(...) })`. */
  config: AuiConfig;
  /** The adapter the list runs on. */
  adapter: RemoteThreadListAdapter;
  /** The per-thread runtime for `threadId` (created on first use). */
  runtimeFor(threadId: string): TestRuntime;
}

/** Optional adapter callbacks forwarded to every adapter the runtime builds. */
export type TestRuntimeCallbacks = Pick<
  ExternalStoreAdapter<DemoMessage>,
  'onAddToolResult' | 'onResumeToolCall' | 'onRespondToToolApproval' | 'onEdit' | 'onReload'
>;

let generatedIds = 0;

/**
 * Creates an `ExternalStoreRuntimeCore`-backed runtime plus helpers that push
 * new messages, replace the list or toggle `isRunning` by replacing the adapter.
 */
export function createTestRuntime(callbacks: TestRuntimeCallbacks = {}): TestRuntime {
  let messages: DemoMessage[] = [];
  // Set once `appendBranch` is used: the whole tree, in repository mode.
  let tree: { message: DemoMessage & { id: string }; parentId: string | null }[] | undefined;
  let headId: string | null = null;
  let isRunning = false;
  let suggestions: readonly ThreadSuggestion[] = [];
  let adapters: ExternalStoreAdapter<DemoMessage>['adapters'];

  const toLike = (message: DemoMessage & { id: string }): ThreadMessageLike => ({
    id: message.id,
    role: message.role,
    content: message.content,
  });
  // Core calls this with the active chain after a branch switch or delete.
  // Its presence is what enables `switchToBranch`. In tree mode keep every
  // branch and only move the head, so later syncs keep the chosen branch.
  const onCoreSetMessages = (list: readonly unknown[]) => {
    if (tree) {
      const last = list.at(-1) as { id?: string } | undefined;
      if (last?.id && tree.some((entry) => entry.message.id === last.id)) headId = last.id;
      else if (list.length === 0) headId = null;
    } else {
      messages = list as DemoMessage[];
    }
    // Hand the new state back so the thread publishes it (as a real host does).
    sync();
  };
  // Deleting removes the node, relinks its children to its parent (as core's
  // repository does) and keeps the siblings so branch selection still works.
  const onCoreDelete = (messageId: string) => {
    if (!tree) {
      messages = messages.filter((message) => message.id !== messageId);
      sync();
      return;
    }
    const removed = tree.find((entry) => entry.message.id === messageId);
    if (!removed) return;
    // Only a deleted head moves; deleting an ancestor keeps the surviving head.
    const headWasDeleted = headId === messageId;
    tree = tree
      .filter((entry) => entry.message.id !== messageId)
      .map((entry) =>
        entry.parentId === messageId ? { ...entry, parentId: removed.parentId } : entry,
      );
    if (headWasDeleted) {
      // Fall back to the parent's last remaining branch, down to its leaf.
      let cursor = removed.parentId;
      for (;;) {
        const children = tree.filter((entry) => entry.parentId === cursor);
        const last = children.at(-1);
        if (!last) break;
        cursor = last.message.id;
      }
      headId = cursor;
    }
    sync();
  };
  const makeAdapter = (): ExternalStoreAdapter<DemoMessage> => {
    const common = {
      isRunning,
      suggestions,
      setMessages: onCoreSetMessages,
      onDelete: onCoreDelete,
      ...(adapters ? { adapters } : {}),
      onNew: async () => undefined,
      ...callbacks,
    };
    if (tree) {
      // Repository mode holds ThreadMessages already; a converter here would
      // make core report no external messages to `setMessages`.
      return {
        ...common,
        messageRepository: ExportedMessageRepository.fromBranchableArray(
          tree.map(({ message, parentId }) => ({ message: toLike(message), parentId })),
          { headId },
        ),
      } as unknown as ExternalStoreAdapter<DemoMessage>;
    }
    return {
      ...common,
      messages,
      convertMessage: (message: DemoMessage) => ({
        ...(message.id === undefined ? {} : { id: message.id }),
        role: message.role,
        content: message.content,
      }),
    };
  };
  const core = new ExternalStoreRuntimeCore(makeAdapter());
  const runtime = new AssistantRuntimeImpl(core);
  const sync = () => core.setAdapter(makeAdapter());
  // An id-less input gets its id once, remembered per input object, so
  // re-publishing that object (setMessages, appendBranch) keeps its id and
  // its row/scope. Only the id is cached: the copy is rebuilt from the
  // input every time, so reassigned role/content still flows through.
  const generated = new WeakMap<DemoMessage, string>();
  const withId = (message: DemoMessage): DemoMessage & { id: string } => {
    if (message.id !== undefined) return { ...message, id: message.id };
    let id = generated.get(message);
    if (id === undefined) {
      id = `test-msg-${++generatedIds}`;
      generated.set(message, id);
    }
    return { ...message, id };
  };
  const append = (message: DemoMessage) => {
    if (tree) {
      const next = withId(message);
      tree = [...tree, { message: next, parentId: headId }];
      headId = next.id;
    } else {
      messages = [...messages, withId(message)];
    }
    sync();
  };
  const setRunning = (value: boolean) => {
    isRunning = value;
    sync();
  };
  const setMessages = (next: DemoMessage[]) => {
    if (tree) {
      // Replace the active chain; branches off it are dropped.
      let parentId: string | null = null;
      tree = next.map((message) => {
        const entry = { message: withId(message), parentId };
        parentId = entry.message.id;
        return entry;
      });
      headId = parentId;
    } else {
      messages = next.map(withId);
    }
    sync();
  };
  const appendBranch = (parentId: string | null, message: DemoMessage & { id: string }) => {
    if (!tree) {
      let previous: string | null = null;
      tree = messages.map((existing) => {
        const entry = { message: withId(existing), parentId: previous };
        previous = entry.message.id;
        return entry;
      });
      headId = previous;
    }
    if (parentId !== null && !tree.some((entry) => entry.message.id === parentId)) {
      throw new Error(`appendBranch: no message with id "${parentId}".`);
    }
    tree = [...tree, { message, parentId }];
    headId = message.id;
    sync();
  };
  const setSuggestions = (list: readonly ThreadSuggestion[]) => {
    suggestions = list;
    sync();
  };
  const withAttachments = (adapter: AttachmentAdapter) => {
    adapters = { ...adapters, attachments: adapter };
    sync();
  };
  const withFeedback = (adapter: FeedbackAdapter) => {
    adapters = { ...adapters, feedback: adapter };
    sync();
  };
  const withThreadList = (listAdapter?: RemoteThreadListAdapter): TestThreadList => {
    const adapter = listAdapter ?? new InMemoryThreadListAdapter();
    const runtimes = new Map<string, TestRuntime>();
    const runtimeFor = (threadId: string) => {
      let existing = runtimes.get(threadId);
      if (!existing) {
        existing = createTestRuntime(callbacks);
        runtimes.set(threadId, existing);
      }
      return existing;
    };
    return {
      adapter,
      runtimeFor,
      config: AuiConfig({
        threads: RemoteThreadList({
          adapter,
          thread: (threadId) =>
            withKey(threadId, ThreadClient({ runtime: runtimeFor(threadId).runtime.thread })),
        }),
      }),
    };
  };
  return {
    runtime,
    config: AuiConfig({ threads: RuntimeAdapter(runtime) }),
    append,
    setRunning,
    setMessages,
    appendBranch,
    setSuggestions,
    withAttachments,
    withFeedback,
    withThreadList,
  };
}
