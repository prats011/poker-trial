import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { AppError } from "./errors";
import { loadEnv, type AppEnv } from "./env";
import { registerSocket } from "./socket";

export type AppServer = {
  app: ReturnType<typeof Fastify>;
  env: AppEnv;
};

export async function createServer(overrides?: Partial<AppEnv>): Promise<AppServer> {
  const env = { ...loadEnv(), ...overrides };
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: env.FRONTEND_URL });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_TIME_WINDOW
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      reply.status(error.statusCode).send({ error: error.safeMessage });
      return;
    }

    reply.status(500).send({ error: "Internal server error" });
  });

  registerSocket(app.server, env.FRONTEND_URL);

  return { app, env };
}
