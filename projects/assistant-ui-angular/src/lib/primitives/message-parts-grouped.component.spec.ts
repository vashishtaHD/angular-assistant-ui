// Ported from packages/react/src/primitives/message/MessagePartsGrouped.tsx @ 7d74276
// (Unstable_PartsGrouped / Unstable_PartsGroupedByParentId)
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { AuiConfig } from '@assistant-ui/store/client';
import { flushTapSync } from '@assistant-ui/tap';
import { describe, expect, it } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime, type DemoMessage } from '../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { AuiPartInProgressDirective } from './part-in-progress.directive';
import { AuiPartTextComponent } from './part-text.component';
import { groupMessagePartsByParentId, type GroupingFunction } from '../utils/group-parts';
import {
  AuiEmptyTemplateDirective,
  AuiGroupChildrenComponent,
  AuiGroupTemplateDirective,
  AuiMessageGroupedPartsComponent,
} from './message-grouped-parts.component';
import { AuiPartTemplateDirective } from './message-parts.component';
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
    AuiMessageGroupedPartsComponent,
    AuiGroupChildrenComponent,
    AuiGroupTemplateDirective,
    AuiPartTemplateDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage>
          <section class="msg">
            @if (grouping(); as fn) {
              <aui-message-parts-grouped [groupingFunction]="fn" [indicator]="'never'">
                <ng-template auiGroup="default" let-group>
                  <div class="g" [attr.data-key]="group.groupKey">
                    <aui-group-children [group]="group" />
                  </div>
                </ng-template>
                <ng-template auiPart="tool-call" let-part
                  ><i class="tool">{{
                    part.type === 'tool-call' ? part.toolName : ''
                  }}</i></ng-template
                >
              </aui-message-parts-grouped>
            } @else {
              <aui-message-parts-grouped>
                <ng-template auiGroup="default" let-group>
                  <div class="g" [attr.data-key]="group.groupKey">
                    <aui-group-children [group]="group" />
                  </div>
                </ng-template>
                <ng-template auiPart="tool-call" let-part
                  ><i class="tool">{{
                    part.type === 'tool-call' ? part.toolName : ''
                  }}</i></ng-template
                >
              </aui-message-parts-grouped>
            }
          </section>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class HostComponent {
  readonly config = hostConfig;
  readonly grouping = input<GroupingFunction | undefined>(undefined);
}

const call = (name: string, parentId?: string) => ({
  type: 'tool-call' as const,
  toolCallId: `id-${name}`,
  toolName: name,
  args: {},
  ...(parentId ? { parentId } : {}),
});

const mount = async (content: DemoMessage['content'], grouping?: GroupingFunction) => {
  TestBed.resetTestingModule();
  const rt = createTestRuntime();
  rt.append({ id: 'a1', role: 'assistant', content });
  hostConfig = rt.config;
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  if (grouping) fixture.componentRef.setInput('grouping', grouping);
  fixture.detectChanges();
  await settle(fixture);
  return { fixture, rt, el: fixture.nativeElement as HTMLElement };
};

/** Document-order dump: `[key` for a group, then tool names. */
const shape = (el: HTMLElement) =>
  Array.from(el.querySelectorAll('.g, .tool')).map((node) =>
    node.classList.contains('g') ? `[${node.getAttribute('data-key')}` : node.textContent,
  );

