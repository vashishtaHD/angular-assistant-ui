import { describe, expect, it } from 'vitest';
import { createScriptedThreadListAdapter } from './scripted-thread-list';

/** Reads the text an assistant stream carries. */
async function streamText(stream: ReadableStream<unknown>): Promise<string> {
  const reader = stream.getReader();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text;
    const chunk = value as { type?: string; textDelta?: string };
    if (chunk.type === 'text-delta' && chunk.textDelta) text += chunk.textDelta;
  }
}

describe('createScriptedThreadListAdapter', () => {
  it('lists the seeded threads in the given order, with their metadata', async () => {
    const adapter = createScriptedThreadListAdapter({
      threads: [
        { id: 't-2', title: 'Newest', lastMessageAt: new Date('2026-11-15T10:00:00Z') },
        { id: 't-1', title: 'Older', custom: { pinned: true } },
        { id: 't-0', title: 'Old', status: 'archived' },
      ],
    });
    const { threads } = await adapter.list();
    expect(threads).toEqual([
      {
        status: 'regular',
        remoteId: 't-2',
        title: 'Newest',
        lastMessageAt: new Date('2026-11-15T10:00:00Z'),
      },
      { status: 'regular', remoteId: 't-1', title: 'Older', custom: { pinned: true } },
      { status: 'archived', remoteId: 't-0', title: 'Old' },
    ]);
    expect(await adapter.fetch('t-1')).toMatchObject({ title: 'Older' });
  });

  it('starts empty without threads and lists a new thread first', async () => {
    const adapter = createScriptedThreadListAdapter({ threads: [{ id: 'old', title: 'Old' }] });
    expect(await adapter.initialize('new-1')).toEqual({ remoteId: 'new-1', externalId: undefined });
    expect((await adapter.list()).threads.map((thread) => thread.remoteId)).toEqual([
      'new-1',
      'old',
    ]);
    expect((await createScriptedThreadListAdapter().list()).threads).toEqual([]);
  });

  it('renames, archives, unarchives and deletes, recording every call', async () => {
    const adapter = createScriptedThreadListAdapter({
      threads: [
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
      ],
    });
    await adapter.rename('a', 'Renamed');
    await adapter.archive('b');
    await adapter.unarchive!('b');
    await adapter.delete('a');
    const { threads } = await adapter.list();
    expect(threads).toEqual([{ status: 'regular', remoteId: 'b', title: 'B' }]);
    expect(adapter.calls).toEqual([
      { method: 'rename', args: ['a', 'Renamed'] },
      { method: 'archive', args: ['b'] },
      { method: 'unarchive', args: ['b'] },
      { method: 'delete', args: ['a'] },
      { method: 'list', args: [] },
    ]);
  });

  it('generates the scripted title and stores it', async () => {
    const adapter = createScriptedThreadListAdapter({
      title: (messages) => `Chat about ${messages.length} messages`,
    });
    await adapter.initialize('t');
    const text = await streamText(await adapter.generateTitle('t', [{}, {}] as never));
    expect(text).toBe('Chat about 2 messages');
    expect(await adapter.fetch('t')).toMatchObject({ title: 'Chat about 2 messages' });
    expect(adapter.calls.at(-2)).toEqual({ method: 'generateTitle', args: ['t'] });
  });

  it('generates no title without the title option', async () => {
    const adapter = createScriptedThreadListAdapter();
    await adapter.initialize('t');
    expect(await streamText(await adapter.generateTitle('t', []))).toBe('');
    expect((await adapter.fetch('t')).title).toBeUndefined();
  });

  it('fails the next call of a method once when failNext is set', async () => {
    const adapter = createScriptedThreadListAdapter({ threads: [{ id: 'a' }] });
    adapter.failNext('list', new Error('offline'));
    await expect(adapter.list()).rejects.toThrow('offline');
    await expect(adapter.list()).resolves.toMatchObject({ threads: [{ remoteId: 'a' }] });
  });
});
