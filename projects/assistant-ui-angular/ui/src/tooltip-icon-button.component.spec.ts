import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../src/testing-internal/test-bed';
import { AuiIconComponent } from './icons/icon.component';
import { AuiTooltipIconButtonComponent } from './tooltip-icon-button.component';
import { overlayRoot, settle } from './test-helpers';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuiTooltipIconButtonComponent, AuiIconComponent],
  template: `<aui-tooltip-icon-button tooltip="Copy" [side]="side" (click)="clicks = clicks + 1">
    <aui-icon name="copy" />
  </aui-tooltip-icon-button>`,
})
class HostComponent {
  side: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
  clicks = 0;
}

describe('AuiTooltipIconButtonComponent', () => {
  async function setup() {
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    document.body.appendChild(fixture.nativeElement);
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    return { fixture, button };
  }
  const tooltip = () => overlayRoot().querySelector('[role="tooltip"]');

  it('labels the button with the tooltip text and renders the icon', async () => {
    const { button } = await setup();
    expect(button.getAttribute('aria-label')).toBe('Copy');
    expect(button.querySelector('svg')).not.toBeNull();
    expect(tooltip()).toBeNull();
  });

  it('shows on focus and hides on blur', async () => {
    const { fixture, button } = await setup();
    button.focus();
    await settle();
    fixture.detectChanges();
    expect(tooltip()?.textContent?.trim()).toBe('Copy');
    expect(tooltip()?.getAttribute('data-side')).toBe('bottom');
    expect(button.getAttribute('aria-describedby')).toBe(tooltip()?.id);
    button.blur();
    await settle();
    fixture.detectChanges();
    expect(tooltip()).toBeNull();
    expect(button.hasAttribute('aria-describedby')).toBe(false);
  });

  it('shows on hover and hides on mouse leave', async () => {
    const { button } = await setup();
    button.dispatchEvent(new MouseEvent('mouseenter'));
    await settle();
    expect(tooltip()).not.toBeNull();
    button.dispatchEvent(new MouseEvent('mouseleave'));
    await settle();
    expect(tooltip()).toBeNull();
  });

  it('hides on Escape', async () => {
    const { button } = await setup();
    button.dispatchEvent(new MouseEvent('mouseenter'));
    await settle();
    expect(tooltip()).not.toBeNull();
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(tooltip()).toBeNull();
  });

  it('forwards clicks to the host', async () => {
    const { fixture, button } = await setup();
    button.click();
    expect(fixture.componentInstance.clicks).toBe(1);
  });
});
