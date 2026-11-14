import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { flushTapSync } from '@assistant-ui/tap';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../../testing-internal/test-bed';
import {
  createTestRuntime,
  type DemoMessage,
  type TestRuntime,
} from '../../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../../provider/aui-provider.directive';
import { AuiMessageRootDirective } from '../message-root.directive';
import {
  AuiMessageTemplateDirective,
  AuiThreadMessagesComponent,
} from '../thread-messages.component';
import { AuiActionBarCopyDirective } from './action-bar-copy.directive';
import { AuiActionBarEditDirective } from './action-bar-edit.directive';
import {
  AuiActionBarExportMarkdownDirective,
  type AuiExportMarkdownEvent,
} from './action-bar-export-markdown.directive';
import {
  AuiActionBarFeedbackNegativeDirective,
  AuiActionBarFeedbackPositiveDirective,
} from './action-bar-feedback.directive';
import { AuiActionBarReloadDirective } from './action-bar-reload.directive';
import { AuiActionBarRootDirective } from './action-bar-root.directive';
import { AUI_CLIPBOARD } from './clipboard';

let current: TestRuntime;
const onReload = vi.fn(async () => undefined);
const exported: AuiExportMarkdownEvent[] = [];
const autohide = signal<'always' | 'not-last' | 'never'>('never');
const hideWhenRunning = signal(false);
const float = signal<'always' | 'single-branch' | 'never'>('never');
const copiedDuration = signal(3000);

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessageRootDirective,
    AuiActionBarRootDirective,
    AuiActionBarCopyDirective,
    AuiActionBarReloadDirective,
    AuiActionBarEditDirective,
    AuiActionBarFeedbackPositiveDirective,
    AuiActionBarFeedbackNegativeDirective,
    AuiActionBarExportMarkdownDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config()">
      <aui-thread-messages>
        <ng-template auiMessage>
          <div auiMessageRoot class="row">
            <div
              auiActionBarRoot
              class="bar"
              [autohide]="autohide()"
              [autohideFloat]="float()"
              [hideWhenRunning]="hideWhenRunning()"
            >
              <button auiActionBarCopy class="copy" [copiedDuration]="copiedDuration()">x</button>
              <button auiActionBarReload class="reload">x</button>
              <button auiActionBarEdit class="edit">x</button>
              <button auiActionBarFeedbackPositive class="up">x</button>
              <button auiActionBarFeedbackNegative class="down">x</button>
              <button auiActionBarExportMarkdown class="export" (onExport)="onExport($event)">
                x
              </button>
            </div>
          </div>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class HostComponent {
  readonly config = signal(current.config);
  readonly autohide = autohide;
  readonly float = float;
  readonly hideWhenRunning = hideWhenRunning;
  readonly copiedDuration = copiedDuration;
  onExport(event: AuiExportMarkdownEvent) {
    exported.push(event);
    event.preventDefault();
  }
}

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiActionBarExportMarkdownDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage>
          <button auiActionBarExportMarkdown class="export" filename="answer.md">x</button>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class PlainExportHostComponent {
  readonly config = current.config;
}

const swap = (fixture: ComponentFixture<HostComponent>, rt: TestRuntime) => {
  flushTapSync(() => {
    fixture.componentInstance.config.set(rt.config);
    fixture.detectChanges();
  });
};

const click = (el: HTMLElement) => flushTapSync(() => el.click());

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await Promise.resolve();
  }
};

const user: DemoMessage = { id: 'u1', role: 'user', content: [{ type: 'text', text: 'hello' }] };
const assistant: DemoMessage = {
  id: 'a1',
  role: 'assistant',
  content: [{ type: 'text', text: 'world **md**' }],
};

