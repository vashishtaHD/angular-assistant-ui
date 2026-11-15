import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { AuiConfig } from '@assistant-ui/store/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime } from '../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { groupMessagePartsByParentId } from '../utils/group-parts';
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
const noGroups = () => [];

const imports = [
  AuiProviderDirective,
  AuiThreadMessagesComponent,
  AuiMessageTemplateDirective,
  AuiMessageGroupedPartsComponent,
];

@Component({
  standalone: true,
  imports,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-container [auiProvider]="config"
    ><aui-thread-messages
      ><ng-template auiMessage><aui-message-grouped-parts /></ng-template></aui-thread-messages
  ></ng-container>`,
})
class NoGroupByHostComponent {
  readonly config = hostConfig;
}

@Component({
  standalone: true,
  imports,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-container [auiProvider]="config"
    ><aui-thread-messages
      ><ng-template auiMessage
        ><aui-message-grouped-parts
          [groupBy]="groupBy"
          [groupingFunction]="grouping" /></ng-template
    ></aui-thread-messages>
  </ng-container>`,
})
class BothHostComponent {
  readonly config = hostConfig;
  readonly groupBy = noGroups;
  readonly grouping = groupMessagePartsByParentId;
}

@Component({
  standalone: true,
  imports,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-container [auiProvider]="config"
    ><aui-thread-messages
      ><ng-template auiMessage><aui-message-grouped-parts [groupBy]="groupBy" /></ng-template
    ></aui-thread-messages>
  </ng-container>`,
})
class OkHostComponent {
  readonly config = hostConfig;
  readonly groupBy = noGroups;
}

const mountWarnings = async (host: new () => unknown) => {
  TestBed.resetTestingModule();
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const rt = createTestRuntime();
  rt.append({ role: 'assistant', content: [{ type: 'text', text: 'hi' }] });
  hostConfig = rt.config;
  configureTestBed({ imports: [host as never] });
  const fixture = TestBed.createComponent(host);
  fixture.detectChanges();
  await settle(fixture);
  return warn.mock.calls.map((call) => String(call[0]));
};

describe('aui-message-grouped-parts dev warnings', () => {
  afterEach(() => vi.restoreAllMocks());

  it('warns when groupBy is missing on aui-message-grouped-parts', async () => {
    const warnings = await mountWarnings(NoGroupByHostComponent);
    expect(warnings.some((text) => text.includes('needs [groupBy]'))).toBe(true);
  });

  it('warns when groupBy and groupingFunction are both set', async () => {
    const warnings = await mountWarnings(BothHostComponent);
    expect(warnings.some((text) => text.includes('[groupingFunction] is ignored'))).toBe(true);
  });

  it('does not warn for a plain groupBy use', async () => {
    const warnings = await mountWarnings(OkHostComponent);
    expect(warnings).toEqual([]);
  });
});
