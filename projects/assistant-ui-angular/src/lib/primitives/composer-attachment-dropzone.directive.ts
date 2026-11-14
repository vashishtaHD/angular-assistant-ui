// Ported from packages/react/src/primitives/composer/ComposerAttachmentDropzone.tsx @ 7d74276
import {
  DestroyRef,
  Directive,
  ElementRef,
  booleanAttribute,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';
import {
  injectAttachmentAdder,
  type AuiAttachmentError,
} from './attachment/inject-add-attachments';

const isFileDrag = (event: DragEvent): boolean =>
  event.dataTransfer?.types.includes('Files') === true;

/**
 * A drop target that adds dropped files to the composer. `data-dragging` is
 * present while a file drag hovers it. File drags are claimed with
 * `preventDefault` even when attachments are unsupported, because an
 * unprevented file drop would navigate the tab to the file. Listeners run in
 * the capture phase, so children cannot swallow the drag. Rejected files are
 * reported through `(attachmentError)`.
 *
 * @example
 * ```html
 * <div auiComposerAttachmentDropzone (attachmentError)="toast($event.message)">…</div>
 * ```
 */
@Directive({
  selector: '[auiComposerAttachmentDropzone]',
  standalone: true,
  host: { '[attr.data-dragging]': 'showDragging() ? "true" : null' },
})
export class AuiComposerAttachmentDropzoneDirective {
  private readonly aui = injectAui();
  private readonly threadDisabled = injectAuiState((s) => s.thread.isDisabled);

  /** Consumer-controlled disabled flag. */
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Emits when a dropped file is rejected or its upload fails. */
  readonly attachmentError = output<AuiAttachmentError>();

  private readonly adder = injectAttachmentAdder((error) => this.attachmentError.emit(error));
  private readonly dragging = signal(false);

  /** @internal */
  protected showDragging(): boolean {
    return this.dragging() && !this.isDisabled();
  }

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const on = (type: string, handler: (event: DragEvent) => void) => {
      const listener = handler as EventListener;
      el.addEventListener(type, listener, true);
      return () => el.removeEventListener(type, listener, true);
    };
    const offs = [
      on('dragenter', (e) => this.onDragEnterOrOver(e)),
      on('dragover', (e) => this.onDragEnterOrOver(e)),
      on('dragleave', (e) => this.onDragLeave(e, el)),
      on('drop', (e) => this.onDrop(e)),
    ];
    inject(DestroyRef).onDestroy(() => offs.forEach((off) => off()));
  }

  private isDisabled(): boolean {
    return this.disabled() || this.threadDisabled();
  }

  private canAttach(): boolean {
    return !this.isDisabled() && this.aui.thread.getState().capabilities.attachments;
  }

  private onDragEnterOrOver(event: DragEvent): void {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    if (!this.canAttach()) {
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
      return;
    }
    if (!this.dragging()) this.dragging.set(true);
  }

  private onDragLeave(event: DragEvent, el: HTMLElement): void {
    if (this.isDisabled()) return;
    event.preventDefault();
    const next = event.relatedTarget as Node | null;
    if (next && el.contains(next)) return;
    this.dragging.set(false);
  }

  private onDrop(event: DragEvent): void {
    this.dragging.set(false);
    if (!isFileDrag(event)) return;
    event.preventDefault();
    if (this.isDisabled()) return;
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (!this.aui.thread.getState().capabilities.attachments || files.length === 0) return;
    this.adder.add(files);
  }
}
