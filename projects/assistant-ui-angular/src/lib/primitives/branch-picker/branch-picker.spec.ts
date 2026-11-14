import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { flushTapSync } from '@assistant-ui/tap';
import { describe, expect, it } from 'vitest';
import { configureTestBed } from '../../../testing-internal/test-bed';
import { createTestRuntime, type TestRuntime } from '../../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../../provider/aui-provider.directive';
import { AuiActionBarEditDirective } from '../action-bar/action-bar-edit.directive';
import { AuiComposerCancelDirective } from '../composer-cancel.directive';
import { AuiComposerInputDirective } from '../composer-input.directive';
import { AuiComposerRootDirective } from '../composer-root.directive';
import { AuiComposerSendDirective } from '../composer-send.directive';
import { AuiEditComposerDirective } from '../edit-composer/edit-composer.directive';
import {
  AuiMessageTemplateDirective,
  AuiThreadMessagesComponent,
} from '../thread-messages.component';
import {
  AuiBranchPickerCountComponent,
  AuiBranchPickerNextDirective,
  AuiBranchPickerNumberComponent,
  AuiBranchPickerPreviousDirective,
  AuiBranchPickerRootDirective,
} from './branch-picker';

let current: TestRuntime;

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiActionBarEditDirective,
    AuiEditComposerDirective,
    AuiComposerRootDirective,
    AuiComposerInputDirective,
    AuiComposerSendDirective,
    AuiComposerCancelDirective,
    AuiBranchPickerRootDirective,
    AuiBranchPickerPreviousDirective,
    AuiBranchPickerNextDirective,
    AuiBranchPickerNumberComponent,
    AuiBranchPickerCountComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage>
          <div class="row">
            <div auiBranchPickerRoot hideWhenSingleBranch class="picker">
              <button auiBranchPickerPrevious class="prev">x</button>
              <aui-branch-picker-number class="num" />/<aui-branch-picker-count class="cnt" />
              <button auiBranchPickerNext class="next">x</button>
            </div>
            <button auiActionBarEdit class="edit">x</button>
            <form *auiEditComposer auiComposerRoot class="editor">
              <textarea auiComposerInput></textarea>
              <button auiComposerCancel class="cancel">x</button>
              <button auiComposerSend class="save">x</button>
            </form>
          </div>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class HostComponent {
  readonly config = current.config;
}

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await Promise.resolve();
  }
};

const mount = async () => {
  current = createTestRuntime({
    onEdit: async (message) => {
      current.appendBranch(message.parentId, {
        id: 'u1-edited',
        role: 'user',
        content: message.content as never,
      });
    },
  });
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  flushTapSync(() => {
    current.append({ id: 'u1', role: 'user', content: [{ type: 'text', text: 'first' }] });
    current.append({ id: 'a1', role: 'assistant', content: [{ type: 'text', text: 'reply' }] });
  });
  await settle(fixture);
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    el,
    rows: () => Array.from(el.querySelectorAll<HTMLElement>('.row')),
  };
};

const click = (el: HTMLElement) => flushTapSync(() => el.click());

const type = (textarea: HTMLTextAreaElement, text: string) => {
  textarea.value = text;
  flushTapSync(() => textarea.dispatchEvent(new Event('input', { bubbles: true })));
};

describe('branch picker and edit composer', () => {
  it('hideWhenSingleBranch hides a single-branch picker', async () => {
    const { fixture, rows } = await mount();
    expect(rows()[0].querySelector('.picker')!.hasAttribute('hidden')).toBe(true);
    fixture.destroy();
  });

  it('edit, type, send creates a branch (count 2, number 2, previous enabled)', async () => {
    const { fixture, rows } = await mount();
    const row = () => rows()[0];
    expect(row().querySelector('.editor')).toBeNull();
    click(row().querySelector<HTMLButtonElement>('.edit')!);
    await settle(fixture);
    const textarea = row().querySelector<HTMLTextAreaElement>('textarea')!;
    expect(textarea.value).toBe('first');
    type(textarea, 'first edited');
    await settle(fixture);
    click(row().querySelector<HTMLButtonElement>('.save')!);
    await settle(fixture);
    await new Promise((r) => setTimeout(r, 20));
    await settle(fixture);
    const first = rows()[0];
    expect(first.querySelector('.picker')!.hasAttribute('hidden')).toBe(false);
    expect(first.querySelector('.cnt')!.textContent).toBe('2');
    expect(first.querySelector('.num')!.textContent).toBe('2');
    expect(first.querySelector<HTMLButtonElement>('.prev')!.disabled).toBe(false);
    expect(first.querySelector<HTMLButtonElement>('.next')!.disabled).toBe(true);
    expect(first.querySelector('.editor')).toBeNull();
    fixture.destroy();
  });

  it('previous / next switch branches', async () => {
    const { fixture, rows } = await mount();
    click(rows()[0].querySelector<HTMLButtonElement>('.edit')!);
    await settle(fixture);
    type(rows()[0].querySelector<HTMLTextAreaElement>('textarea')!, 'edited');
    await settle(fixture);
    click(rows()[0].querySelector<HTMLButtonElement>('.save')!);
    await settle(fixture);
    await new Promise((r) => setTimeout(r, 20));
    await settle(fixture);
    click(rows()[0].querySelector<HTMLButtonElement>('.prev')!);
    await settle(fixture);
    expect(rows()[0].querySelector('.num')!.textContent).toBe('1');
    expect(rows()[0].querySelector<HTMLButtonElement>('.prev')!.disabled).toBe(true);
    click(rows()[0].querySelector<HTMLButtonElement>('.next')!);
    await settle(fixture);
    expect(rows()[0].querySelector('.num')!.textContent).toBe('2');
    fixture.destroy();
  });

  it('cancel restores the original', async () => {
    const { fixture, rows } = await mount();
    click(rows()[0].querySelector<HTMLButtonElement>('.edit')!);
    await settle(fixture);
    type(rows()[0].querySelector<HTMLTextAreaElement>('textarea')!, 'discard me');
    await settle(fixture);
    click(rows()[0].querySelector<HTMLButtonElement>('.cancel')!);
    await settle(fixture);
    expect(rows()[0].querySelector('.editor')).toBeNull();
    expect(rows()[0].querySelector('.picker')!.hasAttribute('hidden')).toBe(true);
    // Editing again starts from the original text.
    click(rows()[0].querySelector<HTMLButtonElement>('.edit')!);
    await settle(fixture);
    expect(rows()[0].querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('first');
    fixture.destroy();
  });
});
