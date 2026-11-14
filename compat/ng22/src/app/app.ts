import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AISDKChat } from '@assistant-ui/ai-sdk';
import {
  AuiComposerInputDirective,
  AuiComposerRootDirective,
  AuiComposerSendDirective,
  AuiConfig,
  AuiMessagePartsComponent,
  AuiMessageRootDirective,
  AuiMessageTemplateDirective,
  AuiPartTemplateDirective,
  AuiProviderDirective,
  AuiThreadMessagesComponent,
  AuiThreadRootDirective,
} from 'angular-assistant-ui';
import { createScriptedChatTransport } from 'angular-assistant-ui/testing';

/** One scripted assistant reply, "Hi there!", streamed as two text deltas. */
const transport = createScriptedChatTransport([
  {
    chunks: [
      { type: 'start' },
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: 'Hi ' },
      { type: 'text-delta', id: 't1', delta: 'there!' },
      { type: 'text-end', id: 't1' },
      { type: 'finish' },
    ],
  },
]);

/** Compat smoke app: a minimal chat over a scripted (offline) transport. */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    AuiProviderDirective,
    AuiThreadRootDirective,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessageRootDirective,
    AuiMessagePartsComponent,
    AuiPartTemplateDirective,
    AuiComposerRootDirective,
    AuiComposerInputDirective,
    AuiComposerSendDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container [auiProvider]="config">
      <div auiThreadRoot>
        <aui-thread-messages>
          <ng-template auiMessage>
            <div auiMessageRoot>
              <aui-message-parts>
                <ng-template auiPart="text" let-part>
                  <p>{{ part.type === 'text' ? part.text : '' }}</p>
                </ng-template>
              </aui-message-parts>
            </div>
          </ng-template>
        </aui-thread-messages>
        <form auiComposerRoot>
          <textarea auiComposerInput aria-label="Message"></textarea>
          <button auiComposerSend>Send</button>
        </form>
      </div>
    </ng-container>
  `,
})
export class App {
  protected readonly config = AuiConfig({ threads: AISDKChat({ transport }) });
}
