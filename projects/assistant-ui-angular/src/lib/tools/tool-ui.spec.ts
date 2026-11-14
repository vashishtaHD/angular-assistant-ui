// Ported from packages/vue/src/__tests__/primitives-tool-ui.test.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// and packages/vue/src/primitives/MessagePrimitiveParts.tool-interaction.test.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { ChangeDetectionStrategy, Component, input, signal, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { DefaultAssistantClient, type AssistantClient } from '@assistant-ui/store/client';
import { flushTapSync } from '@assistant-ui/tap';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import {
  createTestRuntime,
  type DemoMessage,
  type TestRuntime,
  type TestRuntimeCallbacks,
} from '../../testing-internal/test-runtime';
import {
  AuiMessagePartsComponent,
  AuiPartTemplateDirective,
} from '../primitives/message-parts.component';
import {
  AuiMessageTemplateDirective,
  AuiThreadMessagesComponent,
} from '../primitives/thread-messages.component';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { injectAuiContext } from '../context/aui-context';
import { registerToolUI, type ToolUIComponent, type ToolUIProps } from './tool-ui';

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

@Component({
  selector: 'aui-test-weather-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="ui">{{ summary() }}</span>`,
})
class WeatherCardComponent implements ToolUIComponent {
  readonly tool = input.required<ToolUIProps>();
  protected summary() {
    const tool = this.tool();
    return [
      tool.part.toolName,
      (tool.part.args as { city?: string }).city,
      typeof tool.addResult,
      typeof tool.resume,
      typeof tool.respondToApproval,
    ].join(',');
  }
}

@Component({
  selector: 'aui-test-callback-tool',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button class="add-result" (click)="tool().addResult('72F')">add</button>
    <button class="resume" (click)="tool().resume('continue')">resume</button>
    <button class="approve" (click)="tool().respondToApproval({ approved: true })">approve</button>
  `,
})
class CallbackToolComponent implements ToolUIComponent {
  readonly tool = input.required<ToolUIProps>();
}

@Component({
  selector: 'aui-test-first',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="first">first</span>`,
})
class FirstComponent implements ToolUIComponent {
  readonly tool = input.required<ToolUIProps>();
}

