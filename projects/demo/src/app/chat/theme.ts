import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
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

const prefersDark = (): boolean => {
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  } catch {
    return false;
  }
};

/**
 * The page theme. It forces the kit's `.aui-dark` or `.aui-light` class on `<html>` (so the
 * overlays the kit opens follow it too) once the user picks one; until then the OS decides.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;
  private readonly current = signal<Theme>(readStored() ?? (prefersDark() ? 'dark' : 'light'));
  /** Whether the page is dark. */
  readonly dark = computed(() => this.current() === 'dark');

  constructor() {
    const stored = readStored();
    if (stored) this.apply(stored);
  }

  /** Switches between light and dark and remembers the choice. */
  toggle(): void {
    const next: Theme = this.current() === 'dark' ? 'light' : 'dark';
    this.apply(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Without storage the choice lasts until the page reloads.
    }
  }

  private apply(theme: Theme): void {
    this.current.set(theme);
    this.root.classList.toggle('aui-dark', theme === 'dark');
    this.root.classList.toggle('aui-light', theme === 'light');
  }
}

/** A button that toggles dark mode. */
@Component({
  selector: 'app-theme-toggle',
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
  protected readonly theme = inject(ThemeService);
}
