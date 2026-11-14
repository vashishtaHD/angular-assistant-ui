// Ported from packages/react/src/primitives/thread/topAnchor/*.test.ts (behaviour) @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { flushTapSync } from '@assistant-ui/tap';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime, type TestRuntime } from '../../testing-internal/test-runtime';
import { getActiveTopAnchorTurn, isTopAnchorTurnValid, parseCssLength } from '../utils/top-anchor';
import { AuiMessageRootDirective } from './message-root.directive';
import {
  AuiMessageTemplateDirective,
  AuiThreadMessagesComponent,
} from './thread-messages.component';
import { AuiThreadViewportDirective } from './thread-viewport.directive';

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadViewportDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessageRootDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [auiProvider]="runtime().config">
      <div class="viewport" auiThreadViewport [turnAnchor]="turnAnchor()">
        <aui-thread-messages>
          <ng-template auiMessage><div class="msg" auiMessageRoot>m</div></ng-template>
        </aui-thread-messages>
      </div>
    </div>
  `,
})
class HostComponent {
  readonly runtime = input.required<TestRuntime>();
  readonly turnAnchor = input<'top' | 'bottom'>('top');
}

const text = (value: string) => [{ type: 'text', text: value }] as const;

const mockGeometry = (viewport: HTMLElement) => {
  Object.defineProperty(viewport, 'scrollHeight', { get: () => 600, configurable: true });
  Object.defineProperty(viewport, 'clientHeight', { get: () => 300, configurable: true });
  const scrollTo = vi.fn();
  Object.defineProperty(viewport, 'scrollTo', { value: scrollTo, configurable: true });
  const messages = Array.from(viewport.querySelectorAll<HTMLElement>('.msg'));
  messages.forEach((el, index) => {
    Object.defineProperty(el, 'offsetTop', { get: () => 100 * index, configurable: true });
    Object.defineProperty(el, 'offsetHeight', { get: () => 60, configurable: true });
    Object.defineProperty(el, 'offsetParent', { get: () => viewport, configurable: true });
  });
  return scrollTo;
};

async function mount(test: TestRuntime, turnAnchor: 'top' | 'bottom' = 'top') {
  configureTestBed({ imports: [HostComponent] });
  const fixture: ComponentFixture<HostComponent> = TestBed.createComponent(HostComponent);
  fixture.componentRef.setInput('runtime', test);
  fixture.componentRef.setInput('turnAnchor', turnAnchor);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  return fixture;
}

const viewportOf = (fixture: ComponentFixture<unknown>) =>
  (fixture.nativeElement as HTMLElement).querySelector('.viewport') as HTMLElement;

describe('turnAnchor="top"', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const startRun = (test: TestRuntime) => {
    flushTapSync(() => test.append({ role: 'user', content: text('question') }));
    flushTapSync(() => test.setRunning(true));
    flushTapSync(() => test.append({ role: 'assistant', content: text('answer') }));
  };

  it('pins the last user message to the top on run start and adds a reserve after the reply', async () => {
    const test = createTestRuntime();
    const fixture = await mount(test);
    startRun(test);
    await fixture.whenStable();
    const viewport = viewportOf(fixture);
    const scrollTo = mockGeometry(viewport);

    await new Promise((resolve) => setTimeout(resolve));
    vi.advanceTimersByTime(20);
    await fixture.whenStable();

    // The anchor (first message) sits at offsetTop 0 and is shorter than the clamp.
    const reserve = viewport.querySelector('[data-aui-top-anchor-reserve]') as HTMLElement;
    expect(reserve).not.toBeNull();
    expect(reserve.previousElementSibling).toBe(viewport.querySelectorAll('.msg')[1]);
    // 0 + 300 viewport - 600 scroll height => no reserve needed; target scrollTop is 0.
    expect(reserve.style.height).toBe('0px');
    // Never the classic scroll-to-bottom on run start.
    expect(scrollTo).not.toHaveBeenCalledWith({ top: 600, behavior: 'auto' });
  });

  it('scrolls the anchor to the top with a smooth scroll and sizes the reserve', async () => {
    const test = createTestRuntime();
    const fixture = await mount(test);
    startRun(test);
    await fixture.whenStable();
    const viewport = viewportOf(fixture);
    const scrollTo = mockGeometry(viewport);
    // Put the anchor lower so the target scrollTop is non-zero.
    const anchor = viewport.querySelectorAll<HTMLElement>('.msg')[0] as HTMLElement;
    Object.defineProperty(anchor, 'offsetTop', { get: () => 500, configurable: true });

    await new Promise((resolve) => setTimeout(resolve));
    vi.advanceTimersByTime(20);
    await fixture.whenStable();

    const reserve = viewport.querySelector('[data-aui-top-anchor-reserve]') as HTMLElement;
    // target scrollTop 500 + clientHeight 300 - scrollHeight 600 => 200 reserve.
    expect(reserve.style.height).toBe('200px');
    vi.advanceTimersByTime(20);
    expect(scrollTo).toHaveBeenCalledWith({ top: 500, behavior: 'smooth' });
  });

  it('leaves the bottom-anchored viewport without a reserve', async () => {
    const test = createTestRuntime();
    const fixture = await mount(test, 'bottom');
    startRun(test);
    await fixture.whenStable();
    const viewport = viewportOf(fixture);
    mockGeometry(viewport);
    await new Promise((resolve) => setTimeout(resolve));
    vi.advanceTimersByTime(20);

    expect(viewport.querySelector('[data-aui-top-anchor-reserve]')).toBeNull();
  });

  it('removes the reserve once the turn stops being the trailing turn', async () => {
    const test = createTestRuntime();
    const fixture = await mount(test);
    startRun(test);
    await fixture.whenStable();
    const viewport = viewportOf(fixture);
    mockGeometry(viewport);
    await new Promise((resolve) => setTimeout(resolve));
    vi.advanceTimersByTime(20);
    await fixture.whenStable();
    expect(viewport.querySelector('[data-aui-top-anchor-reserve]')).not.toBeNull();

    flushTapSync(() => test.setMessages([]));
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    vi.advanceTimersByTime(20);
    await fixture.whenStable();

    expect(viewport.querySelector('[data-aui-top-anchor-reserve]')).toBeNull();
  });
});

describe('top anchor helpers', () => {
  const messages = [
    { id: 'u1', role: 'user' },
    { id: 'a1', role: 'assistant' },
  ];

  it('derives the active turn only while running a user/assistant pair', () => {
    expect(getActiveTopAnchorTurn({ isRunning: true, messages })).toEqual({
      anchorId: 'u1',
      targetId: 'a1',
    });
    expect(getActiveTopAnchorTurn({ isRunning: false, messages })).toBeNull();
    expect(getActiveTopAnchorTurn({ isRunning: true, messages: messages.slice(0, 1) })).toBeNull();
  });

  it('validates a stored turn against the trailing messages', () => {
    const turn = { anchorId: 'u1', targetId: 'a1' };
    expect(isTopAnchorTurnValid(turn, messages)).toBe(true);
    expect(isTopAnchorTurnValid(turn, [...messages, { id: 'u2', role: 'user' }])).toBe(true);
    expect(isTopAnchorTurnValid(turn, [...messages, { id: 'a2', role: 'assistant' }])).toBe(false);
    expect(isTopAnchorTurnValid(null, messages)).toBe(false);
  });

  it('parses px, em and rem and rejects other units', () => {
    const el = document.createElement('div');
    expect(parseCssLength('12px', el)).toBe(12);
    expect(parseCssLength('2em', el)).toBe(32);
    expect(parseCssLength('1.5rem', el)).toBe(24);
    expect(parseCssLength('50%', el)).toBe(Number.POSITIVE_INFINITY);
  });
});
