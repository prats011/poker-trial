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
