'use client';

import { useRef, useState, type CSSProperties } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { orderedHand, type FxEvent } from '@parlour/engine';
import { type FxCue } from '@/lib/table/fx-motion';
import {
  daifugoCatalog,
  DAIFUGO_DECK,
  orderOf,
  MAX_PLAY_SIZE,
  forbiddenFinishReason,
  isJoker,
  type JokerAssignments,
} from '@parlour/game-daifugo';
import { PRESIDENT_SFX_PACK } from '@/lib/audio/sfx';
import { useMatchTension } from '@/lib/audio/tension';
import { DAIFUGO_MATCH_PACE_MS } from '@/lib/daifugo/modes';
import { daifugoHints, matchingHintCards, sameHandSet } from '@/lib/daifugo/hints';
import { isValidLocalSet, type DaifugoTableView } from '@/lib/daifugo/view';
import { useProfileStore } from '@/stores/profile';
import { useMusicMood } from '@/stores/audio';
import { ArrivalProvider, useAdmittedHand } from '@/lib/table/arrival-presentation';
import { type DealPresentation, useDealPresentation } from '@/lib/table/deal-presentation';
import { discardRotation, useTableAudio } from '../fx-animation';
import { HandRail, HandRailCard } from '../HandRail';
import { PlayingCard } from '../PlayingCard';
import { DaifugoJokerChoice, faceLabel } from './DaifugoJokerChoice';
import { useHandSweep } from './useHandSweep';
import {
  dealStateAttr,
  OpponentFan,
  SeatNameplate,
  TableActionRail,
  TableCardFlight,
  TableErrorScreen,
  TableFxLayer,
  TableLoadingScreen,
  TablePlayfield,
  TableScreenFrame,
  TableTurnPop,
  useGameTextSurface,
  useTableMenu,
} from '../shell';
import { DaifugoAvatar } from '@/components/DaifugoAvatar';
import { DaifugoMusicToggle } from '@/components/DaifugoMusicToggle';
import { DaifugoPresentation } from './DaifugoPresentation';
import { DaifugoRuleStatus } from './DaifugoRuleStatus';
import visual from '@/styles/daifugoVisual.module.css';
import tableStyles from '@/styles/table.module.css';
import styles from '@/styles/president.module.css';
import daifugoStyles from '@/styles/daifugo.module.css';

const ROLE_LABELS: Record<string, string> = {
  daifugo: '大富豪',
  vice: '富豪',
  'vice-scum': '貧民',
  scum: '大貧民',
  neutral: '平民',
};

const EMPTY_SELECTION: readonly string[] = [];

export type DaifugoTableScreenProps = {
  view: DaifugoTableView | null;
  fx: readonly FxEvent[];
  fxKey: string | number;
  busy?: boolean;
  error?: string | null;
  /** Confirms the current selection: a set during play, gifts/returns in the exchange. */
  onConfirm?: (cards: readonly string[], jokerAs?: JokerAssignments) => void;
  onPass?: () => void;
  /** Fired only after the player confirms quitting from the shared table menu. */
  onQuit?: () => void;
};