const mount = async (
  messages: DemoMessage[] = [user, assistant],
  setup?: (rt: TestRuntime) => void,
  providers: unknown[] = [],
) => {
  current = createTestRuntime({ onReload });
  setup?.(current);
  configureTestBed({ imports: [HostComponent], providers: providers as never[] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  flushTapSync(() => messages.forEach((m) => current.append(m)));
  await settle(fixture);
  const el = fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(el.querySelectorAll<HTMLElement>('.row'));
  const q = <T extends HTMLElement = HTMLButtonElement>(row: number, sel: string) =>
    rows()[row].querySelector<T>(sel)!;
  return { fixture, el, rows, q };
};

describe('action bar', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    exported.length = 0;
    autohide.set('never');
    float.set('never');
    hideWhenRunning.set(false);
    copiedDuration.set(3000);
  });

  it('copy writes the message text and sets data-copied for the duration', async () => {
    const write = vi.fn(async () => undefined);
    const { fixture, q } = await mount(undefined, undefined, [
      { provide: AUI_CLIPBOARD, useValue: write },
    ]);
    copiedDuration.set(40);
    await settle(fixture);
    click(q(1, '.copy'));
    await new Promise((r) => setTimeout(r, 10));
    await settle(fixture);
    expect(write).toHaveBeenCalledWith('world **md**');
    expect(q(1, '.copy').hasAttribute('data-copied')).toBe(true);
    await new Promise((r) => setTimeout(r, 80));
    await settle(fixture);
    expect(q(1, '.copy').hasAttribute('data-copied')).toBe(false);
    fixture.destroy();
  });

  it('copy clears data-copied and the timer when the message scope goes away', async () => {
    const write = vi.fn(async () => undefined);
    const { fixture, q, rows } = await mount(undefined, undefined, [
      { provide: AUI_CLIPBOARD, useValue: write },
    ]);
    click(q(1, '.copy'));
    await new Promise((r) => setTimeout(r, 10));
    await settle(fixture);
    expect(q(1, '.copy').hasAttribute('data-copied')).toBe(true);
    const error = vi.spyOn(console, 'error');
    const warn = vi.spyOn(console, 'warn');
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    flushTapSync(() => current.setMessages([user]));
    await settle(fixture);
    expect(rows().length).toBe(1);
    expect(clear).toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('copy resets when the message client is replaced under an unchanged id', async () => {
    const write = vi.fn(async () => undefined);
    const { fixture, q } = await mount(undefined, undefined, [
      { provide: AUI_CLIPBOARD, useValue: write },
    ]);
    const first = current;
    click(q(1, '.copy'));
    await new Promise((r) => setTimeout(r, 10));
    await settle(fixture);
    expect(q(1, '.copy').hasAttribute('data-copied')).toBe(true);

    // Same ids, different runtime: a different message client.
    const second = createTestRuntime({ onReload });
    flushTapSync(() => [user, assistant].forEach((m) => second.append(m)));
    swap(fixture, second);
    await settle(fixture);
    swap(fixture, first);
    await settle(fixture);
    // Had the timer survived the rebind, the original message would still be copied.
    expect(q(1, '.copy').hasAttribute('data-copied')).toBe(false);
    fixture.destroy();
  });

  it('copy ignores a pending write that completes after an A, B, A scope round trip', async () => {
    let finish!: () => void;
    const write = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { fixture, q } = await mount(undefined, undefined, [
      { provide: AUI_CLIPBOARD, useValue: write },
    ]);
    const first = current;
    click(q(1, '.copy'));
    const second = createTestRuntime({ onReload });
    flushTapSync(() => [user, assistant].forEach((m) => second.append(m)));
    swap(fixture, second);
    await settle(fixture);
    swap(fixture, first);
    await settle(fixture);
    finish();
    await new Promise((r) => setTimeout(r, 10));
    await settle(fixture);
    expect(q(1, '.copy').hasAttribute('data-copied')).toBe(false);
    fixture.destroy();
  });

  it('copy and export are disabled for a message with no text', async () => {
    const { fixture, q } = await mount([user, { ...assistant, content: [] }]);
    expect(q(1, '.copy').disabled).toBe(true);
    expect(q(1, '.export').disabled).toBe(true);
    fixture.destroy();
  });

  it('copy and export are disabled while the assistant message is running', async () => {
    const { fixture, q } = await mount();
    expect(q(1, '.copy').disabled).toBe(false);
    expect(q(1, '.export').disabled).toBe(false);
    flushTapSync(() => current.setRunning(true));
    await settle(fixture);
    expect(q(1, '.copy').disabled).toBe(true);
    expect(q(1, '.export').disabled).toBe(true);
    fixture.destroy();
  });

  it('reload is disabled while running and calls reload() otherwise', async () => {
    const { fixture, q } = await mount();
    expect(q(1, '.reload').disabled).toBe(false);
    expect(q(0, '.reload').disabled).toBe(true);
    click(q(1, '.reload'));
    await settle(fixture);
    expect(onReload).toHaveBeenCalled();
    flushTapSync(() => current.setRunning(true));
    await settle(fixture);
    expect(q(1, '.reload').disabled).toBe(true);
    fixture.destroy();
  });

  it('autohide hides a non-last message bar until hover', async () => {
    autohide.set('not-last');
    const { fixture, q, rows } = await mount();
    await settle(fixture);
    expect(q(0, '.bar').hasAttribute('hidden')).toBe(true);
    expect(q(1, '.bar').hasAttribute('hidden')).toBe(false);
    flushTapSync(() => rows()[0].dispatchEvent(new MouseEvent('mouseenter')));
    await settle(fixture);
    expect(q(0, '.bar').hasAttribute('hidden')).toBe(false);
    flushTapSync(() => rows()[0].dispatchEvent(new MouseEvent('mouseleave')));
    await settle(fixture);
    expect(q(0, '.bar').hasAttribute('hidden')).toBe(true);
    fixture.destroy();
  });

  it('autohide shows the bar while focus is within it', async () => {
    autohide.set('always');
    const { fixture, q } = await mount();
    expect(q(1, '.bar').hasAttribute('hidden')).toBe(true);
    q(1, '.bar').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await settle(fixture);
    expect(q(1, '.bar').hasAttribute('hidden')).toBe(false);
    q(1, '.bar').dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    await settle(fixture);
    expect(q(1, '.bar').hasAttribute('hidden')).toBe(true);
    fixture.destroy();
  });

  it('autohideFloat sets data-floating for a single-branch message', async () => {
    autohide.set('always');
    float.set('single-branch');
    const { fixture, q, rows } = await mount();
    flushTapSync(() => rows()[1].dispatchEvent(new MouseEvent('mouseenter')));
    await settle(fixture);
    expect(q(1, '.bar').getAttribute('data-floating')).toBe('true');
    fixture.destroy();
  });

  it('hideWhenRunning hides the bar while the thread runs', async () => {
    hideWhenRunning.set(true);
    const { fixture, q } = await mount();
    expect(q(1, '.bar').hasAttribute('hidden')).toBe(false);
    flushTapSync(() => current.setRunning(true));
    await settle(fixture);
    expect(q(1, '.bar').hasAttribute('hidden')).toBe(true);
    fixture.destroy();
  });

  it('feedback calls the adapter, then sets data-submitted', async () => {
    const submit = vi.fn();
    const { fixture, q } = await mount(undefined, (rt) => rt.withFeedback({ submit }));
    expect(q(1, '.up').hasAttribute('data-submitted')).toBe(false);
    click(q(1, '.up'));
    await settle(fixture);
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'positive', message: expect.objectContaining({ id: 'a1' }) }),
    );
    expect(q(1, '.up').hasAttribute('data-submitted')).toBe(true);
    expect(q(1, '.down').hasAttribute('data-submitted')).toBe(false);
    click(q(1, '.down'));
    await settle(fixture);
    expect(q(1, '.down').hasAttribute('data-submitted')).toBe(true);
    fixture.destroy();
  });

  it('export emits the markdown of the message', async () => {
    const { fixture, q } = await mount();
    click(q(1, '.export'));
    await settle(fixture);
    expect(exported.map((e) => e.content)).toEqual(['world **md**']);
    fixture.destroy();
  });

  it('export downloads a .md file when no handler prevents the default', async () => {
    const create = vi.fn(() => 'blob:x');
    Object.defineProperty(URL, 'createObjectURL', { value: create, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    current = createTestRuntime();
    configureTestBed({ imports: [PlainExportHostComponent] });
    const fixture = TestBed.createComponent(PlainExportHostComponent);
    fixture.detectChanges();
    flushTapSync(() => current.append(assistant));
    await settle(fixture);
    click((fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.export')!);
    await settle(fixture);
    expect(create).toHaveBeenCalledTimes(1);
    expect(names).toEqual(['answer.md']);
    fixture.destroy();
  });
});
