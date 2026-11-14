// Ported from packages/ui/src/components/vue/assistant-ui/tool-fallback.vue @ 7d74276
// (the approval card, confirmation step, questions form and receipt)
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  signal,
} from '@angular/core';
import {
  toolApprovalAcceptsText,
  type ToolApprovalAnswer,
  type ToolApprovalOption,
  type ToolApprovalQuestion,
  type ToolApprovalResponse,
} from '@assistant-ui/core';
import { injectAui, injectAuiState } from 'angular-assistant-ui';
import { AuiButtonDirective } from '../button.directive';
import { AuiIconComponent } from '../icons/icon.component';
import type { AuiIconName } from '../icons/icon-shapes';
import {
  AUI_TOOL_APPROVED_RESULT,
  AUI_TOOL_DENIED_RESULT,
  approvalOptionLabel,
  isAllowApprovalKind,
  isApprovalQuestion,
  isApprovalSettled,
  isKnownApprovalKind,
  questionAcceptsText,
  type AuiToolCallPart,
} from './tool-fallback-utils';

interface Receipt {
  readonly outcome: 'allowed' | 'refused' | 'closed';
  readonly label: string;
  readonly option: string | undefined;
}

const RECEIPT_ICONS: Record<Receipt['outcome'], AuiIconName> = {
  allowed: 'check',
  refused: 'x',
  closed: 'alert-circle',
};

/**
 * The approval area of `aui-tool-fallback`: the approval card of a waiting
 * call (Approve and Deny with an optional reason, the request's options, a
 * confirmation step, a typed answer, or a `display: "questions"` form) and,
 * once the request is settled, its receipt. It reads the tool-call part of the
 * enclosing part scope and answers through the part's `respondToToolApproval`
 * (`resumeToolCall` for an interrupt, `addToolResult` for a call without an
 * approval gate). A refused response brings the controls back with the error.
 * `aui-tool-fallback` renders it; it is exported for custom tool UIs.
 */
