// Original spec: the upstream dropdownMenuRenderPrimitives test only covers render props (n/a here); these mirror the Radix menu behaviors (roving focus, typeahead, Escape focus return)
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../../testing-internal/test-bed';
import { AuiActionBarMoreContentDirective } from '../action-bar-more';
import {
  AuiActionBarMoreItemDirective,
  AuiActionBarMoreRootDirective,
  AuiActionBarMoreSeparatorDirective,
  AuiActionBarMoreTriggerDirective,
} from '../action-bar-more';
import {
  AuiThreadListItemMoreContentDirective,
  AuiThreadListItemMoreItemDirective,
  AuiThreadListItemMoreRootDirective,
  AuiThreadListItemMoreTriggerDirective,
} from '../thread-list-item-more';
import { AuiMenuContentDirective } from './menu-content.directive';
import { AuiMenuItemDirective } from './menu-item.directive';
import { AuiMenuRootDirective } from './menu-root.directive';
import { AuiMenuSeparatorDirective } from './menu-separator.directive';
import { AuiMenuTriggerDirective } from './menu-trigger.directive';

@Component({
  standalone: true,
  imports: [
    AuiMenuRootDirective,
    AuiMenuTriggerDirective,
    AuiMenuContentDirective,
    AuiMenuItemDirective,
    AuiMenuSeparatorDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button id="outside">outside</button>
    <div auiMenuRoot [(open)]="open">
      <button auiMenuTrigger>More</button>
      <div auiMenuContent>
        <button auiMenuItem (select)="log('apple')">Apple</button>
        <button auiMenuItem [disabled]="true" (select)="log('avocado')">Avocado</button>
        <hr auiMenuSeparator />
        <button auiMenuItem (select)="log('banana')">Banana</button>
        <button auiMenuItem [closeOnSelect]="false" (select)="log('cherry')">Cherry</button>
        <button auiMenuItem (select)="$event.preventDefault(); log('date')">Date</button>
      </div>
    </div>
  `,
})
class HostComponent {
  readonly open = signal(false);
  readonly calls: string[] = [];
  log(name: string): void {
    this.calls.push(name);
  }
}

interface Setup {
  fixture: ComponentFixture<HostComponent>;
  host: HostComponent;
  trigger: HTMLButtonElement;
  content: HTMLElement;
  items: HTMLElement[];
  settle(): Promise<void>;
}

async function setup(): Promise<Setup> {
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  document.body.append(el);
  return {
    fixture,
    host: fixture.componentInstance,
    trigger: el.querySelector('button[auiMenuTrigger]')!,
    content: el.querySelector('[auiMenuContent]')!,
    items: Array.from(el.querySelectorAll<HTMLElement>('[auiMenuItem]')),
    settle: async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    },
  };
}

function key(target: HTMLElement, k: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('headless menu', () => {
  it('starts closed with the trigger ARIA wiring', async () => {
    const t = await setup();
    expect(t.trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(t.trigger.getAttribute('aria-expanded')).toBe('false');
    expect(t.content.getAttribute('role')).toBe('menu');
    expect(t.content.hidden).toBe(true);
    expect(t.items[0]!.getAttribute('role')).toBe('menuitem');
    expect(t.fixture.nativeElement.querySelector('hr').getAttribute('role')).toBe('separator');
  });

  it('click toggles and the open model two-way binds', async () => {
    const t = await setup();
    t.trigger.click();
    await t.settle();
    expect(t.trigger.getAttribute('aria-expanded')).toBe('true');
    expect(t.trigger.getAttribute('aria-controls')).toBe(t.content.id);
    expect(t.content.hidden).toBe(false);
    expect(t.host.open()).toBe(true);
    t.trigger.click();
    await t.settle();
    expect(t.content.hidden).toBe(true);
    expect(t.host.open()).toBe(false);
  });

  it('ArrowDown on the trigger opens with the first item focused; ArrowUp the last', async () => {
    const t = await setup();
    t.trigger.focus();
    key(t.trigger, 'ArrowDown');
    await t.settle();
    expect(document.activeElement).toBe(t.items[0]);
    key(t.content, 'Escape');
    await t.settle();
    key(t.trigger, 'ArrowUp');
    await t.settle();
    expect(document.activeElement).toBe(t.items[4]);
  });

  it('arrows wrap, skip disabled items, and Home/End jump', async () => {
    const t = await setup();
    t.trigger.focus();
    key(t.trigger, 'ArrowDown');
    await t.settle();
    key(t.items[0]!, 'ArrowDown');
    expect(document.activeElement).toBe(t.items[2]); // Avocado is disabled
    key(t.items[2]!, 'End');
    expect(document.activeElement).toBe(t.items[4]);
    key(t.items[4]!, 'ArrowDown');
    expect(document.activeElement).toBe(t.items[0]);
    key(t.items[0]!, 'ArrowUp');
    expect(document.activeElement).toBe(t.items[4]);
    key(t.items[4]!, 'Home');
    expect(document.activeElement).toBe(t.items[0]);
  });

  it('a pointer click on the trigger focuses the content and ArrowDown enters the list', async () => {
    const t = await setup();
    t.trigger.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }),
    );
    await t.settle();
    expect(document.activeElement).toBe(t.content);
    key(t.content, 'ArrowDown');
    expect(document.activeElement).toBe(t.items[0]);
  });

  it('typeahead focuses the matching item and resets after a pause', async () => {
    vi.useFakeTimers();
    try {
      const t = await setup();
      t.trigger.focus();
      key(t.trigger, 'ArrowDown');
      await t.settle();
      key(t.items[0]!, 'b');
      expect(document.activeElement).toBe(t.items[2]);
      key(t.items[2]!, 'c');
      // "bc" matches nothing, focus stays.
      expect(document.activeElement).toBe(t.items[2]);
      vi.advanceTimersByTime(600);
      key(t.items[2]!, 'c');
      expect(document.activeElement).toBe(t.items[3]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Space mid-typeahead extends the search instead of selecting the item', async () => {
    const t = await setup();
    t.trigger.focus();
    key(t.trigger, 'ArrowDown');
    await t.settle();
    key(t.items[0]!, 'b');
    expect(document.activeElement).toBe(t.items[2]);
    key(t.items[2]!, ' ');
    await t.settle();
    expect(t.host.calls).toEqual([]);
    expect(t.content.hidden).toBe(false);
  });

  it('Escape closes and returns focus to the trigger', async () => {
    const t = await setup();
    t.trigger.focus();
    key(t.trigger, 'ArrowDown');
    await t.settle();
    key(t.items[0]!, 'Escape');
    await t.settle();
    expect(t.content.hidden).toBe(true);
    expect(document.activeElement).toBe(t.trigger);
  });

  it('selecting an item runs its action, closes and refocuses the trigger', async () => {
    const t = await setup();
    t.trigger.focus();
    key(t.trigger, 'ArrowDown');
    await t.settle();
    t.items[2]!.click();
    await t.settle();
    expect(t.host.calls).toEqual(['banana']);
    expect(t.content.hidden).toBe(true);
    expect(document.activeElement).toBe(t.trigger);
  });

  it('Enter and Space activate the focused item', async () => {
    const t = await setup();
    t.trigger.focus();
    key(t.trigger, 'ArrowDown');
    await t.settle();
    key(t.items[0]!, 'Enter');
    await t.settle();
    expect(t.host.calls).toEqual(['apple']);
    key(t.trigger, 'ArrowDown');
    await t.settle();
    key(t.items[0]!, ' ');
    await t.settle();
    expect(t.host.calls).toEqual(['apple', 'apple']);
  });

  it('disabled items do not select; closeOnSelect=false and preventDefault keep it open', async () => {
    const t = await setup();
    t.trigger.click();
    await t.settle();
    t.items[1]!.click();
    expect(t.host.calls).toEqual([]);
    expect(t.items[1]!.getAttribute('aria-disabled')).toBe('true');
    t.items[3]!.click();
    t.items[4]!.click();
    await t.settle();
    expect(t.host.calls).toEqual(['cherry', 'date']);
    expect(t.content.hidden).toBe(false);
  });

  it('closes on an outside pointerdown but not on the trigger or content', async () => {
    const t = await setup();
    t.trigger.click();
    await t.settle();
    t.items[0]!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await t.settle();
    expect(t.content.hidden).toBe(false);
    document.getElementById('outside')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await t.settle();
    expect(t.content.hidden).toBe(true);
  });
});

@Component({
  standalone: true,
  imports: [
    AuiActionBarMoreRootDirective,
    AuiActionBarMoreTriggerDirective,
    AuiActionBarMoreContentDirective,
    AuiActionBarMoreItemDirective,
    AuiActionBarMoreSeparatorDirective,
    AuiThreadListItemMoreRootDirective,
    AuiThreadListItemMoreTriggerDirective,
    AuiThreadListItemMoreContentDirective,
    AuiThreadListItemMoreItemDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div auiActionBarMoreRoot id="ab">
      <button auiActionBarMoreTrigger>a</button>
      <div auiActionBarMoreContent>
        <button auiActionBarMoreItem (select)="calls.push('ab')">x</button>
        <hr auiActionBarMoreSeparator />
      </div>
    </div>
    <div auiThreadListItemMoreRoot sharedFocusGroup id="tl">
      <button auiThreadListItemMoreTrigger>t</button>
      <div auiThreadListItemMoreContent>
        <button auiThreadListItemMoreItem (select)="calls.push('tl')">y</button>
      </div>
    </div>
  `,
})
class AliasHostComponent {
  readonly calls: string[] = [];
}

describe('menu aliases', () => {
  it('ActionBarMore and ThreadListItemMore bind to the headless menu', async () => {
    configureTestBed({ imports: [AliasHostComponent] });
    const fixture = TestBed.createComponent(AliasHostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    document.body.append(el);

    const abTrigger = el.querySelector<HTMLElement>('#ab button')!;
    abTrigger.click();
    await fixture.whenStable();
    expect(abTrigger.getAttribute('aria-expanded')).toBe('true');
    el.querySelector<HTMLElement>('#ab [role=menuitem]')!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.calls).toEqual(['ab']);
    expect(el.querySelector('#ab [role=menu]')!.hasAttribute('hidden')).toBe(true);

    // sharedFocusGroup: ArrowRight opens, ArrowLeft closes and refocuses the trigger.
    const tlTrigger = el.querySelector<HTMLElement>('#tl button')!;
    tlTrigger.focus();
    key(tlTrigger, 'ArrowRight');
    await fixture.whenStable();
    const tlItem = el.querySelector<HTMLElement>('#tl [role=menuitem]')!;
    expect(document.activeElement).toBe(tlItem);
    key(tlItem, 'ArrowLeft');
    await fixture.whenStable();
    expect(el.querySelector('#tl [role=menu]')!.hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(tlTrigger);
  });
});
