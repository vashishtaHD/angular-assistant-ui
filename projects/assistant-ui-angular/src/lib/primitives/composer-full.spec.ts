// Ported from packages/core/src/tests/message-queue.test.ts and packages/react/src/tests/local-runtime-queue.test.tsx @ 7d74276
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AuiConfig, type AssistantClient } from '@assistant-ui/store/client';
import { flushTapSync } from '@assistant-ui/tap';
import {
  InMemoryThreadListAdapter,
  createMessageQueue,
  type AppendMessage,
  type ExternalStoreAdapter,
} from '@assistant-ui/core';
import { AssistantRuntimeImpl, ExternalStoreRuntimeCore } from '@assistant-ui/core/internal';
import { RuntimeAdapter } from '@assistant-ui/core/store';
import { describe, expect, it, vi } from 'vitest';
import { displayOf, useFlexAuthorClass } from '../../testing-internal/author-css';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime } from '../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { injectAui } from '../state/inject-aui';
import { AuiComposerCancelDirective } from './composer-cancel.directive';
import { AuiComposerInputDirective } from './composer-input.directive';
import { injectComposerInput, type ComposerInputBridge } from './composer-input-bridge';
import { injectComposerInputHistory, type ComposerInputHistory } from './composer-input-history';
import {
  AuiComposerQuoteDirective,
  AuiComposerQuoteDismissDirective,
  AuiComposerQuoteTextDirective,
} from './composer-quote.directive';
import {
  AuiComposerQueueComponent,
  AuiQueueItemTemplateDirective,
} from './composer-queue.component';
import { AuiComposerRootDirective } from './composer-root.directive';
import { AuiComposerSendDirective } from './composer-send.directive';
import { AuiThreadRootDirective } from './thread-root.directive';
import { AuiQueueItemRemoveDirective } from './queue-item/remove';
import { AuiQueueItemSteerDirective } from './queue-item/steer';
import { AuiQueueItemTextDirective } from './queue-item/text';

/** An external store runtime with a message queue, `onNew`/`onCancel` spies and a `running` toggle. */
function createQueueRuntime(withQueue: boolean) {
  const onNew = vi.fn(async () => undefined);
  const onCancel = vi.fn(async () => undefined);
  const dispatched: AppendMessage[] = [];
  let isRunning = false;
  const controller = createMessageQueue({
    run: (message) => {
      controller.notifyBusy();
      dispatched.push(message);
      isRunning = true;
      sync();
    },
    cancel: () => {
      isRunning = false;
      sync();
    },
  });
  const make = (): ExternalStoreAdapter<{ role: 'user'; content: string }> => ({
    messages: [],
    isRunning,
    convertMessage: (m) => m,
    onNew,
    onCancel,
    ...(withQueue ? { queue: controller.adapter } : {}),
  });
  const core = new ExternalStoreRuntimeCore(make());
  const sync = () => core.setAdapter(make());
  controller.subscribe(sync);
  const runtime = new AssistantRuntimeImpl(core);
  return {
    onNew,
    onCancel,
    dispatched,
    config: AuiConfig({ threads: RuntimeAdapter(runtime) }),
    setRunning(value: boolean) {
      isRunning = value;
      sync();
    },
    /** The run settles: the queue advances to its next message. */
    finishRun() {
      isRunning = false;
      sync();
      controller.notifyIdle();
    },
  };
}

