import { describe, expect, it } from "vitest";
import { createPokerGame, dealCommunityCards, startHand } from "../src";

describe("community cards", () => {
  it("rejects dealing a street out of order", () => {
    const game = createPokerGame({
      id: "HOLD_EM_NO_LIMIT", smallBlind: 5, bigBlind: 10, startingStack: 100,
      players: [{ id: "a", nickname: "A", seat: 0 }, { id: "b", nickname: "B", seat: 1 }]
    });
    expect(() => dealCommunityCards(startHand(game, { smallBlind: 5, bigBlind: 10 }), "TURN")).toThrow("Cannot deal TURN");
  });
});
