# Styling the kit

`angular-assistant-ui/ui` is styled by one plain-CSS stylesheet, `angular-assistant-ui/ui/styles.css`.
It has no build step, no Tailwind dependency and no `@layer`. Components render with
`ViewEncapsulation.None` and hang off stable `aui-*` classes, `data-slot` attributes and `data-*` state
attributes, so you theme the kit with CSS custom properties and override it with ordinary selectors.

## Loading the stylesheet

Load it once per app, either in `angular.json`:

```json
"styles": ["node_modules/angular-assistant-ui/ui/styles.css", "src/styles.css"]
```

or from your global stylesheet:

```css
@import 'angular-assistant-ui/ui/styles.css';
```

The compat apps (`compat/ng*/src/styles.css`) use the `@import`, and their smoke test checks that
`--aui-background` resolves on `:root`. The headless main entry (`angular-assistant-ui`) ships no CSS.

## Tokens

The theme tokens are on `:root`. Override any of them on `:root` or on an ancestor of the kit; every
component reads them through `var()`.

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| `--aui-background` | `#ffffff` | `#09090b` | Surfaces (thread, panels, menus, tooltips) |
| `--aui-foreground` | `#0a0a0a` | `#fafafa` | Body text |
| `--aui-muted` | `#f4f4f5` | `#27272a` | User bubbles, code blocks, skeletons |
| `--aui-muted-foreground` | `#71717a` | `#a1a1aa` | Secondary text, icons, placeholders |
| `--aui-border` | `#e4e4e7` | `#3f3f46` | Borders and dividers |
| `--aui-accent` | `#f4f4f5` | `#27272a` | Hover and active backgrounds |
| `--aui-accent-foreground` | `#18181b` | `#fafafa` | Text on accent |
| `--aui-primary` | `#18181b` | `#fafafa` | Primary buttons (send, approve) |
| `--aui-primary-foreground` | `#fafafa` | `#18181b` | Text on primary |
| `--aui-destructive` | `#dc2626` | `#f87171` | Errors, deny and delete actions |
| `--aui-ring` | `#a1a1aa` | `#71717a` | Focus rings |
| `--aui-shadow` | soft | stronger | Popovers, modal, menus |
| `--aui-radius` | `0.5rem` | | Base corner radius |
| `--aui-font-sans` | system UI stack | | Text |
| `--aui-font-mono` | system monospace stack | | Code |
| `--aui-space-1` … `--aui-space-8` | `0.25rem` … `4rem` | | Spacing scale |

Component-scoped tokens, set on the component root so you can override them per instance:

| Token | Default | Set on |
| --- | --- | --- |
| `--aui-thread-max-width` | `44rem` | `.aui-thread-root` (message column and composer width) |
| `--aui-composer-bg` | `--aui-muted` at 30% | `.aui-thread-root` |
| `--aui-composer-radius` | `1rem` | `.aui-thread-root` (composer, user bubble, edit composer) |
| `--aui-composer-padding` | `8px` | `.aui-thread-root` |
| `--aui-sidebar-width` | `16rem` | `.aui-thread-list-sidebar` |
| `--aui-icon-size` | `1em` | `.aui-icon` (sized per context, for example `1rem` in tool rows) |

```css
:root {
  --aui-primary: #4f46e5;
  --aui-primary-foreground: #ffffff;
  --aui-radius: 0.75rem;
}

.support-widget .aui-thread-root {
  --aui-thread-max-width: 100%;
}
```

## Dark mode

- **Follow the OS (default).** Under `prefers-color-scheme: dark`, `:root` switches to the dark values.
- **Force dark.** Add `.aui-dark` to `<html>` or to any ancestor of the kit. It sets the dark values on
  that element, so a single panel can be dark in a light page.
- **Force light.** Add `.aui-light` to `<html>`; it stops the OS dark mode from applying to `:root`.

```ts
document.documentElement.classList.toggle('aui-dark', dark);
document.documentElement.classList.toggle('aui-light', !dark);
```

Kit roots (`.aui-root`) set `color-scheme: light dark`, and `.aui-light` / `.aui-dark` pin it to one
scheme. That matters for `angular-assistant-ui/shiki`: its highlighted code uses `light-dark()` colours,
which follow `color-scheme`. When you override the dark palette, override it in all three places you use
(`.aui-dark`, and `:root:not(.aui-light)` inside `@media (prefers-color-scheme: dark)` if you keep OS
following).

## Overriding classes

The selectors are flat (one or two classes), so a rule of equal specificity loaded after the kit wins,
and a more specific one wins regardless of order. Prefer the stable hooks:

