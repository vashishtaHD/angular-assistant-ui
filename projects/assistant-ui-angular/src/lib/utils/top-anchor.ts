// Ported from packages/react/src/primitives/thread/topAnchor/{topAnchorTurn,topAnchorUtils,computeTopAnchorSlack,createReserveObservers,mountTopAnchorReserve}.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5

/** A user message (`anchorId`) paired with the assistant reply (`targetId`) that follows it. */
export interface TopAnchorTurn {
  readonly anchorId: string;
  readonly targetId: string;
}

interface TurnMessage {
  readonly id: string;
  readonly role: string;
}

/**
 * A stored turn stays valid only while it is still the trailing turn: the
 * anchor immediately precedes the target, and anything after the target is a
 * pending user message awaiting the next run.
 */
export const isTopAnchorTurnValid = (
  turn: TopAnchorTurn | null,
  messages: readonly TurnMessage[],
): boolean => {
  if (!turn) return false;
  const targetIndex = messages.findIndex((message) => message.id === turn.targetId);
  if (targetIndex < 1) return false;
  return (
    messages[targetIndex - 1]?.id === turn.anchorId &&
    messages.slice(targetIndex + 1).every((message) => message.role === 'user')
  );
};

/** The live user/assistant pair of a running thread, or `null`. */
export const getActiveTopAnchorTurn = (options: {
  readonly isRunning: boolean;
  readonly messages: readonly TurnMessage[];
}): TopAnchorTurn | null => {
  if (!options.isRunning) return null;
  const target = options.messages.at(-1);
  const anchor = options.messages.at(-2);
  if (anchor?.role !== 'user' || target?.role !== 'assistant') return null;
  return { anchorId: anchor.id, targetId: target.id };
};

/**
 * Converts a CSS length string (`px`, `em`, `rem`) to pixels. Unsupported or
 * malformed values yield `Infinity`, which disables the tall-message clamp.
 */
export const parseCssLength = (value: string, element: HTMLElement): number => {
  const match = value.trim().match(/^(\d+(?:\.\d+)?|\.\d+)(em|px|rem)$/);
  if (!match) return Number.POSITIVE_INFINITY;
  const num = Number(match[1]);
  const unit = match[2];
  if (unit === 'px') return num;
  if (unit === 'em') return num * (parseFloat(getComputedStyle(element).fontSize) || 16);
  if (unit === 'rem') {
    return num * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
  }
  return Number.POSITIVE_INFINITY;
};

const createReserveElement = (): HTMLElement => {
  const reserve = document.createElement('div');
  reserve.dataset['auiTopAnchorReserve'] = '';
  reserve.style.height = '0px';
  reserve.style.flexShrink = '0';
  reserve.style.pointerEvents = 'none';
  reserve.setAttribute('aria-hidden', 'true');
  return reserve;
};

const setReserveHeight = (reserve: HTMLElement, height: number): boolean => {
  const next = `${height}px`;
  if (reserve.style.height === next) return false;
  reserve.style.height = next;
  return true;
};

const snapScrollTop = (top: number): number => {
  const pixelRatio = window.devicePixelRatio || 1;
  return Math.round(top * pixelRatio) / pixelRatio;
};

const getDocumentOffsetTop = (element: HTMLElement): number => {
  let top = 0;
  let current: HTMLElement | null = element;
  while (current) {
    top += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }
  return top;
};

// Layout geometry, not visual rects, so entrance transforms on the anchor do
// not shift the scroll target while they settle.
const getLayoutOffsetTop = (element: HTMLElement, ancestor: HTMLElement): number => {
  let top = 0;
  let current: HTMLElement | null = element;
  while (current && current !== ancestor) {
    top += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }
  if (current === ancestor) return top;
  return getDocumentOffsetTop(element) - getDocumentOffsetTop(ancestor);
};

interface TargetOptions {
  viewport: HTMLElement;
  anchor: HTMLElement;
  tallerThan: number;
  visibleHeight: number;
}

/**
 * The scroll position that pins the anchor (last user message) to the top of
 * the viewport. A tall anchor is over-scrolled so only `visibleHeight` of it
 * stays visible, leaving room for the reply below.
 */
export const computeTopAnchorTargetScrollTop = ({
  viewport,
  anchor,
  tallerThan,
  visibleHeight,
}: TargetOptions): number => {
  const anchorTop = getLayoutOffsetTop(anchor, viewport);
  const anchorHeight = anchor.offsetHeight;
  const visible = anchorHeight <= tallerThan ? anchorHeight : visibleHeight;
  return anchorTop + Math.max(0, anchorHeight - visible);
};

/** The height the reserve needs so the anchor can reach the top of the viewport. */
export const computeTopAnchorReserve = ({
  reserve,
  ...options
}: TargetOptions & { reserve: HTMLElement }): number => {
  const targetScrollHeight =
    computeTopAnchorTargetScrollTop(options) + options.viewport.clientHeight;
  return Math.max(0, targetScrollHeight - (options.viewport.scrollHeight - reserve.offsetHeight));
};

const createReserveObservers = (onChange: () => void) => {
  const resizeObserver =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onChange);
  const mutationObserver = new MutationObserver(onChange);
  let observed: [HTMLElement, HTMLElement, HTMLElement] | null = null;

  const disconnect = () => {
    resizeObserver?.disconnect();
    mutationObserver.disconnect();
    observed = null;
  };

  return {
    target: (viewport: HTMLElement, anchor: HTMLElement, target: HTMLElement) => {
      if (
        observed &&
        observed[0] === viewport &&
        observed[1] === anchor &&
        observed[2] === target
      ) {
        return;
      }
      disconnect();
      resizeObserver?.observe(viewport);
      resizeObserver?.observe(anchor);
      resizeObserver?.observe(target);
      mutationObserver.observe(target, { childList: true, subtree: true, characterData: true });
      observed = [viewport, anchor, target];
    },
    disconnect,
  };
};

