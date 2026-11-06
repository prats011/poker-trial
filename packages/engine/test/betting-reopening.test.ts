import { describe, expect, it } from "vitest";
import { applyBettingAction, createPokerGame } from "../src";

function flopState() {
  const state = createPokerGame({
    id: "HOLD_EM_NO_LIMIT",
    smallBlind: 5,
    bigBlind: 10,
    startingStack: 100,
    players: [
      { id: "a", nickname: "A", seat: 0 },
      { id: "b", nickname: "B", seat: 1 },
      { id: "c", nickname: "C", seat: 2 }
    ]
  });
  state.status = "FLOP";
  state.currentBet = 0;
  state.minimumRaise = 10;
  state.currentPlayerId = "a";
  state.pot = 0;
  state.players.find((player) => player.id === "b")!.stack = 25;
  return state;
}

describe("short all-in raise reopening", () => {
  it("does not reopen a raise for a player who already acted", () => {
    let state = flopState();
    let result = applyBettingAction(state, "a", { type: "BET", amount: 20 }, "NO_LIMIT");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result = applyBettingAction(result.value, "b", { type: "ALL_IN", amount: 25 }, "NO_LIMIT");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.find((player) => player.id === "a")?.canRaise).toBe(false);
    result = applyBettingAction(result.value, "c", { type: "CALL", amount: 25 }, "NO_LIMIT");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rejected = applyBettingAction(result.value, "a", { type: "RAISE", amount: 20 }, "NO_LIMIT");
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.error.code).toBe("ACTION_NOT_ALLOWED");
  });

  it("reopens after cumulative short raises reach a full raise", () => {
    const state = createPokerGame({
      id: "HOLD_EM_NO_LIMIT", smallBlind: 5, bigBlind: 10, startingStack: 100,
      players: [
        { id: "a", nickname: "A", seat: 0 }, { id: "b", nickname: "B", seat: 1 },
        { id: "c", nickname: "C", seat: 2 }, { id: "d", nickname: "D", seat: 3 },
        { id: "e", nickname: "E", seat: 4 }
      ]
    });
    state.status = "FLOP";
    state.currentBet = 0;
    state.minimumRaise = 20;
    state.currentPlayerId = "a";
    state.pot = 0;
    for (const [id, stack] of [["b", 25], ["c", 30], ["d", 35], ["e", 40] as const]) {
      state.players.find((player) => player.id === id)!.stack = stack;
    }
    let result = applyBettingAction(state, "a", { type: "BET", amount: 20 }, "NO_LIMIT");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const [id, amount] of [["b", 25], ["c", 30], ["d", 35], ["e", 40] as const]) {
      result = applyBettingAction(result.value, id, { type: "ALL_IN", amount }, "NO_LIMIT");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
    }
    expect(result.value.currentPlayerId).toBe("a");
    expect(result.value.players.find((player) => player.id === "a")?.canRaise).toBe(true);
  });
});
