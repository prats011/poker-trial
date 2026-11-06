import { PokerEngineError } from "./errors";
import { compareHands, evaluateConstructedHand } from "./evaluation";
import { calculatePots } from "./pots";
import type { PokerPlayer, PokerState, PokerVariant } from "./types";

export type Payout = Readonly<{
  pot: number;
  winners: readonly string[];
  amountByPlayer: Readonly<Record<string, number>>;
  board?: number;
}>;

function positionalOrder(players: readonly PokerPlayer[], dealerSeat: number): PokerPlayer[] {
  return [...players].sort((a, b) => {
    const aDistance = (a.seat - dealerSeat + 1000) % 1000 || 1000;
    const bDistance = (b.seat - dealerSeat + 1000) % 1000 || 1000;
    return aDistance - bDistance;
  });
}

function distribute(amount: number, winners: readonly string[], players: readonly PokerPlayer[], dealerSeat: number): Record<string, number> {
  if (!winners.length) throw new PokerEngineError("INVALID_POT_DISTRIBUTION", "Cannot distribute a pot without winners.");
  const orderedWinners = positionalOrder(players.filter((player) => winners.includes(player.id)), dealerSeat);
  const base = Math.floor(amount / orderedWinners.length);
  let remainder = amount % orderedWinners.length;
  return Object.fromEntries(orderedWinners.map((player) => [player.id, base + (remainder-- > 0 ? 1 : 0)]));
}

function boardShares(amount: number, boardCount: number): number[] {
  const base = Math.floor(amount / boardCount);
  const remainder = amount % boardCount;
  return Array.from({ length: boardCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function resolveShowdown(state: PokerState, variant: PokerVariant): { state: PokerState; payouts: Payout[] } {
  if (state.paidOut || state.status === "HAND_COMPLETE" || state.status === "PAYOUT") {
    throw new PokerEngineError("INVALID_GAME_STATE", "This hand has already been paid out.");
  }
  if (state.status !== "SHOWDOWN") throw new PokerEngineError("INVALID_GAME_STATE", "Showdown is not available in this state.");
  const next = structuredClone(state);
  next.status = "PAYOUT";
  next.pots = calculatePots(next.players);
  const remaining = next.players.filter((player) => player.active && !player.folded);
  if (!remaining.length) throw new PokerEngineError("INVALID_POT_DISTRIBUTION", "No player is eligible to win.");
  const payouts: Payout[] = [];

  for (const pot of next.pots) {
    const eligible = next.players.filter((player) => pot.eligiblePlayerIds.includes(player.id) && !player.folded);
    if (!eligible.length) throw new PokerEngineError("INVALID_POT_DISTRIBUTION", "Pot has no eligible winner.");
    const shares = boardShares(pot.amount, next.boards.length);
    if (eligible.length > 1 && (next.boards.some((board) => board.length !== variant.handConstruction.boardCards) ||
      eligible.some((player) => player.holeCards.length !== variant.handConstruction.holeCards))) {
      throw new PokerEngineError("INVALID_HAND", "Showdown requires complete boards and hole cards.");
    }
    for (let boardIndex = 0; boardIndex < next.boards.length; boardIndex += 1) {
      const amount = shares[boardIndex];
      let winners = eligible.map((player) => player.id);
      if (eligible.length > 1) {
        const evaluated = eligible.map((player) => ({
          player,
          hand: evaluateConstructedHand(player.holeCards, next.boards[boardIndex], variant.handConstruction)
        }));
        const best = evaluated.reduce((winner, candidate) => compareHands(candidate.hand, winner.hand) > 0 ? candidate : winner);
        winners = evaluated.filter((candidate) => compareHands(candidate.hand, best.hand) === 0).map((candidate) => candidate.player.id);
      }
      const amountByPlayer = distribute(amount, winners, next.players, next.dealerSeat);
      payouts.push({ pot: amount, winners, amountByPlayer, board: next.boards.length > 1 ? boardIndex : undefined });
      for (const [playerId, payout] of Object.entries(amountByPlayer)) {
        const player = next.players.find((item) => item.id === playerId);
        if (!player) throw new PokerEngineError("INVALID_POT_DISTRIBUTION", "Payout player does not exist.");
        player.stack += payout;
      }
    }
  }
  next.paidOut = true;
  next.pot = 0;
  next.pots = [];
  next.status = "HAND_COMPLETE";
  next.currentPlayerId = null;
  next.stateVersion += 1;
  return { state: next, payouts };
}
