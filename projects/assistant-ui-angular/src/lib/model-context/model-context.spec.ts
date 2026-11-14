import { ChangeDetectionStrategy, Component, input, signal, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { AssistantClient } from '@assistant-ui/store/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime, type TestRuntime } from '../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { injectAui } from '../state/inject-aui';
import { registerTool } from '../tools/register-tool';
import { injectAuiToolOverrides, registerToolkit } from '../tools/toolkit';
import type { ToolUIComponent, ToolUIProps } from '../tools/tool-ui';
import { injectAssistantContext } from './context';
import { injectAssistantInstructions } from './instructions';
import { AuiAssistantVisibleDirective } from './visible';

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await Promise.resolve();
  }
};

let current: TestRuntime;
let aui: AssistantClient;
/** What the registering child does in its constructor (set per test). */
let register: () => void = () => undefined;

@Component({
  selector: 'aui-test-registrar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class RegistrarComponent {
  constructor() {
    aui = injectAui();
    register();
  }
}

@Component({
  selector: 'aui-test-ui',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="ui">ui</span>`,
})
class UiComponent implements ToolUIComponent {
  readonly tool = input.required<ToolUIProps>();
}

@Component({
  standalone: true,
  imports: [AuiProviderDirective, RegistrarComponent, AuiAssistantVisibleDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      @if (registered()) {
        <aui-test-registrar />
      }
      @if (visible()) {
        <section auiAssistantVisible class="outer">
          <button
            auiAssistantVisible
            clickable
            [settleDelayMs]="0"
            class="inner"
            (click)="clicks.set(clicks() + 1)"
          >
            Buy
          </button>
          <input auiAssistantVisible editable [settleDelayMs]="0" class="field" />
        </section>
      }
    </ng-container>
  `,
})
class HostComponent {
  readonly config = current.config;
  readonly registered = signal(true);
  readonly visible = signal(false);
  readonly clicks = signal(0);
}

const mount = async () => {
  current = createTestRuntime();
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  await settle(fixture);
  return fixture;
};

const modelContext = () => aui.thread().getModelContext();

describe('model context registration', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    register = () => undefined;
  });

  it('registers instructions and removes them when the component is destroyed', async () => {
    register = () => injectAssistantInstructions('You are a pirate.');
    const fixture = await mount();
    expect(modelContext().system).toContain('You are a pirate.');

    fixture.componentInstance.registered.set(false);
    await settle(fixture);
    expect(modelContext().system ?? '').not.toContain('pirate');
  });

  it('follows a signal instruction and honours disabled', async () => {
    const text = signal('first');
    const disabled = signal(false);
    register = () => injectAssistantInstructions({ instruction: text, disabled });
    await mount();
    expect(modelContext().system).toContain('first');
    text.set('second');
    expect(modelContext().system).toContain('second');
    disabled.set(true);
    expect(modelContext().system ?? '').not.toContain('second');
  });

  it('registers a dynamic context that is read on every pull', async () => {
    const count = signal(1);
    register = () => injectAssistantContext(() => `cart:${count()}`);
    await mount();
    expect(modelContext().system).toContain('cart:1');
    count.set(5);
    expect(modelContext().system).toContain('cart:5');
  });

  it('registerTool adds a frontend tool and its UI, and removes both on destroy', async () => {
    const execute = vi.fn(async ({ city }: { city: string }) => `sunny in ${city}`);
    register = () =>
      registerTool({
        toolName: 'get_weather',
        type: 'frontend',
        description: 'Weather',
        parameters: { type: 'object', properties: { city: { type: 'string' } } },
        execute,
        render: UiComponent,
      });
    const fixture = await mount();
    const tool = modelContext().tools?.['get_weather'];
    expect(tool).toBeDefined();
    expect(tool).not.toHaveProperty('render');
    await vi.waitFor(() => expect(aui.tools().getState().toolUIs['get_weather']).toHaveLength(1));

    fixture.componentInstance.registered.set(false);
    await settle(fixture);
    expect(modelContext().tools?.['get_weather']).toBeUndefined();
    await vi.waitFor(() => expect(aui.tools().getState().toolUIs['get_weather']).toBeUndefined());
  });

  it('registerToolkit registers every non-mcp tool and keeps display fields client-side', async () => {
    register = () =>
      registerToolkit({
        a: {
          type: 'frontend',
          description: 'A',
          parameters: { type: 'object' },
          execute: async () => 1,
          renderText: { running: 'working' },
        },
        confirm: {
          type: 'human',
          description: 'Confirm',
          parameters: { type: 'object' },
          render: UiComponent as Type<ToolUIComponent>,
        },
      });
    const fixture = await mount();
    expect(Object.keys(modelContext().tools ?? {}).sort()).toEqual(['a', 'confirm']);
    expect(modelContext().tools?.['confirm']).toMatchObject({ type: 'human' });
    await vi.waitFor(() => expect(aui.tools().getState().toolUIs['confirm']).toBeDefined());
    const uis = aui.tools().getState().toolUIs;
    expect(uis['a']?.[0]?.standalone).toBe(false);
    expect(uis['confirm']?.[0]?.standalone).toBe(true);

    fixture.componentInstance.registered.set(false);
    await settle(fixture);
    expect(modelContext().tools?.['a']).toBeUndefined();
  });

  it('injectAuiToolOverrides registers overrides above toolkit defaults', async () => {
    const stub = { type: 'frontend', description: 'Stub', parameters: { type: 'object' } } as const;
    const impl = vi.fn(async () => 'real');
    register = () => {
      registerToolkit({ t: { ...stub } });
      injectAuiToolOverrides({ t: { execute: impl } });
    };
    await mount();
    expect(modelContext().tools?.['t']?.execute).toBe(impl);
  });

  it('auiAssistantVisible exposes outerHTML once, plus click and edit tools', async () => {
    const fixture = await mount();
    fixture.componentInstance.visible.set(true);
    await settle(fixture);

    const context = modelContext();
    expect(context.system).toContain('class="outer"');
    // The nested visible elements add no text of their own.
    expect(context.system?.split('class="inner"').length).toBe(2);
    expect(Object.keys(context.tools ?? {}).sort()).toEqual(['click', 'edit']);

    const root = fixture.nativeElement as HTMLElement;
    const button = root.querySelector<HTMLButtonElement>('button.inner')!;
    const clickId = button.dataset['clickId']!;
    expect(clickId).toBeTruthy();
    const click = context.tools!['click'] as unknown as {
      execute: (args: { clickId: string }) => Promise<unknown>;
    };
    await click.execute({ clickId });
    expect(fixture.componentInstance.clicks()).toBe(1);

    const input = root.querySelector<HTMLInputElement>('input.field')!;
    const edit = context.tools!['edit'] as unknown as {
      execute: (args: { editId: string; value: string }) => Promise<unknown>;
    };
    await edit.execute({ editId: input.dataset['editId']!, value: 'hello' });
    expect(input.value).toBe('hello');
    expect(await click.execute({ clickId: 'missing' })).toBe('Element not found');

    fixture.componentInstance.visible.set(false);
    await settle(fixture);
    expect(modelContext().tools?.['click']).toBeUndefined();
  });
});
