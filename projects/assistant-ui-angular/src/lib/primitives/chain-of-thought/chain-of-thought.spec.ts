// Ported from packages/vue/src/primitives/ChainOfThoughtPrimitiveParts.test.ts @ 7d74276
// and packages/vue/src/primitives/ChainOfThoughtPrimitiveAccordionTrigger.test.ts @ 7d74276
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { AuiConfig, type AssistantClient } from '@assistant-ui/store/client';
import { flushTapSync } from '@assistant-ui/tap';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../../testing-internal/test-bed';
import { createTestRuntime, type DemoMessage } from '../../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../../provider/aui-provider.directive';
import { injectAui } from '../../state/inject-aui';
import { injectAuiState } from '../../state/inject-aui-state';
import {
  AuiChainOfThoughtTemplateDirective,
  AuiMessagePartsComponent,
  AuiPartTemplateDirective,
} from '../message-parts.component';
import {
  AuiMessageTemplateDirective,
  AuiThreadMessagesComponent,
} from '../thread-messages.component';
import { AuiChainOfThoughtAccordionTriggerDirective } from './accordion-trigger';
import { AuiChainOfThoughtPartsComponent } from './parts';
import { AuiChainOfThoughtRootDirective } from './root';

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await Promise.resolve();
  }
};

const waitFor = async (fixture: ComponentFixture<unknown>, assertion: () => void) => {
  await vi.waitFor(async () => {
    await settle(fixture);
    assertion();
  });
};

let hostConfig: AuiConfig;
let capturedAui: AssistantClient | undefined;

