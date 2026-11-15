// Ported from packages/ui/src/components/react/assistant-ui/elements/assistant-modal.aui.tsx
// and packages/ui/src/components/react/assistant-ui/utils/modal-size.ts @ 7d74276
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Overlay, type OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  TemplateRef,
  ViewContainerRef,
  ViewEncapsulation,
  booleanAttribute,
  computed,
  inject,
  input,
  model,
  signal,
  viewChild,
  type AfterViewInit,
  type OnChanges,
  type SimpleChanges,
} from '@angular/core';
import {
  AuiAssistantModalAnchorDirective,
  AuiAssistantModalContentDirective,
  AuiAssistantModalRootDirective,
  AuiAssistantModalTriggerDirective,
  AuiThreadListNewDirective,
  injectAuiEvent,
  injectAuiState,
} from 'angular-assistant-ui';
import { AuiButtonDirective } from './button.directive';
import { AuiIconComponent } from './icons/icon.component';
import { AuiThreadListComponent } from './thread-list/thread-list.component';
import { AuiThreadComponent } from './thread/thread.component';
import { AuiTooltipDirective } from './tooltip-icon-button.component';

let nextModalId = 0;

type ModalView = 'thread' | 'list';
interface ModalSize {
  readonly width: number;
  readonly height: number;
}
interface ResizeDrag {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly direction: 1 | -1;
  last: ModalSize | null;
}

const SIZE_STORAGE_KEY = 'aui-modal-size';
const MIN_SIZE: ModalSize = { width: 320, height: 400 };
// The launcher and its offsets sit below the modal, so the height leaves room for them.
const VIEWPORT_INSET: ModalSize = { width: 32, height: 96 };
const RESIZE_STEP = 16;

const clampSize = ({ width, height }: ModalSize): ModalSize => ({
  width: Math.round(
    Math.max(MIN_SIZE.width, Math.min(width, window.innerWidth - VIEWPORT_INSET.width)),
  ),
  height: Math.round(
    Math.max(MIN_SIZE.height, Math.min(height, window.innerHeight - VIEWPORT_INSET.height)),
  ),
});

const readStoredSize = (): ModalSize | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(SIZE_STORAGE_KEY) ?? 'null');
    if (typeof stored !== 'object' || stored === null) return null;
    const { width, height } = stored as Record<string, unknown>;
    if (typeof width !== 'number' || typeof height !== 'number') return null;
    return clampSize({ width, height });
  } catch {
    return null;
  }
};

const storeSize = (size: ModalSize | null): void => {
  try {
    if (size) window.localStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify(size));
    else window.localStorage.removeItem(SIZE_STORAGE_KEY);
  } catch {
    // Without storage the size lasts until the page reloads.
  }
};

const isRtl = (element: Element): boolean => getComputedStyle(element).direction === 'rtl';

/**
 * The floating assistant: a round launcher fixed to the bottom end corner
 * that opens a chat panel above it (a CDK overlay) holding `aui-thread`. The
 * panel is a dialog that traps Tab while open; Escape or the launcher close
 * it and focus returns to the launcher. Clicking the page leaves it open, as
 * upstream. The header shows the thread title, a Threads button that swaps
 * the thread for a searchable `aui-thread-list`, and a New Thread button. The
 * top start corner is a resize handle (drag, or arrow keys with Shift for
 * bigger steps; Enter, Space or a double click resets), and the size is
 * remembered in `localStorage`.
 *
 * It opens by itself when a run starts unless `openOnRunStart` is false.
 * `open` is two-way bindable. Use it inside an `[auiProvider]`.
 *
 * @example
 * ```html
 * <div [auiProvider]="config"><aui-assistant-modal /></div>
 * ```
 */
