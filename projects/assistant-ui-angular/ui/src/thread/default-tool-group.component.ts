// Ported from packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx (DefaultToolGroup) @ 7d74276
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { AuiGroupChildrenComponent, type AuiGroupPart } from 'angular-assistant-ui';
import { AuiToolGroupComponent } from '../tool-group.component';

/**
 * The default `ToolGroup` slot of `aui-thread`: a ghost `aui-tool-group`
 * around a run of consecutive tool calls. It is closed until the user opens
 * it, and stays open while a call in it requires action (a close is rejected).
 * @internal Part of `aui-thread`.
 */
@Component({
  selector: 'aui-thread-tool-group',
  standalone: true,
  imports: [AuiToolGroupComponent, AuiGroupChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents' },
  template: `<aui-tool-group
    variant="ghost"
    [count]="group().indices.length"
    [active]="group().status.type === 'running'"
    [open]="open()"
    (openChange)="onOpenChange($event)"
  >
    <aui-group-children [group]="group()" />
  </aui-tool-group>`,
})
export class AuiThreadToolGroupComponent {
  /** The `group-tool` group to render. */
  readonly group = input.required<AuiGroupPart>();
  private readonly toolGroup = viewChild.required(AuiToolGroupComponent);
  private readonly userOpen = signal(false);
  private readonly requiresAction = computed(() => this.group().counts.requiresAction > 0);
  /** @internal Upstream's `open || group.counts.requiresAction > 0`. */
  protected readonly open = computed(() => this.userOpen() || this.requiresAction());
  private restoring = false;

  /** @internal */
  protected onOpenChange(open: boolean): void {
    // Restoring the tool group's `open` below emits it back here; that is not the user's choice.
    if (this.restoring) return;
    this.userOpen.set(open);
    // Controlled open: a close while action is required does not take.
    if (open === this.open()) return;
    this.restoring = true;
    try {
      this.toolGroup().open.set(this.open());
    } finally {
      this.restoring = false;
    }
  }
}
