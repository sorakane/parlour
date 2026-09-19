import type { RoomAnnouncement, SignalPayload } from './NostrSignaling';
import type { RoomRelay } from './RoomRelay';
import type { RoomSettings } from './types';
import { parseWire, type WireMessage } from './wireSchema';

const hex = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
export const httpRoomsEnabled = () => !!process.env.NEXT_PUBLIC_DAIFUGO_ROOM_API;

type Outgoing = { id: string; recipient: string; payload: WireMessage };

/** Polls and batches authenticated messages over ordinary HTTPS. */
export class HttpRoomRelay implements RoomRelay {
  readonly delivery = 'https' as const;
  readonly publicKey = hex();
  private readonly token = hex();
  private cursor = 0;
  private outbox: Outgoing[] = [];
  private timer?: ReturnType<typeof setTimeout>;
  private closed = false;
  private roomCode?: string;
  private running = false;
  private wake?: () => void;
  private controller?: AbortController;

  constructor(
    private readonly endpoint = process.env.NEXT_PUBLIC_DAIFUGO_ROOM_API ?? '/api/room-relay',
  ) {}

  private async request(body: Record<string, unknown>) {
    const controller = new AbortController();
    this.controller = controller;
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        cache: 'no-store',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, peerId: this.publicKey, token: this.token }),
      });
      if (!response.ok) {
        const fault = await response.json().catch(() => null);
        throw new Error(fault?.error ?? '部屋のサーバーに接続できませんでした。');
      }
      return await response.json();
    } finally {
      clearTimeout(timeout);
      if (this.controller === controller) this.controller = undefined;
    }
  }

  async list(listing: import('./RoomDirectory').OwnTableListing) {
    await this.request({ op: 'listing', code: listing.code, listing });
  }
  async unlist(code: string) {
    await this.request({ op: 'listing', code, listing: null });
  }

  async announce(code: string, settings: RoomSettings) {
    await this.request({ op: 'create', code, settings });
  }

  async resolve(code: string, expectedHost?: string): Promise<RoomAnnouncement> {
    const response = await this.request({ op: 'join', code, expectedHost });
    this.cursor = response.cursor;
    return { hostPubkey: response.hostPubkey, settings: response.settings };
  }

  async send(_code: string, _target: string, _signal: SignalPayload): Promise<void> {
    throw new Error('HTTPS rooms do not negotiate WebRTC');
  }

  subscribe(): { close(): void } {
    throw new Error('Use HTTPS message delivery');
  }

  sendMessage(_code: string, recipient: string, payload: WireMessage) {
    if (this.closed) return;
    // Heartbeats describe current presence; never accumulate them while offline.
    if (payload.type === 'heartbeat') {
      this.outbox = this.outbox.filter(
        (m) => m.recipient !== recipient || m.payload.type !== 'heartbeat',
      );
    }
    this.outbox.push({ id: crypto.randomUUID(), recipient, payload });
    this.wake?.();
  }

  subscribeMessages(
    code: string,
    receive: (sender: string, message: WireMessage) => Promise<void>,
    status: (connected: boolean) => void,
  ) {
    this.roomCode = code;
    let failures = 0;
    const poll = async () => {
      if (this.closed || this.running) return;
      this.running = true;
      const batch: Outgoing[] = [];
      let bytes = 0;
      for (const message of this.outbox.slice(0, 24)) {
        const size = new TextEncoder().encode(JSON.stringify(message)).length;
        if (batch.length && bytes + size > 800_000) break;
        batch.push(message);
        bytes += size;
      }
      try {
        const response = await this.request({
          op: 'exchange',
          code,
          after: this.cursor,
          messages: batch,
        });
        const delivered = new Set(batch.map((m) => m.id));
        this.outbox = this.outbox.filter((m) => !delivered.has(m.id));
        if (this.closed) return;
        status(true);
        failures = 0;
        for (const item of response.messages) {
          const message = parseWire(JSON.stringify(item.payload));
          if (message) await receive(item.sender, message);
          this.cursor = item.id;
        }
      } catch {
        if (!this.closed) status(false);
        failures++;
      } finally {
        this.running = false;
        if (!this.closed)
          this.timer = setTimeout(
            () => void poll(),
            failures ? Math.min(4000, failures * 1000) : this.outbox.length ? 0 : 800,
          );
      }
    };
    this.wake = () => {
      if (this.running || this.closed) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => void poll(), 0);
    };
    this.wake();
    return { close: () => this.close() };
  }

  close() {
    const closing = this.outbox.filter((item) => item.payload.type === 'room.closed');
    if (closing.length && this.roomCode) {
      void fetch(this.endpoint, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: 'exchange',
          code: this.roomCode,
          peerId: this.publicKey,
          token: this.token,
          after: this.cursor,
          messages: closing,
        }),
      }).catch(() => undefined);
    }
    this.closed = true;
    clearTimeout(this.timer);
    this.controller?.abort();
    this.outbox = [];
  }
}

export const browseHttpRooms: typeof import('./RoomDirectory').browseOpenTables = (options) => {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const controller = new AbortController();
  const poll = async () => {
    try {
      const response = await fetch(process.env.NEXT_PUBLIC_DAIFUGO_ROOM_API!, {
        method: 'POST',
        signal: controller.signal,
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'listings' }),
      });
      if (response.ok && !stopped) options.onChange((await response.json()).tables);
    } catch {
      /* Directory availability must not prevent joining an invite. */
    } finally {
      if (!stopped) {
        options.onSettled?.();
        timer = setTimeout(() => void poll(), 15_000);
      }
    }
  };
  void poll();
  return {
    close() {
      stopped = true;
      clearTimeout(timer);
      controller.abort();
    },
  };
};
