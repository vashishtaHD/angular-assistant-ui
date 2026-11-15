// Ported from packages/react/src/primitives/suggestion/SuggestionTitle.tsx @ 7d74276
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { injectAuiState } from '../../state/inject-aui-state';

/** Renders the current suggestion's title as text. */
@Component({
  selector: 'aui-suggestion-title',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ title() }}`,
})
export class AuiSuggestionTitleComponent {
  protected readonly title = injectAuiState((s) => s.suggestion.title);
}
