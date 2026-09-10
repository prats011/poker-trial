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
      expect.arrayContaining(["id", "variant", "state_version", "created_at"])
    );
    expect(sessionCols.map((row) => row.column_name)).toEqual(
      expect.arrayContaining(["id", "game_id", "socket_id", "nickname", "seat_index", "created_at"])
    );

    const game = db.public.one(`INSERT INTO games (variant) VALUES ('HOLD_EM_NO_LIMIT') RETURNING id`) as { id: number };
    db.public.none(
      `INSERT INTO player_sessions (game_id, socket_id, nickname, seat_index) VALUES (${game.id}, 'sock-1', 'alice', 0)`
    );

    expect(() => {
      db.public.none(
        `INSERT INTO player_sessions (game_id, socket_id, nickname, seat_index) VALUES (${game.id}, 'sock-2', 'alice', 1)`
      );
    }).toThrow();

    expect(() => {
      db.public.none(
        `INSERT INTO player_sessions (game_id, socket_id, nickname, seat_index) VALUES (${game.id}, 'sock-3', 'bob', 0)`
      );
    }).toThrow();
  });
});
