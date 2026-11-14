// Ported from packages/core/src/react/primitives/message/MessageGroupedParts.test.tsx @ 7d74276
// (the render-function-first contract: a leaf's own renderer beats a registered UI)
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { AuiConfig } from '@assistant-ui/store/client';
import { flushTapSync } from '@assistant-ui/tap';
import { describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime, type DemoMessage } from '../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { injectAui } from '../state/inject-aui';
import { registerToolUI, type DataUIProps, type ToolUIProps } from '../tools/tool-ui';
import type { AssistantClient } from '@assistant-ui/store/client';
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
    capturedAui = injectAui();
  }
}

let capturedAui: AssistantClient | undefined;

@Component({
  selector: 'aui-test-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<b class="chart">{{ data().part.data.a }}</b>`,
})
class ChartComponent {
  readonly data = input.required<DataUIProps<{ a: number }>>();
}

const noGroups = () => [];

const hostTemplate = (selector: string, attrs: string, slots: string) => `
    <ng-container [auiProvider]="config">
      <aui-test-registrar />
      <aui-thread-messages>
        <ng-template auiMessage>
          <${selector} ${attrs}>${slots}</${selector}>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `;

const hostImports = [
  AuiProviderDirective,
  RegistrarComponent,
  AuiThreadMessagesComponent,
  AuiMessageTemplateDirective,
  AuiMessageGroupedPartsComponent,
  AuiPartTemplateDirective,
];

@Component({
  standalone: true,
  imports: hostImports,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: hostTemplate(
    'aui-message-parts-grouped',
    '',
    '<ng-template auiPart="tool-call"><u class="explicit">explicit</u></ng-template>' +
      '<ng-template auiPart="data"><u class="explicit-data">explicit</u></ng-template>',
  ),
})
class ClusteredHostComponent {
  readonly config = hostConfig;
}

@Component({
  standalone: true,
  imports: hostImports,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: hostTemplate(
    'aui-message-grouped-parts',
    '[groupBy]="groupBy"',
    '<ng-template auiPart="data"><u class="explicit-data">explicit</u></ng-template>',
  ),
})
class DataExplicitHostComponent {
  readonly config = hostConfig;
  readonly groupBy = noGroups;
}

@Component({
  standalone: true,
  imports: hostImports,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: hostTemplate(
    'aui-message-grouped-parts',
    '[groupBy]="groupBy"',
    '<ng-template auiPart="data"></ng-template>',
  ),
})
class DataEmptyHostComponent {
  readonly config = hostConfig;
  readonly groupBy = noGroups;
}

@Component({
  standalone: true,
  imports: hostImports,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: hostTemplate('aui-message-grouped-parts', '[groupBy]="groupBy"', ''),
})
class DataAbsentHostComponent {
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

const mountContent = async (
  host: new () => unknown,
  content: DemoMessage['content'],
  registerData = false,
) => {
  TestBed.resetTestingModule();
  const rt = createTestRuntime();
  hostConfig = rt.config;
  configureTestBed({ imports: [host as never] });
  const fixture = TestBed.createComponent(host);
  fixture.detectChanges();
  await settle(fixture);
  if (registerData) {
    flushTapSync(() =>
      capturedAui!.dataRenderers.setDataUI(
        'chart',
        ChartComponent as unknown as Parameters<AssistantClient['dataRenderers']['setDataUI']>[1],
      ),
    );
  }
  // Append once the registrar has bound to the tools scope (as the tool UI specs do).
  flushTapSync(() => rt.append({ role: 'assistant', content }));
  await vi.waitFor(async () => {
    await settle(fixture);
    expect(fixture.nativeElement.querySelector('aui-scope-outlet')).not.toBeNull();
  });
  return fixture.nativeElement as HTMLElement;
};

const mount = (host: new () => unknown, toolNames = ['reg', 'other']) =>
  mountContent(
    host,
    toolNames.map((toolName, i) => ({
      type: 'tool-call' as const,
      toolCallId: `c${i}`,
      toolName,
      args: {},
    })),
  );

const chart: DemoMessage['content'] = [{ type: 'data', name: 'chart', data: { a: 7 } }];

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

  it('an explicit template beats a registered data renderer', async () => {
    const el = await mountContent(DataExplicitHostComponent, chart, true);
    expect(el.querySelector('.chart')).toBeNull();
    expect(el.querySelectorAll('.explicit-data').length).toBe(1);
  });

  it('an empty template suppresses a registered data renderer', async () => {
    const el = await mountContent(DataEmptyHostComponent, chart, true);
    expect(el.querySelector('.chart')).toBeNull();
  });

  it('without a template the registered data renderer renders', async () => {
    const el = await mountContent(DataAbsentHostComponent, chart, true);
    expect(el.querySelector('.chart')?.textContent).toBe('7');
  });
});

describe('MessagePrimitive.Unstable_PartsGrouped renderer precedence', () => {
  it('a registered tool UI beats a tool-call template (upstream order)', async () => {
    const el = await mount(ClusteredHostComponent, ['reg', 'other']);
    expect(el.querySelectorAll('.registered').length).toBe(1);
    expect(el.querySelectorAll('.explicit').length).toBe(1);
  });

  it('a registered data renderer beats a data template (upstream order)', async () => {
    const el = await mountContent(ClusteredHostComponent, chart, true);
    expect(el.querySelector('.chart')?.textContent).toBe('7');
    expect(el.querySelector('.explicit-data')).toBeNull();
  });
});
