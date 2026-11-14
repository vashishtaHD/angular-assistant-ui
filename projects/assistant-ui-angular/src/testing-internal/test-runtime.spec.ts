import { InMemoryThreadListAdapter, type AttachmentAdapter } from '@assistant-ui/core';
import { createAssistantClient, type AuiConfig } from '@assistant-ui/store/client';
import { flushTapSync } from '@assistant-ui/tap';
import { describe, expect, it, vi } from 'vitest';
import { createTestRuntime } from './test-runtime';

const text = (value: string) => [{ type: 'text' as const, text: value }];

/** A mounted client over `config`, kept alive until the returned `release()`. */
const mountClient = (config: AuiConfig) => {
  const handle = createAssistantClient({
    getConfig: () => config,
    subscribe: () => () => undefined,
  });
  const release = handle.subscribe(() => undefined);
  return { client: handle.getClient(), release };
};

const settle = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

describe('createTestRuntime extras', () => {
  it('appendBranch adds a sibling branch under the parent', () => {
    const rt = createTestRuntime();
    flushTapSync(() => {
      rt.append({ id: 'u1', role: 'user', content: text('hi') });
      rt.append({ id: 'a1', role: 'assistant', content: text('first') });
    });
    const { client, release } = mountClient(rt.config);
    expect(client.thread.getState().messages.map((m) => m.id)).toEqual(['u1', 'a1']);

    flushTapSync(() =>
      rt.appendBranch('u1', { id: 'a2', role: 'assistant', content: text('second') }),
    );

    expect(client.thread.getState().messages.map((m) => m.id)).toEqual(['u1', 'a2']);
    const reply = client.thread.message({ id: 'a2' }).getState();
    expect(reply.branchCount).toBe(2);
    expect(reply.branchNumber).toBe(2);

    // Later appends continue from the new head; setMessages keeps working in tree mode.
    flushTapSync(() => rt.append({ id: 'u2', role: 'user', content: text('more') }));
    expect(client.thread.getState().messages.map((m) => m.id)).toEqual(['u1', 'a2', 'u2']);
    release();
  });

  it('lets the branch picker select between siblings and keeps the chosen head', () => {
    const rt = createTestRuntime();
    flushTapSync(() => {
      rt.append({ id: 'u1', role: 'user', content: text('hi') });
      rt.append({ id: 'a1', role: 'assistant', content: text('first') });
      rt.appendBranch('u1', { id: 'a2', role: 'assistant', content: text('second') });
    });
    const { client, release } = mountClient(rt.config);
    const ids = () => client.thread.getState().messages.map((m) => m.id);
    expect(client.thread.getState().capabilities.switchToBranch).toBe(true);
    expect(ids()).toEqual(['u1', 'a2']);

    flushTapSync(() =>
      client.thread.message({ id: 'a2' }).switchToBranch({ position: 'previous' }),
    );
    expect(ids()).toEqual(['u1', 'a1']);
    expect(client.thread.message({ id: 'a1' }).getState().branchCount).toBe(2);

    // A later adapter sync keeps the chosen head instead of reverting to a2.
    flushTapSync(() => rt.setRunning(false));
    expect(ids()).toEqual(['u1', 'a1']);

    flushTapSync(() => client.thread.message({ id: 'a1' }).switchToBranch({ position: 'next' }));
    expect(ids()).toEqual(['u1', 'a2']);
    flushTapSync(() => rt.setRunning(false));
    expect(ids()).toEqual(['u1', 'a2']);

    // Both branches survive, and an append continues from the selected head.
    flushTapSync(() =>
      client.thread.message({ id: 'a2' }).switchToBranch({ position: 'previous' }),
    );
    flushTapSync(() => rt.append({ id: 'u2', role: 'user', content: text('more') }));
    expect(ids()).toEqual(['u1', 'a1', 'u2']);
    expect(client.thread.message({ id: 'a1' }).getState().branchCount).toBe(2);
    release();
  });

  it('keeps a deleted branch message deleted across later syncs', async () => {
    const rt = createTestRuntime();
    flushTapSync(() => {
      rt.append({ id: 'u1', role: 'user', content: text('hi') });
      rt.append({ id: 'a1', role: 'assistant', content: text('first') });
      rt.appendBranch('u1', { id: 'a2', role: 'assistant', content: text('second') });
    });
    const { client, release } = mountClient(rt.config);
    const ids = () => client.thread.getState().messages.map((m) => m.id);
    expect(ids()).toEqual(['u1', 'a2']);

    await client.thread.deleteMessage('a2');
    await settle();
    expect(ids()).toEqual(['u1', 'a1']);

    flushTapSync(() => rt.setRunning(true));
    flushTapSync(() => rt.setRunning(false));
    expect(ids()).toEqual(['u1', 'a1']);
    flushTapSync(() => rt.setSuggestions([{ prompt: 'p' }]));
    expect(ids()).toEqual(['u1', 'a1']);
    flushTapSync(() => rt.append({ id: 'u2', role: 'user', content: text('more') }));
    expect(ids()).toEqual(['u1', 'a1', 'u2']);
    expect(client.thread.message({ id: 'a1' }).getState().branchCount).toBe(1);
    release();
  });

  it('relinks children when an interior message is deleted and keeps siblings', async () => {
    const rt = createTestRuntime();
    flushTapSync(() => {
      rt.append({ id: 'u1', role: 'user', content: text('hi') });
      rt.append({ id: 'a1', role: 'assistant', content: text('first') });
      rt.append({ id: 'u2', role: 'user', content: text('more') });
      rt.appendBranch('u1', { id: 'a2', role: 'assistant', content: text('alt') });
      rt.setMessages([
        { id: 'u1', role: 'user', content: text('hi') },
        { id: 'a1', role: 'assistant', content: text('first') },
        { id: 'u2', role: 'user', content: text('more') },
      ]);
    });
    const { client, release } = mountClient(rt.config);
    const ids = () => client.thread.getState().messages.map((m) => m.id);
    expect(ids()).toEqual(['u1', 'a1', 'u2']);

    await client.thread.deleteMessage('a1');
    await settle();
    expect(ids()).toEqual(['u1', 'u2']);
    flushTapSync(() => rt.setRunning(false));
    expect(ids()).toEqual(['u1', 'u2']);
    flushTapSync(() => rt.append({ id: 'a3', role: 'assistant', content: text('later') }));
    expect(ids()).toEqual(['u1', 'u2', 'a3']);
    release();
  });

  it('deletes messages that were appended without an explicit id', async () => {
    const rt = createTestRuntime();
    flushTapSync(() => {
      rt.append({ role: 'user', content: text('hi') });
      rt.append({ role: 'assistant', content: text('yo') });
    });
    const { client, release } = mountClient(rt.config);
    const ids = () => client.thread.getState().messages.map((m) => m.id);
    const [first, second] = ids();
    expect(ids()).toHaveLength(2);

    await client.thread.deleteMessage(second!);
    await settle();
    expect(ids()).toEqual([first]);
    flushTapSync(() => rt.setRunning(false));
    expect(ids()).toEqual([first]);
    release();
  });

  it('keeps the surviving active descendant when an interior message is deleted', async () => {
    const rt = createTestRuntime();
    flushTapSync(() => {
      rt.append({ id: 'u1', role: 'user', content: text('hi') });
      rt.append({ id: 'a1', role: 'assistant', content: text('first') });
      rt.append({ id: 'u2', role: 'user', content: text('more') });
      rt.appendBranch('u1', { id: 'a2', role: 'assistant', content: text('alt') });
    });
    const { client, release } = mountClient(rt.config);
    const ids = () => client.thread.getState().messages.map((m) => m.id);
    expect(ids()).toEqual(['u1', 'a2']);
    flushTapSync(() =>
      client.thread.message({ id: 'a2' }).switchToBranch({ position: 'previous' }),
    );
    expect(ids()).toEqual(['u1', 'a1', 'u2']);

    await client.thread.deleteMessage('a1');
    await settle();
    expect(ids()).toEqual(['u1', 'u2']);
    flushTapSync(() => rt.append({ id: 'a3', role: 'assistant', content: text('later') }));
    expect(ids()).toEqual(['u1', 'u2', 'a3']);
    release();
  });

  it('appendBranch rejects an unknown parent', () => {
    const rt = createTestRuntime();
    expect(() => rt.appendBranch('nope', { id: 'x', role: 'user', content: text('x') })).toThrow(
      /no message/,
    );
  });

  it('setSuggestions drives aui.suggestions', () => {
    const rt = createTestRuntime();
    const { client, release } = mountClient(rt.config);
    expect(client.suggestions.getState().suggestions).toEqual([]);
    flushTapSync(() => rt.setSuggestions([{ title: 'T', label: 'L', prompt: 'P' }]));
    expect(client.suggestions.suggestion({ index: 0 }).getState()).toMatchObject({ prompt: 'P' });
    release();
  });

  it('withAttachments lets the composer add and remove an attachment', async () => {
    const rt = createTestRuntime();
    const adapter: AttachmentAdapter = {
      accept: 'text/plain',
      add: async ({ file }) => ({
        id: 'att-1',
        type: 'file',
        name: file.name,
        contentType: file.type,
        file,
        status: { type: 'requires-action', reason: 'composer-send' },
      }),
      remove: vi.fn(async () => undefined),
      send: async (attachment) => ({
        ...attachment,
        status: { type: 'complete' },
        content: text('x'),
      }),
    };
    rt.withAttachments(adapter);
    const { client, release } = mountClient(rt.config);
    expect(client.composer.getState().attachmentAccept).toBe('text/plain');
    await client.composer.addAttachment(new File(['a'], 'a.txt', { type: 'text/plain' }));
    await settle();
    expect(client.composer.getState().attachments.map((a) => a.name)).toEqual(['a.txt']);
    expect(client.composer.attachment({ index: 0 }).getState().name).toBe('a.txt');
    await client.composer.attachment({ index: 0 }).remove();
    await settle();
    expect(adapter.remove).toHaveBeenCalledTimes(1);
    release();
  });

  it('withFeedback routes submitFeedback to the adapter', () => {
    const rt = createTestRuntime();
    const submit = vi.fn();
    rt.withFeedback({ submit });
    flushTapSync(() => {
      rt.append({ id: 'u1', role: 'user', content: text('hi') });
      rt.append({ id: 'a1', role: 'assistant', content: text('yo') });
    });
    const { client, release } = mountClient(rt.config);
    client.thread.message({ id: 'a1' }).submitFeedback({ type: 'positive' });
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'positive', message: expect.objectContaining({ id: 'a1' }) }),
    );
    release();
  });

  it('withThreadList runs core RemoteThreadList over an in-memory adapter', async () => {
    const rt = createTestRuntime();
    const list = rt.withThreadList();
    const { client, release } = mountClient(list.config);
    await client.threads.getLoadThreadsPromise();
    await settle();
    expect(client.threads.getState().threadIds).toEqual([]);

    flushTapSync(() =>
      list.runtimeFor(client.threads.getState().mainThreadId).append({
        id: 'm1',
        role: 'user',
        content: text('hello'),
      }),
    );
    await settle();
    expect(client.thread.getState().messages.map((m) => m.id)).toEqual(['m1']);
    release();
  });

  it('withThreadList lists the adapter threads and switches between them', async () => {
    const rt = createTestRuntime();
    const base = new InMemoryThreadListAdapter();
    const adapter = Object.assign(Object.create(base) as InMemoryThreadListAdapter, {
      list: async () => ({
        threads: [
          { status: 'regular' as const, remoteId: 'r1', title: 'One' },
          { status: 'regular' as const, remoteId: 'r2', title: 'Two' },
          { status: 'archived' as const, remoteId: 'r3', title: 'Old' },
        ],
      }),
    });
    const list = rt.withThreadList(adapter);
    const { client, release } = mountClient(list.config);
    await client.threads.getLoadThreadsPromise();
    await settle();
    const state = client.threads.getState();
    expect(state.threadIds).toEqual(['r1', 'r2']);
    expect(state.archivedThreadIds).toEqual(['r3']);
    expect(client.threads.item({ index: 1 }).getState().title).toBe('Two');
    client.threads.switchToThread('r2');
    await settle();
    expect(client.threads.getState().mainThreadId).toBe('r2');
    release();
  });
});
