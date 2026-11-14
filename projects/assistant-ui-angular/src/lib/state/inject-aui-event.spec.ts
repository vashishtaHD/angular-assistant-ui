// Ported from packages/vue/src/__tests__/useAuiEvent.test.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { flushTapSync } from '@assistant-ui/tap';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { configureTestBed } from '../../testing-internal/test-bed';
import {
  ThreadClient,
  asFixture,
  fixtureConfig,
  flushEvents,
  messageDerived,
  type FixtureClient,
} from '../../testing-internal/fixtures';
import { createTestRuntime } from '../../testing-internal/test-runtime';
import { injectAui } from './inject-aui';
import { injectAuiEvent } from './inject-aui-event';

const mountWithProvider = (setup: () => void, config = signal(fullConfig())) => {
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
    template: `<div [auiProvider]="config()"><aui-probe /></div>`,
  })
  class HostComponent {
    readonly config = config;
  }
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return fixture;
};

function fullConfig() {
  return fixtureConfig({ thread: ThreadClient(), message: messageDerived() });
}

describe('injectAuiEvent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fires callback on thread.runStart and stops after destroy', async () => {
    const runtime = createTestRuntime();
    const cb = vi.fn();
    @Component({
      selector: 'aui-listener',
      standalone: true,
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: '',
    })
    class ListenerComponent {
      constructor() {
        injectAuiEvent('thread.runStart', cb);
      }
    }
    @Component({
      standalone: true,
      imports: [AuiProviderDirective, ListenerComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<div [auiProvider]="config"><aui-listener /></div>`,
    })
    class HostComponent {
      readonly config = runtime.config;
    }
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    flushTapSync(() => runtime.setRunning(true));
    await flushEvents();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ threadId: expect.any(String) }));

    fixture.destroy();

    flushTapSync(() => runtime.setRunning(false));
    flushTapSync(() => runtime.setRunning(true));
    await flushEvents();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('delivers scope-filtered events on a microtask', async () => {
    let aui!: FixtureClient;
    const cb = vi.fn();
    const fixture = mountWithProvider(() => {
      aui = asFixture(injectAui());
      injectAuiEvent('message.pinged' as never, cb as never);
    });

    flushTapSync(() => aui.thread.message({ index: 1 }).ping('other'));
    await flushEvents();
    expect(cb).not.toHaveBeenCalled();

    flushTapSync(() => aui.message.ping('bound'));
    await flushEvents();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ id: 'm0', value: 'bound' });

    fixture.destroy();
  });

  it('follows the client across structural changes', async () => {
    let aui!: FixtureClient;
    const cb = vi.fn();
    const fixture = mountWithProvider(() => {
      aui = asFixture(injectAui());
      injectAuiEvent('message.pinged' as never, cb as never);
    });

    flushTapSync(() => aui.thread.setSelected(1));

    flushTapSync(() => aui.message.ping('after-rebind'));
    await flushEvents();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ id: 'm1', value: 'after-rebind' });

    fixture.destroy();
  });

  it('stops delivering after destroy', async () => {
    let aui!: FixtureClient;
    const cb = vi.fn();
    const fixture = mountWithProvider(() => {
      aui = asFixture(injectAui());
      injectAuiEvent('message.pinged' as never, cb as never);
    });
    const message = aui.thread.message({ index: 0 });

    fixture.destroy();

    flushTapSync(() => message.ping('late'));
    await flushEvents();
    expect(cb).not.toHaveBeenCalled();
  });

  it('binds once its scope appears in a live config, without detaching', async () => {
    let aui!: FixtureClient;
    const cb = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const config = signal(fixtureConfig({ thread: ThreadClient() }));
    const fixture = mountWithProvider(() => {
      aui = asFixture(injectAui());
      injectAuiEvent('message.pinged' as never, cb as never);
    }, config);

    expect(warnSpy).toHaveBeenCalled();
    expect(cb).not.toHaveBeenCalled();

    config.set(fullConfig());
    fixture.detectChanges();
    await vi.waitFor(() => expect(aui.message.getState().id).toBe('m0'));

    flushTapSync(() => aui.message.ping('hello'));
    await flushEvents();
    expect(cb).toHaveBeenCalledWith({ id: 'm0', value: 'hello' });
    expect(errorSpy).not.toHaveBeenCalled();

    fixture.destroy();
  });
});