@Component({
  selector: 'aui-test-cot-capture',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class CaptureComponent {
  constructor() {
    capturedAui = injectAui();
  }
}

@Component({
  selector: 'aui-test-cot-body',
  standalone: true,
  imports: [
    AuiChainOfThoughtRootDirective,
    AuiChainOfThoughtAccordionTriggerDirective,
    AuiChainOfThoughtPartsComponent,
    AuiPartTemplateDirective,
    CaptureComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div auiChainOfThoughtRoot class="cot">
      <aui-test-cot-capture />
      <button auiChainOfThoughtAccordionTrigger class="trigger">toggle</button>
      <span class="status">{{ status() }}</span>
      @if (!collapsed()) {
        <aui-chain-of-thought-parts>
          <ng-template auiPart="reasoning" let-part>
            <i class="reasoning">{{ part.type === 'reasoning' ? part.text : '' }}</i>
          </ng-template>
          <ng-template auiPart="tool-call" let-part>
            <code class="tool">{{ part.type === 'tool-call' ? part.toolName : '' }}</code>
          </ng-template>
        </aui-chain-of-thought-parts>
      }
    </div>
  `,
})
class CotBodyComponent {
  readonly collapsed = injectAuiState((s) => s.chainOfThought.collapsed);
  readonly status = injectAuiState((s) => s.chainOfThought.status.type);
}

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessagePartsComponent,
    AuiPartTemplateDirective,
    AuiChainOfThoughtTemplateDirective,
    CotBodyComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage>
          <li>
            <aui-message-parts>
              <ng-template auiChainOfThought><aui-test-cot-body /></ng-template>
            </aui-message-parts>
          </li>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class GroupedHostComponent {
  readonly config = hostConfig;
}

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessagePartsComponent,
    AuiPartTemplateDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage>
          <li>
            <aui-message-parts>
              <ng-template auiPart="reasoning" let-part>
                <i class="plain-reasoning">{{ part.type === 'reasoning' ? part.text : '' }}</i>
              </ng-template>
            </aui-message-parts>
          </li>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class PlainHostComponent {
  readonly config = hostConfig;
}

const mount = async <T>(host: new () => T, config: AuiConfig) => {
  hostConfig = config;
  configureTestBed({ imports: [host] });
  const fixture = TestBed.createComponent(host);
  fixture.detectChanges();
  await settle(fixture);
  return fixture;
};

const root = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;

const reasoning = (text: string) => ({ type: 'reasoning' as const, text });
const tool = (toolName: string, id = toolName) => ({
  type: 'tool-call' as const,
  toolCallId: id,
  toolName,
  args: {},
});
const message = (content: DemoMessage['content'], id = 'a1'): DemoMessage => ({
  id,
  role: 'assistant',
  content,
});

describe('chain of thought', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    capturedAui = undefined;
  });

  it('collapses consecutive reasoning and tool parts into one chain of thought', async () => {
    const rt = createTestRuntime();
    const fixture = await mount(GroupedHostComponent, rt.config);
    flushTapSync(() =>
      rt.setMessages([
        message([
          reasoning('r1'),
          tool('search'),
          reasoning('r2'),
          { type: 'text', text: 'answer' },
          reasoning('r3'),
        ]),
      ]),
    );
    await waitFor(fixture, () => expect(root(fixture).querySelectorAll('.cot')).toHaveLength(2));
    expect(root(fixture).querySelector('p')?.textContent).toBe('answer');

    // Collapsed by default: parts are hidden by the caller's gate.
    expect(root(fixture).querySelectorAll('.reasoning, .tool')).toHaveLength(0);
    for (const cot of Array.from(root(fixture).querySelectorAll('.cot'))) {
      expect(cot.hasAttribute('data-collapsed')).toBe(true);
    }

    root(fixture).querySelectorAll<HTMLButtonElement>('.trigger')[0]!.click();
    await waitFor(fixture, () =>
      expect(
        Array.from(root(fixture).querySelectorAll('.reasoning, .tool')).map((e) => e.textContent),
      ).toEqual(['r1', 'search', 'r2']),
    );
    fixture.destroy();
  });

  it('toggles aria-expanded and shows or hides the parts', async () => {
    const rt = createTestRuntime();
    const fixture = await mount(GroupedHostComponent, rt.config);
    flushTapSync(() => rt.setMessages([message([reasoning('thinking')])]));
    await waitFor(fixture, () => expect(root(fixture).querySelector('.trigger')).not.toBeNull());
    const button = root(fixture).querySelector<HTMLButtonElement>('.trigger')!;
    const cot = root(fixture).querySelector('.cot')!;

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('type')).toBe('button');
    expect(root(fixture).querySelector('.reasoning')).toBeNull();

    button.click();
    await waitFor(fixture, () => {
      expect(button.getAttribute('aria-expanded')).toBe('true');
      expect(root(fixture).querySelector('.reasoning')?.textContent).toBe('thinking');
      expect(cot.hasAttribute('data-collapsed')).toBe(false);
    });

    button.click();
    await waitFor(fixture, () => {
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(root(fixture).querySelector('.reasoning')).toBeNull();
      expect(cot.hasAttribute('data-collapsed')).toBe(true);
    });
    fixture.destroy();
  });

  it('stays collapsed on completion unless the user expanded it, and keeps state while streaming', async () => {
    const rt = createTestRuntime();
    const fixture = await mount(GroupedHostComponent, rt.config);
    flushTapSync(() => rt.setMessages([message([reasoning('a')])]));
    await waitFor(fixture, () => expect(root(fixture).querySelector('.trigger')).not.toBeNull());
    const button = root(fixture).querySelector<HTMLButtonElement>('.trigger')!;
    button.click();
    await waitFor(fixture, () => expect(button.getAttribute('aria-expanded')).toBe('true'));

    // The chain grows while streaming; the same group (and its state) stays.
    flushTapSync(() => rt.setMessages([message([reasoning('a'), tool('search')])]));
    await waitFor(fixture, () => expect(root(fixture).querySelectorAll('.tool')).toHaveLength(1));
    expect(root(fixture).querySelector<HTMLButtonElement>('.trigger')).toBe(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');

    // Upstream has no auto-collapse: completion does not change `collapsed`.
    flushTapSync(() => rt.setRunning(false));
    await waitFor(fixture, () => expect(root(fixture).querySelector('.status')).not.toBeNull());
    expect(button.getAttribute('aria-expanded')).toBe('true');
    fixture.destroy();
  });

  it('exposes the chain of thought scope with the grouped parts', async () => {
    const rt = createTestRuntime();
    const fixture = await mount(GroupedHostComponent, rt.config);
    flushTapSync(() => rt.setMessages([message([{ type: 'text', text: 'x' }, reasoning('r')])]));
    await waitFor(fixture, () => expect(capturedAui).toBeDefined());
    expect(capturedAui!.chainOfThought.getState().parts.map((p) => p.type)).toEqual(['reasoning']);
    expect(capturedAui!.chainOfThought.getState().collapsed).toBe(true);
    fixture.destroy();
  });

  it('does not group without the auiChainOfThought template', async () => {
    const rt = createTestRuntime();
    const fixture = await mount(PlainHostComponent, rt.config);
    flushTapSync(() => rt.setMessages([message([reasoning('r1'), reasoning('r2')])]));
    await waitFor(fixture, () =>
      expect(root(fixture).querySelectorAll('.plain-reasoning')).toHaveLength(2),
    );
    fixture.destroy();
  });

  it('follows a parts shrink without errors', async () => {
    const rt = createTestRuntime();
    const fixture = await mount(GroupedHostComponent, rt.config);
    flushTapSync(() => rt.setMessages([message([reasoning('a'), reasoning('b')])]));
    await waitFor(fixture, () => expect(root(fixture).querySelector('.trigger')).not.toBeNull());
    root(fixture).querySelector<HTMLButtonElement>('.trigger')!.click();
    await waitFor(fixture, () =>
      expect(root(fixture).querySelectorAll('.reasoning')).toHaveLength(2),
    );

    const error = vi.spyOn(console, 'error');
    flushTapSync(() => rt.setMessages([message([reasoning('a')])]));
    await waitFor(fixture, () =>
      expect(root(fixture).querySelectorAll('.reasoning')).toHaveLength(1),
    );
    flushTapSync(() => rt.setMessages([message([reasoning('a'), reasoning('c')])]));
    await waitFor(fixture, () =>
      expect(
        Array.from(root(fixture).querySelectorAll('.reasoning')).map((e) => e.textContent),
      ).toEqual(['a', 'c']),
    );
    await new Promise((resolve) => setTimeout(resolve));
    expect(error).not.toHaveBeenCalled();
    fixture.destroy();
  });
});
