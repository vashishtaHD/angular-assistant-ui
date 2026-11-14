// Ported from packages/markdown/src/vue/Markdown.test.ts @ 7d74276
import { ChangeDetectionStrategy, Component, input, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { AuiConfig } from '@assistant-ui/store/client';
import { flushTapSync } from '@assistant-ui/tap';
import {
  AuiMessagePartsComponent,
  AuiMessageTemplateDirective,
  AuiPartTemplateDirective,
  AuiProviderDirective,
  AuiThreadMessagesComponent,
} from 'angular-assistant-ui';
import {
  AUI_SYNTAX_HIGHLIGHTER,
  AuiMarkdownNodesComponent,
  AuiMarkdownTextComponent,
  normalizeMathDelimiters,
  type AuiMarkdownComponents,
  type AuiMarkdownComponentsByLanguage,
  type AuiSyntaxHighlighter,
  type HeadingNode,
  type InlineNode,
  type LinkNode,
} from 'angular-assistant-ui/markdown';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../src/testing-internal/test-bed';
import { createTestRuntime, type TestRuntime } from '../../src/testing-internal/test-runtime';

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await Promise.resolve();
  }
};

/** The rendered markup without Angular's comment anchors and dev-mode reflection attributes. */
const markup = (element: Element): string => {
  const clone = element.cloneNode(true) as Element;
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.COMMENT_NODE) {
        child.remove();
        continue;
      }
      if (child instanceof Element) {
        for (const name of child.getAttributeNames()) {
          if (name.startsWith('ng-reflect-') || name.startsWith('_ng')) child.removeAttribute(name);
        }
      }
      walk(child);
    }
  };
  walk(clone);
  return clone.innerHTML;
};

