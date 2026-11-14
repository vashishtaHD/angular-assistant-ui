// Original specs for the Task 10 adapters (fix round 1); behavior mirrors packages/react/src/unstable/use{LiveCompletion,Mention}Adapter.ts @ 7d74276
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../../testing-internal/test-bed';
import { createTestRuntime } from '../../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../../provider/aui-provider.directive';
import { AuiComposerInputDirective } from '../composer-input.directive';
import { AuiComposerRootDirective } from '../composer-root.directive';
import { injectLiveCompletionAdapter } from './inject-live-completion-adapter';
import {
  injectMentionAdapter,
  type Unstable_UseMentionAdapterOptions,
} from './inject-mention-adapter';
import type { TriggerItem } from './trigger-contracts';
import { AuiComposerTriggerPopoverInputDirective } from './trigger-popover-input.directive';
import {
  AuiComposerTriggerPopoverRootDirective,
  AuiUnstableComposerTriggerPopoverRootDirective,
} from './trigger-popover-root.directive';
import {
  AuiComposerTriggerPopoverDirective,
  AuiUnstableComposerTriggerPopoverDirective,
} from './trigger-popover.directive';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiComposerRootDirective,
    AuiComposerInputDirective,
    AuiComposerTriggerPopoverRootDirective,
    AuiComposerTriggerPopoverDirective,
    AuiComposerTriggerPopoverInputDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [auiProvider]="config">
      <div auiComposerTriggerPopoverRoot>
        <div
          auiComposerTriggerPopover
          data-t="live"
          char="~"
          [adapter]="live.adapter()"
          [isLoading]="live.isLoading()"
        ></div>
        <form auiComposerRoot>
          <textarea auiComposerInput auiComposerTriggerPopoverInput></textarea>
        </form>
      </div>
    </div>
  `,
})
class LiveHostComponent {
  readonly rt = createTestRuntime();
  readonly config = this.rt.config;
  readonly cacheKey = signal<string>('a');
  readonly enabled = signal(true);
  readonly fail = signal(false);
  readonly fetcher = vi.fn(async (q: string): Promise<readonly TriggerItem[]> => {
    if (this.fail()) throw new Error('boom');
    return [{ id: `r-${q}-${this.cacheKey()}`, type: 'remote', label: `R ${q}` }];
  });
  readonly live = injectLiveCompletionAdapter(() => ({
    fetcher: this.fetcher,
    debounceMs: 5,
    cacheKey: this.cacheKey(),
    enabled: this.enabled(),
  }));
}

async function setupLive() {
  configureTestBed({ imports: [LiveHostComponent] });
  const fixture = TestBed.createComponent(LiveHostComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  document.body.append(el);
  const textarea = el.querySelector('textarea')!;
  const settle = async (ms = 0) => {
    await sleep(ms);
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const type = async (value: string) => {
    textarea.value = value;
    textarea.setSelectionRange(value.length, value.length);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  };
  const popover = fixture.debugElement
    .query(By.css('[data-t=live]'))
    .injector.get(AuiComposerTriggerPopoverDirective);
  return { fixture, host: fixture.componentInstance, settle, type, popover };
}

describe('live completion adapter: failure, cacheKey and enabled', () => {
  it('does not retry a failed fetch while the popover stays open', async () => {
    const t = await setupLive();
    t.host.fail.set(true);
    await t.type('~ab');
    // Many debounce windows: a runaway retry would call the fetcher repeatedly.
    await t.settle(250);
    expect(t.host.fetcher).toHaveBeenCalledTimes(1);
    expect(t.popover.isLoading()).toBe(false);
    expect(t.popover.itemList()).toEqual([]);
  });

  it('a changed query after a failure fetches again', async () => {
    const t = await setupLive();
    t.host.fail.set(true);
    await t.type('~ab');
    await t.settle(60);
    t.host.fail.set(false);
    await t.type('~abc');
    await t.settle(60);
    expect(t.host.fetcher).toHaveBeenCalledTimes(2);
    expect(t.popover.itemList().map((i) => i.id)).toEqual(['r-abc-a']);
  });

  it('a changed cacheKey drops cached results and refetches the same query', async () => {
    const t = await setupLive();
    await t.type('~ab');
    await t.settle(60);
    expect(t.popover.itemList().map((i) => i.id)).toEqual(['r-ab-a']);
    t.host.cacheKey.set('b');
    await t.settle(60);
    expect(t.host.fetcher).toHaveBeenCalledTimes(2);
    expect(t.popover.itemList().map((i) => i.id)).toEqual(['r-ab-b']);
  });

  it('enabled=false schedules no fetch, empties the results and refetches when re-enabled', async () => {
    const t = await setupLive();
    t.host.enabled.set(false);
    await t.settle();
    await t.type('~ab');
    await t.settle(60);
    expect(t.host.fetcher).not.toHaveBeenCalled();
    expect(t.popover.itemList()).toEqual([]);

    t.host.enabled.set(true);
    await t.settle(60);
    expect(t.host.fetcher).toHaveBeenCalledTimes(1);
    expect(t.popover.itemList().map((i) => i.id)).toEqual(['r-ab-a']);

    // Disabling clears cached results, so re-enabling the same query fetches again.
    t.host.enabled.set(false);
    await t.settle(30);
    expect(t.popover.itemList()).toEqual([]);
    t.host.enabled.set(true);
    await t.settle(60);
    expect(t.host.fetcher).toHaveBeenCalledTimes(2);
  });
});

/** Must live inside the provider: the adapter injects the assistant client. */
@Component({
  selector: 'aui-mention-pane',
  standalone: true,
  imports: [
    AuiComposerRootDirective,
    AuiComposerInputDirective,
    AuiComposerTriggerPopoverRootDirective,
    AuiComposerTriggerPopoverDirective,
    AuiComposerTriggerPopoverInputDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div auiComposerTriggerPopoverRoot>
      <div
        auiComposerTriggerPopover
        data-t="mention"
        char="@"
        [adapter]="mention.adapter()"
        [directive]="mention.directive()"
      ></div>
      <form auiComposerRoot>
        <textarea auiComposerInput auiComposerTriggerPopoverInput></textarea>
      </form>
    </div>
  `,
})
class MentionPaneComponent {
  readonly options = signal<Unstable_UseMentionAdapterOptions | undefined>(undefined);
  readonly mention = injectMentionAdapter(() => this.options());
}

