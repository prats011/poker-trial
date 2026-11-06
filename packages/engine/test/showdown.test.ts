import { describe, expect, it } from "vitest";
import { createPokerGame, parseCard, resolveShowdown, holdemVariant } from "../src";

const cards = (value: string) => value.split(" ").map(parseCard);

describe("showdown", () => {
  it("awards a folded player's contribution only to an eligible player", () => {
    const game = createPokerGame({
      id: "HOLD_EM_NO_LIMIT", smallBlind: 5, bigBlind: 10, startingStack: 100,
      players: [{ id: "a", nickname: "A", seat: 0 }, { id: "b", nickname: "B", seat: 1 }]
    });
    game.status = "SHOWDOWN";
    game.players[0].handContribution = 50;
    game.players[1].handContribution = 50;
    game.players[0].stack = 0;
    game.players[1].stack = 0;
    game.players[0].folded = true;
    game.players[1].holeCards = cards("AS KD");
    game.boards = [cards("2C 3D 4H 5S 9C")];
    const result = resolveShowdown(game, holdemVariant);
    expect(result.state.players.find((player) => player.id === "b")?.stack).toBe(100);
  });
});
