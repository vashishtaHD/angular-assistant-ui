// Ported from packages/react/src/unstable/useMessageStallDetection.ts @ 7d74276 (no upstream spec)
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { AuiConfig } from '@assistant-ui/store/client';
import { flushTapSync } from '@assistant-ui/tap';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime, type DemoMessage } from '../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { injectMessageStallDetection } from './message-stall-detection';
import {
  AuiMessageTemplateDirective,
  AuiThreadMessagesComponent,
} from './thread-messages.component';

let hostConfig: AuiConfig;

@Component({
  selector: 'aui-test-stall-probe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="stall">{{ stall().stalled }}|{{ stall().stalledForMs }}</span>`,
})
class StallProbeComponent {
  readonly stall = injectMessageStallDetection({ thresholdMs: 1000 });
}

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    StallProbeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage><aui-test-stall-probe /></ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class HostComponent {
  readonly config = hostConfig;
}

const assistant = (value: string, id = 'a1'): DemoMessage => ({
  id,
  role: 'assistant',
  content: [{ type: 'text', text: value }],
});

const render = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 3; i++) {
    fixture.detectChanges();
    await Promise.resolve();
  }
};

const mount = async (running: boolean) => {
  const rt = createTestRuntime();
  rt.append(assistant('hello'));
  if (running) rt.setRunning(true);
  hostConfig = rt.config;
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  await render(fixture);
  const read = () => (fixture.nativeElement as HTMLElement).querySelector('.stall')?.textContent;
  const advance = async (ms: number) => {
    vi.advanceTimersByTime(ms);
    await render(fixture);
  };
  return { fixture, rt, read, advance };
};

describe('injectMessageStallDetection', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports a stall once a running message stops changing for the threshold', async () => {
    const { read, advance } = await mount(true);
    expect(read()).toBe('false|0');
    await advance(999);
    expect(read()).toBe('false|0');
    await advance(1);
    expect(read()).toBe('true|1000');
    await advance(1000);
    expect(read()).toBe('true|2000');
  });

  it('restarts the countdown when the content changes', async () => {
    const { fixture, rt, read, advance } = await mount(true);
    await advance(900);
    flushTapSync(() => rt.setMessages([assistant('hello w')]));
    await advance(900);
    expect(read()).toBe('false|0');
    await advance(100);
    expect(read()).toBe('true|1000');
    // New activity clears the stall again.
    flushTapSync(() => rt.setMessages([assistant('hello wo')]));
    await render(fixture);
    expect(read()).toBe('false|0');
  });

  it('never reports a stall on a message that is not running', async () => {
    const { read, advance } = await mount(false);
    await advance(10_000);
    expect(read()).toBe('false|0');
  });

  it('clears the stall when the run ends', async () => {
    const { rt, read, advance } = await mount(true);
    await advance(1500);
    expect(read()).toBe('true|1000');
    flushTapSync(() => rt.setRunning(false));
    await advance(0);
    expect(read()).toBe('false|0');
    await advance(5000);
    expect(read()).toBe('false|0');
  });

  it('stops its timers when destroyed', async () => {
    const { fixture, advance } = await mount(true);
    await advance(1500);
    const running = vi.getTimerCount();
    expect(running).toBeGreaterThan(0);
    fixture.destroy();
    // A leaked one-second interval would make runAllTimers abort.
    expect(() => vi.runAllTimers()).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });
});
