import { describe, expect, it } from "vitest";
import { cardKey, cardToString, compareCards, createDeck, parseCard } from "../src";

describe("cards", () => {
  it("represents every standard card exactly once", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map(cardKey)).size).toBe(52);
    expect(new Set(deck.map((card) => card.suit)).size).toBe(4);
    expect(new Set(deck.map((card) => card.rank)).size).toBe(13);
  });

  it("parses, formats, and compares cards", () => {
    const ace = parseCard("AS");
    expect(cardToString(ace)).toBe("A♠");
    expect(compareCards(ace, parseCard("KH"))).toBeGreaterThan(0);
  });
});
