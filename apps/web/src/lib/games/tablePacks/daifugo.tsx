'use client';

import type { DaifugoRules, DaifugoState } from '@parlour/game-daifugo';
import { DaifugoTableScreen } from '@/components/table/daifugo/DaifugoTableScreen';
import { defineTablePack, turnBasedDriver } from '@/components/table/GameTablePage';
import { daifugoModeForRules } from '@/lib/daifugo/modes';
import { daifugoTableView, daifugoConfirmMove } from '@/lib/daifugo/view';
import { roomMatchId } from '@/lib/table/useMatchReport';
import {
  DaifugoTransport,
  type DaifugoDispatch,
  type DaifugoSnapshot,
} from '@/lib/solo/DaifugoTransport';
import { botKey, friendKey } from '@/stores/history';
import { useProfileStore } from '@/stores/profile';
import { daifugoRulesFor, useDaifugoSetupStore } from '@/stores/daifugoSetup';

/** The rank parade runs past the usual beat before the podium takes over. */
const PODIUM_DELAY_MS = 1400;

function localLegalMoves(snapshot: DaifugoSnapshot) {
  const { session } = snapshot;
  if (session.status !== 'playing') return [];
  return (
    session.def.flow.legalMovesFor?.(session.state, session.phase, 0) ??
    session.def.flow.legalMoves(session.state, session.phase)
  );
}

export const daifugoTablePack = defineTablePack<
  DaifugoSnapshot,
  DaifugoDispatch,
  DaifugoTransport,
  DaifugoState,
  DaifugoRules
>({
  id: 'daifugo',
  gameId: 'daifugo',

  useSoloDeal() {
    const mode = useDaifugoSetupStore((state) => state.mode);
    const seats = useDaifugoSetupStore((state) => state.seats);
    const overrides = useDaifugoSetupStore((state) => state.overrides);
    const botTier = useDaifugoSetupStore((state) => state.botTier);
    const name = useProfileStore((state) => state.name);
    const avatarId = useProfileStore((state) => state.avatarId);
    return {
      create: () =>
        new DaifugoTransport({
          mode,
          rules: daifugoRulesFor(mode, overrides),
          seats,
          seed: Date.now() | 0,
          player: { name, avatarId },
          botTier,
        }),
      deps: [avatarId, botTier, mode, name, overrides, seats],
    };
  },

  useSoloDriver: turnBasedDriver({
    round: (snapshot) => snapshot.session,
  }),

  renderPending: ({ fx, fxKey, error }) => (
    <DaifugoTableScreen view={null} fx={fx} fxKey={fxKey} error={error} />
  ),

  renderSolo({ snapshot, fx, fxKey, error, dispatch, quit }) {
    const actingLocally =
      snapshot.session.status === 'playing' &&
      ((snapshot.session.phase.actors ?? []).includes(0) || snapshot.session.phase.actor === 0);

    return (
      <DaifugoTableScreen
        view={daifugoTableView(snapshot, actingLocally ? localLegalMoves(snapshot) : [])}
        fx={fx}
        fxKey={fxKey}
        busy={!actingLocally}
        error={error}
        onConfirm={(cards) => dispatch(daifugoConfirmMove(snapshot.session.phase.phase), { cards })}
        onPass={() => dispatch('pass')}
        onQuit={quit}
      />
    );
  },

  soloReport({ snapshot, push }) {
    if (snapshot.matchWinner === null || !snapshot.session.result) return null;
    return {
      id: crypto.randomUUID(),
      game: 'daifugo',
      mode: snapshot.mode,
      result: snapshot.session.result,
      localSeat: 0,
      won: snapshot.matchWinner === 0,
      podiumDelayMs: PODIUM_DELAY_MS,
      seats: snapshot.players.map((player) => ({
        seat: player.seat,
        name: player.name,
        avatarId: player.avatarId,
        kind: player.isBot ? ('bot' as const) : ('friend' as const),
        key: player.isBot ? botKey(player.name.toLowerCase()) : friendKey('local-daifugo-player'),
      })),
      onPlayAgain: () => push('/daifugo/table'),
      onFinish: () => push('/match-end'),
    };
  },

  renderRoom({ session, snapshot, localSeat, error, dispatch, quit }) {
    const isLocalActing =
      session.status === 'playing' &&
      ((session.phase.actors ?? []).includes(localSeat) || session.phase.actor === localSeat);
    const legal = isLocalActing
      ? (session.def.flow.legalMovesFor?.(session.state, session.phase, localSeat) ?? [])
      : [];
    const snapshotView: DaifugoSnapshot = {
      mode: daifugoModeForRules(session.config as DaifugoRules),
      players: snapshot.seats.map((player) => ({
        seat: player.seat,
        name: player.name,
        avatarId: player.avatarId,
        isBot: player.bot,
      })),
      session,
      matchWinner: session.result?.winner ?? null,
    };

    return (
      <DaifugoTableScreen
        view={daifugoTableView(snapshotView, legal, localSeat)}
        fx={snapshot.fx}
        fxKey={snapshot.fxKey}
        busy={!isLocalActing}
        error={error}
        onConfirm={(cards) => dispatch(daifugoConfirmMove(session.phase.phase), { cards })}
        onPass={() => dispatch('pass')}
        onQuit={quit}
      />
    );
  },

  roomReport({ session, snapshot, localSeat }) {
    if (!session.result) return null;
    return {
      id: roomMatchId(
        snapshot.room?.code,
        session.seed,
        session.lastAppliedHash ?? session.log.length,
      ),
      game: 'daifugo',
      mode: daifugoModeForRules(session.config as DaifugoRules),
      result: session.result,
      localSeat,
      won: session.result.winner === localSeat,
      podiumDelayMs: PODIUM_DELAY_MS,
      seats: snapshot.seats.map((seat) => ({
        seat: seat.seat,
        name: seat.name,
        avatarId: seat.avatarId,
        kind: 'friend' as const,
        key: friendKey(seat.profileId),
      })),
    };
  },
});