@Component({
  selector: 'aui-probe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class ProbeComponent {
  readonly aui = injectAui();
  readonly bridge: ComposerInputBridge = injectComposerInput();
  readonly history: ComposerInputHistory = injectComposerInputHistory();
}

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadRootDirective,
    AuiComposerRootDirective,
    AuiComposerInputDirective,
    AuiComposerSendDirective,
    AuiComposerCancelDirective,
    AuiComposerQuoteDirective,
    AuiComposerQuoteTextDirective,
    AuiComposerQuoteDismissDirective,
    AuiComposerQueueComponent,
    AuiQueueItemTemplateDirective,
    AuiQueueItemTextDirective,
    AuiQueueItemSteerDirective,
    AuiQueueItemRemoveDirective,
    ProbeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [auiProvider]="config" auiThreadRoot>
      <aui-probe />
      <form auiComposerRoot [compact]="compact()">
        <span auiComposerQuoteText class="bare-quote-text flex"></span>
        <div *auiComposerQuote class="quote">
          <span auiComposerQuoteText class="quote-text"></span>
          <button auiComposerQuoteDismiss class="quote-dismiss">x</button>
        </div>
        <aui-composer-queue>
          <ng-template auiQueueItem>
            <div class="queue-item">
              <span auiQueueItemText class="qi-text"></span>
              <button auiQueueItemSteer class="qi-steer">steer</button>
              <button auiQueueItemRemove class="qi-remove">remove</button>
            </div>
          </ng-template>
        </aui-composer-queue>
        <input class="req" [required]="requireField()" />
        <textarea
          auiComposerInput
          [submitMode]="submitMode()"
          [submitOnEnter]="submitOnEnter()"
          [cancelOnEscape]="cancelOnEscape()"
          [addAttachmentOnPaste]="addAttachmentOnPaste()"
          [autoFocus]="true"
          [insertNewlineOnTouchEnter]="touchNewline()"
        ></textarea>
        <button auiComposerSend>send</button>
        <button auiComposerCancel class="cancel">cancel</button>
      </form>
    </div>
  `,
})
class HostComponent {
  config: AuiConfig = AuiConfig({});
  readonly submitMode = signal<'enter' | 'ctrlEnter' | 'none' | undefined>(undefined);
  readonly submitOnEnter = signal<boolean | undefined>(undefined);
  readonly requireField = signal(false);
  readonly cancelOnEscape = signal(true);
  readonly addAttachmentOnPaste = signal(true);
  readonly touchNewline = signal(false);
  readonly compact = signal(false);
}

interface Setup {
  fixture: ComponentFixture<HostComponent>;
  host: HostComponent;
  aui: AssistantClient;
  probe: ProbeComponent;
  el: HTMLElement;
  textarea: HTMLTextAreaElement;
  form: HTMLFormElement;
  settle(): Promise<void>;
}

async function setup(config: AuiConfig): Promise<Setup> {
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.config = config;
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const probe = fixture.debugElement.query(By.directive(ProbeComponent))
    .componentInstance as ProbeComponent;
  const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
  };
  await settle();
  return {
    fixture,
    host: fixture.componentInstance,
    aui: probe.aui,
    probe,
    el,
    textarea: el.querySelector('textarea')!,
    form: el.querySelector('form')!,
    settle,
  };
}

function type(t: Setup, value: string): void {
  t.textarea.value = value;
  t.textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function key(t: Setup, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    cancelable: true,
    bubbles: true,
    ...init,
  });
  t.textarea.dispatchEvent(event);
  return event;
}

describe('composer root', () => {
  it('exposes the composer type and submits through the form', async () => {
    const rt = createQueueRuntime(false);
    const t = await setup(rt.config);
    expect(t.form.getAttribute('data-aui-composer-type')).toBe('thread');
    expect(t.el.querySelector('[data-aui-thread-root]')).not.toBeNull();
    type(t, 'hi');
    await t.settle();
    const submit = new Event('submit', { cancelable: true });
    t.form.dispatchEvent(submit);
    await t.settle();
    expect(submit.defaultPrevented).toBe(true);
    expect(rt.onNew).toHaveBeenCalledTimes(1);
  });

  it('does not send on submit while sending is disabled', async () => {
    const rt = createQueueRuntime(false);
    const t = await setup(rt.config);
    t.form.dispatchEvent(new Event('submit', { cancelable: true }));
    await t.settle();
    expect(rt.onNew).not.toHaveBeenCalled();
  });

  it('focuses the input when blank form space is pressed, not an interactive child', async () => {
    const t = await setup(createQueueRuntime(false).config);
    t.textarea.blur();
    const blank = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 });
    t.form.dispatchEvent(blank);
    expect(blank.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(t.textarea);

    const onButton = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 });
    t.el.querySelector('button.cancel')!.dispatchEvent(onButton);
    expect(onButton.defaultPrevented).toBe(false);
  });

  it('renders data-compact for a single-line, empty-extras composer when compact', async () => {
    const t = await setup(createQueueRuntime(false).config);
    expect(t.form.hasAttribute('data-compact')).toBe(false);
    t.host.compact.set(true);
    await t.settle();
    expect(t.form.hasAttribute('data-compact')).toBe(true);
    type(t, 'a\nb');
    await t.settle();
    expect(t.form.hasAttribute('data-compact')).toBe(false);
  });
});

describe('composer input keyboard', () => {
  it('ctrlEnter sends on Ctrl/Cmd+Enter only', async () => {
    const rt = createQueueRuntime(false);
    const t = await setup(rt.config);
    t.host.submitMode.set('ctrlEnter');
    await t.settle();
    type(t, 'hello');
    await t.settle();

    expect(key(t, {}).defaultPrevented).toBe(false);
    expect(rt.onNew).not.toHaveBeenCalled();
    expect(key(t, { ctrlKey: true }).defaultPrevented).toBe(true);
    await t.settle();
    expect(rt.onNew).toHaveBeenCalledTimes(1);

    type(t, 'again');
    await t.settle();
    expect(key(t, { metaKey: true }).defaultPrevented).toBe(true);
    await t.settle();
    expect(rt.onNew).toHaveBeenCalledTimes(2);
  });

  it('submitMode none never sends from the keyboard', async () => {
    const rt = createQueueRuntime(false);
    const t = await setup(rt.config);
    t.host.submitMode.set('none');
    await t.settle();
    type(t, 'hello');
    await t.settle();
    expect(key(t, {}).defaultPrevented).toBe(false);
    expect(key(t, { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(rt.onNew).not.toHaveBeenCalled();
  });

  it('Shift+Enter inserts a newline instead of sending', async () => {
    const rt = createQueueRuntime(false);
    const t = await setup(rt.config);
    type(t, 'hello');
    await t.settle();
    expect(key(t, { shiftKey: true }).defaultPrevented).toBe(false);
    expect(rt.onNew).not.toHaveBeenCalled();
  });

  it('Escape cancels a running run and preventDefaults', async () => {
    const rt = createQueueRuntime(false);
    const t = await setup(rt.config);
    const idle = key(t, { key: 'Escape' });
    expect(idle.defaultPrevented).toBe(false);

    rt.setRunning(true);
    await t.settle();
    const event = key(t, { key: 'Escape' });
    expect(event.defaultPrevented).toBe(true);
    expect(rt.onCancel).toHaveBeenCalledTimes(1);
  });

  it('Escape does nothing when cancelOnEscape is false', async () => {
    const rt = createQueueRuntime(false);
    const t = await setup(rt.config);
    t.host.cancelOnEscape.set(false);
    rt.setRunning(true);
    await t.settle();
    expect(key(t, { key: 'Escape' }).defaultPrevented).toBe(false);
    expect(rt.onCancel).not.toHaveBeenCalled();
  });

  it('plain Enter inserts a newline on touch-primary devices when opted in', async () => {
    const rt = createQueueRuntime(false);
    const t = await setup(rt.config);
    t.host.touchNewline.set(true);
    await t.settle();
    type(t, 'hello');
    await t.settle();
    const original = window.matchMedia;
    window.matchMedia = ((query: string) =>
      ({
        matches: query.includes('pointer: coarse'),
      }) as MediaQueryList) as typeof window.matchMedia;
    try {
      expect(key(t, {}).defaultPrevented).toBe(false);
      expect(rt.onNew).not.toHaveBeenCalled();
    } finally {
      window.matchMedia = original;
    }
    expect(key(t, {}).defaultPrevented).toBe(true);
  });

  it('submitOnEnter=false keeps working as a deprecated alias of submitMode none', async () => {
    const rt = createQueueRuntime(false);
    const t = await setup(rt.config);
    t.host.submitOnEnter.set(false);
    await t.settle();
    type(t, 'hello');
    await t.settle();
    expect(key(t, {}).defaultPrevented).toBe(false);
    expect(rt.onNew).not.toHaveBeenCalled();

    t.host.submitOnEnter.set(true);
    await t.settle();
    expect(key(t, {}).defaultPrevented).toBe(true);
    await t.settle();
    expect(rt.onNew).toHaveBeenCalledTimes(1);

    // submitMode takes precedence over the alias.
    type(t, 'again');
    t.host.submitOnEnter.set(false);
    t.host.submitMode.set('enter');
    await t.settle();
    expect(key(t, {}).defaultPrevented).toBe(true);
    await t.settle();
    expect(rt.onNew).toHaveBeenCalledTimes(2);
  });

  it('keyboard submission goes through the form: submit handlers run and validation applies', async () => {
    const rt = createQueueRuntime(false);
    const t = await setup(rt.config);
    const submitted = vi.fn();
    t.form.addEventListener('submit', submitted);
    type(t, 'hello');
    await t.settle();

    // An invalid required field blocks the submit, so nothing is sent.
    t.host.requireField.set(true);
    await t.settle();
    key(t, {});
    await t.settle();
    expect(submitted).not.toHaveBeenCalled();
    expect(rt.onNew).not.toHaveBeenCalled();

    t.host.requireField.set(false);
    await t.settle();
    key(t, {});
    await t.settle();
    expect(submitted).toHaveBeenCalledTimes(1);
    expect(rt.onNew).toHaveBeenCalledTimes(1);
  });

  it('a submit that was already prevented does not send', async () => {
    const rt = createQueueRuntime(false);
    const t = await setup(rt.config);
    type(t, 'hello');
    await t.settle();
    t.form.addEventListener('submit', (e) => e.preventDefault(), { capture: true });
    const submit = new Event('submit', { cancelable: true });
    t.form.dispatchEvent(submit);
    await t.settle();
    expect(rt.onNew).not.toHaveBeenCalled();
    expect(t.aui.composer.getState().text).toBe('hello');
  });
});

describe('composer input paste and focus', () => {
  const pasteEvent = (files: File[]) => {
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { files } });
    return event;
  };

  it('adds pasted files as attachments when the thread accepts them', async () => {
    const tr = createTestRuntime();
    tr.withAttachments({
      accept: '*',
      add: async ({ file }) => ({
        id: file.name,
        type: 'file',
        name: file.name,
        contentType: file.type,
        file,
        status: { type: 'requires-action', reason: 'composer-send' },
      }),
      remove: async () => undefined,
      send: async (attachment) => ({ ...attachment, status: { type: 'complete' }, content: [] }),
    });
    const t = await setup(tr.config);
    const event = pasteEvent([new File(['x'], 'a.txt')]);
    t.textarea.dispatchEvent(event);
    await t.settle();
    expect(event.defaultPrevented).toBe(true);
    expect(t.aui.composer.getState().attachments.map((a) => a.name)).toEqual(['a.txt']);

    t.host.addAttachmentOnPaste.set(false);
    await t.settle();
    const ignored = pasteEvent([new File(['y'], 'b.txt')]);
    t.textarea.dispatchEvent(ignored);
    await t.settle();
    expect(ignored.defaultPrevented).toBe(false);
    expect(t.aui.composer.getState().attachments).toHaveLength(1);
  });

  it('leaves the paste alone when the thread has no attachment support', async () => {
    const t = await setup(createQueueRuntime(false).config);
    const event = pasteEvent([new File(['x'], 'a.txt')]);
    t.textarea.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('focuses on mount (autoFocus) and again on thread switch', async () => {
    const base = new InMemoryThreadListAdapter();
    const adapter = Object.assign(Object.create(base) as InMemoryThreadListAdapter, {
      list: async () => ({
        threads: [
          { status: 'regular' as const, remoteId: 'r1', title: 'One' },
          { status: 'regular' as const, remoteId: 'r2', title: 'Two' },
        ],
      }),
    });
    const t = await setup(createTestRuntime().withThreadList(adapter).config);
    await t.aui.threads.getLoadThreadsPromise();
    await t.settle();
    expect(document.activeElement).toBe(t.textarea);
    t.textarea.blur();
    expect(document.activeElement).not.toBe(t.textarea);
    const switched = vi.fn();
    t.aui.on('threads.selectionChanged', switched);
    await t.aui.threads.switchToThread('r2');
    await t.settle();
    await t.settle();
    expect(switched).toHaveBeenCalled();
    expect(document.activeElement).toBe(t.textarea);
  });

  it('focuses on run start when nothing else holds focus, not when focus is elsewhere', async () => {
    const rt = createQueueRuntime(false);
    const t = await setup(rt.config);
    t.textarea.blur();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    rt.setRunning(true);
    await t.settle();
    expect(document.activeElement).toBe(outside);
    outside.remove();

    // Nothing holds focus any more: the next run start moves it to the input.
    rt.setRunning(false);
    await t.settle();
    expect(document.activeElement).toBe(document.body);
    rt.setRunning(true);
    await t.settle();
    expect(document.activeElement).toBe(t.textarea);
  });
});

describe('composer quote', () => {
  it('renders QuoteText for a quote and Dismiss clears it', async () => {
    const t = await setup(createQueueRuntime(false).config);
    expect(t.el.querySelector('.quote')).toBeNull();
    // QuoteText outside *auiComposerQuote: upstream returns null without a quote.
    useFlexAuthorClass();
    const bare = t.el.querySelector<HTMLElement>('.bare-quote-text')!;
    expect(displayOf(bare)).toBe('none');

    flushTapSync(() => t.aui.composer.setQuote({ text: 'quoted words', messageId: 'm1' }));
    await t.settle();
    expect(t.el.querySelector('.quote-text')!.textContent).toBe('quoted words');
    expect(displayOf(bare)).toBe('flex');

    (t.el.querySelector('.quote-dismiss') as HTMLButtonElement).click();
    await t.settle();
    expect(t.aui.composer.getState().quote).toBeUndefined();
    expect(t.el.querySelector('.quote')).toBeNull();
  });
});

describe('composer queue', () => {
  const texts = (t: Setup) =>
    Array.from(t.el.querySelectorAll('.qi-text')).map((node) => node.textContent);

  async function sendWhileRunning(t: Setup, text: string) {
    flushTapSync(() => t.aui.composer.setText(text));
    flushTapSync(() => t.aui.composer.send({ steer: false }));
    await t.settle();
  }

  it('without the queue capability, sending while running is disabled', async () => {
    const rt = createQueueRuntime(false);
    const t = await setup(rt.config);
    rt.setRunning(true);
    type(t, 'later');
    await t.settle();
    expect(t.el.querySelector<HTMLButtonElement>('button[auiComposerSend]')!.disabled).toBe(true);
    expect(key(t, {}).defaultPrevented).toBe(false);
  });

  it('sending while running enqueues; Steer runs it next; Remove removes it', async () => {
    const rt = createQueueRuntime(true);
    const t = await setup(rt.config);
    expect(t.aui.thread.getState().capabilities.queue).toBe(true);

    type(t, 'first');
    await t.settle();
    expect(key(t, {}).defaultPrevented).toBe(true);
    await t.settle();
    expect(rt.dispatched).toHaveLength(1);
    expect(t.aui.thread.getState().isRunning).toBe(true);

    // With the queue capability a run in flight does not disable sending.
    await sendWhileRunning(t, 'second');
    await sendWhileRunning(t, 'third');
    expect(texts(t)).toEqual(['second', 'third']);

    await sendWhileRunning(t, 'fourth');
    expect(texts(t)).toEqual(['second', 'third', 'fourth']);

    (t.el.querySelectorAll('.qi-remove')[2] as HTMLButtonElement).click();
    await t.settle();
    expect(texts(t)).toEqual(['second', 'third']);

    // Steer moves 'third' ahead of 'second': it is what runs next.
    (t.el.querySelectorAll('.qi-steer')[1] as HTMLButtonElement).click();
    await t.settle();
    rt.finishRun();
    await t.settle();
    expect(rt.dispatched).toHaveLength(2);
    expect(JSON.stringify(rt.dispatched[1]!.content)).toContain('third');
    expect(texts(t)).toEqual(['second']);
  });

  it('Ctrl+Shift+Enter steers when the queue is supported', async () => {
    const rt = createQueueRuntime(true);
    const t = await setup(rt.config);
    type(t, 'first');
    await t.settle();
    key(t, {});
    await t.settle();
    type(t, 'urgent');
    await t.settle();
    expect(key(t, { ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(true);
    await t.settle();
    expect(rt.dispatched).toHaveLength(2);
  });
});

describe('unstable composer input helpers', () => {
  it('the input bridge reflects value, send and disabled state', async () => {
    const rt = createQueueRuntime(false);
    const t = await setup(rt.config);
    const { bridge } = t.probe;
    expect(bridge.canSend()).toBe(false);
    bridge.send();
    expect(rt.onNew).not.toHaveBeenCalled();

    bridge.setText('bridged');
    await t.settle();
    expect(bridge.value()).toBe('bridged');
    expect(bridge.canSend()).toBe(true);
    bridge.send();
    await t.settle();
    expect(rt.onNew).toHaveBeenCalledTimes(1);
    expect(bridge.value()).toBe('');
  });

  it('input history recalls sent messages with ArrowUp and restores the draft with ArrowDown', async () => {
    const tr = createTestRuntime();
    tr.append({ role: 'user', content: 'one' });
    tr.append({ role: 'assistant', content: 'reply' });
    tr.append({ role: 'user', content: 'two' });
    const t = await setup(tr.config);
    t.textarea.addEventListener('keydown', (e) => t.probe.history.onKeyDown(e));

    const up = key(t, { key: 'ArrowUp' });
    expect(up.defaultPrevented).toBe(true);
    await t.settle();
    expect(t.aui.composer.getState().text).toBe('two');
    key(t, { key: 'ArrowUp' });
    await t.settle();
    expect(t.aui.composer.getState().text).toBe('one');
    key(t, { key: 'ArrowDown' });
    await t.settle();
    expect(t.aui.composer.getState().text).toBe('two');
    key(t, { key: 'ArrowDown' });
    await t.settle();
    expect(t.aui.composer.getState().text).toBe('');
  });
});