@Component({
  selector: 'aui-assistant-modal',
  standalone: true,
  imports: [
    CdkTrapFocus,
    AuiAssistantModalRootDirective,
    AuiAssistantModalAnchorDirective,
    AuiAssistantModalTriggerDirective,
    AuiAssistantModalContentDirective,
    AuiThreadListNewDirective,
    AuiThreadComponent,
    AuiThreadListComponent,
    AuiButtonDirective,
    AuiIconComponent,
    AuiTooltipDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-assistant-modal' },
  template: `<div
    auiAssistantModalRoot
    class="aui-modal-root"
    [open]="open()"
    [openOnRunStart]="openOnRunStart()"
    (openChange)="onOpenChange($event)"
  >
    <div auiAssistantModalAnchor #anchor class="aui-root aui-modal-anchor">
      <button
        auiAssistantModalTrigger
        auiButton
        variant="ghost"
        size="icon"
        class="aui-modal-button"
        [auiTooltip]="launcherLabel()"
        auiTooltipSide="left"
        [attr.aria-label]="launcherLabel()"
      >
        <aui-icon
          name="bot"
          class="aui-modal-button-closed-icon"
          [attr.data-open]="open() ? '' : null"
          [attr.data-closed]="open() ? null : ''"
        />
        <aui-icon
          name="chevron-down"
          class="aui-modal-button-open-icon"
          [attr.data-open]="open() ? '' : null"
          [attr.data-closed]="open() ? null : ''"
        />
      </button>
    </div>
    <ng-template #panel>
      <div
        #content
        auiAssistantModalContent
        cdkTrapFocus
        class="aui-root aui-modal-content"
        [attr.aria-labelledby]="titleId"
        [style.width.px]="size()?.width ?? null"
        [style.height.px]="size()?.height ?? null"
      >
        <button
          type="button"
          class="aui-modal-resize-handle"
          aria-label="Resize Assistant"
          (pointerdown)="onResizePointerDown($event)"
          (pointermove)="onResizePointerMove($event)"
          (pointerup)="onResizePointerUp($event)"
          (pointercancel)="onResizePointerCancel($event)"
          (keydown)="onResizeKeydown($event)"
          (dblclick)="resetSize()"
        ></button>
        <div class="aui-modal-header">
          <h2 #title class="aui-modal-title" tabindex="-1" [id]="titleId">{{ heading() }}</h2>
          <div class="aui-modal-actions">
            <button
              auiButton
              variant="ghost"
              size="icon"
              class="aui-modal-threads"
              auiTooltip="Threads"
              auiTooltipSide="bottom"
              aria-label="Threads"
              [attr.aria-pressed]="view() === 'list'"
              [disabled]="!hasThreads() && view() === 'thread'"
              (click)="setView(view() === 'list' ? 'thread' : 'list')"
            >
              <aui-icon name="history" />
            </button>
            <button
              auiButton
              variant="ghost"
              size="icon"
              auiThreadListNew
              class="aui-modal-new"
              auiTooltip="New Thread"
              auiTooltipSide="bottom"
              aria-label="New Thread"
              (click)="setView('thread')"
            >
              <aui-icon name="plus" />
            </button>
          </div>
        </div>
        <div class="aui-modal-body">
          <div class="aui-modal-thread" [attr.inert]="view() === 'list' ? '' : null">
            <aui-thread />
          </div>
          @if (view() === 'list') {
            <aui-thread-list
              class="aui-modal-thread-list"
              [showNew]="false"
              (threadSelect)="setView('thread')"
            />
          }
        </div>
      </div>
    </ng-template>
  </div>`,
})
export class AuiAssistantModalComponent implements OnChanges, AfterViewInit {
  /** Whether the panel is open. Two-way bindable. */
  readonly open = model(false);
  /** Open the panel when a run starts. */
  readonly openOnRunStart = input(true, { transform: booleanAttribute });

  /** @internal */
  protected readonly titleId = `aui-modal-title-${++nextModalId}`;
  /** @internal */
  protected readonly view = signal<ModalView>('thread');
  /** @internal */
  protected readonly size = signal<ModalSize | null>(readStoredSize());
  /** @internal */
  protected readonly hasThreads = injectAuiState((s) => s.threads.threadIds.length > 0);
  private readonly title = injectAuiState((s) => s.optional.threadListItem?.title);
  /** @internal */
  protected readonly heading = computed(() =>
    this.view() === 'list' ? 'Threads' : this.title() || 'New Chat',
  );
  /** @internal */
  protected readonly launcherLabel = computed(() =>
    this.open() ? 'Close Assistant' : 'Open Assistant',
  );

  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly anchor = viewChild.required<ElementRef<HTMLElement>>('anchor');
  private readonly panel = viewChild.required<TemplateRef<unknown>>('panel');
  private readonly content = viewChild<ElementRef<HTMLElement>>('content');
  private readonly titleElement = viewChild<ElementRef<HTMLElement>>('title');
  private overlayRef: OverlayRef | null = null;
  private drag: ResizeDrag | null = null;

  private viewReady = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.detach());
    // Like upstream, every run start brings the running chat into view, also when
    // the panel is already open on the thread list. (The headless root opens it.)
    injectAuiEvent('thread.runStart', () => {
      if (!this.openOnRunStart() || this.view() === 'thread') return;
      this.view.set('thread');
      this.cdr.markForCheck();
    });
  }

  /** @internal */
  ngOnChanges(changes: SimpleChanges): void {
    // Before the view exists the panel template is not available yet;
    // `ngAfterViewInit` handles an initially open modal.
    if (changes['open'] && this.viewReady) this.sync(this.open());
  }

  /** @internal Creates the panel of a modal that starts open. */
  ngAfterViewInit(): void {
    this.viewReady = true;
    if (this.open()) this.sync(true);
  }

  /** @internal Mirrors the root's open state (trigger, Escape, run start). */
  protected onOpenChange(open: boolean): void {
    this.open.set(open);
    this.sync(open);
  }

  /** @internal */
  protected setView(view: ModalView): void {
    if (this.view() === view) return;
    this.view.set(view);
    this.cdr.detectChanges();
    // Keep focus in the dialog when the view that held it unmounts.
    const heading = this.titleElement()?.nativeElement;
    const active = document.activeElement;
    if (active === document.body || active === this.content()?.nativeElement) heading?.focus();
  }

  /** @internal */
  protected resetSize(): void {
    this.drag = null;
    this.commitSize(null);
  }

  /** @internal */
  protected onResizePointerDown(event: PointerEvent): void {
    const content = this.content()?.nativeElement;
    if (event.button !== 0 || !content) return;
    const rect = content.getBoundingClientRect();
    this.drag = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      width: rect.width,
      height: rect.height,
      direction: isRtl(content) ? -1 : 1,
      last: null,
    };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  /** @internal */
  protected onResizePointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.last && event.clientX === drag.x && event.clientY === drag.y) return;
    drag.last = this.sizeFromPointer(drag, event);
    this.size.set(drag.last);
  }

  /** @internal */
  protected onResizePointerUp(event: PointerEvent): void {
    const drag = this.takeDrag(event);
    if (!drag) return;
    if (drag.last || event.clientX !== drag.x || event.clientY !== drag.y) {
      this.commitSize(this.sizeFromPointer(drag, event));
    }
  }

  /** @internal */
  protected onResizePointerCancel(event: PointerEvent): void {
    const drag = this.takeDrag(event);
    if (drag?.last) this.commitSize(drag.last);
  }

  /** @internal */
  protected onResizeKeydown(event: KeyboardEvent): void {
    const content = this.content()?.nativeElement;
    if (!content) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.resetSize();
      return;
    }
    const step = event.shiftKey ? RESIZE_STEP * 4 : RESIZE_STEP;
    const rtl = isRtl(content);
    const changes: Record<string, readonly [number, number]> = {
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
      [rtl ? 'ArrowRight' : 'ArrowLeft']: [step, 0],
      [rtl ? 'ArrowLeft' : 'ArrowRight']: [-step, 0],
    };
    const change = changes[event.key];
    if (!change) return;
    event.preventDefault();
    const rect = content.getBoundingClientRect();
    this.commitSize(clampSize({ width: rect.width + change[0], height: rect.height + change[1] }));
  }

  private sizeFromPointer(drag: ResizeDrag, event: PointerEvent): ModalSize {
    return clampSize({
      width: drag.width - (event.clientX - drag.x) * drag.direction,
      height: drag.height - (event.clientY - drag.y),
    });
  }

  private takeDrag(event: PointerEvent): ResizeDrag | null {
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) return null;
    this.drag = null;
    return drag;
  }

  private commitSize(next: ModalSize | null): void {
    this.size.set(next);
    storeSize(next);
  }

  private sync(open: boolean): void {
    if (open) this.attach();
    else this.detach();
  }

  private attach(): void {
    if (this.overlayRef) return;
    this.view.set('thread');
    const strategy = this.overlay
      .position()
      .flexibleConnectedTo(this.anchor())
      .withPositions([
        { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -16 },
      ])
      .withPush(false);
    const ref = this.overlay.create({
      positionStrategy: strategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      panelClass: 'aui-modal-pane',
    });
    this.overlayRef = ref;
    ref.attach(new TemplatePortal(this.panel(), this.viewContainerRef));
    this.cdr.markForCheck();
    ref.updatePosition();
  }

  private detach(): void {
    this.overlayRef?.dispose();
    this.overlayRef = null;
    this.drag = null;
    this.cdr.markForCheck();
  }
}
