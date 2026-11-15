// Ported from packages/ui/src/components/react/assistant-ui/elements/markdown-text.tsx and
// packages/ui/src/components/vue/assistant-ui/markdown-text.vue @ 7d74276
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  NgZone,
  ViewEncapsulation,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { AUI_CLIPBOARD, type SmoothOptions } from 'angular-assistant-ui';
import {
  AuiMarkdownTextComponent,
  type AuiMarkdownComponents,
  type AuiMarkdownComponentsByLanguage,
} from 'angular-assistant-ui/markdown';
import { AuiButtonDirective } from './button.directive';
import { AuiIconComponent } from './icons/icon.component';
import { AuiTooltipDirective } from './tooltip-icon-button.component';

/** How long the code header shows its copied state, in milliseconds. */
const COPIED_DURATION = 3000;

/**
 * The styled code block header of `aui-markdown-text-styled`: the fence
 * language and a copy button. After a copy (through `AUI_CLIPBOARD`) the
 * button shows a check icon for 3000 ms. Pass it as `codeHeader` (in
 * `components`, or per language in `componentsByLanguage`) of a plain
 * `aui-markdown-text` to reuse it there.
 */
@Component({
  selector: 'aui-code-header-styled',
  standalone: true,
  imports: [AuiButtonDirective, AuiIconComponent, AuiTooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-code-header-root', '[attr.data-copied]': 'copied() ? "" : null' },
  template: `<span class="aui-code-header-language">{{ language() }}</span>
    <button
      auiButton
      variant="ghost"
      size="icon"
      class="aui-code-header-copy"
      auiTooltip="Copy"
      aria-label="Copy code"
      (click)="copy()"
    >
      @if (copied()) {
        <aui-icon name="check" />
      } @else {
        <aui-icon name="copy" />
      }
    </button>`,
})
// The name pairs with the markdown entry's `AuiCodeHeader`.
// eslint-disable-next-line @angular-eslint/component-class-suffix
export class AuiStyledCodeHeader {
  /** The fence language, `''` when the fence has none. */
  readonly language = input<string>('');
  /** The code of the block. */
  readonly code = input<string>('');

  private readonly clipboard = inject(AUI_CLIPBOARD);
  private readonly zone = inject(NgZone);
  /** @internal True for 3000 ms after a copy. */
  protected readonly copied = signal(false);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      if (this.timer !== undefined) clearTimeout(this.timer);
    });
  }

  /** @internal Copies the code unless it is empty or was just copied. */
  protected copy(): void {
    const code = this.code();
    if (!code || this.copied()) return;
    let write: void | Promise<void>;
    try {
      write = this.clipboard(code);
    } catch {
      return;
    }
    Promise.resolve(write).then(
      () => {
        if (this.destroyed) return;
        this.copied.set(true);
        // Outside the zone: the timer must not hold the app unstable.
        this.timer = this.zone.runOutsideAngular(() =>
          setTimeout(() => {
            this.timer = undefined;
            this.copied.set(false);
          }, COPIED_DURATION),
        );
      },
      () => undefined,
    );
  }
}

/**
 * The styled markdown text of `aui-thread`: Task 11's streaming
 * `aui-markdown-text` with the `aui-md` class (styled by `styles.css`) and
 * {@link AuiStyledCodeHeader} above every fenced code block. Entries of
 * `components` and `componentsByLanguage` override the defaults.
 *
 * Use it inside a part scope, for example as the `Text` slot of
 * `AUI_THREAD_COMPONENTS` or in an `auiPart="text"` template.
 *
 * @example
 * ```html
 * <ng-template auiPart="text"><aui-markdown-text-styled /></ng-template>
 * ```
 */
@Component({
  selector: 'aui-markdown-text-styled',
  standalone: true,
  imports: [AuiMarkdownTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-md-root' },
  template: `<aui-markdown-text
    class="aui-md"
    [smooth]="smooth()"
    [preprocess]="preprocess()"
    [components]="mergedComponents()"
    [componentsByLanguage]="componentsByLanguage()"
  />`,
})
// The name is the public API this entry documents (upstream's `MarkdownText`).
// eslint-disable-next-line @angular-eslint/component-class-suffix
export class AuiStyledMarkdownText {
  /** Smooth reveal; see `aui-markdown-text`. */
  readonly smooth = input<boolean | SmoothOptions>(true);
  /** Transforms the text before it is parsed; see `aui-markdown-text`. */
  readonly preprocess = input<((text: string) => string) | undefined>(undefined);
  /** Node and code block components, merged over the styled code header. */
  readonly components = input<Partial<AuiMarkdownComponents> | undefined>(undefined);
  /** Code header and body components per fence language. */
  readonly componentsByLanguage = input<AuiMarkdownComponentsByLanguage | undefined>(undefined);

  /** @internal */
  protected readonly mergedComponents = computed<Partial<AuiMarkdownComponents>>(() => ({
    codeHeader: AuiStyledCodeHeader,
    ...this.components(),
  }));
}
