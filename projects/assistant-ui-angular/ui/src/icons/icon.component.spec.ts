import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../../src/testing-internal/test-bed';
import { AuiIconComponent } from './icon.component';
import { AUI_ICON_NAMES, type AuiIconName } from './icon-shapes';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuiIconComponent],
  template: `<aui-icon [name]="name()" />`,
})
class HostComponent {
  name = signal<AuiIconName>('copy');
}

describe('AuiIconComponent', () => {
  it('ships every icon the upstream kit uses', () => {
    const expected: AuiIconName[] = [
      'copy',
      'check',
      'refresh-cw',
      'pencil',
      'chevron-left',
      'chevron-right',
      'arrow-down',
      'arrow-up',
      'square',
      'paperclip',
      'x',
      'file',
      'thumbs-up',
      'thumbs-down',
      'more-horizontal',
      'archive',
      'trash',
      'plus',
      'chevron-down',
      'brain',
      'wrench',
      'loader',
      'alert-circle',
    ];
    expect(AUI_ICON_NAMES).toEqual(expect.arrayContaining(expected));
  });

  it('renders an aria-hidden inline svg for the named icon and updates it', () => {
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.querySelectorAll('rect, path').length).toBe(2);
    fixture.componentInstance.name.set('check');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('svg path').length).toBe(1);
  });
});
