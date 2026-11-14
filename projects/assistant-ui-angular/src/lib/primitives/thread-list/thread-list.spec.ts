// Mirrors packages/vue/src/primitives/ThreadListKeyboardNav.test.ts and threadListStructural.unarchive.test.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type {
  RemoteThreadListAdapter,
  RemoteThreadListResponse,
  RemoteThreadMetadata,
} from '@assistant-ui/core';
import { InMemoryThreadListAdapter } from '@assistant-ui/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../../testing-internal/test-bed';
import { createTestRuntime } from '../../../testing-internal/test-runtime';
import { injectAuiState } from '../../state/inject-aui-state';
import { AuiProviderDirective } from '../../provider/aui-provider.directive';
import {
  AuiThreadListItemArchiveDirective,
  AuiThreadListItemDeleteDirective,
  AuiThreadListItemUnarchiveDirective,
} from './thread-list-item-actions.directive';
import { AuiThreadListItemRootDirective } from './thread-list-item-root.directive';
import { AuiThreadListItemTitleComponent } from './thread-list-item-title.component';
import { AuiThreadListItemTriggerDirective } from './thread-list-item-trigger.directive';
import {
  AuiThreadListItemTemplateDirective,
  AuiThreadListItemsComponent,
} from './thread-list-items.component';
import { AuiThreadListLoadMoreDirective } from './thread-list-load-more.directive';
import { AuiThreadListNewDirective } from './thread-list-new.directive';
import { AuiThreadListRootDirective } from './thread-list-root.directive';

type Meta = RemoteThreadMetadata;

const regular = (id: string, title = id): Meta => ({
  status: 'regular',
  remoteId: id,
  title,
});

/**
 * A stateful in-memory backend: `pages` are served one per `list()` call
 * (cursor = page index), and archive/unarchive/delete mutate the stored rows.
 */
function makeAdapter(
  pages: Meta[][],
  options: { unarchive?: boolean } = {},
): RemoteThreadListAdapter {
  const base = new InMemoryThreadListAdapter();
  const rows = new Map<string, Meta>();
  const withStatus = (id: string, status: Meta['status']) => {
    const row = rows.get(id);
    if (row) rows.set(id, { ...row, status });
  };
  const adapter: RemoteThreadListAdapter = Object.assign(Object.create(base), {
    list: async (params?: { after?: string }): Promise<RemoteThreadListResponse> => {
      const page = params?.after ? Number(params.after) : 0;
      for (const row of pages[page] ?? []) rows.set(row.remoteId, row);
      const ids = new Set((pages[page] ?? []).map((row) => row.remoteId));
      const threads = [...rows.values()].filter((row) => ids.has(row.remoteId));
      return page + 1 < pages.length ? { threads, nextCursor: String(page + 1) } : { threads };
    },
    archive: async (id: string) => withStatus(id, 'archived'),
    delete: async (id: string) => void rows.delete(id),
  });
  if (options.unarchive !== false) {
    adapter.unarchive = async (id: string) => withStatus(id, 'regular');
  } else {
    Object.defineProperty(adapter, 'unarchive', { value: undefined });
  }
  return adapter;
}

@Component({
  selector: 'aui-test-row',
  standalone: true,
  imports: [
    AuiThreadListItemRootDirective,
    AuiThreadListItemTriggerDirective,
    AuiThreadListItemTitleComponent,
    AuiThreadListItemArchiveDirective,
    AuiThreadListItemUnarchiveDirective,
    AuiThreadListItemDeleteDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div auiThreadListItemRoot class="item" tabindex="-1" (keydown)="onKey($event)">
      <button auiThreadListItemTrigger class="trigger" [disabled]="off()">
        <aui-thread-list-item-title fallback="Untitled" />
      </button>
      <button auiThreadListItemArchive class="archive">a</button>
      <button auiThreadListItemUnarchive class="unarchive">u</button>
      <button auiThreadListItemDelete class="delete">d</button>
    </div>
  `,
})
class RowComponent {
  private readonly id = injectAuiState((s) => s.threadListItem.id);
  protected readonly off = () => disabledIds().has(this.id());
  protected onKey(event: KeyboardEvent): void {
    if (vetoKeys()) event.preventDefault();
  }
}

const disabledIds = signal<ReadonlySet<string>>(new Set());
const vetoKeys = signal(false);

let current: {
  config: ReturnType<ReturnType<typeof createTestRuntime>['withThreadList']>['config'];
};

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadListRootDirective,
    AuiThreadListNewDirective,
    AuiThreadListLoadMoreDirective,
    AuiThreadListItemsComponent,
    AuiThreadListItemTemplateDirective,
    RowComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <div auiThreadListRoot class="list">
        <button auiThreadListNew class="new">New</button>
        <aui-thread-list-items>
          <ng-template auiThreadListItem><aui-test-row /></ng-template>
        </aui-thread-list-items>
      </div>
      <div class="archived-list">
        <aui-thread-list-items archived>
          <ng-template auiThreadListItem><aui-test-row /></ng-template>
        </aui-thread-list-items>
      </div>
      <button auiThreadListLoadMore class="more">More</button>
    </ng-container>
  `,
})
class HostComponent {
  readonly config = current.config;
}

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 4; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

const mount = async (adapter: RemoteThreadListAdapter) => {
  const list = createTestRuntime().withThreadList(adapter);
  current = list;
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  await settle(fixture);
  const host = fixture.nativeElement as HTMLElement;
  const q = (selector: string) => host.querySelector<HTMLElement>(selector)!;
  const all = (selector: string) => Array.from(host.querySelectorAll<HTMLElement>(selector));
  return {
    fixture,
    host,
    q,
    all,
    regularTriggers: () => all('.list .trigger') as HTMLButtonElement[],
    archivedTriggers: () => all('.archived-list .trigger') as HTMLButtonElement[],
    click: async (el: Element) => {
      (el as HTMLElement).click();
      await settle(fixture);
    },
    titles: (selector: string) => all(selector).map((el) => el.textContent?.trim()),
  };
};

const keydown = (el: HTMLElement, key: string, init: KeyboardEventInit = {}) =>
  el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, ...init }));

