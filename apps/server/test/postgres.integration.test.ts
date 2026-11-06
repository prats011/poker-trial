import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { GameStore } from "../src/store";
import { PostgresPersistence } from "../src/db/persistence";

const connectionString = process.env.POSTGRES_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const enabled = process.env.RUN_POSTGRES_INTEGRATION === "1" && Boolean(connectionString);
const describePostgres = enabled ? describe : describe.skip;

async function waitFor<T>(read: () => Promise<T | undefined>, timeoutMs = 3000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await read();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for PostgreSQL persistence.");
}

describePostgres("PostgreSQL persistence", () => {
  it("persists hashed invites, sessions, configuration, seats, and timestamps", async () => {
    const admin = new pg.Client({ connectionString });
    await admin.connect();
    const schema = `phase1_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.end();

    const pool = new pg.Pool({
      connectionString,
      options: `-c search_path=${schema}`
    });
    try {
      const migration = await fs.readFile(
        path.resolve(import.meta.dirname, "../db/migrations/001_initial.sql"),
        "utf8"
      );
      await pool.query(migration);
      const store = new GameStore(new PostgresPersistence(pool));
      const configuration = {
        variant: "HOLD_EM_NO_LIMIT" as const,
        startingStack: 1000,
        smallBlind: 5,
        bigBlind: 10,
        turnTimerSeconds: 30,
        maxPlayers: 6
      };
      const created = store.createGame(configuration, "Host");
      const game = await waitFor(async () => {
        const result = await pool.query("SELECT * FROM games WHERE id = $1", [created.game.id]);
        return result.rowCount ? result : undefined;
      });
      const session = await waitFor(async () => {
        const result = await pool.query("SELECT * FROM player_sessions WHERE game_id = $1", [created.game.id]);
        return result.rowCount ? result : undefined;
      });
      expect(game.rowCount).toBe(1);
      expect(game.rows[0].invite_token_hash).not.toBe(created.inviteToken);
      expect(game.rows[0].configuration).toEqual({
        ...configuration,
        rebuysEnabled: true,
        rebuyMinAmount: 100,
        rebuyMaxAmount: 1000,
        rebuyDecisionTimeSec: 15
      });
      expect(session.rowCount).toBe(1);
      expect(session.rows[0].session_id_hash).not.toBe(created.session.id);

      store.requestSeat(created.game, created.session, 2);
      const updated = await waitFor(async () => {
        const result = await pool.query(
          "SELECT seat_index, updated_at FROM player_sessions JOIN games ON games.id = player_sessions.game_id WHERE games.id = $1",
          [created.game.id]
        );
        return result.rows[0]?.seat_index === 2 ? result : undefined;
      });
      expect(updated.rows[0].seat_index).toBe(2);
      expect(updated.rows[0].updated_at).toBeDefined();

      created.game.status = "PAUSED";
      store.markGameChanged(created.game);
      const paused = await waitFor(async () => {
        const result = await pool.query("SELECT status FROM games WHERE id = $1", [created.game.id]);
        return result.rows[0]?.status === "PAUSED" ? result : undefined;
      });
      expect(paused.rows[0].status).toBe("PAUSED");

      created.game.status = "ENDED";
      store.markGameChanged(created.game);
      const ended = await waitFor(async () => {
        const result = await pool.query("SELECT status FROM games WHERE id = $1", [created.game.id]);
        return result.rows[0]?.status === "ENDED" ? result : undefined;
      });
      expect(ended.rows[0].status).toBe("ENDED");
    } finally {
      await pool.end();
      const cleanup = new pg.Client({ connectionString });
      await cleanup.connect();
      await cleanup.query(`DROP SCHEMA "${schema}" CASCADE`);
      await cleanup.end();
    }
  });
});
