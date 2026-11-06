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

  it("creates isolated games, joins players, synchronizes seats, permissions, and chat", async () => {
    const created = await request(baseUrl).post("/api/games").send({
      nickname: "Host",
      configuration: {
        variant: "HOLD_EM_NO_LIMIT",
        startingStack: 1000,
        smallBlind: 5,
        bigBlind: 10,
        turnTimerSeconds: 30,
        maxPlayers: 2
      }
    });
    expect(created.statusCode).toBe(201);
    expect(created.body.inviteToken).toHaveLength(43);
    const joined = await request(baseUrl).post(`/api/games/${created.body.inviteToken}/join`).send({ nickname: "Player 2" });
    expect(joined.statusCode).toBe(200);
    expect(joined.body.tableState.players).toHaveLength(2);

    const hostSocket = clientIo(baseUrl, { transports: ["websocket"] });
    const playerSocket = clientIo(baseUrl, { transports: ["websocket"] });
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        hostSocket.on("connect", () => {
          hostSocket.emit("JOIN_TABLE", { inviteToken: created.body.inviteToken, nickname: "Host", sessionId: created.body.sessionId });
          resolve();
        });
        hostSocket.on("connect_error", reject);
      }),
      new Promise<void>((resolve, reject) => {
        playerSocket.on("connect", () => {
          playerSocket.emit("JOIN_TABLE", { inviteToken: created.body.inviteToken, nickname: "Player 2", sessionId: joined.body.sessionId });
          resolve();
        });
        playerSocket.on("connect_error", reject);
      })
    ]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const seatUpdates = new Promise<Array<{ occupiedByNickname: string | null }>>((resolve) => {
      hostSocket.once("SEAT_UPDATED", (payload) => resolve(payload.seats));
    });
    hostSocket.emit("REQUEST_SEAT", { seatIndex: 0 });
    playerSocket.emit("REQUEST_SEAT", { seatIndex: 1 });
    const settingsRejected = new Promise<{ code: string }>((resolve) => playerSocket.once("ACTION_REJECTED", resolve));
    playerSocket.emit("UPDATE_GAME_SETTINGS", {
      variant: "HOLD_EM_NO_LIMIT", startingStack: 1000, smallBlind: 5, bigBlind: 10, turnTimerSeconds: 30, maxPlayers: 2
    });
    expect((await settingsRejected).code).toBe("UNAUTHORIZED");
    const chat = new Promise<{ senderNickname: string; message: string }>((resolve) => playerSocket.once("CHAT_MESSAGE", resolve));
    hostSocket.emit("CHAT_SEND", { message: "Welcome" });
    expect(await chat).toMatchObject({ senderNickname: "Host", message: "Welcome" });
    expect((await seatUpdates).some((seat) => seat.occupiedByNickname === "Host")).toBe(true);
    hostSocket.disconnect();
    playerSocket.disconnect();
  });

  it("rejects invalid configuration, invalid invites, and duplicate nicknames", async () => {
    const invalid = await request(baseUrl).post("/api/games").send({
      nickname: "Host",
      configuration: { variant: "HOLD_EM_NO_LIMIT", startingStack: 0, smallBlind: 10, bigBlind: 5, turnTimerSeconds: 30, maxPlayers: 2 }
    });
    expect(invalid.statusCode).toBe(400);
    expect((await request(baseUrl).get("/api/games/not-a-real-token")).statusCode).toBe(404);
    const created = await request(baseUrl).post("/api/games").send({
      nickname: "Host",
      configuration: { variant: "HOLD_EM_NO_LIMIT", startingStack: 1000, smallBlind: 5, bigBlind: 10, turnTimerSeconds: 30, maxPlayers: 6 }
    });
    const duplicate = await request(baseUrl).post(`/api/games/${created.body.inviteToken}/join`).send({ nickname: " hOsT " });
    expect(duplicate.statusCode).toBe(409);
  });

  it("restores a session and rejects invalid session impersonation", async () => {
    const created = await request(baseUrl).post("/api/games").send({
      nickname: "Host",
      configuration: { variant: "HOLD_EM_NO_LIMIT", startingStack: 1000, smallBlind: 5, bigBlind: 10, turnTimerSeconds: 30, maxPlayers: 6 }
    });
    const restored = await request(baseUrl).post(`/api/games/${created.body.inviteToken}/join`).send({
      nickname: "Host",
      sessionId: created.body.sessionId
    });
    expect(restored.statusCode).toBe(200);
    expect(restored.body.sessionId).toBe(created.body.sessionId);
    const invalid = await request(baseUrl).post(`/api/games/${created.body.inviteToken}/join`).send({
      nickname: "Someone",
      sessionId: "invalid-session-id-that-must-not-create-a-player"
    });
    expect(invalid.statusCode).toBe(401);
    expect(invalid.body.error).toContain("session");
  });
});
