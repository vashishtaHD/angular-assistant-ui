// Angular addition (no upstream counterpart): the answer form for the Mastra demo's `askUser`
// tool, styled after the questions form of packages/ui/src/components/vue/assistant-ui/tool-fallback.vue @ 7d74276
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  signal,
} from '@angular/core';
import { injectAui, injectAuiState } from 'angular-assistant-ui';
import { AuiButtonDirective } from '../button.directive';
import { isAskUserArgs, type AuiAskUserArgs } from './tool-fallback-utils';

let nextId = 0;

const EMPTY_ARGS: AuiAskUserArgs = Object.freeze({ question: '' });

/**
 * The answer form of an ask-user tool call: a call waiting on the frontend
 * whose arguments are `{ question, options?, multiple? }` (the Mastra demo's
 * `askUser` tool, which has no `execute`). It shows the question, the options
 * as radio buttons (or checkboxes when `multiple` is set) and a free-text
 * field, which is the whole answer when there are no options and an "other"
 * answer otherwise. Submit adds the answer as the tool result through the
 * part's `addToolResult`:
 * - one option picked, or typed text: that string (typed text wins);
 * - `multiple`: the picked options in their offered order, then the typed text, as a string array.
 *
 * A refused result brings the form back with the error. `aui-tool-fallback`
 * renders it; it is exported for custom tool UIs.
 */
@Component({
  selector: 'aui-tool-fallback-ask-user',
  standalone: true,
  imports: [AuiButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-tool-fallback-ask-user-host' },
  template: `
    <form
      data-slot="aui_tool-fallback-ask-user"
      class="aui-tool-fallback-ask-user"
      (submit)="$event.preventDefault(); send()"
    >
      <fieldset class="aui-tool-fallback-fieldset" [disabled]="locked()">
        <legend class="aui-tool-fallback-pre aui-tool-fallback-question-text">
          {{ args().question }}
        </legend>
        @if (options().length > 0) {
          <div
            class="aui-tool-fallback-choices"
            [attr.role]="multiple() ? 'group' : 'radiogroup'"
            [attr.aria-label]="args().question"
          >
            @for (option of options(); track $index) {
              <label class="aui-tool-fallback-choice">
                <input
                  [type]="multiple() ? 'checkbox' : 'radio'"
                  [name]="name"
                  [value]="option"
                  [checked]="picked().includes(option)"
                  (change)="pick(option, $event)"
                />
                <span>{{ option }}</span>
              </label>
            }
          </div>
        }
        <textarea
          class="aui-tool-fallback-textarea"
          [value]="text()"
          [attr.aria-label]="options().length > 0 ? 'Other answer' : args().question"
          [placeholder]="options().length > 0 ? 'Or type an answer' : 'Type your answer'"
          (input)="text.set(valueOf($event))"
        ></textarea>
        <div class="aui-tool-fallback-actions">
          <button auiButton size="sm" type="submit" [disabled]="locked() || !answerable()">
            Submit
          </button>
        </div>
      </fieldset>
      @if (error(); as message) {
        <p role="alert" class="aui-tool-fallback-alert">{{ message }}</p>
      }
    </form>
  `,
})
export class AuiToolFallbackAskUserComponent {
  private readonly aui = injectAui();
  /** @internal */
  protected readonly args = injectAuiState((s) =>
    s.part.type === 'tool-call' && isAskUserArgs(s.part.args) ? s.part.args : EMPTY_ARGS,
  );
  /** @internal */
  protected readonly options = computed(() => this.args().options ?? []);
  /** @internal */
  protected readonly multiple = computed(() => this.args().multiple === true);
  /** @internal */
  protected readonly name = `aui-ask-user-${nextId++}`;

  /** @internal */
  protected readonly picked = signal<readonly string[]>([]);
  /** @internal */
  protected readonly text = signal('');
  private readonly submitted = signal(false);
  /** @internal */
  protected readonly locked = computed(() => this.submitted());
  /** @internal */
  protected readonly error = signal<string | null>(null);

  private readonly answer = computed<string | string[] | undefined>(() => {
    const typed = this.text().trim() ? this.text() : undefined;
    if (this.multiple()) {
      const picks = this.options().filter((option) => this.picked().includes(option));
      const all = [...picks, ...(typed !== undefined ? [typed] : [])];
      return all.length > 0 ? all : undefined;
    }
    return typed ?? this.picked()[0];
  });
  /** @internal */
  protected readonly answerable = computed(() => this.answer() !== undefined);

  /** @internal */
  protected valueOf(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }

  /** @internal */
  protected pick(option: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (!this.multiple()) {
      this.picked.set(checked ? [option] : []);
      return;
    }
    const current = this.picked().filter((value) => value !== option);
    this.picked.set(checked ? [...current, option] : current);
  }

  /** @internal */
  protected send(): void {
    const answer = this.answer();
    if (this.locked() || answer === undefined) return;
    this.submitted.set(true);
    this.error.set(null);
    void (async () => {
      try {
        await this.aui.part.addToolResult(answer);
      } catch (sendError) {
        this.submitted.set(false);
        this.error.set(sendError instanceof Error ? sendError.message : String(sendError));
      }
    })();
  }
}
