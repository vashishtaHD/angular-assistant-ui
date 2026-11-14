// Ported from packages/ui/src/components/vue/assistant-ui/tool-fallback.test.ts @ 7d74276
// (plus the approval, ask-user, running, error and cancelled cases the Angular kit adds)
import { ChangeDetectionStrategy, Component, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { flushTapSync } from '@assistant-ui/tap';
import {
  AuiMessagePartsComponent,
  AuiMessageTemplateDirective,
  AuiPartTemplateDirective,
  AuiProviderDirective,
  AuiThreadMessagesComponent,
  registerToolUI,
  type ToolUIComponent,
} from 'angular-assistant-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../../src/testing-internal/test-bed';
import {
  createTestRuntime,
  type DemoMessage,
  type TestRuntime,
  type TestRuntimeCallbacks,
} from '../../../src/testing-internal/test-runtime';
import { AuiToolFallbackComponent } from './tool-fallback.component';

// Compile-time check: the fallback satisfies the `registerToolUI` contract.
const asToolUI: Type<ToolUIComponent> = AuiToolFallbackComponent;
void asToolUI;
void registerToolUI;

let current: TestRuntime;

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessagePartsComponent,
    AuiPartTemplateDirective,
    AuiToolFallbackComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage>
          <aui-message-parts>
            <ng-template auiPart="tool-call"><aui-tool-fallback /></ng-template>
            <ng-template auiPart="text" let-part>{{ part.type }}</ng-template>
          </aui-message-parts>
        </ng-template>
      </aui-thread-messages>
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

type ToolPart = Extract<DemoMessage['content'][number], { type: 'tool-call' }>;

const toolMessage = (
  part: Partial<ToolPart> = {},
  status?: DemoMessage['status'],
): DemoMessage => ({
  id: 'a1',
  role: 'assistant',
  content: [
    {
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'computer_call',
      args: { kind: 'click' },
      ...part,
    } as ToolPart,
  ],
  ...(status ? { status } : {}),
});

async function mount(messages: DemoMessage[], callbacks: TestRuntimeCallbacks = {}) {
  current = createTestRuntime(callbacks);
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  flushTapSync(() => current.setMessages(messages));
  await settle(fixture);
  return { fixture, rt: current, el: fixture.nativeElement as HTMLElement };
}

const trigger = (el: HTMLElement) =>
  el.querySelector('[data-slot="aui_tool-fallback-trigger"]') as HTMLButtonElement | null;

const buttonByText = (el: HTMLElement, text: string) =>
  Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === text) as
    HTMLButtonElement | undefined;

