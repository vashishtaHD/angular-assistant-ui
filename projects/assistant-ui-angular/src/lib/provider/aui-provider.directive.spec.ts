// Ported from packages/vue/src/__tests__/AuiProvider.test.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { ChangeDetectionStrategy, Component, signal, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { flushTapSync } from '@assistant-ui/tap';
import type { AssistantClient } from '@assistant-ui/store/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import {
  MessageClient,
  ThreadClient,
  asFixture,
  fixtureConfig,
  messageDerived,
  trackers,
  type FixtureClient,
} from '../../testing-internal/fixtures';
import { injectAui } from '../state/inject-aui';
import { AuiProviderDirective } from './aui-provider.directive';

@Component({
  selector: 'aui-probe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class ProbeComponent {
  readonly aui = injectAui();
}

const mount = <T>(host: Type<T>): ComponentFixture<T> => {
  configureTestBed({ imports: [host] });
  const fixture = TestBed.createComponent(host);
  fixture.detectChanges();
  return fixture;
};

const probeAui = (fixture: ComponentFixture<unknown>): FixtureClient =>
  asFixture(
    (fixture.debugElement.query(By.directive(ProbeComponent)).componentInstance as ProbeComponent)
      .aui,
  );

describe('AuiProviderDirective', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('provides a client built from the config', () => {
    @Component({
      standalone: true,
      imports: [AuiProviderDirective, ProbeComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<ng-container [auiProvider]="config"><aui-probe /></ng-container>`,
    })
    class HostComponent {
      readonly config = fixtureConfig({ thread: ThreadClient() });
    }
    const fixture = mount(HostComponent);
    const aui = probeAui(fixture);

    expect(aui.thread.getState()).toEqual({ selected: 0 });

    flushTapSync(() => aui.thread.setSelected(1));
    expect(aui.thread.getState()).toEqual({ selected: 1 });

    fixture.destroy();
  });

  it('keeps the facade stable across structural changes', () => {
    @Component({
      standalone: true,
      imports: [AuiProviderDirective, ProbeComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<div [auiProvider]="config"><aui-probe /></div>`,
    })
    class HostComponent {
      readonly config = fixtureConfig({ thread: ThreadClient(), message: messageDerived() });
    }
    const fixture = mount(HostComponent);
    const aui = probeAui(fixture);
    expect(aui.message.getState().id).toBe('m0');

    flushTapSync(() => aui.thread.setSelected(1));

    expect(probeAui(fixture)).toBe(aui);
    expect(aui.message.getState().id).toBe('m1');

    fixture.destroy();
  });

  it('extends the parent provider client with an explicit extends', () => {
    @Component({
      selector: 'aui-nested',
      standalone: true,
      imports: [AuiProviderDirective, ProbeComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<div [auiProvider]="config" [auiProviderExtends]="aui"><aui-probe /></div>`,
    })
    class NestedComponent {
      readonly aui = injectAui();
      readonly config = fixtureConfig({ message: messageDerived() });
    }
    @Component({
      standalone: true,
      imports: [AuiProviderDirective, NestedComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<div [auiProvider]="config"><aui-nested /></div>`,
    })
    class HostComponent {
      readonly config = fixtureConfig({ thread: ThreadClient() });
    }
    const fixture = mount(HostComponent);
    const aui = probeAui(fixture);

    expect(aui.message.getState().id).toBe('m0');
    expect(aui.thread.getState()).toEqual({ selected: 0 });

    flushTapSync(() => aui.thread.setSelected(1));
    expect(aui.message.getState().id).toBe('m1');

    fixture.destroy();
  });

  it('throws in dev when nested without an explicit extends', () => {
    @Component({
      selector: 'aui-nested',
      standalone: true,
      imports: [AuiProviderDirective],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<div [auiProvider]="config"></div>`,
    })
    class NestedComponent {
      readonly config = fixtureConfig({ message: messageDerived() });
    }
    @Component({
      standalone: true,
      imports: [AuiProviderDirective, NestedComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<div [auiProvider]="config"><aui-nested /></div>`,
    })
    class HostComponent {
      readonly config = fixtureConfig({ thread: ThreadClient() });
    }
    // Angular also reports the error to the console before rethrowing it.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);

    expect(() => fixture.detectChanges()).toThrow(
      'A parent AuiProvider exists. Pass [auiProviderExtends]="aui" to inherit it or [auiProviderExtends]="null" to isolate.',
    );
  });

  it('isolates from the parent with extends null', () => {
    @Component({
      selector: 'aui-isolated',
      standalone: true,
      imports: [AuiProviderDirective, ProbeComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<div [auiProvider]="config" [auiProviderExtends]="null"><aui-probe /></div>`,
    })
    class IsolatedComponent {
      readonly config = fixtureConfig({ message: MessageClient({ id: 'iso' }) });
    }
    @Component({
      standalone: true,
      imports: [AuiProviderDirective, IsolatedComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<div [auiProvider]="config"><aui-isolated /></div>`,
    })
    class HostComponent {
      readonly config = fixtureConfig({ thread: ThreadClient() });
    }
    const fixture = mount(HostComponent);
    const aui = probeAui(fixture);

    expect(aui.message.getState()).toEqual({ id: 'iso', text: '' });
    expect(() => aui.thread.getState()).toThrow(
      'The current scope does not have a "thread" property.',
    );

    fixture.destroy();
  });

  it('applies config changes in place, keeping scope state', async () => {
    @Component({
      standalone: true,
      imports: [AuiProviderDirective, ProbeComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<div [auiProvider]="config()"><aui-probe /></div>`,
    })
    class HostComponent {
      readonly config = signal(fixtureConfig({ message: MessageClient({ id: 'm0' }) }));
    }
    const fixture = mount(HostComponent);
    const aui = probeAui(fixture);
    const setConfig = (input: Record<string, unknown>) => {
      fixture.componentInstance.config.set(fixtureConfig(input));
      fixture.detectChanges();
    };

    flushTapSync(() => aui.message.setText('draft'));
    expect(aui.message.getState()).toEqual({ id: 'm0', text: 'draft' });

    setConfig({ message: MessageClient({ id: 'm1' }) });
    await vi.waitFor(() => {
      expect(aui.message.getState()).toEqual({ id: 'm1', text: 'draft' });
    });

    setConfig({ message: MessageClient({ id: 'm1' }), thread: ThreadClient() });
    await vi.waitFor(() => {
      expect(aui.thread.getState()).toEqual({ selected: 0 });
    });
    expect(aui.message.getState()).toEqual({ id: 'm1', text: 'draft' });

    setConfig({ message: MessageClient({ id: 'm1' }) });
    await vi.waitFor(() => {
      expect(() => aui.thread.getState()).toThrow(
        'The current scope does not have a "thread" property.',
      );
    });

    fixture.destroy();
  });

  it('releases the client on destroy, soft unmounting its scopes', async () => {
    @Component({
      standalone: true,
      imports: [AuiProviderDirective, ProbeComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<div [auiProvider]="config"><aui-probe /></div>`,
    })
    class HostComponent {
      readonly config = fixtureConfig({ thread: ThreadClient() });
    }
    const before = trackers.threadCleanups;
    const fixture = mount(HostComponent);
    // Mount the scopes by reading through the client.
    probeAui(fixture).thread.getState();

    const afterMount = trackers.threadCleanups;
    fixture.destroy();
    await vi.waitFor(() => expect(trackers.threadCleanups).toBe(afterMount + 1));
    expect(afterMount).toBeGreaterThanOrEqual(before);
  });

  it('returns the throwing default client outside a provider', () => {
    configureTestBed({ imports: [ProbeComponent] });
    const fixture = TestBed.createComponent(ProbeComponent);
    const aui: AssistantClient = fixture.componentInstance.aui;

    expect(() => asFixture(aui).thread.getState()).toThrow(
      'Wrap your component in an <AuiProvider> component.',
    );

    fixture.destroy();
  });
});
