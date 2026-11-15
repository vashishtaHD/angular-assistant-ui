import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  NgZone,
  inject,
  signal,
} from '@angular/core';

/** One toast message. */
export interface Toast {
  id: number;
  text: string;
}

/** Shows short messages in the corner of the page. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly zone = inject(NgZone);
  private nextId = 0;
  private readonly list = signal<readonly Toast[]>([]);
  /** The toasts on screen, oldest first. */
  readonly toasts = this.list.asReadonly();

  /** Shows `text` for `durationMs`. */
  show(text: string, durationMs = 3000): void {
    const toast: Toast = { id: ++this.nextId, text };
    this.list.update((list) => [...list, toast]);
    // Outside the zone, so a toast on screen does not keep the app from becoming stable.
    this.zone.runOutsideAngular(() => setTimeout(() => this.dismiss(toast.id), durationMs));
  }

  /** Removes a toast. */
  dismiss(id: number): void {
    this.list.update((list) => list.filter((t) => t.id !== id));
  }
}

/** Renders the toasts of {@link ToastService}. */
@Component({
  selector: 'app-toasts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'pointer-events-none fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2',
  },
  template: `@for (toast of toasts.toasts(); track toast.id) {
    <div
      role="status"
      data-toast
      class="pointer-events-auto rounded-lg border px-4 py-2 text-sm shadow-lg"
      style="
        background: var(--aui-background);
        color: var(--aui-foreground);
        border-color: var(--aui-border);
      "
    >
      {{ toast.text }}
    </div>
  }`,
})
export class ToastsComponent {
  protected readonly toasts = inject(ToastService);
}
