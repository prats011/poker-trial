# Poker server integration

The server keeps each active hand in the in-memory `Game.pokerState`. Socket
actions are serialized per table, checked against the engine state and current
`stateVersion`, then emitted as recipient-specific `POKER_STATE_SNAPSHOT`
messages. A player receives their own hole cards during play; opponents' cards
are revealed only after payout completes. Deck and burn cards are never
serialized.

The configured turn timer uses a deterministic policy: when a timer expires,
the current player folds if facing a call and checks otherwise. Disconnecting
does not immediately alter the hand; the same timer continues and reconnecting
players receive a fresh authorized snapshot. Timers are cleared when no player
is actionable or a hand completes.

`HOLD_EM_NO_LIMIT` and `OMAHA_HI` are integrated. The double-board bomb-pot
variant remains a definition-only engine variant and is rejected by the server
hand starter until its gameplay sequence is implemented.

## Table lifecycle

`WAITING` and `PREPARING` are the normal lobby and hand-running states.
`PAUSE_PENDING` and `END_PENDING` are safe-boundary requests: the active hand
continues through showdown and payout, then transitions to `PAUSED` or `ENDED`.
`PAUSED` permits rebuy decisions but never starts a hand; `ENDED` invalidates
the invite, rejects poker actions and clears turn/rebuy timers.

After payout, a zero-stack seated player receives one server-owned rebuy offer
for the configured decision window. A valid rebuy is applied only while the
hand is `HAND_COMPLETE`; decline or expiry marks the player sitting out.
Rebuy offers and their absolute expiry are restored on session reconnect.
