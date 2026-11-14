// Ported from packages/core/src/react/primitives/message/MessageGroupedParts.test.tsx @ 7d74276
// (the render-function-first contract: a leaf's own renderer beats a registered UI)
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { AuiConfig } from '@assistant-ui/store/client';
import { flushTapSync } from '@assistant-ui/tap';
import { describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime } from '../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { registerToolUI, type ToolUIProps } from '../tools/tool-ui';
import { AuiPartTemplateDirective } from './message-parts.component';
import { AuiMessageGroupedPartsComponent } from './message-grouped-parts.component';
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
  selector: 'aui-test-registered-tool',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<b class="registered">{{ tool().part.toolName }}</b>`,
})
class RegisteredToolComponent {
  readonly tool = input.required<ToolUIProps>();
}

@Component({
  selector: 'aui-test-registrar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class RegistrarComponent {
  constructor() {
    registerToolUI('reg', RegisteredToolComponent);
  }
}

const noGroups = () => [];

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    RegistrarComponent,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessageGroupedPartsComponent,
    AuiPartTemplateDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-test-registrar />
      <aui-thread-messages>
        <ng-template auiMessage>
          <aui-message-grouped-parts [groupBy]="groupBy">
            <ng-template auiPart="tool-call"><u class="explicit">explicit</u></ng-template>
          </aui-message-grouped-parts>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class ExplicitHostComponent {
  readonly config = hostConfig;
  readonly groupBy = noGroups;
}

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    RegistrarComponent,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessageGroupedPartsComponent,
    AuiPartTemplateDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-test-registrar />
      <aui-thread-messages>
        <ng-template auiMessage>
          <aui-message-grouped-parts [groupBy]="groupBy">
            <ng-template auiPart="tool-call"></ng-template>
          </aui-message-grouped-parts>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class EmptyHostComponent {
  readonly config = hostConfig;
  readonly groupBy = noGroups;
}

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    RegistrarComponent,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessageGroupedPartsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-test-registrar />
      <aui-thread-messages>
        <ng-template auiMessage>
          <aui-message-grouped-parts [groupBy]="groupBy" />
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class AbsentHostComponent {
  readonly config = hostConfig;
  readonly groupBy = noGroups;
}

const mount = async (host: new () => unknown, toolNames = ['reg', 'other']) => {
  TestBed.resetTestingModule();
  const rt = createTestRuntime();
  hostConfig = rt.config;
  configureTestBed({ imports: [host as never] });
  const fixture = TestBed.createComponent(host);
  fixture.detectChanges();
  await settle(fixture);
  // Append once the registrar has bound to the tools scope (as the tool UI specs do).
  flushTapSync(() =>
    rt.append({
      role: 'assistant',
      content: toolNames.map((toolName, i) => ({
        type: 'tool-call' as const,
        toolCallId: `c${i}`,
        toolName,
        args: {},
      })),
    }),
  );
  await vi.waitFor(async () => {
    await settle(fixture);
    expect(fixture.nativeElement.querySelector('aui-scope-outlet')).not.toBeNull();
  });
  return fixture.nativeElement as HTMLElement;
};

describe('MessagePrimitive.GroupedParts renderer precedence', () => {
  it('an explicit template beats the registered tool UI', async () => {
    const el = await mount(ExplicitHostComponent);
    expect(el.querySelector('.registered')).toBeNull();
    expect(el.querySelectorAll('.explicit').length).toBe(2);
  });

  it('an empty template suppresses the registered tool UI', async () => {
    const el = await mount(EmptyHostComponent);
    expect(el.querySelector('.registered')).toBeNull();
  });

  it('without a template the registered tool UI renders', async () => {
    const el = await mount(AbsentHostComponent, ['reg']);
    expect(el.querySelectorAll('.registered').length).toBe(1);
    expect(el.querySelector('.registered')?.textContent).toBe('reg');
  });
});
