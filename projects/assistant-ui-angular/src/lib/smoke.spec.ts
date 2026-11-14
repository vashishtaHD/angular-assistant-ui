import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createAssistantClient } from '@assistant-ui/store/client';
import { describe, expect, it } from 'vitest';
import { configureTestBed } from '../testing-internal/test-bed';

@Component({
  selector: 'aui-smoke',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p>hello {{ name }}</p>`,
})
class SmokeComponent {
  readonly name = 'aui';
}

describe('workspace smoke', () => {
  it('resolves the store client without React', () => {
    expect(typeof createAssistantClient).toBe('function');
  });

  it('renders an OnPush standalone component', async () => {
    configureTestBed({ imports: [SmokeComponent] });
    const fixture = TestBed.createComponent(SmokeComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toBe('hello aui');
  });
});
