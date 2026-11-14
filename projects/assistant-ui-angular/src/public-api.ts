/*
 * Public API Surface of angular-assistant-ui.
 * Every export must be re-exported from this file and carry TSDoc.
 */

export { AUI_CONTEXT, type AuiContext } from './lib/context/aui-context';
export { AuiProviderDirective } from './lib/provider/aui-provider.directive';
export { AuiIfDirective } from './lib/aui-if.directive';
export { injectAui } from './lib/state/inject-aui';
export { injectAuiState } from './lib/state/inject-aui-state';
export { injectAuiEvent } from './lib/state/inject-aui-event';

// Store primitives, re-exported as upstream's Vue binding does.
export {
  AuiConfig,
  Derived,
  createAssistantClient,
  type AssistantClient,
  type AssistantClientHandle,
  type AssistantClientSource,
  type AssistantConfigSource,
  type AssistantState,
  type AssistantEventCallback,
  type AssistantEventName,
  type AssistantEventSelector,
  type Unsubscribe,
} from '@assistant-ui/store/client';

// Thread viewport.
export { AuiThreadViewportDirective } from './lib/primitives/thread-viewport.directive';
export {
  AUI_VIEWPORT,
  injectAuiViewport,
  type AuiViewport,
} from './lib/primitives/viewport-context';
