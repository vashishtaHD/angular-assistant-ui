// Original angular-assistant-ui demo code (no upstream counterpart; no code copied).
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './chat/theme';

/** The demo shell: renders the routed page (the chat app at `/`, the modal page at `/modal`). */
@Component({
  selector: 'aui-demo-root',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
  template: `<router-outlet />`,
})
export class AppComponent {
  constructor() {
    // Applies the theme (and starts following the OS) before the first page renders.
    inject(ThemeService);
  }
}
