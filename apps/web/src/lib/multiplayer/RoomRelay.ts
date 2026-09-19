import type { RoomSignaling } from './NostrSignaling';
import type { WireMessage } from './wireSchema';

/** Authenticated HTTPS message delivery; no ICE, STUN, TURN or WebRTC. */
export interface RoomRelay extends RoomSignaling {
  readonly delivery: 'https';
  sendMessage(code: string, recipient: string, message: WireMessage): void;
  subscribeMessages(
    code: string,
    receive: (sender: string, message: WireMessage) => Promise<void>,
    status: (connected: boolean) => void,
  ): { close(): void };
}

export function isRoomRelay(signaling: RoomSignaling): signaling is RoomRelay {
  return 'delivery' in signaling && signaling.delivery === 'https';
}
