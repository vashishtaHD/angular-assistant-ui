// Ported from packages/core/src/react/primitives/part/PartMessages.test.tsx @ 7d74276
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { ThreadMessage } from '@assistant-ui/core';
import type { AuiConfig } from '@assistant-ui/store/client';
import { flushTapSync } from '@assistant-ui/tap';
import { describe, expect, it } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime } from '../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { AuiMessagePartsComponent, AuiPartTemplateDirective } from './message-parts.component';
import { AuiMessageRootDirective } from './message-root.directive';
import { AuiPartMessagesComponent } from './part-messages.component';
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

const userMessage = (id: string, value: string): ThreadMessage => ({
  id,
  role: 'user',
  createdAt: new Date(0),
  content: [{ type: 'text', text: value }],
  attachments: [],
  metadata: { custom: {} },
});

const assistantMessage = (id: string, value: string): ThreadMessage => ({
  id,
  role: 'assistant',
  createdAt: new Date(0),
  content: [{ type: 'text', text: value }],
  status: { type: 'complete', reason: 'stop' },
  metadata: {
    unstable_state: null,
    unstable_annotations: [],
    unstable_data: [],
    steps: [],
    custom: {},
  },
});

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessagePartsComponent,
    AuiPartTemplateDirective,
    AuiPartMessagesComponent,
    AuiMessageRootDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage>
          <div class="outer">
            <aui-message-parts>
              <ng-template auiPart="text" let-part
                ><p class="outer-text">{{ part.type === 'text' ? part.text : '' }}</p></ng-template
              >
              <ng-template auiPart="tool-call">
                <aui-part-messages>
                  <ng-template auiMessage>
                    <div auiMessageRoot class="sub">
                      <aui-message-parts>
                        <ng-template auiPart="text" let-part
                          ><span class="sub-text">{{
                            part.type === 'text' ? part.text : ''
                          }}</span></ng-template
                        >
                        <ng-template auiPart="audio" let-part
                          ><audio
                            class="sub-audio"
                            [attr.data-format]="part.type === 'audio' ? part.audio.format : ''"
                          ></audio
                        ></ng-template>
                      </aui-message-parts>
                    </div>
                  </ng-template>
                </aui-part-messages>
              </ng-template>
            </aui-message-parts>
          </div>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class HostComponent {
  readonly config = hostConfig;
}

const toolCall = (messages?: readonly ThreadMessage[]) => ({
  type: 'tool-call' as const,
  toolCallId: 'call-1',
  toolName: 'invoke_sub_agent',
  args: {},
  ...(messages ? { messages } : {}),
});

const mount = async (messages?: readonly ThreadMessage[]) => {
  TestBed.resetTestingModule();
  const rt = createTestRuntime();
  rt.append({ role: 'user', content: [{ type: 'text', text: 'go' }] });
  rt.append({ id: 'a1', role: 'assistant', content: [toolCall(messages)] });
  hostConfig = rt.config;
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  await settle(fixture);
  return { fixture, rt, el: fixture.nativeElement as HTMLElement };
};

const subTexts = (el: HTMLElement) =>
  Array.from(el.querySelectorAll('.sub-text')).map((node) => node.textContent);

describe('PartPrimitive.Messages', () => {
  it('renders the nested messages of a tool call with the message primitives', async () => {
    const { el } = await mount([
      userMessage('s1', 'sub question'),
      assistantMessage('s2', 'sub answer'),
    ]);
    expect(subTexts(el)).toEqual(['sub question', 'sub answer']);
    const roles = Array.from(el.querySelectorAll('.sub')).map((node) =>
      node.getAttribute('data-role'),
    );
    expect(roles).toEqual(['user', 'assistant']);
    expect(
      Array.from(el.querySelectorAll('.sub')).map((n) => n.getAttribute('data-message-id')),
    ).toEqual(['s1', 's2']);
    // The outer thread's own text parts are untouched.
    expect(el.querySelectorAll('.outer-text').length).toBe(1);
  });

  it('renders an audio part through its auiPart="audio" template', async () => {
    const audio = {
      ...userMessage('s1', ''),
      content: [{ type: 'audio', audio: { data: 'AAAA', format: 'mp3' } }],
    } as unknown as ThreadMessage;
    const { el } = await mount([audio]);
    expect(el.querySelectorAll('.sub-audio').length).toBe(1);
    expect(el.querySelector('.sub-audio')?.getAttribute('data-format')).toBe('mp3');
  });

  it('renders nothing while the tool call has no nested messages', async () => {
    const { el } = await mount();
    expect(el.querySelector('.sub')).toBeNull();
    const empty = await mount([]);
    expect(empty.el.querySelector('.sub')).toBeNull();
  });

  it('follows the nested messages as they change', async () => {
    const { fixture, rt, el } = await mount([userMessage('s1', 'first')]);
    expect(subTexts(el)).toEqual(['first']);
    flushTapSync(() =>
      rt.setMessages([
        { role: 'user', content: [{ type: 'text', text: 'go' }] },
        {
          id: 'a1',
          role: 'assistant',
          content: [toolCall([userMessage('s1', 'first'), assistantMessage('s2', 'second')])],
        },
      ]),
    );
    await settle(fixture);
    expect(subTexts(el)).toEqual(['first', 'second']);
  });
});
