// Ported from packages/vue/src/__tests__/primitives-content.test.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// (MessagePrimitiveParts cases) and packages/vue/src/__tests__/primitives-tool-ui.test.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { Toolkit } from '@assistant-ui/core/react';
import { Tools } from '@assistant-ui/core/react';
import { RuntimeAdapter } from '@assistant-ui/core/store';
import { AuiConfig, type AssistantClient } from '@assistant-ui/store/client';
import { flushTapSync } from '@assistant-ui/tap';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime, type DemoMessage } from '../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';
import type { DataUIProps, ToolsScopeRender } from '../tools/tool-ui';
import { AuiMessagePartsComponent, AuiPartTemplateDirective } from './message-parts.component';
import {
  AuiMessageTemplateDirective,
  AuiThreadMessagesComponent,
} from './thread-messages.component';

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await Promise.resolve();
  }
};

const waitFor = async (fixture: ComponentFixture<unknown>, assertion: () => void) => {
  await vi.waitFor(async () => {
    await settle(fixture);
    assertion();
  });
};

let capturedAui: AssistantClient | undefined;

@Component({
  selector: 'aui-test-capture',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class CaptureComponent {
  constructor() {
    capturedAui = injectAui();
  }
}

@Component({
  selector: 'aui-test-tool-probe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="tool">{{ name() }}</span>`,
})
class ToolProbeComponent {
  readonly name = injectAuiState((s) => (s.part.type === 'tool-call' ? s.part.toolName : ''));
}

let hostConfig: AuiConfig;

const element = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;

const mount = async <T>(host: new () => T, config: AuiConfig) => {
  hostConfig = config;
  configureTestBed({ imports: [host] });
  const fixture = TestBed.createComponent(host);
  fixture.detectChanges();
  await settle(fixture);
  return fixture;
};

const toolCall = (toolName: string, extra: Record<string, unknown> = {}): DemoMessage => ({
  role: 'assistant',
  content: [{ type: 'tool-call', toolCallId: 'call-1', toolName, args: { city: 'sf' }, ...extra }],
});

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessagePartsComponent,
    AuiPartTemplateDirective,
    ToolProbeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage>
          <li>
            <aui-message-parts>
              <ng-template auiPart="tool-call"><aui-test-tool-probe /></ng-template>
            </aui-message-parts>
          </li>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class ToolTemplateHostComponent {
  readonly config = hostConfig;
}

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessagePartsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage
          ><li><aui-message-parts /></li
        ></ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class BareHostComponent {
  readonly config = hostConfig;
}

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessagePartsComponent,
    AuiPartTemplateDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage>
          <li>
            <aui-message-parts>
              <ng-template auiPart="text" let-part>
                <b class="text">{{ part.type === 'text' ? part.text : '' }}</b>
              </ng-template>
            </aui-message-parts>
          </li>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class TextTemplateHostComponent {
  readonly config = hostConfig;
}

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessagePartsComponent,
    AuiPartTemplateDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage>
          <li>
            <aui-message-parts>
              <ng-template auiPart="default"><span class="fallback">[tool]</span></ng-template>
            </aui-message-parts>
          </li>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class DefaultTemplateHostComponent {
  readonly config = hostConfig;
}

@Component({
  selector: 'aui-test-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="data">{{ data().part.data.a }}</span>`,
})
class ChartComponent {
  readonly data = input.required<DataUIProps<{ a: number }>>();
}

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessagePartsComponent,
    AuiPartTemplateDirective,
    CaptureComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-test-capture />
      <aui-thread-messages>
        <ng-template auiMessage>
          <li>
            <aui-message-parts>
              <ng-template auiPart="data"><span class="slot">[slot]</span></ng-template>
            </aui-message-parts>
          </li>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class DataHostComponent {
  readonly config = hostConfig;
}

describe('AuiMessagePartsComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    capturedAui = undefined;
  });

  it('renders text parts as pre-line paragraphs', async () => {
    const rt = createTestRuntime();
    const fixture = await mount(BareHostComponent, rt.config);
    flushTapSync(() => rt.append({ role: 'assistant', content: [{ type: 'text', text: 'a\nb' }] }));
    await waitFor(fixture, () => expect(element(fixture).querySelector('p')).not.toBeNull());

    const p = element(fixture).querySelector('p')!;
    expect(p.style.whiteSpace).toBe('pre-line');
    expect(p.textContent).toBe('a\nb');
    fixture.destroy();
  });

  it('uses the text template when provided', async () => {
    const rt = createTestRuntime();
    const fixture = await mount(TextTemplateHostComponent, rt.config);
    flushTapSync(() =>
      rt.append({ role: 'assistant', content: [{ type: 'text', text: 'hello' }] }),
    );
    await waitFor(fixture, () =>
      expect(element(fixture).querySelector('b.text')?.textContent).toBe('hello'),
    );
    expect(element(fixture).querySelector('p')).toBeNull();
    fixture.destroy();
  });

  it('renders text parts by default and routes typed templates in order', async () => {
    const rt = createTestRuntime();
    const fixture = await mount(ToolTemplateHostComponent, rt.config);
    flushTapSync(() =>
      rt.append({
        role: 'assistant',
        content: [
          { type: 'text', text: 'before ' },
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'search', args: {} },
          { type: 'text', text: ' after' },
        ],
      }),
    );
    await waitFor(fixture, () =>
      expect(element(fixture).querySelector('span.tool')?.textContent).toBe('search'),
    );
    expect(element(fixture).querySelector('li')!.textContent).toBe('before search after');
    fixture.destroy();
  });

  it('keeps text rendering when only a default template is provided', async () => {
    const rt = createTestRuntime();
    const fixture = await mount(DefaultTemplateHostComponent, rt.config);
    flushTapSync(() =>
      rt.append({
        role: 'assistant',
        content: [
          { type: 'text', text: 'hello' },
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'search', args: {} },
        ],
      }),
    );
    await waitFor(fixture, () =>
      expect(element(fixture).querySelector('span.fallback')).not.toBeNull(),
    );
    expect(element(fixture).querySelector('li')!.textContent!.trim()).toBe('hello[tool]');
    fixture.destroy();
  });

  it('renders nothing for a part type without a template and warns once per type', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const rt = createTestRuntime();
    flushTapSync(() =>
      rt.append({
        role: 'assistant',
        content: [
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'search', args: {} },
          { type: 'tool-call', toolCallId: 'call-2', toolName: 'search', args: {} },
          { type: 'reasoning', text: 'thinking' },
          { type: 'text', text: 'visible' },
        ],
      }),
    );
    for (let round = 0; round < 2; round++) {
      const fixture = await mount(BareHostComponent, rt.config);
      await waitFor(fixture, () => expect(element(fixture).textContent).toBe('visible'));
      expect(warn).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('no template for part type "tool-call"'),
      );
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('no template for part type "reasoning"'),
      );
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Add an <ng-template auiPart="reasoning"> or auiPart="default" template.',
        ),
      );
      fixture.destroy();
      TestBed.resetTestingModule();
    }
  });

  it('keeps part DOM while streaming and drops removed parts quietly', async () => {
    const rt = createTestRuntime();
    const fixture = await mount(BareHostComponent, rt.config);
    const msg = (texts: string[]): DemoMessage => ({
      id: 'a1',
      role: 'assistant',
      content: texts.map((text) => ({ type: 'text' as const, text })),
    });
    flushTapSync(() => rt.setMessages([msg(['one', 'two', 'thr'])]));
    await waitFor(fixture, () => expect(element(fixture).querySelectorAll('p')).toHaveLength(3));
    const first = element(fixture).querySelector('p');

    flushTapSync(() => rt.setMessages([msg(['one, streaming', 'two', 'thr'])]));
    await waitFor(fixture, () =>
      expect(element(fixture).querySelector('p')?.textContent).toBe('one, streaming'),
    );
    expect(element(fixture).querySelector('p')).toBe(first);

    const error = vi.spyOn(console, 'error');
    const warn = vi.spyOn(console, 'warn');
    flushTapSync(() => rt.setMessages([msg(['one, streaming'])]));
    await waitFor(fixture, () => expect(element(fixture).querySelectorAll('p')).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve));
    expect(element(fixture).querySelector('p')).toBe(first);
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('renders toolkit renderText for a complete tool call', async () => {
    const rt = createTestRuntime();
    const toolkit = {
      weather: {
        type: 'frontend',
        description: 'Looks up the weather.',
        parameters: { type: 'object', properties: {} },
        execute: async () => 'sunny',
        renderText: {
          running: ({ args }: { args: { city: string } }) => `Checking ${args.city}...`,
          complete: ({ args, result }: { args: { city: string }; result: string | undefined }) =>
            `${result} in ${args.city}`,
        },
      },
    } as unknown as Toolkit;
    const fixture = await mount(
      ToolTemplateHostComponent,
      AuiConfig({ threads: RuntimeAdapter(rt.runtime), tools: Tools({ toolkit }) }),
    );
    flushTapSync(() => rt.append(toolCall('weather', { result: 'sunny' })));
    await waitFor(fixture, () => expect(element(fixture).textContent).toBe('sunny in sf'));
    expect(element(fixture).querySelector('span.tool')).toBeNull();
    fixture.destroy();
  });

  it('renders a registered data renderer for a data part', async () => {
    const rt = createTestRuntime();
    const fixture = await mount(DataHostComponent, rt.config);
    // Data renderers are typed as React components; cast at the seam as the
    // tools registration does.
    flushTapSync(() =>
      capturedAui!.dataRenderers.setDataUI(
        'chart',
        ChartComponent as unknown as Parameters<AssistantClient['dataRenderers']['setDataUI']>[1],
      ),
    );
    flushTapSync(() =>
      rt.append({ role: 'assistant', content: [{ type: 'data', name: 'chart', data: { a: 1 } }] }),
    );
    await waitFor(fixture, () =>
      expect(element(fixture).querySelector('span.data')?.textContent).toBe('1'),
    );
    expect(element(fixture).querySelector('span.slot')).toBeNull();
    fixture.destroy();
  });

  it('uses the data template when no renderer is registered', async () => {
    const rt = createTestRuntime();
    const fixture = await mount(DataHostComponent, rt.config);
    flushTapSync(() =>
      rt.append({
        role: 'assistant',
        content: [{ type: 'data', name: 'unknown', data: { value: 'slot' } }],
      }),
    );
    await waitFor(fixture, () =>
      expect(element(fixture).querySelector('span.slot')?.textContent).toBe('[slot]'),
    );
    fixture.destroy();
  });

  it('renders tools.mcpApp for a tool call with a ui:// resource', async () => {
    const rt = createTestRuntime();
    @Component({
      selector: 'aui-test-mcp',
      standalone: true,
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<span class="mcp">{{ tool().part.toolName }}</span>`,
    })
    class McpComponent {
      readonly tool = input.required<{ part: { toolName: string } }>();
    }
    const { resource } = await import('@assistant-ui/tap');
    const McpApp = resource(function McpApp() {
      return { render: McpComponent as unknown as ToolsScopeRender };
    });
    const fixture = await mount(
      ToolTemplateHostComponent,
      AuiConfig({ threads: RuntimeAdapter(rt.runtime), tools: Tools({ mcpApp: McpApp() }) }),
    );
    flushTapSync(() =>
      rt.append({
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'show_chart',
            args: {},
            mcp: { app: { resourceUri: 'ui://chart' } },
          },
        ],
      }),
    );
    await waitFor(fixture, () =>
      expect(element(fixture).querySelector('span.mcp')?.textContent).toBe('show_chart'),
    );
    expect(element(fixture).querySelector('span.tool')).toBeNull();
    fixture.destroy();
  });
});
