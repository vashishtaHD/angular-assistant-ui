// Ported from packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx (DefaultToolGroup) @ 7d74276
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  input,
  signal,
} from '@angular/core';
import { AuiGroupChildrenComponent, type AuiGroupPart } from 'angular-assistant-ui';
import { AuiToolGroupComponent } from '../tool-group.component';

/**
 * The default `ToolGroup` slot of `aui-thread`: a ghost `aui-tool-group`
 * around a run of consecutive tool calls. It is closed until the user opens
 * it, and stays open while a call in it requires action.
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
    (openChange)="userOpen.set($event)"
  >
    <aui-group-children [group]="group()" />
  </aui-tool-group>`,
})
export class AuiThreadToolGroupComponent {
  /** The `group-tool` group to render. */
  readonly group = input.required<AuiGroupPart>();
  /** @internal */
  protected readonly userOpen = signal(false);
  /** @internal */
  protected readonly open = computed(
    () => this.userOpen() || this.group().counts.requiresAction > 0,
  );
}
