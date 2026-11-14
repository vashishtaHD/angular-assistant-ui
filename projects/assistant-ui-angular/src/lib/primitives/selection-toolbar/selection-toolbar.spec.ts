// Ported from packages/react/src/primitives/selectionToolbar/SelectionToolbarRoot.test.tsx @ 7d74276
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../../testing-internal/test-bed';
import { createTestRuntime } from '../../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../../provider/aui-provider.directive';
import { injectAui } from '../../state/inject-aui';
import { getSelectionMessageId } from './get-selection-message-id';
import { AuiSelectionToolbarQuoteDirective } from './selection-toolbar-quote.directive';
import { AuiSelectionToolbarRootDirective } from './selection-toolbar-root.directive';

@Component({
  selector: 'aui-probe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class ProbeComponent {
  readonly aui = injectAui();
}

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiSelectionToolbarRootDirective,
    AuiSelectionToolbarQuoteDirective,
    ProbeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [auiProvider]="config">
      <aui-probe />
      <div id="thread">
        <p id="m1" data-message-id="m1">first message</p>
        <p id="m2" data-message-id="m2">second message</p>
      </div>
      <div id="toolbar" auiSelectionToolbarRoot #toolbar="auiSelectionToolbarRoot">
        <button auiSelectionToolbarQuote>Quote</button>
      </div>
    </div>
  `,
})
class HostComponent {
  readonly rt = createTestRuntime();
  readonly config = this.rt.config;
}

async function setup() {
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  document.body.append(el);
  const toolbar = el.querySelector<HTMLElement>('#toolbar')!;
  const { aui } = fixture.debugElement.query(By.directive(ProbeComponent))
    .componentInstance as ProbeComponent;
  const root = fixture.debugElement
    .query(By.directive(AuiSelectionToolbarRootDirective))
    .injector.get(AuiSelectionToolbarRootDirective);
  const select = async (startNode: Node, startOffset: number, endNode: Node, endOffset: number) => {
    window.getSelection()!.setBaseAndExtent(startNode, startOffset, endNode, endOffset);
    document.dispatchEvent(new Event('mouseup'));
    // Let the directive's requestAnimationFrame read run, then render.
    // Frames run in queue order, so one of ours fires after the directive's.
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
  };
  return {
    fixture,
    el,
    toolbar,
    aui,
    root,
    select,
    text: (id: string) => el.querySelector(`#${id}`)!.firstChild!,
  };
}

describe('selection toolbar', () => {
  beforeEach(() => {
    // jsdom has no layout, so Range.getBoundingClientRect does not exist.
    (Range.prototype as { getBoundingClientRect?: () => DOMRect }).getBoundingClientRect = () =>
      ({ top: 100, left: 50, width: 20, height: 10 }) as DOMRect;
  });
  afterEach(() => {
    window.getSelection()?.removeAllRanges();
    vi.restoreAllMocks();
    delete (Range.prototype as { getBoundingClientRect?: unknown }).getBoundingClientRect;
  });

  it('is hidden without a selection', async () => {
    const t = await setup();
    expect(t.toolbar.hidden).toBe(true);
    expect(t.root.rect()).toBeNull();
  });

  it('shows for a selection within one message and exposes the rect', async () => {
    const t = await setup();
    await t.select(t.text('m1'), 0, t.text('m1'), 5);
    expect(t.toolbar.hidden).toBe(false);
    expect(t.root.info()?.messageId).toBe('m1');
    expect(t.root.info()?.text).toBe('first');
    expect(t.root.rect()?.top).toBe(100);
  });

  it('hides for a selection across two messages', async () => {
    const t = await setup();
    await t.select(t.text('m1'), 0, t.text('m1'), 5);
    expect(t.toolbar.hidden).toBe(false);
    await t.select(t.text('m1'), 2, t.text('m2'), 3);
    expect(t.toolbar.hidden).toBe(true);
  });

  it('hides when the selection collapses', async () => {
    const t = await setup();
    await t.select(t.text('m1'), 0, t.text('m1'), 5);
    await t.select(t.text('m1'), 2, t.text('m1'), 2);
    expect(t.toolbar.hidden).toBe(true);
  });

  it('Quote sets the composer quote and clears the selection', async () => {
    const t = await setup();
    await t.select(t.text('m2'), 0, t.text('m2'), 6);
    const quote = t.toolbar.querySelector<HTMLButtonElement>('button')!;
    expect(quote.disabled).toBe(false);
    quote.click();
    expect(t.aui.thread.composer().getState().quote).toEqual({
      text: 'second',
      messageId: 'm2',
    });
    expect(window.getSelection()!.isCollapsed).toBe(true);
  });

  it('mousedown on the toolbar is default-prevented so the selection survives', async () => {
    const t = await setup();
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    t.toolbar.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('getSelectionMessageId', () => {
  it('returns null when the message is outside the given root', () => {
    document.body.innerHTML = '<div id="root"></div><p id="m" data-message-id="x">hello</p>';
    const node = document.getElementById('m')!.firstChild!;
    window.getSelection()!.setBaseAndExtent(node, 0, node, 3);
    expect(getSelectionMessageId(window.getSelection()!)).toBe('x');
    expect(
      getSelectionMessageId(window.getSelection()!, document.getElementById('root')),
    ).toBeNull();
    document.body.innerHTML = '';
  });

  it('honours data-aui-quote-selectable regions', () => {
    document.body.innerHTML =
      '<div data-message-id="x"><span data-aui-quote-selectable="false">no</span> yes <b data-aui-quote-selectable>ok</b></div>';
    const excluded = document.querySelector('span')!.firstChild!;
    const ok = document.querySelector('b')!.firstChild!;
    window.getSelection()!.setBaseAndExtent(excluded, 0, excluded, 2);
    expect(getSelectionMessageId(window.getSelection()!)).toBeNull();
    window.getSelection()!.setBaseAndExtent(ok, 0, ok, 2);
    expect(getSelectionMessageId(window.getSelection()!)).toBe('x');
    document.body.innerHTML = '';
  });
});
