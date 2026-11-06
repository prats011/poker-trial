import { describe, expect, it } from "vitest";
import { evaluateConstructedHand, holdemVariant, parseCard } from "../src";

const cards = (value: string) => value.split(" ").map(parseCard);

describe("Hold'em construction", () => {
  it("allows the board, one hole card, or both hole cards to play", () => {
    expect(evaluateConstructedHand(cards("AS KD"), cards("2C 3D 4H 5S 9C"), holdemVariant.handConstruction).category).toBe("STRAIGHT");
    expect(evaluateConstructedHand(cards("AS KD"), cards("AC 2D 3H 4S 9C"), holdemVariant.handConstruction).category).toBe("ONE_PAIR");
  });
});
