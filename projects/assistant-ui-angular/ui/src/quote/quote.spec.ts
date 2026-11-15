// Covers packages/ui/src/components/react/assistant-ui/elements/quote.aui.tsx @ 7d74276
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  AuiComposerInputDirective,
  AuiComposerRootDirective,
  AuiMessageQuoteDirective,
  AuiMessageRootDirective,
  AuiMessageTemplateDirective,
  AuiProviderDirective,
  AuiThreadMessagesComponent,
  AuiThreadRootDirective,
} from 'angular-assistant-ui';
import { afterEach, beforeEach, describe, expect, it, onTestFinished } from 'vitest';
import { displayOf, useFlexAuthorClass } from '../../../src/testing-internal/author-css';
import { configureTestBed } from '../../../src/testing-internal/test-bed';
import { createTestRuntime, type TestRuntime } from '../../../src/testing-internal/test-runtime';
import {
  AuiQuoteBlockComponent,
  AuiQuoteComposerComponent,
  AuiSelectionToolbarStyledComponent,
} from './quote';

let runtime: TestRuntime;

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadRootDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessageRootDirective,
    AuiMessageQuoteDirective,
    AuiComposerRootDirective,
    AuiComposerInputDirective,
    AuiQuoteBlockComponent,
    AuiQuoteComposerComponent,
    AuiSelectionToolbarStyledComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [auiProvider]="config">
    <div auiThreadRoot>
      <aui-thread-messages>
        <ng-template auiMessage>
          <div auiMessageRoot class="message">
            <aui-quote-block *auiMessageQuote="let quote" [text]="quote.text" />
            <p class="body">Some message text</p>
          </div>
        </ng-template>
      </aui-thread-messages>
      <aui-selection-toolbar-styled />
      <form auiComposerRoot>
        <aui-quote-composer />
        <textarea auiComposerInput></textarea>
      </form>
    </div>
  </div>`,
})
class HostComponent {
  readonly config = runtime.config;
}

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

let mounted: HTMLElement | undefined;

async function mount() {
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  const root = fixture.nativeElement as HTMLElement;
  document.body.append(root);
  mounted = root;
  fixture.detectChanges();
  await settle(fixture);
  return { fixture, root, settle: () => settle(fixture) };
}

beforeEach(() => {
  useFlexAuthorClass();
  runtime = createTestRuntime();
});

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  mounted?.remove();
  mounted = undefined;
  TestBed.resetTestingModule();
});

describe('quote kit', () => {
  it('aui-quote-composer previews the composer quote and dismisses it', async () => {
    const t = await mount();
    expect(t.root.querySelector('[data-slot="composer-quote"]')).toBeNull();
    runtime.runtime.thread.composer.setQuote({ text: 'quoted words', messageId: 'm1' });
    await t.settle();
    const preview = t.root.querySelector<HTMLElement>('[data-slot="composer-quote"]')!;
    expect(preview).not.toBeNull();
    expect(preview.querySelector('[data-slot="composer-quote-text"]')?.textContent).toBe(
      'quoted words',
    );
    const dismiss = preview.querySelector<HTMLButtonElement>(
      '[data-slot="composer-quote-dismiss"]',
    )!;
    expect(dismiss.getAttribute('aria-label')).toBe('Dismiss quote');
    dismiss.click();
    await t.settle();
    expect(runtime.runtime.thread.composer.getState().quote).toBeUndefined();
    expect(t.root.querySelector('[data-slot="composer-quote"]')).toBeNull();
  });

  it('aui-quote-block renders the quote of a user message', async () => {
    runtime.append({
      role: 'user',
      content: [{ type: 'text', text: 'about this' }],
      metadata: { custom: { quote: { text: 'the original', messageId: 'a1' } } },
    });
    const t = await mount();
    const block = t.root.querySelector('[data-slot="quote-block"]')!;
    expect(block).not.toBeNull();
    expect(block.querySelector('[data-slot="quote-block-text"]')?.textContent?.trim()).toBe(
      'the original',
    );
  });

  it('aui-selection-toolbar-styled stays hidden without a selection, even under author CSS', async () => {
    const t = await mount();
    const toolbar = t.root.querySelector<HTMLElement>('[data-slot="selection-toolbar"]')!;
    toolbar.classList.add('flex');
    expect(displayOf(toolbar)).toBe('none');
    const quote = toolbar.querySelector<HTMLButtonElement>(
      '[data-slot="selection-toolbar-quote"]',
    )!;
    expect(quote.textContent?.trim()).toBe('Quote');
  });

  it('aui-selection-toolbar-styled quotes a selection inside a message', async () => {
    runtime.append({ id: 'a1', role: 'assistant', content: [{ type: 'text', text: 'x' }] });
    const t = await mount();
    const body = t.root.querySelector('.message .body')!;
    // jsdom has no layout, so Range.getBoundingClientRect does not exist.
    (Range.prototype as { getBoundingClientRect?: () => DOMRect }).getBoundingClientRect = () =>
      ({ top: 100, left: 40, width: 60, height: 10 }) as DOMRect;
    onTestFinished(() => {
      delete (Range.prototype as { getBoundingClientRect?: unknown }).getBoundingClientRect;
    });
    window.getSelection()!.setBaseAndExtent(body.firstChild!, 0, body.firstChild!, 17);
    document.dispatchEvent(new Event('mouseup'));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    await t.settle();
    const toolbar = t.root.querySelector<HTMLElement>('[data-slot="selection-toolbar"]')!;
    expect(displayOf(toolbar)).not.toBe('none');
    expect(toolbar.style.position).toBe('fixed');
    expect(toolbar.style.top).toBe('92px');
    expect(toolbar.style.left).toBe('70px');
    toolbar.querySelector<HTMLButtonElement>('[data-slot="selection-toolbar-quote"]')!.click();
    await t.settle();
    expect(runtime.runtime.thread.composer.getState().quote).toEqual({
      text: 'Some message text',
      messageId: 'a1',
    });
  });
});
