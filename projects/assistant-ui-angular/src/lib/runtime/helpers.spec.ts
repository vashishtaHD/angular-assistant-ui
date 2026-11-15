// Behavior of the re-implemented helpers (createSimpleTitleAdapter, createMessageConverter).
import { describe, expect, it } from 'vitest';
import type { ThreadMessage } from '@assistant-ui/core';
import { createMessageConverter } from './message-converter';
import { createSimpleTitleAdapter } from './title-adapter';

const message = (role: ThreadMessage['role'], content: unknown): ThreadMessage =>
  ({ id: role, role, content }) as unknown as ThreadMessage;

describe('createSimpleTitleAdapter', () => {
  const title = (messages: ThreadMessage[]) => createSimpleTitleAdapter().generateTitle(messages);

  it('uses the first user text, trimmed', async () => {
    expect(await title([message('user', [{ type: 'text', text: '  Plan a trip  ' }])])).toBe(
      'Plan a trip',
    );
  });

  it('shortens long text to 50 characters', async () => {
    const long = 'x'.repeat(80);
    const result = await title([message('user', [{ type: 'text', text: long }])]);
    expect(result).toBe(`${'x'.repeat(47)}...`);
    expect(result).toHaveLength(50);
  });

  it('falls back to New Thread without user text', async () => {
    expect(await title([])).toBe('New Thread');
    expect(await title([message('assistant', [{ type: 'text', text: 'hi' }])])).toBe('New Thread');
    expect(
      await title([message('user', [{ type: 'image', image: 'data:image/png;base64,AA' }])]),
    ).toBe('New Thread');
  });
});

interface Source {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

describe('createMessageConverter', () => {
  const converter = createMessageConverter<Source>((m, metadata) => ({
    id: m.id,
    role: m.role,
    content: m.text + ((metadata as { suffix?: string }).suffix ?? ''),
  }));
  const a: Source = { id: 'a', role: 'user', text: 'one' };
  const b: Source = { id: 'b', role: 'assistant', text: 'two' };

  it('converts to thread messages and back to the originals', () => {
    const [first, second] = converter.toThreadMessages([a, b]);
    expect(first).toMatchObject({ id: 'a', role: 'user' });
    expect(converter.toOriginalMessages(first!)).toEqual([a]);
    expect(converter.toOriginalMessage(second!)).toEqual(b);
    // A part resolves to what the callback produced for its message.
    expect(converter.toOriginalMessage(second!.content[0]!)).toEqual({
      id: 'b',
      role: 'assistant',
      content: 'two',
    });
  });

  it('throws when a message was not converted from external messages', () => {
    expect(() => converter.toOriginalMessages(message('user', []))).toThrow(
      'No original messages found',
    );
  });

  it('createThreadMessagesConverter honours joinStrategy', () => {
    const pair: Source[] = [
      { id: 'x', role: 'assistant', text: 'one' },
      { id: 'y', role: 'assistant', text: 'two' },
    ];
    expect(converter.createThreadMessagesConverter()(pair, false)).toHaveLength(1);
    expect(
      converter.createThreadMessagesConverter({ joinStrategy: 'none' })(pair, false),
    ).toHaveLength(2);
  });

  it('createThreadMessagesConverter reuses messages while getMetadataKey is unchanged', () => {
    const convert = converter.createThreadMessagesConverter({
      getMetadataKey: (_message, metadata) => (metadata as { suffix?: string }).suffix,
    });
    const first = convert([a], false, { suffix: '1' } as never);
    // A new metadata object with the same key keeps the converted message.
    expect(convert([a], false, { suffix: '1' } as never)[0]).toBe(first[0]);
    const changed = convert([a], false, { suffix: '2' } as never);
    expect(changed[0]).not.toBe(first[0]);
    expect(changed[0]!.content[0]).toMatchObject({ text: 'one2' });
  });
});
