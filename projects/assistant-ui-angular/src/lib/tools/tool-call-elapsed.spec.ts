// Ported from packages/react/src/hooks/useToolCallElapsed.test.tsx @ 7d74276
// (the Angular face reads the clock only after first read, and ticks once per second while the call runs)
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { flushTapSync } from '@assistant-ui/tap';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import {
  createTestRuntime,
  type DemoMessage,
  type TestRuntime,
} from '../../testing-internal/test-runtime';
import {
  AuiMessagePartsComponent,
  AuiPartTemplateDirective,
} from '../primitives/message-parts.component';
import {
  AuiMessageTemplateDirective,
  AuiThreadMessagesComponent,
} from '../primitives/thread-messages.component';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { injectToolCallElapsed } from './tool-call-elapsed';

let current: TestRuntime;

@Component({
  selector: 'aui-test-elapsed-probe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="probe">{{ elapsed() ?? 'none' }}</span>`,
})
class ProbeComponent {
  readonly elapsed = injectToolCallElapsed();
}

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessagePartsComponent,
    AuiPartTemplateDirective,
    ProbeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage>
          <aui-message-parts>
            <ng-template auiPart="tool-call"><aui-test-elapsed-probe /></ng-template>
            <ng-template auiPart="text"><aui-test-elapsed-probe /></ng-template>
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

const probeText = (fixture: ComponentFixture<unknown>) =>
  Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.probe')).map(
    (node) => node.textContent,
  );

const tool = (timing: { startedAt: number; completedAt?: number }) =>
  ({
    type: 'tool-call',
    toolCallId: 'c1',
    toolName: 'weather',
    args: {},
    timing,
  }) as Exclude<DemoMessage['content'][number], string>;

async function mount(message: DemoMessage, running = false) {
  current = createTestRuntime();
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  flushTapSync(() => {
    current.append(message);
    if (running) current.setRunning(true);
  });
  await settle(fixture);
  return fixture;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('injectToolCallElapsed', () => {
  it('reports the recorded duration of a completed call', async () => {
    const fixture = await mount({
      id: 'a1',
      role: 'assistant',
      content: [tool({ startedAt: 1_000, completedAt: 3_500 })],
      status: { type: 'complete', reason: 'stop' },
    });
    await vi.waitFor(async () => {
      await settle(fixture);
      expect(probeText(fixture)).toEqual(['2500']);
    });
    fixture.destroy();
  });

  it('is undefined for a part that is not a tool call or carries no timing', async () => {
    const fixture = await mount({
      id: 'a1',
      role: 'assistant',
      content: [
        { type: 'text', text: 'hi' },
        { type: 'tool-call', toolCallId: 'c2', toolName: 'x', args: {} },
      ],
      status: { type: 'complete', reason: 'stop' },
    });
    await vi.waitFor(async () => {
      await settle(fixture);
      expect(probeText(fixture)).toEqual(['none', 'none']);
    });
    fixture.destroy();
  });

  it('ticks once per second while the call runs, and stops when it settles', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(10_000);
    const fixture = await mount(
      {
        id: 'a1',
        role: 'assistant',
        content: [tool({ startedAt: 9_000 })],
        status: { type: 'running' },
      },
      true,
    );
    await settle(fixture);
    expect(probeText(fixture)).toEqual(['1000']);
    vi.advanceTimersByTime(1_000);
    await settle(fixture);
    expect(probeText(fixture)).toEqual(['2000']);

    flushTapSync(() => {
      current.setMessages([
        {
          id: 'a1',
          role: 'assistant',
          content: [tool({ startedAt: 9_000, completedAt: 11_500 })],
          status: { type: 'complete', reason: 'stop' },
        },
      ]);
      current.setRunning(false);
    });
    await settle(fixture);
    expect(probeText(fixture)).toEqual(['2500']);
    expect(vi.getTimerCount()).toBe(0);
    fixture.destroy();
  });
});
