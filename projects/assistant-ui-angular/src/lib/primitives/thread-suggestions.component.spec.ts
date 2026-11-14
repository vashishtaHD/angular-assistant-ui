// Ported from packages/core/src/adapters/suggestion.test.ts and the Vue suggestions tests @ 7d74276
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { AuiConfig } from '@assistant-ui/store/client';
import { flushTapSync } from '@assistant-ui/tap';
import type { ExternalStoreAdapter, ThreadSuggestion } from '@assistant-ui/core';
import { AssistantRuntimeImpl, ExternalStoreRuntimeCore } from '@assistant-ui/core/internal';
import { RuntimeAdapter } from '@assistant-ui/core/store';
import { describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { injectAui } from '../state/inject-aui';
import { AuiSuggestionDescriptionComponent } from './suggestion/description';
import { AuiSuggestionTitleComponent } from './suggestion/title';
import { AuiSuggestionTriggerDirective } from './suggestion/trigger';
import {
  AuiSuggestionTemplateDirective,
  AuiThreadSuggestionsComponent,
} from './thread-suggestions.component';

const suggestion = (n: number): ThreadSuggestion => ({
  title: `T${n}`,
  label: `L${n}`,
  prompt: `P${n}`,
});

function createSpyRuntime(initial: readonly ThreadSuggestion[]) {
  const onNew = vi.fn(async () => undefined);
  let isRunning = false;
  let suggestions = initial;
  const make = (): ExternalStoreAdapter<{ role: 'user'; content: string }> => ({
    messages: [],
    isRunning,
    suggestions,
    convertMessage: (m) => m,
    onNew,
  });
  const core = new ExternalStoreRuntimeCore(make());
  const runtime = new AssistantRuntimeImpl(core);
  return {
    onNew,
    config: AuiConfig({ threads: RuntimeAdapter(runtime) }),
    setRunning(value: boolean) {
      isRunning = value;
      core.setAdapter(make());
    },
    setSuggestions(list: readonly ThreadSuggestion[]) {
      suggestions = list;
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

let current: ReturnType<typeof createSpyRuntime>;

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadSuggestionsComponent,
    AuiSuggestionTemplateDirective,
    AuiSuggestionTriggerDirective,
    AuiSuggestionTitleComponent,
    AuiSuggestionDescriptionComponent,
    ProbeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [auiProvider]="config">
      <aui-probe />
      <aui-thread-suggestions>
        <ng-template auiSuggestion>
          <button auiSuggestionTrigger class="fill">
            <aui-suggestion-title />|<aui-suggestion-description />
          </button>
          <button auiSuggestionTrigger send class="send"><aui-suggestion-title /></button>
          <button auiSuggestionTrigger [clearComposer]="false" class="append">add</button>
        </ng-template>
      </aui-thread-suggestions>
    </div>
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

const mount = async (initial: readonly ThreadSuggestion[]) => {
  current = createSpyRuntime(initial);
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  await settle(fixture);
  const el = fixture.nativeElement as HTMLElement;
  const aui = fixture.debugElement.query((d) => d.componentInstance instanceof ProbeComponent)
    .componentInstance.aui as ReturnType<typeof injectAui>;
  const q = (cls: string) => Array.from(el.querySelectorAll<HTMLButtonElement>(`button.${cls}`));
  return { fixture, rt: current, aui, q };
};

describe('aui-thread-suggestions', () => {
  it('renders the three configured suggestions', async () => {
    const { fixture, q } = await mount([suggestion(1), suggestion(2), suggestion(3)]);
    const fills = q('fill');
    expect(fills).toHaveLength(3);
    expect(fills.map((b) => b.textContent)).toEqual(['T1|L1', 'T2|L2', 'T3|L3']);
    fixture.destroy();
  });

  it('keeps a row when its suggestion is unchanged and updates on removal', async () => {
    const { fixture, rt, q } = await mount([suggestion(1), suggestion(2)]);
    const first = q('fill')[0];
    flushTapSync(() => rt.setSuggestions([suggestion(1), suggestion(2), suggestion(3)]));
    await settle(fixture);
    expect(q('fill')).toHaveLength(3);
    expect(q('fill')[0]).toBe(first);
    flushTapSync(() => rt.setSuggestions([suggestion(2)]));
    await settle(fixture);
    expect(q('fill').map((b) => b.textContent?.trim())).toEqual(['T2|L2']);
    fixture.destroy();
  });

  it('a trigger without send fills the composer and does not run', async () => {
    const { fixture, rt, aui, q } = await mount([suggestion(1), suggestion(2)]);
    q('fill')[1]!.click();
    await settle(fixture);
    expect(aui.composer().getState().text).toBe('P2');
    expect(rt.onNew).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('clearComposer=false appends the prompt to the composer text', async () => {
    const { fixture, aui, q } = await mount([suggestion(1)]);
    flushTapSync(() => aui.composer().setText('hello'));
    q('append')[0]!.click();
    await settle(fixture);
    expect(aui.composer().getState().text).toBe('hello P1');
    fixture.destroy();
  });

  it('a trigger with send appends a message, starts a run and clears the composer', async () => {
    const { fixture, rt, aui, q } = await mount([suggestion(1), suggestion(2)]);
    flushTapSync(() => aui.composer().setText('draft'));
    q('send')[0]!.click();
    await settle(fixture);
    expect(rt.onNew).toHaveBeenCalledTimes(1);
    const message = (rt.onNew.mock.calls[0] as unknown[])[0] as { content: unknown };
    expect(message.content).toEqual([{ type: 'text', text: 'P1' }]);
    expect(aui.composer().getState().text).toBe('');
    fixture.destroy();
  });

  it('disables a send trigger while running (per the predicate) but not a fill trigger', async () => {
    const { fixture, rt, aui, q } = await mount([suggestion(1)]);
    expect(q('send')[0]!.disabled).toBe(false);
    flushTapSync(() => rt.setRunning(true));
    await settle(fixture);
    expect(q('send')[0]!.disabled).toBe(true);
    expect(q('send')[0]!.hasAttribute('data-disabled')).toBe(true);
    expect(q('fill')[0]!.disabled).toBe(false);

    q('send')[0]!.click();
    await settle(fixture);
    expect(rt.onNew).not.toHaveBeenCalled();
    expect(aui.composer().getState().text).toBe('');

    flushTapSync(() => rt.setRunning(false));
    await settle(fixture);
    expect(q('send')[0]!.disabled).toBe(false);
    fixture.destroy();
  });
});
