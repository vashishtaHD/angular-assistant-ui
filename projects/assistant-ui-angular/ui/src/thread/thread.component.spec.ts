// Ported from packages/ui/src/components/vue/assistant-ui/thread.test.ts and
// packages/ui/src/components/react/assistant-ui/elements/thread.aui.test.tsx @ 7d74276
import { ChangeDetectionStrategy, Component, type Provider } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { AUI_CLIPBOARD, AuiProviderDirective, injectAuiState } from 'angular-assistant-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../../src/testing-internal/test-bed';
import { createTestRuntime, type TestRuntime } from '../../../src/testing-internal/test-runtime';
import { AUI_ICON_SHAPES } from '../icons/icon-shapes';
import { AUI_THREAD_COMPONENTS } from '../thread-components.token';
import {
  AuiThreadComponent,
  type AuiThreadAvatar,
  type AuiThreadWelcomeConfig,
} from './thread.component';

let runtime: TestRuntime;
let welcome: AuiThreadWelcomeConfig | undefined;
let avatar: AuiThreadAvatar | undefined;

@Component({
  standalone: true,
  imports: [AuiProviderDirective, AuiThreadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [auiProvider]="config" class="host">
    <aui-thread [welcome]="welcome" [assistantAvatar]="avatar" />
  </div>`,
})
class HostComponent {
  readonly config = runtime.config;
  readonly welcome = welcome;
  readonly avatar = avatar;
}

@Component({
  selector: 'app-custom-user-message',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="custom-user">custom: {{ id() }}</div>`,
})
class CustomUserMessageComponent {
  protected readonly id = injectAuiState((s) => s.message.id);
}

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 4; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

interface MountOptions {
  setup?: (rt: TestRuntime) => void;
  providers?: Provider[];
  welcome?: AuiThreadWelcomeConfig;
  avatar?: AuiThreadAvatar;
  /** Runs after the view is created and before the first change detection. */
  beforeRender?: (root: HTMLElement) => void;
}

let mounted: HTMLElement | undefined;

async function mount(opts: MountOptions = {}) {
  runtime = createTestRuntime({
    onEdit: async () => undefined,
    onReload: async () => undefined,
  });
  opts.setup?.(runtime);
  welcome = opts.welcome;
  avatar = opts.avatar;
  configureTestBed({ imports: [HostComponent], providers: opts.providers ?? [] });
  const fixture = TestBed.createComponent(HostComponent);
  const root = fixture.nativeElement as HTMLElement;
  document.body.appendChild(root);
  mounted = root;
  opts.beforeRender?.(root);
  fixture.detectChanges();
  await settle(fixture);
  return { fixture, root };
}

const text = (message: string) => [{ type: 'text' as const, text: message }];
const iconPath = (button: Element) => button.querySelector('svg path')?.getAttribute('d');
const shapeD = (name: 'check' | 'copy') =>
  (AUI_ICON_SHAPES[name] as readonly { t: string; d?: string }[]).find(
    (shape) => shape.t === 'path',
  )?.d;

afterEach(() => {
  mounted?.remove();
  mounted = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('aui-thread', () => {
  it('shows the welcome while the thread is empty and hides it after the first message', async () => {
    const { fixture, root } = await mount({
      welcome: {
        message: 'Hi there',
        suggestions: [{ title: 'Weather', description: 'in Paris', prompt: 'Weather in Paris?' }],
      },
    });
    expect(root.querySelector('.aui-thread-welcome-message')?.textContent?.trim()).toBe('Hi there');
    const suggestion = root.querySelector('.aui-thread-welcome-suggestion');
    expect(suggestion?.textContent).toContain('Weather');
    expect(suggestion?.textContent).toContain('in Paris');

    runtime.append({ id: 'u1', role: 'user', content: text('hello') });
    await settle(fixture);
    expect(root.querySelector('.aui-thread-welcome-root')).toBeNull();
    expect(root.querySelector('.aui-thread-welcome-suggestion')).toBeNull();
    expect(root.querySelector('.aui-user-message-content')?.textContent).toContain('hello');
  });

  it('shows the default welcome text without a welcome config', async () => {
    const { root } = await mount();
    expect(root.querySelector('.aui-thread-welcome-message')?.textContent?.trim()).toBe(
      'How can I help you today?',
    );
  });

  it('shows the edit action on a user message, and the edit composer replaces the message', async () => {
    const { fixture, root } = await mount({
      setup: (rt) => rt.append({ id: 'u1', role: 'user', content: text('first draft') }),
    });
    const edit = root.querySelector<HTMLButtonElement>('.aui-user-action-edit');
    expect(edit).not.toBeNull();
    expect(edit?.getAttribute('aria-label')).toBe('Edit');
    expect(edit?.closest('[hidden]')).toBeNull();

    edit!.click();
    await settle(fixture);
    expect(root.querySelector('.aui-user-message-root')).toBeNull();
    const input = root.querySelector<HTMLTextAreaElement>('.aui-edit-composer-input');
    expect(input?.value).toBe('first draft');
    const buttons = Array.from(root.querySelectorAll('.aui-edit-composer-footer button'));
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Cancel', 'Update']);

    // Closing the edit composer must not schedule work on its destroyed input view.
    const errors = vi.spyOn(console, 'error');
    (buttons[0] as HTMLButtonElement).click();
    await settle(fixture);
    expect(errors).not.toHaveBeenCalled();
    expect(root.querySelector('.aui-edit-composer-root')).toBeNull();
    expect(root.querySelector('.aui-user-message-content')?.textContent).toContain('first draft');
  });

  it('shows copy and reload on an assistant message, and the branch picker from two branches', async () => {
    const { fixture, root } = await mount({
      setup: (rt) => {
        rt.append({ id: 'u1', role: 'user', content: text('question') });
        rt.append({ id: 'a1', role: 'assistant', content: text('answer one') });
      },
    });
    const bar = root.querySelector('.aui-assistant-action-bar-root')!;
    expect(bar.hasAttribute('hidden')).toBe(false);
    const labels = Array.from(bar.querySelectorAll('button')).map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(labels).toContain('Copy');
    expect(labels).toContain('Refresh');
    const picker = root.querySelector('.aui-assistant-message-footer .aui-branch-picker-root');
    expect(picker?.hasAttribute('hidden')).toBe(true);

    runtime.appendBranch('u1', { id: 'a2', role: 'assistant', content: text('answer two') });
    await settle(fixture);
    const shown = root.querySelector('.aui-assistant-message-footer .aui-branch-picker-root');
    expect(shown?.hasAttribute('hidden')).toBe(false);
    expect(
      shown?.querySelector('.aui-branch-picker-state')?.textContent?.replace(/\s+/g, ' '),
    ).toBe('2 / 2');
    const pickerLabels = Array.from(shown!.querySelectorAll('button')).map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(pickerLabels).toEqual(['Previous', 'Next']);
  });

  it('copies an assistant message and flips its icon to check', async () => {
    const clipboard = vi.fn(async () => undefined);
    const { fixture, root } = await mount({
      providers: [{ provide: AUI_CLIPBOARD, useValue: clipboard }],
      setup: (rt) => {
        rt.append({ id: 'u1', role: 'user', content: text('question') });
        rt.append({ id: 'a1', role: 'assistant', content: text('the answer') });
      },
    });
    const copy = root.querySelector<HTMLButtonElement>(
      '.aui-assistant-action-bar-root button[aria-label="Copy"]',
    )!;
    expect(iconPath(copy)).toBe(shapeD('copy'));
    copy.click();
    await settle(fixture);
    expect(clipboard).toHaveBeenCalledWith('the answer');
    expect(iconPath(copy)).toBe(shapeD('check'));
  });

  it('shows the scroll-to-bottom button only after scrolling up', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
    let scrollTop = 400;
    let viewport!: HTMLElement;
    const { fixture, root } = await mount({
      setup: (rt) => {
        rt.append({ id: 'u1', role: 'user', content: text('question') });
        rt.append({ id: 'a1', role: 'assistant', content: text('answer') });
      },
      beforeRender: (el) => {
        viewport = el.querySelector('.aui-thread-viewport') as HTMLElement;
        Object.defineProperty(viewport, 'scrollHeight', { get: () => 500, configurable: true });
        Object.defineProperty(viewport, 'clientHeight', { get: () => 100, configurable: true });
        Object.defineProperty(viewport, 'scrollTop', {
          get: () => scrollTop,
          set: (value: number) => (scrollTop = value),
          configurable: true,
        });
        Object.defineProperty(viewport, 'scrollTo', {
          value: ({ top }: { top: number }) => (scrollTop = Math.min(top, 400)),
          configurable: true,
        });
      },
    });
    const frame = async () => {
      await settle(fixture);
      vi.advanceTimersToNextFrame();
      await settle(fixture);
    };
    const button = root.querySelector<HTMLButtonElement>('.aui-thread-scroll-to-bottom')!;
    expect(button.getAttribute('aria-label')).toBe('Scroll to bottom');
    viewport.dispatchEvent(new Event('scroll'));
    await frame();
    expect(button.disabled).toBe(true);

    scrollTop = 50;
    viewport.dispatchEvent(new Event('scroll'));
    await frame();
    expect(button.disabled).toBe(false);
  });

  it('shows the error banner on an errored run', async () => {
    const { root } = await mount({
      setup: (rt) => {
        rt.append({ id: 'u1', role: 'user', content: text('question') });
        rt.append({
          id: 'a1',
          role: 'assistant',
          content: text('partial'),
          status: { type: 'incomplete', reason: 'error', error: 'The model is overloaded' },
        });
      },
    });
    const banner = root.querySelector('.aui-message-error-root');
    expect(banner?.getAttribute('role')).toBe('alert');
    expect(banner?.querySelector('.aui-message-error-message')?.textContent?.trim()).toBe(
      'The model is overloaded',
    );
  });

  it('renders no error banner on a completed run', async () => {
    const { root } = await mount({
      setup: (rt) => {
        rt.append({ id: 'u1', role: 'user', content: text('question') });
        rt.append({ id: 'a1', role: 'assistant', content: text('fine') });
      },
    });
    expect(root.querySelector('.aui-message-error-root')).toBeNull();
  });

  it('renders assistant text as styled markdown with a code header that copies', async () => {
    const clipboard = vi.fn(async () => undefined);
    const { fixture, root } = await mount({
      providers: [{ provide: AUI_CLIPBOARD, useValue: clipboard }],
      setup: (rt) => {
        rt.append({ id: 'u1', role: 'user', content: text('code please') });
        rt.append({
          id: 'a1',
          role: 'assistant',
          content: text('Here:\n\n```js\nconst a = 1;\n```\n'),
        });
      },
    });
    expect(root.querySelector('aui-markdown-text-styled .aui-md')).not.toBeNull();
    const header = root.querySelector('.aui-code-header-root')!;
    expect(header.querySelector('.aui-code-header-language')?.textContent?.trim()).toBe('js');
    const copy = header.querySelector<HTMLButtonElement>('button')!;
    expect(copy.getAttribute('aria-label')).toBe('Copy code');
    expect(iconPath(copy)).toBe(shapeD('copy'));

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    copy.click();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    expect(clipboard).toHaveBeenCalledWith('const a = 1;\n');
    expect(iconPath(copy)).toBe(shapeD('check'));

    vi.advanceTimersByTime(2999);
    fixture.detectChanges();
    expect(iconPath(copy)).toBe(shapeD('check'));
    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(iconPath(copy)).toBe(shapeD('copy'));
  });

  it('replaces UserMessage through AUI_THREAD_COMPONENTS', async () => {
    const { root } = await mount({
      providers: [
        { provide: AUI_THREAD_COMPONENTS, useValue: { UserMessage: CustomUserMessageComponent } },
      ],
      setup: (rt) => {
        rt.append({ id: 'u1', role: 'user', content: text('question') });
        rt.append({ id: 'a1', role: 'assistant', content: text('answer') });
      },
    });
    expect(root.querySelector('.custom-user')?.textContent?.trim()).toBe('custom: u1');
    expect(root.querySelector('.aui-user-message-root')).toBeNull();
    expect(root.querySelector('[data-slot="aui_assistant-message-root"]')).not.toBeNull();
  });

  it('shows the assistant avatar when one is given', async () => {
    const { root } = await mount({
      avatar: { src: 'https://example.test/bot.png', alt: 'Bot', fallback: 'B' },
      setup: (rt) => rt.append({ id: 'a1', role: 'assistant', content: text('hi') }),
    });
    const img = root.querySelector<HTMLImageElement>('.aui-avatar img');
    expect(img?.getAttribute('src')).toBe('https://example.test/bot.png');
    expect(img?.getAttribute('alt')).toBe('Bot');
  });

  describe('accessibility', () => {
    const unnamed = (scope: HTMLElement) =>
      Array.from(scope.querySelectorAll('button')).filter(
        (b) => !(b.getAttribute('aria-label')?.trim() || b.textContent?.trim()),
      );

    it('gives every button of an empty thread an accessible name', async () => {
      const { root } = await mount({
        welcome: { suggestions: [{ title: 'Weather', prompt: 'Weather?' }] },
      });
      expect(root.querySelectorAll('button').length).toBeGreaterThan(1);
      expect(unnamed(root)).toEqual([]);
    });

    it('gives every button of a filled thread an accessible name', async () => {
      const { root } = await mount({
        setup: (rt) => {
          rt.append({ id: 'u1', role: 'user', content: text('question') });
          rt.append({ id: 'a1', role: 'assistant', content: text('```ts\nx\n```') });
          rt.appendBranch('u1', { id: 'a2', role: 'assistant', content: text('answer two') });
        },
      });
      expect(root.querySelectorAll('button').length).toBeGreaterThan(4);
      expect(unnamed(root)).toEqual([]);
    });

    it('labels the composer input and tabs from the input to send', async () => {
      const { fixture, root } = await mount();
      const input = root.querySelector<HTMLTextAreaElement>('.aui-composer-input')!;
      expect(input.getAttribute('aria-label')).toBe('Message input');
      expect(input.getAttribute('placeholder')).toBe('Send a message...');
      input.value = 'hello';
      input.dispatchEvent(new Event('input'));
      await settle(fixture);

      const composer = root.querySelector('.aui-composer-root')!;
      const tabbable = Array.from(
        composer.querySelectorAll<HTMLElement>('textarea, button, input, a[href], [tabindex]'),
      ).filter(
        (el) =>
          !(el as HTMLButtonElement).disabled &&
          el.getAttribute('tabindex') !== '-1' &&
          !el.closest('[hidden]'),
      );
      expect(tabbable[0]).toBe(input);
      expect(tabbable[1]?.classList.contains('aui-composer-send')).toBe(true);
      expect(tabbable[1]?.getAttribute('aria-label')).toBe('Send message');
    });
  });
});
