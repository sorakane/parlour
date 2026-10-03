import { createSession, sessionApply, stateHash, type GameSession } from '@parlour/engine';
import {
  completedResult,
  previousFinishOrder,
  previousRoleFor,
  type DaifugoRules,
  type DaifugoState,
} from '@parlour/game-daifugo';

export const DAIFUGO_ROLE_LABELS: Record<string, string> = {
  daifugo: '大富豪',
  vice: '富豪',
  neutral: '平民',
  'vice-scum': '貧民',
  scum: '大貧民',
};
type Player = { seat: number; name: string };
export interface RankEvent {
  game: number;
  sequence: number;
  seat: number;
  name: string;
  kind: 'finish' | 'eliminated' | 'rank';
  detail: string;
}

/** Reconstruct public ranking decisions without exporting seeds, hands, or exchange cards. */
export function daifugoRankReport(
  session: GameSession<DaifugoState, DaifugoRules>,
  players: readonly Player[],
  localSeat: number,
) {
  const name = (seat: number) =>
    players.find((player) => player.seat === seat)?.name ?? `席${seat + 1}`;
  let replay = createSession(session.def, {
    seed: session.seed,
    seats: session.seats,
    config: session.config,
  });
  const events: RankEvent[] = [];
  let error: string | null = null;
  for (const event of session.log) {
    if (event.seq < replay.log.length) continue; // Already applied as an automatic move.
    if (event.automatic || event.injected || event.seat === null) {
      error = `記録${event.seq}の再確認に対応していません。`;
      break;
    }
    const game = replay.state.deal + 1;
    const result = sessionApply(session.def, replay, event.seat, event.move, event.payload, {
      atMs: event.atMs,
      reveals: event.reveals,
      recycle: event.recycle,
    });
    if (result.rejected) {
      error = `記録${event.seq}：${result.rejected.message}`;
      break;
    }
    for (const fx of result.fx) {
      const payload = fx.payload as {
        seat?: number;
        place?: number;
        role?: string;
        reason?: string;
      };
      if (typeof payload?.seat !== 'number') continue;
      const common = { game, sequence: event.seq, seat: payload.seat, name: name(payload.seat) };
      if (fx.kind === 'daifugo.out')
        events.push({ ...common, kind: 'finish', detail: `${payload.place}位で上がり` });
      if (fx.kind === 'daifugo.eliminated')
        events.push({ ...common, kind: 'eliminated', detail: payload.reason ?? '降格' });
      if (fx.kind === 'daifugo.role')
        events.push({
          ...common,
          kind: 'rank',
          detail: DAIFUGO_ROLE_LABELS[payload.role ?? ''] ?? '未確定',
        });
    }
    replay = result.session;
  }
  const observedHash = stateHash(session.state);
  const replayHash = stateHash(replay.state);
  return {
    format: 'daifugo-rank-report-v1',
    game: session.state.deal + 1,
    rankedGame: completedResult(session.state) ? completedResult(session.state)!.deal + 1 : null,
    localSeat,
    rules: session.config,
    players: players.map(({ seat, name }) => ({ seat, name })),
    events,
    previousRanks: (previousFinishOrder(session.state) ?? []).map((seat, index) => ({
      seat,
      name: name(seat),
      rank: index + 1,
      role: DAIFUGO_ROLE_LABELS[previousRoleFor(session.state, seat)!],
    })),
    turnOrder: session.state.seatOrder.map((seat) => ({ seat, name: name(seat) })),
    verified: !error && replay.log.length === session.log.length && observedHash === replayHash,
    observedHash,
    replayHash,
    error,
  };
}
