// Ported from packages/core/src/react/primitives/part/PartMessages.tsx @ 7d74276
// and packages/core/src/react/providers/ReadonlyThreadProvider.tsx @ 7d74276
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  TemplateRef,
  contentChild,
  inject,
  input,
  type OnInit,
} from '@angular/core';
import type { ThreadMessage } from '@assistant-ui/core';
import {
  ReadonlyThreadRuntimeCore,
  ThreadRuntimeImpl,
  type ThreadListItemRuntimeBinding,
  type ThreadRuntimeCoreBinding,
} from '@assistant-ui/core/internal';
import { ThreadClient } from '@assistant-ui/core/store/internal';
import {
  AuiConfig,
  Derived,
  getProxiedAssistantState,
  type AssistantState,
} from '@assistant-ui/store/client';
import { injectAuiContext } from '../context/aui-context';
import { AuiScopeOutletComponent } from '../scope/scope-outlet.component';
import { injectAuiState } from '../state/inject-aui-state';
import {
  AuiMessageTemplateDirective,
  AuiThreadMessagesComponent,
} from './thread-messages.component';

const READONLY_THREAD_PATH = Object.freeze({
  ref: 'readonly-thread',
  threadSelector: { type: 'main' as const },
});

const READONLY_THREAD_LIST_ITEM = Object.freeze({
  id: 'readonly',
  remoteId: undefined,
  externalId: undefined,
  isMain: true,
  isRunning: false,
  status: 'regular' as const,
  title: undefined,
});

const READONLY_THREAD_LIST_ITEM_BINDING: ThreadListItemRuntimeBinding = Object.freeze({
  path: READONLY_THREAD_PATH,
  getState: () => READONLY_THREAD_LIST_ITEM,
  // The readonly list item never changes, so there is nothing to unsubscribe.
  subscribe: () => () => undefined,
});

/** The nested messages of the part, if it is a tool call that carries some. */
const nestedMessages = (state: AssistantState): readonly ThreadMessage[] | undefined => {
  const part = state.part;
  if (part.type !== 'tool-call') return undefined;
  return 'messages' in part ? (part.messages as readonly ThreadMessage[] | undefined) : undefined;
};

/** Internal: renders `template` with the injector of its own place in the tree. */
@Component({
  selector: 'aui-part-messages-row',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `<ng-container *ngTemplateOutlet="template(); injector: injector" />`,
})
export class AuiPartMessagesRowComponent {
  /** The template to render. */
  readonly template = input.required<TemplateRef<unknown>>();
  /** The injector of this row, which resolves the nested message scope. */
  protected readonly injector = inject(Injector);
}

/**
 * Renders the nested messages of a tool call part (for example a sub-agent
 * conversation) with the existing message primitives. It reads `messages`
 * from the current tool call part, runs them in a readonly thread scope
 * (`s.thread`, `s.message`, and the parts inside work as usual) and renders
 * the projected `ng-template auiMessage` once per nested message. Tool UIs
 * and other registrations of the parent scope are inherited. Renders nothing
 * while the part has no nested messages.
 *
 * Use inside a part scope, typically in the UI registered for the tool.
 *
 * @example
 * ```html
 * <aui-part-messages>
 *   <ng-template auiMessage>
 *     <div auiMessageRoot><aui-message-parts /></div>
 *   </ng-template>
 * </aui-part-messages>
 * ```
 */
@Component({
  selector: 'aui-part-messages',
  standalone: true,
  imports: [
    AuiScopeOutletComponent,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiPartMessagesRowComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    @if (hasMessages()) {
      <ng-template #thread>
        <aui-thread-messages>
          <ng-template auiMessage
            ><aui-part-messages-row [template]="row().templateRef"
          /></ng-template>
        </aui-thread-messages>
      </ng-template>
      <aui-scope-outlet [config]="config" [template]="thread" />
    }
  `,
})
export class AuiPartMessagesComponent implements OnInit {
  /** The per-message template, rendered inside the nested message's scope. */
  protected readonly row = contentChild.required(AuiMessageTemplateDirective);

  private readonly source = injectAuiContext().source;
  /** True while the part carries nested messages. */
  protected readonly hasMessages = injectAuiState((s) => (nestedMessages(s)?.length ?? 0) > 0);

  private readonly core = new ReadonlyThreadRuntimeCore();
  private synced: readonly ThreadMessage[] | undefined;

  /** The nested thread scope; built once over the readonly runtime. */
  protected readonly config: AuiConfig;

  constructor() {
    const core = this.core;
    const threadBinding: ThreadRuntimeCoreBinding = {
      path: READONLY_THREAD_PATH,
      getState: () => core,
      subscribe: (callback) => core.subscribe(callback),
      outerSubscribe: (callback) => core.subscribe(callback),
    };
    const runtime = new ThreadRuntimeImpl(threadBinding, READONLY_THREAD_LIST_ITEM_BINDING);
    this.config = AuiConfig({
      thread: ThreadClient({ runtime }),
      composer: Derived({
        source: 'thread',
        query: {},
        get: (aui) => aui.thread.composer(),
      }),
    });
    const unsubscribe = this.source.subscribe(() => this.sync());
    inject(DestroyRef).onDestroy(unsubscribe);
  }

  /** The client exists from the provider's first change, so first sync from here. */
  ngOnInit(): void {
    this.sync();
  }

  /** Pushes the part's current nested messages into the readonly runtime. */
  private sync(): void {
    const messages = nestedMessages(getProxiedAssistantState(this.source.getClient())) ?? [];
    if (messages === this.synced) return;
    this.synced = messages;
    this.core.setMessages(messages);
  }
}
