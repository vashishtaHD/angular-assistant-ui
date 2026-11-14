// Ported from packages/vue/src/__tests__/AuiIf.test.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { AssistantState } from '@assistant-ui/store/client';
import { flushTapSync } from '@assistant-ui/tap';
import { describe, expect, it } from 'vitest';
import { AuiIfDirective } from './aui-if.directive';
import { AuiProviderDirective } from './provider/aui-provider.directive';
import { injectAui } from './state/inject-aui';
import { configureTestBed } from '../testing-internal/test-bed';
import { ThreadClient, asFixture, fixtureConfig, fixtureState } from '../testing-internal/fixtures';
import { createTestRuntime } from '../testing-internal/test-runtime';

describe('AuiIfDirective', () => {
  it('renders the template only while the condition selects true', async () => {
    @Component({
      selector: 'aui-probe',
      standalone: true,
      imports: [AuiIfDirective],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<span *auiIf="isSecond" id="flag">visible</span>`,
    })
    class ProbeComponent {
      readonly aui = asFixture(injectAui());
      readonly isSecond = (s: AssistantState) => fixtureState(s).thread.selected === 1;
    }
    @Component({
      standalone: true,
      imports: [AuiProviderDirective, ProbeComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<div [auiProvider]="config"><aui-probe /></div>`,
    })
    class HostComponent {
      readonly config = fixtureConfig({ thread: ThreadClient() });
    }
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    // Like an app: the fixture is checked whenever Angular schedules a tick.
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const { aui } = fixture.debugElement.query(By.directive(ProbeComponent))
      .componentInstance as ProbeComponent;

    expect(el.querySelector('#flag')).toBeNull();

    flushTapSync(() => aui.thread.setSelected(1));
    await fixture.whenStable();
    expect(el.querySelector('#flag')?.textContent).toBe('visible');

    flushTapSync(() => aui.thread.setSelected(0));
    await fixture.whenStable();
    expect(el.querySelector('#flag')).toBeNull();

    fixture.destroy();
  });

  it('renders only while the thread is running (real runtime)', async () => {
    const runtime = createTestRuntime();
    @Component({
      standalone: true,
      imports: [AuiProviderDirective, AuiIfDirective],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<div [auiProvider]="config">
        <button *auiIf="isRunning" type="button" id="stop">{{ label() }}</button>
      </div>`,
    })
    class HostComponent {
      readonly config = runtime.config;
      readonly label = signal('Stop');
      readonly isRunning = (s: AssistantState) => s.thread.isRunning;
    }
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    // Like an app: the fixture is checked whenever Angular schedules a tick.
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('#stop')).toBeNull();

    flushTapSync(() => runtime.setRunning(true));
    await fixture.whenStable();
    expect(el.querySelector('#stop')?.textContent).toBe('Stop');

    flushTapSync(() => runtime.setRunning(false));
    await fixture.whenStable();
    expect(el.querySelector('#stop')).toBeNull();

    fixture.destroy();
  });

  it('re-evaluates when the condition input changes', async () => {
    @Component({
      standalone: true,
      imports: [AuiProviderDirective, AuiIfDirective],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<div [auiProvider]="config">
        <span *auiIf="condition()" id="flag">on</span>
      </div>`,
    })
    class HostComponent {
      readonly config = fixtureConfig({ thread: ThreadClient() });
      readonly condition = signal((s: AssistantState) => fixtureState(s).thread.selected === 1);
    }
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    // Like an app: the fixture is checked whenever Angular schedules a tick.
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#flag')).toBeNull();

    fixture.componentInstance.condition.set((s) => fixtureState(s).thread.selected === 0);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('#flag')?.textContent).toBe('on');

    fixture.destroy();
  });
});
