// Mirrors packages/react/src/hooks/useMessageTiming.ts @ 7d74276
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime, type TestRuntime } from '../../testing-internal/test-runtime';
import {
  AuiMessageTemplateDirective,
  AuiThreadMessagesComponent,
} from '../primitives/thread-messages.component';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { injectMessageTiming } from './inject-message-timing';

@Component({
  selector: 'aui-timing-probe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="probe">{{ timing()?.totalStreamTime ?? 'none' }}</span>`,
})
class ProbeComponent {
  readonly timing = injectMessageTiming();
}

let runtime: TestRuntime;

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    ProbeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [auiProvider]="config">
    <aui-thread-messages
      ><ng-template auiMessage><aui-timing-probe /></ng-template
    ></aui-thread-messages>
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

afterEach(() => TestBed.resetTestingModule());

describe('injectMessageTiming', () => {
  it('reads metadata.timing of assistant messages only', async () => {
    runtime = createTestRuntime();
    const timing = { streamStartTime: 1, totalStreamTime: 1500, totalChunks: 3, toolCallCount: 0 };
    runtime.append({
      role: 'user',
      content: [{ type: 'text', text: 'hi' }],
      metadata: { timing } as never,
    });
    runtime.append({
      role: 'assistant',
      content: [{ type: 'text', text: 'hello' }],
      metadata: { timing } as never,
    });
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await settle(fixture);
    const probes = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.probe'),
      (el) => el.textContent?.trim(),
    );
    expect(probes).toEqual(['none', '1500']);
  });
});
