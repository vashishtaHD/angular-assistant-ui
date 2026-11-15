// Ported from packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx @ 7d74276
// (AssistantMessage grouped parts, UserMessageAttachments, ComposerAttachments and
// ComposerAddAttachment): the Task 17 parts wired into the styled thread
import { ChangeDetectionStrategy, Component, input, type Provider } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SimpleTextAttachmentAdapter } from '@assistant-ui/core';
import {
  AuiGroupChildrenComponent,
  AuiProviderDirective,
  injectAuiState,
  registerToolUI,
  type AuiGroupPart,
  type ToolUIProps,
} from 'angular-assistant-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../../src/testing-internal/test-bed';
import {
  createTestRuntime,
  type DemoMessage,
  type TestRuntime,
} from '../../../src/testing-internal/test-runtime';
import { AUI_THREAD_COMPONENTS } from '../thread-components.token';
import { AuiThreadComponent } from './thread.component';

let runtime: TestRuntime;

@Component({
  selector: 'app-weather-tool',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<b class="weather-tool">{{ tool().part.toolName }}</b>`,
})
class WeatherToolComponent {
  readonly tool = input.required<ToolUIProps>();
}

let registerWeather = false;

@Component({
  selector: 'app-tool-registrar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class ToolRegistrarComponent {
  constructor() {
    if (registerWeather) registerToolUI('weather', WeatherToolComponent);
  }
}

@Component({
  standalone: true,
  imports: [AuiProviderDirective, AuiThreadComponent, ToolRegistrarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [auiProvider]="config">
    <app-tool-registrar />
    <aui-thread />
  </div>`,
})
class HostComponent {
  readonly config = runtime.config;
}

@Component({
  selector: 'app-custom-fallback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<i class="custom-fallback">{{ name() }}</i>`,
})
class CustomFallbackComponent {
  protected readonly name = injectAuiState((s) =>
    s.part.type === 'tool-call' ? s.part.toolName : '?',
  );
}

@Component({
  selector: 'app-custom-reasoning',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<i class="custom-reasoning">{{ text() }}</i>`,
})
class CustomReasoningComponent {
  protected readonly text = injectAuiState((s) =>
    s.part.type === 'reasoning' ? s.part.text : '?',
  );
}

@Component({
  selector: 'app-custom-tool-group',
  standalone: true,
  imports: [AuiGroupChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="custom-tool-group" [attr.data-message]="messageId()">
    {{ group().indices.length }} calls
    <aui-group-children [group]="group()" />
  </section>`,
})
class CustomToolGroupComponent {
  readonly group = input.required<AuiGroupPart>();
  protected readonly messageId = injectAuiState((s) => s.message.id);
}

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 4; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

let mounted: HTMLElement | undefined;

async function mount(opts: { setup?: (rt: TestRuntime) => void; providers?: Provider[] } = {}) {
  runtime = createTestRuntime();
  opts.setup?.(runtime);
  configureTestBed({ imports: [HostComponent], providers: opts.providers ?? [] });
  const fixture = TestBed.createComponent(HostComponent);
  const root = fixture.nativeElement as HTMLElement;
  document.body.appendChild(root);
  mounted = root;
  fixture.detectChanges();
  await settle(fixture);
  return { fixture, root };
}

const tool = (id: string, toolName: string) => ({
  type: 'tool-call' as const,
  toolCallId: id,
  toolName,
  args: {},
  argsText: '{}',
  result: { ok: true },
});

/** text, reasoning, two tool calls, text. */
const mixedAssistant = (first = 'lookup', second = 'search'): DemoMessage => ({
  id: 'a1',
  role: 'assistant',
  content: [
    { type: 'text', text: 'Let me check.' },
    { type: 'reasoning', text: 'thinking hard' },
    tool('c1', first),
    tool('c2', second),
    { type: 'text', text: 'Done.' },
  ],
});

const tags = (scope: Element, selector: string) =>
  Array.from(scope.querySelectorAll(selector)).map((el) => el.localName);

afterEach(() => {
  mounted?.remove();
  mounted = undefined;
  registerWeather = false;
  vi.restoreAllMocks();
});

