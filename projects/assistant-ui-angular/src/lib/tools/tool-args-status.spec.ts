// Ported from packages/core/src/react/model-context/useToolArgsStatus.test.tsx @ 7d74276
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { flushTapSync } from '@assistant-ui/tap';
import { markPartialJsonObjectComplete } from 'assistant-stream/internal';
import { parsePartialJsonObject } from 'assistant-stream/utils';
import { describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime, type TestRuntime } from '../../testing-internal/test-runtime';
import {
  AuiMessagePartsComponent,
  AuiPartTemplateDirective,
} from '../primitives/message-parts.component';
import {
  AuiMessageTemplateDirective,
  AuiThreadMessagesComponent,
} from '../primitives/thread-messages.component';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { computeToolArgsStatus, injectToolArgsStatus } from './tool-args-status';

type Part = Parameters<typeof computeToolArgsStatus>[0];

const running = (args: Record<string, unknown>, argsText = ''): Part =>
  ({ type: 'tool-call', status: { type: 'running' }, args, argsText }) as unknown as Part;

describe('computeToolArgsStatus', () => {
  it.each(['', '{', '{"city":"Paris",', '{"city":"Par'])(
    'reports the whole object as streaming for %j',
    (json) => {
      const result = computeToolArgsStatus<{ city: string; unit: string }>(
        running(parsePartialJsonObject(json)!),
      );
      expect(result.argsStatus).toBe('streaming');
      expect(result.propStatus.unit).toBeUndefined();
      expect(result.status).toBe('running');
    },
  );

  it.each(['{}', '{"city":"Paris"}'])(
    'reports complete arguments while the tool is still running for %j',
    (json) => {
      const result = computeToolArgsStatus(running(parsePartialJsonObject(json)!));
      expect(result.argsStatus).toBe('complete');
      expect(result.status).toBe('running');
    },
  );

  it('does not infer object completion from completed fields', () => {
    const result = computeToolArgsStatus(running(parsePartialJsonObject('{"city":"Paris",')!));
    expect(result.propStatus['city']).toBe('complete');
    expect(result.argsStatus).toBe('streaming');
  });

  it.each(['complete', 'incomplete', 'requires-action'])(
    'settles argument streaming when the lifecycle becomes %s',
    (type) => {
      const part = running(parsePartialJsonObject('{"city":"Par')!);
      expect(computeToolArgsStatus(part).propStatus['city']).toBe('streaming');
      const settled = computeToolArgsStatus({ ...part, status: { type } } as unknown as Part);
      expect(settled.argsStatus).toBe('complete');
      expect(settled.propStatus['city']).toBe('complete');
      expect(settled.status).toBe(type);
    },
  );

  it('does not infer completion from serialized partial snapshots', () => {
    const result = computeToolArgsStatus(running({ city: 'Paris' }, '{"city":"Paris"}'));
    expect(result.argsStatus).toBe('streaming');
    expect(result.propStatus['city']).toBe('streaming');
  });

  it('updates when the parser completes the object before execution finishes', () => {
    const result = computeToolArgsStatus(
      running(parsePartialJsonObject('{"city":"Paris","unit":"c"}')!),
    );
    expect(result.argsStatus).toBe('complete');
    expect(result.propStatus['unit']).toBe('complete');
    expect(result.status).toBe('running');
  });

  it('reports status for an argument named __proto__', () => {
    const result = computeToolArgsStatus({
      type: 'tool-call',
      status: { type: 'complete' },
      args: JSON.parse('{"__proto__":"value"}'),
      argsText: '{"__proto__":"value"}',
    } as unknown as Part);
    expect(Object.hasOwn(result.propStatus, '__proto__')).toBe(true);
    expect(result.propStatus['__proto__']).toBe('complete');
  });

  it('reports finalized prototype-named arguments complete while the tool runs', () => {
    const result = computeToolArgsStatus(
      running(markPartialJsonObjectComplete(JSON.parse('{"__proto__":{"polluted":true}}'))),
    );
    expect(result.status).toBe('running');
    expect(result.argsStatus).toBe('complete');
    expect(Object.hasOwn(result.propStatus, '__proto__')).toBe(true);
    expect(result.propStatus['__proto__']).toBe('complete');
    expect(Object.prototype).not.toHaveProperty('polluted');
  });
});

let current: TestRuntime;

@Component({
  selector: 'aui-test-args-probe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="probe">{{ status().status }}/{{ status().argsStatus }}</span>`,
})
class ProbeComponent {
  readonly status = injectToolArgsStatus();
}

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessagePartsComponent,
    AuiPartTemplateDirective,
    ProbeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage>
          <aui-message-parts>
            <ng-template auiPart="tool-call"><aui-test-args-probe /></ng-template>
          </aui-message-parts>
        </ng-template>
      </aui-thread-messages>
    </div>
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

describe('injectToolArgsStatus', () => {
  it('reads the tool-call part of the enclosing part scope', async () => {
    current = createTestRuntime();
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    flushTapSync(() =>
      current.append({
        id: 'a1',
        role: 'assistant',
        content: [
          { type: 'tool-call', toolCallId: 'c1', toolName: 'weather', args: { city: 'Paris' } },
        ],
        status: { type: 'complete', reason: 'stop' },
      }),
    );
    await vi.waitFor(async () => {
      await settle(fixture);
      expect((fixture.nativeElement as HTMLElement).querySelector('.probe')?.textContent).toMatch(
        /\/complete$/,
      );
    });
    fixture.destroy();
  });
});
