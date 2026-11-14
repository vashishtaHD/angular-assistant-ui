// Ported from packages/ui/src/components/react/assistant-ui/elements/reasoning.aui.test.tsx @ 7d74276
// ("connects tool-group-root to its scroll lock") plus grouping through `aui-message-grouped-parts`
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { flushTapSync } from '@assistant-ui/tap';
import {
  AuiGroupChildrenComponent,
  AuiGroupTemplateDirective,
  AuiMessageGroupedPartsComponent,
  AuiMessageTemplateDirective,
  AuiPartTemplateDirective,
  AuiProviderDirective,
  AuiThreadMessagesComponent,
  type AuiGroupBy,
} from 'angular-assistant-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../src/testing-internal/test-bed';
import {
  createTestRuntime,
  type DemoMessage,
  type TestRuntime,
} from '../../src/testing-internal/test-runtime';
import { AuiToolGroupComponent } from './tool-group.component';

let current: TestRuntime;

const groupTools: AuiGroupBy = (part) => (part.type === 'tool-call' ? ['group-tool'] : null);

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessageGroupedPartsComponent,
    AuiGroupTemplateDirective,
    AuiGroupChildrenComponent,
    AuiPartTemplateDirective,
    AuiToolGroupComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="scroller" style="overflow-y: auto">
      <div [auiProvider]="config">
        <aui-thread-messages>
          <ng-template auiMessage>
            <aui-message-grouped-parts [groupBy]="groupBy">
              <ng-template auiGroup="group-tool" let-group>
                <aui-tool-group
                  [count]="group.indices.length"
                  [active]="group.status.type === 'running'"
                >
                  <aui-group-children [group]="group" />
                </aui-tool-group>
              </ng-template>
              <ng-template auiPart="tool-call" let-part
                ><span class="tool">{{
                  part.type === 'tool-call' ? part.toolName : ''
                }}</span></ng-template
              >
              <ng-template auiPart="text" let-part
                ><p>{{ part.type === 'text' ? part.text : '' }}</p></ng-template
              >
            </aui-message-grouped-parts>
          </ng-template>
        </aui-thread-messages>
      </div>
    </div>
  `,
})
class HostComponent {
  readonly config = current.config;
  readonly groupBy = groupTools;
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

const tool = (id: string, result?: string) => ({
  type: 'tool-call' as const,
  toolCallId: id,
  toolName: `tool-${id}`,
  args: {},
  ...(result !== undefined ? { result } : {}),
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

afterEach(() => {
  document.body.replaceChildren();
});

describe('aui-tool-group', () => {
  it('collapses consecutive tool calls behind a count trigger', async () => {
    const { fixture, el } = await mount([
      {
        id: 'a1',
        role: 'assistant',
        content: [tool('1', 'x'), tool('2', 'y'), { type: 'text', text: 'Done' }],
        status: { type: 'complete', reason: 'stop' },
      },
    ]);
    await waitFor(fixture, () =>
      expect(el.querySelectorAll('[data-slot="aui_tool-group-root"]').length).toBe(1),
    );
    const root = el.querySelector('[data-slot="aui_tool-group-root"]') as HTMLElement;
    const trigger = root.querySelector('[data-slot="aui_tool-group-trigger"]') as HTMLButtonElement;
    expect(trigger.textContent).toContain('2 tool calls');
    expect(root.getAttribute('data-variant')).toBe('outline');
    expect(root.querySelectorAll('.tool').length).toBe(2);
    const content = root.querySelector('[data-slot="aui_tool-group-content"]') as HTMLElement;
    expect(content.hasAttribute('data-open')).toBe(false);
    expect(root.querySelector('[data-slot="aui_tool-group-trigger-loader"]')).toBeNull();

    trigger.click();
    await settle(fixture);
    expect(content.hasAttribute('data-open')).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    fixture.destroy();
  });

  it('says "1 tool call" for one call and shows the loader while a call runs', async () => {
    const { fixture, rt, el } = await mount([
      { id: 'a1', role: 'assistant', content: [tool('1')], status: { type: 'running' } },
    ]);
    flushTapSync(() => rt.setRunning(true));
    await waitFor(fixture, () =>
      expect(el.querySelector('[data-slot="aui_tool-group-trigger-loader"]')).not.toBeNull(),
    );
    expect(el.querySelector('[data-slot="aui_tool-group-trigger"]')!.textContent).toContain(
      '1 tool call',
    );
    expect(
      el
        .querySelector('[data-slot="aui_tool-group-trigger-label"]')!
        .classList.contains('aui-shimmer'),
    ).toBe(true);
    fixture.destroy();
  });

  it('locks the scroll container while it animates', async () => {
    const { fixture, el } = await mount([
      { id: 'a1', role: 'assistant', content: [tool('1', 'x'), tool('2', 'y')] },
    ]);
    await waitFor(fixture, () =>
      expect(el.querySelector('[data-slot="aui_tool-group-trigger"]')).not.toBeNull(),
    );
    const scroller = el.querySelector('.scroller') as HTMLElement;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      (el.querySelector('[data-slot="aui_tool-group-trigger"]') as HTMLButtonElement).click();
      await settle(fixture);
      expect(scroller.style.scrollbarWidth).toBe('none');
      vi.advanceTimersByTime(250);
      expect(scroller.style.scrollbarWidth).toBe('');
    } finally {
      vi.useRealTimers();
    }
    fixture.destroy();
  });
});
