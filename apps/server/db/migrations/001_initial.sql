CREATE TABLE games (
  id BIGSERIAL PRIMARY KEY,
  variant TEXT NOT NULL,
  state_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE player_sessions (
  id BIGSERIAL PRIMARY KEY,
  game_id BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  socket_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  seat_index INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, nickname)
);

CREATE UNIQUE INDEX player_sessions_unique_seat_per_game
  ON player_sessions(game_id, seat_index)
  WHERE seat_index IS NOT NULL;

CREATE INDEX player_sessions_game_id_idx ON player_sessions(game_id);