export function DaifugoTableScreen(props: DaifugoTableScreenProps) {
  const { view, error } = props;
  const rootRef = useRef<HTMLElement>(null);
  const menu = useTableMenu(props.onQuit);
  // Selection rides with the fx batch it was made in: a new batch voids it
  // without an effect-driven reset.
  const [selection, setSelection] = useState<{ key: string | number; cards: readonly string[] }>({
    key: props.fxKey,
    cards: [],
  });
  const selected = selection.key === props.fxKey ? selection.cards : EMPTY_SELECTION;
  const [assignments, setAssignments] = useState<{
    key: string | number;
    values: JokerAssignments;
  }>({ key: props.fxKey, values: {} });
  const jokerAs = Object.fromEntries(
    Object.entries(assignments.key === props.fxKey ? assignments.values : {}).filter(([card]) =>
      selected.includes(card),
    ),
  );
  const deal = useDealPresentation(props.fx, props.fxKey);
  useTableAudio(props.fx, props.fxKey, PRESIDENT_SFX_PACK.id);

  // The match has no clock, so the tense cue rides the expected session pace
  // and releases between deals.
  const tense = useMatchTension({
    expectedMs: DAIFUGO_MATCH_PACE_MS,
    running: Boolean(view) && view?.activeSeat !== null,
  });
  useMusicMood(tense ? 'tense' : null);

  const requiredCount = view?.decision?.startsWith('effect-')
    ? (view.pendingEffect?.count ?? 0)
    : view?.decision === 'give'
      ? view.giveCount
      : view?.decision === 'return'
        ? view.returnCount
        : view?.standing && view.decision === 'lead-or-follow'
          ? view.standing.cards.length
          : 0;

  const selectionValid = (() => {
    if (!view || selected.length === 0) return false;
    if (view.decision === 'give') {
      const strongest = view.hand
        .filter((card) => !view.rules.excludeJokersFromExchange || !isJoker(card))
        .map(orderOf)
        .sort((a, b) => b - a)
        .slice(0, view.giveCount);
      const chosen = selected.map(orderOf).sort((a, b) => b - a);
      return (
        (!view.rules.excludeJokersFromExchange || !selected.some(isJoker)) &&
        selected.length === view.giveCount &&
        chosen.every((rank, i) => rank === strongest[i])
      );
    }
    if (view.decision?.startsWith('effect-')) return selected.length === view.pendingEffect?.count;
    if (view.decision === 'return') return selected.length === view.returnCount;
    if (view.decision === 'lead-or-follow') return isValidLocalSet(view, selected, jokerAs);
    return false;
  })();

  const confirmLabel = (() => {
    if (view?.decision === 'effect-give') return `${requiredCount}枚 渡す`;
    if (view?.decision === 'effect-discard') return `${requiredCount}枚 捨てる`;
    if (view?.decision === 'give') return `${requiredCount}枚 渡す`;
    if (view?.decision === 'return') return `${requiredCount}枚 返す`;
    return '出す';
  })();

  useGameTextSurface(() => ({
    game: 'daifugo',
    status: error ? 'error' : view ? (deal.dealing ? 'dealing' : 'ready') : 'loading',
    error,
    localSeat: view?.localSeat ?? null,
    activeSeat: view?.activeSeat ?? null,
    dealNumber: view?.dealNumber ?? null,
    phaseLabel: view?.phaseLabel ?? null,
    decision: view?.decision ?? null,
    standingRank: view?.standing?.rank ?? null,
    pileSize: view ? view.pile.reduce((sum, set) => sum + set.cards.length, 0) : null,
    hand: view
      ? orderedHand(deal.visibleCards(view.hand, view.localSeat), daifugoCatalog.handOrder)
      : [],
    scores: view ? Object.fromEntries(view.players.map((p) => [p.seat, p.score])) : {},
  }));

  const toggleCard = (card: string) => {
    setSelection((current) => {
      const cards = current.key === props.fxKey ? current.cards : EMPTY_SELECTION;
      if (cards.includes(card)) {
        return { key: props.fxKey, cards: cards.filter((entry) => entry !== card) };
      }
      const cap = requiredCount || (view?.rules.stairs ? MAX_PLAY_SIZE : 6);
      if (cards.length >= cap) return { key: props.fxKey, cards };
      return { key: props.fxKey, cards: [...cards, card] };
    });
  };

  const paintCards = (touched: readonly string[], adding: boolean) => {
    setSelection((current) => {
      const cards = current.key === props.fxKey ? current.cards : EMPTY_SELECTION;
      const cap = requiredCount || (view?.rules.stairs ? MAX_PLAY_SIZE : 6);
      const next = adding
        ? [...new Set([...cards, ...touched])].slice(0, cap)
        : cards.filter((card) => !touched.includes(card));
      return { key: props.fxKey, cards: next };
    });
  };

  if (error) {
    return <TableErrorScreen headline="The table lost the thread." message={error} />;
  }

  if (!view) {
    return <TableLoadingScreen copy="Cutting the deck…" />;
  }

  const compactRing = view.players.length > 4;
  const localBusy = (props.busy ?? false) || deal.dealing;
  const hints = daifugoHints(view);
  const hintIndex = hints.findIndex((cards) => sameHandSet(cards, selected));
  const localPosition = view.seatOrder.indexOf(view.localSeat);

  return (
    <ArrivalProvider fx={props.fx} fxKey={props.fxKey} localSeat={view.localSeat}>
      <TableScreenFrame
        rootRef={rootRef}
        className={`${visual.theme} ${visual.board}`}
        dealState={dealStateAttr(deal)}
        menu={menu}
        hud={
          <div className={visual.boardHud}>
            <div className={visual.boardBrand}>
              大富豪<small>DAIFUGO</small>
            </div>
            <p className={visual.boardPhase}>
              {view.phaseLabel.split(' · ').slice(0, 2).join(' · ')}
            </p>
          </div>
        }
      >
        <DaifugoRuleStatus view={view} />
        <TablePlayfield
          label="大富豪のテーブル"
          feltMark="大富豪"
          className={compactRing ? tableStyles.compactRing : undefined}
          seatCount={view.players.length}
        >
          {view.players.map((player) => (
            <Seat
              key={player.seat}
              player={player}
              position={
                (view.seatOrder.indexOf(player.seat) - localPosition + view.players.length) %
                view.players.length
              }
              active={view.activeSeat === player.seat}
              finished={
                view.finishedOrder.includes(player.seat) || Boolean(player.eliminatedReason)
              }
              displayCount={deal.visibleCount(player.seat, player.handCount)}
            />
          ))}
          <CenterPile view={view} deal={deal} />
          <LocalHand
            view={view}
            busy={localBusy}
            selected={selected}
            onToggle={toggleCard}
            onPaint={paintCards}
            selectionEpoch={props.fxKey}
            jokerAs={jokerAs}
            deal={deal}
          />
          <TableFxLayer
            fx={props.fx}
            fxKey={props.fxKey}
            rootRef={rootRef}
            renderCue={(cue) => <Cue cue={cue} localSeat={view.localSeat} />}
          />
        </TablePlayfield>

        <DaifugoPresentation view={view} fx={props.fx} fxKey={props.fxKey} />
        <TableActionRail className={daifugoStyles.actions}>
          <span className={daifugoStyles.order} aria-live="polite" data-testid="daifugo-order">
            手番順：
            {view.seatOrder
              .map((seat) => {
                const player = view.players.find((p) => p.seat === seat);
                return `${player?.name ?? seat}${player?.role ? `（${ROLE_LABELS[player.role]}）` : ''}`;
              })
              .join(' → ')}
          </span>
          {(view.decision === 'give' ||
            view.decision === 'return' ||
            view.decision?.startsWith('effect-')) &&
            !localBusy && (
              <div
                className={`${daifugoStyles.choiceBanner} panel-soft`}
                data-testid="exchange-banner"
              >
                <strong>
                  {view.decision === 'effect-give'
                    ? `7渡し — ${view.pendingEffect?.recipientName ?? '次の人'}へ${requiredCount}枚`
                    : view.decision === 'effect-discard'
                      ? `10捨て — ${requiredCount}枚捨てる`
                      : view.decision === 'give'
                        ? 'カード交換 — 強いカードを渡す'
                        : 'カード交換 — 好きなカードを返す'}
                </strong>
                <span className={styles.exchangeHint}>
                  {view.decision?.startsWith('effect-')
                    ? '手札から好きなカードを選んでください。'
                    : view.decision === 'give'
                      ? view.rules.excludeJokersFromExchange
                        ? 'ジョーカーを除いて、強い順に選んでください。'
                        : '手札から強い順に選んでください。'
                      : '返すカードを選んでください。'}
                </span>
              </div>
            )}
          {view.decision === 'lead-or-follow' &&
            selectionValid &&
            selected.length === view.hand.length &&
            forbiddenFinishReason(view, selected, jokerAs) && (
              <span role="status" className={daifugoStyles.selection}>
                反則上がり：このまま出すと下位になります
              </span>
            )}
          {view.decision?.startsWith('effect-') &&
            view.rules.forbidEffectFinish &&
            requiredCount === view.hand.length && (
              <span role="status" className={daifugoStyles.selection}>
                この効果で上がると反則になります
              </span>
            )}
          {view.decision === 'lead-or-follow' && !localBusy && (
            <div className={visual.handHints}>
              <span aria-live="polite">
                {hints.length === 0
                  ? '今の場に出せる組はありません。パスできます。'
                  : selected.length > 0
                    ? selectionValid
                      ? selected.length === view.hand.length &&
                        forbiddenFinishReason(view, selected, jokerAs)
                        ? 'この組は反則上がりです。出すと下位になります'
                        : `この${selected.length}枚で出せます。「出す」で確定`
                      : '選択中の札だけでは出せません。強調された札を追加するか、選び直してください。'
                    : `出せる組 ${hints.length}通り · 赤線の札が候補`}
              </span>
              <button
                type="button"
                className="btn-fat btn-fat--ghost"
                disabled={hints.length === 0}
                onClick={() => {
                  const next = hints[(hintIndex + 1) % hints.length];
                  if (next) {
                    setSelection({ key: props.fxKey, cards: next });
                    setAssignments({ key: props.fxKey, values: {} });
                  }
                }}
              >
                {hintIndex < 0
                  ? '出せる組を見る'
                  : `次の出せる組 (${hintIndex + 1}/${hints.length})`}
              </button>
            </div>
          )}
          {view.decision === 'lead-or-follow' && !localBusy && (
            <DaifugoJokerChoice
              key={props.fxKey}
              view={view}
              cards={selected}
              jokerAs={jokerAs}
              onChange={(joker, face) => {
                const values = { ...jokerAs };
                if (face) values[joker] = face;
                else delete values[joker];
                setAssignments({ key: props.fxKey, values });
              }}
            />
          )}
          <p className={visual.sweepHint}>なぞって複数選択 · 選択済みからなぞると解除</p>
          {selected.length > 0 && (
            <span className={daifugoStyles.selection} aria-live="polite">
              選択：
              {selected
                .map((card) =>
                  jokerAs[card] ? `JOKER→${faceLabel(jokerAs[card]!)}` : faceLabel(card),
                )
                .join('・')}
            </span>
          )}
          <DaifugoMusicToggle />
          {view.decision === 'lead-or-follow' && (
            <>
              <button
                type="button"
                className="btn-fat"
                disabled={!selectionValid || localBusy}
                onClick={() => {
                  if (selectionValid) {
                    if (view.decision === 'lead-or-follow' && Object.keys(jokerAs).length)
                      props.onConfirm?.(selected, jokerAs);
                    else props.onConfirm?.(selected);
                    setSelection({ key: props.fxKey, cards: [] });
                  }
                }}
              >
                {confirmLabel}
                {selected.length > 0 ? ` (${selected.length})` : ''}
              </button>
              <button
                type="button"
                className="btn-fat btn-fat--ghost"
                disabled={!view.legal.pass || localBusy}
                onClick={props.onPass}
              >
                パス
              </button>
            </>
          )}
          {(view.decision === 'give' ||
            view.decision === 'return' ||
            view.decision?.startsWith('effect-')) && (
            <>
              <span className={styles.selectionCount}>
                選択 {selected.length}/{requiredCount}
              </span>
              <button
                type="button"
                className="btn-fat"
                disabled={!selectionValid || localBusy}
                onClick={() => {
                  if (selectionValid) {
                    if (view.decision === 'lead-or-follow' && Object.keys(jokerAs).length)
                      props.onConfirm?.(selected, jokerAs);
                    else props.onConfirm?.(selected);
                    setSelection({ key: props.fxKey, cards: [] });
                  }
                }}
              >
                {confirmLabel}
              </button>
            </>
          )}
        </TableActionRail>
      </TableScreenFrame>
    </ArrivalProvider>
  );
}

