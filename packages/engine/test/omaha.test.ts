import { describe, expect, it } from "vitest";
import { evaluateConstructedHand, omahaVariant, parseCard } from "../src";

const cards = (value: string) => value.split(" ").map(parseCard);

describe("Omaha construction", () => {
  it("never uses a board-only flush", () => {
    const hand = evaluateConstructedHand(cards("AS KD QH JC"), cards("2C 3C 4C 5C 9C"), omahaVariant.handConstruction);
    expect(hand.category).not.toBe("FLUSH");
    expect(hand.cards.filter((card) => cards("AS KD QH JC").some((hole) => hole.rank === card.rank && hole.suit === card.suit))).toHaveLength(2);
  });
});
