import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationPath = path.resolve(__dirname, "../db/migrations/001_initial.sql");

describe("initial migration", () => {
  it("creates foundational tables and constraints", async () => {
    const db = newDb();
    const sql = await fs.readFile(migrationPath, "utf8");
    db.public.none(sql);

    const gamesCols = db.public.many("SELECT column_name FROM information_schema.columns WHERE table_name = 'games'");
    const sessionCols = db.public.many(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'player_sessions'"
    );

    expect(gamesCols.map((row) => row.column_name)).toEqual(
      expect.arrayContaining(["id", "invite_token_hash", "host_session_id_hash", "configuration", "status", "updated_at"])
    );
    expect(sessionCols.map((row) => row.column_name)).toEqual(
      expect.arrayContaining(["session_id_hash", "game_id", "nickname", "seat_index", "is_host", "connection_status", "last_seen_at"])
    );

    const game = db.public.one(
      `INSERT INTO games (id, invite_token_hash, host_session_id_hash, variant, configuration) VALUES ('00000000-0000-0000-0000-000000000001', 'hash-1', 'host-hash', 'HOLD_EM_NO_LIMIT', '{"variant":"HOLD_EM_NO_LIMIT","startingStack":1000,"smallBlind":5,"bigBlind":10,"turnTimerSeconds":30,"maxPlayers":6}') RETURNING id`
    ) as { id: string };
    db.public.none(
      `INSERT INTO player_sessions (session_id_hash, game_id, nickname, seat_index) VALUES ('session-1', '${game.id}', 'alice', 0)`
    );

    expect(() => {
      db.public.none(
        `INSERT INTO player_sessions (session_id_hash, game_id, nickname, seat_index) VALUES ('session-2', '${game.id}', 'ALICE', 1)`
      );
    }).toThrow();

    expect(() => {
      db.public.none(
        `INSERT INTO player_sessions (session_id_hash, game_id, nickname, seat_index) VALUES ('session-3', '${game.id}', 'bob', 0)`
      );
    }).toThrow();
  });
});
