// Ported from packages/vue/src/__tests__/primitives-content.test.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { flushTapSync } from '@assistant-ui/tap';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime, type TestRuntime } from '../../testing-internal/test-runtime';
import { AuiThreadViewportDirective } from './thread-viewport.directive';
import { AUI_VIEWPORT, type AuiViewport } from './viewport-context';

@Component({
  standalone: true,
  imports: [AuiProviderDirective, AuiThreadViewportDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [auiProvider]="runtime().config">
      <div
        class="viewport"
        auiThreadViewport
        [autoScroll]="autoScroll()"
        [scrollToBottomOnInitialize]="onInitialize()"
        [scrollToBottomOnRunStart]="onRunStart()"
      >
        <p>row</p>
      </div>
    </div>
  `,
})
class HostComponent {
  readonly runtime = input.required<TestRuntime>();
  readonly autoScroll = input(true);
  readonly onInitialize = input(true);
  readonly onRunStart = input(true);
}

@Component({
  standalone: true,
  imports: [AuiProviderDirective, AuiThreadViewportDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [auiProvider]="runtime().config">
      @if (show()) {
        <div class="viewport" auiThreadViewport><p>row</p></div>
      }
    </div>
  `,
})
class LateHostComponent {
  readonly runtime = input.required<TestRuntime>();
  readonly show = input(false);
}

const mockViewportGeometry = (div: HTMLElement) => {
  Object.defineProperty(div, 'scrollHeight', { get: () => 500, configurable: true });
  Object.defineProperty(div, 'clientHeight', { get: () => 100, configurable: true });
  const scrollTo = vi.fn();
  Object.defineProperty(div, 'scrollTo', { value: scrollTo, configurable: true });
  return scrollTo;
};

async function mount(
  runtime: TestRuntime,
  inputs: Partial<{ autoScroll: boolean; onInitialize: boolean; onRunStart: boolean }> = {},
): Promise<ComponentFixture<HostComponent>> {
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentRef.setInput('runtime', runtime);
  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  return fixture;
}

const viewportOf = (fixture: ComponentFixture<HostComponent>) =>
  (fixture.nativeElement as HTMLElement).querySelector('div.viewport') as HTMLElement;

const flushFrame = async (fixture: ComponentFixture<unknown>) => {
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve));
  vi.advanceTimersToNextFrame();
  await fixture.whenStable();
};

const userMessage = { role: 'user', content: [{ type: 'text', text: 'one' }] } as const;

describe('AuiThreadViewportDirective', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
    warn = vi.spyOn(console, 'warn');
  });

  afterEach(() => {
    expect(warn).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('scrolls to bottom on initialize', async () => {
    const test = createTestRuntime();
    const fixture = await mount(test);
    const scrollTo = mockViewportGeometry(viewportOf(fixture));

    flushTapSync(() => test.append(userMessage));
    await flushFrame(fixture);

    expect(scrollTo).toHaveBeenCalledWith({ top: 500, behavior: 'instant' });
  });

  it('scrolls on run start', async () => {
    const active = createTestRuntime();
    const activeFixture = await mount(active, { autoScroll: false, onInitialize: false });
    const activeScrollTo = mockViewportGeometry(viewportOf(activeFixture));
    flushTapSync(() => active.setRunning(true));
    await flushFrame(activeFixture);
    expect(activeScrollTo).toHaveBeenCalledWith({ top: 500, behavior: 'auto' });
  });

  it('stays put on run start when that option is disabled', async () => {
    const disabled = createTestRuntime();
    const disabledFixture = await mount(disabled, {
      autoScroll: false,
      onInitialize: false,
      onRunStart: false,
    });
    const disabledScrollTo = mockViewportGeometry(viewportOf(disabledFixture));
    flushTapSync(() => disabled.setRunning(true));
    await flushFrame(disabledFixture);
    expect(disabledScrollTo).not.toHaveBeenCalled();
  });

  it('does not auto-scroll when autoScroll is false', async () => {
    const test = createTestRuntime();
    const fixture = await mount(test, {
      autoScroll: false,
      onInitialize: false,
      onRunStart: false,
    });
    const scrollTo = mockViewportGeometry(viewportOf(fixture));

    flushTapSync(() => test.append(userMessage));
    await flushFrame(fixture);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('isAtBottom reflects scroll position and scrollToBottom scrolls', async () => {
    const test = createTestRuntime();
    const fixture = await mount(test);
    const div = viewportOf(fixture);
    let scrollTop = 400;
    Object.defineProperty(div, 'scrollHeight', { get: () => 500, configurable: true });
    Object.defineProperty(div, 'clientHeight', { get: () => 100, configurable: true });
    Object.defineProperty(div, 'scrollTop', {
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
      configurable: true,
    });
    const scrollTo = vi.fn(({ top }: { top: number }) => {
      scrollTop = Math.max(0, Math.min(top, 400));
    });
    Object.defineProperty(div, 'scrollTo', { value: scrollTo, configurable: true });
    const viewport: AuiViewport = fixture.debugElement
      .query(By.directive(AuiThreadViewportDirective))
      .injector.get(AUI_VIEWPORT);

    div.dispatchEvent(new Event('scroll'));
    await flushFrame(fixture);
    expect(viewport.isAtBottom()).toBe(true);

    scrollTop = 50;
    div.dispatchEvent(new Event('scroll'));
    await flushFrame(fixture);
    expect(viewport.isAtBottom()).toBe(false);

    viewport.scrollToBottom();
    expect(scrollTo).toHaveBeenCalledWith({ top: 500, behavior: 'auto' });
    div.dispatchEvent(new Event('scroll'));
    await flushFrame(fixture);
    expect(viewport.isAtBottom()).toBe(true);
  });

  it('scrolls on initialize without bound inputs when the client already exists', async () => {
    const test = createTestRuntime();
    flushTapSync(() => test.append(userMessage));
    configureTestBed({ imports: [LateHostComponent] });
    const fixture = TestBed.createComponent(LateHostComponent);
    fixture.componentRef.setInput('runtime', test);
    fixture.autoDetectChanges();
    await fixture.whenStable();

    fixture.componentRef.setInput('show', true);
    await fixture.whenStable();
    const div = (fixture.nativeElement as HTMLElement).querySelector('div.viewport') as HTMLElement;
    const scrollTo = mockViewportGeometry(div);
    await flushFrame(fixture);

    expect(scrollTo).toHaveBeenCalledWith({ top: 500, behavior: 'instant' });
  });

  it('does not attach or throw when destroyed before the first render', () => {
    const test = createTestRuntime();
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentRef.setInput('runtime', test);
    expect(() => fixture.destroy()).not.toThrow();
  });

  it('detaches on destroy', async () => {
    const test = createTestRuntime();
    const fixture = await mount(test);
    const scrollTo = mockViewportGeometry(viewportOf(fixture));
    fixture.destroy();

    flushTapSync(() => test.setRunning(true));
    flushTapSync(() => test.append(userMessage));
    await new Promise((resolve) => setTimeout(resolve));
    vi.advanceTimersToNextFrame();

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
