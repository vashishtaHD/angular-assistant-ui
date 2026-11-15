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
import { displayOf, useFlexAuthorClass } from '../../../src/testing-internal/author-css';
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

@Component({
  selector: 'app-custom-reasoning-group',
  standalone: true,
  imports: [AuiGroupChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section
    class="custom-reasoning-group"
    [attr.data-count]="group().indices.length"
    [attr.data-message]="messageId()"
  >
    <aui-group-children [group]="group()" />
  </section>`,
})
class CustomReasoningGroupComponent {
  readonly group = input.required<AuiGroupPart>();
  protected readonly messageId = injectAuiState((s) => s.message.id);
}

@Component({
  selector: 'app-custom-user-attachments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="custom-user-attachments">{{ id() }}:{{ count() }}</div>`,
})
class CustomUserAttachmentsComponent {
  protected readonly id = injectAuiState((s) => s.message.id);
  protected readonly count = injectAuiState((s) => s.message.attachments?.length ?? 0);
}

@Component({
  selector: 'app-custom-composer-attachments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="custom-composer-attachments">{{ type() }}</div>`,
})
class CustomComposerAttachmentsComponent {
  protected readonly type = injectAuiState((s) => s.composer.type);
}

@Component({
  selector: 'app-custom-add-attachment',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button type="button" class="custom-add" aria-label="Attach">{{ type() }}</button>`,
})
class CustomAddAttachmentComponent {
  protected readonly type = injectAuiState((s) => s.composer.type);
}

@Component({
  selector: 'app-custom-task-group',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section
    class="custom-task-group"
    [attr.data-message]="messageId()"
    [attr.data-indices]="group().indices.join(',')"
  ></section>`,
})
class CustomTaskGroupComponent {
  readonly group = input.required<AuiGroupPart>();
  protected readonly messageId = injectAuiState((s) => s.message.id);
}

@Component({
  selector: 'app-composer-extra',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button type="button" class="composer-extra">{{ type() }}</button>`,
})
class ComposerExtraComponent {
  protected readonly type = injectAuiState((s) => s.composer.type);
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
    expect(tags(chain!, 'aui-reasoning-group, aui-tool-group')).toEqual([
      'aui-reasoning-group',
      'aui-tool-group',
    ]);
    expect(chain!.querySelector('aui-reasoning-group')?.textContent).toContain('thinking hard');
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
    const wrapper = message.querySelector('.aui-user-message-content-wrapper')!;
    expect(
      attachments!.compareDocumentPosition(wrapper) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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

describe('aui-thread TaskGroup and ComposerExtra slots', () => {
  /** A tool call that carries a nested conversation (a sub-agent task). */
  const task = (id: string, toolName: string) => ({
    ...tool(id, toolName),
    messages: [{ id: `${id}-m`, role: 'assistant', content: [{ type: 'text', text: 'sub' }] }],
  });
  const taskAssistant: DemoMessage = {
    id: 'a1',
    role: 'assistant',
    content: [
      { type: 'text', text: 'Delegating.' },
      task('c1', 'research') as never,
      task('c2', 'summarize') as never,
      tool('c3', 'search'),
      task('c4', 'weather') as never,
    ],
  };

  it('routes nested-conversation tool calls without a tool UI through TaskGroup', async () => {
    registerWeather = true;
    const { root } = await mount({
      providers: [
        { provide: AUI_THREAD_COMPONENTS, useValue: { TaskGroup: CustomTaskGroupComponent } },
      ],
      setup: (rt) => rt.append(taskAssistant),
    });
    const chain = root.querySelector('[data-slot="aui_chain-of-thought"]')!;
    const groups = Array.from(chain.querySelectorAll('.custom-task-group'));
    // The two adjacent task calls form one task group, in the message scope.
    expect(groups.map((g) => g.getAttribute('data-indices'))).toEqual(['1,2']);
    expect(groups[0]!.getAttribute('data-message')).toBe('a1');
    // A plain call keeps the tool group; a registered tool UI still wins over TaskGroup.
    expect(
      Array.from(chain.querySelectorAll('aui-tool-fallback')).map((el) => el.textContent?.trim()),
    ).toEqual([expect.stringContaining('search')]);
    expect(Array.from(root.querySelectorAll('.weather-tool')).map((el) => el.textContent)).toEqual([
      'weather',
    ]);
    expect(root.querySelector('.custom-task-group aui-tool-fallback')).toBeNull();
  });

  it('renders nested-conversation tool calls like any other tool call without TaskGroup', async () => {
    const { root } = await mount({ setup: (rt) => rt.append(taskAssistant) });
    expect(root.querySelector('.custom-task-group')).toBeNull();
    const fallbacks = Array.from(root.querySelectorAll('aui-tool-group aui-tool-fallback'));
    expect(fallbacks).toHaveLength(4);
  });

  it('renders ComposerExtra beside the attach button, in the composer scope', async () => {
    const { root } = await mount({
      providers: [
        { provide: AUI_THREAD_COMPONENTS, useValue: { ComposerExtra: ComposerExtraComponent } },
      ],
    });
    const start = root.querySelector('.aui-composer-action-start')!;
    const extra = start.querySelector('.composer-extra');
    expect(extra?.textContent).toBe('thread');
    // After the attach button, in the same action-start row.
    const attach = start.querySelector('button[aria-label="Add Attachment"]')!;
    expect(attach.compareDocumentPosition(extra!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders no ComposerExtra by default', async () => {
    const { root } = await mount();
    expect(root.querySelector('.aui-composer-action-start')?.children).toHaveLength(1);
  });
});

describe('aui-thread parts (fix round 1)', () => {
  const waitingCall: DemoMessage = {
    id: 'a1',
    role: 'assistant',
    content: [{ type: 'tool-call', toolCallId: 'c1', toolName: 'approve', args: {} }],
    status: { type: 'requires-action', reason: 'tool-calls' },
  };

  it('keeps a tool group open while a call requires action, and closes it once answered', async () => {
    const { fixture, root } = await mount({ setup: (rt) => rt.append(waitingCall) });
    const trigger = () =>
      root.querySelector<HTMLButtonElement>('[data-slot="aui_tool-group-trigger"]')!;
    const content = () => root.querySelector('[data-slot="aui_tool-group-content"]')!;
    expect(trigger().getAttribute('aria-expanded')).toBe('true');

    trigger().click();
    await settle(fixture);
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(content().hasAttribute('data-open')).toBe(true);
    trigger().click();
    await settle(fixture);
    expect(trigger().getAttribute('aria-expanded')).toBe('true');

    runtime.setMessages([
      {
        ...waitingCall,
        content: [{ ...tool('c1', 'approve') }],
        status: { type: 'complete', reason: 'stop' },
      },
    ]);
    await settle(fixture);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    // The user can open it again afterwards.
    trigger().click();
    await settle(fixture);
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
  });

  describe('reasoning groups', () => {
    const twoReasoning: DemoMessage = {
      id: 'a1',
      role: 'assistant',
      content: [
        { type: 'reasoning', text: 'first thought' },
        { type: 'reasoning', text: 'second thought' },
        { type: 'text', text: 'Answer.' },
      ],
    };
    const reasoningRoots = (root: Element) =>
      root.querySelectorAll('[data-slot="aui_reasoning-root"]');

    it('renders one default reasoning group around the run, one part per reasoning part', async () => {
      const { root } = await mount({ setup: (rt) => rt.append(twoReasoning) });
      expect(root.querySelectorAll('aui-reasoning-group')).toHaveLength(1);
      expect(reasoningRoots(root)).toHaveLength(1);
      const parts = Array.from(reasoningRoots(root)[0]!.querySelectorAll('.aui-reasoning-part'));
      expect(parts.map((p) => p.textContent?.trim())).toEqual(['first thought', 'second thought']);
    });

    it('keeps the default group around a Reasoning part override', async () => {
      const { root } = await mount({
        providers: [
          { provide: AUI_THREAD_COMPONENTS, useValue: { Reasoning: CustomReasoningComponent } },
        ],
        setup: (rt) => rt.append(twoReasoning),
      });
      expect(reasoningRoots(root)).toHaveLength(1);
      expect(
        Array.from(reasoningRoots(root)[0]!.querySelectorAll('.custom-reasoning')).map(
          (el) => el.textContent,
        ),
      ).toEqual(['first thought', 'second thought']);
    });

    it('replaces only the group wrapper through ReasoningGroup', async () => {
      const { root } = await mount({
        providers: [
          {
            provide: AUI_THREAD_COMPONENTS,
            useValue: { ReasoningGroup: CustomReasoningGroupComponent },
          },
        ],
        setup: (rt) => rt.append(twoReasoning),
      });
      expect(reasoningRoots(root)).toHaveLength(0);
      const group = root.querySelector('.custom-reasoning-group')!;
      expect(group.getAttribute('data-count')).toBe('2');
      expect(group.getAttribute('data-message')).toBe('a1');
      expect(
        Array.from(group.querySelectorAll('.aui-reasoning-part')).map((p) => p.textContent?.trim()),
      ).toEqual(['first thought', 'second thought']);
    });

    it('combines ReasoningGroup and Reasoning overrides', async () => {
      const { root } = await mount({
        providers: [
          {
            provide: AUI_THREAD_COMPONENTS,
            useValue: {
              ReasoningGroup: CustomReasoningGroupComponent,
              Reasoning: CustomReasoningComponent,
            },
          },
        ],
        setup: (rt) => rt.append(twoReasoning),
      });
      const group = root.querySelector('.custom-reasoning-group')!;
      expect(
        Array.from(group.querySelectorAll('.custom-reasoning')).map((el) => el.textContent),
      ).toEqual(['first thought', 'second thought']);
    });
  });

  it('replaces the attachment defaults independently, each in its own scope', async () => {
    const { root } = await mount({
      providers: [
        {
          provide: AUI_THREAD_COMPONENTS,
          useValue: {
            UserMessageAttachments: CustomUserAttachmentsComponent,
            ComposerAttachments: CustomComposerAttachmentsComponent,
            ComposerAddAttachment: CustomAddAttachmentComponent,
          },
        },
      ],
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
    expect(root.querySelector('aui-message-attachments-styled')).toBeNull();
    expect(root.querySelector('aui-composer-attachments-styled')).toBeNull();
    expect(root.querySelector('aui-composer-add-attachment-styled')).toBeNull();
    const message = root.querySelector('[data-slot="aui_user-message-root"]')!;
    expect(message.querySelector('.custom-user-attachments')?.textContent).toBe('u1:1');
    const shell = root.querySelector('[data-slot="aui_composer-shell"]')!;
    expect(shell.querySelector('.custom-composer-attachments')?.textContent).toBe('thread');
    expect(shell.querySelector('.aui-composer-action-start .custom-add')?.textContent).toBe(
      'thread',
    );
    // The rest of the styled message and composer stay.
    expect(message.querySelector('.aui-user-message-content')?.textContent).toContain(
      'see attached',
    );
    expect(shell.querySelector('.aui-composer-send')).not.toBeNull();
  });

  describe('closed disclosures', () => {
    const closedSurface = (el: Element) => {
      el.classList.add('flex');
      return {
        hidden: el.hasAttribute('hidden'),
        inline: (el as HTMLElement).style.display,
        display: displayOf(el),
      };
    };

    it('hide a closed tool group and reasoning group with hidden and inline display: none', async () => {
      useFlexAuthorClass();
      const { root } = await mount({ setup: (rt) => rt.append(mixedAssistant()) });
      const toolContent = root.querySelector('[data-slot="aui_tool-group-content"]')!;
      const reasoningContent = root.querySelector('[data-slot="aui_reasoning-content"]')!;
      const closed = { hidden: true, inline: 'none', display: 'none' };
      expect(closedSurface(toolContent)).toEqual(closed);
      expect(closedSurface(reasoningContent)).toEqual(closed);
      for (const fallback of Array.from(
        root.querySelectorAll('[data-slot="aui_tool-fallback-content"]'),
      )) {
        expect(closedSurface(fallback)).toEqual(closed);
      }
    });

    it('show an opened tool group at once, and hide it again after the closing animation', async () => {
      useFlexAuthorClass();
      const { fixture, root } = await mount({ setup: (rt) => rt.append(mixedAssistant()) });
      const trigger = root.querySelector<HTMLButtonElement>(
        '[data-slot="aui_tool-group-trigger"]',
      )!;
      const content = root.querySelector('[data-slot="aui_tool-group-content"]')!;
      trigger.click();
      await settle(fixture);
      expect(closedSurface(content)).toEqual({ hidden: false, inline: '', display: 'flex' });
      trigger.click();
      // The delayed hide itself is covered by the collapsible spec, with fake timers.
      await vi.waitFor(async () => {
        await settle(fixture);
        expect(closedSurface(content)).toEqual({ hidden: true, inline: 'none', display: 'none' });
      });
    });
  });
});
