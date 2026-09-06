import { applyPreset, createSession, type GameSession, type LegalMove } from '@parlour/engine';
import {
  daifugoGame,
  daifugoBots,
  MIN_SEATS,
  MAX_SEATS,
  type DaifugoRules,
  type DaifugoState,
} from '@parlour/game-daifugo';
import type { DaifugoModeId } from '@/lib/daifugo/modes';
import type { BotTier } from '@/stores/setup';
import {
  adaptSessionApply,
  sessionLegalMoves,
  SoloAuthority,
  type SoloDispatch,
} from './SoloAuthority';
import { localSeat } from './seating';

/** House opponents — names match the avatar cast so the table reads cohesively. */
const DAIFUGO_BOTS = [
  { name: 'Marigold', avatarId: 'marigold' },
  { name: 'Slate', avatarId: 'slate' },
  { name: 'Juniper', avatarId: 'juniper' },
  { name: 'Cobalt', avatarId: 'cobalt' },
  { name: 'Plum', avatarId: 'plum' },
  { name: 'Rust', avatarId: 'rust' },
  { name: 'Mint', avatarId: 'mint' },
] as const;

export interface DaifugoPlayer {
  seat: number;
  name: string;
  avatarId: string;
  isBot: boolean;
}

export interface DaifugoTransportOptions {
  mode: DaifugoModeId;
  /** Fully resolved table rules. Defaults to the mode's preset when omitted. */
  rules?: DaifugoRules;
  seats: number;
  seed: number;
  player: { name: string; avatarId: string };
  botTier?: BotTier;
}

export interface DaifugoSnapshot {
  mode: DaifugoModeId;
  players: readonly DaifugoPlayer[];
  session: GameSession<DaifugoState, DaifugoRules>;
  matchWinner: number | null;
}

export type DaifugoDispatch = SoloDispatch<DaifugoSnapshot>;

/**
 * In-process authority for solo Daifugo. One deterministic multi-deal match
 * of @parlour/game-daifugo against house bots; this facade projects seats
 * and snapshots onto the shared session authority.
 */
export class DaifugoTransport {
  private readonly def = daifugoGame;
  private readonly options: DaifugoTransportOptions;
  private readonly authority: SoloAuthority<
    GameSession<DaifugoState, DaifugoRules>,
    DaifugoSnapshot,
    DaifugoState
  >;

  constructor(options: DaifugoTransportOptions) {
    if (
      !Number.isInteger(options.seats) ||
      options.seats < MIN_SEATS ||
      options.seats > MAX_SEATS
    ) {
      throw new Error(`daifugo requires ${MIN_SEATS}–${MAX_SEATS} seats`);
    }
    this.options = options;
    const policy = daifugoBots[(options.botTier ?? 2) - 1]!;
    const session = createSession(this.def, {
      seed: options.seed | 0,
      config: options.rules ?? applyPreset(this.def.configSchema, options.mode),
      seats: options.seats,
    });
    this.authority = new SoloAuthority(
      {
        snapshot: (live): DaifugoSnapshot => ({
          mode: options.mode,
          players: this.players(),
          session: live,
          matchWinner: live.result?.winner ?? null,
        }),
        apply: adaptSessionApply(this.def),
        isPlaying: (live) => live.status === 'playing',
        bots: {
          seed: options.seed,
          actor: (live) => live.phase.actor,
          legalMoves: (live, seat) => sessionLegalMoves(this.def, live, seat),
          playerView: (live, seat) => this.def.playerView(live.state, seat),
          policy: () => policy,
          rngFork: (live) => `event:${live.log.length}`,
          untilHumanGuard: 2000,
        },
      },
      session,
    );
  }

  getSnapshot(): DaifugoSnapshot {
    return this.authority.getSnapshot();
  }

  legalMoves(): readonly LegalMove[] {
    const session = this.authority.getLive();
    if (session.status !== 'playing') return [];
    return this.def.flow.legalMoves(session.state, session.phase);
  }

  dispatch(move: string, payload?: unknown): DaifugoDispatch {
    return this.authority.dispatch(move, payload);
  }

  playBotTurn(): DaifugoDispatch {
    return this.authority.playBotTurn();
  }

  playBotsUntilHuman(): DaifugoDispatch[] {
    return this.authority.playBotsUntilHuman();
  }

  private players(): DaifugoPlayer[] {
    return [
      localSeat(this.options.player),
      ...Array.from({ length: this.options.seats - 1 }, (_, index) => ({
        seat: index + 1,
        ...DAIFUGO_BOTS[index % DAIFUGO_BOTS.length]!,
        isBot: true,
      })),
    ];
  }
}
