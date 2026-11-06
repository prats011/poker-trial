import { describe, expect, it } from "vitest";
import { Deck, createDeck, evaluateConstructedHand, holdemVariant, parseCard, shuffleDeck } from "../src";

describe("deck", () => {
  it("uses an injectable Fisher-Yates source and preserves cards", () => {
    const original = createDeck();
    const shuffled = shuffleDeck(original, (max) => max - 1);
    expect(shuffled).toHaveLength(52);
    expect(new Set(shuffled.map((card) => `${card.rank}:${card.suit}`))).toEqual(new Set(original.map((card) => `${card.rank}:${card.suit}`)));
  });

  it("removes burns and draws and rejects overdraws", () => {
    const deck = new Deck(createDeck());
    const burned = deck.burn();
    expect(deck.getCards()).not.toContainEqual(burned);
    deck.draw(51);
    expect(deck.remaining).toBe(0);
    expect(() => deck.draw()).toThrow("Not enough cards");
  });

  it("rejects duplicate cards across constructed hand locations", () => {
    expect(() => evaluateConstructedHand(
      [parseCard("AS"), parseCard("KD")],
      [parseCard("AS"), parseCard("2C"), parseCard("3D"), parseCard("4H"), parseCard("5S")],
      holdemVariant.handConstruction
    )).toThrow("multiple locations");
  });
});
