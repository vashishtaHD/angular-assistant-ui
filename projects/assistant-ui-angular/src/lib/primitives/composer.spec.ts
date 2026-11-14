// Ported from packages/svelte/src/__tests__/primitives-composer.test.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { AssistantClient } from '@assistant-ui/store/client';
import { flushTapSync } from '@assistant-ui/tap';
import type { ExternalStoreAdapter } from '@assistant-ui/core';
import { AssistantRuntimeImpl, ExternalStoreRuntimeCore } from '@assistant-ui/core/internal';
import { RuntimeAdapter } from '@assistant-ui/core/store';
import { AuiConfig } from '@assistant-ui/store/client';
import { describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { injectAui } from '../state/inject-aui';
import { AuiComposerCancelDirective } from './composer-cancel.directive';
import { AuiComposerInputDirective } from './composer-input.directive';
import { AuiComposerRootDirective } from './composer-root.directive';
import { AuiComposerSendDirective } from './composer-send.directive';

/** Like `createTestRuntime`, plus `onNew` / `onCancel` spies (cancel needs `onCancel`). */
function createSpyRuntime() {
  const onNew = vi.fn(async () => undefined);
  const onCancel = vi.fn(async () => undefined);
  let isRunning = false;
  const make = (): ExternalStoreAdapter<{ role: 'user'; content: string }> => ({
    messages: [],
    isRunning,
    convertMessage: (m) => m,
    onNew,
    onCancel,
  });
  const core = new ExternalStoreRuntimeCore(make());
  const runtime = new AssistantRuntimeImpl(core);
  return {
    onNew,
    onCancel,
    config: AuiConfig({ threads: RuntimeAdapter(runtime) }),
    setRunning(value: boolean) {
      isRunning = value;
      core.setAdapter(make());
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
}

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiComposerRootDirective,
    AuiComposerInputDirective,
    AuiComposerSendDirective,
    AuiComposerCancelDirective,
    ProbeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [auiProvider]="config">
      <aui-probe />
      <form auiComposerRoot>
        <textarea
          auiComposerInput
          [submitOnEnter]="submitOnEnter()"
          [disabled]="inputDisabled()"
          [maxRows]="3"
        ></textarea>
        <button auiComposerSend [disabled]="sendDisabled()">send</button>
        <button auiComposerCancel type="button" class="cancel">cancel</button>
      </form>
    </div>
  `,
})
class HostComponent {
  readonly rt = createSpyRuntime();
  readonly config = this.rt.config;
  readonly submitOnEnter = signal(true);
  readonly inputDisabled = signal(false);
  readonly sendDisabled = signal(false);
}

interface Setup {
  fixture: ComponentFixture<HostComponent>;
  host: HostComponent;
  aui: AssistantClient;
  textarea: HTMLTextAreaElement;
  send: HTMLButtonElement;
  cancel: HTMLButtonElement;
  form: HTMLFormElement;
  settle(): Promise<void>;
}

async function setup(): Promise<Setup> {
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const { aui } = fixture.debugElement.query(By.directive(ProbeComponent))
    .componentInstance as ProbeComponent;
  return {
    fixture,
    host: fixture.componentInstance,
    aui,
    textarea: el.querySelector('textarea')!,
    send: el.querySelector('button[auiComposerSend]')!,
    cancel: el.querySelector('.cancel')!,
    form: el.querySelector('form')!,
    settle: async () => {
      // Let the store's async updates flush, then render.
      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();
      await fixture.whenStable();
    },
  };
}

function type(t: Setup, value: string): void {
  t.textarea.value = value;
  t.textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function keydown(t: Setup, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, ...init });
  t.textarea.dispatchEvent(event);
  return event;
}

describe('composer primitives', () => {
  it('typing updates composer text', async () => {
    const t = await setup();
    type(t, 'hello');
    expect(t.aui.composer.getState().text).toBe('hello');
    await t.settle();
    expect(t.textarea.value).toBe('hello');
  });

  it('Enter sends and clears; Shift+Enter does not send', async () => {
    const t = await setup();
    type(t, 'hello');
    await t.settle();

    expect(keydown(t, { shiftKey: true }).defaultPrevented).toBe(false);
    expect(t.aui.composer.getState().text).toBe('hello');

    expect(keydown(t, {}).defaultPrevented).toBe(true);
    await t.settle();
    expect(t.host.rt.onNew).toHaveBeenCalledTimes(1);
    expect(t.aui.composer.getState().text).toBe('');
    expect(t.textarea.value).toBe('');

    // Empty draft cannot send, so Enter falls through to a newline.
    expect(keydown(t, {}).defaultPrevented).toBe(false);
  });

  it('does not send when submitOnEnter is false', async () => {
    const t = await setup();
    t.host.submitOnEnter.set(false);
    await t.settle();
    type(t, 'hello');
    expect(keydown(t, {}).defaultPrevented).toBe(false);
    expect(t.aui.composer.getState().text).toBe('hello');
  });

  it('ignores Enter during IME composition', async () => {
    const t = await setup();
    type(t, 'hello');
    await t.settle();

    expect(keydown(t, { isComposing: true }).defaultPrevented).toBe(false);
    expect(keydown(t, { keyCode: 229 }).defaultPrevented).toBe(false);
    await t.settle();
    expect(t.aui.composer.getState().text).toBe('hello');
    expect(t.host.rt.onNew).not.toHaveBeenCalled();
  });

  it('does not send while running', async () => {
    const t = await setup();
    type(t, 'hello');
    t.host.rt.setRunning(true);
    await t.settle();

    expect(t.send.disabled).toBe(true);
    expect(keydown(t, {}).defaultPrevented).toBe(false);
    t.send.click();
    await t.settle();
    expect(t.aui.composer.getState().text).toBe('hello');
    expect(t.host.rt.onNew).not.toHaveBeenCalled();
  });

  it('send button disabled for empty text', async () => {
    const t = await setup();
    expect(t.send.disabled).toBe(true);
    expect(t.send.type).toBe('button');
    type(t, 'hello');
    await t.settle();
    expect(t.send.disabled).toBe(false);
    t.send.click();
    await t.settle();
    expect(t.aui.composer.getState().text).toBe('');
    expect(t.send.disabled).toBe(true);
  });

  it('respects the consumer disabled attribute', async () => {
    const t = await setup();
    type(t, 'hello');
    t.host.sendDisabled.set(true);
    t.host.inputDisabled.set(true);
    await t.settle();

    expect(t.send.disabled).toBe(true);
    expect(t.textarea.disabled).toBe(true);
    t.send.click();
    expect(keydown(t, {}).defaultPrevented).toBe(false);
    expect(t.aui.composer.getState().text).toBe('hello');
  });

  it('cancel enabled only while running and calls cancel', async () => {
    const t = await setup();
    expect(t.cancel.disabled).toBe(true);
    t.host.rt.setRunning(true);
    await t.settle();
    expect(t.cancel.disabled).toBe(false);

    t.cancel.click();
    await t.settle();
    expect(t.host.rt.onCancel).toHaveBeenCalledTimes(1);
    t.host.rt.setRunning(false);
    await t.settle();
    expect(t.cancel.disabled).toBe(true);
  });

  it('form submit sends', async () => {
    const t = await setup();
    type(t, 'hello');
    await t.settle();
    const submit = new Event('submit', { cancelable: true });
    t.form.dispatchEvent(submit);
    await t.settle();
    expect(submit.defaultPrevented).toBe(true);
    expect(t.aui.composer.getState().text).toBe('');
  });

  it('defaults to one row and sizes the height from scrollHeight', async () => {
    const t = await setup();
    expect(t.textarea.getAttribute('rows')).toBe('1');
    Object.defineProperty(t.textarea, 'scrollHeight', { configurable: true, value: 40 });
    type(t, 'a\nb');
    expect(t.textarea.style.height).toMatch(/^\d+(\.\d+)?px$/);
    expect(parseFloat(t.textarea.style.height)).toBeLessThanOrEqual(40);
    flushTapSync(() => t.aui.composer.setText('x'));
    await t.settle();
    expect(t.textarea.style.height).toMatch(/px$/);
  });

  function countMeasurements(t: Setup): { count: () => number } {
    let n = 0;
    Object.defineProperty(t.textarea, 'scrollHeight', {
      configurable: true,
      get: () => ++n,
    });
    return { count: () => n };
  }

  it('does not re-measure on store notifications that leave the text unchanged', async () => {
    const t = await setup();
    type(t, 'hello');
    await t.settle();
    const m = countMeasurements(t);

    t.host.rt.setRunning(true);
    await t.settle();
    t.host.rt.setRunning(false);
    await t.settle();
    expect(m.count()).toBe(0);
  });

  it('measures once for several text changes in one tick', async () => {
    const t = await setup();
    await t.settle();
    const m = countMeasurements(t);

    flushTapSync(() => t.aui.composer.setText('a'));
    flushTapSync(() => t.aui.composer.setText('ab'));
    flushTapSync(() => t.aui.composer.setText('abc'));
    await t.settle();
    expect(m.count()).toBe(1);
  });

  it('measures the initial value once after first render', async () => {
    let n = 0;
    const proto = HTMLTextAreaElement.prototype;
    Object.defineProperty(proto, 'scrollHeight', { configurable: true, get: () => ++n });
    try {
      const t = await setup();
      await t.settle();
      expect(n).toBe(1);
    } finally {
      delete (proto as { scrollHeight?: number }).scrollHeight;
    }
  });
});
