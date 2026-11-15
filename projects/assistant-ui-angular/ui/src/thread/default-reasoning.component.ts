// Ported from packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx
// (the group-reasoning branch of AssistantMessage) and
// packages/ui/src/components/react/assistant-ui/elements/reasoning.aui.tsx (Reasoning) @ 7d74276
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  input,
} from '@angular/core';
import { AuiGroupChildrenComponent, type AuiGroupPart } from 'angular-assistant-ui';
import { AuiMarkdownTextComponent } from 'angular-assistant-ui/markdown';
import { AuiReasoningGroupComponent } from '../reasoning.component';

/**
 * The default `ReasoningGroup` slot of `aui-thread`: an `aui-reasoning-group`
 * around a run of consecutive reasoning parts, streaming while the group runs
 * and labelled with the group's duration.
 * @internal Part of `aui-thread`.
 */
@Component({
  selector: 'aui-thread-reasoning-group',
  standalone: true,
  imports: [AuiReasoningGroupComponent, AuiGroupChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents' },
  template: `<aui-reasoning-group [streaming]="streaming()" [durationMs]="durationMs()">
    <aui-group-children [group]="group()" />
  </aui-reasoning-group>`,
})
export class AuiThreadReasoningGroupComponent {
  /** The `group-reasoning` group to render. */
  readonly group = input.required<AuiGroupPart>();
  /** @internal */
  protected readonly streaming = computed(() => this.group().status.type === 'running');
  /** @internal Upstream's `reasoningDuration(part.timing)`. */
  protected readonly durationMs = computed(() => {
    const timing = this.group().timing;
    return timing?.completedAt === undefined
      ? undefined
      : Math.max(0, timing.completedAt - timing.startedAt);
  });
}

/**
 * The default `Reasoning` slot of `aui-thread`: one reasoning part as
 * markdown, as `aui-reasoning` renders each part of its run.
 * @internal Part of `aui-thread`.
 */
@Component({
  selector: 'aui-thread-reasoning-part',
  standalone: true,
  imports: [AuiMarkdownTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-reasoning-part' },
  template: `<aui-markdown-text />`,
})
export class AuiThreadReasoningPartComponent {}
