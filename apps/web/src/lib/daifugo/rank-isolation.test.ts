import { describe, it, expect } from 'vitest';
import { createSession, makeRng, stateHash } from '@parlour/engine';
import {
  daifugoGame,
  daifugoConfig,
  daifugoBots,
  previousRoleFor,
  recordDealResult,
} from '@parlour/game-daifugo';
import { EngineAuthority } from '../multiplayer/EngineAuthority';
import { daifugoTableView } from './view';

const players = [0, 1, 2, 3].map((seat) => ({
  seat,
  name: `P${seat}`,
  avatarId: 'ember',
  isBot: seat >= 2,
}));
describe('online Daifugo committed places', () => {
  it.each(['fixed', 'random', 'rank', 'rank-ascending'])(
    '%s preserves each player’s place through packets, reconnect and host migration',
    (seatOrder) => {
      const config = daifugoConfig.resolve({ seatOrder, targetPoints: 40 });
      const peers = [0, 1, 2, 3].map(
        () =>
          new EngineAuthority({
            def: daifugoGame,
            settings: { gameId: 'daifugo', seats: 4, config },
            session: createSession(daifugoGame, { seed: 7, seats: 4, config }),
          }),
      );
      let host = 0;
      let finished: number[] = [];
      let transitions = 0;
      for (let step = 0; step < 2000 && transitions < 2; step++) {
        const live = peers[host]!.getSession();
        const seat = live.phase.actor!;
        const legal = daifugoGame.flow.legalMovesFor!(live.state, live.phase, seat);
        const move = daifugoBots[2]!.chooseMove(
          daifugoGame.playerView(live.state, seat),
          seat,
          legal,
          makeRng(step),
          { thinkMs: () => 0 },
        )!;
        const packet = peers[host]!.apply({
          id: `a-${step}`,
          seat,
          move: move.id,
          payload: move.payload,
        });
        for (const peer of peers.filter((_, index) => index !== host)) {
          const result = peer.applyRemote(JSON.parse(JSON.stringify(packet)));
          expect(result.accepted).toBe(true);
          expect(result.fault).toBeNull();
        }
        for (const fx of packet.fx)
          if (fx.kind === 'daifugo.out') finished.push((fx.payload as { seat: number }).seat);
        const next = peers[host]!.getSession();
        if (next.state.deal === live.state.deal) continue;
        transitions++;
        for (let localSeat = 0; localSeat < peers.length; localSeat++) {
          const session = peers[localSeat]!.getSession();
          finished.forEach((player, index) =>
            expect(session.state.lastResult?.placeBySeat[player]).toBe(index + 1),
          );
          expect(previousRoleFor(session.state, finished[0]!)).toBe('daifugo');
          const view = daifugoTableView(
            { session, mode: 'local', matchWinner: null, players: [...players].reverse() },
            [],
            localSeat,
          );
          expect(view.players.find((p) => p.seat === finished[0])?.role).toBe('daifugo');
          expect(stateHash(session.state)).toBe(stateHash(next.state));
        }
        // A different authority resumes from the serialized host snapshot.
        const successor = (host + 1) % 4;
        peers[successor]!.importSnapshot(JSON.parse(JSON.stringify(peers[host]!.exportSnapshot())));
        expect(peers[successor]!.getSession().state.lastResult).toEqual(next.state.lastResult);
        host = successor;
        finished = [];
      }
      expect(transitions).toBe(2);
    },
  );

  it('renders roles by stable player id even when seating, roster and legacy ranks are reversed', () => {
    const session = createSession(daifugoGame, {
      seed: 7,
      seats: 4,
      config: daifugoConfig.defaults(),
    });
    session.state = {
      ...session.state,
      lastResult: recordDealResult(0, 4, [2, 0, 3, 1]),
      lastOrder: [1, 3, 0, 2],
      seatOrder: [1, 3, 0, 2],
    };
    for (const localSeat of [0, 1, 2, 3]) {
      const view = daifugoTableView(
        { session, mode: 'local', matchWinner: null, players: [...players].reverse() },
        [],
        localSeat,
      );
      expect(view.players.map((p) => [p.seat, p.role])).toEqual([
        [3, 'vice-scum'],
        [2, 'daifugo'],
        [1, 'scum'],
        [0, 'vice'],
      ]);
    }
  });
});
