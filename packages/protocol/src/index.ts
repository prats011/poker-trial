import { z } from "zod";

export const gameVariantSchema = z.enum(["HOLD_EM_NO_LIMIT"]);
export type GameVariant = z.infer<typeof gameVariantSchema>;

export const gameStageSchema = z.enum(["WAITING", "IN_PROGRESS", "COMPLETED"]);
export type GameStage = z.infer<typeof gameStageSchema>;

export const tableSeatSchema = z.object({
  seatIndex: z.number().int().min(0),
  occupiedBySessionId: z.string().nullable(),
  occupiedByNickname: z.string().nullable()
});

export const tableStateSchema = z.object({
  tableId: z.string(),
  inviteToken: z.string(),
  variant: gameVariantSchema,
  stage: gameStageSchema,
  stateVersion: z.number().int().nonnegative(),
  seats: z.array(tableSeatSchema),
  connectedSessionIds: z.array(z.string())
});
export type TableState = z.infer<typeof tableStateSchema>;

export const joinTableSchema = z.object({
  inviteToken: z.string().min(1),
  nickname: z.string().min(1).max(24)
});

export const requestSeatSchema = z.object({
  seatIndex: z.number().int().min(0)
});

export const leaveSeatSchema = z.object({
  reason: z.string().max(120).optional()
});

export const chatSendSchema = z.object({
  message: z.string().min(1).max(240)
});

export const tableStateSnapshotSchema = z.object({
  tableState: tableStateSchema
});

export const actionRejectedSchema = z.object({
  event: z.string(),
  code: z.enum(["INVALID_PAYLOAD", "UNSUPPORTED", "RATE_LIMITED"]),
  message: z.string()
});

export const presenceUpdatedSchema = z.object({
  connectedSessionIds: z.array(z.string()),
  stateVersion: z.number().int().nonnegative()
});

export const seatUpdatedSchema = z.object({
  seats: z.array(tableSeatSchema),
  stateVersion: z.number().int().nonnegative()
});

export const clientEventSchemas = {
  JOIN_TABLE: joinTableSchema,
  REQUEST_SEAT: requestSeatSchema,
  LEAVE_SEAT: leaveSeatSchema,
  CHAT_SEND: chatSendSchema
} as const;

export const serverEventSchemas = {
  TABLE_STATE_SNAPSHOT: tableStateSnapshotSchema,
  ACTION_REJECTED: actionRejectedSchema,
  PRESENCE_UPDATED: presenceUpdatedSchema,
  SEAT_UPDATED: seatUpdatedSchema
} as const;

export type ClientEventName = keyof typeof clientEventSchemas;
export type ServerEventName = keyof typeof serverEventSchemas;

export type ClientEventPayload<T extends ClientEventName> = z.infer<(typeof clientEventSchemas)[T]>;
export type ServerEventPayload<T extends ServerEventName> = z.infer<(typeof serverEventSchemas)[T]>;
