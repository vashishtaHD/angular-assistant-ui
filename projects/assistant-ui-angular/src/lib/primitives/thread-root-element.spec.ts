// Ported from packages/react/src/primitives/thread/ThreadRootElementContext.ts (useThreadRootElementRef) @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { fixtureConfig } from '../../testing-internal/fixtures';
import { configureTestBed } from '../../testing-internal/test-bed';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { AuiThreadRootDirective, injectThreadRootElementRef } from './thread-root.directive';

@Component({
  selector: 'app-probe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
})
class ProbeComponent {
  readonly rootRef = injectThreadRootElementRef();
}

@Component({
  standalone: true,
  imports: [AuiProviderDirective, AuiThreadRootDirective, ProbeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [auiProvider]="config">
      <div auiThreadRoot class="thread"><app-probe class="inside" /></div>
    </div>
    <app-probe class="outside" />
  `,
})
class HostComponent {
  readonly config = fixtureConfig({});
}

describe('injectThreadRootElementRef', () => {
  it('returns the enclosing thread root element, or undefined outside one', () => {
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const probes = fixture.debugElement.queryAll((node) => node.name === 'app-probe');
    const inside = probes.find((p) =>
      (p.nativeElement as HTMLElement).classList.contains('inside'),
    );
    const outside = probes.find((p) =>
      (p.nativeElement as HTMLElement).classList.contains('outside'),
    );

    expect((inside?.componentInstance as ProbeComponent).rootRef?.nativeElement).toBe(
      root.querySelector('.thread'),
    );
    expect((outside?.componentInstance as ProbeComponent).rootRef).toBeUndefined();
  });
});
