// Ported from packages/react/src/primitives/composer/trigger/{TriggerPopoverBehavior,TriggerPopoverRootContext,detectTrigger}.test.* @ 7d74276
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../../testing-internal/test-bed';
import { createTestRuntime } from '../../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../../provider/aui-provider.directive';
import { injectAui } from '../../state/inject-aui';
import { AuiComposerInputDirective } from '../composer-input.directive';
import { AuiComposerRootDirective } from '../composer-root.directive';
import { injectLiveCompletionAdapter } from './inject-live-completion-adapter';
import { injectMentionAdapter } from './inject-mention-adapter';
import { injectSlashCommandAdapter } from './inject-slash-command-adapter';
import { detectTrigger, matchesTriggerItemQuery, type TriggerItem } from './trigger-contracts';
import { AuiComposerTriggerPopoverInputDirective } from './trigger-popover-input.directive';
import {
  AuiComposerTriggerPopoverBackDirective,
  AuiComposerTriggerPopoverCategoriesDirective,
  AuiComposerTriggerPopoverCategoryItemDirective,
  AuiComposerTriggerPopoverItemDirective,
  AuiComposerTriggerPopoverItemsDirective,
} from './trigger-popover-parts.directive';
import {
  AuiComposerTriggerPopoverRootDirective,
  injectTriggerPopoverTriggers,
  injectTriggerPopoverTriggersOptional,
} from './trigger-popover-root.directive';
import { AuiComposerTriggerPopoverDirective } from './trigger-popover.directive';

const PEOPLE: TriggerItem[] = [
  { id: 'mary', type: 'user', label: 'Mary' },
  { id: 'mark', type: 'user', label: 'Mark' },
  { id: 'zed', type: 'user', label: 'Zed', description: 'ops' },
];

