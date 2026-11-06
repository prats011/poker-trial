import { PokerEngineError } from "./errors";
import type { Card, Rank, Suit } from "./types";

export const suits = ["CLUBS", "DIAMONDS", "HEARTS", "SPADES"] as const;
export const ranks = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;
export const rankNames: Record<Rank, string> = { 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "T", 11: "J", 12: "Q", 13: "K", 14: "A" };
export const suitSymbols: Record<Suit, string> = { CLUBS: "♣", DIAMONDS: "♦", HEARTS: "♥", SPADES: "♠" };

export function cardKey(card: Card): string { return `${card.rank}:${card.suit}`; }
export function cardToString(card: Card): string { return `${rankNames[card.rank]}${suitSymbols[card.suit]}`; }
export function compareCards(a: Card, b: Card): number { return a.rank - b.rank || suits.indexOf(a.suit) - suits.indexOf(b.suit); }
export function isStandardCard(value: unknown): value is Card {
  if (!value || typeof value !== "object") return false;
  const card = value as { rank?: unknown; suit?: unknown };
  return typeof card.rank === "number" && (ranks as readonly number[]).includes(card.rank) && typeof card.suit === "string" && (suits as readonly string[]).includes(card.suit);
}
export function assertUniqueStandardCards(cards: readonly Card[]): void {
  const keys = new Set<string>();
  for (const card of cards) {
    assertStandardCard(card);
    const key = cardKey(card);
    if (keys.has(key)) throw new PokerEngineError("DUPLICATE_CARD", "A card cannot appear in multiple locations.");
    keys.add(key);
  }
}
export function assertStandardCard(value: unknown): asserts value is Card {
  if (!isStandardCard(value)) throw new PokerEngineError("INVALID_CARD", "Card is not a standard 52-card card.");
}
export function parseCard(value: string): Card {
  const suit = ({ C: "CLUBS", D: "DIAMONDS", H: "HEARTS", S: "SPADES" } as const)[value.slice(-1).toUpperCase() as "C" | "D" | "H" | "S"];
  const rankText = value.slice(0, -1).toUpperCase();
  const rank = ({ "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, T: 10, J: 11, Q: 12, K: 13, A: 14 } as const)[rankText as "2"];
  if (!suit || !rank) throw new PokerEngineError("INVALID_CARD", `Invalid card: ${value}`);
  return { rank, suit };
}
