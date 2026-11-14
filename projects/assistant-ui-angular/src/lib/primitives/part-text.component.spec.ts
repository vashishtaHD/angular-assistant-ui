// Ported from packages/react/src/primitives/messagePart/MessagePartText.test.tsx @ 7d74276
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { AuiConfig } from '@assistant-ui/store/client';
import { flushTapSync } from '@assistant-ui/tap';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime } from '../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import type { SmoothOptions } from '../utils/smooth';
import { AuiMessagePartsComponent, AuiPartTemplateDirective } from './message-parts.component';
import { AuiPartTextComponent } from './part-text.component';
import {
  AuiMessageTemplateDirective,
  AuiThreadMessagesComponent,
} from './thread-messages.component';

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await Promise.resolve();
  }
};

let now = 0;
let nextFrameId = 1;
let frames = new Map<number, FrameRequestCallback>();

const frame = (ms: number) => {
  now += ms;
  const pending = [...frames.values()];
  frames.clear();
  for (const callback of pending) callback(now);
};

let hostConfig: AuiConfig;

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessagePartsComponent,
    AuiPartTemplateDirective,
    AuiPartTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage>
          <aui-message-parts>
            <ng-template auiPart="text"><aui-part-text [smooth]="smooth()" /></ng-template>
          </aui-message-parts>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class HostComponent {
  readonly config = hostConfig;
  readonly smooth = input<boolean | SmoothOptions>(true);
}

const mount = async (opts: {
  running: boolean;
  smooth?: boolean | SmoothOptions;
  text: string;
}) => {
  const rt = createTestRuntime();
  rt.append({ role: 'user', content: [{ type: 'text', text: 'q' }] });
  rt.append({ role: 'assistant', content: [{ type: 'text', text: opts.text }] });
  if (opts.running) rt.setRunning(true);
  hostConfig = rt.config;
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  if (opts.smooth !== undefined) fixture.componentRef.setInput('smooth', opts.smooth);
  fixture.detectChanges();
  await settle(fixture);
  const el = fixture.nativeElement as HTMLElement;
  const assistant = () => el.querySelectorAll<HTMLElement>('aui-part-text')[1]!;
  return { fixture, rt, el, assistant };
};

describe('MessagePartPrimitive.Text', () => {
  beforeEach(() => {
    now = 0;
    nextFrameId = 1;
    frames = new Map();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = nextFrameId++;
      frames.set(id, callback);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reveals the streaming text progressively and reports running', async () => {
    const { fixture, assistant } = await mount({ running: true, text: 'hello world' });
    expect(assistant().textContent).toBe('');
    expect(assistant().getAttribute('data-status')).toBe('running');
    frame(10);
    await settle(fixture);
    const partial = assistant().textContent ?? '';
    expect(partial.length).toBeGreaterThan(0);
    expect(partial.length).toBeLessThan('hello world'.length);
    expect(assistant().getAttribute('data-status')).toBe('running');
    frame(10_000);
    await settle(fixture);
    expect(assistant().textContent).toBe('hello world');
    expect(assistant().getAttribute('data-status')).toBe('running');
  });

  it('snaps to the full text and reports complete when the part is complete', async () => {
    const { assistant } = await mount({ running: false, text: 'hello world' });
    expect(assistant().textContent).toBe('hello world');
    expect(assistant().getAttribute('data-status')).toBe('complete');
  });

  it('ends on the full text and the complete status after the run finishes', async () => {
    const { fixture, rt, assistant } = await mount({ running: true, text: 'hello world' });
    frame(10);
    await settle(fixture);
    flushTapSync(() => rt.setRunning(false));
    await settle(fixture);
    frame(10_000);
    await settle(fixture);
    expect(assistant().textContent).toBe('hello world');
    expect(assistant().getAttribute('data-status')).toBe('complete');
  });

  it('shows the text as it is with smooth=false', async () => {
    const { assistant } = await mount({ running: true, text: 'hello world', smooth: false });
    expect(assistant().textContent).toBe('hello world');
    expect(assistant().getAttribute('data-status')).toBe('running');
    expect(frames.size).toBe(0);
  });
});
