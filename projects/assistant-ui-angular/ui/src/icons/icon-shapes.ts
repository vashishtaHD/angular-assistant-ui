// Icon geometry copied from lucide (ISC License, https://lucide.dev); see NOTICE.

/** One SVG shape of an icon, in lucide's 24x24 stroke coordinate space. */
export type AuiIconShape =
  | { readonly t: 'path'; readonly d: string }
  | { readonly t: 'circle'; readonly cx: string; readonly cy: string; readonly r: string }
  | {
      readonly t: 'rect';
      readonly x: string;
      readonly y: string;
      readonly width: string;
      readonly height: string;
      readonly rx: string;
    }
  | {
      readonly t: 'line';
      readonly x1: string;
      readonly y1: string;
      readonly x2: string;
      readonly y2: string;
    };

/** Shapes of every icon the styled kit uses, keyed by icon name. */
export const AUI_ICON_SHAPES = {
  copy: [
    { t: 'rect', x: '8', y: '8', width: '14', height: '14', rx: '2' },
    { t: 'path', d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' },
  ],
  check: [{ t: 'path', d: 'M20 6 9 17l-5-5' }],
  'refresh-cw': [
    { t: 'path', d: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' },
    { t: 'path', d: 'M21 3v5h-5' },
    { t: 'path', d: 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' },
    { t: 'path', d: 'M8 16H3v5' },
  ],
  pencil: [
    {
      t: 'path',
      d: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z',
    },
    { t: 'path', d: 'm15 5 4 4' },
  ],
  'chevron-left': [{ t: 'path', d: 'm15 18-6-6 6-6' }],
  'chevron-right': [{ t: 'path', d: 'm9 18 6-6-6-6' }],
  'arrow-down': [
    { t: 'path', d: 'M12 5v14' },
    { t: 'path', d: 'm19 12-7 7-7-7' },
  ],
  'arrow-up': [
    { t: 'path', d: 'm5 12 7-7 7 7' },
    { t: 'path', d: 'M12 19V5' },
  ],
  square: [{ t: 'rect', x: '3', y: '3', width: '18', height: '18', rx: '2' }],
  paperclip: [
    {
      t: 'path',
      d: 'm16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551',
    },
  ],
  x: [
    { t: 'path', d: 'M18 6 6 18' },
    { t: 'path', d: 'm6 6 12 12' },
  ],
  file: [
    {
      t: 'path',
      d: 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z',
    },
    { t: 'path', d: 'M14 2v5a1 1 0 0 0 1 1h5' },
  ],
  'thumbs-up': [
    {
      t: 'path',
      d: 'M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z',
    },
    { t: 'path', d: 'M7 10v12' },
  ],
  'thumbs-down': [
    {
      t: 'path',
      d: 'M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z',
    },
    { t: 'path', d: 'M17 14V2' },
  ],
  'more-horizontal': [
    { t: 'circle', cx: '12', cy: '12', r: '1' },
    { t: 'circle', cx: '19', cy: '12', r: '1' },
    { t: 'circle', cx: '5', cy: '12', r: '1' },
  ],
  archive: [
    { t: 'rect', x: '2', y: '3', width: '20', height: '5', rx: '1' },
    { t: 'path', d: 'M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8' },
    { t: 'path', d: 'M10 12h4' },
  ],
  trash: [
    { t: 'path', d: 'M10 11v6' },
    { t: 'path', d: 'M14 11v6' },
    { t: 'path', d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' },
    { t: 'path', d: 'M3 6h18' },
    { t: 'path', d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' },
  ],
  plus: [
    { t: 'path', d: 'M5 12h14' },
    { t: 'path', d: 'M12 5v14' },
  ],
  'chevron-down': [{ t: 'path', d: 'm6 9 6 6 6-6' }],
  brain: [
    { t: 'path', d: 'M12 18V5' },
    { t: 'path', d: 'M15 13a4.17 4.17 0 01-3-4 4.17 4.17 0 01-3 4' },
    { t: 'path', d: 'M17.707 6.294A3 3 0 1012 5a3 3 0 10-5.707 1.294' },
    { t: 'path', d: 'M17.996 5.125a4 4 0 012.526 5.77' },
    { t: 'path', d: 'M18 18a4 4 0 002-7.465' },
    { t: 'path', d: 'M19.967 17.482a4 4 0 11-7.967.517 4 4 0 11-7.967-.517' },
    { t: 'path', d: 'M6 18a4 4 0 01-2-7.465' },
    { t: 'path', d: 'M6.004 5.125a4 4 0 00-2.526 5.77' },
  ],
  wrench: [
    {
      t: 'path',
      d: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z',
    },
  ],
  loader: [
    { t: 'path', d: 'M12 2v4' },
    { t: 'path', d: 'm16.2 7.8 2.9-2.9' },
    { t: 'path', d: 'M18 12h4' },
    { t: 'path', d: 'm16.2 16.2 2.9 2.9' },
    { t: 'path', d: 'M12 18v4' },
    { t: 'path', d: 'm4.9 19.1 2.9-2.9' },
    { t: 'path', d: 'M2 12h4' },
    { t: 'path', d: 'm4.9 4.9 2.9 2.9' },
  ],
  'alert-circle': [
    { t: 'circle', cx: '12', cy: '12', r: '10' },
    { t: 'line', x1: '12', y1: '8', x2: '12', y2: '12' },
    { t: 'line', x1: '12', y1: '16', x2: '12.01', y2: '16' },
  ],
  // Task 18: thread list, sidebar, modal, quote, trigger popover.
  search: [
    { t: 'path', d: 'm21 21-4.34-4.34' },
    { t: 'circle', cx: '11', cy: '11', r: '8' },
  ],
  quote: [
    {
      t: 'path',
      d: 'M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z',
    },
    {
      t: 'path',
      d: 'M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z',
    },
  ],
  history: [
    { t: 'path', d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' },
    { t: 'path', d: 'M3 3v5h5' },
    { t: 'path', d: 'M12 7v5l4 2' },
  ],
  bot: [
    { t: 'path', d: 'M12 8V4H8' },
    { t: 'rect', x: '4', y: '8', width: '16', height: '12', rx: '2' },
    { t: 'path', d: 'M2 14h2' },
    { t: 'path', d: 'M20 14h2' },
    { t: 'path', d: 'M15 13v2' },
    { t: 'path', d: 'M9 13v2' },
  ],
  sparkles: [
    {
      t: 'path',
      d: 'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z',
    },
    { t: 'path', d: 'M20 3v4' },
    { t: 'path', d: 'M22 5h-4' },
    { t: 'path', d: 'M4 17v2' },
    { t: 'path', d: 'M5 18H3' },
  ],
  'panel-left': [
    { t: 'rect', x: '3', y: '3', width: '18', height: '18', rx: '2' },
    { t: 'path', d: 'M9 3v18' },
  ],
  // end Task 18
} as const satisfies Record<string, readonly AuiIconShape[]>;

/** Names accepted by `<aui-icon name>`. */
export type AuiIconName = keyof typeof AUI_ICON_SHAPES;

/** All icon names, in declaration order. */
export const AUI_ICON_NAMES = Object.keys(AUI_ICON_SHAPES) as AuiIconName[];
