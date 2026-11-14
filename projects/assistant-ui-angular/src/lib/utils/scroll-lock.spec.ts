// Ported from packages/vue/src/__tests__/useScrollLock.test.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { injectScrollLock } from './scroll-lock';

interface Fixture {
  container: HTMLElement;
  child: HTMLElement;
  lock: (durationMs: number) => () => void;
  scrollTop: () => number;
  setScrollTop: (value: number) => void;
}

const setup = (): Fixture => {
  configureTestBed();
  const container = document.createElement('div');
  container.style.overflowY = 'auto';
  const child = document.createElement('div');
  container.append(child);
  document.body.append(container);

  // jsdom does not model scrolling: back scrollTop with a variable.
  let scrollTop = 0;
  Object.defineProperty(container, 'scrollTop', {
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value;
    },
    configurable: true,
  });

  return {
    container,
    child,
    lock: (durationMs) =>
      TestBed.runInInjectionContext(() =>
        injectScrollLock(new ElementRef<HTMLElement>(child), durationMs),
      ),
    scrollTop: () => scrollTop,
    setScrollTop: (value) => {
      scrollTop = value;
    },
  };
};

describe('injectScrollLock', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('freezes scrollTop for the duration, then releases it', () => {
    const f = setup();
    f.setScrollTop(120);
    f.lock(100)();

    expect(f.container.style.scrollbarWidth).toBe('none');
    f.setScrollTop(300);
    f.container.dispatchEvent(new Event('scroll'));
    expect(f.scrollTop()).toBe(120);

    vi.advanceTimersByTime(100);
    expect(f.container.style.scrollbarWidth).toBe('');
    f.setScrollTop(300);
    f.container.dispatchEvent(new Event('scroll'));
    expect(f.scrollTop()).toBe(300);
  });

  it('does nothing without a scrollable ancestor', () => {
    const f = setup();
    f.container.style.overflowY = 'visible';
    expect(() => f.lock(100)()).not.toThrow();
    expect(f.container.style.scrollbarWidth).toBe('');
  });

  it('ref-counts nested locks on one container', () => {
    const f = setup();
    f.setScrollTop(50);
    f.lock(100)();
    f.lock(300)();

    vi.advanceTimersByTime(150);
    expect(f.container.style.scrollbarWidth).toBe('none');
    f.setScrollTop(90);
    f.container.dispatchEvent(new Event('scroll'));
    expect(f.scrollTop()).toBe(50);

    vi.advanceTimersByTime(150);
    expect(f.container.style.scrollbarWidth).toBe('');
  });

  it('replaces the same caller lock when called again', () => {
    const f = setup();
    const lock = f.lock(100);
    lock();
    vi.advanceTimersByTime(80);
    lock();
    vi.advanceTimersByTime(80);
    // The first timer would have fired by now; the replacement has not.
    expect(f.container.style.scrollbarWidth).toBe('none');
    vi.advanceTimersByTime(20);
    expect(f.container.style.scrollbarWidth).toBe('');
  });

  it('releases a held lock when the injection context is destroyed', () => {
    const f = setup();
    f.lock(10_000)();
    expect(f.container.style.scrollbarWidth).toBe('none');
    TestBed.resetTestingModule();
    expect(f.container.style.scrollbarWidth).toBe('');
  });
});