@Component({
  selector: 'aui-test-second',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="second">second</span>`,
})
class SecondComponent implements ToolUIComponent {
  readonly tool = input.required<ToolUIProps>();
}

/** What the registering component registers (set per test). */
let registrations: [string, Type<ToolUIComponent>][] = [];
/** The client the provider exposed when the registrar's constructor ran. */
let clientAtRegistration: AssistantClient | undefined;

@Component({
  selector: 'aui-test-registrar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class RegistrarComponent {
  constructor() {
    // Constructors run before the provider's first ngOnChanges creates its client.
    clientAtRegistration = injectAuiContext().source.getClient();
    for (const [name, component] of registrations) registerToolUI(name, component);
  }
}

let current: TestRuntime;

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessagePartsComponent,
    AuiPartTemplateDirective,
    RegistrarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      @if (registered()) {
        <aui-test-registrar />
      }
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
  readonly config = current.config;
  readonly registered = signal(true);
}

/** Like HostComponent, but the registrar is a direct child (constructed before the provider's first ngOnChanges). */
@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessagePartsComponent,
    AuiPartTemplateDirective,
    RegistrarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-test-registrar />
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
class EarlyHostComponent {
  readonly config = current.config;
}

const mount = async (callbacks: TestRuntimeCallbacks = {}) => {
  current = createTestRuntime(callbacks);
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  await settle(fixture);
  return { fixture, rt: current };
};

const el = (fixture: ComponentFixture<HostComponent>) => fixture.nativeElement as HTMLElement;

const toolCall = (toolName: string, extra: Record<string, unknown> = {}): DemoMessage => ({
  role: 'assistant',
  content: [
    { type: 'tool-call', toolCallId: 'call-1', toolName, args: { city: 'Paris' }, ...extra },
  ],
});

describe('registerToolUI', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    registrations = [];
    clientAtRegistration = undefined;
  });

  it('renders a registered tool UI with the tool input', async () => {
    registrations = [['getWeather', WeatherCardComponent]];
    const { fixture, rt } = await mount();
    flushTapSync(() => rt.append(toolCall('getWeather')));
    await waitFor(fixture, () => expect(el(fixture).querySelector('span.ui')).not.toBeNull());

    expect(el(fixture).querySelector('span.ui')!.textContent).toBe(
      'getWeather,Paris,function,function,function',
    );
    expect(el(fixture).querySelector('span.slot')).toBeNull();
    fixture.destroy();
  });

  it('routes addResult, resume, and respondToApproval to the adapter callbacks', async () => {
    const onAddToolResult = vi.fn();
    const onResumeToolCall = vi.fn();
    const onRespondToToolApproval = vi.fn();
    registrations = [['weather', CallbackToolComponent]];
    const { fixture, rt } = await mount({
      onAddToolResult,
      onResumeToolCall,
      onRespondToToolApproval,
    });
    flushTapSync(() => rt.append(toolCall('weather', { approval: { id: 'approval-1' } })));
    await waitFor(fixture, () =>
      expect(el(fixture).querySelector('button.add-result')).not.toBeNull(),
    );

    (el(fixture).querySelector('button.add-result') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(onAddToolResult).toHaveBeenCalledTimes(1));
    expect(onAddToolResult.mock.calls[0]![0]).toMatchObject({
      toolCallId: 'call-1',
      toolName: 'weather',
      result: '72F',
    });

    (el(fixture).querySelector('button.resume') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(onResumeToolCall).toHaveBeenCalledTimes(1));
    expect(onResumeToolCall.mock.calls[0]![0]).toMatchObject({
      toolCallId: 'call-1',
      payload: 'continue',
    });

    (el(fixture).querySelector('button.approve') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(onRespondToToolApproval).toHaveBeenCalledTimes(1));
    expect(onRespondToToolApproval.mock.calls[0]![0]).toMatchObject({
      approvalId: 'approval-1',
      approved: true,
    });
    fixture.destroy();
  });

  it('falls back to the tool-call template when no UI is registered', async () => {
    registrations = [['search', WeatherCardComponent]];
    const { fixture, rt } = await mount();
    flushTapSync(() => rt.append(toolCall('weather')));
    await waitFor(fixture, () => expect(el(fixture).querySelector('span.slot')).not.toBeNull());
    expect(el(fixture).querySelector('span.ui')).toBeNull();
    fixture.destroy();
  });

  it('uses the first registration when a tool name is registered twice', async () => {
    registrations = [
      ['weather', FirstComponent],
      ['weather', SecondComponent],
    ];
    const { fixture, rt } = await mount();
    flushTapSync(() => rt.append(toolCall('weather')));
    await waitFor(fixture, () => expect(el(fixture).querySelector('span.first')).not.toBeNull());
    expect(el(fixture).querySelector('span.second')).toBeNull();
    fixture.destroy();
  });

  it('unregisters tool UI on destroy', async () => {
    registrations = [['weather', WeatherCardComponent]];
    const { fixture, rt } = await mount();
    flushTapSync(() => rt.append(toolCall('weather')));
    await waitFor(fixture, () => expect(el(fixture).querySelector('span.ui')).not.toBeNull());

    flushTapSync(() => fixture.componentInstance.registered.set(false));
    await waitFor(fixture, () => {
      expect(el(fixture).querySelector('span.slot')).not.toBeNull();
      expect(el(fixture).querySelector('span.ui')).toBeNull();
    });

    // Registering again swaps the UI back in live.
    fixture.componentInstance.registered.set(true);
    await waitFor(fixture, () => {
      expect(el(fixture).querySelector('span.ui')).not.toBeNull();
      expect(el(fixture).querySelector('span.slot')).toBeNull();
    });
    fixture.destroy();
  });

  it('registers from a constructor before the provider has created its client', async () => {
    registrations = [['weather', WeatherCardComponent]];
    current = createTestRuntime();
    configureTestBed({ imports: [EarlyHostComponent] });
    const fixture = TestBed.createComponent(EarlyHostComponent);
    fixture.detectChanges();
    await settle(fixture);
    expect(clientAtRegistration).toBe(DefaultAssistantClient);

    flushTapSync(() => current.append(toolCall('weather')));
    await waitFor(fixture, () =>
      expect((fixture.nativeElement as HTMLElement).querySelector('span.ui')).not.toBeNull(),
    );
    fixture.destroy();
  });

  it('keeps one tool UI instance while the arguments stream in', async () => {
    let constructed = 0;
    @Component({
      selector: 'aui-test-counting-card',
      standalone: true,
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<span class="ui">{{ city() }}</span>`,
    })
    class CountingCardComponent implements ToolUIComponent {
      readonly tool = input.required<ToolUIProps>();
      constructor() {
        constructed++;
      }
      protected city() {
        return (this.tool().part.args as { city?: string }).city ?? '';
      }
    }
    registrations = [['weather', CountingCardComponent]];
    const { fixture, rt } = await mount();
    const message = (city: string): DemoMessage => ({
      id: 'm1',
      ...toolCall('weather', { args: { city } }),
    });

    flushTapSync(() => rt.setMessages([message('Pa')]));
    await waitFor(fixture, () =>
      expect(el(fixture).querySelector('span.ui')?.textContent).toBe('Pa'),
    );
    const card = el(fixture).querySelector('span.ui');

    for (const city of ['Par', 'Pari', 'Paris']) {
      flushTapSync(() => rt.setMessages([message(city)]));
      await waitFor(fixture, () =>
        expect(el(fixture).querySelector('span.ui')?.textContent).toBe(city),
      );
    }

    expect(el(fixture).querySelector('span.ui')).toBe(card);
    expect(constructed).toBe(1);
    fixture.destroy();
  });

  it('warns in dev when registering outside any provider', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    registrations = [['weather', WeatherCardComponent]];
    configureTestBed({ imports: [RegistrarComponent] });
    const fixture = TestBed.createComponent(RegistrarComponent);
    fixture.detectChanges();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toMatch(/registerToolUI\('weather'\).*AuiProvider/);
    fixture.destroy();
  });

  it('does not warn when registering under a provider', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    registrations = [['weather', WeatherCardComponent]];
    const { fixture } = await mount();

    expect(warn).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('forwards unstable_recordInteraction when the part provides it', async () => {
    let seen: ToolUIProps | undefined;
    @Component({
      selector: 'aui-test-interaction',
      standalone: true,
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<span class="interaction">{{ capture() }}</span>`,
    })
    class InteractionComponent implements ToolUIComponent {
      readonly tool = input.required<ToolUIProps>();
      protected capture() {
        seen = this.tool();
        return 'ok';
      }
    }
    registrations = [['weather', InteractionComponent]];
    const { fixture, rt } = await mount();
    flushTapSync(() => rt.append(toolCall('weather')));
    await waitFor(fixture, () =>
      expect(el(fixture).querySelector('span.interaction')).not.toBeNull(),
    );
    // The runtime-backed part exposes the method; it is passed through as-is.
    expect(typeof seen!.unstable_recordInteraction).toBe('function');
    fixture.destroy();
  });
});
