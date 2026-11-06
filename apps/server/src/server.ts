import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { createGameSchema, gameConfigurationSchema, joinTableSchema } from "@poker/protocol";
import { AppError } from "./errors";
import { loadEnv, type AppEnv } from "./env";
import { GameStore } from "./store";
import pg from "pg";
import { PostgresPersistence } from "./db/persistence";
import { registerSocket } from "./socket";

export type AppServer = {
  app: ReturnType<typeof Fastify>;
  env: AppEnv;
  store: GameStore;
};

export async function createServer(overrides?: Partial<AppEnv>): Promise<AppServer> {
  const env = { ...loadEnv(), ...overrides };
  const app = Fastify({ logger: false });
  const pool = /^postgres(?:ql)?:\/\//.test(env.DATABASE_URL) ? new pg.Pool({ connectionString: env.DATABASE_URL }) : undefined;
  const store = new GameStore(pool ? new PostgresPersistence(pool) : undefined);
  if (pool) app.addHook("onClose", async () => { await pool.end(); });
  await app.register(cors, { origin: env.FRONTEND_URL });
  await app.register(rateLimit, { max: env.RATE_LIMIT_MAX, timeWindow: env.RATE_LIMIT_TIME_WINDOW });
  app.get("/health", async () => ({ status: "ok" }));

  app.post("/api/games", async (request, reply) => {
    const parsed = createGameSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid game configuration or nickname." });
    const result = store.createGame(parsed.data.configuration, parsed.data.nickname);
    return reply.status(201).send({
      gameId: result.game.id,
      inviteToken: result.inviteToken,
      sessionId: result.session.id,
      tableState: store.snapshot(result.game)
    });
  });

  app.get<{ Params: { inviteToken: string } }>("/api/games/:inviteToken", async (request, reply) => {
    const game = store.getGameByInvite(request.params.inviteToken);
    if (!game) return reply.status(404).send({ error: "This invitation link is invalid or expired." });
    return { configuration: game.configuration, status: game.status, availableSeats: game.configuration.maxPlayers - game.sessions.size };
  });

  app.post<{ Params: { inviteToken: string } }>("/api/games/:inviteToken/join", async (request, reply) => {
    const parsed = joinTableSchema.safeParse({ ...request.body as object, inviteToken: request.params.inviteToken });
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid nickname." });
    const game = store.getGameByInvite(parsed.data.inviteToken);
    if (!game) return reply.status(404).send({ error: "This invitation link is invalid or expired." });
    try {
      const result = store.join(game, parsed.data.nickname, parsed.data.sessionId);
      return { gameId: game.id, sessionId: result.session.id, tableState: store.snapshot(game) };
    } catch (error) {
      const code = error instanceof Error ? error.message : "NOT_FOUND";
      const messages: Record<string, string> = {
        GAME_STARTED: "This game has already started.",
        TABLE_FULL: "This table is full.",
        NICKNAME_TAKEN: "That nickname is already taken.",
        SESSION_EXPIRED: "Your session has expired. Please join again.",
        UNAUTHORIZED: "That session does not match this nickname.",
        GAME_ENDED: "This game has ended."
      };
      return reply.status(code === "SESSION_EXPIRED" || code === "UNAUTHORIZED" ? 401 : 409)
        .send({ error: messages[code] ?? "Unable to join this game." });
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) return reply.status(error.statusCode).send({ error: error.safeMessage });
    return reply.status(500).send({ error: "Internal server error" });
  });
  registerSocket(app.server, env.FRONTEND_URL, store);
  return { app, env, store };
}
