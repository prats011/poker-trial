import { PokerEngineError } from "./errors";
import type { PokerPlayer, Pot } from "./types";

export function calculatePots(players: readonly PokerPlayer[]): Pot[] {
  const levels = [...new Set(players.map((player) => player.handContribution).filter((value) => value > 0))].sort((a, b) => a - b);
  const pots: Pot[] = [];
  let previous = 0;
  for (const level of levels) {
    const layer = level - previous;
    const contributors = players.filter((player) => player.handContribution >= level);
    const amount = layer * players.filter((player) => player.handContribution >= level || player.handContribution > previous).length;
    const eligiblePlayerIds = contributors.filter((player) => !player.folded).map((player) => player.id);
    if (amount < 0) throw new PokerEngineError("INVALID_POT_DISTRIBUTION", "Pot amount cannot be negative.");
    if (eligiblePlayerIds.length === 0 && pots.length > 0) {
      const previousPot = pots[pots.length - 1];
      pots[pots.length - 1] = { ...previousPot, amount: previousPot.amount + amount };
    } else {
      pots.push({ amount, cap: level, eligiblePlayerIds });
    }
    previous = level;
  }
  return pots.filter((pot) => pot.amount > 0);
}
export function calculateSidePots(players: readonly PokerPlayer[]): Pot[] { return calculatePots(players); }
export function calculateUncalledBets(players: readonly PokerPlayer[]): { playerId: string; amount: number } | null {
  const active = players.filter((player) => !player.folded);
  if (active.length < 2) return null;
  const highest = [...active].sort((a, b) => b.streetContribution - a.streetContribution);
  const top = highest[0];
  const second = highest[1];
  const refund = Math.max(0, top.streetContribution - second.streetContribution);
  return refund ? { playerId: top.id, amount: refund } : null;
}

export function refundUncalledBet(state: {
  players: PokerPlayer[];
  pot: number;
}): { playerId: string; amount: number } | null {
  const refund = calculateUncalledBets(state.players);
  if (!refund) return null;
  const player = state.players.find((item) => item.id === refund.playerId);
  if (!player) return null;
  player.stack += refund.amount;
  player.streetContribution -= refund.amount;
  player.handContribution -= refund.amount;
  state.pot -= refund.amount;
  return refund;
}
