import { z } from "zod";

export const gameVariantSchema = z.enum(["HOLD_EM_NO_LIMIT", "OMAHA_HI", "PLO_DOUBLE_BOARD_BOMB_POT"]);
export type GameVariant = z.infer<typeof gameVariantSchema>;

export const gameStatusSchema = z.enum(["WAITING", "PREPARING"]);
export type GameStatus = z.infer<typeof gameStatusSchema>;

export const gameConfigurationSchema = z.object({
  variant: gameVariantSchema,
  startingStack: z.number().int().positive().max(10_000_000),
  smallBlind: z.number().int().positive().max(10_000_000),
  bigBlind: z.number().int().positive().max(10_000_000),
  turnTimerSeconds: z.number().int().positive().max(3600),
  maxPlayers: z.number().int().min(2).max(10)
}).superRefine((value, ctx) => {
  if (value.bigBlind <= value.smallBlind) {
    ctx.addIssue({ code: "custom", path: ["bigBlind"], message: "Big blind must be greater than small blind" });
  }
});
export type GameConfiguration = z.infer<typeof gameConfigurationSchema>;

export const nicknameSchema = z.string()
  .trim()
  .min(1, "Please enter a nickname.")
  .max(24, "Nickname must be 24 characters or fewer.")
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Nickname contains invalid characters.");

export const tablePlayerSchema = z.object({
  sessionId: z.string(),
  nickname: z.string(),
  seatIndex: z.number().int().nonnegative().nullable(),
  isHost: z.boolean(),
  connectionStatus: z.enum(["CONNECTED", "DISCONNECTED"])
});
export type TablePlayer = z.infer<typeof tablePlayerSchema>;

export const tableSeatSchema = z.object({
  seatIndex: z.number().int().nonnegative(),
  occupiedBySessionId: z.string().nullable(),
  occupiedByNickname: z.string().nullable()
});
export type TableSeat = z.infer<typeof tableSeatSchema>;

export const tableStateSchema = z.object({
  gameId: z.string(),
  configuration: gameConfigurationSchema,
  status: gameStatusSchema,
  hostSessionId: z.string(),
  players: z.array(tablePlayerSchema),
  seats: z.array(tableSeatSchema),
  stateVersion: z.number().int().nonnegative()
});
export type TableState = z.infer<typeof tableStateSchema>;

export const createGameSchema = z.object({
  configuration: gameConfigurationSchema,
  nickname: nicknameSchema
});
export type CreateGameInput = z.infer<typeof createGameSchema>;

export const joinTableSchema = z.object({
  inviteToken: z.string().min(1),
  nickname: nicknameSchema,
  sessionId: z.string().min(32).optional()
});
export const requestSeatSchema = z.object({ seatIndex: z.number().int().nonnegative() });
export const leaveSeatSchema = z.object({ reason: z.string().trim().max(120).optional() });
export const updateGameSettingsSchema = gameConfigurationSchema;
export const startGameSchema = z.object({});
export const removePlayerSchema = z.object({ sessionId: z.string().min(1) });
export const chatSendSchema = z.object({ message: z.string().trim().min(1).max(240) });

export const tableStateSnapshotSchema = z.object({ tableState: tableStateSchema });
export const playerJoinedSchema = z.object({ player: tablePlayerSchema, stateVersion: z.number().int().nonnegative() });
export const playerLeftSchema = z.object({ sessionId: z.string(), stateVersion: z.number().int().nonnegative() });
export const seatUpdatedSchema = z.object({ seats: z.array(tableSeatSchema), stateVersion: z.number().int().nonnegative() });
export const gameSettingsUpdatedSchema = z.object({ configuration: gameConfigurationSchema, stateVersion: z.number().int().nonnegative() });
export const gameStatusUpdatedSchema = z.object({ status: gameStatusSchema, stateVersion: z.number().int().nonnegative() });
export const actionRejectedSchema = z.object({
  event: z.string(),
  code: z.enum(["INVALID_PAYLOAD", "INVALID_INVITE", "UNAUTHORIZED", "NICKNAME_TAKEN", "TABLE_FULL", "GAME_STARTED", "SEAT_OCCUPIED", "NO_SEAT", "RATE_LIMITED", "SESSION_EXPIRED", "NOT_FOUND"]),
  message: z.string()
});
export const chatMessageSchema = z.object({
  messageId: z.string(),
  senderNickname: z.string(),
  message: z.string(),
  createdAt: z.string()
});
export const playerPresenceSchema = z.object({ sessionId: z.string(), connectionStatus: z.enum(["CONNECTED", "DISCONNECTED"]), stateVersion: z.number().int().nonnegative() });

export const clientEventSchemas = {
  JOIN_TABLE: joinTableSchema,
  REQUEST_SEAT: requestSeatSchema,
  LEAVE_SEAT: leaveSeatSchema,
  UPDATE_GAME_SETTINGS: updateGameSettingsSchema,
  START_GAME: startGameSchema,
  CHAT_SEND: chatSendSchema,
  REMOVE_PLAYER: removePlayerSchema
} as const;
export const serverEventSchemas = {
  TABLE_STATE_SNAPSHOT: tableStateSnapshotSchema,
  PLAYER_JOINED: playerJoinedSchema,
  PLAYER_LEFT: playerLeftSchema,
  SEAT_UPDATED: seatUpdatedSchema,
  GAME_SETTINGS_UPDATED: gameSettingsUpdatedSchema,
  GAME_STATUS_UPDATED: gameStatusUpdatedSchema,
  ACTION_REJECTED: actionRejectedSchema,
  CHAT_MESSAGE: chatMessageSchema,
  PLAYER_PRESENCE: playerPresenceSchema
} as const;
export type ClientEventName = keyof typeof clientEventSchemas;
export type ServerEventName = keyof typeof serverEventSchemas;
export type ClientEventPayload<T extends ClientEventName> = z.infer<(typeof clientEventSchemas)[T]>;
export type ServerEventPayload<T extends ServerEventName> = z.infer<(typeof serverEventSchemas)[T]>;
