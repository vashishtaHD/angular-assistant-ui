// Ported from packages/vue/src/__tests__ (ErrorPrimitive cases) @ 7d74276
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { AuiConfig } from '@assistant-ui/store/client';
import { describe, expect, it } from 'vitest';
import { displayOf, useFlexAuthorClass } from '../../testing-internal/author-css';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime, type DemoMessage } from '../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { AuiErrorMessageComponent, AuiErrorRootDirective } from './error.directive';
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

let hostConfig: AuiConfig;

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiErrorRootDirective,
    AuiErrorMessageComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage>
          <div auiErrorRoot class="root"><span auiErrorMessage class="msg flex"></span></div>
          <div auiErrorRoot class="custom">
            <span auiErrorMessage class="custom-msg flex">Custom</span>
          </div>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class HostComponent {
  readonly config = hostConfig;
}

const mount = async (message: DemoMessage) => {
  const rt = createTestRuntime();
  rt.append(message);
  hostConfig = rt.config;
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  await settle(fixture);
  return fixture.nativeElement as HTMLElement;
};

const text = (el: HTMLElement, selector: string) => el.querySelector(selector)?.textContent?.trim();

describe('ErrorPrimitive', () => {
  it('the root is an alert', async () => {
    const el = await mount({ role: 'assistant', content: [{ type: 'text', text: 'hi' }] });
    expect(el.querySelector('.root')?.getAttribute('role')).toBe('alert');
    expect(el.querySelector('.root')?.hasAttribute('data-run-state')).toBe(false);
  });

  it('the message shows a string error', async () => {
    const el = await mount({
      role: 'assistant',
      content: [{ type: 'text', text: 'hi' }],
      status: { type: 'incomplete', reason: 'error', error: 'boom' },
    });
    expect(text(el, '.msg')).toBe('boom');
    expect(el.querySelector('.msg')?.hasAttribute('hidden')).toBe(false);
    useFlexAuthorClass();
    expect(displayOf(el.querySelector('.msg')!)).toBe('flex');
  });

  it('the message shows the message of an error object', async () => {
    const el = await mount({
      role: 'assistant',
      content: [{ type: 'text', text: 'hi' }],
      status: { type: 'incomplete', reason: 'error', error: { message: 'rate limited' } },
    });
    expect(text(el, '.msg')).toBe('rate limited');
  });

  it('the message falls back to a generic text without an error value', async () => {
    const el = await mount({
      role: 'assistant',
      content: [{ type: 'text', text: 'hi' }],
      status: { type: 'incomplete', reason: 'error' },
    });
    expect(text(el, '.msg')).toBe('An error occurred');
  });

  it('projected content replaces the error text', async () => {
    const el = await mount({
      role: 'assistant',
      content: [{ type: 'text', text: 'hi' }],
      status: { type: 'incomplete', reason: 'error', error: 'boom' },
    });
    expect(text(el, '.custom-msg')).toBe('Custom');
  });

  it('the message renders nothing and is hidden on success', async () => {
    const el = await mount({ role: 'assistant', content: [{ type: 'text', text: 'hi' }] });
    // Upstream returns null; an author display class must not show the empty element.
    useFlexAuthorClass();
    expect(displayOf(el.querySelector('.msg')!)).toBe('none');
    expect(displayOf(el.querySelector('.custom-msg')!)).toBe('none');
    expect(text(el, '.msg')).toBe('');
    expect(el.querySelector('.msg')?.hasAttribute('hidden')).toBe(true);
    expect(el.querySelector('.custom-msg')?.hasAttribute('hidden')).toBe(true);
    expect(text(el, '.custom-msg')).toBe('');
  });

  it('other incomplete reasons are not errors', async () => {
    const el = await mount({
      role: 'assistant',
      content: [{ type: 'text', text: 'hi' }],
      status: { type: 'incomplete', reason: 'cancelled' },
    });
    expect(text(el, '.msg')).toBe('');
  });

  it('announces a run another session drives as a status with data-run-state', async () => {
    const el = await mount({
      role: 'assistant',
      content: [{ type: 'text', text: '' }],
      status: { type: 'incomplete', reason: 'error', error: { code: 'run_in_progress' } },
    });
    expect(el.querySelector('.root')?.getAttribute('role')).toBe('status');
    expect(el.querySelector('.root')?.getAttribute('data-run-state')).toBe('in-progress');
  });

  it('marks a stale run with data-run-state and keeps the alert role', async () => {
    const el = await mount({
      role: 'assistant',
      content: [{ type: 'text', text: '' }],
      status: { type: 'incomplete', reason: 'error', error: { code: 'run_stale' } },
    });
    expect(el.querySelector('.root')?.getAttribute('role')).toBe('alert');
    expect(el.querySelector('.root')?.getAttribute('data-run-state')).toBe('stale');
  });
});
