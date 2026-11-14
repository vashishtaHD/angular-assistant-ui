// Ported from packages/vue/src/primitives/ThreadPrimitiveMessages.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  TemplateRef,
  contentChild,
  inject,
} from '@angular/core';
import type { AuiConfig } from '@assistant-ui/store/client';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';
import { hasMessage, messageScopeConfig } from '../scope/message-scope';
import { AuiScopeOutletComponent } from '../scope/scope-outlet.component';
import { stableKeys } from '../scope/stable-keys';

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
 * across updates such as streaming deltas; a new id mounts a new row. Adds no
 * box of its own (`display: contents`).
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
    @for (key of keys(); track key) {
      <aui-scope-outlet [config]="configFor(key)" [template]="messageTemplate().templateRef" />
    }
  `,
})
export class AuiThreadMessagesComponent {
  /** The projected per-message template. */
  protected readonly messageTemplate = contentChild.required(AuiMessageTemplateDirective);

  private readonly aui = injectAui();
  private readonly messages = injectAuiState((s) => s.thread.messages);
  /**
   * One key per row, stable while the rows keep the same order. A key is the
   * message id, except across the send handoff: core shows a sent message first
   * as an in-transit submission row under a generated id, then the host's
   * message replaces it under its own id. That row keeps its key, so it is
   * updated in place instead of being re-created (which Angular reports as
   * NG0956 when it is the whole list, e.g. the first message of a thread).
   */
  protected readonly keys = stableKeys(() => this.computeKeys());

  private rows: { id: string; key: string; submission: boolean }[] = [];
  private readonly idByKey = new Map<string, string>();
  private readonly configs = new Map<string, { id: string; config: AuiConfig }>();
  private prunedFor: readonly string[] | undefined;
  private destroyed = false;

  private computeKeys(): string[] {
    const messages = this.messages();
    const previous = this.rows;
    const next = messages.map((message, index) => {
      const submission = message.submission !== undefined;
      const known = previous.find((row) => row.id === message.id);
      if (known) return { id: message.id, key: known.key, submission };
      // A user message that appears where an in-transit submission row just
      // disappeared is that row, landed.
      const old = previous[index];
      if (
        old?.submission &&
        !submission &&
        message.role === 'user' &&
        !messages.some((other) => other.id === old.id)
      ) {
        return { id: message.id, key: old.key, submission };
      }
      return { id: message.id, key: message.id, submission };
    });
    this.rows = next;
    this.idByKey.clear();
    for (const row of next) this.idByKey.set(row.key, row.id);
    return next.map((row) => row.key);
  }

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.configs.clear();
    });
  }

  /** Returns the memoised scope config for the row `key` (rebuilt when its message id changes). */
  protected configFor(key: string): AuiConfig {
    const keys = this.keys();
    if (keys !== this.prunedFor) {
      this.prunedFor = keys;
      const live = new Set(keys);
      for (const known of this.configs.keys()) {
        if (!live.has(known)) this.configs.delete(known);
      }
    }
    const id = this.idByKey.get(key) ?? key;
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
