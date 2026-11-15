// Ported from packages/react/src/primitives/messagePart/MessagePartImage.tsx @ 7d74276
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { AuiConfig } from '@assistant-ui/store/client';
import { describe, expect, it } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime } from '../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { AuiMessagePartsComponent, AuiPartTemplateDirective } from './message-parts.component';
import { AuiPartImageDirective } from './part-image.directive';
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
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessagePartsComponent,
    AuiPartTemplateDirective,
    AuiPartImageDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage>
          <aui-message-parts>
            <ng-template auiPart="image"
              ><img auiPartImage alt="generated" class="pic"
            /></ng-template>
          </aui-message-parts>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class HostComponent {
  readonly config = hostConfig;
}

describe('MessagePartPrimitive.Image', () => {
  it('renders src from the part and keeps the other attributes', async () => {
    const rt = createTestRuntime();
    rt.append({
      role: 'assistant',
      content: [
        { type: 'image', image: 'https://example.test/a.png' },
        { type: 'image', image: 'https://example.test/b.png' },
      ],
    });
    hostConfig = rt.config;
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await settle(fixture);
    const images = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLImageElement>('img.pic'),
    );
    expect(images.map((img) => img.getAttribute('src'))).toEqual([
      'https://example.test/a.png',
      'https://example.test/b.png',
    ]);
    expect(images[0]?.getAttribute('alt')).toBe('generated');
  });
});
