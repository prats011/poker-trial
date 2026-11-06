import { describe, expect, it } from "vitest";
import { applyPlayerAction, createPokerGame, getLegalActions, startHand } from "../src";

describe("betting actions", () => {
  it("supports call, check, fold, and all-in validation", () => {
    const game = createPokerGame({
      id: "HOLD_EM_NO_LIMIT", smallBlind: 5, bigBlind: 10, startingStack: 20,
      players: [{ id: "a", nickname: "A", seat: 0 }, { id: "b", nickname: "B", seat: 1 }]
    });
    const state = startHand(game, { smallBlind: 5, bigBlind: 10 });
    expect(getLegalActions(state, "a")).toEqual(expect.arrayContaining([{ type: "CALL", amount: 5 }]));
    expect(applyPlayerAction(state, "a", { type: "CHECK" }).ok).toBe(false);
  });
});
