// Ported from packages/ui/src/components/vue/assistant-ui/{reasoning,tool-fallback}.vue (minimal defaults) @ 7d74276
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { injectAuiState } from 'angular-assistant-ui';
import { AuiIconComponent } from '../icons/icon.component';

/**
 * The default `ToolFallback` slot of `aui-thread`: the tool name and its
 * status. The styled tool fallback (args, result, approval) replaces it
 * through `AUI_THREAD_COMPONENTS`.
 * @internal Part of `aui-thread`.
 */
@Component({
  selector: 'aui-thread-tool-call',
  standalone: true,
  imports: [AuiIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-thread-tool-call', '[attr.data-status]': 'status()' },
  template: `<aui-icon name="wrench" />
    <span
      >Used tool: <strong class="aui-thread-tool-call-name">{{ toolName() }}</strong></span
    >`,
})
export class AuiThreadToolCallComponent {
  /** @internal */
  protected readonly toolName = injectAuiState((s) =>
    s.part.type === 'tool-call' ? s.part.toolName : '',
  );
  /** @internal */
  protected readonly status = injectAuiState((s) => s.part.status?.type ?? null);
}

/**
 * The default `Reasoning` slot of `aui-thread`: the reasoning text in muted
 * type. The styled collapsible reasoning replaces it through
 * `AUI_THREAD_COMPONENTS`.
 * @internal Part of `aui-thread`.
 */
@Component({
  selector: 'aui-thread-reasoning-text',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-thread-reasoning-text' },
  template: `{{ text() }}`,
})
export class AuiThreadReasoningTextComponent {
  /** @internal */
  protected readonly text = injectAuiState((s) => (s.part.type === 'reasoning' ? s.part.text : ''));
}
