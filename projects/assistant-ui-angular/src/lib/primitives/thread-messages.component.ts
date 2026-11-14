// Ported from packages/vue/src/primitives/ThreadPrimitiveMessages.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  TemplateRef,
  computed,
  contentChild,
  inject,
} from '@angular/core';
import type { AuiConfig } from '@assistant-ui/store/client';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';
import { hasMessage, messageScopeConfig } from '../scope/message-scope';
import { AuiScopeOutletComponent } from '../scope/scope-outlet.component';

interface ThreadRow {
  readonly id: string;
  readonly key: string;
  readonly submission: boolean;
  readonly parentId: string | null;
}

const sameRows = (a: readonly ThreadRow[], b: readonly ThreadRow[]): boolean =>
  a.length === b.length && a.every((row, i) => row.key === b[i]!.key && row.id === b[i]!.id);

/**
 * Marks the `<ng-template>` that {@link AuiThreadMessagesComponent} renders
 * once per message.
 */
@Directive({
  selector: 'ng-template[auiMessage]',
  standalone: true,
})
export class AuiMessageTemplateDirective {
  /** The marked template. */
  readonly templateRef = inject<TemplateRef<unknown>>(TemplateRef);
}

/**
 * Renders the projected `ng-template auiMessage` once per message in the
 * current thread, each instance scoped to its message (descendants read it
 * through `s.message` and its edit composer through `s.composer`) and keyed
 * by the message id. A stable id keeps its row's DOM and component instances
 * across updates such as streaming deltas; a new id mounts a new row. The one
 * exception is a send landing: the in-transit row core shows for a sent
 * message (under a generated id) keeps its DOM and instances when the host's
 * message replaces it under its own id, and its scope is rebound to that
 * message. Adds no box of its own (`display: contents`).
 *
 * @example
 * ```html
 * <aui-thread-messages>
 *   <ng-template auiMessage><app-chat-message /></ng-template>
 * </aui-thread-messages>
 * ```
 */
@Component({
  selector: 'aui-thread-messages',
  standalone: true,
  imports: [AuiScopeOutletComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    @for (row of rows(); track row.key) {
      <aui-scope-outlet
        [config]="configFor(row.key, row.id)"
        [template]="messageTemplate().templateRef"
      />
    }
  `,
})
export class AuiThreadMessagesComponent {
  /** The projected per-message template. */
  protected readonly messageTemplate = contentChild.required(AuiMessageTemplateDirective);

  private readonly aui = injectAui();
  private readonly messages = injectAuiState((s) => s.thread.messages);
  private readonly threadId = injectAuiState((s) => s.optional.threads?.mainThreadId);

  /**
   * One `{ key, id }` per row. The key is the message id, except across the
   * send handoff: core shows a sent message first as an in-transit submission
   * row under a generated id, then the host's message replaces it under its
   * own id. That row keeps its key, so it is updated in place instead of being
   * re-created (which Angular reports as NG0956 when it is the whole list,
   * e.g. the first message of a thread). The list changes when a row's id
   * changes too, so the view rebinds the row's scope to the new message.
   */
  protected readonly rows = computed(() => this.computeRows(), { equal: sameRows });

  private previous: ThreadRow[] = [];
  private previousThread: string | undefined;
  private readonly configs = new Map<string, { id: string; config: AuiConfig }>();
  private prunedFor: readonly ThreadRow[] | undefined;
  private destroyed = false;

  private computeRows(): ThreadRow[] {
    const messages = this.messages();
    const thread = this.threadId();
    const sameThread = thread === this.previousThread;
    const previous = this.previous;
    const next = messages.map((message, index): ThreadRow => {
      const submission = message.submission !== undefined;
      const parentId = messages[index - 1]?.id ?? null;
      const known = previous.find((row) => row.id === message.id);
      if (known) return { id: message.id, key: known.key, submission, parentId };
      // A user message that appears where an in-transit submission row just
      // disappeared, under the same thread and parent, is that row, landed.
      const old = previous[index];
      if (
        sameThread &&
        old?.submission &&
        old.parentId === parentId &&
        !submission &&
        message.role === 'user' &&
        !messages.some((other) => other.id === old.id)
      ) {
        return { id: message.id, key: old.key, submission, parentId };
      }
      return { id: message.id, key: message.id, submission, parentId };
    });
    this.previous = next;
    this.previousThread = thread;
    return next;
  }

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.configs.clear();
    });
  }

  /** Returns the memoised scope config for the row `key` (rebuilt when its message id changes). */
  protected configFor(key: string, id: string): AuiConfig {
    const rows = this.rows();
    if (rows !== this.prunedFor) {
      this.prunedFor = rows;
      const live = new Set(rows.map((row) => row.key));
      for (const known of this.configs.keys()) {
        if (!live.has(known)) this.configs.delete(known);
      }
    }
    const existing = this.configs.get(key);
    if (existing && existing.id === id) return existing.config;
    const aui = this.aui;
    // A row whose id left the thread is about to be removed by `@for`, so
    // it is not "current": its expiry must not report it as stale.
    const config = messageScopeConfig(aui, id, () => !this.destroyed && hasMessage(aui, id));
    this.configs.set(key, { id, config });
    return config;
  }
}
