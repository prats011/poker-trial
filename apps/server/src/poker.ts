import {
  applyPlayerAction,
  cardToString,
  createPokerGame,
  getLegalActions,
  getVariant,
  resolveShowdown,
  startHand,
  type Payout,
  type PlayerAction,
  type PokerState
} from "@poker/engine";
import type { PokerAction, PokerStateView } from "@poker/protocol";
import type { Game } from "./store";

export function startPokerHand(game: Game): PokerState {
  if (game.configuration.variant === "PLO_DOUBLE_BOARD_BOMB_POT") {
    throw new Error("INVALID_GAME_STATE");
  }
  const seated = [...game.sessions.values()]
    .filter((session) => session.seatIndex !== null)
    .sort((a, b) => a.seatIndex! - b.seatIndex!);
  if (seated.length < 2) throw new Error("INVALID_GAME_STATE");
  const base = game.pokerState ?? createPokerGame({
    id: game.configuration.variant,
    smallBlind: game.configuration.smallBlind,
    bigBlind: game.configuration.bigBlind,
    startingStack: game.configuration.startingStack,
    minimumPlayers: 2,
    maximumPlayers: game.configuration.maxPlayers,
    players: seated.map((session) => ({ id: session.id, nickname: session.nickname, seat: session.seatIndex! }))
  });
  if (game.pokerState && game.pokerState.status !== "HAND_COMPLETE") throw new Error("INVALID_GAME_STATE");
  const state = startHand(base, { smallBlind: game.configuration.smallBlind, bigBlind: game.configuration.bigBlind });
  game.pokerState = state;
  game.lastPayouts = undefined;
  return state;
}

export function applyPokerAction(game: Game, sessionId: string, input: PokerAction): PokerState {
  if (!game.pokerState) throw new Error("INVALID_GAME_STATE");
  if (input.stateVersion !== undefined && input.stateVersion !== game.pokerState.stateVersion) throw new Error("STALE_STATE");
  const action: PlayerAction = { type: input.type, amount: input.amount };
  const result = applyPlayerAction(game.pokerState, sessionId, action);
  if (!result.ok) throw result.error;
  let state = result.value;
  if (state.status === "SHOWDOWN") {
    const outcome = resolveShowdown(state, getVariant(state.variant));
    state = outcome.state;
    game.lastPayouts = outcome.payouts;
  }
  game.pokerState = state;
  return state;
}

export function serializePokerState(game: Game, sessionId: string): PokerStateView | null {
  const state = game.pokerState;
  if (!state) return null;
  const revealAll = state.status === "HAND_COMPLETE";
  return {
    handId: state.handId,
    variant: state.variant,
    status: state.status,
    street: state.street,
    stateVersion: state.stateVersion,
    dealerSeat: state.dealerSeat,
    smallBlindSeat: state.smallBlindSeat,
    bigBlindSeat: state.bigBlindSeat,
    currentPlayerId: state.currentPlayerId,
    currentBet: state.currentBet,
    minimumRaise: state.minimumRaise,
    pot: state.pot,
    boards: state.boards.map((board) => board.map(cardToString)),
    players: state.players.map((player) => ({
      playerId: player.id,
      nickname: player.nickname,
      seatIndex: player.seat,
      stack: player.stack,
      streetContribution: player.streetContribution,
      handContribution: player.handContribution,
      folded: player.folded,
      allIn: player.allIn,
      active: player.active,
      hasActed: player.hasActed,
      holeCards: revealAll || player.id === sessionId ? player.holeCards.map(cardToString) : [],
      holeCardCount: player.holeCards.length
    })),
    pots: state.pots.map((pot) => ({
      amount: pot.amount,
      eligiblePlayerIds: [...pot.eligiblePlayerIds],
      cap: pot.cap
    })),
    legalActions: state.currentPlayerId === sessionId
      ? getLegalActions(state, sessionId, getVariant(state.variant).bettingStructure)
      : [],
    payouts: game.lastPayouts?.map((payout: Payout) => ({
      pot: payout.pot,
      winners: [...payout.winners],
      amountByPlayer: { ...payout.amountByPlayer },
      ...(payout.board === undefined ? {} : { board: payout.board })
    }))
  };
}
