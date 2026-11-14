// Ported from packages/react/src/primitives/suggestion/SuggestionDescription.tsx @ 7d74276
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { injectAuiState } from '../../state/inject-aui-state';

/** Renders the current suggestion's description (its label) as text. */
@Component({
  selector: 'aui-suggestion-description',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ label() }}`,
})
export class AuiSuggestionDescriptionComponent {
  protected readonly label = injectAuiState((s) => s.suggestion.label);
}
