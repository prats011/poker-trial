import { describe, expect, it } from "vitest";
import { applyPlayerAction, createPokerGame, getPublicBoards, startHand, toPublicState } from "../src";

function headsUp(stack = 100) {
  return createPokerGame({
    id: "HOLD_EM_NO_LIMIT",
    smallBlind: 5,
    bigBlind: 10,
    startingStack: stack,
    players: [
      { id: "a", nickname: "A", seat: 0 },
      { id: "b", nickname: "B", seat: 1 }
    ]
  });
}

function action(state: ReturnType<typeof startHand>, playerId: string, type: "CHECK" | "CALL" | "ALL_IN", amount?: number) {
  const result = applyPlayerAction(state, playerId, { type, amount });
  if (!result.ok) throw result.error;
  return result.value;
}

describe("hand progression and community cards", () => {
  it("deals flop, turn, and river exactly once after completed rounds", () => {
    let state = startHand(headsUp(), { smallBlind: 5, bigBlind: 10 });
    state = action(state, "a", "CALL", 5);
    state = action(state, "b", "CHECK");
    expect(state.status).toBe("FLOP");
    expect(getPublicBoards(state)[0]).toHaveLength(3);
    state = action(state, "b", "CHECK");
    state = action(state, "a", "CHECK");
    expect(state.status).toBe("TURN");
    expect(getPublicBoards(state)[0]).toHaveLength(4);
    state = action(state, "b", "CHECK");
    state = action(state, "a", "CHECK");
    expect(state.status).toBe("RIVER");
    expect(getPublicBoards(state)[0]).toHaveLength(5);
    state = action(state, "b", "CHECK");
    state = action(state, "a", "CHECK");
    expect(state.status).toBe("SHOWDOWN");
    expect(toPublicState(state).players[0]).not.toHaveProperty("holeCards");
    expect(toPublicState(state)).not.toHaveProperty("deck");
  });

  it("runs all-in players through the remaining streets", () => {
    let state = startHand(headsUp(20), { smallBlind: 5, bigBlind: 10 });
    const result = applyPlayerAction(state, "a", { type: "ALL_IN", amount: 15 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    state = result.value;
    const final = applyPlayerAction(state, "b", { type: "ALL_IN", amount: 10 });
    expect(final.ok).toBe(true);
    if (!final.ok) return;
    expect(final.value.status).toBe("SHOWDOWN");
    expect(final.value.boards[0]).toHaveLength(5);
    expect(final.value.burnCards).toHaveLength(3);
  });

  it("uses one burn per street for a double-board runout", () => {
    const game = createPokerGame({
      id: "PLO_DOUBLE_BOARD_BOMB_POT", smallBlind: 5, bigBlind: 10, startingStack: 20,
      players: [{ id: "a", nickname: "A", seat: 0 }, { id: "b", nickname: "B", seat: 1 }]
    });
    const started = startHand(game, { smallBlind: 5, bigBlind: 10 });
    const first = applyPlayerAction(started, "a", { type: "ALL_IN", amount: 15 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = applyPlayerAction(first.value, "b", { type: "ALL_IN", amount: 10 });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.boards).toHaveLength(2);
    expect(second.value.boards.map((board) => board.length)).toEqual([5, 5]);
    expect(second.value.burnCards).toHaveLength(3);
  });
});
