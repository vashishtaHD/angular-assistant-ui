// Ported from packages/react/src/primitives/threadList/ThreadListRoot.tsx @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { Directive } from '@angular/core';
import { ThreadListCollection } from './thread-list-focus-group';

/**
 * Marks the thread list container. It is a focus group: the trigger buttons
 * of the items inside it share one tab stop (roving `tabindex`) and move
 * focus with ArrowUp/ArrowDown, Home and End.
 *
 * @example
 * ```html
 * <div auiThreadListRoot>
 *   <aui-thread-list-items>…</aui-thread-list-items>
 * </div>
 * ```
 */
@Directive({
  selector: '[auiThreadListRoot]',
  standalone: true,
  providers: [ThreadListCollection],
})
export class AuiThreadListRootDirective {}
