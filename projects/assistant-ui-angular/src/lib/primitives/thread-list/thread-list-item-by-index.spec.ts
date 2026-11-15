// Mirrors packages/react/src/primitives/threadList/ThreadListItems.tsx (ThreadListPrimitiveItemByIndex) @ 7d74276
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { InMemoryThreadListAdapter, type RemoteThreadMetadata } from '@assistant-ui/core';
import { afterEach, describe, expect, it } from 'vitest';
import { configureTestBed } from '../../../testing-internal/test-bed';
import { createTestRuntime } from '../../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../../provider/aui-provider.directive';
import { AuiThreadListItemTitleComponent } from './thread-list-item-title.component';
import { AuiThreadListItemByIndexComponent } from './thread-list-item-by-index.component';
import { AuiThreadListItemTemplateDirective } from './thread-list-items.component';

const rows: RemoteThreadMetadata[] = [
  { status: 'regular', remoteId: 'a', title: 'Alpha' },
  { status: 'regular', remoteId: 'b', title: 'Beta' },
  { status: 'archived', remoteId: 'x', title: 'Old' },
];

let config: ReturnType<ReturnType<typeof createTestRuntime>['withThreadList']>['config'];

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadListItemByIndexComponent,
    AuiThreadListItemTemplateDirective,
    AuiThreadListItemTitleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [auiProvider]="config">
    @for (index of indices(); track index) {
      <aui-thread-list-item-by-index [index]="index">
        <ng-template auiThreadListItem
          ><span class="title"><aui-thread-list-item-title /></span
        ></ng-template>
      </aui-thread-list-item-by-index>
    }
    @for (index of archivedIndices(); track index) {
      <aui-thread-list-item-by-index [index]="index" archived>
        <ng-template auiThreadListItem
          ><span class="archived"><aui-thread-list-item-title /></span
        ></ng-template>
      </aui-thread-list-item-by-index>
    }
  </div>`,
})
class HostComponent {
  readonly config = config;
  // Indices must be in range (the list loads asynchronously), as with React's ItemByIndex.
  readonly indices = signal<number[]>([]);
  readonly archivedIndices = signal<number[]>([]);
}

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 4; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

afterEach(() => TestBed.resetTestingModule());

describe('aui-thread-list-item-by-index', () => {
  it('renders the template in the scope of the thread at index, in the given order', async () => {
    const adapter = Object.assign(Object.create(new InMemoryThreadListAdapter()), {
      list: async () => ({ threads: rows }),
    });
    config = createTestRuntime().withThreadList(adapter).config;
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await settle(fixture);
    fixture.componentInstance.indices.set([1, 0]);
    fixture.componentInstance.archivedIndices.set([0]);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;
    const titles = () =>
      Array.from(root.querySelectorAll('.title'), (el) => el.textContent?.trim());
    expect(titles()).toEqual(['Beta', 'Alpha']);
    expect(root.querySelector('.archived')?.textContent?.trim()).toBe('Old');
    fixture.componentInstance.indices.set([0]);
    await settle(fixture);
    expect(titles()).toEqual(['Alpha']);
  });
});
