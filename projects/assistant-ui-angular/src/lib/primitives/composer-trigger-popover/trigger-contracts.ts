// Ported from packages/react/src/primitives/composer/trigger/{detectTrigger,triggerSelectionResource,matchesTriggerItemQuery}.ts @ 7d74276
import type { DirectiveFormatter, TriggerItem } from '@assistant-ui/core';

// Contracts that live in `@assistant-ui/core` are re-exported unchanged so the
// adapter, formatter, item and category shapes stay interchangeable with React.
export {
  defaultDirectiveFormatter,
  unstable_defaultDirectiveFormatter,
  type DirectiveFormatter,
  type DirectiveSegment,
  type TriggerAdapter,
  type TriggerCategory,
  type TriggerItem,
  type Unstable_DirectiveFormatter,
  type Unstable_DirectiveSegment,
  type Unstable_TriggerAdapter,
  type Unstable_TriggerCategory,
  type Unstable_TriggerItem,
} from '@assistant-ui/core';

const WHITESPACE_RE = /\s/u;

/** A trigger located in the composer text. */
export interface TriggerMatch {
  /** The search string typed after the trigger character. */
  readonly query: string;
  /** Index of the trigger character. */
  readonly offset: number;
  /** Exclusive end of the span that is replaced when an item is selected. */
  readonly endOffset: number;
}

/** @deprecated Use `TriggerMatch`. */
export type Unstable_TriggerMatch = TriggerMatch;

/**
 * Locates a trigger query in `text` relative to `cursorPosition`. Return
 * `null` when the caret is at or before the trigger: Escape moves the caret to
 * `offset`, so a match there would reopen the popover.
 */
export type TriggerMatcher = (
  text: string,
  triggerChar: string,
  cursorPosition: number,
) => TriggerMatch | null;

/** @deprecated Use `TriggerMatcher`. */
export type Unstable_TriggerMatcher = TriggerMatcher;

/**
 * What a popover does when an item is selected: insert a directive token into
 * the composer (`directive`), or run a handler (`action`), optionally leaving
 * the token behind as an audit trail.
 */
export type TriggerBehavior =
  | {
      readonly kind: 'directive';
      readonly formatter: DirectiveFormatter;
      readonly onInserted?: (item: TriggerItem) => void;
    }
  | {
      readonly kind: 'action';
      readonly formatter: DirectiveFormatter;
      readonly onExecute: (item: TriggerItem) => void;
      readonly removeOnExecute?: boolean;
    };

/** @deprecated Use `TriggerBehavior`. */
export type Unstable_TriggerBehavior = TriggerBehavior;

/** Validates a matcher result against the text and cursor. */
export function resolveTriggerMatch(
  text: string,
  triggerChar: string,
  cursorPosition: number,
  match: TriggerMatch | null,
): TriggerMatch | null {
  if (match === null) return null;
  const { query, offset, endOffset } = match;
  if (offset < 0 || offset + triggerChar.length > cursorPosition) return null;
  if (!text.startsWith(triggerChar, offset)) return null;
  if (endOffset < offset + triggerChar.length || endOffset > text.length) return null;
  return { query, offset, endOffset };
}

/**
 * Detects a trigger character in `text` relative to the cursor. The default
 * rule: the trigger character must start a word (start of text or after
 * whitespace) and no whitespace may lie between it and the cursor.
 *
 * @param text - The composer text.
 * @param triggerChar - The character(s) that activate the trigger.
 * @param cursorPosition - Caret index.
 * @param matcher - Custom detection replacing the default rule.
 */
export function detectTrigger(
  text: string,
  triggerChar: string,
  cursorPosition: number,
  matcher?: TriggerMatcher | undefined,
): TriggerMatch | null {
  if (matcher) {
    return resolveTriggerMatch(
      text,
      triggerChar,
      cursorPosition,
      matcher(text, triggerChar, cursorPosition),
    );
  }

  const textUpToCursor = text.slice(0, cursorPosition);

  for (let i = textUpToCursor.length - 1; i >= 0; i--) {
    const char = textUpToCursor[i]!;

    if (WHITESPACE_RE.test(char)) return null;

    if (textUpToCursor.startsWith(triggerChar, i)) {
      if (i > 0 && !WHITESPACE_RE.test(textUpToCursor[i - 1]!)) continue;

      const query = textUpToCursor.slice(i + triggerChar.length);

      return { query, offset: i, endOffset: cursorPosition };
    }
  }

  return null;
}

/**
 * Case-insensitive match of an item against a lower-cased query, over its id,
 * label and description. An empty query matches everything.
 *
 * @param item - The item to test.
 * @param lowerQuery - The query, already lower-cased.
 */
export function matchesTriggerItemQuery(item: TriggerItem, lowerQuery: string): boolean {
  if (!lowerQuery) return true;
  return (
    item.id.toLowerCase().includes(lowerQuery) ||
    item.label.toLowerCase().includes(lowerQuery) ||
    (item.description?.toLowerCase().includes(lowerQuery) ?? false)
  );
}
