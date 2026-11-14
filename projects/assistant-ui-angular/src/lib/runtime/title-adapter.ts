// Ported from packages/core/src/react/adapters/TitleGenerationAdapter.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import type { ThreadMessage } from '@assistant-ui/core';

/** Generates a thread title from its messages. */
export interface TitleGenerationAdapter {
  /** Returns the title for `messages`. */
  generateTitle(messages: readonly ThreadMessage[]): Promise<string>;
}

/**
 * A title adapter that uses the first user text (trimmed to 50 characters),
 * or `New Thread` when there is none.
 */
export const createSimpleTitleAdapter = (): TitleGenerationAdapter => ({
  async generateTitle(messages) {
    const firstUserMessage = messages.find((m) => m.role === 'user');
    if (!firstUserMessage) return 'New Thread';
    const textPart = firstUserMessage.content.find((p) => p.type === 'text');
    if (!textPart || textPart.type !== 'text') return 'New Thread';
    const text = textPart.text.trim();
    return text.length > 50 ? `${text.slice(0, 47)}...` : text;
  },
});