const type = (field: HTMLTextAreaElement | HTMLInputElement, value: string) => {
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('aui-tool-fallback labels (Vue tool-fallback.test.ts)', () => {
  it.each([
    { status: 'queued' as const, label: 'Reply queued, not sent yet' },
    { status: undefined, label: 'Waiting on tool' },
  ])('renders the $label fallback for a $status reply', async ({ status, label }) => {
    const { fixture, el } = await mount([
      toolMessage(status ? { responseDeliveryStatus: status } : {}),
    ]);
    await waitFor(fixture, () =>
      expect(trigger(el)?.textContent).toContain(`${label}: computer_call`),
    );
    if (status === undefined) {
      expect(el.textContent).not.toContain('Reply queued, not sent yet');
    }
    fixture.destroy();
  });

  it('shows the args and the result, collapsed until opened', async () => {
    const { fixture, el } = await mount([
      toolMessage({ argsText: '{"kind":"click"}', result: { ok: true } }),
    ]);
    await waitFor(fixture, () => expect(trigger(el)?.textContent).toContain('Used tool'));
    const content = el.querySelector('[data-slot="aui_tool-fallback-content"]') as HTMLElement;
    expect(content.hasAttribute('data-open')).toBe(false);
    expect(trigger(el)!.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('[data-slot="aui_tool-fallback-args"]')?.textContent).toContain(
      '{"kind":"click"}',
    );
    expect(el.querySelector('[data-slot="aui_tool-fallback-result"]')?.textContent).toContain(
      '"ok": true',
    );
    trigger(el)!.click();
    await settle(fixture);
    expect(content.hasAttribute('data-open')).toBe(true);
    expect(trigger(el)!.getAttribute('aria-expanded')).toBe('true');
    fixture.destroy();
  });
});

describe('aui-tool-fallback status states', () => {
  it('shows the shimmer while the tool runs', async () => {
    const { fixture, rt, el } = await mount([toolMessage({}, { type: 'running' })]);
    flushTapSync(() => rt.setRunning(true));
    await waitFor(fixture, () => expect(trigger(el)?.textContent).toContain('Running tool'));
    const label = el.querySelector('[data-slot="aui_tool-fallback-trigger-label"]')!;
    expect(label.classList.contains('aui-shimmer')).toBe(true);
    expect(
      el.querySelector('[data-slot="aui_tool-fallback-root"]')!.hasAttribute('data-running'),
    ).toBe(true);
    fixture.destroy();
  });

  it('shows the error of a failed tool', async () => {
    const { fixture, el } = await mount([
      toolMessage({}, { type: 'incomplete', reason: 'error', error: 'Upstream exploded' }),
    ]);
    await waitFor(fixture, () => expect(trigger(el)?.textContent).toContain('Failed tool'));
    const error = el.querySelector('[data-slot="aui_tool-fallback-error"]');
    expect(error?.textContent).toContain('Error:');
    expect(error?.textContent).toContain('Upstream exploded');
    expect(el.querySelector('.aui-shimmer')).toBeNull();
    fixture.destroy();
  });

  it('shows the cancelled state when the call was cancelled', async () => {
    const { fixture, el } = await mount([
      toolMessage({}, { type: 'incomplete', reason: 'cancelled' }),
    ]);
    await waitFor(fixture, () => expect(trigger(el)?.textContent).toContain('Cancelled tool'));
    expect(
      el.querySelector('[data-slot="aui_tool-fallback-root"]')!.hasAttribute('data-cancelled'),
    ).toBe(true);
    fixture.destroy();
  });

  it('never infers the cancelled state from an idle thread', async () => {
    // An idle thread whose call completed is not cancelled.
    const { fixture, el } = await mount([
      toolMessage({ result: 'done' }, { type: 'complete', reason: 'stop' }),
    ]);
    await waitFor(fixture, () => expect(trigger(el)?.textContent).toContain('Used tool'));
    expect(el.textContent).not.toContain('Cancelled');
    expect(el.querySelector('[data-cancelled]')).toBeNull();
    fixture.destroy();
  });

  it('does not show an unanswered call of a finished, idle message as cancelled', async () => {
    const { fixture, el } = await mount([toolMessage({}, { type: 'complete', reason: 'stop' })]);
    await waitFor(fixture, () => expect(trigger(el)).not.toBeNull());
    expect(el.textContent).not.toContain('Cancelled');
    expect(el.querySelector('[data-cancelled]')).toBeNull();
    fixture.destroy();
  });

  it('does not show a waiting call as cancelled', async () => {
    const waiting = await mount([toolMessage({ toolName: 'askUser', args: {} })]);
    await waitFor(waiting.fixture, () =>
      expect(trigger(waiting.el)?.textContent).toContain('Waiting on tool'),
    );
    expect(waiting.el.textContent).not.toContain('Cancelled');
    expect(waiting.el.querySelector('[data-cancelled]')).toBeNull();
    waiting.fixture.destroy();
  });
});

describe('aui-tool-fallback approval card', () => {
  const pending = (approval: ToolPart['approval'] = { id: 'approval-1' }) =>
    toolMessage({ toolName: 'bookMeeting', args: { title: 'Sync', when: 'tomorrow' }, approval });

  it('Approve calls respondToApproval({ approved: true }) and shows the receipt', async () => {
    const onRespondToToolApproval = vi.fn((options: { approvalId: string; approved: boolean }) => {
      current.setMessages([pending({ id: options.approvalId, approved: options.approved })]);
    });
    const { fixture, el } = await mount([pending()], { onRespondToToolApproval });
    await waitFor(fixture, () => expect(buttonByText(el, 'Approve')).toBeDefined());
    // A call waiting on the user opens itself.
    expect(trigger(el)!.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('[data-slot="aui_tool-fallback-approval"] textarea')).not.toBeNull();

    buttonByText(el, 'Approve')!.click();
    await vi.waitFor(() => expect(onRespondToToolApproval).toHaveBeenCalledTimes(1));
    const call = onRespondToToolApproval.mock.calls[0]![0];
    expect(call).toMatchObject({ approvalId: 'approval-1', approved: true });
    expect(call).not.toHaveProperty('reason');

    await waitFor(fixture, () => {
      const receipt = el.querySelector('[data-slot="aui_tool-fallback-approval-receipt"]');
      expect(receipt?.getAttribute('data-outcome')).toBe('allowed');
      expect(receipt?.textContent).toContain('Approved');
    });
    expect(buttonByText(el, 'Approve')).toBeUndefined();
    fixture.destroy();
  });

  it('Deny passes the typed reason', async () => {
    const onRespondToToolApproval = vi.fn(
      (options: { approvalId: string; approved: boolean; reason?: string }) => {
        current.setMessages([
          pending({ id: options.approvalId, approved: options.approved, reason: options.reason }),
        ]);
      },
    );
    const { fixture, el } = await mount([pending()], { onRespondToToolApproval });
    await waitFor(fixture, () => expect(buttonByText(el, 'Deny')).toBeDefined());
    type(
      el.querySelector('[data-slot="aui_tool-fallback-approval"] textarea') as HTMLTextAreaElement,
      'Not this week',
    );
    await settle(fixture);
    buttonByText(el, 'Deny')!.click();
    await vi.waitFor(() => expect(onRespondToToolApproval).toHaveBeenCalledTimes(1));
    expect(onRespondToToolApproval.mock.calls[0]![0]).toMatchObject({
      approvalId: 'approval-1',
      approved: false,
      reason: 'Not this week',
    });
    await waitFor(fixture, () => {
      const receipt = el.querySelector('[data-slot="aui_tool-fallback-approval-receipt"]');
      expect(receipt?.getAttribute('data-outcome')).toBe('refused');
      expect(receipt?.textContent).toContain('Denied');
      expect(receipt?.textContent).toContain('Not this week');
    });
    fixture.destroy();
  });

  it('brings the controls back when the response is refused', async () => {
    const onRespondToToolApproval = vi.fn(async () => {
      throw new Error('Gate closed');
    });
    const { fixture, el } = await mount([pending()], { onRespondToToolApproval });
    await waitFor(fixture, () => expect(buttonByText(el, 'Approve')).toBeDefined());
    buttonByText(el, 'Approve')!.click();
    await waitFor(fixture, () =>
      expect(el.querySelector('[role="alert"]')?.textContent).toContain('Gate closed'),
    );
    expect(buttonByText(el, 'Approve')!.disabled).toBe(false);
    fixture.destroy();
  });

  it('answers a select request through its options', async () => {
    const onRespondToToolApproval = vi.fn();
    const { fixture, el } = await mount(
      [
        pending({
          id: 'approval-1',
          prompt: 'Run it?',
          options: [
            { id: 'once', kind: 'allow-once' },
            { id: 'never', kind: 'reject-always' },
          ],
        }),
      ],
      { onRespondToToolApproval },
    );
    await waitFor(fixture, () => expect(buttonByText(el, 'Always deny')).toBeDefined());
    expect(el.textContent).toContain('Run it?');
    buttonByText(el, 'Allow')!.click();
    await vi.waitFor(() => expect(onRespondToToolApproval).toHaveBeenCalledTimes(1));
    expect(onRespondToToolApproval.mock.calls[0]![0]).toMatchObject({
      approvalId: 'approval-1',
      approved: true,
      optionId: 'once',
    });
    fixture.destroy();
  });
});

describe('aui-tool-fallback ask-user form', () => {
  const ask = (args: Record<string, unknown>) =>
    toolMessage({ toolCallId: 'call-2', toolName: 'askUser', args: args as ToolPart['args'] });

  it('submits the selected option through addResult when multiple is false', async () => {
    const onAddToolResult = vi.fn();
    const { fixture, el } = await mount(
      [ask({ question: 'Which city?', options: ['Paris', 'Rome'], multiple: false })],
      { onAddToolResult },
    );
    await waitFor(fixture, () =>
      expect(el.querySelector('[data-slot="aui_tool-fallback-ask-user"]')).not.toBeNull(),
    );
    const form = el.querySelector('[data-slot="aui_tool-fallback-ask-user"]') as HTMLElement;
    expect(form.textContent).toContain('Which city?');
    const radios = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    expect(radios.map((r) => r.value)).toEqual(['Paris', 'Rome']);
    expect(form.querySelector('input[type="checkbox"]')).toBeNull();
    const submit = buttonByText(form, 'Submit')!;
    expect(submit.disabled).toBe(true);

    radios[1]!.click();
    await settle(fixture);
    expect(submit.disabled).toBe(false);
    submit.click();
    await vi.waitFor(() => expect(onAddToolResult).toHaveBeenCalledTimes(1));
    expect(onAddToolResult.mock.calls[0]![0]).toMatchObject({
      toolCallId: 'call-2',
      toolName: 'askUser',
      result: 'Rome',
    });
    await settle(fixture);
    expect(submit.disabled).toBe(true);
    fixture.destroy();
  });

  it('offers checkboxes and submits every pick when multiple is true', async () => {
    const onAddToolResult = vi.fn();
    const { fixture, el } = await mount(
      [ask({ question: 'Toppings?', options: ['Cheese', 'Olives', 'Basil'], multiple: true })],
      { onAddToolResult },
    );
    await waitFor(fixture, () =>
      expect(el.querySelectorAll('input[type="checkbox"]').length).toBe(3),
    );
    const boxes = Array.from(el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    boxes[0]!.click();
    boxes[2]!.click();
    await settle(fixture);
    buttonByText(el, 'Submit')!.click();
    await vi.waitFor(() => expect(onAddToolResult).toHaveBeenCalledTimes(1));
    expect(onAddToolResult.mock.calls[0]![0]).toMatchObject({ result: ['Cheese', 'Basil'] });
    fixture.destroy();
  });

  it('falls back to a free-text answer', async () => {
    const onAddToolResult = vi.fn();
    const { fixture, el } = await mount([ask({ question: 'Your name?' })], { onAddToolResult });
    await waitFor(fixture, () =>
      expect(el.querySelector('[data-slot="aui_tool-fallback-ask-user"] textarea')).not.toBeNull(),
    );
    expect(el.querySelector('input[type="radio"]')).toBeNull();
    type(
      el.querySelector('[data-slot="aui_tool-fallback-ask-user"] textarea') as HTMLTextAreaElement,
      'Ada',
    );
    await settle(fixture);
    buttonByText(el, 'Submit')!.click();
    await vi.waitFor(() => expect(onAddToolResult).toHaveBeenCalledTimes(1));
    expect(onAddToolResult.mock.calls[0]![0]).toMatchObject({ result: 'Ada' });
    fixture.destroy();
  });

  it('shows no form once the call has a result', async () => {
    const { fixture, el } = await mount([
      toolMessage({ toolName: 'askUser', args: { question: 'Which?' }, result: 'Rome' }),
    ]);
    await waitFor(fixture, () => expect(trigger(el)?.textContent).toContain('Used tool'));
    expect(el.querySelector('[data-slot="aui_tool-fallback-ask-user"]')).toBeNull();
    expect(el.querySelector('[data-slot="aui_tool-fallback-result"]')?.textContent).toContain(
      'Rome',
    );
    fixture.destroy();
  });
});