/** The slice of viewport state the top-anchor reserve reads. */
export interface TopAnchorStore {
  getState(): {
    turnAnchor: 'top' | 'bottom';
    element: {
      viewport: HTMLElement | null;
      anchor: HTMLElement | null;
      target: HTMLElement | null;
    };
    targetConfig: { tallerThan: number; visibleHeight: number } | null;
    topAnchorTurn: TopAnchorTurn | null;
  };
  subscribe(fn: () => void): () => void;
}

const createFrameScheduler = (fn: () => void) => {
  let frame: number | null = null;
  return {
    schedule: () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        fn();
      });
    },
    cancel: () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
    },
  };
};

/**
 * Keeps a spacer element after the streaming reply so the last user message
 * can be scrolled to the top of the viewport, scrolls it there once per
 * anchor, and restores the pinned position if the browser clamps the scroll
 * range. Returns a dispose function.
 */
export const mountTopAnchorReserve = (store: TopAnchorStore): (() => void) => {
  let reserve: HTMLElement | null = null;
  let lastScrolledAnchorId: string | undefined;
  let listenedViewport: HTMLElement | null = null;
  let lastScrollTop = 0;
  let restoreScrollTop: number | null = null;
  let restoredThisTurn = false;
  let lastAppliedTarget: number | null = null;

  const clearRestore = () => {
    restoreScrollTop = null;
    lastAppliedTarget = null;
  };

  const wasPinnedAtLastScroll = () =>
    lastAppliedTarget !== null && Math.abs(lastScrollTop - lastAppliedTarget) <= 1;

  const handleScroll = () => {
    const viewport = listenedViewport;
    if (!viewport) return;
    const scrollTop = viewport.scrollTop;
    const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    // A range clamp starts beyond the new maximum and lands on it.
    const isRangeClamp =
      scrollTop < lastScrollTop &&
      lastScrollTop > maxScrollTop + 1 &&
      Math.abs(scrollTop - maxScrollTop) <= 1;
    if (isRangeClamp && wasPinnedAtLastScroll() && !restoredThisTurn) {
      restoreScrollTop ??= lastScrollTop;
      scheduler.schedule();
    }
    lastScrollTop = scrollTop;
  };

  const listenViewport = (viewport: HTMLElement | null) => {
    if (listenedViewport === viewport) return;
    listenedViewport?.removeEventListener('scroll', handleScroll);
    listenedViewport = viewport;
    restoredThisTurn = false;
    clearRestore();
    if (viewport) {
      viewport.addEventListener('scroll', handleScroll, { passive: true });
      lastScrollTop = viewport.scrollTop;
    }
  };

  const removeReserve = () => {
    observers.disconnect();
    clearRestore();
    if (reserve) {
      setReserveHeight(reserve, 0);
      reserve.remove();
    }
  };

  function apply() {
    const state = store.getState();
    const { viewport, anchor, target } = state.element;
    const clamp = state.targetConfig;

    listenViewport(state.turnAnchor === 'top' ? viewport : null);

    if (state.turnAnchor !== 'top' || !viewport) {
      removeReserve();
      return;
    }

    if (!anchor && !target && !clamp && state.topAnchorTurn) {
      // The stored pair is still the trailing turn, so the gap is transient
      // and the next run is imminent: keep the reserve, but last in its parent.
      observers.disconnect();
      clearRestore();
      if (reserve?.parentElement && reserve.parentElement.lastElementChild !== reserve) {
        reserve.parentElement.append(reserve);
      }
      return;
    }

    if (!anchor || !target || !clamp) {
      removeReserve();
      return;
    }

    reserve ??= createReserveElement();
    if (
      reserve.parentElement !== target.parentElement ||
      reserve.previousElementSibling !== target
    ) {
      target.after(reserve);
    }

    observers.target(viewport, anchor, target);

    const reserveChanged = setReserveHeight(
      reserve,
      computeTopAnchorReserve({ viewport, anchor, reserve, ...clamp }),
    );
    if (reserveChanged) {
      scheduler.schedule();
      return;
    }

    const anchorId = anchor.dataset['messageId'];
    const targetScrollTop = snapScrollTop(
      computeTopAnchorTargetScrollTop({ viewport, anchor, ...clamp }),
    );

    if (anchorId === undefined || anchorId !== lastScrolledAnchorId) {
      restoreScrollTop = null;
      restoredThisTurn = false;
      if (Math.abs(viewport.scrollTop - targetScrollTop) > 1) {
        viewport.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
      }
      if (anchorId !== undefined) lastScrolledAnchorId = anchorId;
    } else if (restoreScrollTop !== null && lastAppliedTarget !== null) {
      // If content above the anchor changed height and the browser already
      // adjusted scrollTop (scroll anchoring), this is a no-op.
      const desired = snapScrollTop(restoreScrollTop + (targetScrollTop - lastAppliedTarget));
      restoreScrollTop = null;
      restoredThisTurn = true;
      if (Math.abs(viewport.scrollTop - desired) > 1) {
        viewport.scrollTo({ top: desired, behavior: 'instant' });
      }
    }

    lastAppliedTarget = targetScrollTop;
  }

  const scheduler = createFrameScheduler(apply);
  const observers = createReserveObservers(scheduler.schedule);

  scheduler.schedule();
  const unsubscribe = store.subscribe(scheduler.schedule);

  return () => {
    scheduler.cancel();
    unsubscribe();
    observers.disconnect();
    listenViewport(null);
    reserve?.remove();
  };
};
