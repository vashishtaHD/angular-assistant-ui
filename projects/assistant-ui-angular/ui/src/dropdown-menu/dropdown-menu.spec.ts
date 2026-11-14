import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AuiMenuRootDirective } from 'angular-assistant-ui';
import { configureTestBed } from '../../../src/testing-internal/test-bed';
import * as uiPublicApi from '../public-api';
import { overlayRoot, settle, stubLayout } from '../test-helpers';
import {
  AuiDropdownMenuContentDirective,
  AuiDropdownMenuItemDirective,
  AuiDropdownMenuLabelDirective,
  AuiDropdownMenuSeparatorDirective,
  AuiDropdownMenuTriggerDirective,
} from './dropdown-menu';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AuiDropdownMenuTriggerDirective,
    AuiDropdownMenuContentDirective,
    AuiDropdownMenuItemDirective,
    AuiDropdownMenuLabelDirective,
    AuiDropdownMenuSeparatorDirective,
  ],
  template: `<button class="trigger" [auiDropdownMenuTrigger]="menu">Menu</button>
    <ng-template #menu>
      <div auiDropdownMenuContent>
        <div auiDropdownMenuLabel>Thread</div>
        <button auiDropdownMenuItem (itemSelect)="picked.push('archive')">Archive</button>
        <button auiDropdownMenuItem disabled>Disabled</button>
        <div auiDropdownMenuSeparator></div>
        <button auiDropdownMenuItem (itemSelect)="picked.push('delete')">Delete</button>
        <button auiDropdownMenuItem (itemSelect)="picked.push('duplicate')">Duplicate</button>
      </div>
    </ng-template>`,
})
class HostComponent {
  picked: string[] = [];
}

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AuiDropdownMenuTriggerDirective,
    AuiDropdownMenuContentDirective,
    AuiDropdownMenuItemDirective,
  ],
  template: `<button class="trigger" [auiDropdownMenuTrigger]="menu">Menu</button>
    <ng-template #menu>
      <div auiDropdownMenuContent>
        <button auiDropdownMenuItem disabled>One</button>
        <button auiDropdownMenuItem disabled>Two</button>
      </div>
    </ng-template>`,
})
class DisabledHostComponent {}

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuiDropdownMenuTriggerDirective, AuiDropdownMenuContentDirective],
  template: `<button class="trigger" [auiDropdownMenuTrigger]="menu">Menu</button>
    <ng-template #menu>
      <div auiDropdownMenuContent></div>
    </ng-template>`,
})
class EmptyHostComponent {}

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AuiDropdownMenuTriggerDirective,
    AuiDropdownMenuContentDirective,
    AuiDropdownMenuItemDirective,
  ],
  template: `<button class="trigger" [auiDropdownMenuTrigger]="menu">Menu</button>
    <ng-template #menu>
      <div auiDropdownMenuContent>
        <button auiDropdownMenuItem (itemSelect)="$event.preventDefault(); picked.push('keep')">
          Keep
        </button>
      </div>
    </ng-template>`,
})
class KeepOpenHostComponent {
  picked: string[] = [];
}

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AuiMenuRootDirective,
    AuiDropdownMenuTriggerDirective,
    AuiDropdownMenuContentDirective,
    AuiDropdownMenuItemDirective,
  ],
  template: `<div auiMenuRoot #outer="auiMenuRoot" class="outer">
    <button class="trigger" [auiDropdownMenuTrigger]="menu">Menu</button>
    <!-- Declared inside another menu root: its view must still get the dropdown's root. -->
    <ng-template #menu>
      <div auiDropdownMenuContent>
        <button auiDropdownMenuItem (itemSelect)="picked.push('one')">One</button>
      </div>
    </ng-template>
  </div>`,
})
class NestedHostComponent {
  picked: string[] = [];
}