describe('aui-thread parts (Task 17 wiring)', () => {
  it('renders reasoning, then a tool group holding two tool fallbacks', async () => {
    const { root } = await mount({
      setup: (rt) => {
        rt.append({ id: 'u1', role: 'user', content: [{ type: 'text', text: 'q' }] });
        rt.append(mixedAssistant());
      },
    });
    const content = root.querySelector('[data-slot="aui_assistant-message-content"]')!;
    const chain = content.querySelector('[data-slot="aui_chain-of-thought"]');
    expect(chain).not.toBeNull();
    expect(tags(chain!, 'aui-reasoning, aui-tool-group')).toEqual([
      'aui-reasoning',
      'aui-tool-group',
    ]);
    expect(chain!.querySelector('aui-reasoning')?.textContent).toContain('thinking hard');
    const group = chain!.querySelector('aui-tool-group')!;
    expect(
      group.querySelector('[data-slot="aui_tool-group-root"]')?.getAttribute('data-variant'),
    ).toBe('ghost');
    expect(group.querySelector('[data-slot="aui_tool-group-trigger-label"]')?.textContent).toBe(
      '2 tool calls',
    );
    const fallbacks = Array.from(group.querySelectorAll('aui-tool-fallback'));
    expect(fallbacks).toHaveLength(2);
    expect(fallbacks[0]!.textContent).toContain('lookup');
    expect(fallbacks[1]!.textContent).toContain('search');
    // The texts stay outside the chain of thought, in order around it.
    const texts = Array.from(content.querySelectorAll('aui-markdown-text-styled'));
    expect(texts.map((t) => t.textContent?.trim())).toEqual(['Let me check.', 'Done.']);
    expect(chain!.querySelector('aui-markdown-text-styled')).toBeNull();
  });

  it('renders a registered tool UI in place of one fallback inside the group', async () => {
    registerWeather = true;
    const { root } = await mount({
      setup: (rt) => rt.append(mixedAssistant('weather', 'search')),
    });
    const group = root.querySelector('aui-tool-group')!;
    expect(Array.from(group.querySelectorAll('.weather-tool')).map((el) => el.textContent)).toEqual(
      ['weather'],
    );
    const fallbacks = Array.from(group.querySelectorAll('aui-tool-fallback'));
    expect(fallbacks).toHaveLength(1);
    expect(fallbacks[0]!.textContent).toContain('search');
  });

  it('keeps a lone tool call in a group and opens the group while a call requires action', async () => {
    const { root } = await mount({
      setup: (rt) =>
        rt.append({
          id: 'a1',
          role: 'assistant',
          content: [{ type: 'tool-call', toolCallId: 'c1', toolName: 'approve', args: {} }],
          status: { type: 'requires-action', reason: 'tool-calls' },
        }),
    });
    const group = root.querySelector('aui-tool-group')!;
    expect(group.querySelector('[data-slot="aui_tool-group-trigger-label"]')?.textContent).toBe(
      '1 tool call',
    );
    expect(
      group.querySelector('[data-slot="aui_tool-group-trigger"]')?.getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('renders the ToolFallback, Reasoning and ToolGroup overrides in the right scope', async () => {
    const { root } = await mount({
      providers: [
        {
          provide: AUI_THREAD_COMPONENTS,
          useValue: {
            ToolFallback: CustomFallbackComponent,
            Reasoning: CustomReasoningComponent,
            ToolGroup: CustomToolGroupComponent,
          },
        },
      ],
      setup: (rt) => rt.append(mixedAssistant()),
    });
    expect(root.querySelector('aui-tool-group')).toBeNull();
    expect(root.querySelector('aui-tool-fallback')).toBeNull();
    expect(root.querySelector('aui-reasoning')).toBeNull();
    expect(
      Array.from(root.querySelectorAll('.custom-reasoning')).map((el) => el.textContent),
    ).toEqual(['thinking hard']);
    const group = root.querySelector('.custom-tool-group')!;
    expect(group.getAttribute('data-message')).toBe('a1');
    expect(group.textContent).toContain('2 calls');
    expect(
      Array.from(group.querySelectorAll('.custom-fallback')).map((el) => el.textContent),
    ).toEqual(['lookup', 'search']);
  });

  it('renders a user message attachment as a styled tile', async () => {
    const { root } = await mount({
      setup: (rt) =>
        rt.append({
          id: 'u1',
          role: 'user',
          content: [{ type: 'text', text: 'see attached' }],
          attachments: [
            {
              id: 'att1',
              type: 'document',
              name: 'notes.txt',
              contentType: 'text/plain',
              status: { type: 'complete' },
              content: [{ type: 'text', text: 'hello' }],
            },
          ],
        }),
    });
    const message = root.querySelector('[data-slot="aui_user-message-root"]')!;
    const attachments = message.querySelector('aui-message-attachments-styled');
    expect(attachments).not.toBeNull();
    expect(message.firstElementChild).toBe(attachments);
    const tile = attachments!.querySelector('[data-slot="aui_attachment-tile"]');
    expect(tile?.getAttribute('aria-label')).toBe('Document attachment notes.txt');
    expect(
      attachments!.querySelector('[data-slot="aui_attachment-root"]')?.getAttribute('data-source'),
    ).toBe('message');
  });

  it('renders the add-attachment button and a tile for an added file', async () => {
    const { fixture, root } = await mount({
      setup: (rt) => rt.withAttachments(new SimpleTextAttachmentAdapter()),
    });
    const shell = root.querySelector('[data-slot="aui_composer-shell"]')!;
    const add = shell.querySelector<HTMLButtonElement>('button[aria-label="Add Attachment"]');
    expect(add).not.toBeNull();
    expect(add!.disabled).toBe(false);
    expect(shell.querySelector('aui-composer-attachments-styled')).not.toBeNull();

    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (
      this: HTMLInputElement,
    ) {
      Object.defineProperty(this, 'files', { value: [file] });
      this.onchange?.(new Event('change'));
    });
    add!.click();
    await vi.waitFor(async () => {
      await settle(fixture);
      const tile = shell.querySelector(
        'aui-composer-attachments-styled [data-slot="aui_attachment-tile"]',
      );
      expect(tile?.getAttribute('aria-label')).toBe('Document attachment notes.txt');
    });
    expect(shell.querySelector('button[aria-label="Remove notes.txt"]')).not.toBeNull();
  });

  it('makes the composer shell a file drop zone', async () => {
    const { root } = await mount({
      setup: (rt) => rt.withAttachments(new SimpleTextAttachmentAdapter()),
    });
    const shell = root.querySelector<HTMLElement>('[data-slot="aui_composer-shell"]')!;
    const drag = new Event('dragenter', { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(drag, 'dataTransfer', { value: { types: ['Files'] } });
    shell.dispatchEvent(drag);
    expect(drag.defaultPrevented).toBe(true);
  });
});
