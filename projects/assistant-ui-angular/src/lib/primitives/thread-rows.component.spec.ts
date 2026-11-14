// Ported from packages/core/src/react/primitives/thread/ThreadRow.test.tsx @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { flushTapSync } from '@assistant-ui/tap';
import { describe, expect, it } from 'vitest';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime, type TestRuntime } from '../../testing-internal/test-runtime';
import { AuiPartTemplateDirective } from './message-parts.component';
import {
  AuiThreadRowTemplateDirective,
  AuiThreadRowsComponent,
  createThreadRowsSelector,
} from './thread-rows.component';

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadRowsComponent,
    AuiThreadRowTemplateDirective,
    AuiPartTemplateDirective,
    NgTemplateOutlet,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [auiProvider]="runtime().config">
      <aui-thread-rows>
        <ng-template auiThreadRow let-info>
          @switch (info.type) {
            @case ('message') {
              <div class="row message">{{ info.message.role }}:{{ info.row.key }}</div>
            }
            @case ('part') {
              <div class="row part"><ng-container *ngTemplateOutlet="info.children" /></div>
            }
            @case ('turn-end') {
              <div class="row end">{{ info.row.turnMessageId }}</div>
            }
          }
        </ng-template>
        <ng-template auiPart="text" let-part>
          <span class="text">{{ part.type === 'text' ? part.text : '' }}</span>
        </ng-template>
      </aui-thread-rows>
    </div>
  `,
})
class HostComponent {
  readonly runtime = input.required<TestRuntime>();
}

const text = (value: string) => [{ type: 'text', text: value }] as const;

async function mount(test: TestRuntime) {
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentRef.setInput('runtime', test);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  return fixture;
}

const rowsOf = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('.row')).map((el) => el.textContent?.trim());

describe('aui-thread-rows', () => {
  it('renders message, part and turn-end rows in order', async () => {
    const test = createTestRuntime();
    flushTapSync(() => test.append({ id: 'u1', role: 'user', content: text('hi') }));
    flushTapSync(() => test.append({ id: 'a1', role: 'assistant', content: text('hello') }));
    const fixture = await mount(test);
    const root = fixture.nativeElement as HTMLElement;

    expect(rowsOf(root)).toEqual(['user:message:u1', 'hello', 'u1']);
    expect(root.querySelector('.row.part .text')?.textContent).toBe('hello');
  });

  it('keeps row DOM across streaming deltas and drops rows of removed messages', async () => {
    const test = createTestRuntime();
    flushTapSync(() => test.append({ id: 'u1', role: 'user', content: text('hi') }));
    flushTapSync(() => test.append({ id: 'a1', role: 'assistant', content: text('he') }));
    const fixture = await mount(test);
    const root = fixture.nativeElement as HTMLElement;
    const partRow = root.querySelector('.row.part');

    flushTapSync(() =>
      test.setMessages([
        { id: 'u1', role: 'user', content: text('hi') },
        { id: 'a1', role: 'assistant', content: text('hello') },
      ]),
    );
    await fixture.whenStable();
    expect(root.querySelector('.row.part')).toBe(partRow);
    expect(root.querySelector('.row.part .text')?.textContent).toBe('hello');

    flushTapSync(() => test.setMessages([{ id: 'u1', role: 'user', content: text('hi') }]));
    await fixture.whenStable();
    expect(rowsOf(root)).toEqual(['user:message:u1']);
  });
});

describe('createThreadRowsSelector', () => {
  it('is re-exported from core', () => {
    expect(typeof createThreadRowsSelector).toBe('function');
  });
});