@Component({
  selector: 'aui-probe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class ProbeComponent {
  readonly aui = injectAui();
  readonly triggers = injectTriggerPopoverTriggersOptional();
}

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiComposerRootDirective,
    AuiComposerInputDirective,
    AuiComposerTriggerPopoverRootDirective,
    AuiComposerTriggerPopoverDirective,
    AuiComposerTriggerPopoverInputDirective,
    AuiComposerTriggerPopoverCategoriesDirective,
    AuiComposerTriggerPopoverCategoryItemDirective,
    AuiComposerTriggerPopoverItemsDirective,
    AuiComposerTriggerPopoverItemDirective,
    AuiComposerTriggerPopoverBackDirective,
    ProbeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [auiProvider]="config">
      <div auiComposerTriggerPopoverRoot>
        <aui-probe />
        <div
          auiComposerTriggerPopover
          #mention="auiComposerTriggerPopover"
          data-t="mention"
          char="@"
          [items]="people"
          [directive]="{ onInserted: onInserted }"
        >
          @for (item of mention.itemList(); track item.id) {
            <button auiComposerTriggerPopoverItem [item]="item">{{ item.label }}</button>
          }
        </div>
        <div
          auiComposerTriggerPopover
          #cat="auiComposerTriggerPopover"
          data-t="cat"
          char="#"
          [adapter]="catAdapter"
        >
          <div auiComposerTriggerPopoverCategories #cats="auiComposerTriggerPopoverCategories">
            @for (c of cats.categories(); track c.id) {
              <button auiComposerTriggerPopoverCategoryItem [categoryId]="c.id">
                {{ c.label }}
              </button>
            }
          </div>
          <button auiComposerTriggerPopoverBack>back</button>
          <div auiComposerTriggerPopoverItems #catItems="auiComposerTriggerPopoverItems">
            @for (item of catItems.items(); track item.id) {
              <button auiComposerTriggerPopoverItem [item]="item">{{ item.label }}</button>
            }
          </div>
        </div>
        <form auiComposerRoot>
          <textarea auiComposerInput auiComposerTriggerPopoverInput></textarea>
        </form>
      </div>
    </div>
  `,
})
class HostComponent {
  readonly rt = createTestRuntime();
  readonly config = this.rt.config;
  readonly people = PEOPLE;
  readonly inserted: string[] = [];
  readonly onInserted = (item: TriggerItem) => this.inserted.push(item.id);
  readonly catAdapter = {
    categories: () => [
      { id: 'files', label: 'Files' },
      { id: 'docs', label: 'Docs' },
    ],
    categoryItems: (id: string) =>
      id === 'files'
        ? [{ id: 'a.ts', type: 'file', label: 'a.ts' }]
        : [{ id: 'readme', type: 'doc', label: 'README' }],
  };
}

async function setup() {
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  document.body.append(el);
  const { aui, triggers } = fixture.debugElement.query(By.directive(ProbeComponent))
    .componentInstance as ProbeComponent;
  const textarea = el.querySelector('textarea')!;
  const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const type = async (value: string, caret = value.length) => {
    textarea.value = value;
    textarea.setSelectionRange(caret, caret);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  };
  const press = async (key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    textarea.dispatchEvent(event);
    await settle();
    return event;
  };
  return {
    fixture,
    host: fixture.componentInstance,
    aui,
    triggers,
    textarea,
    mention: el.querySelector<HTMLElement>('[data-t=mention]')!,
    cat: el.querySelector<HTMLElement>('[data-t=cat]')!,
    settle,
    type,
    press,
  };
}

describe('detectTrigger', () => {
  it('detects a word-initial trigger and its query', () => {
    expect(detectTrigger('hi @ma', '@', 6)).toEqual({ query: 'ma', offset: 3, endOffset: 6 });
    expect(detectTrigger('@', '@', 1)).toEqual({ query: '', offset: 0, endOffset: 1 });
  });
  it('ignores mid-word triggers, whitespace after the trigger and caret before it', () => {
    expect(detectTrigger('a@b', '@', 3)).toBeNull();
    expect(detectTrigger('@ma rest', '@', 8)).toBeNull();
    expect(detectTrigger('@ma', '@', 0)).toBeNull();
  });
  it('validates custom matchers', () => {
    const matcher = () => ({ query: 'x', offset: 0, endOffset: 99 });
    expect(detectTrigger('@x', '@', 2, matcher)).toBeNull();
    expect(detectTrigger('@x', '@', 2, () => ({ query: 'x', offset: 0, endOffset: 2 }))).toEqual({
      query: 'x',
      offset: 0,
      endOffset: 2,
    });
  });
  it('matches item queries on id, label and description', () => {
    expect(matchesTriggerItemQuery(PEOPLE[2]!, 'ops')).toBe(true);
    expect(matchesTriggerItemQuery(PEOPLE[0]!, 'zzz')).toBe(false);
    expect(matchesTriggerItemQuery(PEOPLE[0]!, '')).toBe(true);
  });
});

describe('composer trigger popover', () => {
  it('is closed until the trigger character is typed', async () => {
    const t = await setup();
    expect(t.mention.hidden).toBe(true);
    expect(t.mention.getAttribute('role')).toBe('listbox');
    await t.type('hello');
    expect(t.mention.hidden).toBe(true);
    expect(t.textarea.getAttribute('aria-expanded')).toBeNull();
  });

  it('typing @ma opens with query ma and filters the items', async () => {
    const t = await setup();
    await t.type('@ma');
    expect(t.mention.hidden).toBe(false);
    const popover = t.fixture.debugElement
      .query(By.css('[data-t=mention]'))
      .injector.get(AuiComposerTriggerPopoverDirective);
    expect(popover.query()).toBe('ma');
    expect(popover.open()).toBe(true);
    const labels = Array.from(t.mention.querySelectorAll('button')).map((b) =>
      b.textContent!.trim(),
    );
    expect(labels).toEqual(['Mary', 'Mark']);
    expect(popover.highlightedIndex()).toBe(0);
  });

  it('wires the editable combobox ARIA onto the textarea and moves the highlight', async () => {
    const t = await setup();
    await t.type('@ma');
    const options = Array.from(t.mention.querySelectorAll<HTMLElement>('[role=option]'));
    expect(t.textarea.getAttribute('aria-expanded')).toBe('true');
    expect(t.textarea.getAttribute('aria-haspopup')).toBe('listbox');
    expect(t.textarea.getAttribute('aria-controls')).toBe(t.mention.id);
    expect(t.textarea.getAttribute('aria-activedescendant')).toBe(options[0]!.id);
    expect(options[0]!.hasAttribute('data-highlighted')).toBe(true);

    expect((await t.press('ArrowDown')).defaultPrevented).toBe(true);
    expect(t.textarea.getAttribute('aria-activedescendant')).toBe(options[1]!.id);
    expect(options[1]!.getAttribute('aria-selected')).toBe('true');
    await t.press('ArrowDown');
    expect(t.textarea.getAttribute('aria-activedescendant')).toBe(options[0]!.id);
    await t.press('ArrowUp');
    expect(t.textarea.getAttribute('aria-activedescendant')).toBe(options[1]!.id);
    expect(t.mention.getAttribute('aria-activedescendant')).toBe(options[1]!.id);
  });

  it('Enter selects, inserts the directive token and does not send', async () => {
    const t = await setup();
    await t.type('hi @ma');
    const event = await t.press('Enter');
    expect(event.defaultPrevented).toBe(true);
    expect(t.aui.composer.getState().text).toBe('hi :user[Mary]{name=mary} ');
    expect(t.textarea.value).toBe('hi :user[Mary]{name=mary} ');
    expect(t.host.inserted).toEqual(['mary']);
    expect(t.aui.thread.getState().messages).toHaveLength(0);
    expect(t.mention.hidden).toBe(true);
  });

  it('Tab selects the highlighted item', async () => {
    const t = await setup();
    await t.type('@ma');
    await t.press('ArrowDown');
    await t.press('Tab');
    expect(t.aui.composer.getState().text).toBe(':user[Mark]{name=mark} ');
  });

  it('clicking an item selects it', async () => {
    const t = await setup();
    await t.type('@');
    t.mention.querySelectorAll<HTMLElement>('button')[2]!.click();
    await t.settle();
    expect(t.aui.composer.getState().text).toBe(':user[Zed]{name=zed} ');
  });

  it('Escape closes the popover and keeps the text', async () => {
    const t = await setup();
    await t.type('@ma');
    const event = await t.press('Escape');
    expect(event.defaultPrevented).toBe(true);
    expect(t.mention.hidden).toBe(true);
    expect(t.aui.composer.getState().text).toBe('@ma');
    // A key that does not move the caret does not reopen it.
    t.textarea.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
    await t.settle();
    expect(t.mention.hidden).toBe(true);
  });

  it('Shift+Enter is not consumed', async () => {
    const t = await setup();
    await t.type('@ma');
    const event = await t.press('Enter', { shiftKey: true });
    expect(event.defaultPrevented).toBe(false);
    expect(t.mention.hidden).toBe(false);
  });

  it('registers its trigger on the root and unregisters on destroy', async () => {
    const t = await setup();
    expect(Array.from(t.triggers().keys()).sort()).toEqual(['#', '@']);
    expect(t.triggers().get('@')!.resource).toBe(
      t.fixture.debugElement
        .query(By.css('[data-t=mention]'))
        .injector.get(AuiComposerTriggerPopoverDirective),
    );
  });

  it('drills into categories, goes back, and selects an item', async () => {
    const t = await setup();
    await t.type('#');
    const cats = Array.from(
      t.cat.querySelectorAll<HTMLElement>('[auiComposerTriggerPopoverCategories] button'),
    );
    expect(cats.map((b) => b.textContent!.trim())).toEqual(['Files', 'Docs']);
    expect(t.cat.querySelector<HTMLElement>('[auiComposerTriggerPopoverItems]')!.hidden).toBe(true);

    await t.press('ArrowDown');
    await t.press('Enter');
    const items = t.cat.querySelector<HTMLElement>('[auiComposerTriggerPopoverItems]')!;
    expect(items.hidden).toBe(false);
    expect(items.textContent!.trim()).toBe('README');
    expect(t.cat.querySelector<HTMLElement>('[auiComposerTriggerPopoverCategories]')!.hidden).toBe(
      true,
    );
    expect(t.cat.querySelector<HTMLElement>('button[auiComposerTriggerPopoverBack]')!.hidden).toBe(
      false,
    );

    // Backspace with an empty query goes back.
    await t.press('Backspace');
    expect(items.hidden).toBe(true);

    await t.press('Enter');
    t.cat.querySelector<HTMLElement>('[auiComposerTriggerPopoverItems] button')!.click();
    await t.settle();
    expect(t.aui.composer.getState().text).toBe(':file[a.ts] ');
  });
});

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiComposerRootDirective,
    AuiComposerInputDirective,
    AuiComposerTriggerPopoverRootDirective,
    AuiComposerTriggerPopoverDirective,
    AuiComposerTriggerPopoverInputDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [auiProvider]="config">
      <div auiComposerTriggerPopoverRoot>
        <div
          auiComposerTriggerPopover
          #slashPopover="auiComposerTriggerPopover"
          data-t="slash"
          char="/"
          [adapter]="slash.adapter()"
          [action]="slash.action()"
        ></div>
        <div
          auiComposerTriggerPopover
          #live="auiComposerTriggerPopover"
          data-t="live"
          char="~"
          [adapter]="liveBundle.adapter()"
          [isLoading]="liveBundle.isLoading()"
        ></div>
        <form auiComposerRoot>
          <textarea auiComposerInput auiComposerTriggerPopoverInput></textarea>
        </form>
      </div>
    </div>
  `,
})
class AdaptersHostComponent {
  readonly rt = createTestRuntime();
  readonly config = this.rt.config;
  readonly ran: string[] = [];
  readonly removeOnExecute = signal(false);
  readonly slash = injectSlashCommandAdapter(() => ({
    commands: [
      { id: 'summarize', description: 'Summarize', execute: () => this.ran.push('summarize') },
      { id: 'translate', execute: () => this.ran.push('translate') },
    ],
    removeOnExecute: this.removeOnExecute(),
  }));
  readonly gate: { release: () => void } = { release: () => undefined };
  readonly fetcher = vi.fn(async (q: string) => {
    await new Promise<void>((resolve) => (this.gate.release = resolve));
    return [{ id: `r-${q}`, type: 'remote', label: `Result ${q}` } satisfies TriggerItem];
  });
  readonly liveBundle = injectLiveCompletionAdapter({ fetcher: this.fetcher, debounceMs: 10 });
}

