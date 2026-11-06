import type { Server as HttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
import {
  clientEventSchemas,
  type ClientEventName,
  type ClientEventPayload,
  type GameConfiguration,
  type PokerAction
} from "@poker/protocol";
import { GameStore } from "./store";
import { applyPokerAction, applyRebuy, serializePokerState, startPokerHand } from "./poker";

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
  RATE_LIMITED: "Please wait a moment before sending another message.",
  REBUY_NOT_AVAILABLE: "A rebuy is not currently available.",
  INVALID_REBUY_AMOUNT: "That rebuy amount is not allowed.",
  GAME_ENDED: "This game has ended."
};

export function registerSocket(httpServer: HttpServer, frontendUrl: string, store: GameStore) {
  const io = new Server(httpServer, { cors: { origin: frontendUrl } });
  const lastChatAt = new Map<string, number>();
  const tableQueues = new Map<string, Promise<void>>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const rebuyTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const reject = (socket: BoundSocket, event: string, code: string, message?: string) => {
    socket.emit("ACTION_REJECTED", { event, code, message: message ?? errorMessages[code] ?? "Action rejected." });
  };

  const broadcastState = (gameId: string) => {
    const game = store.getGame(gameId);
    if (game) io.to(gameId).emit("TABLE_STATE_SNAPSHOT", { tableState: store.snapshot(game) });
  };

  const broadcastPokerState = async (gameId: string) => {
    const game = store.getGame(gameId);
    if (!game?.pokerState) return;
    for (const connected of await io.in(gameId).fetchSockets()) {
      const sessionId = (connected.data as { sessionId?: string }).sessionId;
      if (sessionId) {
        const pokerState = serializePokerState(game, sessionId);
        if (pokerState) connected.emit("POKER_STATE_SNAPSHOT", { pokerState });
      }
    }
  };

  const clearTimer = (gameId: string) => {
    const timer = timers.get(gameId);
    if (timer) clearTimeout(timer);
    timers.delete(gameId);
  };

  const clearRebuyTimers = (gameId: string) => {
    for (const [key, timer] of rebuyTimers) {
      if (key.startsWith(`${gameId}:`)) {
        clearTimeout(timer);
        rebuyTimers.delete(key);
      }
    }
    store.getGame(gameId)?.rebuyOffers.clear();
  };

  const emitLifecycle = (gameId: string) => {
    const game = store.getGame(gameId);
    if (!game) return;
    io.to(gameId).emit("GAME_LIFECYCLE_UPDATED", { status: game.status, stateVersion: game.stateVersion });
    io.to(gameId).emit("GAME_STATUS_UPDATED", { status: game.status, stateVersion: game.stateVersion });
    broadcastState(gameId);
  };

  const endGame = (gameId: string) => {
    const game = store.getGame(gameId);
    if (!game || game.status === "ENDED") return;
    clearTimer(gameId);
    clearRebuyTimers(gameId);
    game.status = "ENDED";
    store.invalidateInvite(game);
    store.markGameChanged(game);
    io.to(gameId).emit("GAME_ENDED", { reason: "The host ended the game." });
    emitLifecycle(gameId);
  };

  const settleHandLifecycle = (gameId: string) => {
    const game = store.getGame(gameId);
    if (!game?.pokerState || game.pokerState.status !== "HAND_COMPLETE") return;
    clearTimer(gameId);
    if (game.status === "END_PENDING") return endGame(gameId);
    for (const session of game.sessions.values()) {
      const player = game.pokerState.players.find((item) => item.id === session.id);
      if (!player || player.stack !== 0 || session.seatIndex === null) continue;
      if (!game.configuration.rebuysEnabled) {
        session.sittingOut = true;
        player.active = false;
        continue;
      }
      const expiresAt = Date.now() + game.configuration.rebuyDecisionTimeSec * 1000;
      game.rebuyOffers.set(session.id, { expiresAt });
      io.to(gameId).emit("REBUY_STATUS_UPDATED", {
        sessionId: session.id, eligible: true, expiresAt: new Date(expiresAt).toISOString(),
        remainingSeconds: game.configuration.rebuyDecisionTimeSec
      });
      const key = `${gameId}:${session.id}`;
      rebuyTimers.set(key, setTimeout(() => {
        void enqueue(gameId, () => {
          const current = store.getGame(gameId);
          if (!current?.rebuyOffers.delete(session.id)) return;
          session.sittingOut = true;
          const currentPlayer = current.pokerState?.players.find((item) => item.id === session.id);
          if (currentPlayer) currentPlayer.active = false;
          store.markGameChanged(current);
          io.to(gameId).emit("REBUY_STATUS_UPDATED", { sessionId: session.id, eligible: false, expiresAt: null, remainingSeconds: null });
          broadcastState(gameId);
        });
      }, game.configuration.rebuyDecisionTimeSec * 1000));
    }
    if (game.status === "PAUSE_PENDING") {
      game.status = "PAUSED";
      store.markGameChanged(game);
      emitLifecycle(gameId);
    } else {
      broadcastState(gameId);
    }
  };

  const scheduleTimer = (gameId: string) => {
    clearTimer(gameId);
    const game = store.getGame(gameId);
    const currentPlayerId = game?.pokerState?.currentPlayerId;
    if (!game || game.status !== "PREPARING" || !currentPlayerId || game.pokerState?.status === "HAND_COMPLETE") return;
    const delay = game.configuration.turnTimerSeconds * 1000;
    timers.set(gameId, setTimeout(() => {
      void enqueue(gameId, async () => {
        const current = store.getGame(gameId);
        if (!current?.pokerState || current.pokerState.currentPlayerId !== currentPlayerId) return;
        const player = current.pokerState.players.find((item) => item.id === currentPlayerId);
        if (!player) return;
        const toCall = Math.max(0, current.pokerState.currentBet - player.streetContribution);
        try {
          applyPokerAction(current, currentPlayerId, toCall > 0 ? { type: "FOLD" } : { type: "CHECK" });
          store.markGameChanged(current);
          await broadcastPokerState(gameId);
          broadcastState(gameId);
          settleHandLifecycle(gameId);
          scheduleTimer(gameId);
        } catch (error) {
          console.error("Poker turn timeout action failed:", error);
          clearTimer(gameId);
        }
      });
    }, delay));
  };

  const enqueue = (gameId: string, operation: () => Promise<void> | void) => {
    const previous = tableQueues.get(gameId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    tableQueues.set(gameId, next.finally(() => {
      if (tableQueues.get(gameId) === next) tableQueues.delete(gameId);
    }));
    return next;
  };

  const engineErrorCode = (error: unknown) => {
    if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code;
    if (error instanceof Error && error.message === "STALE_STATE") return "STALE_STATE";
    return "ACTION_NOT_ALLOWED";
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
      void broadcastPokerState(game.id);
      const offer = game.rebuyOffers.get(session.id);
      if (offer) {
        socket.emit("REBUY_STATUS_UPDATED", {
          sessionId: session.id,
          eligible: offer.expiresAt > Date.now(),
          expiresAt: offer.expiresAt > Date.now() ? new Date(offer.expiresAt).toISOString() : null,
          remainingSeconds: offer.expiresAt > Date.now() ? Math.ceil((offer.expiresAt - Date.now()) / 1000) : null
        });
      }
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
      void enqueue(game.id, async () => {
        try {
          if (game.status !== "WAITING" && !(game.status === "PREPARING" && game.pokerState?.status === "HAND_COMPLETE")) {
            throw new Error("INVALID_GAME_STATE");
          }
          if (game.rebuyOffers.size > 0) throw new Error("INVALID_GAME_STATE");
          if (game.status === "PREPARING" && game.pokerState?.status !== "HAND_COMPLETE") {
            return reject(boundSocket, "START_GAME", "INVALID_GAME_STATE", "The current hand is still in progress.");
          }
          store.start(game);
          startPokerHand(game);
          store.markGameChanged(game);
          io.to(game.id).emit("GAME_STATUS_UPDATED", { status: game.status, stateVersion: game.stateVersion });
          broadcastState(game.id);
          await broadcastPokerState(game.id);
          scheduleTimer(game.id);
        } catch (error) {
          reject(boundSocket, "START_GAME", engineErrorCode(error), error instanceof Error ? error.message : undefined);
        }
      });
    });

    bindValidated("PAUSE_GAME", () => {
      const session = store.getSession(boundSocket.data.sessionId ?? "");
      const game = session && store.getGame(session.gameId);
      if (!session || !game) return reject(boundSocket, "PAUSE_GAME", "SESSION_EXPIRED");
      if (!session.isHost) return reject(boundSocket, "PAUSE_GAME", "UNAUTHORIZED");
      void enqueue(game.id, () => {
        if (game.status === "ENDED" || game.status === "END_PENDING") return reject(boundSocket, "PAUSE_GAME", "GAME_ENDED");
        if (game.status === "PAUSED" || game.status === "PAUSE_PENDING") return;
        game.status = game.status === "PREPARING" && game.pokerState?.status !== "HAND_COMPLETE" ? "PAUSE_PENDING" : "PAUSED";
        store.markGameChanged(game);
        emitLifecycle(game.id);
      });
    });

    bindValidated("RESUME_GAME", () => {
      const session = store.getSession(boundSocket.data.sessionId ?? "");
      const game = session && store.getGame(session.gameId);
      if (!session || !game) return reject(boundSocket, "RESUME_GAME", "SESSION_EXPIRED");
      if (!session.isHost) return reject(boundSocket, "RESUME_GAME", "UNAUTHORIZED");
      void enqueue(game.id, () => {
        if (game.status !== "PAUSED") return reject(boundSocket, "RESUME_GAME", "INVALID_GAME_STATE");
        game.status = "WAITING";
        store.markGameChanged(game);
        emitLifecycle(game.id);
      });
    });

    bindValidated("END_GAME", () => {
      const session = store.getSession(boundSocket.data.sessionId ?? "");
      const game = session && store.getGame(session.gameId);
      if (!session || !game) return reject(boundSocket, "END_GAME", "SESSION_EXPIRED");
      if (!session.isHost) return reject(boundSocket, "END_GAME", "UNAUTHORIZED");
      void enqueue(game.id, () => {
        if (game.status === "ENDED" || game.status === "END_PENDING") return;
        if (game.status === "PREPARING" && game.pokerState?.status !== "HAND_COMPLETE") {
          game.status = "END_PENDING";
          clearRebuyTimers(game.id);
          store.markGameChanged(game);
          emitLifecycle(game.id);
        } else {
          endGame(game.id);
        }
      });
    });

    bindValidated("REBUY_REQUEST", (payload) => {
      const session = store.getSession(boundSocket.data.sessionId ?? "");
      const game = session && store.getGame(session.gameId);
      if (!session || !game) return reject(boundSocket, "REBUY_REQUEST", "SESSION_EXPIRED");
      void enqueue(game.id, async () => {
        const offer = game.rebuyOffers.get(session.id);
        const maximum = game.configuration.rebuyMaxAmount ?? game.configuration.startingStack;
        if (!offer || offer.expiresAt <= Date.now() || !game.configuration.rebuysEnabled || game.status === "END_PENDING" || game.status === "ENDED") {
          return reject(boundSocket, "REBUY_REQUEST", "REBUY_NOT_AVAILABLE");
        }
        if (!Number.isSafeInteger(payload.amount) || payload.amount < game.configuration.rebuyMinAmount || payload.amount > maximum) {
          return reject(boundSocket, "REBUY_REQUEST", "INVALID_REBUY_AMOUNT");
        }
        try {
          applyRebuy(game, session.id, payload.amount);
          const timer = rebuyTimers.get(`${game.id}:${session.id}`);
          if (timer) clearTimeout(timer);
          rebuyTimers.delete(`${game.id}:${session.id}`);
          store.markGameChanged(game);
          boundSocket.emit("REBUY_STATUS_UPDATED", { sessionId: session.id, eligible: false, expiresAt: null, remainingSeconds: null });
          await broadcastPokerState(game.id);
          broadcastState(game.id);
        } catch (error) {
          reject(boundSocket, "REBUY_REQUEST", error instanceof Error ? error.message : "REBUY_NOT_AVAILABLE");
        }
      });
    });

    bindValidated("DECLINE_REBUY", () => {
      const session = store.getSession(boundSocket.data.sessionId ?? "");
      const game = session && store.getGame(session.gameId);
      if (!session || !game) return reject(boundSocket, "DECLINE_REBUY", "SESSION_EXPIRED");
      void enqueue(game.id, () => {
        if (!game.rebuyOffers.delete(session.id)) return reject(boundSocket, "DECLINE_REBUY", "REBUY_NOT_AVAILABLE");
        const timer = rebuyTimers.get(`${game.id}:${session.id}`);
        if (timer) clearTimeout(timer);
        rebuyTimers.delete(`${game.id}:${session.id}`);
        session.sittingOut = true;
        const player = game.pokerState?.players.find((item) => item.id === session.id);
        if (player) player.active = false;
        store.markGameChanged(game);
        io.to(game.id).emit("REBUY_STATUS_UPDATED", { sessionId: session.id, eligible: false, expiresAt: null, remainingSeconds: null });
        broadcastState(game.id);
      });
    });

    bindValidated("SIT_OUT", () => {
      const session = store.getSession(boundSocket.data.sessionId ?? "");
      const game = session && store.getGame(session.gameId);
      if (!session || !game) return reject(boundSocket, "SIT_OUT", "SESSION_EXPIRED");
      session.sittingOut = true;
      store.markGameChanged(game);
      broadcastState(game.id);
    });

    bindValidated("RETURN_TO_PLAY", () => {
      const session = store.getSession(boundSocket.data.sessionId ?? "");
      const game = session && store.getGame(session.gameId);
      const player = game?.pokerState?.players.find((item) => item.id === session?.id);
      if (!session || !game) return reject(boundSocket, "RETURN_TO_PLAY", "SESSION_EXPIRED");
      if (!player || player.stack <= 0) return reject(boundSocket, "RETURN_TO_PLAY", "REBUY_NOT_AVAILABLE");
      session.sittingOut = false;
      player.active = true;
      store.markGameChanged(game);
      broadcastState(game.id);
    });

    bindValidated("POKER_ACTION", (payload: PokerAction) => {
      const session = store.getSession(boundSocket.data.sessionId ?? "");
      const game = session && store.getGame(session.gameId);
      if (!session || !game || boundSocket.data.gameId !== game.id) {
        return reject(boundSocket, "POKER_ACTION", "SESSION_EXPIRED");
      }
      void enqueue(game.id, async () => {
        try {
          if (game.status === "PAUSED" || game.status === "ENDED") throw new Error("INVALID_GAME_STATE");
          applyPokerAction(game, session.id, payload);
          store.markGameChanged(game);
          await broadcastPokerState(game.id);
          broadcastState(game.id);
          settleHandLifecycle(game.id);
          scheduleTimer(game.id);
        } catch (error) {
          reject(boundSocket, "POKER_ACTION", engineErrorCode(error), error instanceof Error ? error.message : undefined);
        }
      });
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
      if (game.pokerState?.currentPlayerId === session.id) scheduleTimer(game.id);
      io.to(game.id).emit("PLAYER_PRESENCE", { sessionId: session.id, connectionStatus: "DISCONNECTED", stateVersion: game.stateVersion });
    });
  });
  return io;
}
