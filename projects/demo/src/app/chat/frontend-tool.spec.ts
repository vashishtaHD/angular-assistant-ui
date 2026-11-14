import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AISDKChat } from '@assistant-ui/ai-sdk';
import type { UIMessageChunk } from 'ai';
import {
  AuiConfig,
  AuiProviderDirective,
  injectAui,
  registerTool,
  type AssistantClient,
} from 'angular-assistant-ui';
import { createScriptedChatTransport } from 'angular-assistant-ui/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

const toolTurn = (toolName: string, input: unknown): UIMessageChunk[] => [
  { type: 'start' },
  { type: 'start-step' },
  { type: 'tool-input-start', toolCallId: 'call-1', toolName },
  { type: 'tool-input-available', toolCallId: 'call-1', toolName, input },
  { type: 'finish-step' },
  { type: 'finish' },
];

const textTurn = (text: string): UIMessageChunk[] => [
  { type: 'start' },
  { type: 'text-start', id: 't1' },
  { type: 'text-delta', id: 't1', delta: text },
  { type: 'text-end', id: 't1' },
  { type: 'finish' },
];

let aui: AssistantClient;
const execute = vi.fn(async ({ city }: { city: string }) => ({ forecast: `sunny in ${city}` }));

@Component({
  selector: 'app-tool-registrar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class ToolRegistrarComponent {
  constructor() {
    aui = injectAui();
    registerTool({
      toolName: 'get_weather',
      type: 'frontend',
      description: 'Weather',
      parameters: { type: 'object', properties: { city: { type: 'string' } } },
      execute,
    });
  }
}

@Component({
  standalone: true,
  imports: [AuiProviderDirective, ToolRegistrarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-container [auiProvider]="config"><app-tool-registrar /></ng-container>`,
})
class HostComponent {
  readonly config = AuiConfig({
    threads: AISDKChat({
      transport: createScriptedChatTransport([
        { chunks: toolTurn('get_weather', { city: 'Paris' }) },
        { chunks: textTurn('Done.') },
      ]),
    }),
  });
}

describe('registerTool over the AI SDK runtime with a scripted transport', () => {
  afterEach(() => {
    execute.mockClear();
    TestBed.resetTestingModule();
  });

  it('exposes the tool to the model, runs execute on the call and records the result', async () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.autoDetectChanges(true);
    await fixture.whenStable();

    expect(aui.thread().getModelContext().tools?.['get_weather']).toBeDefined();

    aui.thread().append({ role: 'user', content: [{ type: 'text', text: 'weather?' }] });
    await vi.waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(1);
      const part = aui
        .thread()
        .getState()
        .messages.flatMap((m) => m.content as readonly { type: string; result?: unknown }[])
        .find((p) => p.type === 'tool-call');
      expect(part?.result).toEqual({ forecast: 'sunny in Paris' });
    });
    expect(execute.mock.calls[0]?.[0]).toEqual({ city: 'Paris' });
    fixture.destroy();
  });
});
