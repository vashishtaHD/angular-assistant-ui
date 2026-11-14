// Mirrors packages/vue/src/__tests__/primitives-keyed-items.test.ts and byindex-shrink-race.test.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  TemplateRef,
  contentChild,
  inject,
} from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { flushTapSync } from '@assistant-ui/tap';
import type { AuiConfig } from '@assistant-ui/store/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime, type TestRuntime } from '../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';
import { indexScopeConfig, indexScopeCount } from './index-scope';
import { AuiScopeOutletComponent } from './scope-outlet.component';
import { stableKeys } from './stable-keys';

const lifecycle = { mounts: [] as string[], unmounts: [] as string[] };
const counts: Record<string, number> = {};

@Component({
  selector: 'aui-test-suggestion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="s">{{ title() }}</span>`,
})
class SuggestionRowComponent {
  readonly title = injectAuiState((s) => s.suggestion.title);

  constructor() {
    const id = `row-${lifecycle.mounts.length}`;
    lifecycle.mounts.push(id);
    inject(DestroyRef).onDestroy(() => lifecycle.unmounts.push(id));
  }
}

@Directive({ selector: 'ng-template[auiTestItem]', standalone: true })
class ItemTemplateDirective {
  readonly templateRef = inject<TemplateRef<unknown>>(TemplateRef);
}

/** A minimal owner, like the Task 7 `aui-thread-suggestions`, built on indexScopeConfig. */
@Component({
  selector: 'aui-test-suggestions',
  standalone: true,
  imports: [AuiScopeOutletComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (key of keys(); track key; let index = $index) {
      <aui-scope-outlet [config]="configFor(key, index)" [template]="item().templateRef" />
    }
  `,
})
class SuggestionsOwnerComponent {
  protected readonly item = contentChild.required(ItemTemplateDirective);
  private readonly aui = injectAui();
  private readonly suggestions = injectAuiState((s) => s.suggestions.suggestions);
  protected readonly keys = stableKeys(() => this.suggestions().map((s) => s.prompt));
  private readonly byKey = new Map<string, AuiConfig>();

  protected configFor(key: string, index: number): AuiConfig {
    const slot = `${key}@${index}`;
    let config = this.byKey.get(slot);
    if (!config) {
      config = indexScopeConfig('suggestion', this.aui, index, () => this.keys()[index] === key);
      this.byKey.set(slot, config);
    }
    return config;
  }
}

@Component({
  selector: 'aui-test-counts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
})
class CountsProbeComponent {
  private readonly aui = injectAui();

  constructor() {
    inject(DestroyRef).onDestroy(() => undefined);
  }

  read(): void {
    counts['suggestion'] = indexScopeCount('suggestion', this.aui);
    counts['queueItem'] = indexScopeCount('queueItem', this.aui);
    counts['threadListItem'] = indexScopeCount('threadListItem', this.aui);
    counts['archived'] = indexScopeCount('threadListItem', this.aui, { archived: true });
    counts['composerAttachment'] = indexScopeCount('attachment', this.aui, { source: 'composer' });
  }
}

let current: TestRuntime;

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    SuggestionsOwnerComponent,
    ItemTemplateDirective,
    SuggestionRowComponent,
    CountsProbeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-test-counts />
      <aui-test-suggestions>
        <ng-template auiTestItem><aui-test-suggestion /></ng-template>
      </aui-test-suggestions>
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

const suggestion = (n: number) => ({ title: `T${n}`, label: `L${n}`, prompt: `P${n}` });

const mount = async (count: number) => {
  current = createTestRuntime();
  lifecycle.mounts = [];
  lifecycle.unmounts = [];
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  await settle(fixture);
  flushTapSync(() =>
    current.setSuggestions(Array.from({ length: count }, (_, i) => suggestion(i + 1))),
  );
  await settle(fixture);
  return { fixture, rt: current };
};

const rows = (fixture: ComponentFixture<unknown>) =>
  Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.s'));

afterEach(() => vi.restoreAllMocks());

describe('indexScopeConfig (suggestion)', () => {
  it('resolves aui.suggestion().getState() per index', async () => {
    const { fixture } = await mount(3);
    expect(rows(fixture).map((el) => el.textContent)).toEqual(['T1', 'T2', 'T3']);
    expect(lifecycle.mounts).toHaveLength(3);
  });

  it('keeps the surviving items scopes when the middle item is removed', async () => {
    const { fixture, rt } = await mount(3);
    const before = rows(fixture);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    flushTapSync(() => rt.setSuggestions([suggestion(1), suggestion(3)]));
    await settle(fixture);

    const after = rows(fixture);
    expect(after.map((el) => el.textContent)).toEqual(['T1', 'T3']);
    // Stable keys: T1 and T3 keep their DOM nodes; only the middle row unmounted.
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[2]);
    expect(lifecycle.mounts).toHaveLength(3);
    expect(lifecycle.unmounts).toHaveLength(1);
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});

describe('indexScopeCount', () => {
  it('reports the size of each kind collection', async () => {
    const { fixture } = await mount(2);
    const probe = fixture.debugElement.children
      .map((child) => child.componentInstance)
      .find(
        (instance): instance is CountsProbeComponent => instance instanceof CountsProbeComponent,
      );
    expect(probe).toBeDefined();
    probe!.read();
    expect(counts['suggestion']).toBe(2);
    expect(counts['queueItem']).toBe(0);
    expect(counts['composerAttachment']).toBe(0);
    expect(counts['archived']).toBe(0);
    expect(counts['threadListItem']).toBeGreaterThanOrEqual(0);
  });
});
