import { z } from "zod";

export const gameVariantSchema = z.enum(["HOLD_EM_NO_LIMIT", "OMAHA_HI", "PLO_DOUBLE_BOARD_BOMB_POT"]);
export type GameVariant = z.infer<typeof gameVariantSchema>;

export const gameStatusSchema = z.enum(["WAITING", "PREPARING", "PAUSE_PENDING", "PAUSED", "END_PENDING", "ENDED"]);
export type GameStatus = z.infer<typeof gameStatusSchema>;

export const gameConfigurationSchema = z.object({
  variant: gameVariantSchema,
  startingStack: z.number().int().positive().max(10_000_000),
  smallBlind: z.number().int().positive().max(10_000_000),
  bigBlind: z.number().int().positive().max(10_000_000),
  turnTimerSeconds: z.number().int().positive().max(3600),
  maxPlayers: z.number().int().min(2).max(10),
  rebuysEnabled: z.boolean().default(true),
  rebuyMinAmount: z.number().int().positive().max(10_000_000).default(100),
  rebuyMaxAmount: z.number().int().positive().max(10_000_000).optional(),
  rebuyDecisionTimeSec: z.number().int().positive().max(3600).default(15)
}).superRefine((value, ctx) => {
  if (value.bigBlind <= value.smallBlind) {
    ctx.addIssue({ code: "custom", path: ["bigBlind"], message: "Big blind must be greater than small blind" });
  }
  const maximum = value.rebuyMaxAmount ?? value.startingStack;
  if (value.rebuyMinAmount > maximum) {
    ctx.addIssue({ code: "custom", path: ["rebuyMinAmount"], message: "Minimum rebuy must not exceed maximum rebuy" });
  }
  if (maximum > value.startingStack) {
    ctx.addIssue({ code: "custom", path: ["rebuyMaxAmount"], message: "Maximum rebuy must not exceed the starting stack" });
  }
});
export type GameConfiguration = z.output<typeof gameConfigurationSchema>;
export type GameConfigurationInput = z.input<typeof gameConfigurationSchema>;

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
  connectionStatus: z.enum(["CONNECTED", "DISCONNECTED"]),
  stack: z.number().int().nonnegative().nullable(),
  sittingOut: z.boolean()
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
export const pauseGameSchema = z.object({});
export const resumeGameSchema = z.object({});
export const endGameSchema = z.object({});
export const rebuyRequestSchema = z.object({ amount: z.number().int() });
export const declineRebuySchema = z.object({});
export const sitOutSchema = z.object({});
export const returnToPlaySchema = z.object({});
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
  code: z.enum([
    "INVALID_PAYLOAD", "INVALID_INVITE", "UNAUTHORIZED", "NICKNAME_TAKEN", "TABLE_FULL", "GAME_STARTED",
    "SEAT_OCCUPIED", "NO_SEAT", "RATE_LIMITED", "SESSION_EXPIRED", "NOT_FOUND", "INVALID_GAME_STATE",
    "INVALID_PLAYER", "PLAYER_NOT_ACTIVE", "NOT_PLAYER_TURN", "INSUFFICIENT_CHIPS", "INVALID_BET_AMOUNT",
    "BET_BELOW_MINIMUM", "RAISE_BELOW_MINIMUM", "RAISE_EXCEEDS_POT", "ACTION_NOT_ALLOWED", "STALE_STATE"
    , "REBUY_NOT_AVAILABLE", "INVALID_REBUY_AMOUNT", "GAME_ENDED"
  ]),
  message: z.string()
});
export const pokerActionSchema = z.object({
  type: z.enum(["FOLD", "CHECK", "CALL", "BET", "RAISE", "ALL_IN"]),
  amount: z.number().int().nonnegative().optional(),
  stateVersion: z.number().int().nonnegative().optional()
});
export type PokerAction = z.infer<typeof pokerActionSchema>;
export const pokerPlayerViewSchema = z.object({
  playerId: z.string(),
  nickname: z.string(),
  seatIndex: z.number().int().nonnegative(),
  stack: z.number().int().nonnegative(),
  streetContribution: z.number().int().nonnegative(),
  handContribution: z.number().int().nonnegative(),
  folded: z.boolean(),
  allIn: z.boolean(),
  active: z.boolean(),
  hasActed: z.boolean(),
  holeCards: z.array(z.string()),
  holeCardCount: z.number().int().nonnegative()
});
export const pokerPotViewSchema = z.object({
  amount: z.number().int().nonnegative(),
  eligiblePlayerIds: z.array(z.string()),
  cap: z.number().int().nonnegative()
});
export const pokerStateViewSchema = z.object({
  handId: z.string(),
  variant: gameVariantSchema,
  status: z.string(),
  street: z.string(),
  stateVersion: z.number().int().nonnegative(),
  dealerSeat: z.number().int().nonnegative(),
  smallBlindSeat: z.number().int().nonnegative().nullable(),
  bigBlindSeat: z.number().int().nonnegative().nullable(),
  currentPlayerId: z.string().nullable(),
  currentBet: z.number().int().nonnegative(),
  minimumRaise: z.number().int().nonnegative(),
  pot: z.number().int().nonnegative(),
  boards: z.array(z.array(z.string())),
  players: z.array(pokerPlayerViewSchema),
  pots: z.array(pokerPotViewSchema),
  legalActions: z.array(pokerActionSchema),
  payouts: z.array(z.object({
    pot: z.number().int().nonnegative(),
    winners: z.array(z.string()),
    amountByPlayer: z.record(z.string(), z.number().int().nonnegative()),
    board: z.number().int().nonnegative().optional()
  })).optional()
});
export type PokerStateView = z.infer<typeof pokerStateViewSchema>;
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
  REMOVE_PLAYER: removePlayerSchema,
  POKER_ACTION: pokerActionSchema,
  PAUSE_GAME: pauseGameSchema,
  RESUME_GAME: resumeGameSchema,
  END_GAME: endGameSchema,
  REBUY_REQUEST: rebuyRequestSchema,
  DECLINE_REBUY: declineRebuySchema,
  SIT_OUT: sitOutSchema,
  RETURN_TO_PLAY: returnToPlaySchema
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
  PLAYER_PRESENCE: playerPresenceSchema,
  REBUY_STATUS_UPDATED: z.object({
    sessionId: z.string(),
    eligible: z.boolean(),
    expiresAt: z.string().nullable(),
    remainingSeconds: z.number().int().nonnegative().nullable()
  }),
  GAME_LIFECYCLE_UPDATED: z.object({ status: gameStatusSchema, stateVersion: z.number().int().nonnegative() }),
  GAME_ENDED: z.object({ reason: z.string() }),
  POKER_STATE_SNAPSHOT: z.object({ pokerState: pokerStateViewSchema })
} as const;
export type ClientEventName = keyof typeof clientEventSchemas;
export type ServerEventName = keyof typeof serverEventSchemas;
export type ClientEventPayload<T extends ClientEventName> = z.infer<(typeof clientEventSchemas)[T]>;
export type ServerEventPayload<T extends ServerEventName> = z.infer<(typeof serverEventSchemas)[T]>;
