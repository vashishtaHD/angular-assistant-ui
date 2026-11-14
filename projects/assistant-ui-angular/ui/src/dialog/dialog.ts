import { Dialog, DialogRef, type DialogConfig } from '@angular/cdk/dialog';
import type { ComponentType } from '@angular/cdk/portal';
import { Directive, Injectable, TemplateRef, inject, input } from '@angular/core';

/** Options for `AuiDialogService.open`. */
export interface AuiDialogConfig<D = unknown> {
  /** Accessible name of the dialog. */
  readonly ariaLabel?: string | null;
  /** Id of an element that labels the dialog. */
  readonly ariaLabelledBy?: string | null;
  /** Id of an element that describes the dialog. */
  readonly ariaDescribedBy?: string | null;
  /** Data injected into a component through `DIALOG_DATA` from `@angular/cdk/dialog`. */
  readonly data?: D | null;
  /** Extra class names on the overlay pane. */
  readonly panelClass?: string | string[];
  /** Disables closing on Escape and backdrop click. */
  readonly disableClose?: boolean;
  /** Width of the panel (any CSS length). */
  readonly width?: string;
  /** Element to focus on open; defaults to the first tabbable element. */
  readonly autoFocus?: DialogConfig['autoFocus'];
}

/**
 * Opens modal dialogs on the CDK Dialog. The dialog traps Tab inside the panel,
 * closes on Escape and backdrop click, and returns focus to the previously
 * focused element when it closes.
 */
@Injectable({ providedIn: 'root' })
export class AuiDialogService {
  private readonly dialog = inject(Dialog);

  /** Opens `content` (a component class or a template) in a modal dialog. */
  open<R = unknown, D = unknown, C = unknown>(
    content: ComponentType<C> | TemplateRef<C>,
    config: AuiDialogConfig<D> = {},
  ): DialogRef<R, C> {
    return this.dialog.open<R, D, C>(content, {
      hasBackdrop: true,
      backdropClass: 'aui-dialog-backdrop',
      panelClass: ['aui-dialog-panel', ...[config.panelClass ?? []].flat()],
      restoreFocus: true,
      autoFocus: config.autoFocus ?? 'first-tabbable',
      role: 'dialog',
      ariaModal: true,
      ariaLabel: config.ariaLabel ?? null,
      ariaLabelledBy: config.ariaLabelledBy ?? null,
      ariaDescribedBy: config.ariaDescribedBy ?? null,
      data: config.data ?? null,
      disableClose: config.disableClose ?? false,
      width: config.width ?? '',
    });
  }
}

/**
 * Closes the dialog it is inside of when clicked. The bound value, if any, is
 * the dialog result.
 */
@Directive({
  selector: '[auiDialogClose]',
  standalone: true,
  host: { '(click)': 'close()' },
})
export class AuiDialogCloseDirective {
  private readonly ref = inject(DialogRef);

  /** Result handed to `afterClosed`. */
  readonly auiDialogClose = input<unknown>(undefined);

  protected close(): void {
    this.ref.close(this.auiDialogClose() || undefined);
  }
}