function Seat({
  player,
  position,
  active,
  finished,
  displayCount,
}: {
  player: DaifugoTableView['players'][number];
  position: number;
  active: boolean;
  finished: boolean;
  displayCount: number;
}) {
  const systemReduced = useReducedMotion();
  const profileReduced = useProfileStore((state) => state.settings.reducedMotion);
  const reducedMotion = systemReduced || profileReduced;

  return (
    <motion.div
      layout={!reducedMotion}
      data-seat={player.seat}
      data-active={active}
      data-position={position}
      className={`${visual.seat} ${tableStyles.seat} ${tableStyles[`seat${position}`] ?? ''} ${
        active ? tableStyles.seatActive : ''
      }`}
      animate={active && !reducedMotion ? { scale: [1, 1.06, 1.02] } : { scale: 1 }}
      transition={{ duration: 0.24, ease: [0.34, 1.56, 0.64, 1] }}
    >
      {!player.isLocal && (
        <OpponentFan
          count={displayCount}
          max={4}
          spread={18}
          renderCard={({ rotation }) => (
            <PlayingCard compact faceDown backMark="D" rotation={rotation} />
          )}
        />
      )}
      <DaifugoAvatar
        avatarId={player.avatarId}
        size="clamp(2.6rem, 5vw, 4.4rem)"
        className={`${tableStyles.avatar} ${visual.seatAvatar}`}
      />
      <div className={visual.seatName}>
        <SeatNameplate name={player.name} isBot={player.isBot} />
      </div>
      {player.eliminatedReason && (
        <span className={visual.seatInfo}>{player.eliminatedReason}</span>
      )}
      {player.role && ROLE_LABELS[player.role] && (
        <span
          className={`${styles.roleBadge} ${
            player.role === 'daifugo'
              ? styles.roleBadgeDaifugo
              : player.role === 'scum'
                ? styles.roleBadgeScum
                : ''
          }`}
        >
          {player.role === 'daifugo' ? '♛' : ''} {ROLE_LABELS[player.role]}
        </span>
      )}
      <span className={visual.seatInfo} data-testid={`score-${player.seat}`}>
        {player.handCount} 枚 · {player.score} pt
        {finished ? ' · 上がり' : ''}
      </span>
    </motion.div>
  );
}

