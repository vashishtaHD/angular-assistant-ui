// Ported from packages/ui/src/components/react/assistant-ui/elements/reasoning.aui.test.tsx @ 7d74276
// (scroll lock on toggle) plus the Vue reasoning.vue behaviour (open while streaming, grouped run)
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { flushTapSync } from '@assistant-ui/tap';
import {
  AuiMessagePartsComponent,
  AuiMessageTemplateDirective,
  AuiPartTemplateDirective,
  AuiProviderDirective,
  AuiThreadMessagesComponent,
} from 'angular-assistant-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../src/testing-internal/test-bed';
import {
  createTestRuntime,
  type DemoMessage,
  type TestRuntime,
} from '../../src/testing-internal/test-runtime';
import { AuiReasoningComponent } from './reasoning.component';

let current: TestRuntime;

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessagePartsComponent,
    AuiPartTemplateDirective,
    AuiReasoningComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="scroller" style="overflow-y: auto">
      <div [auiProvider]="config">
        <aui-thread-messages>
          <ng-template auiMessage>
            <aui-message-parts>
              <ng-template auiPart="reasoning"><aui-reasoning /></ng-template>
              <ng-template auiPart="text" let-part
                ><p class="text">{{ part.type === 'text' ? part.text : '' }}</p></ng-template
              >
            </aui-message-parts>
          </ng-template>
        </aui-thread-messages>
      </div>
    </div>
  `,
})
class HostComponent {
  readonly config = current.config;
}

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

const message = (content: DemoMessage['content'], status?: DemoMessage['status']): DemoMessage => ({
  id: 'a1',
  role: 'assistant',
  content,
  ...(status ? { status } : {}),
});

async function mount(messages: DemoMessage[]) {
  current = createTestRuntime();
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  flushTapSync(() => current.setMessages(messages));
  await settle(fixture);
  return { fixture, rt: current, el: fixture.nativeElement as HTMLElement };
}

const roots = (el: HTMLElement) =>
  Array.from(el.querySelectorAll<HTMLElement>('[data-slot="aui_reasoning-root"]'));
const content = (el: HTMLElement) =>
  el.querySelector('[data-slot="aui_reasoning-content"]') as HTMLElement;
const trigger = (el: HTMLElement) =>
  el.querySelector('[data-slot="aui_reasoning-trigger"]') as HTMLButtonElement;

afterEach(() => {
  document.body.replaceChildren();
});

describe('aui-reasoning', () => {
  it('renders one collapsible per run of reasoning parts', async () => {
    const { fixture, el } = await mount([
      message([
        { type: 'reasoning', text: 'First thought.' },
        { type: 'reasoning', text: 'Second thought.' },
        { type: 'text', text: 'Answer' },
        { type: 'reasoning', text: 'Later thought.' },
      ]),
    ]);
    await waitFor(fixture, () => expect(roots(el).length).toBe(2));
    expect(roots(el)[0]!.textContent).toContain('First thought.');
    expect(roots(el)[0]!.textContent).toContain('Second thought.');
    expect(roots(el)[0]!.textContent).not.toContain('Later thought.');
    expect(roots(el)[1]!.textContent).toContain('Later thought.');
    fixture.destroy();
  });

  it('stays open while streaming and collapses after completion', async () => {
    const streaming = message([{ type: 'reasoning', text: 'Thinking' }], { type: 'running' });
    const { fixture, rt, el } = await mount([streaming]);
    flushTapSync(() => rt.setRunning(true));
    await waitFor(fixture, () => expect(content(el)?.hasAttribute('data-open')).toBe(true));
    expect(content(el).getAttribute('aria-busy')).toBe('true');
    expect(el.querySelector('[data-slot="aui_reasoning-trigger-label"]')!.classList).toContain(
      'aui-shimmer',
    );

    flushTapSync(() => {
      rt.setMessages([
        message(
          [
            { type: 'reasoning', text: 'Thinking done' },
            { type: 'text', text: 'Answer' },
          ],
          { type: 'complete', reason: 'stop' },
        ),
      ]);
      rt.setRunning(false);
    });
    await waitFor(fixture, () => expect(content(el)?.hasAttribute('data-open')).toBe(false));
    expect(content(el).getAttribute('aria-busy')).toBe('false');
    expect(trigger(el).getAttribute('aria-expanded')).toBe('false');
    fixture.destroy();
  });

  it('labels the duration from the part timing', async () => {
    const { fixture, el } = await mount([
      message([
        {
          type: 'reasoning',
          text: 'Considered it.',
          timing: { startedAt: 1_000, completedAt: 4_200 },
        } as Exclude<DemoMessage['content'][number], string>,
      ]),
    ]);
    await waitFor(fixture, () => expect(trigger(el)?.textContent).toContain('Reasoning (3s)'));
    fixture.destroy();
  });

  it('measures the duration of a stream it watched when the parts carry no timing', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(10_000);
    const { fixture, rt, el } = await mount([
      message([{ type: 'reasoning', text: 'Thinking' }], { type: 'running' }),
    ]);
    flushTapSync(() => rt.setRunning(true));
    await waitFor(fixture, () => expect(content(el)?.hasAttribute('data-open')).toBe(true));
    expect(trigger(el).textContent).not.toContain('(');
    now.mockReturnValue(15_000);
    flushTapSync(() => {
      rt.setMessages([
        message([{ type: 'reasoning', text: 'Done' }], { type: 'complete', reason: 'stop' }),
      ]);
      rt.setRunning(false);
    });
    await waitFor(fixture, () => expect(trigger(el)?.textContent).toContain('Reasoning (5s)'));
    now.mockRestore();
    fixture.destroy();
  });

  it('times a stream that starts and ends between two renders', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(20_000);
    const { fixture, rt, el } = await mount([
      message([{ type: 'reasoning', text: 'Idle' }], { type: 'complete', reason: 'stop' }),
    ]);
    await waitFor(fixture, () => expect(trigger(el)).not.toBeNull());
    expect(trigger(el).textContent).not.toContain('(');

    flushTapSync(() => {
      rt.setMessages([message([{ type: 'reasoning', text: 'Quick' }], { type: 'running' })]);
      rt.setRunning(true);
    });
    now.mockReturnValue(23_000);
    flushTapSync(() => {
      rt.setMessages([
        message([{ type: 'reasoning', text: 'Quick done' }], { type: 'complete', reason: 'stop' }),
      ]);
      rt.setRunning(false);
    });
    await waitFor(fixture, () => expect(trigger(el)?.textContent).toContain('Reasoning (3s)'));
    now.mockRestore();
    fixture.destroy();
  });

  it('renders each reasoning part of a run as markdown in its own part scope', async () => {
    const { fixture, rt, el } = await mount([
      message(
        [
          { type: 'reasoning', text: 'First **bold** idea' },
          { type: 'reasoning', text: '- item one\n- item two' },
        ],
        { type: 'running' },
      ),
    ]);
    flushTapSync(() => rt.setRunning(true));
    await waitFor(fixture, () => {
      const root = roots(el)[0]!;
      expect(root.querySelector('.aui-md-strong')?.textContent).toBe('bold');
      expect(root.querySelectorAll('.aui-md-li').length).toBe(2);
    });
    expect(roots(el)[0]!.querySelectorAll('aui-markdown-text').length).toBe(2);
    expect(roots(el)[0]!.textContent).not.toContain('**');

    // A streamed update reaches the second part's renderer.
    flushTapSync(() =>
      rt.setMessages([
        message(
          [
            { type: 'reasoning', text: 'First **bold** idea' },
            { type: 'reasoning', text: '- item one\n- item two\n- item three' },
          ],
          { type: 'running' },
        ),
      ]),
    );
    await waitFor(fixture, () =>
      expect(roots(el)[0]!.querySelectorAll('.aui-md-li').length).toBe(3),
    );
    fixture.destroy();
  });

  it('toggles on click and locks the scroll container while animating', async () => {
    const { fixture, el } = await mount([message([{ type: 'reasoning', text: 'Idle' }])]);
    await waitFor(fixture, () => expect(trigger(el)).not.toBeNull());
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const scroller = el.querySelector('.scroller') as HTMLElement;
      expect(content(el).hasAttribute('data-open')).toBe(false);
      trigger(el).click();
      await settle(fixture);
      expect(content(el).hasAttribute('data-open')).toBe(true);
      expect(scroller.style.scrollbarWidth).toBe('none');
      vi.advanceTimersByTime(250);
      expect(scroller.style.scrollbarWidth).toBe('');
      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
});
