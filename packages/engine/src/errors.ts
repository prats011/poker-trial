export type EngineErrorCode =
  | "INVALID_GAME_STATE" | "INVALID_PLAYER" | "PLAYER_NOT_ACTIVE" | "NOT_PLAYER_TURN"
  | "INSUFFICIENT_CHIPS" | "INVALID_BET_AMOUNT" | "BET_BELOW_MINIMUM" | "RAISE_BELOW_MINIMUM"
  | "RAISE_EXCEEDS_POT" | "ACTION_NOT_ALLOWED" | "INVALID_CARD" | "DUPLICATE_CARD"
  | "INSUFFICIENT_DECK" | "INVALID_HAND" | "INVALID_VARIANT_CONFIGURATION" | "INVALID_POT_DISTRIBUTION";

export class PokerEngineError extends Error {
  readonly name = "PokerEngineError";
  constructor(readonly code: EngineErrorCode, message: string) {
    super(message);
  }
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: PokerEngineError };

export function fail<T>(code: EngineErrorCode, message: string): Result<T> {
  return { ok: false, error: new PokerEngineError(code, message) };
}
