import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { resource } from '@assistant-ui/tap';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { fixtureConfig } from '../../testing-internal/fixtures';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { AuiThreadRootDirective } from './thread-root.directive';

const speech = {
  state: null as { messageId: string } | null,
  stopSpeaking: vi.fn<() => void>(),
};

const SpeechThread = resource(() => ({
  getState: () => ({ speech: speech.state }),
  stopSpeaking: () => speech.stopSpeaking(),
}));

@Component({
  standalone: true,
  imports: [AuiProviderDirective, AuiThreadRootDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [auiProvider]="config"><div auiThreadRoot class="thread"></div></div>`,
})
class HostComponent {
  readonly config = fixtureConfig({ thread: SpeechThread() });
}

const mount = () => {
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return fixture;
};

const pressEscape = (init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
    cancelable: true,
    ...init,
  });
  document.body.dispatchEvent(event);
  return event;
};

describe('AuiThreadRootDirective', () => {
  afterEach(() => {
    speech.state = null;
    speech.stopSpeaking = vi.fn<() => void>();
    vi.restoreAllMocks();
  });

  it('stops speaking on Escape while a message is spoken', () => {
    const fixture = mount();
    speech.state = { messageId: 'm1' };
    const event = pressEscape();
    expect(speech.stopSpeaking).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    fixture.destroy();
  });

  it('ignores Escape when nothing is spoken or the event was handled', () => {
    const fixture = mount();
    expect(pressEscape().defaultPrevented).toBe(false);

    speech.state = { messageId: 'm1' };
    const handled = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    handled.preventDefault();
    document.body.dispatchEvent(handled);
    pressEscape({ key: 'Enter' });
    expect(speech.stopSpeaking).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('swallows the "No message is being spoken" error only', () => {
    const fixture = mount();
    speech.state = { messageId: 'm1' };
    speech.stopSpeaking = vi.fn(() => {
      throw new Error('No message is being spoken');
    });
    // Listener errors reach Angular's ErrorHandler (console.error) rather
    // than dispatchEvent's caller.
    const error = vi.spyOn(console, 'error');
    expect(() => pressEscape()).not.toThrow();
    expect(speech.stopSpeaking).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('stops listening once destroyed', () => {
    const fixture = mount();
    fixture.destroy();
    speech.state = { messageId: 'm1' };
    pressEscape();
    expect(speech.stopSpeaking).not.toHaveBeenCalled();
  });
});
