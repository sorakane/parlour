import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpRoomRelay } from './HttpRoomRelay';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

type Exchange = { after: number; messages: { id: string; payload: { sentAt: number } }[] };

describe('HTTPS room delivery', () => {
  it('retries a lost response with the same message id and advances the recipient cursor', async () => {
    vi.useFakeTimers();
    const requests: Exchange[] = [];
    const fetcher = vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      requests.push(body);
      if (requests.length === 1) throw new Error('response lost after server commit');
      return Response.json({
        messages:
          requests.length === 2
            ? [{ id: 42, sender: 'other', payload: { type: 'heartbeat', sentAt: 10 } }]
            : [],
      });
    });
    vi.stubGlobal('fetch', fetcher);
    const relay = new HttpRoomRelay('/api/room-relay');
    const receive = vi.fn(async () => undefined);
    const status = vi.fn();
    relay.sendMessage('ABCD', 'recipient', { type: 'heartbeat', sentAt: 1 });
    relay.subscribeMessages('ABCD', receive, status);
    await vi.advanceTimersByTimeAsync(0);
    expect(status).toHaveBeenLastCalledWith(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(requests[1]!.messages).toEqual(requests[0]!.messages);
    expect(receive).toHaveBeenCalledExactlyOnceWith('other', { type: 'heartbeat', sentAt: 10 });
    expect(status).toHaveBeenLastCalledWith(true);
    await vi.advanceTimersByTimeAsync(800);
    expect(requests[2]!.after).toBe(42);
    expect(requests[2]!.messages).toEqual([]);
    relay.close();
    const count = requests.length;
    await vi.advanceTimersByTimeAsync(10000);
    expect(requests).toHaveLength(count);
  });

  it('coalesces queued heartbeats and ignores malformed incoming messages', async () => {
    vi.useFakeTimers();
    let body: Exchange;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        body = JSON.parse(init.body);
        return Response.json({
          messages: [{ id: 1, sender: 'other', payload: { type: 'unknown' } }],
        });
      }),
    );
    const relay = new HttpRoomRelay('/api/room-relay');
    for (let sentAt = 0; sentAt < 100; sentAt++)
      relay.sendMessage('ABCD', 'recipient', { type: 'heartbeat', sentAt });
    const receive = vi.fn(async () => undefined);
    relay.subscribeMessages('ABCD', receive, () => undefined);
    await vi.advanceTimersByTimeAsync(0);
    expect(body!.messages).toHaveLength(1);
    expect(body!.messages[0]!.payload.sentAt).toBe(99);
    expect(receive).not.toHaveBeenCalled();
    relay.close();
  });
});
