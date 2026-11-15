import { describe, expect, it } from 'vitest';
import {
  groupAssistantRuns,
  planReconcile,
  reconcileThread,
  type StoredMessageRef,
} from './reconcile';

describe('planReconcile', () => {
  it('keeps the longest matching prefix and deletes the rest', () => {
    expect(planReconcile(['a', 'b', 'c'], ['a', 'b', 'x'])).toEqual({ keep: 2, deleteIds: ['c'] });
  });

  it('deletes nothing when the active branch extends the stored log', () => {
    expect(planReconcile(['a', 'b'], ['a', 'b', 'c'])).toEqual({ keep: 2, deleteIds: [] });
  });

  it('deletes the tail when the active branch is a prefix (regenerate)', () => {
    expect(planReconcile(['a', 'b', 'c'], ['a', 'b'])).toEqual({ keep: 2, deleteIds: ['c'] });
  });

  it('deletes everything when the first message differs', () => {
    expect(planReconcile(['a', 'b'], ['x', 'y'])).toEqual({ keep: 0, deleteIds: ['a', 'b'] });
  });

  it('handles empty inputs', () => {
    expect(planReconcile([], ['a'])).toEqual({ keep: 0, deleteIds: [] });
    expect(planReconcile(['a'], [])).toEqual({ keep: 0, deleteIds: ['a'] });
  });
});

describe('groupAssistantRuns', () => {
  it('merges consecutive assistant messages only', () => {
    const msgs: StoredMessageRef[] = [
      { id: 'u1', role: 'user' },
      { id: 'a1', role: 'assistant' },
      { id: 'a2', role: 'assistant' },
      { id: 'u2', role: 'user' },
    ];
    expect(groupAssistantRuns(msgs).map((g) => g.map((m) => m.id))).toEqual([
      ['u1'],
      ['a1', 'a2'],
      ['u2'],
    ]);
  });
});

describe('reconcileThread', () => {
  function fakeMemory(messages: StoredMessageRef[]) {
    const deletedCalls: string[][] = [];
    return {
      deletedCalls,
      memory: {
        recall: async () => ({ messages }),
        deleteMessages: async (ids: string[]) => {
          deletedCalls.push(ids);
        },
      },
    };
  }

  it('deletes stored messages after the branch point, including merged assistant runs', async () => {
    const { memory, deletedCalls } = fakeMemory([
      { id: 'u1', role: 'user' },
      { id: 'a1', role: 'assistant' },
      { id: 'u2', role: 'user' },
      { id: 'a2', role: 'assistant' },
      { id: 'a2b', role: 'assistant' },
    ]);
    const result = await reconcileThread({
      memory,
      threadId: 't',
      resourceId: 'r',
      activeIds: ['u1', 'a1', 'u2x'],
    });
    expect(result.deleted).toEqual(['u2', 'a2', 'a2b']);
    expect(deletedCalls).toEqual([['u2', 'a2', 'a2b']]);
  });

  it('does not delete a continuation message of the last active assistant message', async () => {
    const { memory, deletedCalls } = fakeMemory([
      { id: 'u1', role: 'user' },
      { id: 'a1', role: 'assistant' },
      { id: 'a1-continued', role: 'assistant' },
    ]);
    const result = await reconcileThread({
      memory,
      threadId: 't',
      resourceId: 'r',
      activeIds: ['u1', 'a1', 'u2'],
    });
    expect(result.deleted).toEqual([]);
    expect(deletedCalls).toEqual([]);
  });
});
