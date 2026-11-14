// Vendored from micromark-util-html-tag-name@2.0.1 (https://github.com/micromark/micromark),
// the dependency of packages/react-markdown/src/preprocess.ts @ 7d74276.
// Copyright (c) Titus Wormer <tituswormer@gmail.com>. MIT License; see NOTICE.

/**
 * List of lowercase HTML "block" tag names (CommonMark HTML block condition 6).
 * Copied from <https://spec.commonmark.org/0.30/#html-blocks>; `search` was
 * added in CommonMark 0.31.
 */
export const htmlBlockNames = [
  'address',
  'article',
  'aside',
  'base',
  'basefont',
  'blockquote',
  'body',
  'caption',
  'center',
  'col',
  'colgroup',
  'dd',
  'details',
  'dialog',
  'dir',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'frame',
  'frameset',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hr',
  'html',
  'iframe',
  'legend',
  'li',
  'link',
  'main',
  'menu',
  'menuitem',
  'nav',
  'noframes',
  'ol',
  'optgroup',
  'option',
  'p',
  'param',
  'search',
  'section',
  'summary',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'title',
  'tr',
  'track',
  'ul',
];

/**
 * List of lowercase HTML "raw" tag names (CommonMark HTML block condition 1).
 * `textarea` was added in CommonMark 0.30.
 */
export const htmlRawNames = ['pre', 'script', 'style', 'textarea'];
