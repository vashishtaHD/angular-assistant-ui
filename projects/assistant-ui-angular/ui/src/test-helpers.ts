import { OverlayContainer } from '@angular/cdk/overlay';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';

/**
 * jsdom has no layout, so the CDK treats every element as hidden and the focus
 * trap finds nothing tabbable. Give every element a geometry for a spec.
 * Returns a restore function.
 */
export function stubLayout(): () => void {
  const proto = HTMLElement.prototype;
  const saved = {
    w: Object.getOwnPropertyDescriptor(proto, 'offsetWidth'),
    h: Object.getOwnPropertyDescriptor(proto, 'offsetHeight'),
    r: proto.getClientRects,
  };
  Object.defineProperty(proto, 'offsetWidth', { configurable: true, get: () => 100 });
  Object.defineProperty(proto, 'offsetHeight', { configurable: true, get: () => 20 });
  proto.getClientRects = function () {
    return [{ width: 100, height: 20 }] as unknown as DOMRectList;
  };
  return () => {
    if (saved.w) Object.defineProperty(proto, 'offsetWidth', saved.w);
    if (saved.h) Object.defineProperty(proto, 'offsetHeight', saved.h);
    proto.getClientRects = saved.r;
  };
}

/** The element the CDK renders overlays into. */
export function overlayRoot(): HTMLElement {
  return TestBed.inject(OverlayContainer).getContainerElement();
}

/** Flushes pending timers and render hooks. */
export async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  TestBed.inject(ApplicationRef).tick();
}
