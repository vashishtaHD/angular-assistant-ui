// Ported from packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx (ThreadComponents) @ 7d74276
import { InjectionToken, type Type } from '@angular/core';

/**
 * The replaceable sections of `aui-thread`, each a standalone component
 * `Type`. Provide a partial map through {@link AUI_THREAD_COMPONENTS}; slots
 * left out keep the styled defaults.
 *
 * The components take no inputs. They render inside the store scope of what
 * they show, so they read it with `injectAuiState`:
 * - `UserMessage`, `AssistantMessage` and `EditComposer` render once per
 *   message, in its message scope (`s.message`). `EditComposer` renders in the
 *   message's edit composer scope (`s.composer`) while the message is being
 *   edited, in place of the message.
 * - `Composer` and `Welcome` render in the thread scope.
 * - `Text`, `Reasoning` and `ToolFallback` render once per part of an
 *   assistant message, in its part scope (`s.part`): text parts, reasoning
 *   parts, and tool calls without a registered tool UI (`registerToolUI`).
 * - `ToolGroup` renders once per run of consecutive tool calls of an
 *   assistant message, in its message scope, and is the one slot that takes
 *   an input (see the key).
 *
 * The attachment rows (`aui-message-attachments-styled` in `UserMessage`,
 * `aui-composer-attachments-styled` and `aui-composer-add-attachment-styled`
 * in `Composer`) have no keys of their own, as upstream's `ThreadComponents`
 * has none: replace the `UserMessage` or `Composer` slot to change them.
 */
export interface AuiThreadComponents {
  /** A user message. */
  UserMessage: Type<unknown>;
  /** An assistant message. */
  AssistantMessage: Type<unknown>;
  /** The edit composer shown in place of a message being edited. */
  EditComposer: Type<unknown>;
  /** The thread composer in the viewport footer. */
  Composer: Type<unknown>;
  /** The welcome shown while the thread is empty. */
  Welcome: Type<unknown>;
  /**
   * A tool call without a registered tool UI (default: `aui-tool-fallback`).
   * A registered tool UI always takes precedence.
   */
  ToolFallback: Type<unknown>;
  /** A text part of an assistant message (default: `aui-markdown-text-styled`). */
  Text: Type<unknown>;
  /**
   * A reasoning part of an assistant message (default: `aui-reasoning`, which
   * renders a whole run of consecutive reasoning parts in one collapsible from
   * the run's first part and nothing for the others).
   */
  Reasoning: Type<unknown>;
  /**
   * A run of consecutive tool calls of an assistant message, upstream's
   * `group-tool` group (default: a ghost `aui-tool-group`, closed until opened
   * and open while a call requires action). The component must declare a
   * required `group` input (`AuiGroupPart`) and renders the calls with
   * `<aui-group-children [group]="group()" />`.
   *
   * @example
   * ```ts
   * @Component({
   *   selector: 'app-tool-group',
   *   imports: [AuiGroupChildrenComponent],
   *   template: `<section>{{ group().indices.length }} calls
   *     <aui-group-children [group]="group()" /></section>`,
   * })
   * class ToolGroup {
   *   readonly group = input.required<AuiGroupPart>();
   * }
   * ```
   */
  ToolGroup: Type<unknown>;
}

/**
 * Overrides sections of `aui-thread` (the Angular stand-in for upstream's
 * `components` prop of `Thread`).
 *
 * @example
 * ```ts
 * providers: [{ provide: AUI_THREAD_COMPONENTS, useValue: { UserMessage: MyUserMessage } }]
 * ```
 */
export const AUI_THREAD_COMPONENTS = new InjectionToken<Partial<AuiThreadComponents>>(
  'assistant-ui.angular.thread-components',
);
