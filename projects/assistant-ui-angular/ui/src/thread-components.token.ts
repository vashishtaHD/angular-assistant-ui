// Ported from packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx (ThreadComponents) @ 7d74276
import { InjectionToken, type Type } from '@angular/core';

/**
 * The replaceable sections of `aui-thread`, each a standalone component
 * `Type`. Provide a partial map through {@link AUI_THREAD_COMPONENTS}; slots
 * left out keep the styled defaults.
 *
 * The components take no inputs, except the two group slots (see below). They
 * render inside the store scope of what they show, so they read it with
 * `injectAuiState`:
 * - `UserMessage`, `AssistantMessage` and `EditComposer` render once per
 *   message, in its message scope (`s.message`). `EditComposer` renders in the
 *   message's edit composer scope (`s.composer`) while the message is being
 *   edited, in place of the message.
 * - `Composer` and `Welcome` render in the thread scope.
 * - `Text`, `Reasoning` and `ToolFallback` render once per part of an
 *   assistant message, in its part scope (`s.part`): text parts, reasoning
 *   parts, and tool calls without a registered tool UI (`registerToolUI`).
 * - `ToolGroup` and `ReasoningGroup` render once per run of consecutive tool
 *   calls or reasoning parts of an assistant message, in its message scope.
 *   They take a required `group` input (`AuiGroupPart`) and render the run's
 *   parts with `<aui-group-children [group]="group()" />`.
 * - `UserMessageAttachments` renders inside the default `UserMessage`, in the
 *   message scope; `ComposerAttachments` and `ComposerAddAttachment` render
 *   inside the default `Composer`, in the thread composer scope
 *   (`s.composer`).
 * - `TaskGroup` and `ComposerExtra` are optional and have no default:
 *   `TaskGroup` (a `group` input, message scope) renders tool calls that carry
 *   a nested conversation; `ComposerExtra` renders after the attach button, in
 *   the composer scope.
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
   * A reasoning part of an assistant message, inside its `ReasoningGroup`
   * (default: the part as markdown, `aui-markdown-text`).
   */
  Reasoning: Type<unknown>;
  /**
   * A run of consecutive tool calls of an assistant message, upstream's
   * `group-tool` group (default: a ghost `aui-tool-group`, closed until opened
   * and kept open while a call requires action). The component must declare a
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
  /**
   * A run of consecutive reasoning parts of an assistant message, upstream's
   * `group-reasoning` group (default: `aui-reasoning-group`, the collapsible
   * "Reasoning" frame, streaming while the group runs and labelled with its
   * duration). Same contract as `ToolGroup`: a required `group` input
   * (`AuiGroupPart`), and the parts (each through `Reasoning`) rendered with
   * `<aui-group-children [group]="group()" />`.
   */
  ReasoningGroup: Type<unknown>;
  /**
   * The attachments of a user message, above its bubble (default:
   * `aui-message-attachments-styled`). Renders in the message scope.
   */
  UserMessageAttachments: Type<unknown>;
  /**
   * The composer's pending attachments, above the input (default:
   * `aui-composer-attachments-styled`). Renders in the composer scope.
   */
  ComposerAttachments: Type<unknown>;
  /**
   * The composer's attach button, at the start of the action row (default:
   * `aui-composer-add-attachment-styled`). Renders in the composer scope.
   */
  ComposerAddAttachment: Type<unknown>;
  /**
   * Optional, no default. When set, a tool call that carries a nested
   * conversation (`part.messages`, for example a sub-agent task) and has no
   * registered tool UI is grouped as upstream's `group-task` and renders
   * through this component instead of the tool group; adjacent such calls share
   * one group. A registered tool UI still takes precedence. Without it, those
   * calls render like any other tool call. The component must declare a
   * required `group` input (`AuiGroupPart`) and renders in the message scope;
   * it renders the calls itself (for example from `s.message.parts` at
   * `group().indices`).
   */
  TaskGroup?: Type<unknown>;
  /**
   * Optional, no default. Extra controls in the composer's action row, after
   * the attach button (upstream's `ComposerExtra`). Renders in the composer
   * scope.
   */
  ComposerExtra?: Type<unknown>;
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
