import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { InMemoryThreadListAdapter, type ThreadMessage } from '@assistant-ui/core';
import { RuntimeAdapter } from '@assistant-ui/core/store';
import { AuiConfig, type AssistantClient } from '@assistant-ui/store/client';
import { flushTapSync } from '@assistant-ui/tap';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime } from '../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { injectAui } from '../state/inject-aui';
import { unstable_injectThreadMessageIds } from '../state/inject-thread-message-ids';
import { createExternalMessageConverter } from './external-message-converter';
import {
  createExternalStoreRuntime,
  createLocalRuntime,
  remoteThreadListConfig,
} from './factories';
import * as api from './re-exports';
import {
  messageObjectScope,
  readonlyThreadScope,
  textMessagePartScope,
  type ReadonlyThreadScope,
} from './scopes';

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await Promise.resolve();
  }
};

let outer: AssistantClient;
let inner: AssistantClient;
let ids: ReturnType<typeof unstable_injectThreadMessageIds>;

@Component({
  selector: 'aui-test-outer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class OuterProbeComponent {
  constructor() {
    outer = injectAui();
    ids = unstable_injectThreadMessageIds();
  }
}

@Component({
  selector: 'aui-test-inner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class InnerProbeComponent {
  constructor() {
    inner = injectAui();
  }
}

let scopeConfig: AuiConfig;
let hostConfig: AuiConfig;

@Component({
  selector: 'aui-test-scope-box',
  standalone: true,
  imports: [AuiProviderDirective, InnerProbeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="scope" [auiProviderExtends]="aui">
      <aui-test-inner />
    </ng-container>
  `,
})
class ScopeBoxComponent {
  protected readonly aui = injectAui();
  protected readonly scope = scopeConfig;
}

@Component({
  standalone: true,
  imports: [AuiProviderDirective, OuterProbeComponent, ScopeBoxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-test-outer />
      <aui-test-scope-box />
    </ng-container>
  `,
})
class HostComponent {
  readonly config = hostConfig;
}

const mountScope = async (scope: AuiConfig) => {
  const rt = createTestRuntime();
  hostConfig = rt.config;
  scopeConfig = scope;
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  await settle(fixture);
  return { fixture, rt };
};

const threadMessage = (id: string, text: string): ThreadMessage =>
  ({
    id,
    role: 'assistant',
    createdAt: new Date(0),
    content: [{ type: 'text', text }],
    status: { type: 'complete', reason: 'stop' },
    metadata: {
      unstable_state: undefined,
      unstable_annotations: [],
      unstable_data: [],
      steps: [],
      custom: {},
    },
  }) as unknown as ThreadMessage;

describe('runtime factories', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('createExternalStoreRuntime publishes adapter updates', () => {
    const store = createExternalStoreRuntime({
      messages: [{ id: 'm1', role: 'assistant' as const, content: 'hi' }],
      convertMessage: (m) => m,
      onNew: async () => undefined,
    });
    expect(store.runtime.thread.getState().messages.map((m) => m.id)).toEqual(['m1']);
    store.update({
      messages: [
        { id: 'm1', role: 'assistant' as const, content: 'hi' },
        { id: 'm2', role: 'assistant' as const, content: 'there' },
      ],
      convertMessage: (m) => m,
      onNew: async () => undefined,
    });
    expect(store.runtime.thread.getState().messages.map((m) => m.id)).toEqual(['m1', 'm2']);
    store.destroy();
  });

  it('createLocalRuntime runs the chat model', async () => {
    const local = createLocalRuntime({
      async *run() {
        yield { content: [{ type: 'text', text: 'pong' }] };
      },
    });
    local.runtime.thread.append({ role: 'user', content: [{ type: 'text', text: 'ping' }] });
    await vi.waitFor(() => {
      const last = local.runtime.thread.getState().messages.at(-1);
      expect(last).toMatchObject({ role: 'assistant', content: [{ type: 'text', text: 'pong' }] });
    });
    local.destroy();
  });

  it('remoteThreadListConfig builds a thread list from per-thread runtimes', async () => {
    const runtimes = new Map<string, ReturnType<typeof createTestRuntime>>();
    const config = remoteThreadListConfig({
      adapter: new InMemoryThreadListAdapter(),
      runtime: (id) => {
        let rt = runtimes.get(id);
        if (!rt) {
          rt = createTestRuntime();
          runtimes.set(id, rt);
        }
        return rt.runtime;
      },
    });
    hostConfig = config;
    scopeConfig = AuiConfig({});
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await settle(fixture);
    expect(outer.threads().getState().isLoading).toBeDefined();
    fixture.destroy();
  });

  it('createExternalMessageConverter caches unchanged messages', () => {
    interface Source {
      id: string;
      role: 'user' | 'assistant';
      text: string;
    }
    const convert = createExternalMessageConverter<Source>((m) => ({
      id: m.id,
      role: m.role,
      content: m.text,
    }));
    const a: Source = { id: 'a', role: 'user', text: 'one' };
    const first = convert([a], false);
    const second = convert([a, { id: 'b', role: 'assistant', text: 'two' }], false);
    expect(second[0]).toBe(first[0]);
    expect(second.map((m) => m.id)).toEqual(['a', 'b']);
  });
});

describe('bare-object scopes', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('readonlyThreadScope renders a fixed transcript and can swap it', async () => {
    const scope: ReadonlyThreadScope = readonlyThreadScope([threadMessage('r1', 'one')]);
    const { fixture } = await mountScope(scope.config);
    expect(
      inner
        .thread()
        .getState()
        .messages.map((m) => m.id),
    ).toEqual(['r1']);
    // The outer thread is untouched.
    expect(outer.thread().getState().messages).toHaveLength(0);

    flushTapSync(() => scope.setMessages([threadMessage('r1', 'one'), threadMessage('r2', 'two')]));
    await vi.waitFor(() =>
      expect(
        inner
          .thread()
          .getState()
          .messages.map((m) => m.id),
      ).toEqual(['r1', 'r2']),
    );
    fixture.destroy();
  });

  it('textMessagePartScope provides a text part', async () => {
    const { fixture } = await mountScope(textMessagePartScope('streaming…', true));
    expect(inner.part().getState()).toMatchObject({
      type: 'text',
      text: 'streaming…',
      status: { type: 'running' },
    });
    expect(() => inner.part().addToolResult('x')).toThrow('Not supported');
    fixture.destroy();
  });

  it('messageObjectScope provides a message from a plain object', async () => {
    const { fixture } = await mountScope(
      messageObjectScope({ message: threadMessage('solo', 'hello'), index: 0, isLast: true }),
    );
    expect(inner.message().getState()).toMatchObject({ id: 'solo', isLast: true });
    fixture.destroy();
  });
});

describe('unstable_injectThreadMessageIds', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('keeps its identity across content-only updates', async () => {
    const { fixture, rt } = await mountScope(AuiConfig({}));
    flushTapSync(() => rt.append({ id: 'm1', role: 'user', content: 'hi' }));
    await vi.waitFor(() => expect(ids()).toEqual(['m1']));
    const before = ids();
    flushTapSync(() => rt.setMessages([{ id: 'm1', role: 'user', content: 'hi there' }]));
    await vi.waitFor(() => expect(outer.thread().getState().messages[0]).toBeDefined());
    expect(ids()).toBe(before);
    flushTapSync(() => rt.append({ id: 'm2', role: 'assistant', content: 'yo' }));
    await vi.waitFor(() => expect(ids()).toEqual(['m1', 'm2']));
    fixture.destroy();
  });
});