function CenterPile({ view, deal }: { view: DaifugoTableView; deal: DealPresentation }) {
  const sets = deal.discardReady ? view.pile : [];
  const standing = view.standing;
  return (
    <div className={styles.pileArea} data-center-pile>
      <div className={styles.pileStack} data-zone="pile">
        {sets.length === 0 && !deal.dealing && (
          <span className={styles.emptyPileHint}>好きな組から</span>
        )}
        {sets.map((set, index) => (
          <div
            key={`${set.rank}-${index}`}
            className={`${styles.pileSet} ${daifugoStyles.pileSet} ${index === sets.length - 1 ? styles.pileSetTop : ''}`}
            style={{ '--pile-count': set.cards.length } as CSSProperties}
          >
            {set.cards.map((card, cardIndex) => (
              <PlayingCard
                key={card}
                card={card}
                face={card.startsWith('J') ? DAIFUGO_DECK.faces[card] : undefined}
                rotation={
                  set.cards.length > 4
                    ? 0
                    : index === sets.length - 1
                      ? discardRotation(card, cardIndex)
                      : (cardIndex - set.cards.length / 2) * 6
                }
              />
            ))}
          </div>
        ))}
      </div>
      {standing?.effectiveCards && standing.cards.some(isJoker) && (
        <span className={visual.jokerPileMeaning}>
          代用後：{standing.effectiveCards.map(faceLabel).join('・')}
        </span>
      )}
      {standing && (
        <span className={styles.rankChip} data-testid="standing-chip">
          {standing.kind === 'run' ? '階段 ' : ''}
          {standing.rank === 16
            ? 'JOKER'
            : standing.rank === 14
              ? 'A'
              : standing.rank === 15
                ? '2'
                : standing.rank === 11
                  ? 'J'
                  : standing.rank === 12
                    ? 'Q'
                    : standing.rank === 13
                      ? 'K'
                      : standing.rank}{' '}
          · {standing.cards.length}枚
        </span>
      )}
    </div>
  );
}

