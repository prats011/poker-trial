import pg from "pg";
import { hashSecret, type StorePersistence, type Game, type Session } from "../store";

function gameParams(game: Game) {
  return [
    game.id,
    game.inviteTokenHash,
    hashSecret(game.hostSessionId),
    game.configuration.variant,
    JSON.stringify(game.configuration),
    game.status,
    game.createdAt,
    game.updatedAt
  ];
}

export class PostgresPersistence implements StorePersistence {
  constructor(private readonly pool: pg.Pool) {}

  private async insertGame(client: pg.PoolClient, game: Game) {
    await client.query(
      `INSERT INTO games (id, invite_token_hash, host_session_id_hash, variant, configuration, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET configuration=$5::jsonb,status=$6,updated_at=$8`,
      gameParams(game)
    );
  }

  private async insertSession(client: pg.PoolClient, game: Game, session: Session) {
    await client.query(
      `INSERT INTO player_sessions (session_id_hash, game_id, nickname, seat_index, is_host, connection_status, created_at, last_seen_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (session_id_hash) DO UPDATE SET nickname=$3,seat_index=$4,connection_status=$6,last_seen_at=$8`,
      [hashSecret(session.id), game.id, session.nickname, session.seatIndex, session.isHost, session.connectionStatus, session.createdAt, session.lastSeenAt]
    );
  }

  async saveGameAndSession(game: Game, session: Session) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.insertGame(client, game);
      await this.insertSession(client, game, session);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async saveSession(game: Game, session: Session) {
    await this.pool.query(
      `INSERT INTO player_sessions (session_id_hash, game_id, nickname, seat_index, is_host, connection_status, created_at, last_seen_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (session_id_hash) DO UPDATE SET nickname=$3,seat_index=$4,connection_status=$6,last_seen_at=$8`,
      [hashSecret(session.id), game.id, session.nickname, session.seatIndex, session.isHost, session.connectionStatus, session.createdAt, session.lastSeenAt]
    );
  }

  async updateGame(game: Game) {
    await this.pool.query(
      `UPDATE games SET configuration=$2::jsonb,status=$3,updated_at=$4 WHERE id=$1`,
      [game.id, JSON.stringify(game.configuration), game.status, game.updatedAt]
    );
  }

  async updateSession(session: Session) {
    await this.pool.query(
      `UPDATE player_sessions SET nickname=$2,seat_index=$3,connection_status=$4,last_seen_at=$5 WHERE session_id_hash=$1`,
      [hashSecret(session.id), session.nickname, session.seatIndex, session.connectionStatus, session.lastSeenAt]
    );
  }

  async deleteSession(_game: Game, sessionId: string) {
    await this.pool.query("DELETE FROM player_sessions WHERE session_id_hash=$1", [hashSecret(sessionId)]);
  }
}
