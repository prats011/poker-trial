import type { Server as HttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
import {
  clientEventSchemas,
  type ClientEventName,
  type ClientEventPayload,
  type GameConfiguration
} from "@poker/protocol";
import { GameStore } from "./store";

type BoundSocket = {
  data: { sessionId?: string; gameId?: string };
  id: string;
  join(room: string): Promise<void>;
  leave(room: string): Promise<void>;
  emit(event: string, payload: unknown): boolean;
  on(event: string, handler: (payload?: unknown) => void): void;
};

const errorMessages: Record<string, string> = {
  INVALID_PAYLOAD: "That action was invalid.",
  UNAUTHORIZED: "You are not allowed to perform that action.",
  SESSION_EXPIRED: "Your session has expired. Please join again.",
  SEAT_OCCUPIED: "That seat is already occupied.",
  NO_SEAT: "That seat is not available.",
  GAME_STARTED: "The game has already started.",
  RATE_LIMITED: "Please wait a moment before sending another message."
};

export function registerSocket(httpServer: HttpServer, frontendUrl: string, store: GameStore) {
  const io = new Server(httpServer, { cors: { origin: frontendUrl } });
  const lastChatAt = new Map<string, number>();

  const reject = (socket: BoundSocket, event: string, code: string, message?: string) => {
    socket.emit("ACTION_REJECTED", { event, code, message: message ?? errorMessages[code] ?? "Action rejected." });
  };

  const broadcastState = (gameId: string) => {
    const game = store.getGame(gameId);
    if (game) io.to(gameId).emit("TABLE_STATE_SNAPSHOT", { tableState: store.snapshot(game) });
  };

  io.on("connection", (socket) => {
    const boundSocket = socket as unknown as BoundSocket;
    const bindValidated = <TEvent extends ClientEventName>(
      event: TEvent,
      handler: (payload: ClientEventPayload<TEvent>) => void
    ) => {
      socket.on(event as never, ((payload: unknown) => {
        const parsed = clientEventSchemas[event].safeParse(payload);
        if (!parsed.success) {
          reject(boundSocket, event, "INVALID_PAYLOAD", `Invalid payload for ${event}.`);
          return;
        }
        handler(parsed.data as ClientEventPayload<TEvent>);
      }) as never);
    };

    bindValidated("JOIN_TABLE", async (payload) => {
      const game = store.getGameByInvite(payload.inviteToken);
      if (!game) return reject(boundSocket, "JOIN_TABLE", "INVALID_INVITE", "This invitation link is invalid or expired.");
      const session = store.getSession(payload.sessionId ?? "");
      if (!session || session.gameId !== game.id) {
        return reject(boundSocket, "JOIN_TABLE", "SESSION_EXPIRED");
      }
      boundSocket.data.sessionId = session.id;
      boundSocket.data.gameId = game.id;
      await socket.join(game.id);
      const wasConnected = session.connectionStatus === "CONNECTED";
      store.setConnection(session, true);
      if (!wasConnected) {
        io.to(game.id).emit("PLAYER_JOINED", { player: store.snapshot(game).players.find((player) => player.sessionId === session.id), stateVersion: game.stateVersion });
      }
      broadcastState(game.id);
      io.to(game.id).emit("PLAYER_PRESENCE", { sessionId: session.id, connectionStatus: "CONNECTED", stateVersion: game.stateVersion });
    });

    bindValidated("REQUEST_SEAT", (payload) => {
      const session = store.getSession(boundSocket.data.sessionId ?? "");
      const game = session && store.getGame(session.gameId);
      if (!session || !game || boundSocket.data.gameId !== game.id) return reject(boundSocket, "REQUEST_SEAT", "SESSION_EXPIRED");
      try {
        store.requestSeat(game, session, payload.seatIndex);
        io.to(game.id).emit("SEAT_UPDATED", { seats: store.snapshot(game).seats, stateVersion: game.stateVersion });
      } catch (error) {
        reject(boundSocket, "REQUEST_SEAT", error instanceof Error ? error.message : "NO_SEAT");
      }
    });

    bindValidated("LEAVE_SEAT", () => {
      const session = store.getSession(boundSocket.data.sessionId ?? "");
      const game = session && store.getGame(session.gameId);
      if (!session || !game) return reject(boundSocket, "LEAVE_SEAT", "SESSION_EXPIRED");
      store.leaveSeat(game, session);
      io.to(game.id).emit("SEAT_UPDATED", { seats: store.snapshot(game).seats, stateVersion: game.stateVersion });
    });

    bindValidated("UPDATE_GAME_SETTINGS", (configuration: GameConfiguration) => {
      const session = store.getSession(boundSocket.data.sessionId ?? "");
      const game = session && store.getGame(session.gameId);
      if (!session || !game) return reject(boundSocket, "UPDATE_GAME_SETTINGS", "SESSION_EXPIRED");
      if (!session.isHost) return reject(boundSocket, "UPDATE_GAME_SETTINGS", "UNAUTHORIZED");
      if (game.status !== "WAITING") return reject(boundSocket, "UPDATE_GAME_SETTINGS", "GAME_STARTED");
      store.updateSettings(game, configuration);
      io.to(game.id).emit("GAME_SETTINGS_UPDATED", { configuration, stateVersion: game.stateVersion });
      broadcastState(game.id);
    });

    bindValidated("START_GAME", () => {
      const session = store.getSession(boundSocket.data.sessionId ?? "");
      const game = session && store.getGame(session.gameId);
      if (!session || !game) return reject(boundSocket, "START_GAME", "SESSION_EXPIRED");
      if (!session.isHost) return reject(boundSocket, "START_GAME", "UNAUTHORIZED");
      store.start(game);
      io.to(game.id).emit("GAME_STATUS_UPDATED", { status: game.status, stateVersion: game.stateVersion });
      broadcastState(game.id);
    });

    bindValidated("REMOVE_PLAYER", (payload) => {
      const session = store.getSession(boundSocket.data.sessionId ?? "");
      const game = session && store.getGame(session.gameId);
      if (!session || !game) return reject(boundSocket, "REMOVE_PLAYER", "SESSION_EXPIRED");
      if (!session.isHost) return reject(boundSocket, "REMOVE_PLAYER", "UNAUTHORIZED");
      try {
        const removed = store.removeSession(game, payload.sessionId);
        io.to(game.id).emit("PLAYER_LEFT", { sessionId: removed.id, stateVersion: game.stateVersion });
        broadcastState(game.id);
      } catch (error) {
        reject(boundSocket, "REMOVE_PLAYER", error instanceof Error ? error.message : "NOT_FOUND");
      }
    });

    bindValidated("CHAT_SEND", (payload) => {
      const session = store.getSession(boundSocket.data.sessionId ?? "");
      const game = session && store.getGame(session.gameId);
      if (!session || !game) return reject(boundSocket, "CHAT_SEND", "SESSION_EXPIRED");
      const now = Date.now();
      if (now - (lastChatAt.get(session.id) ?? 0) < 500) return reject(boundSocket, "CHAT_SEND", "RATE_LIMITED");
      lastChatAt.set(session.id, now);
      io.to(game.id).emit("CHAT_MESSAGE", {
        messageId: randomUUID(),
        senderNickname: session.nickname,
        message: payload.message,
        createdAt: new Date(now).toISOString()
      });
    });

    socket.on("disconnect", () => {
      const session = store.getSession(boundSocket.data.sessionId ?? "");
      if (!session) return;
      const game = store.getGame(session.gameId);
      if (!game) return;
      store.setConnection(session, false);
      io.to(game.id).emit("PLAYER_PRESENCE", { sessionId: session.id, connectionStatus: "DISCONNECTED", stateVersion: game.stateVersion });
    });
  });
  return io;
}
