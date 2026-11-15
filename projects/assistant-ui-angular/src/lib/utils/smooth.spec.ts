// Ported from packages/react/src/utils/smooth/useSmooth.test.tsx @ 7d74276
import { signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing-internal/test-bed';
import type { PartStatus } from './group-parts';
import { injectSmooth, injectSmoothState, type SmoothInput } from './smooth';

const RUNNING: PartStatus = { type: 'running' };
const COMPLETE: PartStatus = { type: 'complete' };

let now = 0;
let nextFrameId = 1;
let frames = new Map<number, FrameRequestCallback>();

/** Advances the fake clock and runs the frames that were pending before it. */
const frame = (ms: number) => {
  now += ms;
  const pending = [...frames.values()];
  frames.clear();
  for (const callback of pending) callback(now);
};

const setup = (text: string, status: PartStatus, smooth?: SmoothInput | Signal<SmoothInput>) => {
  const textSignal = signal(text);
  const statusSignal = signal(status);
  configureTestBed();
  const shown = TestBed.runInInjectionContext(() => injectSmooth(textSignal, statusSignal, smooth));
  shown(); // a template reads it on the first render; that read starts the reveal
  return { text: textSignal, status: statusSignal, shown };
};

const setupState = (text: string, status: PartStatus) => {
  const textSignal = signal(text);
  const statusSignal = signal(status);
  configureTestBed();
  const state = TestBed.runInInjectionContext(() => injectSmoothState(textSignal, statusSignal));
  state();
  return { text: textSignal, status: statusSignal, state };
};

describe('injectSmooth', () => {
  beforeEach(() => {
    now = 0;
    nextFrameId = 1;
    frames = new Map();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = nextFrameId++;
      frames.set(id, callback);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reveals the text progressively while running', () => {
    const { shown } = setup('hello world', RUNNING);
    expect(shown()).toBe('');
    frame(10);
    const first = shown();
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThan('hello world'.length);
    expect('hello world'.startsWith(first)).toBe(true);
    frame(10);
    expect(shown().length).toBeGreaterThan(first.length);
  });

  it('catches up with a growing source without restarting', () => {
    const { shown, text } = setup('abc', RUNNING);
    frame(100);
    expect(shown()).toBe('abc');
    text.set('abcdef');
    shown(); // the render that follows a source change reads it again
    frame(100);
    expect(shown()).toBe('abcdef');
  });

  it('reports running until the reveal caught up, then the source status', () => {
    const { state, status } = setupState('hello world', RUNNING);
    frame(10);
    status.set(COMPLETE);
    expect(state().status.type).toBe('running');
    frame(10_000);
    expect(state().text).toBe('hello world');
    expect(state().status).toBe(COMPLETE);
  });

  it('ends on the full text once the source completes', () => {
    const { shown, status } = setup('hello world', RUNNING);
    frame(10);
    status.set(COMPLETE);
    frame(10_000);
    expect(shown()).toBe('hello world');
  });

  it('commits at once when the source is already complete', () => {
    const { state } = setupState('hello world', COMPLETE);
    expect(state().text).toBe('hello world');
    expect(state().status).toBe(COMPLETE);
    expect(frames.size).toBe(0);
  });

  it('commits at once when the source settles before any character was revealed', () => {
    const { shown, status } = setup('hello world', RUNNING);
    expect(shown()).toBe('');
    status.set(COMPLETE);
    expect(shown()).toBe('hello world');
  });

  it('restarts on text that does not extend what was shown', () => {
    const { shown, text } = setup('hello world', RUNNING);
    frame(10_000);
    expect(shown()).toBe('hello world');
    text.set('something else');
    expect(shown()).toBe('');
    frame(10_000);
    expect(shown()).toBe('something else');
  });

  it('is off with smooth=false', () => {
    const { shown, text } = setup('abc', RUNNING, false);
    expect(shown()).toBe('abc');
    text.set('abcdef');
    expect(shown()).toBe('abcdef');
    expect(frames.size).toBe(0);
  });

  it('caps the characters revealed per frame with maxCharsPerFrame', () => {
    const { shown } = setup('x'.repeat(100), RUNNING, { maxCharsPerFrame: 3, drainMs: 1 });
    frame(1000);
    expect(shown().length).toBe(3);
    frame(1000);
    expect(shown().length).toBe(6);
  });

  it('commits at most once per minCommitMs but always the final frame', () => {
    const { shown } = setup('x'.repeat(40), RUNNING, { minCommitMs: 100, maxCharsPerFrame: 1 });
    frame(20);
    const first = shown().length;
    frame(20);
    expect(shown().length).toBe(first);
    frame(200);
    expect(shown().length).toBeGreaterThan(first);
  });

  it('follows a signal of options', () => {
    const smooth = signal<SmoothInput>(false);
    const { shown } = setup('hello world', RUNNING, smooth);
    expect(shown()).toBe('hello world');
    smooth.set(true);
    expect(shown().length).toBeLessThanOrEqual('hello world'.length);
  });

  it('is off under prefers-reduced-motion, even with smooth=true', () => {
    const query = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => query),
    );
    const { shown } = setup('hello world', RUNNING, true);
    expect(shown()).toBe('hello world');
    expect(frames.size).toBe(0);
  });

  it('stops its frames when destroyed', () => {
    const { shown } = setup('hello world', RUNNING);
    expect(shown()).toBe('');
    expect(frames.size).toBe(1);
    TestBed.resetTestingModule();
    expect(frames.size).toBe(0);
  });
});
