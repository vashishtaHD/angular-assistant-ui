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
import {
  AuiThreadViewportDirective,
  type AuiTopAnchorMessageClamp,
} from './thread-viewport.directive';

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
      <div
        class="viewport"
        auiThreadViewport
        [turnAnchor]="turnAnchor()"
        [topAnchorMessageClamp]="clamp()"
      >
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
  readonly clamp = input<AuiTopAnchorMessageClamp | undefined>(undefined);
}

const text = (value: string) => [{ type: 'text', text: value }] as const;

const mockGeometry = (viewport: HTMLElement, scrollHeight = 600) => {
  Object.defineProperty(viewport, 'scrollHeight', { get: () => scrollHeight, configurable: true });
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

async function mount(
  test: TestRuntime,
  inputs: { turnAnchor?: 'top' | 'bottom'; clamp?: AuiTopAnchorMessageClamp } = {},
) {
  configureTestBed({ imports: [HostComponent] });
  const fixture: ComponentFixture<HostComponent> = TestBed.createComponent(HostComponent);
  fixture.componentRef.setInput('runtime', test);
  fixture.componentRef.setInput('turnAnchor', inputs.turnAnchor ?? 'top');
  if (inputs.clamp) fixture.componentRef.setInput('clamp', inputs.clamp);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  return fixture;
}

const viewportOf = (fixture: ComponentFixture<unknown>) =>
  (fixture.nativeElement as HTMLElement).querySelector('.viewport') as HTMLElement;

const msgs = (viewport: HTMLElement) => Array.from(viewport.querySelectorAll<HTMLElement>('.msg'));

const reserveOf = (viewport: HTMLElement) =>
  viewport.querySelector<HTMLElement>('[data-aui-top-anchor-reserve]');

describe('turnAnchor="top"', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /** A finished first pair, then a new user message and a streaming reply. */
  const startRun = (test: TestRuntime) => {
    flushTapSync(() => test.append({ role: 'user', content: text('first') }));
    flushTapSync(() => test.append({ role: 'assistant', content: text('first answer') }));
    flushTapSync(() => test.append({ role: 'user', content: text('question') }));
    flushTapSync(() => test.setRunning(true));
    flushTapSync(() => test.append({ role: 'assistant', content: text('answer') }));
  };

  const frame = async (fixture: ComponentFixture<unknown>) => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    vi.advanceTimersByTime(20);
    await fixture.whenStable();
  };

  /** Starts a run, installs geometry before the first frame, then runs it. */
  const run = async (
    test: TestRuntime,
    fixture: ComponentFixture<unknown>,
    scrollHeight?: number,
  ) => {
    startRun(test);
    await fixture.whenStable();
    const viewport = viewportOf(fixture);
    const scrollTo = mockGeometry(viewport, scrollHeight);
    await frame(fixture);
    return { viewport, scrollTo };
  };

  it('pins the last user message to the top on run start and adds a reserve after the reply', async () => {
    const test = createTestRuntime();
    const fixture = await mount(test);
    const { viewport, scrollTo } = await run(test, fixture);

    const reserve = reserveOf(viewport);
    expect(reserve).not.toBeNull();
    expect(reserve?.previousElementSibling).toBe(msgs(viewport)[3]);
    // Anchor (third message) at 200 + 300 viewport < 600 scroll height: no reserve needed.
    expect(reserve?.style.height).toBe('0px');
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
    Object.defineProperty(msgs(viewport)[2], 'offsetTop', { get: () => 500, configurable: true });
    await frame(fixture);

    // target scrollTop 500 + clientHeight 300 - scrollHeight 600 => 200 reserve.
    expect(reserveOf(viewport)?.style.height).toBe('200px');
    vi.advanceTimersByTime(20);
    expect(scrollTo).toHaveBeenCalledWith({ top: 500, behavior: 'smooth' });
  });

  it('has no eligible anchor for the first user message: no reserve, no scroll, no marks', async () => {
    const test = createTestRuntime();
    const fixture = await mount(test);
    flushTapSync(() => test.append({ role: 'user', content: text('first') }));
    flushTapSync(() => test.setRunning(true));
    flushTapSync(() => test.append({ role: 'assistant', content: text('answer') }));
    await fixture.whenStable();
    const viewport = viewportOf(fixture);
    const scrollTo = mockGeometry(viewport);
    Object.defineProperty(msgs(viewport)[0], 'offsetTop', { get: () => 500, configurable: true });
    await frame(fixture);

    expect(reserveOf(viewport)).toBeNull();
    expect(scrollTo).not.toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
    expect(viewport.querySelector('[data-aui-top-anchor-user]')).toBeNull();
    // The reply is still a separately eligible target.
    expect(msgs(viewport)[1].hasAttribute('data-aui-top-anchor-target')).toBe(true);
  });

  it('marks the anchor and target, moves the marks to a new turn and clears them when superseded', async () => {
    const test = createTestRuntime();
    const fixture = await mount(test);
    const { viewport } = await run(test, fixture);
    let list = msgs(viewport);
    expect(list.map((el) => el.hasAttribute('data-aui-top-anchor-user'))).toEqual([
      false,
      false,
      true,
      false,
    ]);
    expect(list.map((el) => el.hasAttribute('data-aui-top-anchor-target'))).toEqual([
      false,
      false,
      false,
      true,
    ]);

    // A new turn: the marks move to the new pair.
    flushTapSync(() => test.setRunning(false));
    flushTapSync(() => test.append({ role: 'user', content: text('again') }));
    flushTapSync(() => test.setRunning(true));
    flushTapSync(() => test.append({ role: 'assistant', content: text('again answer') }));
    await frame(fixture);
    list = msgs(viewport);
    expect(list.map((el) => el.hasAttribute('data-aui-top-anchor-user'))).toEqual([
      false,
      false,
      false,
      false,
      true,
      false,
    ]);
    expect(list.map((el) => el.hasAttribute('data-aui-top-anchor-target'))).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
    ]);

    // An assistant message after the target supersedes the turn: marks and reserve go.
    flushTapSync(() => test.setRunning(false));
    flushTapSync(() => test.append({ role: 'assistant', content: text('extra') }));
    await frame(fixture);
    expect(viewport.querySelector('[data-aui-top-anchor-user]')).toBeNull();
    expect(viewport.querySelector('[data-aui-top-anchor-target]')).toBeNull();
    expect(reserveOf(viewport)).toBeNull();
  });

  it('leaves the bottom-anchored viewport without a reserve', async () => {
    const test = createTestRuntime();
    const fixture = await mount(test, { turnAnchor: 'bottom' });
    const { viewport } = await run(test, fixture);

    expect(reserveOf(viewport)).toBeNull();
    expect(viewport.querySelector('[data-aui-top-anchor-user]')).toBeNull();
  });

  it('removes the reserve once the turn stops being the trailing turn', async () => {
    const test = createTestRuntime();
    const fixture = await mount(test);
    const { viewport } = await run(test, fixture);
    expect(reserveOf(viewport)).not.toBeNull();

    flushTapSync(() => test.setMessages([]));
    await frame(fixture);

    expect(reserveOf(viewport)).toBeNull();
  });

  it('keeps the initial turnAnchor after the input changes', async () => {
    const test = createTestRuntime();
    const fixture = await mount(test);
    fixture.componentRef.setInput('turnAnchor', 'bottom');
    await fixture.whenStable();
    const { viewport, scrollTo } = await run(test, fixture);

    // Still top-anchored: the reserve exists and run start did not scroll to the bottom.
    expect(reserveOf(viewport)).not.toBeNull();
    expect(scrollTo).not.toHaveBeenCalledWith({ top: 600, behavior: 'auto' });
  });

  it('stays bottom-anchored when turnAnchor changes to top after attach', async () => {
    const test = createTestRuntime();
    const fixture = await mount(test, { turnAnchor: 'bottom' });
    fixture.componentRef.setInput('turnAnchor', 'top');
    await fixture.whenStable();
    const { viewport } = await run(test, fixture);

    expect(reserveOf(viewport)).toBeNull();
  });

  it('keeps the initial clamp after the input changes', async () => {
    const test = createTestRuntime();
    const fixture = await mount(test, { clamp: { tallerThan: '10px', visibleHeight: '20px' } });
    fixture.componentRef.setInput('clamp', { tallerThan: '1000px', visibleHeight: '20px' });
    await fixture.whenStable();
    const { viewport } = await run(test, fixture, 500);

    // Clamped by the initial config: target 200 + (60 - 20) = 240, so 240 + 300 - 500.
    expect(reserveOf(viewport)?.style.height).toBe('40px');
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
