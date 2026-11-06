import { describe, expect, it } from "vitest";
import { clientEventSchemas, serverEventSchemas, tableStateSchema } from "../src/index";

describe("protocol schemas", () => {
  it("accepts valid table state", () => {
    const parsed = tableStateSchema.parse({
      gameId: "game-1",
      configuration: { variant: "HOLD_EM_NO_LIMIT", startingStack: 1000, smallBlind: 5, bigBlind: 10, turnTimerSeconds: 30, maxPlayers: 6 },
      status: "WAITING",
      hostSessionId: "session-1",
      players: [],
      stateVersion: 0,
      seats: [{ seatIndex: 0, occupiedBySessionId: null, occupiedByNickname: null }]
    });

    expect(parsed.gameId).toBe("game-1");
  });

  it("rejects invalid join payload", () => {
    expect(() => clientEventSchemas.JOIN_TABLE.parse({ nickname: "n" })).toThrow();
  });

  it("accepts action rejection payload", () => {
    const payload = serverEventSchemas.ACTION_REJECTED.parse({
      event: "JOIN_TABLE",
      code: "INVALID_PAYLOAD",
      message: "Invalid payload"
    });

    expect(payload.code).toBe("INVALID_PAYLOAD");
  });
});
