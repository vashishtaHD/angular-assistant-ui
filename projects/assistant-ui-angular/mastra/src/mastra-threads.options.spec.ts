import type { RemoteThreadListAdapter } from '@assistant-ui/core';
import type { ChatTransport, UIMessage } from 'ai';
import { describe, expect, it, vi } from 'vitest';

const remote = vi.hoisted(() => vi.fn((options: unknown) => options));
vi.mock('./vendor/AISDKThreads', () => ({ RemoteAISDKThreads: remote }));

const { MastraThreads, mastraSendAutomaticallyWhen } = await import('./mastra-threads');

const adapter = {} as RemoteThreadListAdapter;
const transport = {} as ChatTransport<UIMessage>;
const passed = () => remote.mock.calls.at(-1)![0] as Record<string, unknown>;

describe('MastraThreads options', () => {
  it('defaults sendAutomaticallyWhen to mastraSendAutomaticallyWhen', () => {
    MastraThreads({ adapter, transport });
    expect(passed()['sendAutomaticallyWhen']).toBe(mastraSendAutomaticallyWhen);
  });

  it('keeps the default when sendAutomaticallyWhen is explicitly undefined', () => {
    MastraThreads({ adapter, transport, sendAutomaticallyWhen: undefined });
    expect(passed()['sendAutomaticallyWhen']).toBe(mastraSendAutomaticallyWhen);
  });

  it('uses a given sendAutomaticallyWhen', () => {
    const custom = () => false;
    MastraThreads({ adapter, transport, sendAutomaticallyWhen: custom });
    expect(passed()['sendAutomaticallyWhen']).toBe(custom);
  });
});