- `aui-*` classes, one per part, for example `.aui-composer-root`, `.aui-user-message-root`,
  `.aui-tool-fallback-root`, `.aui-thread-list-item`, `.aui-md` (markdown body).
- `data-slot` attributes named after upstream's slots, for example
  `[data-slot="aui_user-message-root"]` or `[data-slot="aui_tool-fallback-approval-receipt"]`.
- State attributes: `data-role` (`user` / `assistant`) and `data-message-id` on messages, `data-active` and
  `aria-current` on the active thread list item, `data-status`, `data-running` and `data-cancelled` on
  the tool fallback, `data-outcome` on an approval receipt, `data-empty` on an empty thread.

```css
.aui-user-message-content {
  background: var(--aui-primary);
  color: var(--aui-primary-foreground);
}

.aui-thread-list-item[data-active] {
  font-weight: 600;
}
```

To replace a whole section rather than restyle it, provide `AUI_THREAD_COMPONENTS` (keys `UserMessage`,
`AssistantMessage`, `EditComposer`, `Composer`, `Welcome`, `ToolFallback`, `Text`, `Reasoning`,
`ToolGroup`, `ReasoningGroup`, `UserMessageAttachments`, `ComposerAttachments`,
`ComposerAddAttachment`, and the optional `TaskGroup` and `ComposerExtra`, which have no default). The
kit's internals are not public API; class names and slots are.

Overlays (tooltips, menus, dialogs, the assistant modal and the timing popover) render in the CDK overlay
container at the end of `<body>`, outside your component tree. They read the tokens from `:root`, so a
theme scoped to a subtree with `.aui-dark` does not reach them; set app-wide themes on `<html>`.

## Tailwind

Upstream's React and Vue kits are Tailwind (shadcn) components. Here every Tailwind class became an
`aui-*` rule in `styles.css`, and shadcn's theme variables became `--aui-*` tokens:

| shadcn variable / utility | Kit token |
| --- | --- |
| `--background` / `bg-background` | `--aui-background` |
| `--foreground` / `text-foreground` | `--aui-foreground` |
| `--muted` / `bg-muted` | `--aui-muted` |
| `--muted-foreground` / `text-muted-foreground` | `--aui-muted-foreground` |
| `--border` / `border-border` | `--aui-border` |
| `--accent` / `bg-accent` | `--aui-accent` |
| `--accent-foreground` | `--aui-accent-foreground` |
| `--primary` / `bg-primary` | `--aui-primary` |
| `--primary-foreground` | `--aui-primary-foreground` |
| `--destructive` / `text-destructive` | `--aui-destructive` |
| `--ring` / `ring-ring` | `--aui-ring` |
| `--radius` / `rounded-lg` | `--aui-radius` |
| `p-1` … `p-16` spacing | `--aui-space-1` … `--aui-space-8` |

**Drive the kit from an existing shadcn theme** by pointing the tokens at your variables (shadcn v3
stores bare HSL channels; v4 stores full colours, so drop the `hsl()` there):

```css
:root,
.dark {
  --aui-background: hsl(var(--background));
  --aui-foreground: hsl(var(--foreground));
  --aui-muted: hsl(var(--muted));
  --aui-muted-foreground: hsl(var(--muted-foreground));
  --aui-border: hsl(var(--border));
  --aui-accent: hsl(var(--accent));
  --aui-accent-foreground: hsl(var(--accent-foreground));
  --aui-primary: hsl(var(--primary));
  --aui-primary-foreground: hsl(var(--primary-foreground));
  --aui-destructive: hsl(var(--destructive));
  --aui-ring: hsl(var(--ring));
  --aui-radius: var(--radius);
}
```

If your app toggles shadcn's `.dark` class, toggle `.aui-dark` (or `.aui-light`) with it, since the kit
otherwise follows the OS.

**Use the tokens in Tailwind utilities** (Tailwind v3):

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'aui-bg': 'var(--aui-background)',
        'aui-fg': 'var(--aui-foreground)',
        'aui-muted': 'var(--aui-muted)',
        'aui-primary': 'var(--aui-primary)',
      },
      borderRadius: { aui: 'var(--aui-radius)' },
    },
  },
};
```

**Cascade layers (Tailwind v4).** Tailwind v4 puts utilities in `@layer utilities`, and unlayered CSS
beats every layer, so the kit's rules would win over utilities you put on your own wrappers or slot
components. Import the kit into a layer below utilities:

```css
@import 'tailwindcss';
@import 'angular-assistant-ui/ui/styles.css' layer(components);
```

With Tailwind v3 (no layers in the output), load the kit before your Tailwind build so utilities of equal
specificity come later and win.
