import { randomUUID } from "node:crypto";
import { createDeck, shuffleDeck } from "./deck";
import { PokerEngineError, type Result, fail } from "./errors";
import { applyBettingAction, getLegalActions, isBettingRoundComplete } from "./betting";
import { refundUncalledBet } from "./pots";
import { getVariant } from "./variants";
import type { Board, PlayerAction, PokerPlayer, PokerState, PokerVariant, VariantConfiguration } from "./types";

export type CreateGameOptions = VariantConfiguration & { players: Array<{ id: string; nickname: string; seat: number }> };
export type PublicPokerState = Omit<PokerState, "deck" | "burnCards" | "players"> & {
  players: Array<Omit<PokerPlayer, "holeCards"> & { holeCardCount: number }>;
};

export function toPublicState(state: PokerState): PublicPokerState {
  const { deck: _deck, burnCards: _burnCards, players, ...publicState } = state;
  return {
    ...publicState,
    players: players.map(({ holeCards, ...player }) => ({ ...player, holeCardCount: holeCards.length }))
  };
}

export function getPublicBoards(state: PokerState): Board[] {
  return state.boards.map((board) => [...board]);
}
export function createPokerGame(options: CreateGameOptions): PokerState {
  const variant = getVariant(options.id); variant.validateConfiguration(options);
  if (typeof options.startingStack !== "number" || !Number.isSafeInteger(options.startingStack) || options.startingStack < options.bigBlind ||
    options.players.length < (options.minimumPlayers ?? 2) ||
    (options.maximumPlayers !== undefined && options.players.length > options.maximumPlayers) ||
    new Set(options.players.map((player) => player.id)).size !== options.players.length ||
    new Set(options.players.map((player) => player.seat)).size !== options.players.length) {
    throw new PokerEngineError("INVALID_GAME_STATE", "Invalid player count, seats, IDs, or starting stack.");
  }
  const startingStack = options.startingStack;
  const players: PokerPlayer[] = options.players.map((player) => ({ ...player, startingStack, stack: startingStack, streetContribution: 0, handContribution: 0, folded: false, allIn: false, active: true, hasActed: false, lastActedBet: 0, facedSinceLastAction: 0, canRaise: true, holeCards: [] }));
  return { handId: randomUUID(), variant: options.id, status: "WAITING_FOR_PLAYERS", street: "PREFLOP", players, dealerSeat: Math.min(...players.map((player) => player.seat)), smallBlindSeat: null, bigBlindSeat: null, currentPlayerId: null, currentBet: 0, minimumRaise: options.bigBlind, smallBlind: options.smallBlind, bigBlind: options.bigBlind, pot: 0, boards: Array.from({ length: variant.boardCount }, () => []), burnCards: [], deck: [], pots: [], actionHistory: [], stateVersion: 0, paidOut: false };
}
export function startHand(state: PokerState, options: { smallBlind: number; bigBlind: number }): PokerState {
  if (state.status !== "WAITING_FOR_PLAYERS" && state.status !== "HAND_COMPLETE") throw new PokerEngineError("INVALID_GAME_STATE", "Hand cannot start from the current state.");
  if (!Number.isSafeInteger(options.smallBlind) || !Number.isSafeInteger(options.bigBlind) ||
    options.smallBlind < 1 || options.bigBlind <= options.smallBlind) {
    throw new PokerEngineError("INVALID_VARIANT_CONFIGURATION", "Invalid blind configuration.");
  }
  const next = structuredClone(state); next.status = "HAND_PREPARATION"; next.street = "PREFLOP"; next.deck = shuffleDeck(createDeck()); next.handId = randomUUID(); next.stateVersion += 1; next.pot = 0; next.currentBet = options.bigBlind; next.minimumRaise = options.bigBlind; next.smallBlind = options.smallBlind; next.bigBlind = options.bigBlind; next.paidOut = false; next.boards = Array.from({ length: getVariant(next.variant).boardCount }, () => []); next.burnCards = []; next.actionHistory = []; next.pots = [];
  for (const player of next.players) Object.assign(player, { streetContribution: 0, handContribution: 0, folded: false, allIn: false, hasActed: false, lastActedBet: 0, facedSinceLastAction: 0, canRaise: true, holeCards: [] });
  const ordered = next.players.filter((player) => player.active && player.stack > 0).sort((a, b) => a.seat - b.seat);
  if (ordered.length < 2) throw new PokerEngineError("INVALID_GAME_STATE", "A hand requires at least two players with chips.");
  const variant = getVariant(next.variant);
  for (const player of ordered) player.holeCards = next.deck.splice(0, variant.getHoleCardCount());
  const currentDealerIndex = ordered.findIndex((player) => player.seat === next.dealerSeat);
  const dealerIndex = state.status === "HAND_COMPLETE" ? (currentDealerIndex + 1 + ordered.length) % ordered.length : Math.max(currentDealerIndex, 0);
  next.dealerSeat = ordered[dealerIndex].seat;
  const sb = ordered[(dealerIndex + (ordered.length === 2 ? 0 : 1)) % ordered.length]; const bb = ordered[(dealerIndex + (ordered.length === 2 ? 1 : 2)) % ordered.length];
  next.smallBlindSeat = sb.seat; next.bigBlindSeat = bb.seat;
  for (const blind of [sb, bb]) {
    const amount = Math.min(blind.stack, blind.seat === sb.seat ? options.smallBlind : options.bigBlind);
    blind.stack -= amount; blind.streetContribution = amount; blind.handContribution = amount; next.pot += amount;
    if (blind.stack === 0) blind.allIn = true;
  }
  for (const player of next.players) player.canRaise = true;
  next.status = "PREFLOP";
  next.currentPlayerId = ordered[(ordered.findIndex((player) => player.seat === bb.seat) + 1) % ordered.length].id;
  return next;
}

