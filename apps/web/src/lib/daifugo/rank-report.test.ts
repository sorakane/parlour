import { describe, expect, it } from 'vitest';
import { createSession, makeRng, sessionApply } from '@parlour/engine';
import { daifugoGame, daifugoConfig, daifugoBots } from '@parlour/game-daifugo';
import { daifugoRankReport } from './rank-report';

const players = [0, 1, 2, 3].map((seat) => ({ seat, name: `P${seat}` }));
describe('rank records are independent of turn order', () => {
  it.each(['fixed', 'random', 'rank', 'rank-ascending'])(
    '%s keeps actual finish events and player ranks',
    (seatOrder) => {
      let session = createSession(daifugoGame, {
        seed: 7,
        seats: 4,
        config: daifugoConfig.resolve({ seatOrder, targetPoints: 40 }),
      });
      const finished: number[] = [];
      for (let step = 0; session.state.deal === 0 && step < 1000; step++) {
        const seat = session.phase.actor!;
        const legal = daifugoGame.flow.legalMovesFor!(session.state, session.phase, seat);
        const move = daifugoBots[2]!.chooseMove(
          daifugoGame.playerView(session.state, seat),
          seat,
          legal,
          makeRng(step),
          { thinkMs: () => 0 },
        )!;
        const result = sessionApply(daifugoGame, session, seat, move.id, move.payload);
        expect(result.rejected).toBeFalsy();
        for (const event of result.fx)
          if (event.kind === 'daifugo.out') finished.push((event.payload as { seat: number }).seat);
        session = result.session;
      }
      expect(session.state.deal).toBe(1);
      const report = daifugoRankReport(session, players, 2);
      expect(report.verified).toBe(true);
      expect(
        report.events.filter((event) => event.kind === 'finish').map((event) => event.seat),
      ).toEqual(finished);
      expect(report.previousRanks[0]).toMatchObject({ seat: finished[0], rank: 1, role: '大富豪' });
      expect(report.previousRanks[3]).toMatchObject({ rank: 4, role: '大貧民' });
      expect(report.turnOrder.map((player) => player.seat)).toEqual(session.state.seatOrder);
      const serialized = JSON.stringify(report);
      expect(serialized).not.toContain('"seed"');
      expect(serialized).not.toContain('"hands"');
      expect(serialized).not.toContain('"payload"');
    },
  );
  it('reports a mismatch rather than claiming a changed ranking is verified', () => {
    const session = createSession(daifugoGame, {
      seed: 7,
      seats: 4,
      config: daifugoConfig.defaults(),
    });
    session.state = { ...session.state, lastOrder: [3, 2, 1, 0] };
    expect(daifugoRankReport(session, players, 0).verified).toBe(false);
  });
});