@Component({
  selector: 'aui-tool-fallback-approval',
  standalone: true,
  imports: [AuiButtonDirective, AuiIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-tool-fallback-approval-host' },
  template: `
    @if (part(); as part) {
      @if (receipt(); as receipt) {
        <div
          data-slot="aui_tool-fallback-approval-receipt"
          class="aui-tool-fallback-receipt"
          [attr.data-outcome]="receipt.outcome"
        >
          @if (approval()?.prompt; as prompt) {
            <p class="aui-tool-fallback-muted aui-tool-fallback-pre">{{ prompt }}</p>
          }
          <p class="aui-tool-fallback-receipt-line">
            <aui-icon class="aui-tool-fallback-receipt-icon" [name]="receiptIcon()" />
            <span class="aui-tool-fallback-receipt-label">{{ receipt.label }}</span>
            @if (receipt.option !== undefined) {
              <span class="aui-tool-fallback-muted">· {{ receipt.option }}</span>
            }
          </p>
          @for (row of receiptAnswers(); track row.id) {
            <p class="aui-tool-fallback-pre">
              <span class="aui-tool-fallback-muted">{{ row.title }}</span> · {{ row.labels }}
            </p>
          }
          @for (note of receiptNotes(); track note) {
            <p class="aui-tool-fallback-muted aui-tool-fallback-pre">{{ note }}</p>
          }
        </div>
      } @else if (!canAnswer()) {
        @if (approval()?.prompt; as prompt) {
          <div data-slot="aui_tool-fallback-approval" class="aui-tool-fallback-approval">
            <p class="aui-tool-fallback-pre">{{ prompt }}</p>
          </div>
        }
      } @else if (confirming()) {
        @if (confirming(); as option) {
          <div data-slot="aui_tool-fallback-approval-confirm" class="aui-tool-fallback-approval">
            <p class="aui-tool-fallback-strong">{{ confirmTitle(option) }}</p>
            @if (confirmDescription(option); as description) {
              <p class="aui-tool-fallback-muted aui-tool-fallback-pre">{{ description }}</p>
            }
            @if (option.grants?.length) {
              <ul class="aui-tool-fallback-grants">
                @for (grant of option.grants; track grant) {
                  <li>
                    <code>{{ grant }}</code>
                  </li>
                }
              </ul>
            }
            <div class="aui-tool-fallback-actions">
              <button auiButton size="sm" [disabled]="locked()" (click)="respondWithOption(option)">
                Confirm
              </button>
              <button
                auiButton
                variant="outline"
                size="sm"
                [disabled]="locked()"
                (click)="confirmingId.set(null)"
              >
                Back
              </button>
            </div>
          </div>
        }
      } @else if (approval()?.display === 'questions') {
        <div data-slot="aui_tool-fallback-approval" class="aui-tool-fallback-approval">
          @if (approval()?.prompt; as prompt) {
            <p class="aui-tool-fallback-pre">{{ prompt }}</p>
          }
          @for (item of questions(); track item.id) {
            <div
              role="group"
              data-slot="aui_tool-fallback-approval-question"
              class="aui-tool-fallback-question"
              [attr.aria-label]="item.prompt"
            >
              <p class="aui-tool-fallback-pre">
                @if (item.header) {
                  <span class="aui-tool-fallback-question-header">{{ item.header }}</span>
                }
                {{ item.prompt }}
              </p>
              @if (item.options?.length) {
                <div
                  class="aui-tool-fallback-options"
                  [attr.data-described]="isDescribed(item) ? '' : null"
                >
                  @for (option of item.options; track option.id) {
                    <button
                      auiButton
                      size="sm"
                      class="aui-tool-fallback-option"
                      [variant]="isChosen(item, option.id) ? 'default' : 'outline'"
                      [attr.aria-pressed]="isChosen(item, option.id)"
                      [disabled]="locked()"
                      (click)="toggle(item, option.id)"
                    >
                      <span>{{ option.label }}</span>
                      @if (option.description) {
                        <span class="aui-tool-fallback-option-description">{{
                          option.description
                        }}</span>
                      }
                    </button>
                  }
                </div>
              }
              @if (acceptsQuestionText(item)) {
                <textarea
                  class="aui-tool-fallback-textarea"
                  [value]="typed().get(item.id) ?? ''"
                  [disabled]="locked()"
                  [attr.aria-label]="item.prompt"
                  [placeholder]="item.options?.length ? 'Or type an answer' : 'Type your answer'"
                  (input)="setTyped(item, $event)"
                ></textarea>
              }
            </div>
          }
          <div class="aui-tool-fallback-actions">
            <button
              auiButton
              size="sm"
              [disabled]="locked() || !questionsComplete()"
              (click)="sendAnswers()"
            >
              Send
            </button>
            @if (approval()?.dismissible === true) {
              <button
                auiButton
                variant="outline"
                size="sm"
                [disabled]="locked()"
                (click)="dismiss()"
              >
                Dismiss
              </button>
            }
          </div>
          @if (error(); as message) {
            <p role="alert" class="aui-tool-fallback-alert">{{ message }}</p>
          }
        </div>
      } @else {
        <div data-slot="aui_tool-fallback-approval" class="aui-tool-fallback-approval">
          @if (approval()?.prompt; as prompt) {
            <p class="aui-tool-fallback-pre">{{ prompt }}</p>
          }
          @if (orderedOptions().length > 0) {
            <div class="aui-tool-fallback-actions">
              @for (option of orderedOptions(); track option.id) {
                <button
                  auiButton
                  size="sm"
                  [variant]="option === allowOptions()[0] ? 'default' : 'outline'"
                  [disabled]="locked()"
                  (click)="handleOption(option)"
                >
                  {{ optionLabel(option) }}
                </button>
              }
              @if (rejectOptions().length === 0 && !question()) {
                <button
                  auiButton
                  variant="outline"
                  size="sm"
                  [disabled]="locked()"
                  (click)="respond(false)"
                >
                  Deny
                </button>
              }
              @if (!acceptsText() && dismissible()) {
                <button
                  auiButton
                  variant="outline"
                  size="sm"
                  [disabled]="locked()"
                  (click)="dismiss()"
                >
                  Dismiss
                </button>
              }
            </div>
          } @else if (!question()) {
            <div class="aui-tool-fallback-actions">
              <button auiButton size="sm" [disabled]="locked()" (click)="respond(true)">
                Approve
              </button>
              <button
                auiButton
                variant="outline"
                size="sm"
                [disabled]="locked()"
                (click)="respond(false)"
              >
                Deny
              </button>
            </div>
          }
          @if (acceptsText() || takesReason()) {
            <div class="aui-tool-fallback-answer">
              <textarea
                class="aui-tool-fallback-textarea"
                [value]="answer()"
                [disabled]="locked()"
                [attr.aria-label]="textLabel()"
                [placeholder]="textPlaceholder()"
                (input)="answer.set(valueOf($event))"
              ></textarea>
              @if (question()) {
                <div class="aui-tool-fallback-actions">
                  <button auiButton size="sm" [disabled]="locked()" (click)="submitAnswer()">
                    Send
                  </button>
                  @if (dismissible()) {
                    <button
                      auiButton
                      variant="outline"
                      size="sm"
                      [disabled]="locked()"
                      (click)="dismiss()"
                    >
                      Dismiss
                    </button>
                  }
                </div>
              }
            </div>
          } @else if (question() && orderedOptions().length === 0 && dismissible()) {
            <div class="aui-tool-fallback-actions">
              <button
                auiButton
                variant="outline"
                size="sm"
                [disabled]="locked()"
                (click)="dismiss()"
              >
                Dismiss
              </button>
            </div>
          }
          @if (error(); as message) {
            <p role="alert" class="aui-tool-fallback-alert">{{ message }}</p>
          }
        </div>
      }
    }
  `,
})
export class AuiToolFallbackApprovalComponent {
  private readonly aui = injectAui();
  /** @internal */
  protected readonly part = injectAuiState((s): AuiToolCallPart | null =>
    s.part.type === 'tool-call' ? s.part : null,
  );
  /** @internal */
  protected readonly canAnswer = injectAuiState((s) => s.thread.capabilities.answerToolCall);

  /** @internal */
  protected readonly approval = computed(() => this.part()?.approval);
  private readonly submitted = signal(false);
  /** @internal */
  protected readonly locked = computed(() => this.submitted());
  /** @internal */
  protected readonly confirmingId = signal<string | null>(null);
  /** @internal */
  protected readonly answer = signal('');
  /** @internal */
  protected readonly error = signal<string | null>(null);
  /** @internal */
  protected readonly selected = signal<ReadonlyMap<string, readonly string[]>>(new Map());
  /** @internal */
  protected readonly typed = signal<ReadonlyMap<string, string>>(new Map());

  /** @internal */
  protected readonly optionLabel = approvalOptionLabel;
  /** @internal */
  protected readonly acceptsQuestionText = questionAcceptsText;

  /** @internal */
  protected readonly receipt = computed<Receipt | null>(() => {
    const value = this.approval();
    if (value == null || !isApprovalSettled(value)) return null;
    if (value.resolution !== undefined) {
      return {
        outcome: 'closed',
        label:
          value.resolution === 'cancelled'
            ? 'Cancelled before a decision'
            : 'Expired before a decision',
        option: undefined,
      };
    }
    const chosen =
      value.optionId === undefined
        ? undefined
        : value.options?.find((option) => option.id === value.optionId);
    const option = chosen !== undefined ? approvalOptionLabel(chosen) : value.optionId;
    const answered =
      isApprovalQuestion(value) || (chosen !== undefined && !isKnownApprovalKind(chosen.kind));
    const automatic = value.isAutomatic ? ' automatically' : '';
    return value.approved
      ? { outcome: 'allowed', label: `${answered ? 'Answered' : 'Approved'}${automatic}`, option }
      : { outcome: 'refused', label: `${answered ? 'Dismissed' : 'Denied'}${automatic}`, option };
  });
  /** @internal */
  protected readonly receiptIcon = computed(
    () => RECEIPT_ICONS[this.receipt()?.outcome ?? 'closed'],
  );
  /** @internal */
  protected readonly receiptAnswers = computed(() => {
    const value = this.approval();
    if (!value?.answers) return [];
    const answers = value.answers;
    return (value.questions ?? []).flatMap((question) => {
      const answer = Object.hasOwn(answers, question.id) ? answers[question.id] : undefined;
      const labels = [
        ...(answer?.optionIds ?? []).map(
          (id) => question.options?.find((option) => option.id === id)?.label ?? id,
        ),
        ...(answer?.text?.trim() ? [answer.text] : []),
      ];
      return labels.length === 0
        ? []
        : [
            {
              id: question.id,
              title: question.header ?? question.prompt,
              labels: labels.join(', '),
            },
          ];
    });
  });
  /** @internal */
  protected readonly receiptNotes = computed(() => [
    ...new Set(
      [this.approval()?.text, this.approval()?.reason].filter(
        (value): value is string => typeof value === 'string' && value !== '',
      ),
    ),
  ]);

  private readonly options = computed(() => this.approval()?.options ?? []);
  /** @internal */
  protected readonly allowOptions = computed(() =>
    this.options().filter((option) => isAllowApprovalKind(option.kind)),
  );
  /** @internal */
  protected readonly rejectOptions = computed(() =>
    this.options().filter(
      (option) => isKnownApprovalKind(option.kind) && !isAllowApprovalKind(option.kind),
    ),
  );
  /** @internal */
  protected readonly orderedOptions = computed(() => [
    ...this.allowOptions(),
    ...this.options().filter((option) => !isKnownApprovalKind(option.kind)),
    ...this.rejectOptions(),
  ]);
  /** @internal */
  protected readonly question = computed(() => isApprovalQuestion(this.approval()));
  /** @internal */
  protected readonly dismissible = computed(
    () => this.question() && this.approval()?.dismissible === true,
  );
  /** @internal */
  protected readonly acceptsText = computed(() => {
    const value = this.approval();
    return value != null && toolApprovalAcceptsText(value);
  });
  /**
   * A plain decision (no options, not a question, no free-form answer) takes
   * an optional reason that travels with Approve and Deny.
   * @internal
   */
  protected readonly takesReason = computed(
    () => !this.question() && this.orderedOptions().length === 0 && !this.acceptsText(),
  );
  /** @internal */
  protected readonly textLabel = computed(() =>
    this.question()
      ? (this.approval()?.prompt ?? 'Answer')
      : this.takesReason()
        ? 'Reason'
        : 'Note',
  );
  /** @internal */
  protected readonly textPlaceholder = computed(() =>
    this.question()
      ? 'Type your answer'
      : this.takesReason()
        ? 'Add a reason (optional)'
        : 'Add a note to your decision',
  );
  /** @internal */
  protected readonly confirming = computed(() => {
    const id = this.confirmingId();
    return id == null ? undefined : this.options().find((option) => option.id === id);
  });
  /** @internal */
  protected readonly questions = computed(() => this.approval()?.questions ?? []);
  /** @internal */
  protected readonly questionsComplete = computed(() => {
    const questions = this.questions();
    return (
      questions.length > 0 &&
      questions.every((item) => {
        const value = this.answerOf(item);
        return value.optionIds !== undefined || value.text !== undefined;
      })
    );
  });

  /** @internal */
  protected confirmTitle(option: ToolApprovalOption): string {
    const meta = typeof option.confirm === 'object' ? option.confirm : undefined;
    return meta?.title ?? `${approvalOptionLabel(option)}?`;
  }

  /** @internal */
  protected confirmDescription(option: ToolApprovalOption): string | undefined {
    const meta = typeof option.confirm === 'object' ? option.confirm : undefined;
    return meta?.description ?? option.description;
  }

  /** @internal */
  protected valueOf(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }

  // A refused response leaves the request open, so the controls come back
  // rather than staying spent on a decision the runtime never recorded.
  private submit(send: () => Promise<void> | void): void {
    this.submitted.set(true);
    this.error.set(null);
    void (async () => {
      try {
        await send();
      } catch (sendError) {
        this.submitted.set(false);
        this.error.set(sendError instanceof Error ? sendError.message : String(sendError));
      }
    })();
  }

  private typedNote(): { text: string } | { reason: string } | Record<string, never> {
    const value = this.answer();
    if (!value.trim()) return {};
    return this.acceptsText() ? { text: value } : { reason: value };
  }

  /** @internal */
  protected respond(approved: boolean): void {
    const part = this.part();
    if (this.locked() || !part) return;
    const approval = this.approval();
    if (approval != null && approval.approved === undefined) {
      const response = { approved, ...this.typedNote() } as ToolApprovalResponse;
      this.submit(() => this.aui.part.respondToToolApproval(response));
    } else if (part.interrupt) {
      this.submit(() => this.aui.part.resumeToolCall({ approved }));
    } else if (part.status.type === 'requires-action' && part.status.reason === 'interrupt') {
      return;
    } else {
      this.submit(() =>
        this.aui.part.addToolResult(approved ? AUI_TOOL_APPROVED_RESULT : AUI_TOOL_DENIED_RESULT),
      );
    }
  }

  // A custom kind has no decision class for the runtime to derive, and
  // responding without one throws; picking a declared option is an answer, so
  // it resolves as approved.
  /** @internal */
  protected respondWithOption(option: ToolApprovalOption): void {
    if (this.locked()) return;
    this.confirmingId.set(null);
    const note = this.typedNote();
    const response = (
      isKnownApprovalKind(option.kind)
        ? { optionId: option.id, ...note }
        : { optionId: option.id, approved: true, ...note }
    ) as ToolApprovalResponse;
    this.submit(() => this.aui.part.respondToToolApproval(response));
  }

  /** @internal */
  protected handleOption(option: ToolApprovalOption): void {
    if (option.confirm) this.confirmingId.set(option.id);
    else this.respondWithOption(option);
  }

  /** @internal */
  protected submitAnswer(): void {
    if (this.locked()) return;
    const text = this.answer();
    this.submit(() => this.aui.part.respondToToolApproval({ text }));
  }

  // A dismissal is no answer at all, so a typed draft does not travel with it.
  /** @internal */
  protected dismiss(): void {
    if (this.locked()) return;
    this.submit(() => this.aui.part.respondToToolApproval({ approved: false }));
  }

  /** @internal */
  protected isChosen(item: ToolApprovalQuestion, optionId: string): boolean {
    return (this.selected().get(item.id) ?? []).includes(optionId);
  }

  /** @internal */
  protected isDescribed(item: ToolApprovalQuestion): boolean {
    return item.options?.some((option) => option.description) ?? false;
  }

  /** @internal */
  protected toggle(item: ToolApprovalQuestion, optionId: string): void {
    const chosen = this.selected().get(item.id) ?? [];
    const next = chosen.includes(optionId)
      ? chosen.filter((id) => id !== optionId)
      : item.multiple
        ? [...chosen, optionId]
        : [optionId];
    this.selected.set(new Map(this.selected()).set(item.id, next));
  }

  /** @internal */
  protected setTyped(item: ToolApprovalQuestion, event: Event): void {
    this.typed.set(new Map(this.typed()).set(item.id, this.valueOf(event)));
  }

  private answerOf(item: ToolApprovalQuestion): ToolApprovalAnswer {
    const optionIds = this.selected().get(item.id) ?? [];
    const draft = this.typed().get(item.id);
    const text = draft?.trim() ? draft : undefined;
    return {
      ...(optionIds.length > 0 && { optionIds }),
      ...(text !== undefined && { text }),
    };
  }

  /** @internal */
  protected sendAnswers(): void {
    if (this.locked() || !this.questionsComplete()) return;
    const answers = Object.fromEntries(
      this.questions().map((item) => [item.id, this.answerOf(item)]),
    );
    this.submit(() => this.aui.part.respondToToolApproval({ answers }));
  }
}
