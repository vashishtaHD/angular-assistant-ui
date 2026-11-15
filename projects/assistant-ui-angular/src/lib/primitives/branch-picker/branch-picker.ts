// Ported from packages/react/src/primitives/branchPicker/*.tsx and
// packages/core/src/react/primitive-hooks/useBranchPicker{Previous,Next}.ts @ 7d74276
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  booleanAttribute,
  input,
} from '@angular/core';
import {
  branchPickerNextDisabled,
  branchPickerPreviousDisabled,
} from '@assistant-ui/core/store/internal';
import { injectAui } from '../../state/inject-aui';
import { injectAuiState } from '../../state/inject-aui-state';
import { AuiActionButtonHostDirective, injectActionButton } from '../action-button';

/**
 * The root of a branch picker inside a message scope. With
 * `hideWhenSingleBranch` it hides itself unless the message has two or more
 * branches, with the `hidden` attribute plus a host `display: none` style
 * binding, so class-based author CSS such as `.flex` cannot show it (it stays
 * in the DOM, where upstream unmounts it).
 */
@Directive({
  selector: '[auiBranchPickerRoot]',
  standalone: true,
  host: {
    '[attr.hidden]': 'hidden() ? "" : null',
    '[style.display]': 'hidden() ? "none" : null',
  },
})
export class AuiBranchPickerRootDirective {
  /** Hide while the message has fewer than two branches. */
  readonly hideWhenSingleBranch = input(false, { transform: booleanAttribute });

  private readonly branchCount = injectAuiState((s) => s.message.branchCount);
  /** @internal */
  protected readonly hidden = () => this.hideWhenSingleBranch() && this.branchCount() < 2;
}

/** A button that switches the message to its previous branch. */
@Directive({
  selector: 'button[auiBranchPickerPrevious]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
})
export class AuiBranchPickerPreviousDirective {
  /** Consumer-controlled disabled flag, combined with the store predicate. */
  readonly disabled = input(false, { transform: booleanAttribute });

  private readonly aui = injectAui();
  private readonly blocked = injectAuiState(branchPickerPreviousDisabled);

  constructor() {
    injectActionButton({
      disabled: () => this.disabled() || this.blocked(),
      onClick: () => this.aui.message.switchToBranch({ position: 'previous' }),
    });
  }
}

/** A button that switches the message to its next branch. */
@Directive({
  selector: 'button[auiBranchPickerNext]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
})
export class AuiBranchPickerNextDirective {
  /** Consumer-controlled disabled flag, combined with the store predicate. */
  readonly disabled = input(false, { transform: booleanAttribute });

  private readonly aui = injectAui();
  private readonly blocked = injectAuiState(branchPickerNextDisabled);

  constructor() {
    injectActionButton({
      disabled: () => this.disabled() || this.blocked(),
      onClick: () => this.aui.message.switchToBranch({ position: 'next' }),
    });
  }
}

/** Renders the 1-based number of the message's current branch. */
@Component({
  selector: 'aui-branch-picker-number',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `{{ branchNumber() }}`,
})
export class AuiBranchPickerNumberComponent {
  /** @internal */
  protected readonly branchNumber = injectAuiState((s) => s.message.branchNumber);
}

/** Renders how many branches the message has. */
@Component({
  selector: 'aui-branch-picker-count',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `{{ branchCount() }}`,
})
export class AuiBranchPickerCountComponent {
  /** @internal */
  protected readonly branchCount = injectAuiState((s) => s.message.branchCount);
}
