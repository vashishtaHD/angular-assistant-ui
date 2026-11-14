import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  Interactables,
  unstable_Interactables,
  type Unstable_InteractableStateSchema,
} from '@assistant-ui/core/react';
import { RuntimeAdapter } from '@assistant-ui/core/store';
import { AuiConfig, type AssistantClient } from '@assistant-ui/store/client';
import { flushTapSync } from '@assistant-ui/tap';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
import { injectAui } from '../state/inject-aui';
import { registerToolkit } from '../tools/toolkit';
import {
  unstable_injectInteractable,
  unstable_injectInteractableState,
  unstable_injectInteractableVersions,
  type InteractableHandle,
  type InteractableStateHandle,
} from './inject-interactable';
import {
  unstable_interactableTool,
  type InteractableToolRenderComponent,
  type Unstable_InteractableToolRenderProps,
} from './interactable-tool';
import { injectAssistantInteractable, injectInteractableState } from './legacy';

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await Promise.resolve();
  }
};

const schema = {
  type: 'object',
  properties: { text: { type: 'string' } },
  required: ['text'],
} as unknown as Unstable_InteractableStateSchema;

let rt: TestRuntime;
let aui: AssistantClient;
let owner: InteractableHandle<{ text: string }>;
let reader: InteractableStateHandle<{ text: string }>;
let legacyId: string;
let legacyState: ReturnType<typeof injectInteractableState<{ text: string }>>;
let register: () => void = () => undefined;

@Component({
  selector: 'aui-test-owner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class OwnerComponent {
  constructor() {
    aui = injectAui();
    register();
  }
}

@Component({
  selector: 'aui-test-notepad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="note">{{ interactable().state.text }}|{{ interactable().streaming }}</p>
    <button class="edit" (click)="interactable().setState({ text: 'edited' })">edit</button>`,
})
class NotepadComponent implements InteractableToolRenderComponent<{ text: string }> {
  readonly interactable = input.required<Unstable_InteractableToolRenderProps<{ text: string }>>();
}

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    OwnerComponent,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessagePartsComponent,
    AuiPartTemplateDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-test-owner />
      <aui-thread-messages>
        <ng-template auiMessage>
          <li>
            <aui-message-parts>
              <ng-template auiPart="tool-call"><span class="slot">[slot]</span></ng-template>
            </aui-message-parts>
          </li>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class HostComponent {
  readonly config = AuiConfig({
    threads: RuntimeAdapter(rt.runtime),
    unstable_interactables: unstable_Interactables(),
    interactables: Interactables(),
  });
}

const mount = async () => {
  rt = createTestRuntime();
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  await settle(fixture);
  return fixture;
};

describe('interactables', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    register = () => undefined;
  });

  it('round-trips state between the owner, a reader and the model update tool', async () => {
    register = () => {
      // A plain JSON Schema carries no state type (as in React), so type it here.
      owner = unstable_injectInteractable('note', {
        description: 'A note',
        stateSchema: schema,
        initialState: { text: 'a' },
        id: 'note-1',
      }) as unknown as InteractableHandle<{ text: string }>;
      reader = unstable_injectInteractableState<{ text: string }>('note-1');
    };
    const fixture = await mount();
    await settle(fixture);

    await vi.waitFor(() => expect(reader.state()).toEqual({ text: 'a' }));
    expect(owner.state()).toEqual({ text: 'a' });
    expect(owner.id()).toBe('note-1');

    owner.setState({ text: 'b' });
    await vi.waitFor(() => expect(reader.state()).toEqual({ text: 'b' }));
    reader.setState((prev) => ({ text: `${prev.text}!` }));
    await vi.waitFor(() => expect(owner.state()).toEqual({ text: 'b!' }));

    // The model reads and updates it through the generated tool.
    const updateTool = aui.thread().getModelContext().tools?.['update_note'] as {
      execute: (args: unknown, context: unknown) => Promise<unknown>;
    };
    expect(updateTool).toBeDefined();
    await updateTool.execute({ id: 'note-1', text: 'from model' }, { toolCallId: 'x' });
    await vi.waitFor(() => expect(owner.state()).toEqual({ text: 'from model' }));

    fixture.destroy();
    await vi.waitFor(() =>
      expect(aui.unstable_interactables().getState().definitions['note-1']).toBeUndefined(),
    );
  });

  it('exposes the version history of a tool-created interactable', async () => {
    let versions!: ReturnType<typeof unstable_injectInteractableVersions<{ text: string }>>;
    register = () => {
      versions = unstable_injectInteractableVersions<{ text: string }>('call-9', 'notepad');
    };
    const fixture = await mount();
    flushTapSync(() =>
      rt.append({
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-9',
            toolName: 'notepad',
            args: { text: 'v1' },
            result: { success: true },
          },
        ],
      }),
    );
    await vi.waitFor(() => expect(versions()).toHaveLength(1));
    expect(versions()[0]).toMatchObject({ origin: 'create', state: { text: 'v1' } });
    fixture.destroy();
  });

  it('registers legacy interactables and reads their state', async () => {
    register = () => {
      legacyId = injectAssistantInteractable('legacy', {
        description: 'Legacy',
        stateSchema: schema,
        initialState: { text: 'x' },
        id: 'legacy-1',
      });
      legacyState = injectInteractableState<{ text: string }>('legacy-1', { text: 'fallback' });
    };
    const fixture = await mount();
    expect(legacyId).toBe('legacy-1');
    await vi.waitFor(() => expect(legacyState.state()).toEqual({ text: 'x' }));
    legacyState.setState({ text: 'y' });
    await vi.waitFor(() => expect(legacyState.state()).toEqual({ text: 'y' }));
    legacyState.setSelected(true);
    await vi.waitFor(() =>
      expect(aui.interactables().getState().definitions['legacy-1']?.selected).toBe(true),
    );
    fixture.destroy();
  });

  it('unstable_interactableTool renders at the creating call with live state', async () => {
    register = () =>
      registerToolkit({
        notepad: unstable_interactableTool({
          description: 'A notepad',
          stateSchema: schema,
          render: NotepadComponent,
        }),
      });
    const fixture = await mount();
    const root = fixture.nativeElement as HTMLElement;

    // The model-facing tool carries no client-only fields.
    const tool = aui.thread().getModelContext().tools?.['notepad'];
    expect(tool).toMatchObject({ type: 'frontend', description: 'A notepad' });
    expect(tool).not.toHaveProperty('render');

    flushTapSync(() =>
      rt.append({
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'notepad',
            args: { text: 'hello' },
            result: { success: true },
          },
        ],
      }),
    );
    await vi.waitFor(async () => {
      await settle(fixture);
      expect(root.querySelector('p.note')?.textContent).toBe('hello|false');
    });
    // The anchor registered the instance under the creating call's id.
    expect(aui.unstable_interactables().getState().definitions['call-1']).toMatchObject({
      name: 'notepad',
      state: { text: 'hello' },
    });

    root.querySelector<HTMLButtonElement>('button.edit')!.click();
    await vi.waitFor(async () => {
      await settle(fixture);
      expect(root.querySelector('p.note')?.textContent).toBe('edited|false');
    });
    fixture.destroy();
  });
});
