// Ported from packages/ui/src/components/react/ui/base/collapsible.tsx @ 7d74276
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  ViewEncapsulation,
  computed,
  inject,
  model,
  signal,
  type OnChanges,
  type SimpleChanges,
} from '@angular/core';

let nextId = 0;

/** Matches the 0.2s `grid-template-rows` transition in styles.css. */
const CLOSE_ANIMATION_MS = 200;

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
export class AuiCollapsibleComponent implements OnChanges {
  /** Whether the content is shown. */
  readonly open = model(false);

  /** Id of the content element, for `aria-controls`. */
  readonly contentId = `aui-collapsible-content-${nextId++}`;

  /** True while closed content still animates shut (it stays painted). */
  private readonly closing = signal(false);
  private closingTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * True once the content is closed and its closing animation is over: the
   * content is then `hidden` with an inline `display: none`.
   */
  readonly collapsed = computed(() => !this.open() && !this.closing());

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.closingTimer));
  }

  /** Tracks a bound `open` change for the closing animation. */
  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['open'];
    if (change && !change.firstChange) this.track(!!change.previousValue);
  }

  /** Flips `open`. */
  toggle(): void {
    const wasOpen = this.open();
    this.open.update((value) => !value);
    this.track(wasOpen);
  }

  /** Keeps just-closed content painted for the closing animation, then hides it. */
  private track(wasOpen: boolean): void {
    clearTimeout(this.closingTimer);
    if (this.open() || !wasOpen) {
      this.closing.set(false);
      return;
    }
    this.closing.set(true);
    this.closingTimer = setTimeout(() => this.closing.set(false), CLOSE_ANIMATION_MS);
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
 * `0fr` to `1fr`), so no height measuring is needed. Once closed and done
 * animating (200ms), the body is `hidden` with an inline `display: none`, so
 * author CSS cannot paint a closed body.
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
    '[attr.hidden]': 'root.collapsed() ? "" : null',
    '[style.display]': 'root.collapsed() ? "none" : null',
  },
  template: `<div class="aui-collapsible-inner"><ng-content /></div>`,
})
export class AuiCollapsibleContentComponent {
  protected readonly root = inject(AuiCollapsibleComponent);
  protected readonly hidden = computed(() => !this.root.open());
}
