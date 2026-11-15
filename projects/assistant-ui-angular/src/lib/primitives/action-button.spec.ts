import { ChangeDetectionStrategy, Component, Directive, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import { AuiActionButtonHostDirective, injectActionButton } from './action-button';

const state = { disabled: signal(true), onClick: vi.fn() };

@Directive({
  selector: 'button[auiTestAction]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
})
class TestActionDirective {
  constructor() {
    injectActionButton({
      disabled: state.disabled,
      onClick: (event) => state.onClick(event),
    });
  }
}

@Directive({
  selector: 'button[auiTestBare]',
  standalone: true,
})
class BareDirective {
  constructor() {
    injectActionButton({ disabled: () => false, onClick: () => undefined });
  }
}

@Component({
  standalone: true,
  imports: [TestActionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button auiTestAction id="plain">plain</button>
    <button auiTestAction id="typed" type="submit">typed</button>
  `,
})
class HostComponent {}

@Component({
  standalone: true,
  imports: [BareDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button auiTestBare>bare</button>`,
})
class BareHostComponent {}

const mount = () => {
  state.disabled.set(true);
  state.onClick.mockClear();
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return { fixture, plain: root.querySelector<HTMLButtonElement>('#plain')!, root };
};

describe('injectActionButton', () => {
  it('renders disabled and data-disabled and ignores clicks while disabled', () => {
    const { plain } = mount();
    expect(plain.getAttribute('disabled')).toBe('');
    expect(plain.hasAttribute('data-disabled')).toBe(true);
    plain.click();
    plain.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(state.onClick).not.toHaveBeenCalled();
  });

  it('re-enables when the signal flips and fires onClick once per click', () => {
    const { fixture, plain } = mount();
    state.disabled.set(false);
    fixture.detectChanges();
    expect(plain.hasAttribute('disabled')).toBe(false);
    expect(plain.hasAttribute('data-disabled')).toBe(false);
    plain.click();
    expect(state.onClick).toHaveBeenCalledTimes(1);
    state.disabled.set(true);
    fixture.detectChanges();
    expect(plain.getAttribute('disabled')).toBe('');
    plain.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(state.onClick).toHaveBeenCalledTimes(1);
  });

  it('skips clicks that were default-prevented', () => {
    const { fixture, plain } = mount();
    state.disabled.set(false);
    fixture.detectChanges();
    const prevented = new MouseEvent('click', { bubbles: true, cancelable: true });
    plain.addEventListener('click', (event) => event.preventDefault(), { capture: true });
    plain.dispatchEvent(prevented);
    expect(state.onClick).not.toHaveBeenCalled();
  });

  it('adds type="button" only when the host has no type', () => {
    const { root, plain } = mount();
    expect(plain.getAttribute('type')).toBe('button');
    expect(root.querySelector('#typed')!.getAttribute('type')).toBe('submit');
  });

  it('throws a clear error when the host directive is missing', () => {
    configureTestBed({ imports: [BareHostComponent] });
    expect(() => TestBed.createComponent(BareHostComponent)).toThrow(
      /AuiActionButtonHostDirective/,
    );
  });
});
