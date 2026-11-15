import { describe, expect, it } from 'vitest';
import { scopeMessageId, unscopeMessageId } from './message-ids';
import { isAllowedRoute } from './auth';

describe('message id scoping', () => {
  it('round-trips for the same resource and thread', () => {
    const stored = scopeMessageId('user-a', 'thread.1', 'id.with.dots');
    expect(stored).not.toContain('id.with.dots');
    expect(unscopeMessageId('user-a', 'thread.1', stored)).toBe('id.with.dots');
  });

  it('gives different scopes different ids and does not unscope across scopes', () => {
    const a = scopeMessageId('user-a', 't1', 'x');
    expect(scopeMessageId('user-b', 't1', 'x')).not.toBe(a);
    expect(scopeMessageId('user-a', 't2', 'x')).not.toBe(a);
    expect(scopeMessageId('a.b', 'c', 'x')).not.toBe(scopeMessageId('a', 'b.c', 'x'));
    expect(unscopeMessageId('user-b', 't1', a)).toBe(a);
  });

  it('passes unscoped ids through', () => {
    expect(unscopeMessageId('u', 't', 'plain-uuid')).toBe('plain-uuid');
  });
});

describe('isAllowedRoute', () => {
  it('allows only the app routes', () => {
    expect(isAllowedRoute('/chat/chatAgent', 'POST')).toBe(true);
    expect(isAllowedRoute('/chat/chatAgent/threads/t1/messages', 'GET')).toBe(true);
    expect(isAllowedRoute('/api/memory/threads', 'GET')).toBe(true);
    expect(isAllowedRoute('/api/memory/threads/t1', 'PATCH')).toBe(true);
    expect(isAllowedRoute('/chat/chatAgent', 'GET')).toBe(false);
    expect(isAllowedRoute('/api/memory/threads/t1/messages', 'GET')).toBe(false);
    expect(isAllowedRoute('/api/agents/chatAgent/stream', 'POST')).toBe(false);
  });
});
