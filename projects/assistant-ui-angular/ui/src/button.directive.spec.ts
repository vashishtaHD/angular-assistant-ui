import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../src/testing-internal/test-bed';
import { AuiButtonDirective } from './button.directive';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuiButtonDirective],
  template: `<button auiButton [variant]="variant()" [size]="size()">Go</button>`,
})
class HostComponent {
  variant = signal<'default' | 'ghost' | 'outline' | 'destructive'>('default');
  size = signal<'sm' | 'md' | 'icon'>('md');
}

describe('AuiButtonDirective', () => {
  it('maps variant and size onto class and data attributes', () => {
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.classList.contains('aui-button')).toBe(true);
    expect(button.dataset['variant']).toBe('default');
    expect(button.dataset['size']).toBe('md');
    expect(button.type).toBe('button');
    fixture.componentInstance.variant.set('destructive');
    fixture.componentInstance.size.set('icon');
    fixture.detectChanges();
    expect(button.dataset['variant']).toBe('destructive');
    expect(button.dataset['size']).toBe('icon');
  });
});
