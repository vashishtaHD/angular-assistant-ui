// Ported from packages/ui/src/components/react/assistant-ui/elements/follow-up-suggestions.aui.test.tsx @ 7d74276
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { AuiProviderDirective } from 'angular-assistant-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../src/testing-internal/test-bed';
import { createTestRuntime, type TestRuntime } from '../../src/testing-internal/test-runtime';
import { AuiFollowUpSuggestionsComponent } from './follow-up-suggestions.component';
import { AuiThreadComponent } from './thread/thread.component';

let runtime: TestRuntime;

@Component({
  standalone: true,
  imports: [AuiProviderDirective, AuiFollowUpSuggestionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [auiProvider]="config"><aui-follow-up-suggestions /></div>`,
})
class StandaloneHostComponent {
  readonly config = runtime.config;
}

@Component({
  standalone: true,
  imports: [AuiProviderDirective, AuiThreadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [auiProvider]="config" style="height: 600px"><aui-thread /></div>`,
})
class ThreadHostComponent {
  readonly config = runtime.config;
}

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 4; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

let mounted: HTMLElement | undefined;

async function mount(host: typeof StandaloneHostComponent | typeof ThreadHostComponent) {
  configureTestBed({ imports: [host] });
  const fixture = TestBed.createComponent(host);
  const root = fixture.nativeElement as HTMLElement;
  document.body.append(root);
  mounted = root;
  fixture.detectChanges();
  await settle(fixture);
  return {
    fixture,
    root,
    buttons: () =>
      Array.from(root.querySelectorAll<HTMLButtonElement>('.aui-thread-followup-suggestion')),
    settle: () => settle(fixture),
  };
}

const text = (value: string) => [{ type: 'text' as const, text: value }];

const completedRun = () => {
  runtime = createTestRuntime();
  runtime.append({ role: 'user', content: text('hi') });
  runtime.append({ role: 'assistant', content: text('hello') });
  runtime.setSuggestions([
    { title: 'Weather', label: 'in SF', prompt: 'What is the weather in San Francisco today?' },
    { prompt: 'Summarize this' },
  ]);
};

afterEach(() => {
  mounted?.remove();
  mounted = undefined;
  TestBed.resetTestingModule();
  vi.restoreAllMocks();
});

describe('aui-follow-up-suggestions', () => {
  it('shows title and label while still sending the full prompt', async () => {
    completedRun();
    const t = await mount(StandaloneHostComponent);
    const [rich, plain] = t.buttons();
    expect(rich?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Weather in SF');
    expect(rich?.querySelector('.aui-thread-followup-suggestion-label')?.textContent?.trim()).toBe(
      'in SF',
    );
    expect(plain?.textContent?.trim()).toBe('Summarize this');
    expect(plain?.querySelector('.aui-thread-followup-suggestion-label')).toBeNull();

    const append = vi.spyOn(runtime.runtime.thread, 'append');
    rich!.click();
    await t.settle();
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        content: [{ type: 'text', text: 'What is the weather in San Francisco today?' }],
      }),
    );
  });

  it('renders nothing for an empty thread, while running or without suggestions', async () => {
    runtime = createTestRuntime();
    runtime.setSuggestions([{ prompt: 'Summarize this' }]);
    const t = await mount(StandaloneHostComponent);
    expect(t.buttons()).toHaveLength(0);
    runtime.append({ role: 'user', content: text('hi') });
    runtime.setRunning(true);
    await t.settle();
    expect(t.buttons()).toHaveLength(0);
    runtime.setRunning(false);
    await t.settle();
    expect(t.buttons()).toHaveLength(1);
    runtime.setSuggestions([]);
    await t.settle();
    expect(t.buttons()).toHaveLength(0);
    expect(t.root.querySelector('.aui-thread-followup-suggestions')).toBeNull();
  });

  it('follow-ups render in aui-thread after a completed run', async () => {
    completedRun();
    const t = await mount(ThreadHostComponent);
    const footer = t.root.querySelector('.aui-thread-viewport-footer')!;
    const row = footer.querySelector('.aui-thread-followup-suggestions');
    expect(row).not.toBeNull();
    // Above the composer, as upstream.
    const composer = footer.querySelector('.aui-composer-root')!;
    expect(row!.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(t.buttons().map((b) => b.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Weather in SF',
      'Summarize this',
    ]);
  });
});
