/** A signaling offer is not a connection: wait for the host to assign a seat. */
export class RoomConnectionTimeout extends Error {
  constructor() {
    super('Room connection timed out before a seat was assigned');
  }
}

type JoiningSession = {
  getSnapshot(): { localSeat: number | null; connection: string; error: string | null };
  subscribe(listener: () => void): () => void;
};

export function waitForSeat(session: JoiningSession, timeoutMs = 45_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new RoomConnectionTimeout()), timeoutMs);
    let unsubscribe = () => {};
    function finish(error?: Error) {
      clearTimeout(timer);
      unsubscribe();
      if (error) reject(error);
      else resolve();
    }
    function check() {
      const state = session.getSnapshot();
      if (state.connection === 'closed') finish(new Error(state.error ?? 'Room closed'));
      else if (state.localSeat !== null) finish();
    }
    unsubscribe = session.subscribe(check);
    check();
  });
}
