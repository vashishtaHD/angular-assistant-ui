// Ported from packages/react/src/primitives/messagePart/useMessagePart{Text,Reasoning,Source,File,Image,Data}.ts @ 7d74276
import { computed, type Signal } from '@angular/core';
import type { AssistantState } from '@assistant-ui/store/client';
import { injectAuiState } from '../state/inject-aui-state';

type PartState = AssistantState['part'];

/** A part state of the given `type`. */
export type PartOfType<TType extends PartState['type']> = Extract<PartState, { type: TType }>;

const COMPLETE_STATUS = Object.freeze({ type: 'complete' as const });

// Frozen sentinels for a part of another type: keep the signals total
// (a throwing selector would break change detection during thread switches).
const EMPTY_TEXT = Object.freeze({
  type: 'text',
  text: '',
  status: COMPLETE_STATUS,
}) as PartOfType<'text'>;
const EMPTY_REASONING = Object.freeze({
  type: 'reasoning',
  text: '',
  status: COMPLETE_STATUS,
}) as PartOfType<'reasoning'>;
const EMPTY_SOURCE = Object.freeze({
  type: 'source',
  sourceType: 'url',
  id: '',
  url: '',
  status: COMPLETE_STATUS,
}) as PartOfType<'source'>;
const EMPTY_FILE = Object.freeze({
  type: 'file',
  data: '',
  mimeType: '',
  status: COMPLETE_STATUS,
}) as PartOfType<'file'>;
const EMPTY_IMAGE = Object.freeze({
  type: 'image',
  image: '',
  status: COMPLETE_STATUS,
}) as PartOfType<'image'>;

/**
 * Signal of the current part as a text or reasoning part; an empty text part
 * while the part is another type. Call in an injection context inside a part
 * scope.
 */
export function injectMessagePartText(): Signal<PartOfType<'text'> | PartOfType<'reasoning'>> {
  return injectAuiState((s) =>
    s.part.type === 'text' || s.part.type === 'reasoning'
      ? (s.part as PartOfType<'text'> | PartOfType<'reasoning'>)
      : EMPTY_TEXT,
  );
}

/** Signal of the current part as a reasoning part; an empty one while it is another type. */
export function injectMessagePartReasoning(): Signal<PartOfType<'reasoning'>> {
  return injectAuiState((s) =>
    s.part.type === 'reasoning' ? (s.part as PartOfType<'reasoning'>) : EMPTY_REASONING,
  );
}

/** Signal of the current part as a source part; an empty one while it is another type. */
export function injectMessagePartSource(): Signal<PartOfType<'source'>> {
  return injectAuiState((s) =>
    s.part.type === 'source' ? (s.part as PartOfType<'source'>) : EMPTY_SOURCE,
  );
}

/** Signal of the current part as a file part; an empty one while it is another type. */
export function injectMessagePartFile(): Signal<PartOfType<'file'>> {
  return injectAuiState((s) =>
    s.part.type === 'file' ? (s.part as PartOfType<'file'>) : EMPTY_FILE,
  );
}

/** Signal of the current part as an image part; an empty one while it is another type. */
export function injectMessagePartImage(): Signal<PartOfType<'image'>> {
  return injectAuiState((s) =>
    s.part.type === 'image' ? (s.part as PartOfType<'image'>) : EMPTY_IMAGE,
  );
}

/**
 * Signal of the current part when it is a data part (and, if `name` is given,
 * has that name); `null` otherwise.
 */
export function injectMessagePartData<T = unknown>(
  name?: string,
): Signal<(PartOfType<'data'> & { data: T }) | null> {
  const part = injectAuiState((s) =>
    s.part.type === 'data' ? (s.part as PartOfType<'data'>) : null,
  );
  return computed(() => {
    const data = part();
    if (!data || (name !== undefined && data.name !== name)) return null;
    return data as PartOfType<'data'> & { data: T };
  });
}
