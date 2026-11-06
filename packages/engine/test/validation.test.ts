import { describe, expect, it } from "vitest";
import { applyPlayerAction, createPokerGame, getVariant } from "../src";

describe("runtime validation", () => {
  it("rejects malformed game configuration and duplicate seats", () => {
    expect(() => createPokerGame({
      id: "HOLD_EM_NO_LIMIT", smallBlind: 5, bigBlind: 10, startingStack: 9,
      players: [{ id: "a", nickname: "A", seat: 0 }, { id: "b", nickname: "B", seat: 0 }]
    })).toThrow("Invalid");
    expect(() => getVariant("UNKNOWN" as never)).toThrow("Unknown poker variant");
  });

  it("returns a structured rejection for a missing action", () => {
    const state = createPokerGame({
      id: "HOLD_EM_NO_LIMIT", smallBlind: 5, bigBlind: 10, startingStack: 100,
      players: [{ id: "a", nickname: "A", seat: 0 }, { id: "b", nickname: "B", seat: 1 }]
    });
    expect(applyPlayerAction(state, "a", undefined as never).ok).toBe(false);
  });
});
