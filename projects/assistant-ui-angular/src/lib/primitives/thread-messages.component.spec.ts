// Ported from packages/vue/src/__tests__/primitives-keyed-messages.test.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// and packages/vue/src/__tests__/byindex-shrink-race.test.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { flushTapSync } from '@assistant-ui/tap';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import {
  createTestRuntime,
  type DemoMessage,
  type TestRuntime,
} from '../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { injectAuiState } from '../state/inject-aui-state';
import { AuiMessageRootDirective } from './message-root.directive';
import {
  AuiMessageTemplateDirective,
  AuiThreadMessagesComponent,
} from './thread-messages.component';

const counters = { mounts: 0, unmounts: 0 };

@Component({
  selector: 'aui-test-row',
  standalone: true,
  imports: [AuiMessageRootDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div auiMessageRoot class="row">{{ text() }}</div>`,
})
class RowComponent {
  readonly text = injectAuiState((s) =>
    s.message.content.map((part) => (part.type === 'text' ? part.text : '')).join(''),
  );

  constructor() {
    counters.mounts++;
    inject(DestroyRef).onDestroy(() => counters.unmounts++);
  }
}

// The runtime the next mounted host binds to (set by `mount`).
let current: TestRuntime;

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    RowComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage><aui-test-row /></ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class HostComponent {
  readonly config = current.config;
}

const message = (id: string, role: DemoMessage['role'], text: string): DemoMessage => ({
  id,
  role,
  content: [{ type: 'text', text }],
});

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await Promise.resolve();
  }
};

const mount = async () => {
  current = createTestRuntime();
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  await settle(fixture);
  return { fixture, rt: current };
};

const rows = (fixture: ComponentFixture<unknown>): HTMLElement[] =>
  Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[auiMessageRoot]'));

describe('AuiThreadMessagesComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    counters.mounts = 0;
    counters.unmounts = 0;
  });

  it('renders one row per message in order with role', async () => {
    const { fixture, rt } = await mount();
    flushTapSync(() => rt.append(message('u1', 'user', 'hi')));
    flushTapSync(() => rt.append(message('a1', 'assistant', 'yo')));
    await settle(fixture);

    const els = rows(fixture);
    expect(els).toHaveLength(2);
    expect(els.map((el) => el.getAttribute('data-role'))).toEqual(['user', 'assistant']);
    expect(els.map((el) => el.getAttribute('data-message-id'))).toEqual(['u1', 'a1']);
    expect(els.map((el) => el.textContent)).toEqual(['hi', 'yo']);
    fixture.destroy();
  });

  it('keeps row element identity across updates', async () => {
    const { fixture, rt } = await mount();
    flushTapSync(() =>
      rt.setMessages([message('u1', 'user', 'hi'), message('a1', 'assistant', 'y')]),
    );
    await settle(fixture);
    const first = rows(fixture)[0];
    const second = rows(fixture)[1];
    expect(counters.mounts).toBe(2);

    flushTapSync(() =>
      rt.setMessages([
        message('u1', 'user', 'hi'),
        message('a1', 'assistant', 'yo, streaming'),
        message('u2', 'user', 'third'),
      ]),
    );
    await settle(fixture);

    const els = rows(fixture);
    expect(els).toHaveLength(3);
    expect(els[0]).toBe(first);
    expect(els[1]).toBe(second);
    expect(els[1]!.textContent).toBe('yo, streaming');
    expect(counters.mounts).toBe(3);
    expect(counters.unmounts).toBe(0);
    fixture.destroy();
  });

  it('remounts a row when the occupant of its slot changes identity', async () => {
    const { fixture, rt } = await mount();
    flushTapSync(() =>
      rt.setMessages([message('u0', 'user', 'kept'), message('u1', 'user', 'hello')]),
    );
    await settle(fixture);
    const kept = rows(fixture)[0];
    flushTapSync(() =>
      rt.setMessages([message('u0', 'user', 'kept'), message('u2', 'user', 'replaced occupant')]),
    );
    await settle(fixture);

    const els = rows(fixture);
    expect(els).toHaveLength(2);
    expect(els[0]).toBe(kept);
    expect(els[1]!.getAttribute('data-message-id')).toBe('u2');
    expect(els[1]!.textContent).toBe('replaced occupant');
    expect(counters.mounts).toBe(3);
    expect(counters.unmounts).toBe(1);
    fixture.destroy();
  });

  it('keeps sibling row instances when a middle message is deleted', async () => {
    const { fixture, rt } = await mount();
    flushTapSync(() =>
      rt.setMessages([
        message('a', 'user', 'first'),
        message('b', 'assistant', 'second'),
        message('c', 'user', 'third'),
      ]),
    );
    await settle(fixture);
    const rowOfC = rows(fixture)[2];

    flushTapSync(() =>
      rt.setMessages([message('a', 'user', 'first'), message('c', 'user', 'third')]),
    );
    await settle(fixture);
    const els = rows(fixture);
    expect(els.map((el) => el.getAttribute('data-message-id'))).toEqual(['a', 'c']);
    expect(els[1]).toBe(rowOfC);
    fixture.destroy();
  });

  it('drops the row when its message is removed', async () => {
    const { fixture, rt } = await mount();
    flushTapSync(() =>
      rt.setMessages([
        message('u1', 'user', 'one'),
        message('a1', 'assistant', 'two'),
        message('u2', 'user', 'three'),
        message('a2', 'assistant', 'four'),
      ]),
    );
    await settle(fixture);
    expect(rows(fixture)).toHaveLength(4);

    const error = vi.spyOn(console, 'error');
    const warn = vi.spyOn(console, 'warn');
    flushTapSync(() =>
      rt.setMessages([message('u1', 'user', 'one'), message('a1', 'assistant', 'two')]),
    );
    await settle(fixture);
    expect(rows(fixture)).toHaveLength(2);

    flushTapSync(() => rt.setMessages([]));
    await settle(fixture);
    await new Promise((resolve) => setTimeout(resolve));
    expect(rows(fixture)).toHaveLength(0);
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    fixture.destroy();
  });
});
