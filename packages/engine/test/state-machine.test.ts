import { describe, expect, it } from "vitest";
import { applyPlayerAction, createPokerGame, startHand } from "../src";

describe("state machine", () => {
  it("rejects actions before a hand and after completion", () => {
    const game = createPokerGame({
      id: "HOLD_EM_NO_LIMIT", smallBlind: 5, bigBlind: 10, startingStack: 100,
      players: [{ id: "a", nickname: "A", seat: 0 }, { id: "b", nickname: "B", seat: 1 }]
    });
    expect(applyPlayerAction(game, "a", { type: "CHECK" }).ok).toBe(false);
    const hand = startHand(game, { smallBlind: 5, bigBlind: 10 });
    hand.status = "HAND_COMPLETE";
    expect(applyPlayerAction(hand, "a", { type: "CHECK" }).ok).toBe(false);
  });
});
