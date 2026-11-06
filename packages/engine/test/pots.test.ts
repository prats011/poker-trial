import { describe, expect, it } from "vitest";
import { calculatePots, createPokerGame } from "../src";

describe("side pots", () => {
  it("keeps folded contributions as dead money without making an unwinnable pot", () => {
    const game = createPokerGame({
      id: "HOLD_EM_NO_LIMIT", smallBlind: 5, bigBlind: 10, startingStack: 500,
      players: [{ id: "a", nickname: "A", seat: 0 }, { id: "b", nickname: "B", seat: 1 }, { id: "c", nickname: "C", seat: 2 }]
    });
    game.players[0].handContribution = 100;
    game.players[1].handContribution = 200;
    game.players[2].handContribution = 300;
    game.players[2].folded = true;
    const pots = calculatePots(game.players);
    expect(pots.every((pot) => pot.eligiblePlayerIds.length > 0)).toBe(true);
    expect(pots.reduce((sum, pot) => sum + pot.amount, 0)).toBe(600);
  });
});
