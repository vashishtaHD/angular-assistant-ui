import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../../src/testing-internal/test-bed';
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

  it('opens from the keyboard with ArrowDown on the trigger', async () => {
    const { fixture, trigger } = await setup();
    key(trigger, 'ArrowDown');
    fixture.detectChanges();
    await settle();
    expect(menu()).not.toBeNull();
    expect(document.activeElement).toBe(items()[0]);
  });
});
