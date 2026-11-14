import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../../src/testing-internal/test-bed';
import {
  AuiCollapsibleComponent,
  AuiCollapsibleContentComponent,
  AuiCollapsibleTriggerDirective,
} from './collapsible';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AuiCollapsibleComponent,
    AuiCollapsibleTriggerDirective,
    AuiCollapsibleContentComponent,
  ],
  template: `<aui-collapsible [(open)]="open">
    <button auiCollapsibleTrigger>Toggle</button>
    <aui-collapsible-content><p>Body</p></aui-collapsible-content>
  </aui-collapsible>`,
})
class HostComponent {
  open = false;
}

describe('collapsible', () => {
  function setup() {
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      root: el.querySelector('aui-collapsible') as HTMLElement,
      trigger: el.querySelector('button') as HTMLButtonElement,
      content: el.querySelector('aui-collapsible-content') as HTMLElement,
    };
  }

  it('starts closed with matching aria and data attributes', () => {
    const { root, trigger, content } = setup();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(root.hasAttribute('data-closed')).toBe(true);
    expect(root.hasAttribute('data-open')).toBe(false);
    expect(content.hasAttribute('data-closed')).toBe(true);
    expect(trigger.getAttribute('aria-controls')).toBe(content.id);
    expect(content.getAttribute('aria-hidden')).toBe('true');
  });

  it('toggles data-open and aria-expanded on trigger click and syncs the model', () => {
    const { fixture, root, trigger, content } = setup();
    trigger.click();
    fixture.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(root.hasAttribute('data-open')).toBe(true);
    expect(content.hasAttribute('data-open')).toBe(true);
    expect(content.hasAttribute('aria-hidden')).toBe(false);
    expect(fixture.componentInstance.open).toBe(true);
    trigger.click();
    fixture.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(root.hasAttribute('data-closed')).toBe(true);
    expect(fixture.componentInstance.open).toBe(false);
  });
});
