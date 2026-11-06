export * from "./types";
export * from "./errors";
export * from "./cards";
export * from "./deck";
export * from "./evaluation";
export * from "./variants";
export * from "./pots";
export * from "./betting";
export * from "./game";
export * from "./showdown";
import type { EngineTableState, EngineTransitionContext, EngineTransitionResult, PokerVariantId } from "./types";

export interface PokerGameVariant<TState extends EngineTableState, TAction> {
  id: PokerVariantId;
  initialize(tableId: string): TState;
  transition(context: EngineTransitionContext<TState, TAction>): EngineTransitionResult<TState>;
}
