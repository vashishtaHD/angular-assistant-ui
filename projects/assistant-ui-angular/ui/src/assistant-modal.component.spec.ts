// Ported from packages/ui/src/components/react/assistant-ui/elements/assistant-modal.aui.test.tsx @ 7d74276
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { RemoteThreadListAdapter, RemoteThreadMetadata } from '@assistant-ui/core';
import { AuiProviderDirective, injectAui } from 'angular-assistant-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../src/testing-internal/test-bed';
import { createTestRuntime } from '../../src/testing-internal/test-runtime';
import { AuiAssistantModalComponent } from './assistant-modal.component';
import { overlayRoot, stubLayout } from './test-helpers';

const SIZE_STORAGE_KEY = 'aui-modal-size';

const makeAdapter = (titles: string[]): RemoteThreadListAdapter => ({
  list: vi.fn(async () => ({
    threads: titles.map((title, index): RemoteThreadMetadata => ({
      status: 'regular',
      remoteId: `t${index}`,
      title,
    })),
  })),
  initialize: vi.fn(async (threadId: string) => ({
    remoteId: `remote-${threadId}`,
    externalId: undefined,
  })),
  rename: vi.fn(async () => undefined),
  archive: vi.fn(async () => undefined),
  unarchive: vi.fn(async () => undefined),
  delete: vi.fn(async () => undefined),
  generateTitle: vi.fn(async () => new ReadableStream() as never),
  fetch: vi.fn(async (remoteId: string) => ({
    status: 'regular' as const,
    remoteId,
    externalId: undefined,
  })),
});

let list: ReturnType<ReturnType<typeof createTestRuntime>['withThreadList']>;
let initialOpen = false;

