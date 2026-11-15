// Original angular-assistant-ui demo code (no upstream counterpart; no code copied).
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';

const STORAGE_KEY = 'aui-demo-theme';

type Theme = 'light' | 'dark';

const readStored = (): Theme | null => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
};

const DARK_QUERY = '(prefers-color-scheme: dark)';

const darkQuery = (): MediaQueryList | null => {
  try {
    return typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null;
  } catch {
    return null;
  }
};

/**
 * The page theme, reflected on `<html>` so the kit, the overlays it opens and the demo's own
 * `dark:` styles all follow it.
 *
 * Until the user picks a theme it follows the OS, including later OS changes: dark sets the
 * kit's `.aui-dark` class (which the demo's Tailwind `dark:` variants key off), light sets no
 * class (the kit is light then). Once the user toggles, the choice is stored and forced with
 * `.aui-dark` or `.aui-light`, and OS changes no longer apply.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;
  private readonly query = darkQuery();
  private readonly chosen = signal<Theme | null>(readStored());
  private readonly system = signal<Theme>(this.query?.matches ? 'dark' : 'light');
  private readonly current = computed<Theme>(() => this.chosen() ?? this.system());
  /** Whether the page is dark. */
  readonly dark = computed(() => this.current() === 'dark');

  constructor() {
    const onChange = (event: MediaQueryListEvent) => {
      this.system.set(event.matches ? 'dark' : 'light');
      this.apply();
    };
    this.query?.addEventListener?.('change', onChange);
    inject(DestroyRef).onDestroy(() => this.query?.removeEventListener?.('change', onChange));
    this.apply();
  }

  /** Switches between light and dark and remembers the choice. */
  toggle(): void {
    const next: Theme = this.current() === 'dark' ? 'light' : 'dark';
    this.chosen.set(next);
    this.apply();
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Without storage the choice lasts until the page reloads.
    }
  }

  private apply(): void {
    this.root.classList.toggle('aui-dark', this.current() === 'dark');
    // Light is forced only by an explicit choice; an OS-light page needs no class.
    this.root.classList.toggle('aui-light', this.chosen() === 'light');
  }
}

/** A button that toggles dark mode. */
@Component({
  selector: 'aui-demo-theme-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button
    type="button"
    aria-label="Dark mode"
    title="Dark mode"
    [attr.aria-pressed]="theme.dark()"
    class="inline-flex size-9 items-center justify-center rounded-md transition hover:bg-[var(--aui-accent)]"
    (click)="theme.toggle()"
  >
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @if (theme.dark()) {
        <circle cx="12" cy="12" r="4" />
        <path
          d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
        />
      } @else {
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      }
    </svg>
  </button>`,
})
export class ThemeToggleComponent {
  /** The page theme the button toggles. */
  protected readonly theme = inject(ThemeService);
}
