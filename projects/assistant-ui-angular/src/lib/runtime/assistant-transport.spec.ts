import { ChangeDetectionStrategy, Component, type Signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { UserExternalState } from '@assistant-ui/core';
import type { AssistantClient } from '@assistant-ui/store/client';
import { AssistantTransportEncoder, createAssistantStream } from 'assistant-stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { injectAui } from '../state/inject-aui';
import {
  createAssistantTransportRuntime,
  injectAssistantTransportSendCommand,
  injectAssistantTransportState,
  type AssistantTransportRuntime,
  type AssistantTransportRuntimeOptions,
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

const sseResponse = (state: AgentState, init: ResponseInit = { status: 200 }) =>
  new Response(
    createAssistantStream((controller) => {
      controller.enqueue({
        type: 'update-state',
        path: [],
        operations: [{ type: 'set', path: ['messages'], value: state.messages as never }],
      });
    }).pipeThrough(new AssistantTransportEncoder()),
    init,
  );

/** A response whose body stays open until `finish()`, and errors when the request aborts. */
const heldResponse = (signal: AbortSignal | undefined) => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  signal?.addEventListener('abort', () => {
    try {
      controller.error(signal.reason);
    } catch {
      // already closed
    }
  });
  return {
    response: new Response(body, { status: 200 }),
    finish: () => {
      controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
      controller.close();
    },
  };
};

let aui: AssistantClient;
let sendCommand: (command: never) => void;
let agentMessages: Signal<UserExternalState>;
let transport: AssistantTransportRuntime<AgentState>;

@Component({
  selector: 'aui-test-probe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class ProbeComponent {
  constructor() {
    aui = injectAui();
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
  readonly config = transport.config;
}

const converter: AssistantTransportRuntimeOptions<AgentState>['converter'] = (
  state,
  { isSending },
) => ({
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
});

const send = (text: string, extra: { parentId?: string | null } = {}) =>
  aui.thread().append({ role: 'user', content: [{ type: 'text', text }], ...extra });

const bodyOf = (fetchMock: ReturnType<typeof vi.fn>, call: number) =>
  JSON.parse((fetchMock.mock.calls[call] as [string, RequestInit])[1].body as string);

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

  const mount = async (options: Partial<AssistantTransportRuntimeOptions<AgentState>> = {}) => {
    transport = createAssistantTransportRuntime<AgentState>({
      api: '/api/agent',
      protocol: 'assistant-transport',
      initialState: { messages: [] },
      headers: { 'x-test': '1' },
      converter,
      ...options,
    });
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

    send('hi', { parentId: null });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/agent');
    expect(new Headers(init.headers).get('x-test')).toBe('1');
    const body = bodyOf(fetchMock, 0);
    expect(body.commands).toHaveLength(1);
    expect(body.commands[0]).toMatchObject({
      type: 'add-message',
      message: { role: 'user', parts: [{ type: 'text', text: 'hi' }] },
    });
    expect(body.state).toEqual({ messages: [] });
    // The parent id of the appended message is consumed by the request.
    expect(body.parentId).toBeNull();

    await vi.waitFor(() =>
      expect(
        aui
          .thread()
          .getState()
          .messages.map((m) => m.id),
      ).toEqual(['u1', 'a1']),
    );
    await vi.waitFor(async () => {
      await settle(fixture);
      expect(agentMessages()).toHaveLength(2);
    });
    fixture.destroy();
  });

  it('posts the id of its own thread, stable across turns and different per thread', async () => {
    fetchMock.mockImplementation(async () => sseResponse({ messages: [] }));
    const fixture = await mount();

    send('one');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const first = bodyOf(fetchMock, 0).threadId;
    expect(first).toBeTruthy();
    expect(first).not.toBe('DEFAULT_THREAD_ID');
    expect(first).toBe(aui.threads().getState().mainThreadId);

    await vi.waitFor(() => expect(aui.thread().getState().isRunning).toBe(false));
    send('two');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(bodyOf(fetchMock, 1).threadId).toBe(first);

    // A new thread gets its own id and its own agent state.
    await vi.waitFor(() => expect(aui.thread().getState().isRunning).toBe(false));
    await aui.threads().switchToNewThread();
    await vi.waitFor(() => expect(aui.threads().getState().mainThreadId).not.toBe(first));
    send('three');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const third = bodyOf(fetchMock, 2);
    expect(third.threadId).toBe(aui.threads().getState().mainThreadId);
    expect(third.threadId).not.toBe(first);
    expect(third.state).toEqual({ messages: [] });
    fixture.destroy();
  });

  it('keeps a thread alive in the background: state kept and request not aborted across a switch', async () => {
    const signals: AbortSignal[] = [];
    const runs: { finish: () => void }[] = [];
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      signals.push(init.signal as AbortSignal);
      if (signals.length === 1) {
        return sseResponse({
          messages: [
            { id: 'u1', role: 'user', text: 'one' },
            { id: 'a1', role: 'assistant', text: 'reply' },
          ],
        });
      }
      const held = heldResponse(init.signal as AbortSignal);
      runs.push(held);
      return held.response;
    });
    const fixture = await mount();

    send('one');
    await vi.waitFor(() =>
      expect(
        aui
          .thread()
          .getState()
          .messages.map((m) => m.id),
      ).toEqual(['u1', 'a1']),
    );
    await vi.waitFor(() => expect(aui.thread().getState().isRunning).toBe(false));
    const threadA = aui.threads().getState().mainThreadId;

    // A second request stays in flight while the user moves to a new thread.
    send('two');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await aui.threads().switchToNewThread();
    await vi.waitFor(() => expect(aui.threads().getState().mainThreadId).not.toBe(threadA));
    expect(aui.thread().getState().messages).toHaveLength(0);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(signals[1]!.aborted).toBe(false);

    // Switching back shows the same conversation, and the run is still going.
    await aui.threads().switchToThread(threadA);
    await vi.waitFor(() =>
      expect(
        aui
          .thread()
          .getState()
          .messages.map((m) => m.id),
      ).toContain('a1'),
    );
    expect(
      aui
        .thread()
        .getState()
        .messages.map((m) => m.id)
        .slice(0, 2),
    ).toEqual(['u1', 'a1']);
    expect(signals[1]!.aborted).toBe(false);
    runs[0]!.finish();
    await vi.waitFor(() => expect(aui.thread().getState().isRunning).toBe(false));
    expect(signals[1]!.aborted).toBe(false);
    fixture.destroy();
  });

  it('finishes a backgrounded run into its own thread while another thread is shown', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      signals.push(init.signal as AbortSignal);
      if (signals.length === 1) {
        return sseResponse({
          messages: [
            { id: 'u1', role: 'user', text: 'one' },
            { id: 'a1', role: 'assistant', text: 'reply' },
          ],
        });
      }
      return new Response(
        createAssistantStream(async (controller) => {
          await gate;
          controller.enqueue({
            type: 'update-state',
            path: [],
            operations: [
              {
                type: 'set',
                path: ['messages'],
                value: [
                  { id: 'u1', role: 'user', text: 'one' },
                  { id: 'a1', role: 'assistant', text: 'reply' },
                  { id: 'u2', role: 'user', text: 'two' },
                  { id: 'a2', role: 'assistant', text: 'second reply' },
                ] as never,
              },
            ],
          });
        }).pipeThrough(new AssistantTransportEncoder()),
        { status: 200 },
      );
    });
    const fixture = await mount();
    const ids = () =>
      aui
        .thread()
        .getState()
        .messages.map((m) => m.id);

    send('one');
    await vi.waitFor(() => expect(ids()).toEqual(['u1', 'a1']));
    await vi.waitFor(() => expect(aui.thread().getState().isRunning).toBe(false));
    const threadA = aui.threads().getState().mainThreadId;

    send('two');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(aui.thread().getState().isRunning).toBe(true));
    await aui.threads().switchToNewThread();
    await vi.waitFor(() => expect(aui.threads().getState().mainThreadId).not.toBe(threadA));
    const threadB = aui.threads().getState().mainThreadId;

    // A's run finishes while B is shown: B stays idle and empty.
    release();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await settle(fixture);
    expect(aui.threads().getState().mainThreadId).toBe(threadB);
    expect(aui.thread().getState().isRunning).toBe(false);
    expect(ids()).toEqual([]);
    expect(signals[1]!.aborted).toBe(false);

    // Back on A, the run has published its reply and stopped.
    await aui.threads().switchToThread(threadA);
    await vi.waitFor(() => expect(ids()).toEqual(['u1', 'a1', 'u2', 'a2']));
    expect(aui.thread().getState().isRunning).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fixture.destroy();
  });

  it('stays destroyed: a thread mounted after destroy() never runs', async () => {
    fetchMock.mockImplementation(async () => sseResponse({ messages: [] }));
    const fixture = await mount();
    send('one');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(aui.thread().getState().isRunning).toBe(false));

    const first = aui.threads().getState().mainThreadId;
    transport.destroy();
    await aui.threads().switchToNewThread();
    await vi.waitFor(() => expect(aui.threads().getState().mainThreadId).not.toBe(first));
    send('two');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
    expect(bodyOf(fetchMock, 0).commands[0]).toMatchObject({
      type: 'add-tool-result',
      toolCallId: 'c1',
    });
    fixture.destroy();
  });

  it('reports a failed request through onError and cancels the queued commands', async () => {
    const onError = vi.fn();
    const onCancel = vi.fn();
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));
    const fixture = await mount({ onError, onCancel });
    send('x');
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect((onError.mock.calls[0]![0] as Error).message).toContain('Status 500');
    expect(onError.mock.calls[0]![1].commands).toHaveLength(1);
    await vi.waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    expect(onCancel.mock.calls[0]![0].error).toBeInstanceOf(Error);
    fixture.destroy();
  });

  it('onCancel receives the in-transit and queued commands when the run is cancelled', async () => {
    const onCancel = vi.fn();
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      return heldResponse(init.signal as AbortSignal).response;
    });
    const fixture = await mount({ onCancel });

    send('first');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // Queued behind the running request (no schedule needed to stay queued).
    sendCommand({
      type: 'add-tool-result',
      toolCallId: 'q',
      toolName: 't',
      result: 1,
      isError: false,
    } as never);

    aui.thread().cancelRun();
    await vi.waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    const { commands } = onCancel.mock.calls[0]![0];
    expect(commands.map((c: { type: string }) => c.type).sort()).toEqual([
      'add-message',
      'add-tool-result',
    ]);
    // Nothing further is sent after a cancel.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });

  it('coalesces commands queued during a run into a single follow-up run', async () => {
    const runs: { finish: () => void }[] = [];
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const held = heldResponse(init.signal as AbortSignal);
      runs.push(held);
      return held.response;
    });
    const fixture = await mount();

    send('first');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    for (const id of ['a', 'b', 'c']) {
      sendCommand({
        type: 'add-tool-result',
        toolCallId: id,
        toolName: 't',
        result: 1,
        isError: false,
      } as never);
    }
    // Still one request in flight.
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    runs[0]!.finish();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(bodyOf(fetchMock, 1).commands.map((c: { toolCallId: string }) => c.toolCallId)).toEqual([
      'a',
      'b',
      'c',
    ]);
    runs[1]!.finish();
    await vi.waitFor(() => expect(aui.thread().getState().isRunning).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fixture.destroy();
  });

  describe('resume', () => {
    const resumeOptions = {
      canResume: true,
      resumeApi: '/api/resume',
      resumeStateApi: '/api/resume-state',
    };

    it('skips the resume when the server retains no run (204)', async () => {
      fetchMock.mockImplementation(async () => new Response(null, { status: 204 }));
      const onError = vi.fn();
      const fixture = await mount({ ...resumeOptions, onError });
      aui.thread().resumeRun({ parentId: null });
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect((fetchMock.mock.calls[0] as [string])[0]).toBe('/api/resume-state');
      await vi.waitFor(() => expect(aui.thread().getState().isRunning).toBe(false));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
      fixture.destroy();
    });

    it('replays a retained run from its snapshot, without sending the local state', async () => {
      fetchMock.mockImplementation(async (url: string) =>
        url === '/api/resume-state'
          ? new Response(
              JSON.stringify({
                runId: 'run-1',
                state: { messages: [{ id: 'a1', role: 'assistant', text: 'partial' }] },
              }),
              { status: 200 },
            )
          : sseResponse({ messages: [{ id: 'a1', role: 'assistant', text: 'complete' }] }),
      );
      const fixture = await mount(resumeOptions);
      aui.thread().resumeRun({ parentId: null });

      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      expect((fetchMock.mock.calls[1] as [string])[0]).toBe('/api/resume');
      const body = bodyOf(fetchMock, 1);
      expect(body.runId).toBe('run-1');
      expect(body).not.toHaveProperty('state');
      expect(body.commands).toEqual([]);
      await vi.waitFor(() => expect(agentTexts()).toEqual(['complete']));
      fixture.destroy();
    });

    const agentTexts = () =>
      aui
        .thread()
        .getState()
        .messages.map((m) => (m.content[0] as { text: string }).text);
  });
});
