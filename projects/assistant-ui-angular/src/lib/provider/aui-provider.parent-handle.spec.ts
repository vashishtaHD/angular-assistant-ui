import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import * as storeClient from '@assistant-ui/store/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { ThreadClient, fixtureConfig, messageDerived } from '../../testing-internal/fixtures';
import { injectAui } from '../state/inject-aui';
import { AuiProviderDirective } from './aui-provider.directive';

vi.mock('@assistant-ui/store/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@assistant-ui/store/client')>();
  return { ...actual, createAssistantClient: vi.fn(actual.createAssistantClient) };
});

const createAssistantClient = vi.mocked(storeClient.createAssistantClient);

describe('AuiProviderDirective parent handle', () => {
  afterEach(() => {
    createAssistantClient.mockClear();
  });

  it('passes the parent provider real handle, not its wrapper, to a nested client', () => {
    @Component({
      selector: 'aui-nested',
      standalone: true,
      imports: [AuiProviderDirective],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<div [auiProvider]="config" [auiProviderExtends]="aui"></div>`,
    })
    class NestedComponent {
      readonly aui = injectAui();
      readonly config = fixtureConfig({ message: messageDerived() });
    }
    @Component({
      standalone: true,
      imports: [AuiProviderDirective, NestedComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<div [auiProvider]="config"><aui-nested /></div>`,
    })
    class HostComponent {
      readonly config = fixtureConfig({ thread: ThreadClient() });
    }
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    expect(createAssistantClient).toHaveBeenCalledTimes(2);
    const parentHandle = createAssistantClient.mock.results[0]!.value;
    // A real handle enables the store's parent-snapshot fast path; the
    // directive's forwarding wrapper would force a root refresh per update.
    const nestedOptions = createAssistantClient.mock.calls[1]![1];
    expect(nestedOptions?.parent).toBe(parentHandle);

    fixture.destroy();
  });
});