describe('dropdown menu', () => {
  let restore: () => void;
  beforeEach(() => (restore = stubLayout()));
  afterEach(() => restore());

  async function setup() {
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    document.body.appendChild(fixture.nativeElement);
    const trigger = fixture.nativeElement.querySelector('.trigger') as HTMLButtonElement;
    trigger.focus();
    return { fixture, trigger };
  }
  const menu = () => overlayRoot().querySelector('[role="menu"]') as HTMLElement | null;
  const items = () => Array.from(overlayRoot().querySelectorAll<HTMLElement>('[role="menuitem"]'));
  const key = (el: Element, k: string) =>
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

  async function open() {
    const ctx = await setup();
    ctx.trigger.click();
    ctx.fixture.detectChanges();
    await settle();
    return ctx;
  }

  it('is closed by default and exposes aria on the trigger', async () => {
    const { trigger } = await setup();
    expect(menu()).toBeNull();
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens below its trigger and focuses the first enabled item', async () => {
    const { trigger } = await open();
    expect(menu()).not.toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(menu()!.closest('.cdk-overlay-pane')?.getAttribute('data-side')).toBe('bottom');
    expect(document.activeElement).toBe(items()[0]);
    expect(items()[0].tabIndex).toBe(0);
    expect(items()[2].tabIndex).toBe(-1);
  });

  it('supports arrow, Home and End navigation, skipping disabled items and wrapping', async () => {
    await open();
    const m = menu()!;
    key(m, 'ArrowDown');
    expect(document.activeElement).toBe(items()[2]); // skips disabled
    key(m, 'ArrowDown');
    key(m, 'ArrowDown');
    expect(document.activeElement).toBe(items()[0]); // wraps
    key(m, 'ArrowUp');
    expect(document.activeElement).toBe(items()[3]);
    key(m, 'Home');
    expect(document.activeElement).toBe(items()[0]);
    key(m, 'End');
    expect(document.activeElement).toBe(items()[3]);
  });

  it('moves to the item matching typed characters', async () => {
    await open();
    key(menu()!, 'd');
    key(menu()!, 'u');
    expect(document.activeElement).toBe(items()[3]); // "Duplicate", not disabled "Disabled"
  });

  it('selects with Enter, emits itemSelect, closes and restores focus', async () => {
    const { fixture, trigger } = await open();
    key(menu()!, 'ArrowDown');
    key(document.activeElement!, 'Enter');
    fixture.detectChanges();
    await settle();
    expect(fixture.componentInstance.picked).toEqual(['delete']);
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('selects on click and ignores disabled items', async () => {
    const { fixture } = await open();
    items()[1].click();
    expect(fixture.componentInstance.picked).toEqual([]);
    expect(menu()).not.toBeNull();
    items()[0].click();
    fixture.detectChanges();
    await settle();
    expect(fixture.componentInstance.picked).toEqual(['archive']);
    expect(menu()).toBeNull();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const { fixture, trigger } = await open();
    key(menu()!, 'Escape');
    fixture.detectChanges();
    await settle();
    expect(menu()).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on outside click', async () => {
    const { fixture } = await open();
    (overlayRoot().querySelector('.cdk-overlay-backdrop') as HTMLElement).click();
    fixture.detectChanges();
    await settle();
    expect(menu()).toBeNull();
  });

  it('closes on Escape when every item is disabled, and can reopen', async () => {
    configureTestBed({ imports: [DisabledHostComponent] });
    const fixture = TestBed.createComponent(DisabledHostComponent);
    fixture.detectChanges();
    document.body.appendChild(fixture.nativeElement);
    const trigger = fixture.nativeElement.querySelector('.trigger') as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    fixture.detectChanges();
    await settle();
    expect(menu()).not.toBeNull();
    key(document.activeElement ?? trigger, 'Escape');
    fixture.detectChanges();
    await settle();
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    trigger.click();
    fixture.detectChanges();
    await settle();
    expect(menu()).not.toBeNull();
  });

  it('closes on Escape for an empty menu', async () => {
    configureTestBed({ imports: [EmptyHostComponent] });
    const fixture = TestBed.createComponent(EmptyHostComponent);
    fixture.detectChanges();
    document.body.appendChild(fixture.nativeElement);
    const trigger = fixture.nativeElement.querySelector('.trigger') as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    fixture.detectChanges();
    await settle();
    expect(menu()).not.toBeNull();
    key(document.activeElement ?? trigger, 'Escape');
    fixture.detectChanges();
    await settle();
    expect(menu()).toBeNull();
  });

  it('opens from the keyboard with ArrowDown on the trigger', async () => {
    const { fixture, trigger } = await setup();
    key(trigger, 'ArrowDown');
    fixture.detectChanges();
    await settle();
    expect(menu()).not.toBeNull();
    expect(document.activeElement).toBe(items()[0]);
  });

  it('runs on the main entry headless menu (shared root, aria-controls wiring)', async () => {
    const { fixture, trigger } = await open();
    const root = fixture.debugElement.query(By.css('.trigger')).injector.get(AuiMenuRootDirective);
    expect(root.open()).toBe(true);
    expect(trigger.getAttribute('aria-controls')).toBe(menu()!.id);
    expect(menu()!.id).toBe(root.contentId);
    expect(menu()!.hidden).toBe(false);
  });

  it('closes when the menu root is closed programmatically and reopens on the first item', async () => {
    const { fixture, trigger } = await open();
    const root = fixture.debugElement.query(By.css('.trigger')).injector.get(AuiMenuRootDirective);
    root.setOpen(false);
    fixture.detectChanges();
    await settle();
    expect(menu()).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    key(trigger, 'ArrowUp');
    fixture.detectChanges();
    await settle();
    expect(document.activeElement).toBe(items()[3]);
  });

  it('passes the originating event to itemSelect; preventDefault keeps the menu open', async () => {
    configureTestBed({ imports: [KeepOpenHostComponent] });
    const fixture = TestBed.createComponent(KeepOpenHostComponent);
    fixture.detectChanges();
    document.body.appendChild(fixture.nativeElement);
    const trigger = fixture.nativeElement.querySelector('.trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    await settle();
    items()[0].click();
    fixture.detectChanges();
    await settle();
    expect(fixture.componentInstance.picked).toEqual(['keep']);
    expect(menu()).not.toBeNull();
  });

  it('a pointer click opens with focus on the menu surface; ArrowDown enters the list', async () => {
    const { fixture, trigger } = await setup();
    // HTMLElement.click() has detail 0 (a keyboard click); a real pointer click has detail >= 1.
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    fixture.detectChanges();
    await settle();
    expect(menu()).not.toBeNull();
    expect(document.activeElement).toBe(menu());
    expect(items().some((item) => item.hasAttribute('data-highlighted'))).toBe(false);
    key(menu()!, 'ArrowDown');
    fixture.detectChanges();
    expect(document.activeElement).toBe(items()[0]);
    expect(items()[0].hasAttribute('data-highlighted')).toBe(true);
  });

  it('a template declared inside another menu root still binds to the dropdown', async () => {
    configureTestBed({ imports: [NestedHostComponent] });
    const fixture = TestBed.createComponent(NestedHostComponent);
    fixture.detectChanges();
    document.body.appendChild(fixture.nativeElement);
    const outer = fixture.debugElement.query(By.css('.outer')).injector.get(AuiMenuRootDirective);
    const inner = fixture.debugElement.query(By.css('.trigger')).injector.get(AuiMenuRootDirective);
    expect(inner).not.toBe(outer);
    const trigger = fixture.nativeElement.querySelector('.trigger') as HTMLButtonElement;
    trigger.focus();
    key(trigger, 'ArrowDown');
    fixture.detectChanges();
    await settle();
    expect(menu()!.id).toBe(inner.contentId);
    expect(document.activeElement).toBe(items()[0]);
    items()[0].click();
    fixture.detectChanges();
    await settle();
    expect(fixture.componentInstance.picked).toEqual(['one']);
    expect(menu()).toBeNull();
    expect(inner.open()).toBe(false);
    expect(outer.open()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('isOpen is a read-only view of the menu state', async () => {
    const { fixture } = await open();
    const dropdown = fixture.debugElement
      .query(By.css('.trigger'))
      .injector.get(AuiDropdownMenuTriggerDirective);
    expect(dropdown.isOpen()).toBe(true);
    expect('set' in dropdown.isOpen).toBe(false);
    key(menu()!, 'Escape');
    fixture.detectChanges();
    await settle();
    expect(dropdown.isOpen()).toBe(false);
  });

  it('no longer exports the internal headless menu from the ui entry', () => {
    expect(Object.keys(uiPublicApi)).not.toContain('UiMenuContentDirective');
    expect(Object.keys(uiPublicApi)).not.toContain('UiMenuItemDirective');
  });
});
