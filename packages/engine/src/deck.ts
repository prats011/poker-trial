import { randomInt } from "node:crypto";
import { assertUniqueStandardCards, ranks, suits } from "./cards";
import { PokerEngineError } from "./errors";
import type { Card } from "./types";

export type RandomInt = (maxExclusive: number) => number;

export function createDeck(): Card[] {
  return suits.flatMap((suit) => ranks.map((rank) => ({ rank, suit })));
}

export function shuffleDeck(cards: readonly Card[], random: RandomInt = randomInt): Card[] {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = random(i + 1);
    if (!Number.isInteger(j) || j < 0 || j > i) throw new PokerEngineError("INVALID_GAME_STATE", "Random source returned an invalid index.");
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export class Deck {
  private cards: Card[];
  constructor(cards: readonly Card[] = shuffleDeck(createDeck())) {
    assertUniqueStandardCards(cards);
    this.cards = [...cards];
  }
  get remaining(): number { return this.cards.length; }
  getCards(): Card[] { return [...this.cards]; }
  draw(count = 1): Card[] {
    if (!Number.isInteger(count) || count < 1 || count > this.cards.length) throw new PokerEngineError("INSUFFICIENT_DECK", "Not enough cards remain in the deck.");
    return this.cards.splice(0, count);
  }
  burn(): Card { return this.draw(1)[0]; }
}

export function drawCards(deck: Deck, count = 1): Card[] { return deck.draw(count); }
export function burnCard(deck: Deck): Card { return deck.burn(); }
