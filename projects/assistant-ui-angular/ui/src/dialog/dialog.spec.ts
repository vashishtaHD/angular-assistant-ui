import { ChangeDetectionStrategy, Component, TemplateRef, ViewChild, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../../src/testing-internal/test-bed';
import { overlayRoot, settle, stubLayout } from '../test-helpers';
import { AuiDialogCloseDirective, AuiDialogService } from './dialog';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuiDialogCloseDirective],
  template: `<ng-template #tpl>
      <p>Hello</p>
      <button class="first">First</button>
      <button class="last" auiDialogClose>Close</button>
    </ng-template>
    <button class="opener" (click)="open()">Open</button>`,
})
class HostComponent {
  @ViewChild('tpl', { static: true }) tpl!: TemplateRef<unknown>;
  readonly dialog = inject(AuiDialogService);
  open() {
    this.dialog.open(this.tpl, { ariaLabel: 'Demo' });
  }
}

describe('AuiDialogService', () => {
  let restore: () => void;
  beforeEach(() => (restore = stubLayout()));
  afterEach(() => restore());

  async function setup() {
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const opener = fixture.nativeElement.querySelector('.opener') as HTMLButtonElement;
    document.body.appendChild(fixture.nativeElement);
    opener.focus();
    opener.click();
    fixture.detectChanges();
    await settle();
    return { fixture, opener };
  }

  it('renders a labelled modal dialog with aui classes', async () => {
    await setup();
    const panel = overlayRoot().querySelector('[role="dialog"]') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(panel.getAttribute('aria-label')).toBe('Demo');
    expect(overlayRoot().querySelector('.aui-dialog-backdrop')).not.toBeNull();
    expect(overlayRoot().querySelector('.aui-dialog-panel [role="dialog"]')).toBe(panel);
  });

  it('moves focus into the dialog and traps Tab at both ends', async () => {
    await setup();
    const panel = overlayRoot().querySelector('[role="dialog"]') as HTMLElement;
    expect(panel.contains(document.activeElement)).toBe(true);
    const first = panel.querySelector('.first') as HTMLElement;
    const last = panel.querySelector('.last') as HTMLElement;
    const anchors = overlayRoot().querySelectorAll('.cdk-focus-trap-anchor');
    expect(anchors.length).toBe(2);
    // Tabbing past the last element lands on the end anchor, which wraps to the first.
    (anchors[1] as HTMLElement).focus();
    expect(document.activeElement).toBe(first);
    // Shift+Tab before the first element lands on the start anchor, which wraps to the last.
    (anchors[0] as HTMLElement).focus();
    expect(document.activeElement).toBe(last);
  });

  it('returns focus to the opener on Escape', async () => {
    const { fixture, opener } = await setup();
    const panel = overlayRoot().querySelector('[role="dialog"]') as HTMLElement;
    panel.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
    );
    fixture.detectChanges();
    await settle();
    expect(overlayRoot().querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('closes through [auiDialogClose] and restores focus', async () => {
    const { fixture, opener } = await setup();
    (overlayRoot().querySelector('.last') as HTMLElement).click();
    fixture.detectChanges();
    await settle();
    expect(overlayRoot().querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
