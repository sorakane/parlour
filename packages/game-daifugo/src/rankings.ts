import type { SeatId } from '@parlour/engine';
import type { DaifugoDealResult, DaifugoRole, DaifugoState } from './state';

/** Commit once at the end of a deal, before any next-deal seating takes place. */
export function recordDealResult(
  deal: number,
  seats: number,
  finishOrder: readonly SeatId[],
): DaifugoDealResult {
  if (
    finishOrder.length !== seats ||
    new Set(finishOrder).size !== seats ||
    finishOrder.some((seat) => !Number.isInteger(seat) || seat < 0 || seat >= seats)
  )
    throw new Error('Cannot record incomplete or duplicate Daifugo places');
  const placeBySeat: Record<SeatId, number> = {};
  finishOrder.forEach((seat, index) => {
    placeBySeat[seat] = index + 1;
  });
  return Object.freeze({ deal, placeBySeat: Object.freeze(placeBySeat) });
}

/** Legacy snapshots are converted before reseating; new games use lastResult only. */
export function completedResult(state: DaifugoState): DaifugoDealResult | null {
  if (state.lastResult) return state.lastResult;
  if (!state.lastOrder) return null;
  return recordDealResult(
    state.finished.length === state.seats ? state.deal : state.deal - 1,
    state.seats,
    state.lastOrder,
  );
}

/** Always returns a fresh derived list. Sorting it cannot alter anyone's place. */
export function previousFinishOrder(state: DaifugoState): SeatId[] | null {
  const result = completedResult(state);
  return result
    ? Object.keys(result.placeBySeat)
        .map(Number)
        .sort((a, b) => result.placeBySeat[a]! - result.placeBySeat[b]!)
    : null;
}

export function roleForPlace(place: number, seats: number): DaifugoRole | null {
  if (!Number.isInteger(place) || place < 1 || place > seats) return null;
  if (place === 1) return 'daifugo';
  if (place === 2) return 'vice';
  if (place === seats) return 'scum';
  if (place === seats - 1) return 'vice-scum';
  return 'neutral';
}

export function previousRoleFor(state: DaifugoState, seat: SeatId): DaifugoRole | null {
  const place = completedResult(state)?.placeBySeat[seat];
  return place === undefined ? null : roleForPlace(place, state.seats);
}
