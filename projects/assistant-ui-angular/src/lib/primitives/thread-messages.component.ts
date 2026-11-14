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
    @for (id of ids(); track id) {
      <aui-scope-outlet [config]="configFor(id)" [template]="messageTemplate().templateRef" />
    }
  `,
})
export class AuiThreadMessagesComponent {
  /** The projected per-message template. */
  protected readonly messageTemplate = contentChild.required(AuiMessageTemplateDirective);

  private readonly aui = injectAui();
  private readonly messages = injectAuiState((s) => s.thread.messages);
  /** The message ids, stable while they keep the same order. */
  protected readonly ids = stableKeys(() => this.messages().map((message) => message.id));

  private readonly configs = new Map<string, AuiConfig>();
  private prunedFor: readonly string[] | undefined;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.configs.clear();
    });
  }

  /** Returns the memoised scope config for `id`. */
  protected configFor(id: string): AuiConfig {
    const ids = this.ids();
    if (ids !== this.prunedFor) {
      this.prunedFor = ids;
      const live = new Set(ids);
      for (const key of this.configs.keys()) {
        if (!live.has(key)) this.configs.delete(key);
      }
    }
    let config = this.configs.get(id);
    if (!config) {
      const aui = this.aui;
      // A row whose id left the thread is about to be removed by `@for`, so
      // it is not "current": its expiry must not report it as stale.
      config = messageScopeConfig(aui, id, () => !this.destroyed && hasMessage(aui, id));
      this.configs.set(id, config);
    }
    return config;
  }
}
