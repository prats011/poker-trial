import { describe, expect, it } from "vitest";
import { compareHands, evaluateFiveCardHand, parseCard } from "../src";

const cards = (value: string) => value.split(" ").map(parseCard);

describe("five-card evaluation", () => {
  it("orders every category above the preceding category", () => {
    const hands = [
      cards("AS KD 9C 7H 2S"),
      cards("AS AD 9C 7H 2S"),
      cards("AS AD KD KH 2S"),
      cards("AS AD AC 7H 2S"),
      cards("AS 2D 3C 4H 5S"),
      cards("AS JS 9S 7S 2S"),
      cards("AS AD AC 2H 2S"),
      cards("AS AD AC AH 2S"),
      cards("5C 6C 7C 8C 9C"),
      cards("TC JC QC KC AC")
    ].map(evaluateFiveCardHand);
    for (let index = 1; index < hands.length; index += 1) expect(compareHands(hands[index], hands[index - 1])).toBeGreaterThan(0);
  });
});
