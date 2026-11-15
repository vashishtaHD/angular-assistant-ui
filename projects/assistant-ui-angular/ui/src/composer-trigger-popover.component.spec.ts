// Covers packages/ui/src/components/react/assistant-ui/elements/composer-trigger-popover.aui.tsx @ 7d74276
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  AuiComposerInputDirective,
  AuiComposerRootDirective,
  AuiComposerTriggerPopoverInputDirective,
  AuiComposerTriggerPopoverRootDirective,
  AuiProviderDirective,
  type TriggerActionConfig,
  type TriggerAdapter,
  type TriggerDirectiveConfig,
  type TriggerItem,
} from 'angular-assistant-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { displayOf, useFlexAuthorClass } from '../../src/testing-internal/author-css';
import { configureTestBed } from '../../src/testing-internal/test-bed';
import { createTestRuntime } from '../../src/testing-internal/test-runtime';
import type { AuiIconName } from './icons/icon-shapes';
import { AuiComposerTriggerPopoverStyledComponent } from './composer-trigger-popover.component';

const adapter: TriggerAdapter = {
  categories: () => [
    { id: 'people', label: 'People' },
    { id: 'files', label: 'Files' },
  ],
  categoryItems: (id) =>
    id === 'people'
      ? [
          { id: 'mary', type: 'user', label: 'Mary', description: 'Design' },
          { id: 'mark', type: 'user', label: 'Mark', metadata: { icon: 'file' } },
        ]
      : [],
};

let directive: TriggerDirectiveConfig | undefined;
let action: TriggerActionConfig | undefined;

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiComposerRootDirective,
    AuiComposerInputDirective,
    AuiComposerTriggerPopoverRootDirective,
    AuiComposerTriggerPopoverInputDirective,
    AuiComposerTriggerPopoverStyledComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [auiProvider]="config">
    <div auiComposerTriggerPopoverRoot class="wrap">
      <aui-composer-trigger-popover-styled
        char="@"
        class="flex"
        [adapter]="adapter"
        [isLoading]="loading()"
        [iconMap]="iconMap"
        [directive]="directive"
        [action]="action"
      />
      <form auiComposerRoot>
        <textarea auiComposerInput auiComposerTriggerPopoverInput></textarea>
      </form>
    </div>
  </div>`,
})
class HostComponent {
  readonly config = createTestRuntime().config;
  readonly adapter = adapter;
  readonly loading = signal(false);
  readonly iconMap: Record<string, AuiIconName> = { people: 'pencil' };
  readonly directive = directive;
  readonly action = action;
}

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

let mounted: HTMLElement | undefined;

async function mount() {
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  const root = fixture.nativeElement as HTMLElement;
  document.body.append(root);
  mounted = root;
  fixture.detectChanges();
  await settle(fixture);
  const textarea = root.querySelector('textarea')!;
  const popover = root.querySelector<HTMLElement>('aui-composer-trigger-popover-styled')!;
  return {
    fixture,
    root,
    textarea,
    popover,
    settle: () => settle(fixture),
    type: async (value: string) => {
      textarea.value = value;
      textarea.setSelectionRange(value.length, value.length);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      await settle(fixture);
    },
    texts: (selector: string) =>
      Array.from(popover.querySelectorAll(selector), (el) =>
        el.textContent?.replace(/\s+/g, ' ').trim(),
      ),
  };
}

beforeEach(() => {
  useFlexAuthorClass();
  directive = {};
  action = undefined;
});

afterEach(() => {
  mounted?.remove();
  mounted = undefined;
  TestBed.resetTestingModule();
  vi.restoreAllMocks();
});

describe('aui-composer-trigger-popover-styled', () => {
  it('stays hidden until the trigger is typed, even under author CSS', async () => {
    const t = await mount();
    expect(t.popover.getAttribute('data-slot')).toBe('composer-trigger-popover');
    expect(t.popover.getAttribute('role')).toBe('listbox');
    expect(displayOf(t.popover)).toBe('none');
    await t.type('hello @');
    expect(displayOf(t.popover)).not.toBe('none');
  });

  it('lists categories, drills into one and goes back', async () => {
    const t = await mount();
    await t.type('@');
    expect(t.texts('[data-slot="composer-trigger-popover-category"]')).toEqual(['People', 'Files']);
    const icons = Array.from(
      t.popover.querySelectorAll('[data-slot="composer-trigger-popover-category"] aui-icon'),
    );
    // Mapped icon for "people", fallback for "files", plus a chevron each.
    expect(icons.map((icon) => icon.getAttribute('data-icon'))).toEqual([
      'pencil',
      'chevron-right',
      'sparkles',
      'chevron-right',
    ]);
    t.popover
      .querySelector<HTMLButtonElement>('[data-slot="composer-trigger-popover-category"]')!
      .click();
    await t.settle();
    const items = t.popover.querySelector<HTMLElement>(
      '[data-slot="composer-trigger-popover-items"]',
    )!;
    expect(displayOf(items)).not.toBe('none');
    expect(t.texts('[data-slot="composer-trigger-popover-item"]')).toEqual(['Mary Design', 'Mark']);
    expect(
      t.popover
        .querySelector('[data-slot="composer-trigger-popover-item"] aui-icon')
        ?.getAttribute('data-icon'),
    ).toBe('sparkles');
    const back = t.popover.querySelector<HTMLButtonElement>(
      '[data-slot="composer-trigger-popover-back"]',
    )!;
    expect(back.textContent?.trim()).toBe('Back');
    back.click();
    await t.settle();
    expect(displayOf(items)).toBe('none');
  });

  it('inserts a directive for the chosen item', async () => {
    const onInserted = vi.fn();
    directive = { onInserted };
    const t = await mount();
    await t.type('@mar');
    expect(t.texts('[data-slot="composer-trigger-popover-item"]')).toEqual(['Mary Design', 'Mark']);
    t.popover
      .querySelectorAll<HTMLButtonElement>('[data-slot="composer-trigger-popover-item"]')[1]!
      .click();
    await t.settle();
    expect(onInserted).toHaveBeenCalledWith(expect.objectContaining({ id: 'mark' }));
    expect(t.textarea.value).toContain('mark');
  });

  it('runs the action for the chosen item', async () => {
    const onExecute = vi.fn();
    directive = undefined;
    action = { onExecute, removeOnExecute: true };
    const t = await mount();
    await t.type('@mary');
    t.popover
      .querySelector<HTMLButtonElement>('[data-slot="composer-trigger-popover-item"]')!
      .click();
    await t.settle();
    expect(onExecute).toHaveBeenCalledWith(expect.objectContaining({ id: 'mary' }) as TriggerItem);
  });

  it('shows the empty and loading labels', async () => {
    const t = await mount();
    await t.type('@zzz');
    const empty =
      '[data-slot="composer-trigger-popover-items"] [data-slot="composer-trigger-popover-empty"]';
    expect(t.texts(empty)).toEqual(['No matching items']);
    t.fixture.componentInstance.loading.set(true);
    await t.settle();
    expect(t.texts(empty)).toEqual(['Loading…']);
  });

  it('warns in dev mode unless exactly one of directive or action is set', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    directive = { onInserted: () => undefined };
    action = { onExecute: () => undefined };
    await mount();
    expect(warn).toHaveBeenCalledWith(
      '[assistant-ui] ComposerTriggerPopover requires exactly one of `directive` or `action` props.',
    );
  });
});