@Component({
  standalone: true,
  imports: [AuiProviderDirective, MentionPaneComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [auiProvider]="config"><aui-mention-pane /></div>`,
})
class MentionToolsHostComponent {
  readonly rt = createTestRuntime();
  readonly config = this.rt.config;
}

describe('mention adapter: flat items and model-context tools', () => {
  async function setupMention() {
    configureTestBed({ imports: [MentionToolsHostComponent] });
    const fixture = TestBed.createComponent(MentionToolsHostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    document.body.append(el);
    const textarea = el.querySelector('textarea')!;
    const settle = async () => {
      await sleep(0);
      fixture.detectChanges();
      await fixture.whenStable();
    };
    const popover = fixture.debugElement
      .query(By.css('[data-t=mention]'))
      .injector.get(AuiComposerTriggerPopoverDirective);
    const type = async (value: string) => {
      textarea.value = value;
      textarea.setSelectionRange(value.length, value.length);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
    };
    const pane = fixture.debugElement.query(By.directive(MentionPaneComponent))
      .componentInstance as MentionPaneComponent;
    const host = { rt: fixture.componentInstance.rt, options: pane.options, mention: pane.mention };
    const provide = (tools: Record<string, { description?: string }>) =>
      host.rt.runtime.registerModelContextProvider({
        getModelContext: () => ({ tools: tools as never }),
      });
    return { host, settle, popover, type, provide };
  }

  it('lists model-context tools by default when no items are given', async () => {
    const t = await setupMention();
    t.provide({ search: { description: 'Search the web' }, calc: {} });
    await t.settle();
    await t.type('@');
    expect(
      t.popover
        .itemList()
        .map((i) => `${i.type}:${i.id}`)
        .sort(),
    ).toEqual(['tool:calc', 'tool:search']);
    expect(t.popover.itemList().find((i) => i.id === 'search')!.description).toBe('Search the web');
  });

  it('flat items exclude tools by default and explicit items win over a same-named tool', async () => {
    const t = await setupMention();
    t.provide({ search: { description: 'tool desc' } });
    t.host.options.set({ items: [{ id: 'search', type: 'user', label: 'Searcher' }] });
    await t.type('@');
    expect(t.popover.itemList().map((i) => i.label)).toEqual(['Searcher']);

    t.host.options.set({
      items: [{ id: 'search', type: 'user', label: 'Searcher' }],
      includeModelContextTools: true,
    });
    await t.type('@s');
    // Deduped by id: the explicit item replaces the tool, and the tool is not added again.
    expect(t.popover.itemList().map((i) => `${i.type}:${i.label}`)).toEqual(['user:Searcher']);
  });

  it('formats tool labels and a tool category selects drill-down mode', async () => {
    const t = await setupMention();
    t.provide({ run_it: {} });
    t.host.options.set({
      includeModelContextTools: {
        category: { id: 'tools', label: 'My tools' },
        formatLabel: (n) => n.toUpperCase(),
      },
    });
    await t.type('@');
    expect(t.popover.categories()).toEqual([{ id: 'tools', label: 'My tools' }]);
    t.popover.selectCategory('tools');
    await t.settle();
    expect(t.popover.itemList().map((i) => i.label)).toEqual(['RUN_IT']);
  });

  it('picks up tools registered after the first read', async () => {
    const t = await setupMention();
    await t.type('@');
    expect(t.popover.itemList()).toEqual([]);
    t.provide({ late: {} });
    await t.settle();
    await t.type('@l');
    expect(t.popover.itemList().map((i) => i.id)).toEqual(['late']);
  });

  it('does not swallow errors thrown by a model-context provider', async () => {
    configureTestBed({ imports: [MentionToolsHostComponent] });
    const fixture = TestBed.createComponent(MentionToolsHostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const pane = fixture.debugElement.query(By.directive(MentionPaneComponent))
      .componentInstance as MentionPaneComponent;
    let explode = false;
    let notify: () => void = () => undefined;
    fixture.componentInstance.rt.runtime.registerModelContextProvider({
      getModelContext: () => {
        if (explode) throw new Error('provider exploded');
        return {};
      },
      subscribe: (cb: () => void) => {
        notify = cb;
        return () => undefined;
      },
    });
    await fixture.whenStable();
    // Stop rendering so the failure is observed by this read, not by a render.
    fixture.debugElement
      .query(By.directive(MentionPaneComponent))
      .injector.get(ChangeDetectorRef)
      .detach();
    explode = true;
    notify();
    await sleep(10);
    expect(() => pane.mention.adapter()).toThrow(/provider exploded/);
  });
});

describe('Unstable_ trigger popover aliases', () => {
  it('are the same classes', () => {
    expect(AuiUnstableComposerTriggerPopoverRootDirective).toBe(
      AuiComposerTriggerPopoverRootDirective,
    );
    expect(AuiUnstableComposerTriggerPopoverDirective).toBe(AuiComposerTriggerPopoverDirective);
  });
});
