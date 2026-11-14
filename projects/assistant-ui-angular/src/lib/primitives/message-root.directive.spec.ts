import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { flushTapSync } from '@assistant-ui/tap';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime, type TestRuntime } from '../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { injectAuiState } from '../state/inject-aui-state';
import { AuiMessageRootDirective } from './message-root.directive';
import {
  AuiMessageTemplateDirective,
  AuiThreadMessagesComponent,
} from './thread-messages.component';

const showRoot = signal(true);

@Component({
  selector: 'aui-test-hover-row',
  standalone: true,
  imports: [AuiMessageRootDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (show()) {
      <div auiMessageRoot class="root"></div>
    }
    <span class="hovering">{{ hovering() }}</span>
  `,
})
class HoverRowComponent {
  readonly show = showRoot;
  readonly hovering = injectAuiState((s) => s.message.isHovering);
}

let current: TestRuntime;

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    HoverRowComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage><aui-test-hover-row /></ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class HostComponent {
  readonly config = current.config;
}

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
  flushTapSync(() =>
    current.append({ id: 'u1', role: 'user', content: [{ type: 'text', text: 'hi' }] }),
  );
  await settle(fixture);
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    root: () => el.querySelector<HTMLElement>('.root'),
    hovering: () => el.querySelector('.hovering')!.textContent,
  };
};

describe('AuiMessageRootDirective', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    showRoot.set(true);
  });

  it('sets data-message-id and data-role', async () => {
    const { fixture, root } = await mount();
    expect(root()!.getAttribute('data-message-id')).toBe('u1');
    expect(root()!.getAttribute('data-role')).toBe('user');
    fixture.destroy();
  });

  it('mouseenter sets isHovering', async () => {
    const { fixture, root, hovering } = await mount();
    expect(hovering()).toBe('false');

    flushTapSync(() => root()!.dispatchEvent(new MouseEvent('mouseenter')));
    await settle(fixture);
    expect(hovering()).toBe('true');

    flushTapSync(() => root()!.dispatchEvent(new MouseEvent('mouseleave')));
    await settle(fixture);
    expect(hovering()).toBe('false');
    fixture.destroy();
  });

  it('destroy resets isHovering', async () => {
    const { fixture, root, hovering } = await mount();
    flushTapSync(() => root()!.dispatchEvent(new MouseEvent('mouseenter')));
    await settle(fixture);
    expect(hovering()).toBe('true');

    flushTapSync(() => {
      showRoot.set(false);
      fixture.detectChanges();
    });
    await settle(fixture);
    expect(root()).toBeNull();
    expect(hovering()).toBe('false');
    fixture.destroy();
  });
});