afterEach(() => {
  disabledIds.set(new Set());
  vetoKeys.set(false);
  TestBed.resetTestingModule();
  vi.restoreAllMocks();
});

describe('thread list primitives', () => {
  it('renders one scoped row per thread with title and fallback', async () => {
    const t = await mount(makeAdapter([[regular('a', 'Alpha'), regular('b', '')]]));
    expect(t.titles('.list .trigger')).toEqual(['Alpha', 'Untitled']);
    expect(t.archivedTriggers()).toHaveLength(0);
  });

  it('New switches to the new thread and moves data-active to it', async () => {
    const t = await mount(makeAdapter([[regular('a'), regular('b')]]));
    await t.click(t.regularTriggers()[1]!);
    expect(t.q('.new').hasAttribute('data-active')).toBe(false);
    await t.click(t.q('.new'));
    expect(t.q('.new').getAttribute('data-active')).toBe('true');
    expect(t.q('.new').getAttribute('aria-current')).toBe('true');
    expect(t.all('.list .item').some((el) => el.hasAttribute('data-active'))).toBe(false);
  });

  it('Trigger switches the thread and data-active moves between item roots', async () => {
    const t = await mount(makeAdapter([[regular('a'), regular('b')]]));
    const items = () => t.all('.list .item');
    await t.click(t.regularTriggers()[0]!);
    expect(items()[0]!.getAttribute('data-active')).toBe('true');
    expect(items()[0]!.getAttribute('aria-current')).toBe('true');
    await t.click(t.regularTriggers()[1]!);
    expect(items()[1]!.getAttribute('data-active')).toBe('true');
    expect(items()[0]!.hasAttribute('data-active')).toBe(false);
    expect(items()[0]!.hasAttribute('aria-current')).toBe(false);
    expect(t.regularTriggers()[1]!.getAttribute('data-active')).toBe('true');
  });

  it('Archive moves the item to the archived list', async () => {
    const t = await mount(makeAdapter([[regular('a', 'Alpha'), regular('b', 'Beta')]]));
    await t.click(t.all('.list .archive')[0]!);
    expect(t.titles('.list .trigger')).toEqual(['Beta']);
    expect(t.titles('.archived-list .trigger')).toEqual(['Alpha']);
    expect(t.all('.archived-list .item')[0]!.getAttribute('data-archived')).toBe('true');
    expect(t.all('.list .item')[0]!.hasAttribute('data-archived')).toBe(false);
  });

  it('Unarchive moves the item back', async () => {
    const t = await mount(makeAdapter([[regular('a', 'Alpha'), regular('b', 'Beta')]]));
    await t.click(t.all('.list .archive')[0]!);
    await t.click(t.all('.archived-list .unarchive')[0]!);
    expect(t.titles('.archived-list .trigger')).toEqual([]);
    expect(t.titles('.list .trigger').sort()).toEqual(['Alpha', 'Beta']);
  });

  it('Unarchive stays disabled when the adapter cannot unarchive, even with disabled=false', async () => {
    const t = await mount(
      makeAdapter([[{ status: 'archived', remoteId: 'x', title: 'Old' }]], { unarchive: false }),
    );
    const button = t.all('.archived-list .unarchive')[0] as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.hasAttribute('data-disabled')).toBe(true);
    await t.click(button);
    expect(t.titles('.archived-list .trigger')).toEqual(['Old']);
  });

  it('Delete removes the item', async () => {
    const t = await mount(makeAdapter([[regular('a', 'Alpha'), regular('b', 'Beta')]]));
    await t.click(t.all('.list .delete')[0]!);
    expect(t.titles('.list .trigger')).toEqual(['Beta']);
  });

  it('Load more appends the next page and is disabled once nothing is left', async () => {
    const t = await mount(makeAdapter([[regular('a', 'Alpha')], [regular('b', 'Beta')]]));
    const more = t.q('.more') as HTMLButtonElement;
    expect(more.disabled).toBe(false);
    await t.click(more);
    expect(t.titles('.list .trigger')).toEqual(['Alpha', 'Beta']);
    expect(more.disabled).toBe(true);
  });

  it('Load more is disabled from the start when there is no further page', async () => {
    const t = await mount(makeAdapter([[regular('a')]]));
    expect((t.q('.more') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('thread list keyboard navigation', () => {
  const three = () => makeAdapter([[regular('a'), regular('b'), regular('c')]]);

  it('moves through triggers with ArrowUp/ArrowDown without wrapping', async () => {
    const t = await mount(three());
    const [first, second, third] = t.regularTriggers();
    first!.focus();
    expect(keydown(first!, 'ArrowDown')).toBe(false);
    expect(document.activeElement).toBe(second);
    expect(keydown(second!, 'ArrowDown')).toBe(false);
    expect(document.activeElement).toBe(third);
    expect(keydown(third!, 'ArrowDown')).toBe(true);
    expect(document.activeElement).toBe(third);
    expect(keydown(third!, 'ArrowUp')).toBe(false);
    expect(document.activeElement).toBe(second);
    first!.focus();
    expect(keydown(first!, 'ArrowUp')).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it('Home and End jump to the first and last trigger', async () => {
    const t = await mount(three());
    const [first, second, third] = t.regularTriggers();
    second!.focus();
    expect(keydown(second!, 'End')).toBe(false);
    expect(document.activeElement).toBe(third);
    expect(keydown(third!, 'Home')).toBe(false);
    expect(document.activeElement).toBe(first);
  });

  it('follows document order, not registration order', async () => {
    const t = await mount(three());
    const [first, , third] = t.regularTriggers();
    const items = t.all('.list .item');
    items[0]!.parentElement!.insertBefore(items[2]!, items[0]!);
    third!.focus();
    keydown(third!, 'ArrowDown');
    expect(document.activeElement).toBe(first);
  });

  it('skips disabled triggers in both directions', async () => {
    const t = await mount(three());
    const [first, second, third] = t.regularTriggers();
    second!.disabled = true;
    first!.focus();
    keydown(first!, 'ArrowDown');
    expect(document.activeElement).toBe(third);
    keydown(third!, 'ArrowUp');
    expect(document.activeElement).toBe(first);
  });

  it('keeps one tab stop that follows focus (roving tabindex)', async () => {
    const t = await mount(three());
    const tabindexes = () => t.regularTriggers().map((el) => el.getAttribute('tabindex'));
    expect(tabindexes()).toEqual(['0', '-1', '-1']);
    t.regularTriggers()[1]!.focus();
    await settle(t.fixture);
    expect(tabindexes()).toEqual(['-1', '0', '-1']);
  });

  it('lets a caller veto navigation by default-preventing the key', async () => {
    const t = await mount(three());
    const [first] = t.regularTriggers();
    t.q('.list').addEventListener('keydown', (event) => event.preventDefault(), { capture: true });
    first!.focus();
    expect(keydown(first!, 'ArrowDown')).toBe(false);
    expect(document.activeElement).toBe(first);
  });

  it('lets a keydown handler on the item root itself veto navigation', async () => {
    const t = await mount(three());
    const [first] = t.regularTriggers();
    vetoKeys.set(true);
    first!.focus();
    expect(keydown(first!, 'ArrowDown')).toBe(false);
    expect(document.activeElement).toBe(first);
    vetoKeys.set(false);
    keydown(first!, 'ArrowDown');
    expect(document.activeElement).toBe(t.regularTriggers()[1]);
  });

  it('moves the tab stop when the current one is disabled, and back when re-enabled', async () => {
    const t = await mount(three());
    const tabindexes = () => t.regularTriggers().map((el) => el.getAttribute('tabindex'));
    expect(tabindexes()).toEqual(['0', '-1', '-1']);
    disabledIds.set(new Set(['a']));
    await settle(t.fixture);
    expect(tabindexes()).toEqual(['-1', '0', '-1']);
    disabledIds.set(new Set());
    await settle(t.fixture);
    expect(tabindexes()).toEqual(['0', '-1', '-1']);
  });

  it.each(['altKey', 'ctrlKey', 'metaKey', 'shiftKey'] as const)(
    'leaves %s + ArrowDown to ancestor shortcuts',
    async (modifier) => {
      const t = await mount(three());
      const [first] = t.regularTriggers();
      first!.focus();
      expect(keydown(first!, 'ArrowDown', { [modifier]: true })).toBe(true);
      expect(document.activeElement).toBe(first);
    },
  );

  it('forgets a trigger whose item is removed', async () => {
    const t = await mount(three());
    await t.click(t.all('.list .delete')[1]!);
    const [first, third] = t.regularTriggers();
    first!.focus();
    keydown(first!, 'ArrowDown');
    expect(document.activeElement).toBe(third);
  });
});
