// Mirrors the interaction-lock behavior of packages/react/src/primitives/actionBarMore/ActionBarMoreRoot.tsx @ 7d74276
// (upstream has no spec for it; these cover the uncontrolled, controlled and unmount paths)
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { flushTapSync } from '@assistant-ui/tap';
import { afterEach, describe, expect, it } from 'vitest';
import { configureTestBed } from '../../../testing-internal/test-bed';
import {
  createTestRuntime,
  type DemoMessage,
  type TestRuntime,
} from '../../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../../provider/aui-provider.directive';
import {
  AuiActionBarMoreContentDirective,
  AuiActionBarMoreItemDirective,
  AuiActionBarMoreRootDirective,
  AuiActionBarMoreTriggerDirective,
} from '../action-bar-more';
import { AuiMessageRootDirective } from '../message-root.directive';
import {
  AuiMessageTemplateDirective,
  AuiThreadMessagesComponent,
} from '../thread-messages.component';
import { AuiActionBarRootDirective } from './action-bar-root.directive';

const showMore = signal(true);
const controlled = signal<boolean | undefined>(undefined);
const openChanges: boolean[] = [];
let runtime: TestRuntime;

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessageRootDirective,
    AuiActionBarRootDirective,
    AuiActionBarMoreRootDirective,
    AuiActionBarMoreTriggerDirective,
    AuiActionBarMoreContentDirective,
    AuiActionBarMoreItemDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button class="outside">outside</button>
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage>
          <div auiMessageRoot class="row">
            <div auiActionBarRoot class="bar" autohide="not-last">
              @if (showMore()) {
                @if (controlled() === undefined) {
                  <div auiActionBarMoreRoot (openChange)="openChanges.push($event)">
                    <button auiActionBarMoreTrigger class="more">more</button>
                    <div auiActionBarMoreContent>
                      <button auiActionBarMoreItem>Copy</button>
                    </div>
                  </div>
                } @else {
                  <div auiActionBarMoreRoot [open]="!!controlled()">
                    <button auiActionBarMoreTrigger class="more">more</button>
                    <div auiActionBarMoreContent>
                      <button auiActionBarMoreItem>Copy</button>
                    </div>
                  </div>
                }
              }
            </div>
          </div>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class HostComponent {
  readonly config = runtime.config;
  readonly showMore = showMore;
  readonly controlled = controlled;
  readonly openChanges = openChanges;
}

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await Promise.resolve();
  }
};

const user: DemoMessage = { id: 'u1', role: 'user', content: [{ type: 'text', text: 'hi' }] };
const assistant: DemoMessage = {
  id: 'a1',
  role: 'assistant',
  content: [{ type: 'text', text: 'hello' }],
};

async function mount() {
  runtime = createTestRuntime();
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  flushTapSync(() => [user, assistant].forEach((m) => runtime.append(m)));
  await settle(fixture);
  const el = fixture.nativeElement as HTMLElement;
  document.body.append(el);
  const row = () => el.querySelectorAll<HTMLElement>('.row')[0]!;
  const bar = () => row().querySelector<HTMLElement>('.bar')!;
  const hover = async (on: boolean) => {
    flushTapSync(() => row().dispatchEvent(new MouseEvent(on ? 'mouseenter' : 'mouseleave')));
    await settle(fixture);
  };
  /** Focus leaves the bar for an element outside it. */
  const blurBar = async () => {
    const outside = el.querySelector<HTMLElement>('.outside')!;
    outside.focus();
    bar().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
    await settle(fixture);
  };
  return { fixture, el, bar, hover, blurBar };
}

afterEach(() => {
  showMore.set(true);
  controlled.set(undefined);
  openChanges.length = 0;
});

describe('ActionBarMore interaction lock', () => {
  it('keeps an auto-hidden bar visible while its menu is open, and releases on close', async () => {
    const t = await mount();
    expect(t.bar().hasAttribute('hidden')).toBe(true);
    await t.hover(true);
    t.bar().querySelector<HTMLElement>('.more')!.click();
    await settle(t.fixture);
    expect(openChanges).toEqual([true]);

    await t.hover(false);
    await t.blurBar();
    expect(t.bar().hasAttribute('hidden')).toBe(false);

    // Outside pointerdown closes the menu without moving focus back into the bar.
    t.el.querySelector('.outside')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await settle(t.fixture);
    expect(openChanges).toEqual([true, false]);
    expect(t.bar().hasAttribute('hidden')).toBe(true);
    t.fixture.destroy();
  });

  it('follows a controlled open binding', async () => {
    controlled.set(false);
    const t = await mount();
    expect(t.bar().hasAttribute('hidden')).toBe(true);
    controlled.set(true);
    await settle(t.fixture);
    await t.blurBar();
    expect(t.bar().hasAttribute('hidden')).toBe(false);
    controlled.set(false);
    await settle(t.fixture);
    expect(t.bar().hasAttribute('hidden')).toBe(true);
    t.fixture.destroy();
  });

  it('releases the lock when the menu is destroyed while open', async () => {
    controlled.set(true);
    const t = await mount();
    await t.blurBar();
    expect(t.bar().hasAttribute('hidden')).toBe(false);
    showMore.set(false);
    await settle(t.fixture);
    expect(t.bar().hasAttribute('hidden')).toBe(true);
    t.fixture.destroy();
  });
});
