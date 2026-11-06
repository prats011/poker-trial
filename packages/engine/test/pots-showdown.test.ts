import { describe, expect, it } from "vitest";
import { calculatePots, createPokerGame, doubleBoardBombPotVariant, evaluateConstructedHand, parseCard, potLimitMaximum, resolveShowdown } from "../src";

const cards = (value: string) => value.split(" ").map(parseCard);

describe("pots and payouts", () => {
  it("calculates four-player contribution tiers and eligibility", () => {
    const game = createPokerGame({
      id: "HOLD_EM_NO_LIMIT", smallBlind: 5, bigBlind: 10, startingStack: 500,
      players: [
        { id: "a", nickname: "A", seat: 0 }, { id: "b", nickname: "B", seat: 1 },
        { id: "c", nickname: "C", seat: 2 }, { id: "d", nickname: "D", seat: 3 }
      ]
    });
    game.players[0].handContribution = 50;
    game.players[1].handContribution = 100;
    game.players[2].handContribution = 200;
    game.players[3].handContribution = 300;
    game.players[2].folded = true;
    expect(calculatePots(game.players).map((pot) => pot.amount)).toEqual([200, 150, 200, 100]);
    expect(calculatePots(game.players)[2].eligiblePlayerIds).not.toContain("c");
  });

  it("uses the standard pot-limit maximum formula", () => {
    const game = createPokerGame({
      id: "OMAHA_HI", smallBlind: 5, bigBlind: 10, startingStack: 100,
      players: [{ id: "a", nickname: "A", seat: 0 }, { id: "b", nickname: "B", seat: 1 }]
    });
    game.pot = 100;
    game.currentBet = 20;
    game.players[0].stack = 200;
    game.players[0].streetContribution = 0;
    expect(potLimitMaximum(game, game.players[0])).toBe(140);
  });

  it("splits two boards exactly and allows different winners", () => {
    const game = createPokerGame({
      id: "PLO_DOUBLE_BOARD_BOMB_POT", smallBlind: 5, bigBlind: 10, startingStack: 100,
      players: [{ id: "a", nickname: "A", seat: 0 }, { id: "b", nickname: "B", seat: 1 }]
    });
    game.status = "SHOWDOWN";
    game.pot = 200;
    game.players[0].handContribution = 100;
    game.players[1].handContribution = 100;
    game.players[0].stack = 0;
    game.players[1].stack = 0;
    game.players[0].holeCards = cards("AS AD KH KC");
    game.players[1].holeCards = cards("QS QD JH JC");
    game.boards = [cards("AC 2D 3S 4H 9C"), cards("QH 2C 5S 8H 9C")];
    const result = resolveShowdown(game, doubleBoardBombPotVariant);
    expect(result.payouts).toHaveLength(2);
    expect(result.state.players.find((player) => player.id === "a")?.stack).toBe(100);
    expect(result.state.players.find((player) => player.id === "b")?.stack).toBe(100);
    expect(result.payouts.flatMap((payout) => Object.values(payout.amountByPlayer)).reduce((sum, amount) => sum + amount, 0)).toBe(200);
  });
});

it("constructs the expected Omaha hands independently per board", () => {
  const hand = evaluateConstructedHand(cards("AS AD KH KC"), cards("AC 2D 3S 4H 9C"), doubleBoardBombPotVariant.handConstruction);
  expect(hand.category).toBe("THREE_OF_A_KIND");
});
