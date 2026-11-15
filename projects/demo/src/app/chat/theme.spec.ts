// Original specs for the demo's theme toggle (no upstream test exists).
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeToggleComponent } from './theme';

/** A controllable `(prefers-color-scheme: dark)` media query. */
const fakeDarkQuery = (initial: boolean) => {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const query = {
    matches: initial,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
      listeners.delete(listener),
  };
  const setDark = (dark: boolean) => {
    query.matches = dark;
    for (const listener of [...listeners]) {
      listener({ matches: dark, media: query.media } as MediaQueryListEvent);
    }
  };
  return { query, setDark, listeners };
};

const html = () => document.documentElement;
let fixture: ComponentFixture<ThemeToggleComponent> | undefined;
let os: ReturnType<typeof fakeDarkQuery>;

const mount = (osDark: boolean) => {
  os = fakeDarkQuery(osDark);
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => os.query),
  );
  TestBed.configureTestingModule({ imports: [ThemeToggleComponent] });
  fixture = TestBed.createComponent(ThemeToggleComponent);
  fixture.detectChanges();
  return fixture.nativeElement.querySelector('button') as HTMLButtonElement;
};

const pressed = (button: HTMLButtonElement) => {
  fixture!.detectChanges();
  return button.getAttribute('aria-pressed');
};

describe('ThemeToggleComponent', () => {
  beforeEach(() => {
    html().classList.remove('aui-dark', 'aui-light');
    try {
      localStorage.clear();
    } catch {
      // No storage in this environment.
    }
  });

  afterEach(() => {
    fixture?.destroy();
    fixture = undefined;
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    html().classList.remove('aui-dark', 'aui-light');
  });

  it('starts dark with .aui-dark when the OS prefers dark', () => {
    const button = mount(true);
    expect(html().classList.contains('aui-dark')).toBe(true);
    expect(html().classList.contains('aui-light')).toBe(false);
    expect(pressed(button)).toBe('true');
  });

  it('follows OS changes until the user chooses, then the first click switches the shown theme', () => {
    const button = mount(false);
    expect(html().classList.contains('aui-dark')).toBe(false);
    expect(pressed(button)).toBe('false');

    os.setDark(true);
    expect(html().classList.contains('aui-dark')).toBe(true);
    expect(pressed(button)).toBe('true');

    os.setDark(false);
    expect(html().classList.contains('aui-dark')).toBe(false);
    expect(pressed(button)).toBe('false');

    os.setDark(true);
    // The page is dark, so the click switches to light (and forces it).
    button.click();
    expect(html().classList.contains('aui-dark')).toBe(false);
    expect(html().classList.contains('aui-light')).toBe(true);
    expect(pressed(button)).toBe('false');

    // An explicit choice is not overridden by later OS changes.
    os.setDark(false);
    os.setDark(true);
    expect(html().classList.contains('aui-light')).toBe(true);
    expect(html().classList.contains('aui-dark')).toBe(false);
    expect(pressed(button)).toBe('false');
  });

  it('restores a stored choice over the OS preference', () => {
    localStorage.setItem('aui-demo-theme', 'dark');
    const button = mount(false);
    expect(html().classList.contains('aui-dark')).toBe(true);
    expect(pressed(button)).toBe('true');
  });

  it('stops listening to the OS when the app is destroyed', () => {
    mount(false);
    expect(os.listeners.size).toBe(1);
    fixture!.destroy();
    fixture = undefined;
    TestBed.resetTestingModule();
    expect(os.listeners.size).toBe(0);
  });
});
