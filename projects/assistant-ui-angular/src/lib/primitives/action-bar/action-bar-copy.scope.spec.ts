import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ExternalThread } from '@assistant-ui/core/store';
import {
  AuiConfig,
  createAssistantClient,
  createClientFacade,
  type AssistantClientHandle,
} from '@assistant-ui/store/client';
import { flushTapSync } from '@assistant-ui/tap';
import { describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../../testing-internal/test-bed';
import { AUI_CONTEXT, type AuiContext } from '../../context/aui-context';
import { messageScopeConfig } from '../../scope/message-scope';
import { AuiActionBarCopyDirective } from './action-bar-copy.directive';
import { AUI_CLIPBOARD } from './clipboard';

/**
 * Store-native clients (ExternalThread): the message has no
 * `__internal_getRuntime`, so identity must come from the client itself.
 */
const messages = [
  { id: 'u1', role: 'user' },
  { id: 'a1', role: 'assistant' },
].map(({ id, role }) => ({
  id,
  role,
  content: [{ type: 'text', text: `text ${id}` }],
  createdAt: new Date(0),
  status: { type: 'complete', reason: 'stop' },
  attachments: [],
  metadata: {
    unstable_state: null,
    unstable_annotations: [],
    unstable_data: [],
    steps: [],
    custom: {},
  },
})) as never;

const makeInstance = (withMessage = true): AssistantClientHandle => {
  const root = createAssistantClient({
    getConfig: () =>
      AuiConfig({ thread: ExternalThread({ messages: withMessage ? messages : [] }) }),
    subscribe: () => () => undefined,
  });
  root.subscribe(() => undefined);
  const child = createAssistantClient(
    {
      getConfig: () =>
        withMessage ? messageScopeConfig(root.getClient(), 'a1', () => true) : AuiConfig({}),
      subscribe: () => () => undefined,
    },
    { parent: root },
  );
  child.subscribe(() => undefined);
  return child;
};

let context: AuiContext;
let writer: () => void | Promise<void>;

@Component({
  standalone: true,
  imports: [AuiActionBarCopyDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: AUI_CONTEXT, useFactory: () => context },
    { provide: AUI_CLIPBOARD, useFactory: () => () => writer() },
  ],
  template: `<button auiActionBarCopy class="copy">copy</button>`,
})
class HostComponent {}

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await Promise.resolve();
  }
};

const setup = (secondHasMessage = true) => {
  const first = makeInstance();
  const second = makeInstance(secondHasMessage);
  let active = first;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  for (const handle of [first, second]) handle.subscribe(notify);
  const source = {
    getClient: () => active.getClient(),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  context = { source, aui: createClientFacade(source) };
  const use = (handle: AssistantClientHandle) => {
    active = handle;
    flushTapSync(notify);
  };
  return { first, second, use };
};

const copied = (handle: AssistantClientHandle) => handle.getClient().message.getState().isCopied;

describe('AuiActionBarCopyDirective with store-native clients', () => {
  it('has no runtime getter to lean on', () => {
    const { first } = setup();
    expect(first.getClient().message().__internal_getRuntime).toBeUndefined();
  });

  it('resets when a different client with the same id is bound', async () => {
    writer = async () => undefined;
    const { first, second, use } = setup();
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    flushTapSync(() => button.click());
    await new Promise((r) => setTimeout(r, 10));
    await settle(fixture);
    expect(copied(first)).toBe(true);

    use(second);
    await settle(fixture);
    // The original client's flag is cleared (no timer is left to do it later).
    expect(copied(first)).toBe(false);
    fixture.destroy();
  });

  it('clears the old flag when it is switched to a client that lacks the message', async () => {
    writer = async () => undefined;
    const { first, second, use } = setup(false);
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    flushTapSync(() => button.click());
    await new Promise((r) => setTimeout(r, 10));
    await settle(fixture);
    expect(copied(first)).toBe(true);

    use(second);
    fixture.destroy();
    await new Promise((r) => setTimeout(r, 10));
    // Switched away from, not deleted: the retained original must not keep the flag.
    expect(copied(first)).toBe(false);
  });

  it('drops a pending write that completes after an A, B, A round trip', async () => {
    let finish!: () => void;
    writer = () => new Promise<void>((resolve) => (finish = resolve));
    const { first, second, use } = setup();
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    flushTapSync(() => button.click());
    use(second);
    use(first);
    finish();
    await new Promise((r) => setTimeout(r, 10));
    await settle(fixture);
    expect(copied(first)).toBe(false);
    expect(copied(second)).toBe(false);
    fixture.destroy();
  });

  it('keeps the flag while the same client keeps being bound', async () => {
    writer = async () => undefined;
    const { first, use } = setup();
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    flushTapSync(() => button.click());
    await new Promise((r) => setTimeout(r, 10));
    use(first);
    await settle(fixture);
    expect(copied(first)).toBe(true);
    vi.useRealTimers();
    fixture.destroy();
  });
});
