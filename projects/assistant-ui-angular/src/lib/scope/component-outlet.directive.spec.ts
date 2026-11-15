// Scope-safe dynamic rendering: components created from inside scoped templates
// (part templates, the edit composer template) must read the scope the template
// renders in, not the scope of its declaration site.
import { ChangeDetectionStrategy, Component, input, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { flushTapSync } from '@assistant-ui/tap';
import { afterEach, describe, expect, it } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime, type TestRuntime } from '../../testing-internal/test-runtime';
import { AuiActionBarEditDirective } from '../primitives/action-bar/action-bar-edit.directive';
import { AuiEditComposerDirective } from '../primitives/edit-composer/edit-composer.directive';
import { AuiMessageGroupedPartsComponent } from '../primitives/message-grouped-parts.component';
import {
  AuiMessagePartsComponent,
  AuiPartTemplateDirective,
} from '../primitives/message-parts.component';
import {
  AuiMessageTemplateDirective,
  AuiThreadMessagesComponent,
} from '../primitives/thread-messages.component';
import { AuiToolUIOutletComponent } from '../primitives/tool-ui-outlet.component';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';
import { registerToolUI, type ToolUIProps } from '../tools/tool-ui';
import { AuiComponentOutletDirective } from './component-outlet.directive';

let runtime: TestRuntime;

@Component({
  selector: 'aui-test-part-probe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="part-probe">{{ label() }}:{{ text() }}</span>`,
})
class PartProbeComponent {
  readonly label = input('none');
  protected readonly text = injectAuiState((s) => (s.part.type === 'text' ? s.part.text : '?'));
}

@Component({
  selector: 'aui-test-edit-probe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="edit-type">{{ type() }}</span>
    <span class="edit-text">{{ text() }}</span>
    <button class="edit-change" (click)="change()">change</button>
    <button class="edit-cancel" (click)="cancel()">cancel</button>`,
})
class EditProbeComponent {
  private readonly aui = injectAui();
  protected readonly type = injectAuiState((s) => s.composer.type);
  protected readonly text = injectAuiState((s) => s.composer.text);
  protected change(): void {
    flushTapSync(() => this.aui.composer.setText('edited'));
  }
  protected cancel(): void {
    flushTapSync(() => this.aui.composer.cancel());
  }
}

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
  selector: 'aui-test-fallback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<i class="fallback">{{ name() }}</i>`,
})
class FallbackComponent {
  protected readonly name = injectAuiState((s) =>
    s.part.type === 'tool-call' ? s.part.toolName : '?',
  );
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

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessagePartsComponent,
    AuiPartTemplateDirective,
    AuiEditComposerDirective,
    AuiActionBarEditDirective,
    AuiComponentOutletDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-container [auiProvider]="config">
    <aui-thread-messages>
      <ng-template auiMessage>
        <ng-template auiEditComposer>
          <ng-container [auiComponentOutlet]="editProbe" />
        </ng-template>
        <button class="edit" auiActionBarEdit>edit</button>
        <aui-message-parts>
          <ng-template auiPart="text">
            <ng-container
              [auiComponentOutlet]="partProbe"
              [auiComponentOutletInputs]="{ label: 'probe' }"
            />
          </ng-template>
        </aui-message-parts>
      </ng-template>
    </aui-thread-messages>
  </ng-container>`,
})
class ScopeHostComponent {
  readonly config = runtime.config;
  readonly partProbe: Type<unknown> = PartProbeComponent;
  readonly editProbe: Type<unknown> = EditProbeComponent;
}

const groupBy = () => ['group-tools'] as const;

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    RegistrarComponent,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessageGroupedPartsComponent,
    AuiPartTemplateDirective,
    AuiToolUIOutletComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-container [auiProvider]="config">
    <aui-test-registrar />
    <aui-thread-messages>
      <ng-template auiMessage>
        <aui-message-grouped-parts [groupBy]="groupBy">
          <ng-template auiPart="tool-call">
            <aui-tool-ui-outlet [fallback]="fallback" />
          </ng-template>
        </aui-message-grouped-parts>
      </ng-template>
    </aui-thread-messages>
  </ng-container>`,
})
class ToolHostComponent {
  readonly config = runtime.config;
  readonly groupBy = groupBy;
  readonly fallback: Type<unknown> = FallbackComponent;
}

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 4; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

let mounted: HTMLElement | undefined;

async function mount<T>(host: Type<T>) {
  configureTestBed({ imports: [host] });
  const fixture = TestBed.createComponent(host);
  const root = fixture.nativeElement as HTMLElement;
  document.body.appendChild(root);
  mounted = root;
  fixture.detectChanges();
  await settle(fixture);
  return { fixture, root };
}

afterEach(() => {
  mounted?.remove();
  mounted = undefined;
});

describe('AuiComponentOutletDirective', () => {
  it('renders a component in the part scope of a part template, with inputs', async () => {
    runtime = createTestRuntime();
    runtime.append({ id: 'u1', role: 'user', content: [{ type: 'text', text: 'hello' }] });
    const { root } = await mount(ScopeHostComponent);
    expect(root.querySelector('.part-probe')?.textContent).toBe('probe:hello');
  });

  it('renders a component in the edit composer scope, leaving the thread draft alone', async () => {
    runtime = createTestRuntime({ onEdit: async () => undefined });
    runtime.append({ id: 'u1', role: 'user', content: [{ type: 'text', text: 'original' }] });
    const { fixture, root } = await mount(ScopeHostComponent);
    flushTapSync(() => runtime.runtime.thread.composer.setText('draft'));
    await settle(fixture);

    root.querySelector<HTMLButtonElement>('.edit')!.click();
    await settle(fixture);
    expect(root.querySelector('.edit-type')?.textContent).toBe('edit');
    expect(root.querySelector('.edit-text')?.textContent).toBe('original');

    root.querySelector<HTMLButtonElement>('.edit-change')!.click();
    await settle(fixture);
    expect(root.querySelector('.edit-text')?.textContent).toBe('edited');
    expect(runtime.runtime.thread.composer.getState().text).toBe('draft');

    root.querySelector<HTMLButtonElement>('.edit-cancel')!.click();
    await settle(fixture);
    expect(root.querySelector('.edit-type')).toBeNull();
    expect(runtime.runtime.thread.composer.getState().text).toBe('draft');
    expect(root.querySelector('.part-probe')?.textContent).toBe('probe:original');
  });
});

describe('AuiToolUIOutletComponent', () => {
  it('renders the registered tool UI, and the fallback only for unregistered tools', async () => {
    runtime = createTestRuntime();
    runtime.append({
      id: 'a1',
      role: 'assistant',
      content: [
        { type: 'tool-call', toolCallId: 'c1', toolName: 'reg', args: {} },
        { type: 'tool-call', toolCallId: 'c2', toolName: 'other', args: {} },
      ],
    });
    const { root } = await mount(ToolHostComponent);
    expect(Array.from(root.querySelectorAll('.registered')).map((e) => e.textContent)).toEqual([
      'reg',
    ]);
    expect(Array.from(root.querySelectorAll('.fallback')).map((e) => e.textContent)).toEqual([
      'other',
    ]);
  });
});
