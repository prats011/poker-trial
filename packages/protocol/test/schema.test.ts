import { describe, expect, it } from "vitest";
import { clientEventSchemas, serverEventSchemas, tableStateSchema } from "../src/index";

describe("protocol schemas", () => {
  it("accepts valid table state", () => {
    const parsed = tableStateSchema.parse({
      tableId: "table-1",
      inviteToken: "abc123",
      variant: "HOLD_EM_NO_LIMIT",
      stage: "WAITING",
      stateVersion: 0,
      seats: [{ seatIndex: 0, occupiedBySessionId: null, occupiedByNickname: null }],
      connectedSessionIds: []
    });

    expect(parsed.tableId).toBe("table-1");
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
