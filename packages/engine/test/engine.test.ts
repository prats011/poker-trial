import { describe, expect, it } from "vitest";
import { createDeck, Deck, evaluateBestFiveCardHand, evaluateConstructedHand, evaluateFiveCardHand, compareHands, holdemVariant, omahaVariant, parseCard, createPokerGame, startHand, applyPlayerAction, calculatePots } from "../src";

const cards = (value: string) => value.split(" ").map(parseCard);

describe("@poker/engine cards and evaluation", () => {
  it("creates and shuffles a complete deck without losing cards", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((card) => `${card.rank}:${card.suit}`)).size).toBe(52);
    expect(new Deck(deck).draw(52)).toHaveLength(52);
  });
  it("evaluates every major category and the wheel", () => {
    expect(evaluateFiveCardHand(cards("TC JC QC KC AC")).category).toBe("ROYAL_FLUSH");
    expect(evaluateFiveCardHand(cards("5C 6C 7C 8C 9C")).category).toBe("STRAIGHT_FLUSH");
    expect(evaluateFiveCardHand(cards("AS 2D 3C 4H 5S")).comparisonRanks).toEqual([5]);
    expect(evaluateFiveCardHand(cards("AS AD AC AH 2S")).category).toBe("FOUR_OF_A_KIND");
    expect(evaluateFiveCardHand(cards("AS AD AC 2H 2S")).category).toBe("FULL_HOUSE");
  });
  it("compares kickers and exact ties", () => {
    const ace = evaluateFiveCardHand(cards("AS KD 9C 7H 2S"));
    const king = evaluateFiveCardHand(cards("KS QD 9C 7H 2S"));
    expect(compareHands(ace, king)).toBeGreaterThan(0);
    expect(compareHands(ace, evaluateFiveCardHand(cards("AH KC 9D 7S 2C")))).toBe(0);
  });
  it("enforces Omaha's exact two-and-three construction", () => {
    const hole = cards("AS KD QH JC");
    const board = cards("2C 3C 4C 5C 9D");
    const hand = evaluateConstructedHand(hole, board, omahaVariant.handConstruction);
    expect(hand.cards).toHaveLength(5);
    expect(hand.cards.filter((card) => hole.some((candidate) => candidate.rank === card.rank && candidate.suit === card.suit))).toHaveLength(2);
  });
  it("finds a Hold'em best five", () => {
    expect(evaluateConstructedHand(cards("AS KD"), cards("2C 3C 4C 5C 9D"), holdemVariant.handConstruction).category).toBe("STRAIGHT");
  });
});

describe("@poker/engine state and betting", () => {
  it("starts heads-up blinds and rejects out-of-turn actions", () => {
    const game = createPokerGame({ id: "HOLD_EM_NO_LIMIT", smallBlind: 5, bigBlind: 10, startingStack: 100, players: [{ id: "a", nickname: "A", seat: 0 }, { id: "b", nickname: "B", seat: 1 }] });
    const state = startHand(game, { smallBlind: 5, bigBlind: 10 });
    expect(state.currentPlayerId).toBe("a");
    expect(applyPlayerAction(state, "b", { type: "CALL", amount: 5 }).ok).toBe(false);
  });
  it("calculates layered pots from contributions", () => {
    const players = [
      { id: "a", nickname: "A", seat: 0, startingStack: 0, stack: 0, streetContribution: 0, handContribution: 100, folded: false, allIn: true, active: true, hasActed: true, lastActedBet: 0, holeCards: [] },
      { id: "b", nickname: "B", seat: 1, startingStack: 0, stack: 0, streetContribution: 0, handContribution: 200, folded: false, allIn: true, active: true, hasActed: true, lastActedBet: 0, holeCards: [] },
      { id: "c", nickname: "C", seat: 2, startingStack: 0, stack: 0, streetContribution: 0, handContribution: 300, folded: false, allIn: true, active: true, hasActed: true, lastActedBet: 0, holeCards: [] }
    ];
    expect(calculatePots(players).map((pot) => pot.amount)).toEqual([300, 200, 100]);
  });
});