describe('re-exports', () => {
  it('exposes the core values', () => {
    for (const name of [
      'ModelContextRegistry',
      'mergeModelContexts',
      'createMessageQueue',
      'fromThreadMessageLike',
      'generateId',
      'isMessageNotSentError',
      'toolApprovalAcceptsText',
      'tool',
      'Tools',
      'defineToolkit',
      'defineMcpToolkit',
      'stubTool',
      'humanTool',
      'hitl',
      'hitlTool',
      'providerTool',
      'externalTool',
      'ExternalThread',
      'InMemoryThreadList',
      'RemoteThreadList',
      'SingleThreadList',
      'ChainOfThoughtClient',
      'ModelContextClient',
      'Interactables',
      'unstable_Interactables',
      'createSimpleTitleAdapter',
      'unstable_convertExternalMessages',
      'unstable_createExternalMessageConversionCache',
      'unstable_createMessageConverter',
      'unstable_getInteractableSnapshots',
      'unstable_formatInteractableSnapshot',
      'unstable_getInteractableVersions',
      'pickExternalStoreSharedOptions',
      'getExternalStoreMessages',
      'bindExternalStoreMessage',
      'ExportedMessageRepository',
      'MessageNotSentError',
    ]) {
      expect((api as Record<string, unknown>)[name], name).toBeDefined();
    }
  });

  it('keeps the runtime adapter mountable', () => {
    const rt = createTestRuntime();
    expect(AuiConfig({ threads: RuntimeAdapter(rt.runtime) })).toBeDefined();
  });
});
