// Ported from packages/react/src/primitives/message/MessageError.ts @ 7d74276
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { AuiConfig } from '@assistant-ui/store/client';
import { flushTapSync } from '@assistant-ui/tap';
import { describe, expect, it } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime, type DemoMessage } from '../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { AuiErrorMessageComponent, AuiErrorRootDirective } from './error.directive';
import { AuiMessageErrorDirective } from './message-error.directive';
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
    AuiMessageErrorDirective,
    AuiErrorRootDirective,
    AuiErrorMessageComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage>
          <p class="body">body</p>
          <div *auiMessageError="let error" auiErrorRoot class="error">
            <span auiErrorMessage></span>
            <i class="raw">{{ error }}</i>
          </div>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class HostComponent {
  readonly config = hostConfig;
}

const failed: DemoMessage = {
  id: 'm1',
  role: 'assistant',
  content: [{ type: 'text', text: 'hi' }],
  status: { type: 'incomplete', reason: 'error', error: 'boom' },
};
const ok: DemoMessage = { id: 'm1', role: 'assistant', content: [{ type: 'text', text: 'hi' }] };

const mount = async (messages: DemoMessage[]) => {
  const rt = createTestRuntime();
  for (const message of messages) rt.append(message);
  hostConfig = rt.config;
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  await settle(fixture);
  return { fixture, rt, el: fixture.nativeElement as HTMLElement };
};

describe('MessagePrimitive.Error (*auiMessageError)', () => {
  it('renders only when the message status is an error', async () => {
    const { el } = await mount([failed]);
    expect(el.querySelector('.error')).not.toBeNull();
    expect(el.querySelector('.error span')?.textContent).toBe('boom');
    expect(el.querySelector('.raw')?.textContent).toBe('boom');
  });

  it('renders nothing on success', async () => {
    const { el } = await mount([ok]);
    expect(el.querySelector('.body')).not.toBeNull();
    expect(el.querySelector('.error')).toBeNull();
  });

  it('follows the message as it changes', async () => {
    const { fixture, rt, el } = await mount([ok]);
    expect(el.querySelector('.error')).toBeNull();
    flushTapSync(() => rt.setMessages([failed]));
    await settle(fixture);
    expect(el.querySelector('.error')).not.toBeNull();
    flushTapSync(() => rt.setMessages([ok]));
    await settle(fixture);
    expect(el.querySelector('.error')).toBeNull();
  });
});
