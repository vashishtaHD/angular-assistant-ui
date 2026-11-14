/*
 * Public API Surface of angular-assistant-ui/ui.
 * The styled kit: components styled by one plain-CSS stylesheet
 * (`angular-assistant-ui/ui/styles.css`). Needs the optional `@angular/cdk` peer.
 */
export { AUI_ICON_NAMES, AUI_ICON_SHAPES } from './icons/icon-shapes';
export type { AuiIconName, AuiIconShape } from './icons/icon-shapes';
export { AuiIconComponent } from './icons/icon.component';

export { AuiButtonDirective } from './button.directive';
export type { AuiButtonSize, AuiButtonVariant } from './button.directive';

export {
  AuiTooltipIconButtonComponent,
  AuiTooltipPanelComponent,
} from './tooltip-icon-button.component';
export type { AuiTooltipSide } from './tooltip-icon-button.component';

export {
  AuiCollapsibleComponent,
  AuiCollapsibleContentComponent,
  AuiCollapsibleTriggerDirective,
} from './collapsible/collapsible';

export { AuiDialogCloseDirective, AuiDialogService } from './dialog/dialog';
export type { AuiDialogConfig } from './dialog/dialog';

export {
  AuiDropdownMenuContentDirective,
  AuiDropdownMenuItemDirective,
  AuiDropdownMenuLabelDirective,
  AuiDropdownMenuSeparatorDirective,
  AuiDropdownMenuTriggerDirective,
} from './dropdown-menu/dropdown-menu';
export type { AuiDropdownMenuAlign } from './dropdown-menu/dropdown-menu';
// Host directives of the dropdown menu. The Angular compiler requires them to be
// exported; do not use them directly. They are replaced when the menu moves to the
// main entry's headless menu (Ruling R10).
export { UiMenuContentDirective, UiMenuItemDirective } from './dropdown-menu/headless-menu';
