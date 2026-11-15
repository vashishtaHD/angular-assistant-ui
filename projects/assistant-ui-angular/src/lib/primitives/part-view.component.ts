// Ported from packages/vue/src/primitives/MessagePrimitiveParts.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// (the inner `MessagePartView`)
import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  TemplateRef,
  computed,
  inject,
  input,
  isDevMode,
  type Type,
} from '@angular/core';
import type { AssistantState } from '@assistant-ui/store/client';
import { injectAuiState } from '../state/inject-aui-state';
import type { DataUIProps } from '../tools/tool-ui';
import { injectRegisteredToolView } from './tool-call-view';

/** The context of an `ng-template auiPart`: the current part state. */
export interface AuiPartTemplateContext {
  /** The part this template instance renders (`let-part`). */
  $implicit: AssistantState['part'];
}

/** Part templates keyed by part type (or `default`). */
export type AuiPartTemplates = ReadonlyMap<string, TemplateRef<AuiPartTemplateContext>>;

type PartView =
  | { kind: 'value'; value: string | number }
  | { kind: 'component'; component: Type<unknown>; inputs: Record<string, unknown> }
  | { kind: 'text'; text: string }
  | { kind: 'template'; template: TemplateRef<AuiPartTemplateContext> }
  | { kind: 'none' };

const NONE: PartView = { kind: 'none' };

const warnedTypes = new Set<string>();

/**
 * Internal: renders the part of the enclosing part scope, resolving its
 * renderer in the same order as upstream's Vue `MessagePrimitiveParts`.
 */
@Component({
  selector: 'aui-part-view',
  standalone: true,
  imports: [NgComponentOutlet, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    @switch (view().kind) {
      @case ('value') {
        <ng-container>{{ valueOf(view()) }}</ng-container>
      }
      @case ('component') {
        <ng-container *ngComponentOutlet="componentOf(view()); inputs: inputsOf(view())" />
      }
      @case ('text') {
        <p style="white-space: pre-line">{{ textOf(view()) }}</p>
      }
      @case ('template') {
        <ng-container
          *ngTemplateOutlet="templateOf(view()); context: context(); injector: injector"
        />
      }
    }
  `,
})
export class AuiPartViewComponent {
  /** The templates projected into the owning `aui-message-parts`. */
  readonly templates = input.required<AuiPartTemplates>();
  /**
   * When true, a template for the part type (or `default`) wins over a
   * registered tool or data UI, which then only renders for parts without
   * one (React's `GroupedParts` render-function-first contract). Default
   * false: registered UIs win, as in `aui-message-parts`.
   */
  readonly templatesFirst = input(false);

  /** Renders projected templates in this part's scope. */
  protected readonly injector = inject(Injector);

  private readonly part = injectAuiState((s) => s.part);
  private readonly registeredTool = injectRegisteredToolView();
  private readonly dataRenderer = injectAuiState((s) => {
    if (s.part.type !== 'data') return null;
    const named = s.optional.dataRenderers?.renderers[s.part.name]?.[0] ?? null;
    return named ?? s.optional.dataRenderers?.fallbacks[0] ?? null;
  });

  /** The template context; `NgTemplateOutlet` forwards it without recreating. */
  protected readonly context = computed<AuiPartTemplateContext>(() => ({
    $implicit: this.part(),
  }));

  /** What this part renders, recomputed when the part or a registry changes. */
  protected readonly view = computed<PartView>(() => {
    const part = this.part();
    if (this.templatesFirst()) {
      const first =
        part.type === 'text'
          ? this.templates().get('text')
          : (this.templates().get(part.type) ?? this.templates().get('default'));
      if (first) return { kind: 'template', template: first };
    }
    const tool = this.registeredTool();
    if (tool) return tool;
    if (part.type === 'data') {
      const render = this.dataRenderer();
      if (render) {
        const data: DataUIProps = { part };
        // Same seam as tool UIs: data renderers are typed as React components.
        return {
          kind: 'component',
          component: render as unknown as Type<unknown>,
          inputs: { data },
        };
      }
    }
    const templates = this.templates();
    if (part.type === 'text') {
      const template = templates.get('text');
      return template ? { kind: 'template', template } : { kind: 'text', text: part.text };
    }
    const template = templates.get(part.type) ?? templates.get('default');
    if (template) return { kind: 'template', template };
    if (isDevMode() && !warnedTypes.has(part.type)) {
      warnedTypes.add(part.type);
      console.warn(
        `AuiMessagePartsComponent: no template for part type "${part.type}"; the part renders nothing. Add an <ng-template auiPart="${part.type}"> or auiPart="default" template.`,
      );
    }
    return NONE;
  });

  protected valueOf(view: PartView): string | number {
    return view.kind === 'value' ? view.value : '';
  }

  protected componentOf(view: PartView): Type<unknown> | null {
    return view.kind === 'component' ? view.component : null;
  }

  protected inputsOf(view: PartView): Record<string, unknown> | undefined {
    return view.kind === 'component' ? view.inputs : undefined;
  }

  protected textOf(view: PartView): string {
    return view.kind === 'text' ? view.text : '';
  }

  protected templateOf(view: PartView): TemplateRef<AuiPartTemplateContext> | null {
    return view.kind === 'template' ? view.template : null;
  }
}