function firstPostflopPlayer(state: PokerState): string | null {
  const ordered = [...state.players].sort((a, b) => a.seat - b.seat);
  const dealerIndex = ordered.findIndex((player) => player.seat === state.dealerSeat);
  for (let offset = 1; offset <= ordered.length; offset += 1) {
    const player = ordered[(dealerIndex + offset) % ordered.length];
    if (player.active && !player.folded && !player.allIn) return player.id;
  }
  return null;
}

export function dealCommunityCards(state: PokerState, street: "FLOP" | "TURN" | "RIVER"): PokerState {
  const previousStreet = street === "FLOP" ? "PREFLOP" : street === "TURN" ? "FLOP" : "TURN";
  if (state.status !== previousStreet) throw new PokerEngineError("INVALID_GAME_STATE", `Cannot deal ${street} from ${state.status}.`);
  const next = structuredClone(state);
  const boardCards = street === "FLOP" ? 3 : 1;
  if (next.deck.length < boardCards * next.boards.length + 1) throw new PokerEngineError("INSUFFICIENT_DECK", "Not enough cards to deal the next street.");
  next.burnCards.push(next.deck.shift()!);
  for (const board of next.boards) {
    board.push(...next.deck.splice(0, boardCards));
  }
  next.status = street;
  next.street = street;
  next.currentBet = 0;
  next.minimumRaise = next.bigBlind;
  for (const player of next.players) {
    player.streetContribution = 0;
    player.hasActed = false;
    player.facedSinceLastAction = 0;
    player.canRaise = true;
  }
  next.currentPlayerId = firstPostflopPlayer(next);
  next.stateVersion += 1;
  return next;
}

function finishIfNoBetting(next: PokerState): PokerState {
  const remaining = next.players.filter((player) => player.active && !player.folded);
  if (remaining.length <= 1) {
    next.status = "SHOWDOWN";
    next.currentPlayerId = null;
    return next;
  }
  if (!remaining.some((player) => !player.allIn)) {
    if (next.status === "PREFLOP") return dealCommunityCards(next, "FLOP");
    if (next.status === "FLOP") return dealCommunityCards(next, "TURN");
    if (next.status === "TURN") return dealCommunityCards(next, "RIVER");
    next.status = "SHOWDOWN";
    next.currentPlayerId = null;
  }
  return next;
}

function advanceAfterAction(state: PokerState): PokerState {
  if (state.status === "SHOWDOWN") return state;
  if (isBettingRoundComplete(state)) {
    if (state.players.filter((player) => player.active && !player.folded).length <= 1) return finishIfNoBetting(state);
    refundUncalledBet(state);
    const wasRiver = state.status === "RIVER";
    let next = state.status === "PREFLOP" ? dealCommunityCards(state, "FLOP")
      : state.status === "FLOP" ? dealCommunityCards(state, "TURN")
        : state.status === "TURN" ? dealCommunityCards(state, "RIVER")
          : state;
    while (next.status !== "RIVER" && !next.players.some((player) => player.active && !player.folded && !player.allIn)) {
      next = next.status === "FLOP" ? dealCommunityCards(next, "TURN")
        : next.status === "TURN" ? dealCommunityCards(next, "RIVER")
          : next;
    }
    if (wasRiver || (next.status === "RIVER" && !next.players.some((player) => player.active && !player.folded && !player.allIn))) {
      next.status = "SHOWDOWN";
      next.currentPlayerId = null;
    }
    return next;
  }
  return finishIfNoBetting(state);
}
export function applyPlayerAction(state: PokerState, playerId: string, action: PlayerAction): Result<PokerState> {
  if (state.status === "HAND_COMPLETE" || state.status === "PAYOUT" || state.status === "SHOWDOWN") return fail("INVALID_GAME_STATE", "Completed hands cannot accept actions.");
  const result = applyBettingAction(state, playerId, action, getVariant(state.variant).bettingStructure);
  if (!result.ok) return result;
  return { ok: true, value: advanceAfterAction(result.value) };
}
export { getLegalActions };
