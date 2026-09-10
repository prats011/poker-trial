import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import {
  clientEventSchemas,
  type ClientEventName,
  type ClientEventPayload,
  type TableState
} from "@poker/protocol";

function initialState(): TableState {
  return {
    tableId: "table-placeholder",
    inviteToken: "placeholder",
    variant: "HOLD_EM_NO_LIMIT",
    stage: "WAITING",
    stateVersion: 0,
    seats: [
      { seatIndex: 0, occupiedBySessionId: null, occupiedByNickname: null },
      { seatIndex: 1, occupiedBySessionId: null, occupiedByNickname: null }
    ],
    connectedSessionIds: []
  };
}

function validateClientEvent<TEvent extends ClientEventName>(
  event: TEvent,
  payload: unknown
): payload is ClientEventPayload<TEvent> {
  return clientEventSchemas[event].safeParse(payload).success;
}

export function registerSocket(httpServer: HttpServer, frontendUrl: string) {
  const io = new Server(httpServer, {
    cors: {
      origin: frontendUrl
    }
  });

  const tableState = initialState();

  io.on("connection", (socket) => {
    tableState.connectedSessionIds = Array.from(new Set([...tableState.connectedSessionIds, socket.id]));
    tableState.stateVersion += 1;

    socket.emit("TABLE_STATE_SNAPSHOT", { tableState });
    io.emit("PRESENCE_UPDATED", {
      connectedSessionIds: tableState.connectedSessionIds,
      stateVersion: tableState.stateVersion
    });

    const bindValidated = <TEvent extends ClientEventName>(
      event: TEvent,
      handler: (payload: ClientEventPayload<TEvent>) => void
    ) => {
      socket.on(event, (payload: unknown) => {
        if (!validateClientEvent(event, payload)) {
          socket.emit("ACTION_REJECTED", {
            event,
            code: "INVALID_PAYLOAD",
            message: `Invalid payload for ${event}`
          });
          return;
        }

        handler(payload);
      });
    };

    bindValidated("JOIN_TABLE", () => {
      socket.emit("TABLE_STATE_SNAPSHOT", { tableState });
    });

    bindValidated("REQUEST_SEAT", () => {
      socket.emit("SEAT_UPDATED", { seats: tableState.seats, stateVersion: tableState.stateVersion });
    });

    bindValidated("LEAVE_SEAT", () => {
      socket.emit("SEAT_UPDATED", { seats: tableState.seats, stateVersion: tableState.stateVersion });
    });

    bindValidated("CHAT_SEND", () => {
      socket.emit("ACTION_REJECTED", {
        event: "CHAT_SEND",
        code: "UNSUPPORTED",
        message: "Chat behavior is not implemented in this phase"
      });
    });

    socket.on("disconnect", () => {
      tableState.connectedSessionIds = tableState.connectedSessionIds.filter((sessionId) => sessionId !== socket.id);
      tableState.stateVersion += 1;
      io.emit("PRESENCE_UPDATED", {
        connectedSessionIds: tableState.connectedSessionIds,
        stateVersion: tableState.stateVersion
      });
    });
  });

  return io;
}
