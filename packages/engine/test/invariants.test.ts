import { describe, expect, it } from "vitest";
import { applyPlayerAction, createPokerGame, holdemVariant, parseCard, resolveShowdown, startHand } from "../src";

describe("engine invariants", () => {
  it("does not mutate state after an invalid action", () => {
    const state = startHand(createPokerGame({
      id: "HOLD_EM_NO_LIMIT", smallBlind: 5, bigBlind: 10, startingStack: 100,
      players: [{ id: "a", nickname: "A", seat: 0 }, { id: "b", nickname: "B", seat: 1 }]
    }), { smallBlind: 5, bigBlind: 10 });
    const snapshot = structuredClone(state);
    const rejected = applyPlayerAction(state, "b", { type: "CALL", amount: 5 });
    expect(rejected.ok).toBe(false);
    expect(state).toEqual(snapshot);
  });

  it("rejects duplicate payout", () => {
    const state = createPokerGame({
      id: "HOLD_EM_NO_LIMIT", smallBlind: 5, bigBlind: 10, startingStack: 100,
      players: [{ id: "a", nickname: "A", seat: 0 }, { id: "b", nickname: "B", seat: 1 }]
    });
    state.status = "HAND_COMPLETE";
    state.paidOut = true;
    expect(() => resolveShowdown(state, {
      id: "HOLD_EM_NO_LIMIT",
      bettingStructure: "NO_LIMIT",
      boardCount: 1,
      handConstruction: { holeCards: 2, boardCards: 5, exactHoleCards: null, exactBoardCards: null },
      validateConfiguration() {},
      getHoleCardCount() { return 2; },
      getBettingStructure() { return "NO_LIMIT"; },
      getHandConstructionRules() { return this.handConstruction; },
      getStreetConfiguration() { return ["PREFLOP", "FLOP", "TURN", "RIVER"] as const; },
      getBoardCount() { return 1; },
      validateAction() {}
    })).toThrow("already been paid out");
  });

  it("clears the pot after payout", () => {
    const state = createPokerGame({
      id: "HOLD_EM_NO_LIMIT", smallBlind: 5, bigBlind: 10, startingStack: 100,
      players: [{ id: "a", nickname: "A", seat: 0 }, { id: "b", nickname: "B", seat: 1 }]
    });
    state.status = "SHOWDOWN";
    state.players[0].handContribution = 50;
    state.players[1].handContribution = 50;
    state.players[0].stack = 0;
    state.players[1].stack = 0;
    state.players[0].holeCards = [parseCard("AS"), parseCard("KD")];
    state.players[1].holeCards = [parseCard("QH"), parseCard("JC")];
    state.boards = [[parseCard("2C"), parseCard("3D"), parseCard("4H"), parseCard("5S"), parseCard("9C")]];
    const result = resolveShowdown(state, holdemVariant);
    expect(result.state.pot).toBe(0);
    expect(result.state.pots).toEqual([]);
  });
});
