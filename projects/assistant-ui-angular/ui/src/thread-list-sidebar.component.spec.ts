// Ported from packages/ui/src/components/react/assistant-ui/elements/threadlist-sidebar.aui.tsx @ 7d74276
// No upstream test exists; this covers shadcn's Sidebar behaviour that the element relies on
// (a collapsible column that becomes an off-canvas sheet below 768px, toggled with Ctrl/Cmd+B).
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { AuiProviderDirective } from 'angular-assistant-ui';
import { afterEach, beforeEach, describe, expect, it, onTestFinished } from 'vitest';
import { stubLayout } from './test-helpers';
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

@Component({
  standalone: true,
  imports: [AuiProviderDirective, AuiThreadListSidebarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [auiProvider]="config">
    <aui-thread-list-sidebar collapsible="none"><main>Main area</main></aui-thread-list-sidebar>
  </div>`,
})
class FixedHostComponent {
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

async function mount(width: number, host: typeof HostComponent = HostComponent) {
  viewport = fakeViewport(width);
  configureTestBed({ imports: [host] });
  const fixture = TestBed.createComponent(host);
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
    expect(t.sidebar().hidden).toBe(false);
    expect(t.toggle().getAttribute('aria-expanded')).toBe('true');
    expect(t.toggle().getAttribute('aria-label')).toBe('Close sidebar');
  });

  it('collapses and expands on wide screens from the toggle, the rail and Ctrl/Cmd+B', async () => {
    const t = await mount(1200);
    t.sidebar().classList.add('flex');
    t.toggle().click();
    await t.settle();
    expect(t.sidebar().hidden).toBe(true);
    expect(displayOf(t.sidebar())).toBe('none');
    expect(t.host().hasAttribute('data-collapsed')).toBe(true);
    expect(t.toggle().getAttribute('aria-expanded')).toBe('false');
    expect(t.toggle().getAttribute('aria-label')).toBe('Open sidebar');
    // No drawer chrome on wide screens.
    expect(t.backdrop()).toBeNull();

    t.toggle().click();
    await t.settle();
    expect(t.sidebar().hidden).toBe(false);
    expect(t.host().hasAttribute('data-collapsed')).toBe(false);

    const rail = t.root.querySelector<HTMLButtonElement>('[data-slot="aui_sidebar-rail"]')!;
    expect(rail.getAttribute('aria-label')).toBe('Toggle Sidebar');
    rail.click();
    await t.settle();
    expect(t.sidebar().hidden).toBe(true);

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true, cancelable: true }),
    );
    await t.settle();
    expect(t.sidebar().hidden).toBe(false);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'b', metaKey: true, bubbles: true, cancelable: true }),
    );
    await t.settle();
    expect(t.sidebar().hidden).toBe(true);
  });

  it('collapsible="none" keeps the wide-screen sidebar shown, without rail or toggle', async () => {
    const t = await mount(1200, FixedHostComponent);
    t.toggle().classList.add('flex');
    expect(displayOf(t.toggle().parentElement!)).toBe('none');
    expect(t.root.querySelector('[data-slot="aui_sidebar-rail"]')).toBeNull();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true, cancelable: true }),
    );
    await t.settle();
    expect(t.sidebar().hidden).toBe(false);
    expect(t.host().hasAttribute('data-collapsed')).toBe(false);
  });

  it('the drawer toggles below 768px', async () => {
    const t = await mount(500);
    t.sidebar().classList.add('flex');
    expect(t.host().hasAttribute('data-mobile')).toBe(true);
    expect(displayOf(t.sidebar())).toBe('none');
    expect(t.sidebar().hidden).toBe(true);
    expect(t.toggle().getAttribute('aria-expanded')).toBe('false');
    expect(t.toggle().getAttribute('aria-controls')).toBe(t.sidebar().id);
    expect(t.toggle().getAttribute('aria-label')).toBe('Open sidebar');

    t.toggle().click();
    await t.settle();
    expect(displayOf(t.sidebar())).not.toBe('none');
    expect(t.sidebar().hidden).toBe(false);
    expect(t.toggle().getAttribute('aria-expanded')).toBe('true');
    expect(t.host().hasAttribute('data-open')).toBe(true);
    expect(t.backdrop()).not.toBeNull();
    expect(t.sidebar().contains(document.activeElement)).toBe(true);

    t.backdrop()!.click();
    await t.settle();
    expect(displayOf(t.sidebar())).toBe('none');
    expect(t.sidebar().hidden).toBe(true);
    expect(t.backdrop()).toBeNull();
    expect(document.activeElement).toBe(t.toggle());

    t.toggle().click();
    await t.settle();
    t.root.querySelector<HTMLButtonElement>('[data-slot="aui_sidebar-close"]')!.click();
    await t.settle();
    expect(t.sidebar().hidden).toBe(true);
    expect(document.activeElement).toBe(t.toggle());
  });

  it('the open drawer is modal: Tab stays inside, the main area is inert, Escape closes', async () => {
    const restoreLayout = stubLayout();
    onTestFinished(restoreLayout);
    const t = await mount(500);
    const main = t.root.querySelector<HTMLElement>('.aui-sidebar-main')!;
    expect(main.hasAttribute('inert')).toBe(false);
    t.toggle().click();
    await t.settle();
    expect(main.hasAttribute('inert')).toBe(true);
    expect(t.sidebar().getAttribute('aria-modal')).toBe('true');

    const anchors = Array.from(t.root.querySelectorAll<HTMLElement>('.cdk-focus-trap-anchor'));
    expect(anchors).toHaveLength(2);
    // Tab past the last control wraps to the first; Shift+Tab before the first wraps to the last.
    anchors[1]!.focus();
    expect(t.sidebar().contains(document.activeElement)).toBe(true);
    anchors[0]!.focus();
    expect(t.sidebar().contains(document.activeElement)).toBe(true);

    // Escape works wherever focus ended up.
    (document.activeElement as HTMLElement).blur();
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    await t.settle();
    expect(t.sidebar().hidden).toBe(true);
    expect(main.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(t.toggle());
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
