export const pokerVariantIds = ["HOLD_EM_NO_LIMIT", "OMAHA_HI", "PLO_DOUBLE_BOARD_BOMB_POT"] as const;
export type PokerVariantId = (typeof pokerVariantIds)[number];
export type Suit = "CLUBS" | "DIAMONDS" | "HEARTS" | "SPADES";
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export type Street = "PREFLOP" | "FLOP" | "TURN" | "RIVER";
export type HandStatus = "WAITING_FOR_PLAYERS" | "HAND_PREPARATION" | Street | "SHOWDOWN" | "PAYOUT" | "HAND_COMPLETE";
export type BettingStructure = "NO_LIMIT" | "POT_LIMIT";
export type PlayerActionType = "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE" | "ALL_IN";
export type Card = Readonly<{ rank: Rank; suit: Suit }>;

export type PlayerAction = Readonly<{
  type: PlayerActionType;
  amount?: number;
}>;

export type PokerPlayer = {
  id: string;
  nickname: string;
  seat: number;
  startingStack: number;
  stack: number;
  streetContribution: number;
  handContribution: number;
  folded: boolean;
  allIn: boolean;
  active: boolean;
  hasActed: boolean;
  lastActedBet: number;
  facedSinceLastAction: number;
  canRaise: boolean;
  holeCards: Card[];
};

export type Pot = Readonly<{
  amount: number;
  eligiblePlayerIds: readonly string[];
  cap: number;
}>;

export type Board = Card[];

export type PokerState = {
  handId: string;
  variant: PokerVariantId;
  status: HandStatus;
  street: Street;
  players: PokerPlayer[];
  dealerSeat: number;
  smallBlindSeat: number | null;
  bigBlindSeat: number | null;
  currentPlayerId: string | null;
  currentBet: number;
  minimumRaise: number;
  smallBlind: number;
  bigBlind: number;
  pot: number;
  boards: Board[];
  burnCards: Card[];
  deck: Card[];
  pots: Pot[];
  actionHistory: Array<{ playerId: string; action: PlayerAction }>;
  stateVersion: number;
  paidOut: boolean;
};

export type HandConstructionRules = Readonly<{
  holeCards: number;
  boardCards: number;
  exactHoleCards: number | null;
  exactBoardCards: number | null;
}>;

export type VariantConfiguration = Readonly<{
  id: PokerVariantId;
  smallBlind: number;
  bigBlind: number;
  ante?: number;
  minimumPlayers?: number;
  maximumPlayers?: number;
  startingStack?: number;
  boardCount?: number;
}>;

export interface PokerVariant {
  readonly id: PokerVariantId;
  readonly bettingStructure: BettingStructure;
  readonly handConstruction: HandConstructionRules;
  readonly boardCount: number;
  validateConfiguration(config: VariantConfiguration): void;
  getHoleCardCount(): number;
  getBettingStructure(): BettingStructure;
  getHandConstructionRules(): HandConstructionRules;
  getStreetConfiguration(): readonly Street[];
  getBoardCount(): number;
  validateAction(state: PokerState, action: PlayerAction): void;
}

export interface EngineTableState {
  tableId: string;
  stateVersion: number;
}

export interface EngineTransitionContext<TState extends EngineTableState, TAction> {
  currentState: TState;
  action: TAction;
  requestedBySessionId: string;
}

export interface EngineTransitionResult<TState extends EngineTableState> {
  nextState: TState;
  events: Array<{ type: string; payload: unknown }>;
}
