// Ported from packages/react/src/primitives/thread/ThreadLoadEarlier.tsx behaviour @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { configureTestBed } from '../../testing-internal/test-bed';
import {
  createTestRuntime,
  type TestRuntime,
  type TestRuntimeCallbacks,
} from '../../testing-internal/test-runtime';
import { AuiThreadLoadEarlierDirective } from './thread-load-earlier.directive';

@Component({
  standalone: true,
  imports: [AuiProviderDirective, AuiThreadLoadEarlierDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [auiProvider]="runtime().config">
      <button class="earlier" auiThreadLoadEarlier>earlier</button>
    </div>
  `,
})
class HostComponent {
  readonly runtime = input.required<TestRuntime>();
}

// The runtime forwards extra adapter fields; its callback type only lists a few.
const earlierCallbacks = (hasEarlier: boolean, onLoadEarlier: () => Promise<void>) =>
  ({ hasEarlier, onLoadEarlier }) as unknown as TestRuntimeCallbacks;

async function mount(runtime: TestRuntime) {
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentRef.setInput('runtime', runtime);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  return (fixture.nativeElement as HTMLElement).querySelector('.earlier') as HTMLButtonElement;
}

describe('AuiThreadLoadEarlierDirective', () => {
  it('loads the earlier page on click', async () => {
    const onLoadEarlier = vi.fn(async () => undefined);
    const button = await mount(createTestRuntime(earlierCallbacks(true, onLoadEarlier)));

    expect(button.disabled).toBe(false);
    button.click();
    await vi.waitFor(() => expect(onLoadEarlier).toHaveBeenCalledTimes(1));
  });

  it('is disabled and inert when there is nothing earlier', async () => {
    const onLoadEarlier = vi.fn(async () => undefined);
    const button = await mount(createTestRuntime(earlierCallbacks(false, onLoadEarlier)));

    expect(button.disabled).toBe(true);
    expect(button.hasAttribute('data-disabled')).toBe(true);
    button.click();
    expect(onLoadEarlier).not.toHaveBeenCalled();
  });

  it('stays enabled while a page loads and joins that load', async () => {
    let finish: () => void = () => undefined;
    const onLoadEarlier = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const test = createTestRuntime(earlierCallbacks(true, onLoadEarlier));
    const button = await mount(test);

    button.click();
    button.click();
    await Promise.resolve();
    expect(button.disabled).toBe(false);
    // Core runs one load at a time and shares it between callers.
    expect(onLoadEarlier).toHaveBeenCalledTimes(1);
    finish();
  });
});
