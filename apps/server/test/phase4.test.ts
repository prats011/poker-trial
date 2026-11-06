import { describe, expect, it } from "vitest";
import { applyRebuy, startPokerHand } from "../src/poker";
import { GameStore } from "../src/store";

function createTable() {
  const store = new GameStore();
  const created = store.createGame({
    variant: "HOLD_EM_NO_LIMIT",
    startingStack: 100,
    smallBlind: 5,
    bigBlind: 10,
    turnTimerSeconds: 30,
    maxPlayers: 2,
    rebuysEnabled: true,
    rebuyMinAmount: 10,
    rebuyMaxAmount: 100,
    rebuyDecisionTimeSec: 15
  }, "Host");
  const joined = store.join(created.game, "Player 2");
  store.requestSeat(created.game, created.session, 0);
  store.requestSeat(created.game, joined.session, 1);
  startPokerHand(created.game);
  return { ...created, player: joined.session, store };
}

describe("Phase 4 rebuy accounting", () => {
  it("adds chips only after settlement and preserves pot/contributions", () => {
    const table = createTable();
    const state = table.game.pokerState!;
    const player = state.players.find((item) => item.id === table.player.id)!;
    state.status = "HAND_COMPLETE";
    player.stack = 0;
    player.handContribution = 25;
    state.pot = 75;
    table.game.rebuyOffers.set(table.player.id, { expiresAt: Date.now() + 15_000 });

    applyRebuy(table.game, table.player.id, 40);

    expect(player.stack).toBe(40);
    expect(player.handContribution).toBe(25);
    expect(state.pot).toBe(75);
    expect(table.game.rebuyOffers.has(table.player.id)).toBe(false);
    expect(() => applyRebuy(table.game, table.player.id, 40)).toThrow("REBUY_NOT_AVAILABLE");
  });

  it("rejects rebuys during an active hand", () => {
    const table = createTable();
    const player = table.game.pokerState!.players.find((item) => item.id === table.player.id)!;
    player.stack = 0;
    table.game.rebuyOffers.set(table.player.id, { expiresAt: Date.now() + 15_000 });
    expect(() => applyRebuy(table.game, table.player.id, 40)).toThrow("REBUY_NOT_AVAILABLE");
  });
});
