// Ported from packages/ui/src/components/react/ui/base/collapsible.tsx @ 7d74276
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  ViewEncapsulation,
  computed,
  inject,
  model,
} from '@angular/core';

let nextId = 0;

/**
 * Collapsible root. `open` is a two-way `model`. Children are
 * `[auiCollapsibleTrigger]` and `<aui-collapsible-content>`.
 */
@Component({
  selector: 'aui-collapsible',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'aui-collapsible',
    '[attr.data-open]': 'open() ? "" : null',
    '[attr.data-closed]': 'open() ? null : ""',
  },
  template: `<ng-content />`,
})
export class AuiCollapsibleComponent {
  /** Whether the content is shown. */
  readonly open = model(false);

  /** Id of the content element, for `aria-controls`. */
  readonly contentId = `aui-collapsible-content-${nextId++}`;

  /** Flips `open`. */
  toggle(): void {
    this.open.update((value) => !value);
  }
}

/** Button that toggles the enclosing `aui-collapsible`. */
@Directive({
  selector: '[auiCollapsibleTrigger]',
  standalone: true,
  host: {
    class: 'aui-collapsible-trigger',
    '[attr.aria-expanded]': 'root.open()',
    '[attr.aria-controls]': 'root.contentId',
    '[attr.data-open]': 'root.open() ? "" : null',
    '[attr.data-closed]': 'root.open() ? null : ""',
    '(click)': 'root.toggle()',
  },
})
export class AuiCollapsibleTriggerDirective {
  protected readonly root = inject(AuiCollapsibleComponent);
}

/**
 * Collapsible body. Height animates through CSS (`grid-template-rows` from
 * `0fr` to `1fr`), so no height measuring is needed.
 */
@Component({
  selector: 'aui-collapsible-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'aui-collapsible-content',
    '[id]': 'root.contentId',
    '[attr.data-open]': 'root.open() ? "" : null',
    '[attr.data-closed]': 'root.open() ? null : ""',
    '[attr.aria-hidden]': 'hidden() ? "true" : null',
    '[attr.inert]': 'hidden() ? "" : null',
  },
  template: `<div class="aui-collapsible-inner"><ng-content /></div>`,
})
export class AuiCollapsibleContentComponent {
  protected readonly root = inject(AuiCollapsibleComponent);
  protected readonly hidden = computed(() => !this.root.open());
}