function LocalHand({
  view,
  busy,
  selected,
  onToggle,
  onPaint,
  selectionEpoch,
  jokerAs,
  deal,
}: {
  view: DaifugoTableView;
  busy: boolean;
  selected: readonly string[];
  onToggle: (card: string) => void;
  onPaint: (cards: readonly string[], selected: boolean) => void;
  selectionEpoch: string | number;
  jokerAs: JokerAssignments;
  deal: DealPresentation;
}) {
  const plannedHand = orderedHand(
    deal.visibleCards(view.hand, view.localSeat),
    daifugoCatalog.handOrder,
  );
  const visibleHand = useAdmittedHand(plannedHand);
  const exchanging =
    view.decision === 'give' || view.decision === 'return' || view.decision?.startsWith('effect-');
  const canPick = !busy && (exchanging || view.decision === 'lead-or-follow');
  const showLegality = !busy && view.decision === 'lead-or-follow';
  const matching = matchingHintCards(view, selected, jokerAs);
  const sweep = useHandSweep({ enabled: canPick, epoch: selectionEpoch, selected, onPaint });

  return (
    <div className={visual.handSweep} {...sweep}>
      <HandRail
        count={visibleHand.length}
        zone={`hand:${view.localSeat}`}
        label="あなたの手札。なぞって複数選択、選択済みからなぞると解除"
        dealState={dealStateAttr(deal)}
        fanPlan={plannedHand}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {visibleHand.map((card, index) => {
            const playable = matching.has(card);
            const exchangeExcluded =
              view.decision === 'give' && view.rules.excludeJokersFromExchange && isJoker(card);
            const isSelected = selected.includes(card);
            return (
              <HandRailCard
                key={card}
                cardId={card}
                index={index}
                count={visibleHand.length}
                playable={showLegality ? playable || isSelected : undefined}
              >
                <PlayingCard
                  card={card}
                  face={card.startsWith('J') ? DAIFUGO_DECK.faces[card] : undefined}
                  disabled={!canPick || exchangeExcluded}
                  selected={isSelected}
                  rotation={isSelected ? -4 : 0}
                  actionLabel={
                    isSelected
                      ? '選択解除'
                      : showLegality && playable
                        ? '選択（出せる組の候補）'
                        : '選択'
                  }
                  onClick={() => canPick && !exchangeExcluded && onToggle(card)}
                />
              </HandRailCard>
            );
          })}
        </AnimatePresence>
      </HandRail>
    </div>
  );
}

function Cue({ cue, localSeat }: { cue: FxCue; localSeat: number }) {
  if (cue.type === 'deal' || cue.type === 'flip' || cue.type === 'draw' || cue.type === 'discard') {
    const faceDown =
      (cue.type === 'deal' && cue.to !== `hand:${localSeat}` && cue.to !== 'discard') ||
      (cue.type === 'draw' && cue.to !== `hand:${localSeat}`);
    return (
      <TableCardFlight cueId={cue.id}>
        <PlayingCard
          card={cue.card}
          face={cue.card?.startsWith('J') ? DAIFUGO_DECK.faces[cue.card] : undefined}
          faceDown={faceDown}
          backMark="D"
        />
      </TableCardFlight>
    );
  }
  if (cue.type === 'turn') {
    return <TableTurnPop cueId={cue.id} seat={cue.seat} />;
  }
  return null;
}
