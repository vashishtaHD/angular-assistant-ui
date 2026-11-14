// Ported from packages/react/src/primitives/assistantModal/AssistantModalRoot.test.tsx @ 7d74276
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { configureTestBed } from '../../../testing-internal/test-bed';
import { createTestRuntime } from '../../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../../provider/aui-provider.directive';
import { AuiAssistantModalAnchorDirective } from './assistant-modal-anchor.directive';
import { AuiAssistantModalContentDirective } from './assistant-modal-content.directive';
import { AuiAssistantModalRootDirective } from './assistant-modal-root.directive';
import { AuiAssistantModalTriggerDirective } from './assistant-modal-trigger.directive';

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiAssistantModalRootDirective,
    AuiAssistantModalTriggerDirective,
    AuiAssistantModalAnchorDirective,
    AuiAssistantModalContentDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button id="outside">outside</button>
    <div [auiProvider]="config">
      <div auiAssistantModalRoot [openOnRunStart]="openOnRunStart()">
        <div auiAssistantModalAnchor id="anchor">
          <button auiAssistantModalTrigger>chat</button>
        </div>
        <div auiAssistantModalContent [dismissOnInteractOutside]="dismiss()">
          <input id="field" />
        </div>
      </div>
    </div>
  `,
})
class HostComponent {
  readonly rt = createTestRuntime();
  readonly config = this.rt.config;
  readonly openOnRunStart = signal(true);
  readonly dismiss = signal(true);
}

async function setup() {
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  document.body.append(el);
  const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return {
    fixture,
    host: fixture.componentInstance,
    trigger: el.querySelector<HTMLButtonElement>('button[auiAssistantModalTrigger]')!,
    content: el.querySelector<HTMLElement>('[auiAssistantModalContent]')!,
    field: el.querySelector<HTMLInputElement>('#field')!,
    settle,
  };
}

describe('assistant modal', () => {
  it('starts closed with the dialog wiring', async () => {
    const t = await setup();
    expect(t.content.getAttribute('role')).toBe('dialog');
    expect(t.content.hidden).toBe(true);
    expect(t.trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(t.trigger.getAttribute('aria-expanded')).toBe('false');
    expect(t.content.getAttribute('data-side')).toBe('top');
    expect(t.content.getAttribute('data-align')).toBe('end');
  });

  it('the trigger toggles and focus moves into the content', async () => {
    const t = await setup();
    t.trigger.click();
    await t.settle();
    expect(t.content.hidden).toBe(false);
    expect(t.trigger.getAttribute('aria-expanded')).toBe('true');
    expect(t.trigger.getAttribute('aria-controls')).toBe(t.content.id);
    expect(document.activeElement).toBe(t.field);
    t.trigger.click();
    await t.settle();
    expect(t.content.hidden).toBe(true);
  });

  it('Escape closes and focuses the trigger', async () => {
    const t = await setup();
    t.trigger.click();
    await t.settle();
    t.field.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    await t.settle();
    expect(t.content.hidden).toBe(true);
    expect(document.activeElement).toBe(t.trigger);
  });

  it('dismisses on an outside pointerdown, but not on the anchor or content', async () => {
    const t = await setup();
    t.trigger.click();
    await t.settle();
    t.field.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    document.getElementById('anchor')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await t.settle();
    expect(t.content.hidden).toBe(false);
    document.getElementById('outside')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await t.settle();
    expect(t.content.hidden).toBe(true);
  });

  it('dismissOnInteractOutside=false keeps it open', async () => {
    const t = await setup();
    t.host.dismiss.set(false);
    await t.settle();
    t.trigger.click();
    await t.settle();
    document.getElementById('outside')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await t.settle();
    expect(t.content.hidden).toBe(false);
  });

  it('openOnRunStart opens on thread.runStart', async () => {
    const t = await setup();
    expect(t.content.hidden).toBe(true);
    t.host.rt.setRunning(true);
    await t.settle();
    expect(t.content.hidden).toBe(false);
  });

  it('does not open on run start when openOnRunStart is false', async () => {
    const t = await setup();
    t.host.openOnRunStart.set(false);
    await t.settle();
    t.host.rt.setRunning(true);
    await t.settle();
    expect(t.content.hidden).toBe(true);
  });
});
