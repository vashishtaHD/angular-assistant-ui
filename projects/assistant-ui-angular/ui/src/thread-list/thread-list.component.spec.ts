// Ported from packages/ui/src/components/vue/assistant-ui/thread-list.test.ts and
// packages/ui/src/components/react/assistant-ui/elements/thread-list.aui.test.tsx @ 7d74276
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { RemoteThreadListAdapter, RemoteThreadMetadata } from '@assistant-ui/core';
import { AuiProviderDirective } from 'angular-assistant-ui';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { configureTestBed } from '../../../src/testing-internal/test-bed';
import { createTestRuntime } from '../../../src/testing-internal/test-runtime';
import { overlayRoot } from '../test-helpers';
import { AuiThreadListComponent } from './thread-list.component';
import { groupThreadList } from './thread-list-groups';

type Fixture = Partial<RemoteThreadMetadata> & { remoteId: string };

const makeAdapter = (
  threads: readonly Fixture[],
  overrides: Partial<RemoteThreadListAdapter> = {},
): RemoteThreadListAdapter => ({
  list: vi.fn(async () => ({
    threads: threads.map((thread): RemoteThreadMetadata => ({ status: 'regular', ...thread })),
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
  ...overrides,
});

let config: ReturnType<ReturnType<typeof createTestRuntime>['withThreadList']>['config'];

@Component({
  standalone: true,
  imports: [AuiProviderDirective, AuiThreadListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [auiProvider]="config">
    <aui-thread-list (threadSelect)="selected = selected + 1" />
  </div>`,
})
class HostComponent {
  readonly config = config;
  selected = 0;
}

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 4; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

let mounted: HTMLElement | undefined;

async function mount(adapter: RemoteThreadListAdapter) {
  config = createTestRuntime().withThreadList(adapter).config;
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  const root = fixture.nativeElement as HTMLElement;
  document.body.append(root);
  mounted = root;
  fixture.detectChanges();
  await settle(fixture);
  const slots = (name: string) =>
    Array.from(root.querySelectorAll<HTMLElement>(`[data-slot="aui_thread-list-${name}"]`));
  return {
    fixture,
    root,
    slots,
    titles: () => slots('item-title').map((el) => el.textContent?.trim()),
    settle: () => settle(fixture),
    search: async (value: string) => {
      const input = root.querySelector<HTMLInputElement>('input[type="search"]')!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await settle(fixture);
    },
  };
}

const freezeClockAtMidday = () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 7, 31, 12, 0, 0));
  return new Date(2026, 7, 31).getTime();
};

const DAY = 24 * 60 * 60 * 1000;

afterEach(() => {
  vi.useRealTimers();
  mounted?.remove();
  mounted = undefined;
  TestBed.resetTestingModule();
});

describe('aui-thread-list', () => {
  it('renders the new button and one item per thread, with the New Chat fallback', async () => {
    const t = await mount(
      makeAdapter([
        { remoteId: 'a', title: 'Alpha' },
        { remoteId: 'b', title: '' },
      ]),
    );
    expect(t.slots('new')[0]?.textContent?.trim()).toBe('New Thread');
    expect(t.titles()).toEqual(['Alpha', 'New Chat']);
    expect(t.root.querySelector('input[type="search"]')?.getAttribute('aria-label')).toBe(
      'Search threads',
    );
  });

  it('search filters titles case-insensitively', async () => {
    const t = await mount(
      makeAdapter([
        { remoteId: 'a', title: 'Alpha Plan' },
        { remoteId: 'b', title: 'beta' },
        { remoteId: 'c', title: 'ALPHABET soup' },
      ]),
    );
    await t.search('alpha');
    expect(t.titles()).toEqual(['Alpha Plan', 'ALPHABET soup']);
    await t.search('  BETA ');
    expect(t.titles()).toEqual(['beta']);
    await t.search('zzz');
    expect(t.titles()).toEqual([]);
    expect(t.slots('empty')[0]?.textContent?.trim()).toBe('No threads found');
    await t.search('');
    expect(t.titles()).toHaveLength(3);
  });

  it('groups by last activity: a thread from 3 days ago sits under "Previous 7 days"', async () => {
    const today = freezeClockAtMidday();
    const t = await mount(
      makeAdapter([
        { remoteId: 'old', title: 'Old', lastMessageAt: new Date(today - 90 * DAY) },
        { remoteId: 'three', title: 'Three days', lastMessageAt: new Date(today - 3 * DAY) },
        { remoteId: 'now', title: 'Now', lastMessageAt: new Date(today + 60_000) },
        { remoteId: 'month', title: 'Month', lastMessageAt: new Date(today - 20 * DAY) },
        { remoteId: 'yday', title: 'Yesterday one', lastMessageAt: new Date(today - 3_600_000) },
      ]),
    );
    const groups = t.slots('group').map((group) => ({
      label: group.querySelector('[data-slot="aui_thread-list-group-label"]')?.textContent?.trim(),
      titles: Array.from(group.querySelectorAll('[data-slot="aui_thread-list-item-title"]'), (el) =>
        el.textContent?.trim(),
      ),
    }));
    expect(groups).toEqual([
      { label: 'Today', titles: ['Now'] },
      { label: 'Yesterday', titles: ['Yesterday one'] },
      { label: 'Previous 7 days', titles: ['Three days'] },
      { label: 'Previous 30 days', titles: ['Month'] },
      { label: 'Older', titles: ['Old'] },
    ]);
  });

  it('keeps the runtime order without group labels when no thread has a date', async () => {
    const t = await mount(
      makeAdapter([
        { remoteId: 'a', title: 'A' },
        { remoteId: 'b', title: 'B' },
      ]),
    );
    expect(t.slots('group-label')).toHaveLength(0);
    expect(t.titles()).toEqual(['A', 'B']);
  });

  it('rename via the more-menu calls rename with the trimmed title', async () => {
    const adapter = makeAdapter([{ remoteId: 'a', title: 'Alpha' }]);
    const t = await mount(adapter);
    t.slots('item-more')[0]!.click();
    await t.settle();
    const items = Array.from(overlayRoot().querySelectorAll<HTMLElement>('[role="menuitem"]'));
    expect(items.map((el) => el.textContent?.trim())).toEqual(['Rename', 'Archive', 'Delete']);
    items[0]!.click();
    await t.settle();
    const input = t.slots('item-rename')[0] as HTMLInputElement;
    expect(input.value).toBe('Alpha');
    expect(document.activeElement).toBe(input);
    input.value = '  Renamed  ';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await t.settle();
    expect(adapter.rename).toHaveBeenCalledWith('a', 'Renamed');
    expect(t.slots('item-rename')).toHaveLength(0);
    expect(t.titles()).toEqual(['Renamed']);
    expect(document.activeElement).toBe(t.slots('item-trigger')[0]);
  });

  it.each([
    ['ltr', 'ArrowRight', 'ArrowLeft'],
    ['rtl', 'ArrowLeft', 'ArrowRight'],
  ] as const)(
    'keyboard (%s): the forward arrow goes from the item to More and opens its menu, the back arrow returns',
    async (direction, forward, back) => {
      const original = window.getComputedStyle;
      window.getComputedStyle = ((el: Element, pseudo?: string | null) => {
        const style = original.call(window, el, pseudo);
        return new Proxy(style, {
          get: (target, prop) =>
            prop === 'direction' ? direction : Reflect.get(target, prop, target),
        });
      }) as typeof window.getComputedStyle;
      onTestFinished(() => {
        window.getComputedStyle = original;
      });
      const t = await mount(makeAdapter([{ remoteId: 'a', title: 'Alpha' }]));
      const press = async (key: string) => {
        document.activeElement!.dispatchEvent(
          new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
        );
        await t.settle();
      };
      const trigger = t.slots('item-trigger')[0]!;
      const more = t.slots('item-more')[0]!;
      trigger.focus();

      await press(forward);
      expect(document.activeElement).toBe(more);
      expect(more.getAttribute('aria-expanded')).toBe('false');

      await press(forward);
      expect(more.getAttribute('aria-expanded')).toBe('true');
      const first = overlayRoot().querySelector<HTMLElement>('[role="menuitem"]')!;
      expect(document.activeElement).toBe(first);
      expect(first.textContent?.trim()).toBe('Rename');

      await press(back);
      expect(more.getAttribute('aria-expanded')).toBe('false');
      expect(overlayRoot().querySelector('[role="menuitem"]')).toBeNull();
      expect(document.activeElement).toBe(more);

      await press(back);
      expect(document.activeElement).toBe(trigger);
    },
  );

  it('Escape cancels a rename without calling rename', async () => {
    const adapter = makeAdapter([{ remoteId: 'a', title: 'Alpha' }]);
    const t = await mount(adapter);
    t.slots('item-more')[0]!.click();
    await t.settle();
    overlayRoot().querySelector<HTMLElement>('[role="menuitem"]')!.click();
    await t.settle();
    const input = t.slots('item-rename')[0] as HTMLInputElement;
    input.value = 'Other';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await t.settle();
    expect(adapter.rename).not.toHaveBeenCalled();
    expect(t.titles()).toEqual(['Alpha']);
  });

  it('archive and delete from the more-menu call the adapter', async () => {
    const adapter = makeAdapter([
      { remoteId: 'a', title: 'Alpha' },
      { remoteId: 'b', title: 'Beta' },
    ]);
    const t = await mount(adapter);
    t.slots('item-more')[0]!.click();
    await t.settle();
    overlayRoot().querySelectorAll<HTMLElement>('[role="menuitem"]')[1]!.click();
    await t.settle();
    expect(adapter.archive).toHaveBeenCalledWith('a');
    expect(t.titles()).toEqual(['Beta']);
    t.slots('item-more')[0]!.click();
    await t.settle();
    overlayRoot().querySelectorAll<HTMLElement>('[role="menuitem"]')[2]!.click();
    await t.settle();
    expect(adapter.delete).toHaveBeenCalledWith('b');
  });

  it('the archived toggle shows the archived threads', async () => {
    const adapter = makeAdapter([
      { remoteId: 'a', title: 'Alpha' },
      { remoteId: 'x', title: 'Old one', status: 'archived' },
    ]);
    const t = await mount(adapter);
    const toggle = t.slots('archived-toggle')[0]!;
    expect(toggle.textContent?.trim()).toContain('Archived');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(t.titles()).toEqual(['Alpha']);
    toggle.click();
    await t.settle();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const archived = t.slots('archived')[0]!;
    expect(
      Array.from(archived.querySelectorAll('[data-slot="aui_thread-list-item-title"]'), (el) =>
        el.textContent?.trim(),
      ),
    ).toEqual(['Old one']);
    expect(
      archived.querySelector('[data-slot="aui_thread-list-item"]')?.getAttribute('data-archived'),
    ).toBe('true');
    // The archived item's menu offers Unarchive instead of Archive.
    archived.querySelector<HTMLElement>('[data-slot="aui_thread-list-item-more"]')!.click();
    await t.settle();
    const labels = Array.from(overlayRoot().querySelectorAll('[role="menuitem"]'), (el) =>
      el.textContent?.trim(),
    );
    expect(labels).toEqual(['Rename', 'Unarchive', 'Delete']);
    overlayRoot().querySelectorAll<HTMLElement>('[role="menuitem"]')[1]!.click();
    await t.settle();
    expect(adapter.unarchive).toHaveBeenCalledWith('x');
    toggle.click();
    await t.settle();
    expect(t.slots('archived')).toHaveLength(0);
  });

  it('shows skeletons while the thread list loads', async () => {
    let resolve!: (value: { threads: RemoteThreadMetadata[] }) => void;
    const t = await mount(
      makeAdapter([], {
        list: vi.fn(() => new Promise<{ threads: RemoteThreadMetadata[] }>((r) => (resolve = r))),
      }),
    );
    const status = t.root.querySelector('[role="status"][aria-label="Loading threads"]');
    expect(status).not.toBeNull();
    expect(t.slots('skeleton')).toHaveLength(5);
    resolve({ threads: [{ status: 'regular', remoteId: 'a', title: 'Alpha' }] });
    await t.settle();
    expect(t.slots('skeleton')).toHaveLength(0);
    expect(t.titles()).toEqual(['Alpha']);
  });

  it('load more fetches the next page', async () => {
    const list = vi.fn(async (params?: { after?: string }) =>
      params?.after
        ? { threads: [{ status: 'regular' as const, remoteId: 'b', title: 'Beta' }] }
        : {
            threads: [{ status: 'regular' as const, remoteId: 'a', title: 'Alpha' }],
            nextCursor: 'page-2',
          },
    );
    const t = await mount(makeAdapter([], { list }));
    const more = t.slots('load-more')[0] as HTMLButtonElement;
    expect(more.textContent?.trim()).toBe('Load more');
    more.click();
    await t.settle();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ after: 'page-2' }));
    expect(t.titles()).toEqual(['Alpha', 'Beta']);
    expect(t.slots('load-more')).toHaveLength(0);
  });

  it('emits threadSelect when an item is chosen', async () => {
    const t = await mount(makeAdapter([{ remoteId: 'a', title: 'Alpha' }]));
    t.slots('item-trigger')[0]!.click();
    await t.settle();
    expect(t.fixture.componentInstance.selected).toBe(1);
  });
});

describe('groupThreadList', () => {
  const item = (id: string, title: string | undefined, lastMessageAt?: Date) => ({
    id,
    remoteId: id,
    externalId: undefined,
    title,
    lastMessageAt,
    status: 'regular' as const,
    isRunning: false,
  });

  it('returns null groups when the day start is unknown', () => {
    const result = groupThreadList(['a'], [item('a', 'A', new Date())], '', undefined);
    expect(result.groups).toBeNull();
    expect(result.filteredIndices).toEqual([0]);
  });

  it('matches untitled threads by their fallback title', () => {
    const result = groupThreadList(['a', 'b'], [item('a', 'Alpha'), item('b', '')], 'new', 0);
    expect(result.filteredIndices).toEqual([1]);
  });

  it('places dates on the day boundaries in the later bucket', () => {
    const start = new Date(2026, 7, 31).getTime();
    const yesterday = new Date(2026, 7, 30).getTime();
    const week = new Date(2026, 7, 24).getTime();
    const month = new Date(2026, 7, 1).getTime();
    const result = groupThreadList(
      ['t', 'y', 'w', 'm', 'o'],
      [
        item('t', 'T', new Date(start)),
        item('y', 'Y', new Date(yesterday)),
        item('w', 'W', new Date(week)),
        item('m', 'M', new Date(month)),
        item('o', 'O', new Date(month - 1)),
      ],
      '',
      start,
    );
    expect(result.groups?.map((group) => group.label)).toEqual([
      'Today',
      'Yesterday',
      'Previous 7 days',
      'Previous 30 days',
      'Older',
    ]);
  });
});
