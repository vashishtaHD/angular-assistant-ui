import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AUI_ICON_SHAPES, type AuiIconName } from './icon-shapes';

/**
 * Inline SVG icon from the lucide set the upstream kit uses. Inherits
 * `currentColor` and sizes with `1em` by default (override with `--aui-icon-size`).
 */
@Component({
  selector: 'aui-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'aui-icon' },
  template: `<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    @for (shape of shapes(); track $index) {
      @switch (shape.t) {
        @case ('path') {
          <svg:path [attr.d]="shape.d" />
        }
        @case ('circle') {
          <svg:circle [attr.cx]="shape.cx" [attr.cy]="shape.cy" [attr.r]="shape.r" />
        }
        @case ('rect') {
          <svg:rect
            [attr.x]="shape.x"
            [attr.y]="shape.y"
            [attr.width]="shape.width"
            [attr.height]="shape.height"
            [attr.rx]="shape.rx"
          />
        }
        @case ('line') {
          <svg:line
            [attr.x1]="shape.x1"
            [attr.y1]="shape.y1"
            [attr.x2]="shape.x2"
            [attr.y2]="shape.y2"
          />
        }
      }
    }
  </svg>`,
})
export class AuiIconComponent {
  /** Icon name; see `AUI_ICON_NAMES`. */
  readonly name = input.required<AuiIconName>();

  protected readonly shapes = computed(() => AUI_ICON_SHAPES[this.name()] ?? []);
}
