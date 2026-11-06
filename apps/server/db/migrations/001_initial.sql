CREATE TABLE games (
  id UUID PRIMARY KEY,
  invite_token_hash TEXT NOT NULL UNIQUE,
  host_session_id_hash TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('HOLD_EM_NO_LIMIT', 'OMAHA_HI', 'PLO_DOUBLE_BOARD_BOMB_POT')),
  configuration JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'PREPARING', 'PAUSE_PENDING', 'PAUSED', 'END_PENDING', 'ENDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE player_sessions (
  session_id_hash TEXT PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  seat_index INTEGER,
  is_host BOOLEAN NOT NULL DEFAULT FALSE,
  connection_status TEXT NOT NULL DEFAULT 'DISCONNECTED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE (game_id, nickname)
);

CREATE UNIQUE INDEX player_sessions_unique_nickname_ci ON player_sessions(game_id, lower(nickname));
CREATE UNIQUE INDEX player_sessions_unique_seat_per_game ON player_sessions(game_id, seat_index) WHERE seat_index IS NOT NULL;
CREATE INDEX player_sessions_game_id_idx ON player_sessions(game_id);
