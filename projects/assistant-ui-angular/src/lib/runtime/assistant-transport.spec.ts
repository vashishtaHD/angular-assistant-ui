import { ChangeDetectionStrategy, Component, type Signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { UserExternalState } from '@assistant-ui/core';
import { RuntimeAdapter } from '@assistant-ui/core/store';
import { AuiConfig } from '@assistant-ui/store/client';
import { AssistantTransportEncoder, createAssistantStream } from 'assistant-stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import {
  createAssistantTransportRuntime,
  injectAssistantTransportSendCommand,
  injectAssistantTransportState,
  type AssistantTransportRuntime,
} from './assistant-transport';

interface AgentState {
  messages: { id: string; role: 'user' | 'assistant'; text: string }[];
}

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await Promise.resolve();
  }
};

const sseResponse = (state: AgentState) =>
  new Response(
    createAssistantStream((controller) => {
      controller.enqueue({
        type: 'update-state',
        path: [],
        operations: [{ type: 'set', path: ['messages'], value: state.messages as never }],
      });
    }).pipeThrough(new AssistantTransportEncoder()),
    { status: 200 },
  );

let transport: AssistantTransportRuntime<AgentState>;
let sendCommand: (command: never) => void;
let agentMessages: Signal<UserExternalState>;
let config: AuiConfig;

@Component({
  selector: 'aui-test-probe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class ProbeComponent {
  constructor() {
    sendCommand = injectAssistantTransportSendCommand() as never;
    agentMessages = injectAssistantTransportState(
      (s) => (s as unknown as AgentState).messages,
    ) as never;
  }
}

@Component({
  standalone: true,
  imports: [AuiProviderDirective, ProbeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-container [auiProvider]="config"><aui-test-probe /></ng-container>`,
})
class HostComponent {
  readonly config = config;
}

describe('createAssistantTransportRuntime', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    transport?.destroy();
    TestBed.resetTestingModule();
  });

  const mount = async () => {
    transport = createAssistantTransportRuntime<AgentState>({
      api: '/api/agent',
      protocol: 'assistant-transport',
      initialState: { messages: [] },
      headers: { 'x-test': '1' },
      converter: (state, { isSending }) => ({
        isRunning: isSending,
        messages: state.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: [{ type: 'text' as const, text: m.text }],
          createdAt: new Date(0),
          ...(m.role === 'assistant'
            ? {
                status: { type: 'complete' as const, reason: 'stop' as const },
                metadata: {
                  unstable_state: undefined,
                  unstable_annotations: [],
                  unstable_data: [],
                  steps: [],
                  custom: {},
                },
              }
            : { attachments: [], metadata: { custom: {} } }),
        })) as never,
      }),
    });
    config = AuiConfig({ threads: RuntimeAdapter(transport.runtime) });
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await settle(fixture);
    return fixture;
  };

  it('posts a queued user message and applies the streamed state', async () => {
    fetchMock.mockImplementation(async () =>
      sseResponse({
        messages: [
          { id: 'u1', role: 'user', text: 'hi' },
          { id: 'a1', role: 'assistant', text: 'hello' },
        ],
      }),
    );
    const fixture = await mount();

    transport.runtime.thread.append({ role: 'user', content: [{ type: 'text', text: 'hi' }] });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/agent');
    expect(new Headers(init.headers).get('x-test')).toBe('1');
    const body = JSON.parse(init.body as string);
    expect(body.commands).toHaveLength(1);
    expect(body.commands[0]).toMatchObject({
      type: 'add-message',
      message: { role: 'user', parts: [{ type: 'text', text: 'hi' }] },
    });
    expect(body.state).toEqual({ messages: [] });

    await vi.waitFor(() => expect(transport.getState().messages).toHaveLength(2));
    await vi.waitFor(() =>
      expect(transport.runtime.thread.getState().messages.map((m) => m.id)).toEqual(['u1', 'a1']),
    );
    expect(transport.getState().messages).toHaveLength(2);
    await vi.waitFor(async () => {
      await settle(fixture);
      expect(agentMessages()).toHaveLength(2);
    });
    fixture.destroy();
  });

  it('sendCommand queues a custom command through the injected function', async () => {
    fetchMock.mockImplementation(async () => sseResponse({ messages: [] }));
    const fixture = await mount();
    sendCommand({
      type: 'add-tool-result',
      toolCallId: 'c1',
      toolName: 't',
      result: { ok: true },
      isError: false,
    } as never);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.commands[0]).toMatchObject({ type: 'add-tool-result', toolCallId: 'c1' });
    fixture.destroy();
  });

  it('reports a failed request through onError and keeps the runtime usable', async () => {
    const onError = vi.fn();
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));
    transport = createAssistantTransportRuntime<AgentState>({
      api: '/api/agent',
      initialState: { messages: [] },
      headers: {},
      converter: (state, { isSending }) => ({ isRunning: isSending, messages: [] as never }),
      onError,
    });
    transport.runtime.thread.append({ role: 'user', content: [{ type: 'text', text: 'x' }] });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect((onError.mock.calls[0]![0] as Error).message).toContain('Status 500');
    expect(onError.mock.calls[0]![1].commands).toHaveLength(1);
  });
});
