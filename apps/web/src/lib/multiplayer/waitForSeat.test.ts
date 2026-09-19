import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoomConnectionTimeout, waitForSeat } from './waitForSeat';

function fixture() {
  const state = { localSeat: null as number | null, connection: 'connecting', error: null };
  const listeners = new Set<() => void>();
  return {
    state,
    listeners,
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit: () => {
      for (const listener of listeners) listener();
    },
  };
}

afterEach(() => vi.useRealTimers());

describe('waitForSeat', () => {
  it('does not mistake an open channel for being seated', async () => {
    vi.useFakeTimers();
    const session = fixture();
    const pending = waitForSeat(session);
    const settled = vi.fn();
    void pending.then(settled);
    session.state.connection = 'connected';
    session.emit();
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    session.state.localSeat = 1;
    session.emit();
    await pending;
    expect(session.listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('handles a seat assigned before subscribing', async () => {
    const session = fixture();
    session.state.localSeat = 0;
    await waitForSeat(session);
    expect(session.listeners.size).toBe(0);
  });

  it('stops waiting when the connection cannot reach the host', async () => {
    vi.useFakeTimers();
    const session = fixture();
    const result = expect(waitForSeat(session)).rejects.toBeInstanceOf(RoomConnectionTimeout);
    await vi.advanceTimersByTimeAsync(45_000);
    await result;
    expect(session.listeners.size).toBe(0);
  });

  it('cleans up immediately when the room closes', async () => {
    vi.useFakeTimers();
    const session = fixture();
    const result = expect(waitForSeat(session)).rejects.toThrow('Room closed');
    session.state.connection = 'closed';
    session.emit();
    await result;
    expect(session.listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
