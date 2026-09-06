import { stateHash, makeRng } from '@parlour/engine';
import {
  daifugoConfig,
  daifugoBots,
  type DaifugoState,
  type DaifugoRules,
} from '@parlour/game-daifugo';
import { afterEach, describe, expect, it } from 'vitest';
import { NostrSignaling, type SignalPayload } from '@/lib/multiplayer/NostrSignaling';
import type { RoomSettings } from '@/lib/multiplayer/types';
import { MultiplayerRoomSession, multiplayerSession } from './roomSession';
type SignalHandler = (sender: string, signal: SignalPayload) => void;

/**
 * A real Nostr pubkey is 32 bytes of hex, and host-bound invites validate that
 * shape before pinning it. The fixture names its seats for readability, so map
 * each label to a deterministic well-formed key: the mock then feeds the same
 * kind of input production does, instead of a short string that only passes
 * because nothing was checking.
 */
function mockPubkey(label: string): string {
  let hash = 2166136261 >>> 0;
  let out = '';
  for (let chunk = 0; chunk < 8; chunk++) {
    for (const char of `${label}:${chunk}`) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    out += (hash >>> 0).toString(16).padStart(8, '0');
  }
  return out;
}

class MockSignalingBroker {
  readonly rooms = new Map<string, { hostPubkey: string; settings: RoomSettings }>();
  readonly handlers = new Map<string, Map<string, SignalHandler>>();

  constructor(private readonly letWireSettleBeforeSendReturns = false) {}

  signaling(label: string): NostrSignaling {
    const broker = this;
    const publicKey = mockPubkey(label);
    return {
      publicKey,
      async announce(code: string, settings: RoomSettings) {
        broker.rooms.set(code, { hostPubkey: publicKey, settings });
      },
      async resolve(code: string, expectedHost?: string) {
        const room = broker.rooms.get(code);
        if (!room) throw new Error('Room not found');
        // Mirrors the real signaling contract: a host-bound invite refuses an
        // announcement authored by anyone but the pinned host.
        if (expectedHost !== undefined && room.hostPubkey !== expectedHost) {
          throw new Error('Room host does not match this invite');
        }
        return room;
      },
      subscribe(code: string, callback: SignalHandler) {
        const roomHandlers = broker.handlers.get(code) ?? new Map<string, SignalHandler>();
        roomHandlers.set(publicKey, callback);
        broker.handlers.set(code, roomHandlers);
        return { close: () => roomHandlers.delete(publicKey) };
      },
      async send(code: string, recipient: string, signal: SignalPayload) {
        queueMicrotask(() => broker.handlers.get(code)?.get(recipient)?.(publicKey, signal));
        if (broker.letWireSettleBeforeSendReturns) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      },
      close() {},
    } as unknown as NostrSignaling;
  }
}

class MockDataChannel {
  readyState: RTCDataChannelState = 'connecting';
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  peer?: MockDataChannel;

  send(data: string) {
    queueMicrotask(() => this.peer?.onmessage?.(new MessageEvent('message', { data })));
  }

  open() {
    this.readyState = 'open';
    this.onopen?.();
  }
}

class MockRtcNetwork {
  private nextId = 0;
  private readonly peers = new Map<string, MockPeerConnection>();

  factory(owner: string) {
    return () => {
      const peer = new MockPeerConnection(`${owner}-${this.nextId++}`, this);
      this.peers.set(peer.id, peer);
      return peer as unknown as RTCPeerConnection;
    };
  }

  get(id: string) {
    return this.peers.get(id)!;
  }
}

class MockPeerConnection {
  connectionState: RTCPeerConnectionState = 'new';
  remoteDescription: RTCSessionDescription | null = null;
  onicecandidate: RTCPeerConnection['onicecandidate'] = null;
  ondatachannel: RTCPeerConnection['ondatachannel'] = null;
  onconnectionstatechange: RTCPeerConnection['onconnectionstatechange'] = null;
  private outgoing?: MockDataChannel;
  private initiator?: MockPeerConnection;

  constructor(
    readonly id: string,
    private readonly network: MockRtcNetwork,
  ) {}

  createDataChannel() {
    this.outgoing = new MockDataChannel();
    return this.outgoing as unknown as RTCDataChannel;
  }

  async createOffer() {
    return { type: 'offer' as const, sdp: this.id };
  }

  async createAnswer() {
    if (!this.initiator?.outgoing) throw new Error('offer did not include a data channel');
    const incoming = new MockDataChannel();
    incoming.peer = this.initiator.outgoing;
    this.initiator.outgoing.peer = incoming;
    const onDataChannel = this.ondatachannel as ((event: RTCDataChannelEvent) => void) | null;
    onDataChannel?.({ channel: incoming as unknown as RTCDataChannel } as RTCDataChannelEvent);
    queueMicrotask(() => {
      incoming.open();
      this.initiator?.outgoing?.open();
    });
    return { type: 'answer' as const, sdp: this.id };
  }

  async setLocalDescription() {}

  async setRemoteDescription(description: RTCSessionDescriptionInit) {
    this.remoteDescription = description as RTCSessionDescription;
    if (description.type === 'offer' && description.sdp) {
      this.initiator = this.network.get(description.sdp);
    }
  }

