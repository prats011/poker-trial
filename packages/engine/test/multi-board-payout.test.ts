import { describe, expect, it } from "vitest";
import { createPokerGame, doubleBoardBombPotVariant, parseCard, resolveShowdown } from "../src";

const cards = (value: string) => value.split(" ").map(parseCard);

describe("multi-board payouts", () => {
  it("assigns an odd board chip deterministically and conserves the pot", () => {
    const game = createPokerGame({
      id: "PLO_DOUBLE_BOARD_BOMB_POT", smallBlind: 5, bigBlind: 10, startingStack: 100,
      players: [{ id: "a", nickname: "A", seat: 0 }, { id: "b", nickname: "B", seat: 1 }]
    });
    game.status = "SHOWDOWN";
    game.players[0].handContribution = 101;
    game.players[1].handContribution = 0;
    game.players[0].stack = 0;
    game.players[1].stack = 0;
    game.players[0].holeCards = cards("AS AD KH KC");
    game.boards = [cards("AC 2D 3S 4H 9C"), cards("QH 2C 5S 8H 9C")];
    const result = resolveShowdown(game, doubleBoardBombPotVariant);
    expect(result.payouts.reduce((sum, payout) => sum + Object.values(payout.amountByPlayer).reduce((a, b) => a + b, 0), 0)).toBe(101);
  });
});
