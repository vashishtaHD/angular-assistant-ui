// Ported from packages/react/src/primitives/actionBar/ActionBarExportMarkdown.tsx @ 7d74276
import { Directive, NgZone, booleanAttribute, inject, input, output } from '@angular/core';
import { injectAui } from '../../state/inject-aui';
import { injectAuiState } from '../../state/inject-aui-state';
import { AuiActionButtonHostDirective, injectActionButton } from '../action-button';

/** Emitted by `[auiActionBarExportMarkdown]` (`onExport`). */
export interface AuiExportMarkdownEvent {
  /** The message as Markdown text. */
  readonly content: string;
  /** True once a handler called {@link AuiExportMarkdownEvent.preventDefault}. */
  readonly defaultPrevented: boolean;
  /** Suppresses the default `.md` file download (use to export elsewhere). */
  preventDefault(): void;
}

/**
 * A button that exports the message as Markdown. It emits `onExport`; unless a
 * handler calls `event.preventDefault()`, the default downloads a `.md` file.
 * Disabled while an assistant message is running or when it has no text.
 *
 * @example
 * ```html
 * <button auiActionBarExportMarkdown filename="answer.md">Export</button>
 * ```
 */
@Directive({
  selector: 'button[auiActionBarExportMarkdown]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
})
export class AuiActionBarExportMarkdownDirective {
  /** Download file name; defaults to `message-<timestamp>.md`. */
  readonly filename = input<string | undefined>(undefined);
  /** Consumer-controlled disabled flag. */
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Emits the Markdown content before the default download. */
  // The `onExport` binding name is part of the public contract (mirrors React's prop).
  // eslint-disable-next-line @angular-eslint/no-output-rename, @angular-eslint/no-output-on-prefix
  readonly exported = output<AuiExportMarkdownEvent>({ alias: 'onExport' });

  private readonly aui = injectAui();
  private readonly zone = inject(NgZone);
  private readonly exportable = injectAuiState(
    (s) =>
      (s.message.role !== 'assistant' || s.message.status?.type !== 'running') &&
      s.message.parts.some((part) => part.type === 'text' && part.text.length > 0),
  );

  constructor() {
    injectActionButton({
      disabled: () => this.disabled() || !this.exportable(),
      onClick: () => this.export(),
    });
  }

  private export(): void {
    const content = this.aui.message.getCopyText();
    if (!content) return;
    let prevented = false;
    this.exported.emit({
      content,
      get defaultPrevented() {
        return prevented;
      },
      preventDefault: () => {
        prevented = true;
      },
    });
    if (prevented) return;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.filename() ?? `message-${Date.now()}.md`;
    anchor.rel = 'noopener';
    // Firefox starts a download only for an anchor that is in the document.
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    // Outside the zone: a long housekeeping timer must not hold the app unstable.
    this.zone.runOutsideAngular(() => setTimeout(() => URL.revokeObjectURL(url), 40_000));
  }
}
