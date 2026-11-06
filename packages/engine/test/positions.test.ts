import { describe, expect, it } from "vitest";
import { createPokerGame, startHand } from "../src";

describe("positions", () => {
  it("uses dealer small blind in heads-up and rotates on the next hand", () => {
    const game = createPokerGame({
      id: "HOLD_EM_NO_LIMIT", smallBlind: 5, bigBlind: 10, startingStack: 100,
      players: [{ id: "a", nickname: "A", seat: 0 }, { id: "b", nickname: "B", seat: 1 }]
    });
    const first = startHand(game, { smallBlind: 5, bigBlind: 10 });
    expect(first.smallBlindSeat).toBe(first.dealerSeat);
    first.status = "HAND_COMPLETE";
    const second = startHand(first, { smallBlind: 5, bigBlind: 10 });
    expect(second.dealerSeat).not.toBe(first.dealerSeat);
  });
});
