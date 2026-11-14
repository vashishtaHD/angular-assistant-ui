// Ported from packages/react/src/primitives/threadListItem/ThreadListItem{Archive,Unarchive,Delete}.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { Directive, booleanAttribute, input } from '@angular/core';
import { threadListItemUnarchiveDisabled } from '@assistant-ui/core/store/internal';
import { injectAui } from '../../state/inject-aui';
import { injectAuiState } from '../../state/inject-aui-state';
import { AuiActionButtonHostDirective, injectActionButton } from '../action-button';

/** A button that archives the current thread list item. */
@Directive({
  selector: 'button[auiThreadListItemArchive]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
})
export class AuiThreadListItemArchiveDirective {
  private readonly aui = injectAui();

  /** Consumer-controlled disabled flag. */
  readonly disabled = input(false, { transform: booleanAttribute });

  constructor() {
    injectActionButton({
      disabled: () => this.disabled(),
      onClick: () => this.aui.threadListItem.archive(),
    });
  }
}

/**
 * A button that unarchives the current thread list item. Disabled while the
 * runtime has no unarchive support; `disabled=false` cannot override that.
 */
@Directive({
  selector: 'button[auiThreadListItemUnarchive]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
})
export class AuiThreadListItemUnarchiveDirective {
  private readonly aui = injectAui();
  private readonly blocked = injectAuiState(threadListItemUnarchiveDisabled);

  /** Consumer-controlled disabled flag, combined with the store predicate. */
  readonly disabled = input(false, { transform: booleanAttribute });

  constructor() {
    injectActionButton({
      disabled: () => this.disabled() || this.blocked(),
      onClick: () => this.aui.threadListItem.unarchive(),
    });
  }
}

/** A button that deletes the current thread list item. */
@Directive({
  selector: 'button[auiThreadListItemDelete]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
})
export class AuiThreadListItemDeleteDirective {
  private readonly aui = injectAui();

  /** Consumer-controlled disabled flag. */
  readonly disabled = input(false, { transform: booleanAttribute });

  constructor() {
    injectActionButton({
      disabled: () => this.disabled(),
      onClick: () => this.aui.threadListItem.delete(),
    });
  }
}
