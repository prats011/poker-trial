export const pokerVariantIds = ["HOLD_EM_NO_LIMIT"] as const;

export type PokerVariantId = (typeof pokerVariantIds)[number];

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

export interface PokerGameVariant<TState extends EngineTableState, TAction> {
  id: PokerVariantId;
  initialize(tableId: string): TState;
  transition(context: EngineTransitionContext<TState, TAction>): EngineTransitionResult<TState>;
}
