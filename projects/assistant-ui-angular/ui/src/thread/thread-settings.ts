// Ported from packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx (ThreadComponentsContext) @ 7d74276
import { Injectable, signal, type Signal, type Type } from '@angular/core';
import type { AssistantState } from 'angular-assistant-ui';
import type { AuiThreadComponents } from '../thread-components.token';

/** A suggestion button of the `aui-thread` welcome. */
export interface AuiThreadWelcomeSuggestion {
  /** The first line of the button. Defaults to the prompt. */
  title?: string;
  /** The muted second part of the button. */
  description?: string;
  /** The message sent when the button is clicked. */
  prompt: string;
}

/** The welcome of `aui-thread`, shown while the thread is empty. */
export interface AuiThreadWelcomeConfig {
  /** The heading. Defaults to `How can I help you today?`. */
  message?: string;
  /**
   * Suggestion buttons under the composer. When left out, the thread's own
   * suggestions (`s.suggestions`, from the runtime) are shown.
   */
  suggestions?: readonly AuiThreadWelcomeSuggestion[];
}

/** The avatar shown beside assistant messages of `aui-thread`. */
export interface AuiThreadAvatar {
  /** Image URL. */
  src?: string;
  /** Image alt text. */
  alt?: string;
  /** Text shown when there is no image (or it fails to load), e.g. initials. */
  fallback?: string;
}

/** Text shown when no welcome message is configured. */
export const DEFAULT_WELCOME_MESSAGE = 'How can I help you today?';

/**
 * Settings `aui-thread` shares with its sections.
 * @internal Provided by `aui-thread`.
 */
@Injectable()
export class AuiThreadSettings {
  /** The resolved section components (defaults merged with `AUI_THREAD_COMPONENTS`). */
  components: Signal<AuiThreadComponents> = signal({} as AuiThreadComponents);
  /** The welcome config. */
  welcome: Signal<AuiThreadWelcomeConfig | undefined> = signal(undefined);
  /** The assistant avatar. */
  assistantAvatar: Signal<AuiThreadAvatar | undefined> = signal(undefined);
  /** The composer placeholder. */
  composerPlaceholder: Signal<string> = signal('Send a message...');
}

/** A component slot type, for `*ngComponentOutlet`. */
export type AuiSlot = Type<unknown>;

/**
 * Startup exposes a loading placeholder thread; treat it as a new chat so the
 * composer mounts centered. Loads after startup keep the docked layout.
 */
export const isNewChatView = (s: AssistantState): boolean =>
  s.thread.messages.length === 0 && (!s.thread.isLoading || s.threads.isLoading);

/** A switched thread that is still fetching its history: skeleton, not welcome. */
export const isHistoryLoadingView = (s: AssistantState): boolean =>
  s.thread.messages.length === 0 &&
  s.thread.isLoading &&
  !s.thread.isDisabled &&
  !s.threads.isLoading;
