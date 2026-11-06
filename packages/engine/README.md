# `@poker/engine`

`@poker/engine` is a server-authoritative, framework-independent poker domain package. It owns cards, secure shuffling, dealing, hand construction, betting validation, turn order, pots, showdown, and payouts. It does not import React, Next.js, Socket.IO, Fastify, PostgreSQL, or transport protocol code.

## Lifecycle

`createPokerGame` creates a waiting hand. `startHand` rotates the dealer after the first hand, selects blinds, creates a fresh shuffled deck, deals private hole cards, and posts blinds. `applyPlayerAction` accepts only actions for the current player and advances completed rounds:

`PREFLOP -> FLOP -> TURN -> RIVER -> SHOWDOWN -> PAYOUT -> HAND_COMPLETE`

Each flop, turn, and river burns before dealing. If everyone remaining is all-in, the engine automatically runs out all remaining streets. If everyone except one player folds, the hand proceeds directly to showdown without exposing or evaluating unnecessary board cards.

`getPublicBoards` and `toPublicState` provide public views without the deck, burn cards, or private hole cards.

## Cards and evaluation

`createDeck`, `shuffleDeck`, `drawCards`, and `burnCard` implement a standard 52-card deck. Production shuffling uses Node's cryptographic `randomInt` with Fisher-Yates; tests may inject a random source. Duplicate cards and overdraws are rejected.

`evaluateFiveCardHand`, `evaluateBestFiveCardHand`, `evaluateConstructedHand`, and `compareHands` implement all standard categories, kickers, wheel straights, exact ties, and best-five selection. Hold'em selects the best five from the available cards. Omaha variants always use exactly two hole cards and exactly three cards from the selected board.

## Betting

Actions are `FOLD`, `CHECK`, `CALL`, `BET`, `RAISE`, and `ALL_IN`. Action amounts are chips committed by that action; a raise amount includes the call. No-limit caps the commit at the player's stack. Pot-limit uses the standard maximum:

`maximum action commit = amount to call + pot after calling = pot before action + 2 * amount to call`

The result is capped by the remaining stack. For example, with a 100-chip pot and 20 to call, the maximum action commit is 140 chips.

The engine tracks each player's amount faced since their last action. A full raise reopens raising for players who acted earlier. A short all-in raise does not reopen those players unless cumulative additional action reaches the configured full-raise threshold; players who have not acted retain their raising rights. Uncalled excess contributions are refunded when a betting round completes.

## Pots and payouts

`calculatePots` creates contribution-tier main and side pots and records eligible non-folded players independently for every tier. All-in players remain eligible for pots they funded; folded players never win.

`resolveShowdown` evaluates each eligible player independently for each pot and board, splits ties, updates stacks, and marks the hand paid exactly once. Multi-board pots are divided as evenly as possible. Any indivisible board-share chip is assigned to the lowest board index first. Indivisible tie chips use deterministic positional order starting immediately after the dealer button and moving clockwise. For an odd chip when splitting a pot between two boards, Board 0 receives the extra chip.

## Variants

- `HOLD_EM_NO_LIMIT`: two hole cards, one board, no-limit betting, normal Hold'em construction.
- `OMAHA_HI`: four hole cards, one board, pot-limit betting, exactly two hole cards plus three board cards.
- `PLO_DOUBLE_BOARD_BOMB_POT`: four hole cards, two independent Omaha boards, pot-limit configuration, and split-pot payout support.

The double-board definition and payout architecture are ready for future bomb-pot dealing rules. The complete playable bomb-pot street/dealing sequence remains deferred to Phase 5.

## Testing

Run the focused package suite with:

```bash
pnpm --filter @poker/engine test
pnpm --filter @poker/engine typecheck
pnpm --filter @poker/engine build
```

The tests cover cards, decks, evaluation, Hold'em and Omaha construction, street progression, community cards, betting, short-raise reopening, positions, pots, showdown, multi-board payouts, and state invariants.
