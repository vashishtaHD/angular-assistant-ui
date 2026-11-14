// Ported from packages/vue/src/__tests__/useAuiState.test.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { ChangeDetectionStrategy, Component, NgZone, computed, type Signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { flushTapSync } from '@assistant-ui/tap';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUI_CONTEXT, type AuiContext } from '../context/aui-context';
import { createAuiContext } from '../context/create-aui-context';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { configureTestBed, isZonelessTestRun } from '../../testing-internal/test-bed';
import {
  ThreadClient,
  asFixture,
  fixtureConfig,
  fixtureState,
  messageDerived,
  type FixtureClient,
} from '../../testing-internal/fixtures';
import { createTestRuntime } from '../../testing-internal/test-runtime';
import { injectAui } from './inject-aui';
import { injectAuiState } from './inject-aui-state';

const userMessage = (text: string) => ({
  role: 'user' as const,
  content: [{ type: 'text' as const, text }],
});

@Component({
  selector: 'aui-count',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span>{{ count() }}</span>`,
})
class CountComponent {
  readonly count = injectAuiState((s) => s.thread.messages.length);
}

const mountChat = () => {
  const runtime = createTestRuntime();
  @Component({
    standalone: true,
    imports: [AuiProviderDirective, CountComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<div [auiProvider]="config"><aui-count /></div>`,
  })
  class ChatHostComponent {
    readonly config = runtime.config;
  }
  configureTestBed({ imports: [ChatHostComponent] });
  const fixture = TestBed.createComponent(ChatHostComponent);
  const text = () => (fixture.nativeElement as HTMLElement).textContent?.trim();
  return { fixture, runtime, text };
};

/** Mounts `setup` inside a component under a fixture-scope provider. */
const mountWithProvider = (setup: () => void) => {
  @Component({
    selector: 'aui-probe',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: '',
  })
  class ProbeComponent {
    constructor() {
      setup();
    }
  }
  @Component({
    standalone: true,
    imports: [AuiProviderDirective, ProbeComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<div [auiProvider]="config"><aui-probe /></div>`,
  })
  class HostComponent {
    readonly config = fixtureConfig({ thread: ThreadClient(), message: messageDerived() });
  }
  configureTestBed({ imports: [HostComponent] });
  const fixture: ComponentFixture<HostComponent> = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return { fixture };
};

describe('injectAuiState', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders selected state and updates on store change', async () => {
    const { fixture, runtime, text } = mountChat();
    fixture.detectChanges();
    expect(text()).toBe('0');

    flushTapSync(() => runtime.append(userMessage('hi')));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(text()).toBe('1');

    fixture.destroy();
  });

  it.skipIf(isZonelessTestRun())(
    'updates when the store changes outside the Angular zone',
    async () => {
      const { fixture, runtime, text } = mountChat();
      fixture.autoDetectChanges();
      await fixture.whenStable();
      expect(text()).toBe('0');

      TestBed.inject(NgZone).runOutsideAngular(() => {
        flushTapSync(() => runtime.append(userMessage('hi')));
      });
      await fixture.whenStable();
      expect(text()).toBe('1');

      fixture.destroy();
    },
  );

  it('selects state and updates when the store notifies', () => {
    let aui!: FixtureClient;
    let selected!: Signal<number>;
    const { fixture } = mountWithProvider(() => {
      aui = asFixture(injectAui());
      selected = injectAuiState((s) => fixtureState(s).thread.selected);
    });

    expect(selected()).toBe(0);

    flushTapSync(() => aui.thread.setSelected(1));
    expect(selected()).toBe(1);

    fixture.destroy();
  });

  it('updates through the real scheduler without a manual flush', async () => {
    let aui!: FixtureClient;
    let selected!: Signal<number>;
    const { fixture } = mountWithProvider(() => {
      aui = asFixture(injectAui());
      selected = injectAuiState((s) => fixtureState(s).thread.selected);
    });

    aui.thread.setSelected(1);
    await vi.waitFor(() => {
      expect(selected()).toBe(1);
    });

    fixture.destroy();
  });

  it('notifies dependents only when the slice changes by Object.is', () => {
    let aui!: FixtureClient;
    let id!: Signal<string>;
    const { fixture } = mountWithProvider(() => {
      aui = asFixture(injectAui());
      id = injectAuiState((s) => fixtureState(s).message.id);
    });
    let runs = 0;
    const dependent = computed(() => {
      runs++;
      return id();
    });
    expect(dependent()).toBe('m0');
    expect(runs).toBe(1);

    flushTapSync(() => aui.thread.message({ index: 0 }).setText('hello'));
    expect(dependent()).toBe('m0');
    expect(runs).toBe(1);

    flushTapSync(() => aui.thread.setSelected(1));
    expect(dependent()).toBe('m1');
    expect(runs).toBe(2);

    fixture.destroy();
  });

  it('throws when selecting the whole state', () => {
    let state!: Signal<unknown>;
    const { fixture } = mountWithProvider(() => {
      state = injectAuiState((s) => s);
    });

    expect(() => state()).toThrow(
      'You tried to return the entire AssistantState. This is not supported due to technical limitations.',
    );

    fixture.destroy();
  });

  it('resolves unavailable scopes to undefined via optional', () => {
    let missing!: Signal<unknown>;
    const { fixture } = mountWithProvider(() => {
      missing = injectAuiState((s) => fixtureState(s).optional['missing']);
    });

    expect(missing()).toBeUndefined();

    fixture.destroy();
  });

  it('releases subscription on destroy', () => {
    const runtime = createTestRuntime();
    const { context, release } = createAuiContext({
      getConfig: () => runtime.config,
      subscribe: () => () => undefined,
    });
    const unsubscribe = vi.fn();
    const subscribe = context.source.subscribe.bind(context.source);
    const spiedContext: AuiContext = {
      aui: context.aui,
      source: {
        getClient: () => context.source.getClient(),
        subscribe: (listener) => {
          const off = subscribe(listener);
          return () => {
            unsubscribe();
            off();
          };
        },
      },
    };
    const errorSpy = vi.spyOn(console, 'error');

    configureTestBed({
      imports: [CountComponent],
      providers: [{ provide: AUI_CONTEXT, useValue: spiedContext }],
    });
    const fixture = TestBed.createComponent(CountComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('0');

    fixture.destroy();
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    expect(() => flushTapSync(() => runtime.append(userMessage('late')))).not.toThrow();
    expect(errorSpy).not.toHaveBeenCalled();

    release();
  });

  it('asserts an injection context', () => {
    expect(() => injectAuiState((s) => fixtureState(s).thread.selected)).toThrow(/NG0203/);
  });
});
