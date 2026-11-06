import { assertUniqueStandardCards, cardKey } from "./cards";
import { PokerEngineError } from "./errors";
import type { Card, HandConstructionRules, Rank } from "./types";

export type HandCategory = "HIGH_CARD" | "ONE_PAIR" | "TWO_PAIR" | "THREE_OF_A_KIND" | "STRAIGHT" | "FLUSH" | "FULL_HOUSE" | "FOUR_OF_A_KIND" | "STRAIGHT_FLUSH" | "ROYAL_FLUSH";
export const categoryValue: Record<HandCategory, number> = { HIGH_CARD: 0, ONE_PAIR: 1, TWO_PAIR: 2, THREE_OF_A_KIND: 3, STRAIGHT: 4, FLUSH: 5, FULL_HOUSE: 6, FOUR_OF_A_KIND: 7, STRAIGHT_FLUSH: 8, ROYAL_FLUSH: 9 };
export type EvaluatedHand = Readonly<{ category: HandCategory; comparisonRanks: readonly number[]; cards: readonly Card[]; description: string }>;

function assertFive(cards: readonly Card[]) {
  if (cards.length !== 5) throw new PokerEngineError("INVALID_HAND", "Exactly five cards are required.");
  if (new Set(cards.map(cardKey)).size !== 5) throw new PokerEngineError("DUPLICATE_CARD", "A hand cannot contain duplicate cards.");
}
function straightHigh(cards: readonly Card[]): number | null {
  const values = [...new Set(cards.map((card) => card.rank))].sort((a, b) => b - a);
  if (values.length !== 5) return null;
  if (values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) return 5;
  return values.every((value, i) => i === 0 || values[i - 1] - value === 1) ? values[0] : null;
}
function desc(category: HandCategory, ranks: readonly number[]) {
  const names = ranks.map((rank) => rank === 14 ? "Ace" : rank === 13 ? "King" : rank === 12 ? "Queen" : rank === 11 ? "Jack" : String(rank));
  return `${category.replaceAll("_", " ").toLowerCase()}${names.length ? ` (${names.join(", ")})` : ""}`;
}
export function evaluateFiveCardHand(cards: readonly Card[]): EvaluatedHand {
  assertFive(cards);
  const counts = new Map<number, number>();
  for (const card of cards) counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every((card) => card.suit === cards[0].suit);
  const straight = straightHigh(cards);
  let category: HandCategory;
  let comparisonRanks: number[];
  if (flush && straight) { category = straight === 14 ? "ROYAL_FLUSH" : "STRAIGHT_FLUSH"; comparisonRanks = [straight]; }
  else if (groups[0][1] === 4) { category = "FOUR_OF_A_KIND"; comparisonRanks = [groups[0][0], groups[1][0]]; }
  else if (groups[0][1] === 3 && groups[1][1] === 2) { category = "FULL_HOUSE"; comparisonRanks = [groups[0][0], groups[1][0]]; }
  else if (flush) { category = "FLUSH"; comparisonRanks = cards.map((card) => card.rank).sort((a, b) => b - a); }
  else if (straight) { category = "STRAIGHT"; comparisonRanks = [straight]; }
  else if (groups[0][1] === 3) { category = "THREE_OF_A_KIND"; comparisonRanks = [groups[0][0], ...groups.slice(1).map((group) => group[0]).sort((a, b) => b - a)]; }
  else if (groups[0][1] === 2 && groups[1][1] === 2) { category = "TWO_PAIR"; comparisonRanks = [Math.max(groups[0][0], groups[1][0]), Math.min(groups[0][0], groups[1][0]), groups[2][0]]; }
  else if (groups[0][1] === 2) { category = "ONE_PAIR"; comparisonRanks = [groups[0][0], ...groups.slice(1).map((group) => group[0]).sort((a, b) => b - a)]; }
  else { category = "HIGH_CARD"; comparisonRanks = cards.map((card) => card.rank).sort((a, b) => b - a); }
  return { category, comparisonRanks, cards: [...cards], description: desc(category, comparisonRanks) };
}
export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  const category = categoryValue[a.category] - categoryValue[b.category];
  if (category) return category;
  for (let i = 0; i < Math.max(a.comparisonRanks.length, b.comparisonRanks.length); i += 1) {
    const difference = (a.comparisonRanks[i] ?? 0) - (b.comparisonRanks[i] ?? 0);
    if (difference) return difference;
  }
  return 0;
}
function combinations(cards: readonly Card[], choose: number): Card[][] {
  const output: Card[][] = [];
  const walk = (start: number, picked: Card[]) => {
    if (picked.length === choose) { output.push([...picked]); return; }
    for (let i = start; i < cards.length; i += 1) walk(i + 1, [...picked, cards[i]]);
  };
  walk(0, []);
  return output;
}
export function evaluateBestFiveCardHand(cards: readonly Card[]): EvaluatedHand {
  if (cards.length < 5) throw new PokerEngineError("INVALID_HAND", "At least five cards are required.");
  return combinations(cards, 5).map(evaluateFiveCardHand).sort((a, b) => compareHands(b, a))[0];
}
export function evaluateConstructedHand(holeCards: readonly Card[], board: readonly Card[], rules: HandConstructionRules): EvaluatedHand {
  if (holeCards.length !== rules.holeCards || board.length < rules.boardCards) throw new PokerEngineError("INVALID_HAND", "The card counts do not match the variant.");
  assertUniqueStandardCards([...holeCards, ...board]);
  if (rules.exactHoleCards === null && rules.exactBoardCards === null) return evaluateBestFiveCardHand([...holeCards, ...board]);
  const hands: EvaluatedHand[] = [];
  for (const hole of combinations(holeCards, rules.exactHoleCards ?? holeCards.length)) {
    for (const community of combinations(board, rules.exactBoardCards ?? board.length)) hands.push(evaluateFiveCardHand([...hole, ...community]));
  }
  if (!hands.length) throw new PokerEngineError("INVALID_HAND", "No valid five-card construction exists.");
  return hands.sort((a, b) => compareHands(b, a))[0];
}