describe('trigger adapters', () => {
  async function setupAdapters() {
    configureTestBed({ imports: [AdaptersHostComponent] });
    const fixture = TestBed.createComponent(AdaptersHostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    document.body.append(el);
    const textarea = el.querySelector('textarea')!;
    const sleep = async (ms: number) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      fixture.detectChanges();
      await fixture.whenStable();
    };
    const type = async (value: string) => {
      textarea.value = value;
      textarea.setSelectionRange(value.length, value.length);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(0);
    };
    const press = async (key: string) => {
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
      await sleep(0);
    };
    const popover = (id: string) =>
      fixture.debugElement.query(By.css(id)).injector.get(AuiComposerTriggerPopoverDirective);
    return { fixture, host: fixture.componentInstance, textarea, sleep, type, press, popover };
  }

  it('slash command adapter: search, run the command, keep the token by default', async () => {
    const t = await setupAdapters();
    await t.type('/sum');
    expect(
      t
        .popover('[data-t=slash]')
        .itemList()
        .map((i) => i.id),
    ).toEqual(['summarize']);
    expect(t.popover('[data-t=slash]').itemList()[0]!.label).toBe('/summarize');
    await t.press('Enter');
    expect(t.host.ran).toEqual(['summarize']);
    expect(t.textarea.value).toBe(':command[/summarize]{name=summarize} ');
  });

  it('slash command adapter honours removeOnExecute', async () => {
    const t = await setupAdapters();
    t.host.removeOnExecute.set(true);
    await t.sleep(0);
    await t.type('/tr');
    await t.press('Enter');
    expect(t.host.ran).toEqual(['translate']);
    expect(t.textarea.value).toBe('');
  });

  it('live completion adapter debounces, fetches and surfaces results and loading', async () => {
    const t = await setupAdapters();
    await t.type('~ab');
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(t.host.fetcher).toHaveBeenCalledTimes(1);
    expect(t.host.fetcher).toHaveBeenCalledWith('ab');
    expect(t.popover('[data-t=live]').isLoading()).toBe(true);
    expect(t.popover('[data-t=live]').itemList()).toEqual([]);
    t.host.gate.release();
    await t.sleep(20);
    expect(t.popover('[data-t=live]').isLoading()).toBe(false);
    expect(
      t
        .popover('[data-t=live]')
        .itemList()
        .map((i) => i.id),
    ).toEqual(['r-ab']);
    // The same query is not refetched.
    await t.sleep(60);
    expect(t.host.fetcher).toHaveBeenCalledTimes(1);
  });
});

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiComposerRootDirective,
    AuiComposerInputDirective,
    AuiComposerTriggerPopoverRootDirective,
    AuiComposerTriggerPopoverDirective,
    AuiComposerTriggerPopoverInputDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [auiProvider]="config">
      <div auiComposerTriggerPopoverRoot>
        <div
          auiComposerTriggerPopover
          char="@"
          [adapter]="mention.adapter()"
          [directive]="mention.directive()"
        ></div>
        <form auiComposerRoot>
          <textarea auiComposerInput auiComposerTriggerPopoverInput></textarea>
        </form>
      </div>
    </div>
  `,
})
class MentionHostComponent {
  readonly rt = createTestRuntime();
  readonly config = this.rt.config;
  readonly mention = injectMentionAdapter({
    categories: [
      {
        id: 'people',
        label: 'People',
        items: [{ id: 'ann', type: 'user', label: 'Ann', icon: 'user' }],
      },
    ],
    includeModelContextTools: false,
  });
}

describe('mention adapter', () => {
  it('builds categories, items and searches across them', async () => {
    configureTestBed({ imports: [MentionHostComponent] });
    const fixture = TestBed.createComponent(MentionHostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const { adapter, directive } = fixture.componentInstance.mention;
    expect(adapter().categories()).toEqual([{ id: 'people', label: 'People' }]);
    expect(adapter().categoryItems('people')).toEqual([
      { id: 'ann', type: 'user', label: 'Ann', metadata: { icon: 'user' } },
    ]);
    expect(adapter().search!('an').map((i) => i.id)).toEqual(['ann']);
    expect(directive().formatter.serialize(adapter().search!('an')[0]!)).toBe(
      ':user[Ann]{name=ann}',
    );
  });
});

describe('injectTriggerPopoverTriggers', () => {
  it('throws outside a root', () => {
    configureTestBed();
    expect(() => TestBed.runInInjectionContext(() => injectTriggerPopoverTriggers())).toThrow(
      /within \[auiComposerTriggerPopoverRoot\]/,
    );
    expect(TestBed.runInInjectionContext(() => injectTriggerPopoverTriggersOptional())().size).toBe(
      0,
    );
  });
});