describe('MessagePrimitive.Unstable_PartsGrouped', () => {
  it('clusters non-adjacent parts of one parent at its first occurrence', async () => {
    const { el } = await mount([
      call('a1', 'A'),
      call('b1', 'B'),
      call('a2', 'A'),
      call('solo'),
      call('b2', 'B'),
    ]);
    expect(shape(el)).toEqual(['[A', 'a1', 'a2', '[B', 'b1', 'b2', '[null', 'solo']);
  });

  it('wraps unparented parts in a group without a key, in their chronological position', async () => {
    const { el } = await mount([call('x'), call('a1', 'A'), call('y'), call('a2', 'A')]);
    expect(shape(el)).toEqual(['[null', 'x', '[A', 'a1', 'a2', '[null', 'y']);
  });

  it('adds streamed parts to their cluster without recreating it', async () => {
    const { fixture, rt, el } = await mount([call('a1', 'A'), call('b1', 'B')]);
    const groupA = el.querySelector('.g');
    flushTapSync(() =>
      rt.setMessages([
        {
          id: 'a1',
          role: 'assistant',
          content: [call('a1', 'A'), call('b1', 'B'), call('a2', 'A')],
        },
      ]),
    );
    await settle(fixture);
    expect(shape(el)).toEqual(['[A', 'a1', 'a2', '[B', 'b1']);
    expect(el.querySelector('.g')).toBe(groupA);
  });

  it('accepts a custom grouping function', async () => {
    const byName: GroupingFunction = (parts) => [
      { groupKey: 'first', indices: [0, 2] },
      { groupKey: undefined, indices: [1] },
      { groupKey: undefined, indices: parts.length > 3 ? [3] : [] },
    ];
    const { el } = await mount([call('p'), call('q'), call('r')], byName);
    expect(shape(el)).toEqual(['[first', 'p', 'r', '[null', 'q']);
  });

  it('groups by parent id by default (the exported grouping function)', () => {
    expect(groupMessagePartsByParentId([{ parentId: 'A' }, {}, { parentId: 'A' }])).toEqual([
      { groupKey: 'A', indices: [0, 2] },
      { groupKey: undefined, indices: [1] },
    ]);
  });
});

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessageGroupedPartsComponent,
    AuiEmptyTemplateDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage>
          <aui-message-parts-grouped>
            <ng-template auiEmpty let-status
              ><em class="empty">{{ status.type }}</em></ng-template
            >
          </aui-message-parts-grouped>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class EmptyTemplateHostComponent {
  readonly config = hostConfig;
}

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessageGroupedPartsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage><aui-message-parts-grouped /></ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class EmptyDefaultHostComponent {
  readonly config = hostConfig;
}

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessageGroupedPartsComponent,
    AuiPartTemplateDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage>
          <aui-message-parts-grouped>
            <ng-template auiPart="text" let-part
              ><b class="text-slot"
                >{{ part.type === 'text' ? part.text : 'x' }}|{{ part.status.type }}</b
              ></ng-template
            >
          </aui-message-parts-grouped>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class EmptyTextTemplateHostComponent {
  readonly config = hostConfig;
}

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessageGroupedPartsComponent,
    AuiPartTemplateDirective,
    AuiPartTextComponent,
    AuiPartInProgressDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage>
          <aui-message-parts-grouped>
            <ng-template auiPart="text"
              ><aui-part-text class="scoped" /><i *auiPartInProgress class="busy"
                >...</i
              ></ng-template
            >
          </aui-message-parts-grouped>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class EmptyScopedTextHostComponent {
  readonly config = hostConfig;
}

const mountEmpty = async (
  host: new () => unknown,
  running: boolean,
  status?: DemoMessage['status'],
) => {
  TestBed.resetTestingModule();
  const rt = createTestRuntime();
  rt.append({ id: 'a1', role: 'assistant', content: [], ...(status ? { status } : {}) });
  if (running) rt.setRunning(true);
  hostConfig = rt.config;
  configureTestBed({ imports: [host as never] });
  const fixture = TestBed.createComponent(host);
  fixture.detectChanges();
  await settle(fixture);
  return fixture.nativeElement as HTMLElement;
};

describe('MessagePrimitive.Unstable_PartsGrouped empty message', () => {
  it('renders the auiEmpty template with the message status', async () => {
    const el = await mountEmpty(EmptyTemplateHostComponent, true);
    expect(el.querySelector('.empty')?.textContent).toBe('running');
    const done = await mountEmpty(EmptyTemplateHostComponent, false);
    expect(done.querySelector('.empty')?.textContent).toBe('complete');
  });

  it('renders the consumer text template with an empty running text part', async () => {
    const running = await mountEmpty(EmptyTextTemplateHostComponent, true);
    expect(running.querySelector('.text-slot')?.textContent).toBe('|running');
    const done = await mountEmpty(EmptyTextTemplateHostComponent, false);
    expect(done.querySelector('.text-slot')?.textContent).toBe('|complete');
    expect(done.querySelector('p')).toBeNull();
  });

  it('lets the empty text template use part primitives (aui-part-text, *auiPartInProgress)', async () => {
    const running = await mountEmpty(EmptyScopedTextHostComponent, true);
    expect(running.querySelector('aui-part-text.scoped')?.getAttribute('data-status')).toBe(
      'running',
    );
    expect(running.querySelector('.busy')).not.toBeNull();
    const done = await mountEmpty(EmptyScopedTextHostComponent, false);
    expect(done.querySelector('aui-part-text.scoped')?.getAttribute('data-status')).toBe(
      'complete',
    );
    expect(done.querySelector('.busy')).toBeNull();
  });

  it('reports the collapsed running/complete status on the default paragraph', async () => {
    const running = await mountEmpty(EmptyDefaultHostComponent, true);
    expect(running.querySelector('p aui-part-text')?.getAttribute('data-status')).toBe('running');
    const cancelled = await mountEmpty(EmptyDefaultHostComponent, false, {
      type: 'incomplete',
      reason: 'cancelled',
    });
    expect(cancelled.querySelector('p aui-part-text')?.getAttribute('data-status')).toBe(
      'complete',
    );
  });

  it('falls back to an empty text paragraph with the in-progress marker while running', async () => {
    const running = await mountEmpty(EmptyDefaultHostComponent, true);
    expect(running.querySelector('p')?.textContent?.trim()).toBe('●');
    const done = await mountEmpty(EmptyDefaultHostComponent, false);
    expect(done.querySelector('p')?.textContent).toBe('');
  });
});
