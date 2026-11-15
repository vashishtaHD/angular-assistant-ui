// Ported from packages/vue/src/primitives/ThreadPrimitiveScrollToBottom.ts behaviour @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime } from '../../testing-internal/test-runtime';
import { AuiThreadScrollToBottomDirective } from './thread-scroll-to-bottom.directive';
import { AuiThreadViewportDirective } from './thread-viewport.directive';
import { AUI_VIEWPORT, type AuiViewport } from './viewport-context';

@Component({
  standalone: true,
  imports: [AuiProviderDirective, AuiThreadViewportDirective, AuiThreadScrollToBottomDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [auiProvider]="config">
      <div class="viewport" auiThreadViewport>
        <button class="jump" auiThreadScrollToBottom behavior="smooth">down</button>
      </div>
    </div>
  `,
})
class RealViewportHostComponent {
  readonly config = createTestRuntime().config;
}

@Component({
  standalone: true,
  imports: [AuiThreadScrollToBottomDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button class="jump" auiThreadScrollToBottom>down</button>`,
})
class BareHostComponent {}

describe('AuiThreadScrollToBottomDirective', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('is disabled at the bottom, enabled after a scroll up, and scrolls on click', async () => {
    configureTestBed({ imports: [RealViewportHostComponent] });
    const fixture = TestBed.createComponent(RealViewportHostComponent);
    const root = fixture.nativeElement as HTMLElement;
    const div = root.querySelector('.viewport') as HTMLElement;
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
      scrollTop = Math.min(top, 400);
    });
    Object.defineProperty(div, 'scrollTo', { value: scrollTo, configurable: true });
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const button = root.querySelector('.jump') as HTMLButtonElement;
    const settle = async () => {
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));
      vi.advanceTimersToNextFrame();
      await fixture.whenStable();
    };

    div.dispatchEvent(new Event('scroll'));
    await settle();
    expect(button.disabled).toBe(true);
    expect(button.hasAttribute('data-disabled')).toBe(true);
    expect(button.type).toBe('button');

    scrollTop = 50;
    div.dispatchEvent(new Event('scroll'));
    await settle();
    expect(button.disabled).toBe(false);

    button.click();
    expect(scrollTo).toHaveBeenCalledWith({ top: 500, behavior: 'smooth' });
  });

  it('calls scrollToBottom with the default behavior and ignores prevented clicks', async () => {
    const scrollToBottom = vi.fn();
    const viewport: AuiViewport = {
      isAtBottom: signal(false),
      scrollToBottom,
      registerContentInset: () => ({ setHeight: vi.fn(), unregister: vi.fn() }),
      onScrollToBottom: () => () => undefined,
    };
    configureTestBed({
      imports: [BareHostComponent],
      providers: [{ provide: AUI_VIEWPORT, useValue: viewport }],
    });
    const fixture = TestBed.createComponent(BareHostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector('.jump') as HTMLElement;

    button.click();
    expect(scrollToBottom).toHaveBeenCalledWith('auto');
  });

  it('stays disabled and warns once outside a viewport', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    configureTestBed({ imports: [BareHostComponent] });
    const fixture = TestBed.createComponent(BareHostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector(
      '.jump',
    ) as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
