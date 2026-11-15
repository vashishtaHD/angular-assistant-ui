// Ported from packages/ui/src/components/react/assistant-ui/elements/message-timing.aui.tsx @ 7d74276
// No upstream test exists; this covers the element's rendered behaviour.
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  AuiMessageTemplateDirective,
  AuiProviderDirective,
  AuiThreadMessagesComponent,
} from 'angular-assistant-ui';
import { afterEach, beforeEach, describe, expect, it, onTestFinished } from 'vitest';
import { useFlexAuthorClass } from '../../src/testing-internal/author-css';
import { configureTestBed } from '../../src/testing-internal/test-bed';
import { createTestRuntime, type TestRuntime } from '../../src/testing-internal/test-runtime';
import { AuiMessageTimingComponent, formatTimingMs } from './message-timing.component';
import { overlayRoot } from './test-helpers';

let runtime: TestRuntime;

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessageTimingComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [auiProvider]="config">
    <aui-thread-messages>
      <ng-template auiMessage
        ><div class="row"><aui-message-timing /></div
      ></ng-template>
    </aui-thread-messages>
  </div>`,
})
class HostComponent {
  readonly config = runtime.config;
}

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

let mounted: HTMLElement | undefined;

async function mount(timing: Record<string, number> | undefined) {
  runtime = createTestRuntime();
  runtime.append({
    role: 'user',
    content: [{ type: 'text', text: 'hi' }],
    metadata: { timing } as never,
  });
  runtime.append({
    role: 'assistant',
    content: [{ type: 'text', text: 'hello' }],
    ...(timing ? { metadata: { timing } as never } : {}),
  });
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  const root = fixture.nativeElement as HTMLElement;
  document.body.append(root);
  mounted = root;
  fixture.detectChanges();
  await settle(fixture);
  return {
    fixture,
    root,
    settle: () => settle(fixture),
    popover: () => overlayRoot().querySelector<HTMLElement>('[data-slot="message-timing-popover"]'),
  };
}

beforeEach(() => useFlexAuthorClass());

afterEach(() => {
  mounted?.remove();
  mounted = undefined;
  TestBed.resetTestingModule();
});

describe('formatTimingMs', () => {
  it('formats like upstream', () => {
    expect(formatTimingMs(undefined)).toBe('—');
    expect(formatTimingMs(120.4)).toBe('120ms');
    expect(formatTimingMs(1500)).toBe('1.50s');
  });
});

describe('aui-message-timing', () => {
  it('shows the total as a badge and the stats in a popover on focus and hover', async () => {
    const t = await mount({
      streamStartTime: 1,
      firstTokenTime: 120,
      totalStreamTime: 1500,
      tokensPerSecond: 42,
      totalChunks: 7,
      toolCallCount: 0,
    });
    const triggers = t.root.querySelectorAll<HTMLButtonElement>(
      '[data-slot="message-timing-trigger"]',
    );
    // Only the assistant message carries timing.
    expect(triggers).toHaveLength(1);
    const trigger = triggers[0]!;
    expect(trigger.textContent?.trim()).toBe('1.50s');
    expect(trigger.getAttribute('aria-label')).toBe('Message timing');
    // Closed: nothing is rendered, in the row or in the overlay.
    expect(t.root.querySelector('[data-slot="message-timing-popover"]')).toBeNull();
    expect(t.popover()).toBeNull();
    expect(trigger.hasAttribute('aria-describedby')).toBe(false);

    trigger.dispatchEvent(new FocusEvent('focus'));
    await t.settle();
    const popover = t.popover()!;
    // Open: rendered into the CDK overlay so no scrolling ancestor clips it.
    expect(popover).not.toBeNull();
    expect(t.root.contains(popover)).toBe(false);
    expect(popover.hidden).toBe(false);
    expect(popover.getAttribute('role')).toBe('tooltip');
    expect(trigger.getAttribute('aria-describedby')).toBe(popover.id);
    const rows = Array.from(popover.querySelectorAll('.aui-message-timing-row'), (row) =>
      Array.from(row.children, (cell) => cell.textContent?.trim()),
    );
    expect(rows).toEqual([
      ['First token', '120ms'],
      ['Total', '1.50s'],
      ['Speed', '42.0 tok/s'],
      ['Chunks', '7'],
    ]);

    trigger.dispatchEvent(new FocusEvent('blur'));
    await t.settle();
    expect(t.popover()).toBeNull();
    expect(trigger.hasAttribute('aria-describedby')).toBe(false);
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    await t.settle();
    expect(t.popover()).not.toBeNull();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await t.settle();
    expect(t.popover()).toBeNull();
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    await t.settle();
    trigger.dispatchEvent(new MouseEvent('mouseleave'));
    await t.settle();
    expect(t.popover()).toBeNull();
  });

  it('flips to the other side when the preferred side runs out of viewport', async () => {
    // jsdom has no layout: put the badge at the right edge of a 1024px viewport
    // and give the overlay pane a size, so the CDK has something to measure.
    const original = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const rect = (left: number, top: number, width: number, height: number) =>
        ({
          left,
          top,
          width,
          height,
          right: left + width,
          bottom: top + height,
          x: left,
          y: top,
        }) as DOMRect;
      if (this.matches('[data-slot="message-timing-trigger"]')) return rect(990, 300, 30, 20);
      if (this.classList.contains('cdk-overlay-pane')) return rect(0, 0, 140, 80);
      return original.call(this);
    };
    // The CDK reads the viewport size from the root element's client box.
    const root = document.documentElement;
    Object.defineProperty(root, 'clientWidth', { configurable: true, value: 1024 });
    Object.defineProperty(root, 'clientHeight', { configurable: true, value: 768 });
    onTestFinished(() => {
      Element.prototype.getBoundingClientRect = original;
      delete (root as { clientWidth?: number }).clientWidth;
      delete (root as { clientHeight?: number }).clientHeight;
    });
    const t = await mount({
      streamStartTime: 1,
      totalStreamTime: 80,
      totalChunks: 2,
      toolCallCount: 0,
    });
    const trigger = t.root.querySelector<HTMLElement>('[data-slot="message-timing-trigger"]')!;
    trigger.dispatchEvent(new FocusEvent('focus'));
    await t.settle();
    expect(t.popover()!.getAttribute('data-side')).toBe('left');
  });

  it('omits the optional rows', async () => {
    const t = await mount({
      streamStartTime: 1,
      totalStreamTime: 80,
      totalChunks: 2,
      toolCallCount: 0,
    });
    t.root
      .querySelector('[data-slot="message-timing-trigger"]')!
      .dispatchEvent(new FocusEvent('focus'));
    await t.settle();
    const labels = Array.from(
      t.popover()!.querySelectorAll('.aui-message-timing-row > :first-child'),
      (el) => el.textContent?.trim(),
    );
    expect(labels).toEqual(['Total', 'Chunks']);
  });

  it('renders nothing until the stream completes', async () => {
    const t = await mount({ streamStartTime: 1, totalChunks: 2, toolCallCount: 0 });
    expect(t.root.querySelector('[data-slot="message-timing-trigger"]')).toBeNull();
  });
});