@Component({
  selector: 'aui-modal-probe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class ProbeComponent {
  readonly aui = injectAui();
}

@Component({
  standalone: true,
  imports: [AuiProviderDirective, AuiAssistantModalComponent, ProbeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [auiProvider]="config">
    <aui-modal-probe />
    <aui-assistant-modal [(open)]="open" />
  </div>`,
})
class HostComponent {
  readonly config = list.config;
  readonly open = signal(initialOpen);
}

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 4; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

let restoreLayout: () => void;
let mounted: HTMLElement | undefined;

async function mount(titles: string[] = [], open = false) {
  list = createTestRuntime().withThreadList(makeAdapter(titles));
  initialOpen = open;
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
    launcher: () => root.querySelector<HTMLButtonElement>('.aui-modal-button')!,
    panel: () => overlayRoot().querySelector<HTMLElement>('.aui-modal-content'),
    part: (name: string) => overlayRoot().querySelector<HTMLElement>(`.aui-modal-${name}`),
    settle: () => settle(fixture),
    /** Starts a run on the main thread (fires `thread.runStart`). */
    startRun: async () => {
      const { aui } = fixture.debugElement.query(By.directive(ProbeComponent))
        .componentInstance as ProbeComponent;
      list.runtimeFor(aui.threads.getState().mainThreadId).setRunning(true);
      await settle(fixture);
    },
  };
}

beforeEach(() => {
  restoreLayout = stubLayout();
  try {
    window.localStorage.removeItem(SIZE_STORAGE_KEY);
  } catch {
    // ignore
  }
});

afterEach(() => {
  mounted?.remove();
  mounted = undefined;
  TestBed.resetTestingModule();
  restoreLayout();
});

describe('aui-assistant-modal', () => {
  it('creates the panel when it starts open, and follows later external open changes', async () => {
    const t = await mount([], true);
    expect(t.launcher().getAttribute('aria-expanded')).toBe('true');
    expect(t.panel()).not.toBeNull();
    expect(t.panel()!.querySelector('aui-thread')).not.toBeNull();

    t.fixture.componentInstance.open.set(false);
    await t.settle();
    expect(t.panel()).toBeNull();
    expect(t.launcher().getAttribute('aria-expanded')).toBe('false');

    t.fixture.componentInstance.open.set(true);
    await t.settle();
    expect(t.panel()).not.toBeNull();

    // The launcher writes back through the two-way binding.
    t.launcher().click();
    await t.settle();
    expect(t.fixture.componentInstance.open()).toBe(false);
    expect(t.panel()).toBeNull();
  });

  it('a run start opens the closed panel on the thread view', async () => {
    const t = await mount(['Alpha']);
    expect(t.panel()).toBeNull();
    await t.startRun();
    expect(t.panel()).not.toBeNull();
    expect(t.part('thread-list')).toBeNull();
    expect(t.part('thread')!.hasAttribute('inert')).toBe(false);
  });

  it('a run start while the open panel shows Threads switches back to the running thread', async () => {
    const t = await mount(['Alpha', 'Beta']);
    t.launcher().click();
    await t.settle();
    t.part('threads')!.click();
    await t.settle();
    expect(t.part('thread-list')).not.toBeNull();
    expect(t.part('thread')!.hasAttribute('inert')).toBe(true);

    await t.startRun();
    expect(t.part('thread-list')).toBeNull();
    expect(t.part('thread')!.hasAttribute('inert')).toBe(false);
    expect(t.part('title')!.textContent?.trim()).not.toBe('Threads');
  });

  it('the launcher opens and closes the panel, which holds aui-thread', async () => {
    const t = await mount();
    const launcher = t.launcher();
    expect(launcher.getAttribute('aria-expanded')).toBe('false');
    expect(launcher.getAttribute('aria-label')).toBe('Open Assistant');
    expect(t.panel()).toBeNull();

    launcher.click();
    await t.settle();
    const panel = t.panel()!;
    expect(panel).not.toBeNull();
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.querySelector('aui-thread')).not.toBeNull();
    expect(launcher.getAttribute('aria-expanded')).toBe('true');
    expect(launcher.getAttribute('aria-label')).toBe('Close Assistant');
    expect(panel.getAttribute('aria-labelledby')).toBe(t.part('title')!.id);
    expect(t.part('title')!.textContent?.trim()).toBe('New Chat');

    launcher.click();
    await t.settle();
    expect(t.panel()).toBeNull();
    expect(launcher.getAttribute('aria-expanded')).toBe('false');
  });

  it('traps focus inside the open panel and Escape returns focus to the launcher', async () => {
    const t = await mount();
    t.launcher().click();
    await t.settle();
    const panel = t.panel()!;
    expect(panel.contains(document.activeElement)).toBe(true);

    const anchors = Array.from(
      overlayRoot().querySelectorAll<HTMLElement>('.cdk-focus-trap-anchor'),
    );
    expect(anchors).toHaveLength(2);
    // Tabbing past the last element lands on the end anchor, which wraps to the first.
    anchors[1]!.focus();
    expect(panel.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(anchors[1]);
    // Shift+Tab before the first lands on the start anchor, which wraps to the last.
    anchors[0]!.focus();
    expect(panel.contains(document.activeElement)).toBe(true);

    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    await t.settle();
    expect(t.panel()).toBeNull();
    expect(document.activeElement).toBe(t.launcher());
  });

  it('switches between the thread and the thread list views', async () => {
    const t = await mount(['Alpha', 'Beta']);
    t.launcher().click();
    await t.settle();
    const threads = t.part('threads') as HTMLButtonElement;
    expect(threads.disabled).toBe(false);
    expect(threads.getAttribute('aria-pressed')).toBe('false');
    threads.click();
    await t.settle();
    expect(threads.getAttribute('aria-pressed')).toBe('true');
    expect(t.part('title')!.textContent?.trim()).toBe('Threads');
    expect(t.part('thread')!.hasAttribute('inert')).toBe(true);
    const list = t.part('thread-list')!;
    const titles = Array.from(
      list.querySelectorAll('[data-slot="aui_thread-list-item-title"]'),
      (el) => el.textContent?.trim(),
    );
    expect(titles).toEqual(['Alpha', 'Beta']);
    list.querySelector<HTMLElement>('[data-slot="aui_thread-list-item-trigger"]')!.click();
    await t.settle();
    expect(t.part('thread-list')).toBeNull();
    expect(t.part('thread')!.hasAttribute('inert')).toBe(false);
    expect(t.part('title')!.textContent?.trim()).toBe('Alpha');
  });

  it('disables the threads button while there are no threads', async () => {
    const t = await mount();
    t.launcher().click();
    await t.settle();
    expect((t.part('threads') as HTMLButtonElement).disabled).toBe(true);
  });

  it('resizes from the handle with the keyboard and resets on Enter', async () => {
    const t = await mount();
    t.launcher().click();
    await t.settle();
    const panel = t.panel()!;
    panel.getBoundingClientRect = () =>
      ({ width: 400, height: 500, top: 0, left: 0, right: 400, bottom: 500 }) as DOMRect;
    const handle = t.part('resize-handle')!;
    expect(handle.getAttribute('aria-label')).toBe('Resize Assistant');
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await t.settle();
    expect(panel.style.height).toBe('516px');
    expect(panel.style.width).toBe('400px');
    expect(JSON.parse(window.localStorage.getItem(SIZE_STORAGE_KEY) ?? 'null')).toEqual({
      width: 400,
      height: 516,
    });
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await t.settle();
    expect(panel.style.height).toBe('');
    expect(window.localStorage.getItem(SIZE_STORAGE_KEY)).toBeNull();
  });
});
