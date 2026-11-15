// Covers packages/ui/src/components/react/assistant-ui/elements/threadlist-sidebar.aui.tsx @ 7d74276
// (shadcn's Sidebar collapses to an off-canvas sheet below 768px).
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { AuiProviderDirective } from 'angular-assistant-ui';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { displayOf, useFlexAuthorClass } from '../../src/testing-internal/author-css';
import { configureTestBed } from '../../src/testing-internal/test-bed';
import { createTestRuntime } from '../../src/testing-internal/test-runtime';
import { AuiThreadListSidebarComponent } from './thread-list-sidebar.component';

/** A controllable `window.matchMedia` for `(max-width: …)` queries. */
function fakeViewport(initialWidth: number) {
  let width = initialWidth;
  const lists: { query: string; listeners: Set<(event: MediaQueryListEvent) => void> }[] = [];
  const matches = (query: string) => {
    const max = /max-width:\s*([\d.]+)px/.exec(query);
    return max ? width <= Number(max[1]) : false;
  };
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => {
    const entry = { query, listeners: new Set<(event: MediaQueryListEvent) => void>() };
    lists.push(entry);
    return {
      get matches() {
        return matches(query);
      },
      media: query,
      onchange: null,
      addEventListener: (_: string, fn: (event: MediaQueryListEvent) => void) =>
        entry.listeners.add(fn),
      removeEventListener: (_: string, fn: (event: MediaQueryListEvent) => void) =>
        entry.listeners.delete(fn),
      addListener: (fn: (event: MediaQueryListEvent) => void) => entry.listeners.add(fn),
      removeListener: (fn: (event: MediaQueryListEvent) => void) => entry.listeners.delete(fn),
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
  return {
    resize(next: number) {
      width = next;
      for (const entry of lists) {
        for (const fn of entry.listeners) {
          fn({ matches: matches(entry.query), media: entry.query } as MediaQueryListEvent);
        }
      }
    },
    listenerCount: () => lists.reduce((sum, entry) => sum + entry.listeners.size, 0),
    restore() {
      window.matchMedia = original;
    },
  };
}

@Component({
  standalone: true,
  imports: [AuiProviderDirective, AuiThreadListSidebarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [auiProvider]="config">
    <aui-thread-list-sidebar>
      <span auiSidebarHeader class="brand">Brand</span>
      <main class="app-main">Main area</main>
    </aui-thread-list-sidebar>
  </div>`,
})
class HostComponent {
  readonly config = createTestRuntime().withThreadList().config;
}

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

let viewport: ReturnType<typeof fakeViewport>;
let mounted: HTMLElement | undefined;

async function mount(width: number) {
  viewport = fakeViewport(width);
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  const root = fixture.nativeElement as HTMLElement;
  document.body.append(root);
  mounted = root;
  fixture.detectChanges();
  await settle(fixture);
  const q = (selector: string) => root.querySelector<HTMLElement>(selector);
  return {
    fixture,
    root,
    sidebar: () => q('.aui-sidebar')!,
    toggle: () => q('[data-slot="aui_sidebar-toggle"]')!,
    backdrop: () => q('.aui-sidebar-backdrop'),
    host: () => q('aui-thread-list-sidebar')!,
    settle: () => settle(fixture),
  };
}

beforeEach(() => useFlexAuthorClass());

afterEach(() => {
  mounted?.remove();
  mounted = undefined;
  TestBed.resetTestingModule();
  viewport.restore();
});

describe('aui-thread-list-sidebar', () => {
  it('shows the thread list beside the projected main area on wide screens', async () => {
    const t = await mount(1200);
    expect(t.root.querySelector('.app-main')?.textContent).toBe('Main area');
    expect(t.root.querySelector('.aui-sidebar .brand')).not.toBeNull();
    expect(t.sidebar().querySelector('aui-thread-list')).not.toBeNull();
    expect(t.host().hasAttribute('data-mobile')).toBe(false);
    expect(displayOf(t.sidebar())).not.toBe('none');
    // The drawer toggle is only for narrow screens.
    t.toggle().classList.add('flex');
    expect(displayOf(t.toggle())).toBe('none');
  });

  it('the drawer toggles below 768px', async () => {
    const t = await mount(500);
    t.sidebar().classList.add('flex');
    expect(t.host().hasAttribute('data-mobile')).toBe(true);
    expect(displayOf(t.sidebar())).toBe('none');
    expect(t.toggle().getAttribute('aria-expanded')).toBe('false');
    expect(t.toggle().getAttribute('aria-controls')).toBe(t.sidebar().id);
    expect(t.toggle().getAttribute('aria-label')).toBe('Open sidebar');

    t.toggle().click();
    await t.settle();
    expect(displayOf(t.sidebar())).not.toBe('none');
    expect(t.toggle().getAttribute('aria-expanded')).toBe('true');
    expect(t.host().hasAttribute('data-open')).toBe(true);
    expect(t.backdrop()).not.toBeNull();
    expect(t.sidebar().contains(document.activeElement)).toBe(true);

    t.backdrop()!.click();
    await t.settle();
    expect(displayOf(t.sidebar())).toBe('none');
    expect(t.backdrop()).toBeNull();
    expect(document.activeElement).toBe(t.toggle());

    t.toggle().click();
    await t.settle();
    t.sidebar().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await t.settle();
    expect(displayOf(t.sidebar())).toBe('none');
  });

  it('follows the viewport across the breakpoint and stops listening on destroy', async () => {
    const t = await mount(1200);
    viewport.resize(767);
    await t.settle();
    t.sidebar().classList.add('flex');
    expect(displayOf(t.sidebar())).toBe('none');
    viewport.resize(768);
    await t.settle();
    expect(displayOf(t.sidebar())).not.toBe('none');
    expect(viewport.listenerCount()).toBeGreaterThan(0);
    t.fixture.destroy();
    expect(viewport.listenerCount()).toBe(0);
  });

  it('closes the drawer when a thread is chosen', async () => {
    const t = await mount(500);
    t.toggle().click();
    await t.settle();
    t.root.querySelector<HTMLElement>('[data-slot="aui_thread-list-new"]')!.click();
    await t.settle();
    t.sidebar().classList.add('flex');
    expect(displayOf(t.sidebar())).toBe('none');
  });
});
