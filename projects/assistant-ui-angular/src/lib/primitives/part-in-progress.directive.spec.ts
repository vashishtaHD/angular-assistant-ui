// Ported from packages/core/src/react/primitives/messagePart/MessagePartInProgress.ts @ 7d74276
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { AuiConfig } from '@assistant-ui/store/client';
import { flushTapSync } from '@assistant-ui/tap';
import { describe, expect, it } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime } from '../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { AuiMessagePartsComponent, AuiPartTemplateDirective } from './message-parts.component';
import { AuiPartInProgressDirective } from './part-in-progress.directive';
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
    AuiMessagePartsComponent,
    AuiPartTemplateDirective,
    AuiPartInProgressDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage>
          <aui-message-parts>
            <ng-template auiPart="text" let-part>
              <p class="text">{{ part.type === 'text' ? part.text : '' }}</p>
              <span *auiPartInProgress class="dot">&#9679;</span>
            </ng-template>
          </aui-message-parts>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class HostComponent {
  readonly config = hostConfig;
}

const mount = async (running: boolean) => {
  const rt = createTestRuntime();
  rt.append({ role: 'user', content: [{ type: 'text', text: 'q' }] });
  rt.append({ role: 'assistant', content: [{ type: 'text', text: 'a' }] });
  if (running) rt.setRunning(true);
  hostConfig = rt.config;
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  await settle(fixture);
  return { fixture, rt, el: fixture.nativeElement as HTMLElement };
};

describe('MessagePartPrimitive.InProgress', () => {
  it('renders while the part is running, on the streaming message only', async () => {
    const { el } = await mount(true);
    expect(el.querySelectorAll('.text').length).toBe(2);
    expect(el.querySelectorAll('.dot').length).toBe(1);
  });

  it('renders nothing when the part is complete', async () => {
    const { el } = await mount(false);
    expect(el.querySelectorAll('.text').length).toBe(2);
    expect(el.querySelector('.dot')).toBeNull();
  });

  it('follows the part as the run starts and ends', async () => {
    const { fixture, rt, el } = await mount(false);
    flushTapSync(() => rt.setRunning(true));
    await settle(fixture);
    expect(el.querySelectorAll('.dot').length).toBe(1);
    flushTapSync(() => rt.setRunning(false));
    await settle(fixture);
    expect(el.querySelector('.dot')).toBeNull();
  });
});
