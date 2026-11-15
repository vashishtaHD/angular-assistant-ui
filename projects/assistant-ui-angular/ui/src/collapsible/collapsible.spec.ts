import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { displayOf, useFlexAuthorClass } from '../../../src/testing-internal/author-css';
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

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuiCollapsibleComponent, AuiCollapsibleContentComponent],
  template: `<aui-collapsible [open]="open()">
    <aui-collapsible-content><p>Body</p></aui-collapsible-content>
  </aui-collapsible>`,
})
class BoundHostComponent {
  readonly open = signal(false);
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

  it('hides closed content with hidden and an inline display: none, after the closing animation', () => {
    useFlexAuthorClass();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const { fixture, trigger, content } = setup();
      content.classList.add('flex');
      expect(content.hasAttribute('hidden')).toBe(true);
      expect(content.style.display).toBe('none');
      expect(displayOf(content)).toBe('none');

      trigger.click();
      fixture.detectChanges();
      expect(content.hasAttribute('hidden')).toBe(false);
      expect(content.style.display).toBe('');
      expect(displayOf(content)).toBe('flex');

      trigger.click();
      fixture.detectChanges();
      expect(content.hasAttribute('hidden')).toBe(false);
      vi.advanceTimersByTime(250);
      fixture.detectChanges();
      expect(content.hasAttribute('hidden')).toBe(true);
      expect(displayOf(content)).toBe('none');

      // Reopening during the closing animation cancels the pending hide.
      trigger.click();
      fixture.detectChanges();
      trigger.click();
      fixture.detectChanges();
      trigger.click();
      fixture.detectChanges();
      vi.advanceTimersByTime(250);
      fixture.detectChanges();
      expect(content.hasAttribute('hidden')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('hides content that a bound open input closes, after the closing animation', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      configureTestBed({ imports: [BoundHostComponent] });
      const fixture = TestBed.createComponent(BoundHostComponent);
      fixture.detectChanges();
      const content = (fixture.nativeElement as HTMLElement).querySelector(
        'aui-collapsible-content',
      ) as HTMLElement;
      expect(content.hasAttribute('hidden')).toBe(true);
      fixture.componentInstance.open.set(true);
      fixture.detectChanges();
      expect(content.hasAttribute('hidden')).toBe(false);
      fixture.componentInstance.open.set(false);
      fixture.detectChanges();
      expect(content.hasAttribute('hidden')).toBe(false);
      vi.advanceTimersByTime(250);
      fixture.detectChanges();
      expect(content.hasAttribute('hidden')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
