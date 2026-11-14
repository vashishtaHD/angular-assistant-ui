// Ported from packages/core/src/react/primitives/message/MessageGroupedParts.test.tsx @ 7d74276
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { AuiConfig } from '@assistant-ui/store/client';
import { flushTapSync } from '@assistant-ui/tap';
import { describe, expect, it } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime, type DemoMessage } from '../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { groupPartByType } from '../utils/group-parts';
import { AuiPartTemplateDirective } from './message-parts.component';
import {
  AuiGroupChildrenComponent,
  AuiGroupTemplateDirective,
  AuiIndicatorTemplateDirective,
  AuiMessageGroupedPartsComponent,
  type AuiGroupBy,
  type AuiIndicatorMode,
} from './message-grouped-parts.component';
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

const tools = groupPartByType({
  reasoning: ['group-thought', 'group-reasoning'],
  'tool-call': ['group-thought', 'group-tool'],
});
const toolsOnly = groupPartByType({ 'tool-call': ['group-tool'] });

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessageGroupedPartsComponent,
    AuiGroupChildrenComponent,
    AuiGroupTemplateDirective,
    AuiIndicatorTemplateDirective,
    AuiPartTemplateDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage>
          <section class="msg">
            <aui-message-grouped-parts [groupBy]="groupBy()" [indicator]="indicator()">
              <ng-template auiGroup="group-thought" let-group>
                <div class="thought" [attr.data-status]="group.status.type">
                  <aui-group-children [group]="group" />
                </div>
              </ng-template>
              <ng-template auiGroup="group-tool" let-group let-parts="parts">
                <div
                  class="tools"
                  [attr.data-count]="parts.length"
                  [attr.data-complete]="group.counts.complete"
                  [attr.data-running]="group.counts.running"
                >
                  <aui-group-children [group]="group" />
                </div>
              </ng-template>
              <ng-template auiPart="text" let-part
                ><p class="text">{{ part.type === 'text' ? part.text : '' }}</p></ng-template
              >
              <ng-template auiPart="reasoning" let-part
                ><em class="reasoning">{{
                  part.type === 'reasoning' ? part.text : ''
                }}</em></ng-template
              >
              <ng-template auiPart="tool-call" let-part
                ><i class="tool">{{
                  part.type === 'tool-call' ? part.toolName : ''
                }}</i></ng-template
              >
              <ng-template auiIndicator><b class="indicator">...</b></ng-template>
            </aui-message-grouped-parts>
          </section>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class HostComponent {
  readonly config = hostConfig;
  readonly groupBy = input<AuiGroupBy>(tools);
  readonly indicator = input<AuiIndicatorMode>('no-text');
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
          <aui-message-grouped-parts [groupBy]="groupBy">
            <ng-template auiPart="text" let-part
              ><p class="text">{{ part.type === 'text' ? part.text : '' }}</p></ng-template
            >
            <ng-template auiPart="tool-call" let-part
              ><i class="tool">{{ part.type === 'tool-call' ? part.toolName : '' }}</i></ng-template
            >
          </aui-message-grouped-parts>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class NoGroupTemplateHostComponent {
  readonly config = hostConfig;
  readonly groupBy = toolsOnly;
}

const call = (name: string, id: string, result?: unknown) => ({
  type: 'tool-call' as const,
  toolCallId: id,
  toolName: name,
  args: {},
  ...(result === undefined ? {} : { result }),
});
const text = (value: string) => ({ type: 'text' as const, text: value });
const reasoning = (value: string) => ({ type: 'reasoning' as const, text: value });

const mount = async (
  content: DemoMessage['content'],
  opts: {
    running?: boolean;
    groupBy?: AuiGroupBy;
    indicator?: AuiIndicatorMode;
    host?: new () => unknown;
  } = {},
) => {
  TestBed.resetTestingModule();
  const rt = createTestRuntime();
  rt.append({ role: 'user', content: [text('q')] });
  rt.append({ id: 'a1', role: 'assistant', content });
  if (opts.running) rt.setRunning(true);
  hostConfig = rt.config;
  const host = opts.host ?? HostComponent;
  configureTestBed({ imports: [host] });
  const fixture = TestBed.createComponent(host as new () => unknown);
  if (opts.groupBy) fixture.componentRef.setInput('groupBy', opts.groupBy);
  if (opts.indicator) fixture.componentRef.setInput('indicator', opts.indicator);
  fixture.detectChanges();
  await settle(fixture);
  const el = fixture.nativeElement as HTMLElement;
  const assistant = el.querySelectorAll<HTMLElement>('.msg')[1] ?? el;
  return { fixture, rt, el, assistant };
};

const shape = (root: HTMLElement): string[] =>
  Array.from(root.querySelectorAll('.text, .reasoning, .tool, .thought, .tools, .indicator')).map(
    (node) => {
      const kind = node.className;
      if (kind === 'thought' || kind === 'tools') return `[${kind}`;
      return `${kind}:${node.textContent}`;
    },
  );

describe('MessagePrimitive.GroupedParts', () => {
  it('groups consecutive tool calls and leaves other parts in place', async () => {
    const { assistant } = await mount([
      text('intro'),
      call('a', 't1'),
      call('b', 't2'),
      text('middle'),
      call('c', 't3'),
    ]);
    const groups = assistant.querySelectorAll('.thought');
    expect(groups.length).toBe(2);
    expect(Array.from(groups[0]!.querySelectorAll('.tool')).map((n) => n.textContent)).toEqual([
      'a',
      'b',
    ]);
    expect(Array.from(groups[1]!.querySelectorAll('.tool')).map((n) => n.textContent)).toEqual([
      'c',
    ]);
    expect(Array.from(assistant.querySelectorAll('.text')).map((n) => n.textContent)).toEqual([
      'intro',
      'middle',
    ]);
    // Document order: intro, [a b], middle, [c].
    expect(shape(assistant)).toEqual([
      'text:intro',
      '[thought',
      '[tools',
      'tool:a',
      'tool:b',
      'text:middle',
      '[thought',
      '[tools',
      'tool:c',
    ]);
  });

  it('nests groups by path prefix', async () => {
    const { assistant } = await mount([
      reasoning('think'),
      call('a', 't1'),
      reasoning('more'),
      text('answer'),
    ]);
    const thought = assistant.querySelector('.thought')!;
    expect(thought.querySelectorAll('.reasoning').length).toBe(2);
    expect(thought.querySelectorAll('.tools').length).toBe(1);
    expect(thought.querySelector('.tools .tool')?.textContent).toBe('a');
    expect(shape(assistant)).toEqual([
      '[thought',
      'reasoning:think',
      '[tools',
      'tool:a',
      'reasoning:more',
      'text:answer',
    ]);
  });

  it('hands the group and its parts to the group template', async () => {
    const { assistant } = await mount(
      [call('a', 't1', { ok: true }), call('b', 't2'), call('c', 't3', { ok: true })],
      { groupBy: toolsOnly },
    );
    const tools = assistant.querySelector('.tools')!;
    expect(tools.getAttribute('data-count')).toBe('3');
    expect(tools.getAttribute('data-complete')).toBe('2');
  });

  it('reports a running group while a contained part runs', async () => {
    const { assistant } = await mount([reasoning('thinking')], { running: true });
    expect(assistant.querySelector('.thought')?.getAttribute('data-status')).toBe('running');
  });

  it('renders the children of a group that has no template', async () => {
    const { assistant } = await mount([call('a', 't1'), call('b', 't2')], {
      host: NoGroupTemplateHostComponent,
    });
    expect(Array.from(assistant.querySelectorAll('.tool')).map((n) => n.textContent)).toEqual([
      'a',
      'b',
    ]);
  });

  it('keeps the group element while parts stream into it', async () => {
    const { fixture, rt, assistant } = await mount([call('a', 't1')]);
    const group = assistant.querySelector('.thought');
    const leaf = assistant.querySelector('.tool');
    expect(group).not.toBeNull();
    flushTapSync(() =>
      rt.setMessages([
        { role: 'user', content: [text('q')] },
        { id: 'a1', role: 'assistant', content: [call('a', 't1'), call('b', 't2')] },
      ]),
    );
    await settle(fixture);
    expect(assistant.querySelectorAll('.tool').length).toBe(2);
    expect(assistant.querySelector('.thought')).toBe(group);
    expect(assistant.querySelector('.tool')).toBe(leaf);
  });

  it('regroups when groupBy changes', async () => {
    const { fixture, assistant } = await mount([call('a', 't1'), call('b', 't2')]);
    expect(assistant.querySelectorAll('.thought').length).toBe(1);
    fixture.componentRef.setInput('groupBy', groupPartByType({}));
    await settle(fixture);
    expect(assistant.querySelectorAll('.thought').length).toBe(0);
    expect(assistant.querySelectorAll('.tool').length).toBe(2);
  });

  describe('indicator', () => {
    it('shows after a trailing tool call while the message runs', async () => {
      const { assistant } = await mount([text('hi'), call('a', 't1')], { running: true });
      expect(assistant.querySelector('.indicator')).not.toBeNull();
    });

    it('is hidden when the last part is text', async () => {
      const { assistant } = await mount([call('a', 't1'), text('hi')], { running: true });
      expect(assistant.querySelector('.indicator')).toBeNull();
    });

    it('is never shown on a settled message', async () => {
      const { assistant } = await mount([call('a', 't1')], { indicator: 'always' });
      expect(assistant.querySelector('.indicator')).toBeNull();
    });

    it('follows the indicator mode', async () => {
      const always = await mount([text('hi')], { running: true, indicator: 'always' });
      expect(always.assistant.querySelector('.indicator')).not.toBeNull();
      const never = await mount([call('a', 't1')], { running: true, indicator: 'never' });
      expect(never.assistant.querySelector('.indicator')).toBeNull();
      const empty = await mount([text('hi')], { running: true, indicator: 'empty' });
      expect(empty.assistant.querySelector('.indicator')).toBeNull();
    });
  });
});
