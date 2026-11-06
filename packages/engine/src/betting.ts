import { type Result, fail } from "./errors";
import type { BettingStructure, PlayerAction, PokerPlayer, PokerState } from "./types";
import { calculatePots } from "./pots";

export function potLimitMaximum(state: PokerState, player: PokerPlayer): number {
  const toCall = Math.max(0, state.currentBet - player.streetContribution);
  return Math.min(player.stack, state.pot + toCall * 2);
}

export function getLegalActions(state: PokerState, playerId: string, structure: BettingStructure = "NO_LIMIT"): PlayerAction[] {
  const player = state.players.find((item) => item.id === playerId);
  if (!player || !player.active || player.folded || player.allIn || state.currentPlayerId !== playerId) return [];
  const toCall = Math.max(0, state.currentBet - player.streetContribution);
  const actions: PlayerAction[] = [{ type: "FOLD" }];
  if (toCall === 0) actions.push({ type: "CHECK" });
  else actions.push({ type: "CALL", amount: Math.min(toCall, player.stack) });
  const maxCommit = structure === "POT_LIMIT" ? potLimitMaximum(state, player) : player.stack;
  if (state.currentBet === 0) actions.push({ type: "BET", amount: Math.min(maxCommit, Math.max(state.minimumRaise, 1)) });
  else if (player.canRaise && maxCommit > toCall) {
    actions.push({ type: "RAISE", amount: Math.min(maxCommit, toCall + state.minimumRaise) });
  }
  if (player.stack > 0) actions.push({ type: "ALL_IN", amount: player.stack });
  return actions;
}

export function validateAction(state: PokerState, playerId: string, action: PlayerAction, structure: BettingStructure): Result<void> {
  const player = state.players.find((item) => item.id === playerId);
  if (!player) return fail("INVALID_PLAYER", "Player does not exist.");
  if (!action || typeof action.type !== "string") return fail("ACTION_NOT_ALLOWED", "Action is required.");
  if (state.status !== "PREFLOP" && state.status !== "FLOP" && state.status !== "TURN" && state.status !== "RIVER") {
    return fail("INVALID_GAME_STATE", "Actions are not allowed outside a betting street.");
  }
  if (state.currentPlayerId !== playerId) return fail("NOT_PLAYER_TURN", "It is not this player's turn.");
  if (!player.active || player.folded) return fail("PLAYER_NOT_ACTIVE", "Player cannot act.");
  if (player.allIn) return fail("ACTION_NOT_ALLOWED", "An all-in player cannot act again.");
  const amount = action.amount ?? 0;
  const toCall = Math.max(0, state.currentBet - player.streetContribution);
  if (action.type === "CHECK" && toCall > 0) return fail("ACTION_NOT_ALLOWED", "Cannot check while facing a bet.");
  if (["BET", "RAISE", "ALL_IN"].includes(action.type) && (!Number.isInteger(amount) || amount < 0 || amount > player.stack)) {
    return fail("INVALID_BET_AMOUNT", "Bet amount must be a non-negative integer within the stack.");
  }
  if (action.type === "ALL_IN" && amount !== player.stack) return fail("INVALID_BET_AMOUNT", "An all-in action must commit the player's entire remaining stack.");
  if (action.type === "BET" && state.currentBet !== 0) return fail("ACTION_NOT_ALLOWED", "A bet is not legal when facing an existing bet.");
  if (action.type === "BET" && amount < state.minimumRaise && amount !== player.stack) return fail("BET_BELOW_MINIMUM", "Bet is below the minimum.");
  if (action.type === "CALL" && amount !== Math.min(toCall, player.stack)) return fail("INVALID_BET_AMOUNT", "Call amount is invalid.");
  if (action.type === "RAISE") {
    if (!player.canRaise) return fail("ACTION_NOT_ALLOWED", "Raising is not reopened for this player.");
    const maxCommit = structure === "POT_LIMIT" ? potLimitMaximum(state, player) : player.stack;
    const newTotal = player.streetContribution + amount;
    if (amount > maxCommit) return fail("RAISE_EXCEEDS_POT", "Raise exceeds the legal maximum.");
    if (newTotal < state.currentBet + state.minimumRaise && amount !== player.stack) return fail("RAISE_BELOW_MINIMUM", "Raise does not meet the minimum.");
  }
  return { ok: true, value: undefined };
}

function nextActor(state: PokerState, fromSeat: number): string | null {
  const ordered = [...state.players].sort((a, b) => a.seat - b.seat);
  for (let offset = 1; offset <= ordered.length; offset += 1) {
    const candidate = ordered.find((player) => player.seat === (fromSeat + offset) % ordered.length);
    if (candidate && candidate.active && !candidate.folded && !candidate.allIn) return candidate.id;
  }
  return null;
}

export function getNextPlayerToAct(
  state: PokerState,
  fromSeat = state.players.find((player) => player.id === state.currentPlayerId)?.seat ?? state.dealerSeat
): string | null {
  return nextActor(state, fromSeat);
}

export function isBettingRoundComplete(state: PokerState): boolean {
  const contenders = state.players.filter((player) => player.active && !player.folded);
  if (contenders.length <= 1) return true;
  return contenders.every((player) => player.allIn || (player.hasActed && player.streetContribution === state.currentBet));
}

export function applyBettingAction(state: PokerState, playerId: string, action: PlayerAction, structure: BettingStructure): Result<PokerState> {
  const valid = validateAction(state, playerId, action, structure);
  if (!valid.ok) return valid;
  const next: PokerState = structuredClone(state);
  const player = next.players.find((item) => item.id === playerId)!;
  const beforeBet = next.currentBet;
  const beforeContribution = player.streetContribution;
  const commit = action.type === "CALL"
    ? Math.min(Math.max(0, next.currentBet - beforeContribution), player.stack)
    : action.type === "FOLD" || action.type === "CHECK"
      ? 0
      : action.type === "ALL_IN" ? player.stack : action.amount ?? 0;
  player.stack -= commit;
  player.streetContribution += commit;
  player.handContribution += commit;
  next.pot += commit;
  player.hasActed = true;
  player.facedSinceLastAction = 0;
  if (action.type === "FOLD") player.folded = true;
  if (player.stack === 0) player.allIn = true;

  const newBet = player.streetContribution;
  const increase = Math.max(0, newBet - beforeBet);
  if (increase > 0) {
    next.currentBet = newBet;
    const isFullRaise = increase >= next.minimumRaise;
    if (isFullRaise) next.minimumRaise = increase;
    for (const other of next.players) {
      if (other.id === player.id || other.folded || other.allIn) continue;
      other.facedSinceLastAction += increase;
      if (isFullRaise || !other.hasActed || other.facedSinceLastAction >= next.minimumRaise) {
        other.canRaise = true;
      } else if (other.facedSinceLastAction > 0) {
        other.canRaise = false;
      }
    }
    if (action.type === "ALL_IN" && !isFullRaise) player.canRaise = false;
  }
  if (action.type === "BET" || action.type === "RAISE") player.canRaise = false;
  next.actionHistory.push({ playerId, action });
  next.currentPlayerId = nextActor(next, player.seat);
  next.stateVersion += 1;
  next.pots = calculatePots(next.players);
  return { ok: true, value: next };
}
