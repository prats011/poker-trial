import { PokerEngineError } from "./errors";
import type { PlayerAction, PokerState, PokerVariant, VariantConfiguration } from "./types";

const common = (id: PokerVariant["id"], bettingStructure: PokerVariant["bettingStructure"], boardCount: number, exactHoleCards: number | null, exactBoardCards: number | null): PokerVariant => ({
  id, bettingStructure, boardCount,
  handConstruction: { holeCards: id === "HOLD_EM_NO_LIMIT" ? 2 : 4, boardCards: 5, exactHoleCards, exactBoardCards },
  validateConfiguration(config: VariantConfiguration) {
    if (config.id !== id || !Number.isSafeInteger(config.smallBlind) || !Number.isSafeInteger(config.bigBlind) ||
      config.smallBlind < 1 || config.bigBlind <= config.smallBlind ||
      (config.startingStack !== undefined && (!Number.isSafeInteger(config.startingStack) || config.startingStack < config.bigBlind))) {
      throw new PokerEngineError("INVALID_VARIANT_CONFIGURATION", "Invalid blind, stack, or variant configuration.");
    }
  },
  getHoleCardCount() { return this.handConstruction.holeCards; },
  getBettingStructure() { return bettingStructure; },
  getHandConstructionRules() { return this.handConstruction; },
  getStreetConfiguration() { return ["PREFLOP", "FLOP", "TURN", "RIVER"] as const; },
  getBoardCount() { return boardCount; },
  validateAction(_state: PokerState, action: PlayerAction) { if (!action || !action.type) throw new PokerEngineError("ACTION_NOT_ALLOWED", "Action is required."); }
});
export const holdemVariant = common("HOLD_EM_NO_LIMIT", "NO_LIMIT", 1, null, null);
export const omahaVariant = common("OMAHA_HI", "POT_LIMIT", 1, 2, 3);
export const doubleBoardBombPotVariant = common("PLO_DOUBLE_BOARD_BOMB_POT", "POT_LIMIT", 2, 2, 3);
export const variants = { HOLD_EM_NO_LIMIT: holdemVariant, OMAHA_HI: omahaVariant, PLO_DOUBLE_BOARD_BOMB_POT: doubleBoardBombPotVariant } as const;
export function getVariant(id: PokerVariant["id"]): PokerVariant {
  const variant = variants[id];
  if (!variant) throw new PokerEngineError("INVALID_VARIANT_CONFIGURATION", `Unknown poker variant: ${String(id)}`);
  return variant;
}
