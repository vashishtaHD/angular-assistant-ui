// Ported from packages/core/src/react/primitives/message/MessageQuote.tsx @ 7d74276
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { AuiConfig } from '@assistant-ui/store/client';
import { describe, expect, it } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime, type DemoMessage } from '../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { AuiMessageQuoteDirective, injectMessageQuote } from './message-quote.directive';
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
  selector: 'aui-test-quote-reader',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<i class="reader">{{ quote()?.messageId ?? 'none' }}</i>`,
})
class QuoteReaderComponent {
  readonly quote = injectMessageQuote();
}

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessageQuoteDirective,
    QuoteReaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage>
          <blockquote *auiMessageQuote="let quote">
            {{ quote.text }} ({{ quote.messageId }})
          </blockquote>
          <aui-test-quote-reader />
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class HostComponent {
  readonly config = hostConfig;
}

const mount = async (message: DemoMessage) => {
  const rt = createTestRuntime();
  rt.append(message);
  hostConfig = rt.config;
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  await settle(fixture);
  return fixture.nativeElement as HTMLElement;
};

describe('MessagePrimitive.Quote', () => {
  it('renders the quote carried by the message metadata', async () => {
    const el = await mount({
      role: 'user',
      content: [{ type: 'text', text: 'why?' }],
      metadata: { custom: { quote: { text: 'the original', messageId: 'm0' } } },
    });
    expect(el.querySelector('blockquote')?.textContent?.trim()).toBe('the original (m0)');
    expect(el.querySelector('.reader')?.textContent).toBe('m0');
  });

  it('renders nothing without a quote', async () => {
    const el = await mount({ role: 'user', content: [{ type: 'text', text: 'hi' }] });
    expect(el.querySelector('blockquote')).toBeNull();
    expect(el.querySelector('.reader')?.textContent).toBe('none');
  });

  it('ignores custom metadata that holds no quote', async () => {
    const el = await mount({
      role: 'user',
      content: [{ type: 'text', text: 'hi' }],
      metadata: { custom: { other: 1 } },
    });
    expect(el.querySelector('blockquote')).toBeNull();
  });
});
