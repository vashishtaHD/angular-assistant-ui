// Ported from packages/vue/src/__tests__/primitives-tool-ui.test.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// (the `Tools` usage), run against a scripted transport on the local runtime.
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { ExternalStoreAdapter, ThreadMessageLike } from '@assistant-ui/core';
import { RuntimeAdapter } from '@assistant-ui/core/store';
import { AuiConfig, type AssistantClient } from '@assistant-ui/store/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { createExternalStoreRuntime } from '../runtime/factories';
import { injectAui } from '../state/inject-aui';
import { makeAssistantTool, registerTool, type AssistantToolProps } from './register-tool';
import type { ToolUIComponent, ToolUIProps } from './tool-ui';

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await Promise.resolve();
  }
};

/**
 * A scripted "transport": when the user sends a message the assistant answers
 * with a call to `toolName`; once the tool result is added it finishes with
 * text. The external store runs the tool invocations itself.
 */
const scriptedStore = (toolName: string, args: Record<string, unknown>) => {
  let messages: ThreadMessageLike[] = [];
  let isRunning = false;
  const adapter = (): ExternalStoreAdapter<ThreadMessageLike> => ({
    messages,
    isRunning,
    convertMessage: (m) => m,
    unstable_enableToolInvocations: true,
    onNew: async (message) => {
      const text = message.content.find((p) => p.type === 'text');
      messages = [
        { id: 'u1', role: 'user', content: [{ type: 'text', text: text?.text ?? '' }] },
        {
          id: 'a1',
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName,
              args: args as never,
              argsText: JSON.stringify(args),
            },
          ],
        },
      ];
      isRunning = true;
      store.update(adapter());
      // The model's turn ends with the tool call; only then does the client run it.
      await Promise.resolve();
      isRunning = false;
      store.update(adapter());
    },
    onAddToolResult: async ({ toolCallId, result }) => {
      messages = messages.map((m) =>
        m.id !== 'a1' || typeof m.content === 'string'
          ? m
          : {
              ...m,
              content: [
                ...m.content.map((p) =>
                  p.type === 'tool-call' && p.toolCallId === toolCallId ? { ...p, result } : p,
                ),
                { type: 'text' as const, text: 'Done.' },
              ],
            },
      );
      isRunning = false;
      store.update(adapter());
    },
  });
  const store = createExternalStoreRuntime(adapter());
  return store;
};

let aui: AssistantClient;
let config: AuiConfig;
let register: () => void = () => undefined;
let destroyRuntime: () => void = () => undefined;

@Component({
  selector: 'aui-test-registrar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class RegistrarComponent {
  constructor() {
    aui = injectAui();
    register();
  }
}

@Component({
  selector: 'aui-test-confirm',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button class="confirm" (click)="tool().addResult({ ok: true })">ok</button>`,
})
class ConfirmComponent implements ToolUIComponent {
  readonly tool = input.required<ToolUIProps>();
}

@Component({
  standalone: true,
  imports: [AuiProviderDirective, RegistrarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-container [auiProvider]="config"><aui-test-registrar /></ng-container>`,
})
class HostComponent {
  readonly config = config;
}

const mount = async (store: ReturnType<typeof scriptedStore>) => {
  destroyRuntime = () => store.destroy();
  config = AuiConfig({ threads: RuntimeAdapter(store.runtime) });
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  await settle(fixture);
  return fixture;
};

const send = (text: string) =>
  aui.thread().append({ role: 'user', content: [{ type: 'text', text }] });

const toolPart = () =>
  aui
    .thread()
    .getState()
    .messages.flatMap((m) => m.content as readonly { type: string }[])
    .find((p) => p.type === 'tool-call');

describe('registerTool with a scripted transport', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    destroyRuntime();
    register = () => undefined;
  });

  it('runs a frontend tool when the model calls it and records the result', async () => {
    const execute = vi.fn(async ({ city }: { city: string }) => ({ forecast: `sunny in ${city}` }));
    register = () =>
      registerTool({
        toolName: 'get_weather',
        type: 'frontend',
        description: 'Weather',
        parameters: { type: 'object', properties: { city: { type: 'string' } } },
        execute,
      });
    const fixture = await mount(scriptedStore('get_weather', { city: 'Paris' }));
    expect(aui.thread().getModelContext().tools?.['get_weather']).toBeDefined();

    send('weather?');
    await vi.waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(1);
      expect(toolPart()).toMatchObject({ result: { forecast: 'sunny in Paris' } });
    });
    expect(execute.mock.calls[0]?.[0]).toEqual({ city: 'Paris' });
    fixture.destroy();
  });

  it('waits for addResult on a human tool', async () => {
    const tool: AssistantToolProps = {
      toolName: 'confirm',
      type: 'human',
      description: 'Ask the user',
      parameters: { type: 'object', properties: {} },
      render: ConfirmComponent,
    };
    register = makeAssistantTool(tool);
    const fixture = await mount(scriptedStore('confirm', {}));

    send('do it?');
    await vi.waitFor(() => expect(toolPart()).toMatchObject({ toolName: 'confirm' }));
    expect(toolPart()).not.toHaveProperty('result');

    aui.thread().message({ index: 1 }).part({ index: 0 }).addToolResult({ ok: true });
    await vi.waitFor(() => expect(toolPart()).toMatchObject({ result: { ok: true } }));
    fixture.destroy();
  });
});
