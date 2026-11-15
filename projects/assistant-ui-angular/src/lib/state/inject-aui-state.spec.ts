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

  describe('when a read inside a computed makes the store notify (a pull-time sync)', () => {
    // A context whose `getClient()` notifies every subscriber synchronously the
    // first time it is called after `arm()`, as the store does when a scope's
    // parent snapshot moved on before it re-rendered.
    const syncingContext = () => {
      const runtime = createTestRuntime();
      const listeners = new Set<() => void>();
      let armed = false;
      const inner = createAuiContext({
        getConfig: () => runtime.config,
        subscribe: () => () => undefined,
      });
      const context: AuiContext = {
        aui: inner.context.aui,
        source: {
          getClient: () => {
            if (armed) {
              armed = false;
              for (const listener of [...listeners]) listener();
            }
            return inner.context.source.getClient();
          },
          subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
        },
      };
      return {
        runtime,
        context,
        listeners,
        arm: () => (armed = true),
        release: inner.release,
      };
    };

    @Component({
      selector: 'aui-two-counts',
      standalone: true,
      imports: [CountComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<aui-count class="a" /><aui-count class="b" />`,
    })
    class TwoCountsComponent {}

    it('allows the notification, and every reader shows the new state in the same pass', () => {
      const harness = syncingContext();
      const errorSpy = vi.spyOn(console, 'error');
      configureTestBed({
        imports: [TwoCountsComponent],
        providers: [{ provide: AUI_CONTEXT, useValue: harness.context }],
      });
      const fixture = TestBed.createComponent(TwoCountsComponent);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const counts = () =>
        [el.querySelector('.a'), el.querySelector('.b')].map((c) => c?.textContent?.trim());
      expect(counts()).toEqual(['0', '0']);

      // The store changes without telling the context's subscribers; only the
      // second reader (checked after the first) is told. Its re-read syncs and
      // notifies everyone, including the first reader, which this pass has
      // already checked and must refresh again.
      flushTapSync(() => harness.runtime.append(userMessage('hi')));
      harness.arm();
      [...harness.listeners][1]!();

      expect(() => fixture.detectChanges()).not.toThrow();
      expect(counts()).toEqual(['1', '1']);
      expect(errorSpy).not.toHaveBeenCalled();

      fixture.destroy();
      harness.release();
    });
  });

  it('asserts an injection context', () => {
    expect(() => injectAuiState((s) => fixtureState(s).thread.selected)).toThrow(/NG0203/);
  });
});
