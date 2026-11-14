// Ported from packages/vue/src/primitives/ThreadPrimitiveViewportFooter.test.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@angular/core';
import { configureTestBed } from '../../testing-internal/test-bed';
import { AuiThreadViewportFooterDirective } from './thread-viewport-footer.directive';
import { AUI_VIEWPORT, type AuiViewport } from './viewport-context';

@Component({
  standalone: true,
  imports: [AuiThreadViewportFooterDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="footer" style="margin-top: 8px" auiThreadViewportFooter>footer</div>`,
})
class HostComponent {}

let resizeCallbacks: (() => void)[] = [];
let disconnected = 0;

class FakeResizeObserver {
  constructor(callback: () => void) {
    resizeCallbacks.push(callback);
  }
  observe(): void {
    // Geometry is driven by the spec.
  }
  unobserve(): void {
    // Nothing to release.
  }
  disconnect(): void {
    disconnected++;
  }
}

const makeViewport = () => {
  const setHeight = vi.fn();
  const unregister = vi.fn();
  const viewport: AuiViewport = {
    isAtBottom: signal(true),
    scrollToBottom: vi.fn(),
    registerContentInset: () => ({ setHeight, unregister }),
    onScrollToBottom: () => () => undefined,
  };
  return { viewport, setHeight, unregister };
};

describe('AuiThreadViewportFooterDirective', () => {
  beforeEach(() => {
    resizeCallbacks = [];
    disconnected = 0;
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const mount = async (viewport: AuiViewport | null) => {
    configureTestBed({
      imports: [HostComponent],
      providers: viewport ? [{ provide: AUI_VIEWPORT, useValue: viewport }] : [],
    });
    let height = 40;
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => height);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    return { fixture, setHeight: (value: number) => (height = value) };
  };

  it('registers its height plus margin as a content inset', async () => {
    const { viewport, setHeight } = makeViewport();
    await mount(viewport);
    expect(setHeight).toHaveBeenLastCalledWith(48);
  });

  it('updates the inset when its height changes', async () => {
    const { viewport, setHeight } = makeViewport();
    const host = await mount(viewport);
    host.setHeight(100);
    for (const callback of resizeCallbacks) callback();
    expect(setHeight).toHaveBeenLastCalledWith(108);
  });

  it('unregisters and disconnects on destroy', async () => {
    const { viewport, unregister } = makeViewport();
    const host = await mount(viewport);
    host.fixture.destroy();
    expect(unregister).toHaveBeenCalledTimes(1);
    expect(disconnected).toBeGreaterThan(0);
  });

  it('does nothing outside a viewport', async () => {
    const host = await mount(null);
    expect(() => host.fixture.destroy()).not.toThrow();
  });
});
