import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { io as clientIo, type Socket } from "socket.io-client";
import { createServer } from "../src/server";

process.env.DATABASE_URL = process.env.DATABASE_URL ?? "******localhost:5432/poker_trial";
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
process.env.RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX ?? "100";
process.env.RATE_LIMIT_TIME_WINDOW = process.env.RATE_LIMIT_TIME_WINDOW ?? "60000";

let appServer: Awaited<ReturnType<typeof createServer>>;
let socketClient: Socket | undefined;
let baseUrl = "";

beforeEach(async () => {
  appServer = await createServer({ SERVER_PORT: 0 });
  await appServer.app.listen({ port: 0, host: "127.0.0.1" });
  const address = appServer.app.server.address();
  if (typeof address === "string" || !address) {
    throw new Error("Failed to resolve server address");
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  if (socketClient?.connected) {
    socketClient.disconnect();
  }
  await appServer.app.close();
});

describe("server foundation", () => {
  it("returns health status", async () => {
    const response = await request(baseUrl).get("/health");
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("accepts socket connections", async () => {
    await new Promise<void>((resolve, reject) => {
      socketClient = clientIo(baseUrl, {
        transports: ["websocket"]
      });

      socketClient.on("connect", () => resolve());
      socketClient.on("connect_error", reject);
    });

    expect(socketClient?.connected).toBe(true);
  });

  it("rejects invalid event payload with ACTION_REJECTED", async () => {
    await new Promise<void>((resolve, reject) => {
      socketClient = clientIo(baseUrl, { transports: ["websocket"] });
      socketClient.on("connect", () => resolve());
      socketClient.on("connect_error", reject);
    });

    const payload = await new Promise<{ event: string; code: string; message: string }>((resolve) => {
      socketClient?.on("ACTION_REJECTED", (eventPayload) => resolve(eventPayload));
      socketClient?.emit("JOIN_TABLE", { nickname: "only-nickname" });
    });

    expect(payload.code).toBe("INVALID_PAYLOAD");
    expect(payload.event).toBe("JOIN_TABLE");
  });
});
