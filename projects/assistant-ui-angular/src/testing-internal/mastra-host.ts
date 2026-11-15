// Original (no upstream counterpart): spec helper that mounts an `[auiProvider]` host.
import { ChangeDetectionStrategy, Component, type Provider } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { AssistantClient, AuiConfig } from '@assistant-ui/store/client';
import { vi } from 'vitest';
import { AuiProviderDirective } from '../lib/provider/aui-provider.directive';
import { injectAui } from '../lib/state/inject-aui';
import { configureTestBed } from './test-bed';

/** A mounted `[auiProvider]` host and the client its descendants see. */
export interface MountedAui {
  fixture: ComponentFixture<unknown>;
  aui: AssistantClient;
  /** Waits (checking the fixture) until `assertion` passes. */
  waitFor(assertion: () => void, timeout?: number): Promise<void>;
  destroy(): void;
}

/**
 * Mounts `[auiProvider]` with the config `createConfig` returns. `createConfig` runs in the host
 * component's injection context, so it can read providers (for example `MASTRA_AUTH`).
 */
export async function mountAui(
  createConfig: () => AuiConfig,
  providers: Provider[] = [],
): Promise<MountedAui> {
  @Component({
    selector: 'aui-mastra-probe',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: ``,
  })
  class ProbeComponent {
    readonly aui = injectAui();
  }
  @Component({
    standalone: true,
    imports: [AuiProviderDirective, ProbeComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<div [auiProvider]="config"><aui-mastra-probe /></div>`,
  })
  class HostComponent {
    readonly config = createConfig();
  }
  configureTestBed({ imports: [HostComponent], providers });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const { aui } = fixture.debugElement.query(By.directive(ProbeComponent))
    .componentInstance as ProbeComponent;
  return {
    fixture,
    aui,
    waitFor: (assertion, timeout = 3000) =>
      vi.waitFor(
        async () => {
          fixture.detectChanges();
          await fixture.whenStable();
          assertion();
        },
        { timeout, interval: 10 },
      ),
    destroy: () => fixture.destroy(),
  };
}