let hostConfig: AuiConfig;

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessagePartsComponent,
    AuiPartTemplateDirective,
    AuiMarkdownTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <aui-thread-messages>
        <ng-template auiMessage>
          <aui-message-parts>
            <ng-template auiPart="text">
              <aui-markdown-text
                [smooth]="smooth()"
                [preprocess]="preprocess()"
                [components]="components()"
                [componentsByLanguage]="componentsByLanguage()"
              />
            </ng-template>
          </aui-message-parts>
        </ng-template>
      </aui-thread-messages>
    </ng-container>
  `,
})
class HostComponent {
  readonly config = hostConfig;
  readonly smooth = input<boolean>(false);
  readonly preprocess = input<((text: string) => string) | undefined>(undefined);
  readonly components = input<Partial<AuiMarkdownComponents>>({});
  readonly componentsByLanguage = input<AuiMarkdownComponentsByLanguage>({});
}

interface MountOptions {
  text: string;
  running?: boolean;
  smooth?: boolean;
  preprocess?: (text: string) => string;
  components?: Partial<AuiMarkdownComponents>;
  componentsByLanguage?: AuiMarkdownComponentsByLanguage;
  highlighter?: AuiSyntaxHighlighter;
}

const ASSISTANT_ID = 'assistant-1';

const mount = async (opts: MountOptions) => {
  TestBed.resetTestingModule();
  const rt: TestRuntime = createTestRuntime();
  rt.append({ id: 'user-1', role: 'user', content: [{ type: 'text', text: 'q' }] });
  rt.append({ id: ASSISTANT_ID, role: 'assistant', content: [{ type: 'text', text: opts.text }] });
  if (opts.running) rt.setRunning(true);
  hostConfig = rt.config;
  configureTestBed({
    imports: [HostComponent],
    providers: opts.highlighter
      ? [{ provide: AUI_SYNTAX_HIGHLIGHTER, useValue: opts.highlighter }]
      : [],
  });
  const fixture = TestBed.createComponent(HostComponent);
  if (opts.smooth !== undefined) fixture.componentRef.setInput('smooth', opts.smooth);
  if (opts.preprocess) fixture.componentRef.setInput('preprocess', opts.preprocess);
  if (opts.components) fixture.componentRef.setInput('components', opts.components);
  if (opts.componentsByLanguage) {
    fixture.componentRef.setInput('componentsByLanguage', opts.componentsByLanguage);
  }
  fixture.detectChanges();
  await settle(fixture);
  const el = fixture.nativeElement as HTMLElement;
  const host = () => el.querySelectorAll<HTMLElement>('aui-markdown-text')[1]!;
  const stream = async (text: string) => {
    flushTapSync(() =>
      rt.setMessages([
        { id: 'user-1', role: 'user', content: [{ type: 'text', text: 'q' }] },
        { id: ASSISTANT_ID, role: 'assistant', content: [{ type: 'text', text }] },
      ]),
    );
    await settle(fixture);
  };
  const finish = async () => {
    flushTapSync(() => rt.setRunning(false));
    await settle(fixture);
  };
  return { fixture, rt, host, html: () => markup(host()), stream, finish };
};

const html = async (text: string, opts: Omit<MountOptions, 'text'> = {}) =>
  (await mount({ text, ...opts })).html();

const OPEN_BLOCK = '<aui-markdown-code-block style="display: block;">';
const CODE_BLOCK = (lang: string | undefined, code: string) =>
  `${OPEN_BLOCK}<pre class="aui-md-pre"><code${
    lang === undefined ? '' : ` class="language-${lang}"`
  }>${code}</code></pre></aui-markdown-code-block>`;

describe('aui-markdown-text', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders blocks and inlines as their HTML elements with the aui-md classes', async () => {
    expect(
      await html(
        '## Plan\n\nSome *em*, **strong**, ~~gone~~, `code`, a [link](https://a.dev "A") and\\\nnext\n\n> quoted\n\n---\n\n```ts title\nconst a = 1;\n```',
      ),
    ).toBe(
      '<h2 class="aui-md-h2">Plan</h2><p class="aui-md-p">Some <em>em</em>, <strong class="aui-md-strong">strong</strong>, <del>gone</del>, <code class="aui-md-inline-code">code</code>, a <a class="aui-md-a" href="https://a.dev" title="A">link</a> and<br>next</p><blockquote class="aui-md-blockquote"><p class="aui-md-p">quoted</p></blockquote><hr class="aui-md-hr">' +
        CODE_BLOCK('ts', 'const a = 1;\n'),
    );
  });

  it.each([1, 2, 3, 4, 5, 6])('renders a level %i heading', async (depth) => {
    expect(await html(`${'#'.repeat(depth)} Title`)).toBe(
      `<h${depth} class="aui-md-h${depth}">Title</h${depth}>`,
    );
  });

  it('renders soft breaks and code blocks without a language', async () => {
    expect(await html('one\ntwo\n\n```\nplain\n```')).toBe(
      '<p class="aui-md-p">one\ntwo</p>' + CODE_BLOCK(undefined, 'plain\n'),
    );
  });

  it("renders a tight list's paragraphs without wrappers and a loose list's with them", async () => {
    expect(await html('3. one\n4. two')).toBe(
      '<ol class="aui-md-ol" start="3"><li class="aui-md-li">one</li><li class="aui-md-li">two</li></ol>',
    );
    expect(await html('- one\n\n- two')).toBe(
      '<ul class="aui-md-ul"><li class="aui-md-li"><p class="aui-md-p">one</p></li><li class="aui-md-li"><p class="aui-md-p">two</p></li></ul>',
    );
    expect(await html('1. one\n2. two')).toBe(
      '<ol class="aui-md-ol"><li class="aui-md-li">one</li><li class="aui-md-li">two</li></ol>',
    );
  });

  it('renders a task list item with a disabled checkbox named by its text', async () => {
    const { host, html: rendered } = await mount({ text: '- [x] *done*\n- [ ] todo' });
    expect(rendered()).toBe(
      '<ul class="aui-md-ul"><li class="aui-md-li"><input type="checkbox" disabled="" aria-label="done"> <em>done</em></li><li class="aui-md-li"><input type="checkbox" disabled="" aria-label="todo"> todo</li></ul>',
    );
    const boxes = Array.from(host().querySelectorAll<HTMLInputElement>('input'));
    expect(boxes.map((box) => box.checked)).toEqual([true, false]);
    expect(boxes.every((box) => box.disabled)).toBe(true);
  });

  it("puts a loose task list item's checkbox inside its first paragraph", async () => {
    expect(await html('- [x] done\n\n  more\n\n- [ ] todo')).toBe(
      '<ul class="aui-md-ul"><li class="aui-md-li"><p class="aui-md-p"><input type="checkbox" disabled="" aria-label="done"> done</p><p class="aui-md-p">more</p></li><li class="aui-md-li"><p class="aui-md-p"><input type="checkbox" disabled="" aria-label="todo"> todo</p></li></ul>',
    );
  });

  it('aligns table cells per column', async () => {
    expect(await html('| a | b | c |\n| :-: | --- | --: |\n| 1 | 2 | 3 |')).toBe(
      '<table class="aui-md-table"><thead><tr class="aui-md-tr"><th class="aui-md-th" style="text-align: center;">a</th><th class="aui-md-th">b</th><th class="aui-md-th" style="text-align: right;">c</th></tr></thead><tbody><tr class="aui-md-tr"><td class="aui-md-td" style="text-align: center;">1</td><td class="aui-md-td">2</td><td class="aui-md-td" style="text-align: right;">3</td></tr></tbody></table>',
    );
    expect(await html('| a | b |\n| :-- | --: |\n| 1 | 2 |')).toBe(
      '<table class="aui-md-table"><thead><tr class="aui-md-tr"><th class="aui-md-th" style="text-align: left;">a</th><th class="aui-md-th" style="text-align: right;">b</th></tr></thead><tbody><tr class="aui-md-tr"><td class="aui-md-td" style="text-align: left;">1</td><td class="aui-md-td" style="text-align: right;">2</td></tr></tbody></table>',
    );
  });

  it('renders math as the TeX source in the classes math renderers select', async () => {
    expect(await html('$x^2$ and $$y$$\n\n$$\nz\n$$')).toBe(
      '<p class="aui-md-p"><code class="language-math math-inline">x^2</code> and <code class="language-math math-display">y</code></p>' +
        OPEN_BLOCK +
        '<pre class="aui-md-pre"><code class="language-math math-display">z</code></pre></aui-markdown-code-block>',
    );
  });

  it('renders raw HTML, including a script tag, as text', async () => {
    const { host, html: rendered } = await mount({
      text: '<script>alert(1)</script>\n\nhi <b onclick="x()">there</b>',
    });
    expect(rendered()).toBe(
      '<p class="aui-md-p">&lt;script&gt;alert(1)&lt;/script&gt;\n</p><p class="aui-md-p">hi &lt;b onclick="x()"&gt;there&lt;/b&gt;</p>',
    );
    expect(host().querySelector('script, b')).toBeNull();
  });

  it('renders a javascript: link as text, not an anchor', async () => {
    const { host } = await mount({ text: '[x](javascript:alert(1))' });
    expect(host().querySelector('a')).toBeNull();
    expect(host().textContent).toBe('[x](javascript:alert(1))');
  });

  it('renders an image with its alt text and no referrer before src', async () => {
    const { host } = await mount({ text: '![a cat](/cat.png "Cat")' });
    const image = host().querySelector('p > img');
    expect(image?.getAttribute('src')).toBe('/cat.png');
    expect(image?.getAttribute('alt')).toBe('a cat');
    expect(image?.getAttribute('title')).toBe('Cat');
    expect(image?.getAttribute('referrerpolicy')).toBe('no-referrer');
    const attributes = image?.getAttributeNames() ?? [];
    expect(attributes.indexOf('referrerpolicy')).toBeLessThan(attributes.indexOf('src'));
  });

  it('applies preprocess to the text before parsing', async () => {
    expect(await html('area \\(x^2\\)', { preprocess: normalizeMathDelimiters })).toBe(
      '<p class="aui-md-p">area <code class="language-math math-inline">x^2</code></p>',
    );
  });

  it('reports the part status on data-status', async () => {
    const running = await mount({ text: 'hi', running: true });
    expect(running.host().getAttribute('data-status')).toBe('running');
    await running.finish();
    expect(running.host().getAttribute('data-status')).toBe('complete');
  });

  describe('while a message streams', () => {
    it('never renders a literal ** while bold streams in', async () => {
      const { host, stream, finish } = await mount({ text: '**bo', running: true });
      expect(host().textContent).toBe('bo');
      expect(host().querySelector('strong')?.textContent).toBe('bo');
      await stream('**bold**');
      expect(host().textContent).toBe('bold');
      await finish();
      expect(host().textContent).toBe('bold');
      expect(host().querySelector('strong')?.textContent).toBe('bold');
    });

    it('closes syntax left open at the end until the part is complete', async () => {
      const { html: rendered, finish } = await mount({ text: '**bold', running: true });
      expect(rendered()).toBe(
        '<p class="aui-md-p"><strong class="aui-md-strong">bold</strong></p>',
      );
      await finish();
      expect(rendered()).toBe('<p class="aui-md-p">**bold</p>');
    });

    it('keeps the DOM node of a settled first paragraph while the second streams', async () => {
      const { host, stream } = await mount({ text: 'first\n\nsec', running: true });
      const first = host().querySelector('p');
      expect(first?.textContent).toBe('first');
      await stream('first\n\nsecond grows');
      await stream('first\n\nsecond grows more\n\nthird');
      const paragraphs = host().querySelectorAll('p');
      expect(paragraphs[0]).toBe(first);
      expect(Array.from(paragraphs).map((p) => p.textContent)).toEqual([
        'first',
        'second grows more',
        'third',
      ]);
    });

    it('creates an override for a settled block once', async () => {
      const titles: string[] = [];
      @Component({
        selector: 'aui-test-heading',
        standalone: true,
        imports: [AuiMarkdownNodesComponent],
        changeDetection: ChangeDetectionStrategy.OnPush,
        template: `<h1 class="custom" [auiMdNodes]="node().children"></h1>`,
      })
      class HeadingComponent {
        readonly node = input.required<HeadingNode>();
        constructor() {
          queueMicrotask(() =>
            titles.push(
              this.node()
                .children.map((child) => ('value' in child ? child.value : ''))
                .join(''),
            ),
          );
        }
      }
      const { html: rendered, stream } = await mount({
        text: '# Title\n\nfirst',
        running: true,
        components: { heading: HeadingComponent },
      });
      await stream('# Title\n\nfirst words');
      await stream('# Title\n\nfirst words\n\n# Next');
      expect(titles).toEqual(['Title', 'Next']);
      expect(rendered()).toBe(
        '<aui-test-heading><h1 class="custom">Title</h1></aui-test-heading><p class="aui-md-p">first words</p><aui-test-heading><h1 class="custom">Next</h1></aui-test-heading>',
      );
    });

    it('reveals the text smoothly with smooth on', async () => {
      let now = 0;
      const frames = new Map<number, FrameRequestCallback>();
      let nextId = 1;
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        frames.set(nextId, callback);
        return nextId++;
      });
      vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
      vi.spyOn(performance, 'now').mockImplementation(() => now);
      const frame = (ms: number) => {
        now += ms;
        const pending = [...frames.values()];
        frames.clear();
        for (const callback of pending) callback(now);
      };
      const { fixture, host } = await mount({
        text: '**hello** world',
        running: true,
        smooth: true,
      });
      expect(host().textContent).toBe('');
      expect(host().getAttribute('data-status')).toBe('running');
      frame(20);
      await settle(fixture);
      const partial = host().textContent ?? '';
      expect(partial.length).toBeGreaterThan(0);
      expect(partial.length).toBeLessThan('hello world'.length);
      expect(partial).not.toContain('*');
      frame(10_000);
      await settle(fixture);
      expect(host().textContent).toBe('hello world');
    });
  });

  describe('overrides', () => {
    @Component({
      selector: 'aui-test-link',
      standalone: true,
      imports: [AuiMarkdownNodesComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<a [href]="node().url" target="_blank" [auiMdNodes]="node().children"></a>`,
    })
    class LinkComponent {
      readonly node = input.required<LinkNode>();
    }

    it('passes an override its node and lets it render the children', async () => {
      expect(await html('[*go*](/x)', { components: { link: LinkComponent } })).toBe(
        '<p class="aui-md-p"><aui-test-link><a target="_blank" href="/x"><em>go</em></a></aui-test-link></p>',
      );
    });

    @Component({
      selector: 'aui-test-paragraph',
      standalone: true,
      imports: [AuiMarkdownNodesComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<mark [auiMdNodes]="node().children"></mark>`,
    })
    class ParagraphComponent {
      readonly node = input.required<{ children: InlineNode[] }>();
    }

    it("passes a tight list's paragraphs to a paragraph override", async () => {
      expect(await html('- one', { components: { paragraph: ParagraphComponent } })).toBe(
        '<ul class="aui-md-ul"><li class="aui-md-li"><aui-test-paragraph><mark>one</mark></aui-test-paragraph></li></ul>',
      );
    });

    it('renders a task checkbox before its paragraph override', async () => {
      expect(await html('- [x] *done*', { components: { paragraph: ParagraphComponent } })).toBe(
        '<ul class="aui-md-ul"><li class="aui-md-li"><input type="checkbox" disabled="" aria-label="done"> <aui-test-paragraph><mark><em>done</em></mark></aui-test-paragraph></li></ul>',
      );
    });

    it('returns to the default renderer when an override is removed', async () => {
      const { fixture, html: rendered } = await mount({
        text: '[go](/x)',
        components: { link: LinkComponent },
      });
      expect(rendered()).toContain('aui-test-link');
      fixture.componentRef.setInput('components', {});
      await settle(fixture);
      expect(rendered()).toBe('<p class="aui-md-p"><a class="aui-md-a" href="/x">go</a></p>');
    });
  });

  describe('code blocks', () => {
    @Component({
      selector: 'aui-test-mermaid',
      standalone: true,
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<figure [attr.data-lang]="language()">{{ code() }}</figure>`,
    })
    class MermaidComponent {
      readonly language = input.required<string>();
      readonly code = input.required<string>();
    }

    @Component({
      selector: 'aui-test-header',
      standalone: true,
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<span>{{ language() }}:{{ code().length }}</span>`,
    })
    class HeaderComponent {
      readonly language = input.required<string>();
      readonly code = input.required<string>();
    }

    const highlighted = (code: string, language: string) =>
      `<pre class="shiki"><code><span class="line">${language}:${code}</span></code></pre>`;

    it('calls the syntax highlighter with the code and the language', async () => {
      const highlight = vi.fn((code: string, language: string) =>
        Promise.resolve(highlighted(code, language)),
      );
      const { host } = await mount({
        text: '```ts\nconst a = 1;\n```',
        highlighter: { highlight },
      });
      expect(highlight).toHaveBeenCalledWith('const a = 1;\n', 'ts');
      expect(host().querySelector('pre.shiki span.line')?.textContent).toBe('ts:const a = 1;\n');
      expect(host().querySelector('pre.aui-md-pre')).toBeNull();
    });

    it('renders plain <pre><code> when the highlighter returns null', async () => {
      const highlight = vi.fn(() => null);
      expect(await html('```ts\nx\n```', { highlighter: { highlight } })).toBe(
        CODE_BLOCK('ts', 'x\n'),
      );
      expect(highlight).toHaveBeenCalledWith('x\n', 'ts');
    });

    it('binds only highlighter output as trusted markup; the code itself stays text', async () => {
      const { host } = await mount({ text: '```html\n<img src=x onerror="alert(1)">\n```' });
      expect(host().querySelector('img')).toBeNull();
      expect(host().querySelector('code')?.textContent).toBe('<img src=x onerror="alert(1)">\n');
    });

    it('ignores a highlight that resolves after a newer one', async () => {
      const resolvers: ((html: string) => void)[] = [];
      const highlight = vi.fn(() => new Promise<string>((resolve) => resolvers.push(resolve)));
      const { fixture, host, stream } = await mount({
        text: '```ts\na\n',
        running: true,
        highlighter: { highlight },
      });
      await stream('```ts\nab\n');
      expect(resolvers.length).toBe(2);
      resolvers[1]!('<pre class="shiki">new</pre>');
      await settle(fixture);
      resolvers[0]!('<pre class="shiki">old</pre>');
      await settle(fixture);
      expect(host().querySelector('pre.shiki')?.textContent).toBe('new');
    });

    it('lets componentsByLanguage.mermaid override only mermaid blocks', async () => {
      const highlight = vi.fn(() => null);
      expect(
        await html('```mermaid\ngraph TD\n```\n\n```ts\nx\n```', {
          componentsByLanguage: { mermaid: { highlighter: MermaidComponent } },
          highlighter: { highlight },
        }),
      ).toBe(
        OPEN_BLOCK +
          '<aui-test-mermaid><figure data-lang="mermaid">graph TD\n</figure></aui-test-mermaid></aui-markdown-code-block>' +
          CODE_BLOCK('ts', 'x\n'),
      );
      expect(highlight).toHaveBeenCalledTimes(1);
      expect(highlight).toHaveBeenCalledWith('x\n', 'ts');
    });

    it('renders a code header from components or per language', async () => {
      const components: Partial<AuiMarkdownComponents> = { codeHeader: HeaderComponent };
      const byLanguage: AuiMarkdownComponentsByLanguage = {
        mermaid: { codeHeader: MermaidComponent as Type<unknown> },
      };
      expect(
        await html('```py\nab\n```\n\n```mermaid\nc\n```', {
          components,
          componentsByLanguage: byLanguage,
        }),
      ).toBe(
        OPEN_BLOCK +
          '<aui-test-header><span>py:3</span></aui-test-header><pre class="aui-md-pre"><code class="language-py">ab\n</code></pre></aui-markdown-code-block>' +
          OPEN_BLOCK +
          '<aui-test-mermaid><figure data-lang="mermaid">c\n</figure></aui-test-mermaid><pre class="aui-md-pre"><code class="language-mermaid">c\n</code></pre></aui-markdown-code-block>',
      );
    });

    it('lets a codeBlock override replace the whole block', async () => {
      @Component({
        selector: 'aui-test-code',
        standalone: true,
        changeDetection: ChangeDetectionStrategy.OnPush,
        template: `<figure>{{ node().value }}</figure>`,
      })
      class CodeComponent {
        readonly node = input.required<{ value: string }>();
      }
      expect(await html('```py\nx\n```', { components: { codeBlock: CodeComponent } })).toBe(
        '<aui-test-code><figure>x\n</figure></aui-test-code>',
      );
    });
  });

  it('keeps a separate session for each part', async () => {
    const rt = createTestRuntime();
    rt.append({ id: 'a1', role: 'assistant', content: [{ type: 'text', text: '# One' }] });
    rt.append({ id: 'a2', role: 'assistant', content: [{ type: 'text', text: '# Two' }] });
    hostConfig = rt.config;
    configureTestBed({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await settle(fixture);
    const hosts = (fixture.nativeElement as HTMLElement).querySelectorAll('aui-markdown-text');
    expect(Array.from(hosts).map((h) => markup(h))).toEqual([
      '<h1 class="aui-md-h1">One</h1>',
      '<h1 class="aui-md-h1">Two</h1>',
    ]);
  });
});