  async addIceCandidate() {}
  close() {
    this.connectionState = 'closed';
  }
}

async function eventually(assertion: () => void, attempts = 500, delayMs = 10) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      assertion();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  assertion();
}

describe('Daifugo room recovery', () => {
  const opened: MultiplayerRoomSession[] = [];
  afterEach(() => opened.splice(0).forEach((peer) => peer.close()));
  it('synchronizes moves, reclaims a reloaded guest, and migrates the host without losing the event log', async () => {
    const broker = new MockSignalingBroker();
    const rtc = new MockRtcNetwork();
    const open = (seat: number, suffix = '') => {
      const peer = new MultiplayerRoomSession(
        { name: `P${seat}`, avatarId: 'ember', profileId: `daifugo-${seat}` },
        {
          signaling: broker.signaling(`daifugo-${seat}${suffix}`),
          peerConnection: rtc.factory(`daifugo-${seat}${suffix}`),
          seed: 4242,
          heartbeatIntervalMs: 100,
          heartbeatTimeoutMs: 5000,
          reconnectGraceMs: 30000,
        },
      );
      opened.push(peer);
      return peer;
    };
    const peers = [0, 1, 2, 3].map((seat) => open(seat));
    const host = peers[0]!;
    const room = await host.create({
      gameId: 'daifugo',
      seats: 4,
      config: daifugoConfig.resolve({ seatOrder: 'random', fiveSkip: true, targetPoints: 40 }),
    });
    for (let seat = 1; seat < 4; seat++) {
      await peers[seat]!.join(room.code);
      await eventually(() => expect(peers[seat]!.getSnapshot().localSeat).toBe(seat));
    }
    await host.start();
    await eventually(() =>
      expect(peers.every((p) => p.getSnapshot().stage === 'table')).toBe(true),
    );
    const live = (peer: MultiplayerRoomSession) =>
      multiplayerSession<DaifugoState, DaifugoRules>(peer.getSnapshot(), 'daifugo')!;
    const synced = async (group = peers) =>
      eventually(() => {
        expect(group.map((p) => p.getSnapshot().error)).toEqual(group.map(() => null));
        expect(new Set(group.map((p) => stateHash(live(p).state))).size).toBe(1);
        expect(new Set(group.map((p) => live(p).log.length)).size).toBe(1);
      });
    for (let step = 0; step < 18; step++) {
      await synced();
      const state = live(host);
      const actor = state.phase.actor!;
      const legal = state.def.flow.legalMovesFor!(state.state, state.phase, actor);
      const choice = daifugoBots[2]!.chooseMove(
        state.def.playerView(state.state, actor),
        actor,
        legal,
        makeRng(step),
        { thinkMs: () => 0 },
      )!;
      const count = state.log.length;
      peers[actor]!.send(choice.id, choice.payload);
      await eventually(() => expect(live(host).log.length).toBeGreaterThan(count));
    }
    await synced();
    // A fresh page/session uses the same profile, not a duplicate chair.
    const beforeReload = live(host).log.map((event) => event.hash);
    peers[1]!.close();
    await eventually(() => expect(host.getSnapshot().seats[1]!.connected).toBe(false));
    const returned = open(1, '-reload');
    peers[1] = returned;
    await returned.join(room.code);
    await eventually(() => expect(returned.getSnapshot().localSeat).toBe(1));
    await synced();
    expect(host.getSnapshot().seats.filter((s) => s.profileId === 'daifugo-1')).toHaveLength(1);
    expect(
      live(returned)
        .log.slice(0, beforeReload.length)
        .map((event) => event.hash),
    ).toEqual(beforeReload);
    const beforeMigration = live(host).log.map((event) => event.hash);
    host.close();
    const survivors = peers.slice(1);
    await eventually(
      () => expect(survivors.filter((p) => p.getSnapshot().isHost)).toHaveLength(1),
      1500,
      10,
    );
    await synced(survivors);
    for (const peer of survivors) {
      expect(peer.getSnapshot().stage).toBe('table');
      expect(
        live(peer)
          .log.slice(0, beforeMigration.length)
          .map((event) => event.hash),
      ).toEqual(beforeMigration);
    }
    const elected = survivors.find((p) => p.getSnapshot().isHost)!;
    const length = live(elected).log.length;
    // Wait for migration and the reclaimed profile bindings before sending once.
    await eventually(() => {
      for (const peer of survivors) {
        const snapshot = peer.getSnapshot();
        expect(snapshot.seats[snapshot.localSeat!]?.connected).toBe(true);
      }
    });
    const game = live(elected);
    const actor = game.phase.actor!;
    if (actor !== 0) {
      const sender = survivors.find((peer) => peer.getSnapshot().localSeat === actor)!;
      expect(sender).toBeDefined();
      const legal = game.def.flow.legalMovesFor!(game.state, game.phase, actor);
      const choice = daifugoBots[2]!.chooseMove(
        game.def.playerView(game.state, actor),
        actor,
        legal,
        makeRng(7),
        { thinkMs: () => 0 },
      )!;
      sender.send(choice.id, choice.payload);
    }
    await eventually(() => expect(live(elected).log.length).toBeGreaterThan(length), 4000, 10);
    await synced(survivors);
  }, 60000);
});
