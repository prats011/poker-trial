import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { GameConfiguration, GameStatus, TablePlayer, TableSeat, TableState } from "@poker/protocol";
import type { Payout } from "@poker/engine";
import type { PokerState } from "@poker/engine";

export type Session = {
  id: string;
  gameId: string;
  nickname: string;
  seatIndex: number | null;
  isHost: boolean;
  connectionStatus: "CONNECTED" | "DISCONNECTED";
  createdAt: string;
  lastSeenAt: string;
};

export type Game = {
  id: string;
  inviteTokenHash: string;
  hostSessionId: string;
  configuration: GameConfiguration;
  status: GameStatus;
  createdAt: string;
  updatedAt: string;
  sessions: Map<string, Session>;
  stateVersion: number;
  pokerState?: PokerState;
  lastPayouts?: Payout[];
};

export type CreateGameResult = { game: Game; inviteToken: string; session: Session };
export type StorePersistence = {
  saveGameAndSession(game: Game, session: Session): Promise<void>;
  saveSession(game: Game, session: Session): Promise<void>;
  updateGame(game: Game): Promise<void>;
  updateSession(session: Session): Promise<void>;
  deleteSession(game: Game, sessionId: string): Promise<void>;
};

export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export class GameStore {
  private readonly games = new Map<string, Game>();
  private readonly inviteHashes = new Map<string, string>();
  private readonly sessions = new Map<string, Session>();
  constructor(private readonly persistence?: StorePersistence) {}

  private persist(action: Promise<void>) {
    void action.catch((error) => console.error("Database persistence failed:", error));
  }

  createGame(configuration: GameConfiguration, nickname: string): CreateGameResult {
    const now = new Date().toISOString();
    const gameId = randomUUID();
    const inviteToken = randomBytes(32).toString("base64url");
    const hostSessionId = randomBytes(32).toString("base64url");
    const game: Game = {
      id: gameId,
      inviteTokenHash: hashSecret(inviteToken),
      hostSessionId,
      configuration,
      status: "WAITING",
      createdAt: now,
      updatedAt: now,
      sessions: new Map(),
      stateVersion: 1
    };
    const session: Session = {
      id: hostSessionId,
      gameId,
      nickname,
      seatIndex: null,
      isHost: true,
      connectionStatus: "DISCONNECTED",
      createdAt: now,
      lastSeenAt: now
    };
    game.sessions.set(hostSessionId, session);
    this.games.set(gameId, game);
    this.inviteHashes.set(game.inviteTokenHash, gameId);
    this.sessions.set(hostSessionId, session);
    if (this.persistence) {
      this.persist(this.persistence.saveGameAndSession(game, session));
    }
    return { game, inviteToken, session };
  }

  getGameByInvite(inviteToken: string) {
    const gameId = this.inviteHashes.get(hashSecret(inviteToken));
    return gameId ? this.games.get(gameId) : undefined;
  }

  getGame(gameId: string) {
    return this.games.get(gameId);
  }

  getSession(sessionId: string) {
    return this.sessions.get(sessionId);
  }

  join(game: Game, nickname: string, existingSessionId?: string) {
    if (existingSessionId) {
      const existing = this.sessions.get(existingSessionId);
      if (!existing || existing.gameId !== game.id) throw new Error("SESSION_EXPIRED");
      if (existing.nickname.toLowerCase() !== nickname.toLowerCase()) throw new Error("UNAUTHORIZED");
      existing.lastSeenAt = new Date().toISOString();
      if (this.persistence) this.persist(this.persistence.updateSession(existing));
      return { session: existing, reconnected: true };
    }
    if (game.status !== "WAITING") throw new Error("GAME_STARTED");
    if (game.sessions.size >= game.configuration.maxPlayers) throw new Error("TABLE_FULL");
    if ([...game.sessions.values()].some((item) => item.nickname.toLowerCase() === nickname.toLowerCase())) {
      throw new Error("NICKNAME_TAKEN");
    }
    const now = new Date().toISOString();
    const session: Session = {
      id: randomBytes(32).toString("base64url"),
      gameId: game.id,
      nickname,
      seatIndex: null,
      isHost: false,
      connectionStatus: "DISCONNECTED",
      createdAt: now,
      lastSeenAt: now
    };
    game.sessions.set(session.id, session);
    this.sessions.set(session.id, session);
    if (this.persistence) this.persist(this.persistence.saveSession(game, session));
    game.stateVersion += 1;
    game.updatedAt = now;
    return { session, reconnected: false };
  }

  setConnection(session: Session, connected: boolean) {
    session.connectionStatus = connected ? "CONNECTED" : "DISCONNECTED";
    session.lastSeenAt = new Date().toISOString();
    const game = this.games.get(session.gameId);
    if (game) {
      game.stateVersion += 1;
      game.updatedAt = session.lastSeenAt;
      if (this.persistence) {
        this.persist(this.persistence.updateSession(session));
        this.persist(this.persistence.updateGame(game));
      }
    }
  }

  updateSettings(game: Game, configuration: GameConfiguration) {
    game.configuration = configuration;
    game.stateVersion += 1;
    game.updatedAt = new Date().toISOString();
    if (this.persistence) this.persist(this.persistence.updateGame(game));
  }

  start(game: Game) {
    game.status = "PREPARING";
    game.stateVersion += 1;
    game.updatedAt = new Date().toISOString();
    if (this.persistence) this.persist(this.persistence.updateGame(game));
  }

  markGameChanged(game: Game) {
    game.stateVersion += 1;
    game.updatedAt = new Date().toISOString();
    if (this.persistence) this.persist(this.persistence.updateGame(game));
  }

  removeSession(game: Game, sessionId: string) {
    if (game.status !== "WAITING") throw new Error("GAME_STARTED");
    if (sessionId === game.hostSessionId) throw new Error("UNAUTHORIZED");
    const session = game.sessions.get(sessionId);
    if (!session) throw new Error("NOT_FOUND");
    game.sessions.delete(sessionId);
    this.sessions.delete(sessionId);
    game.stateVersion += 1;
    game.updatedAt = new Date().toISOString();
    if (this.persistence) {
      this.persist(this.persistence.deleteSession(game, sessionId));
      this.persist(this.persistence.updateGame(game));
    }
    return session;
  }

  requestSeat(game: Game, session: Session, seatIndex: number) {
    if (game.status !== "WAITING") throw new Error("GAME_STARTED");
    if (seatIndex >= game.configuration.maxPlayers) throw new Error("NO_SEAT");
    const occupant = [...game.sessions.values()].find((item) => item.seatIndex === seatIndex);
    if (occupant && occupant.id !== session.id) throw new Error("SEAT_OCCUPIED");
    session.seatIndex = seatIndex;
    game.stateVersion += 1;
    game.updatedAt = new Date().toISOString();
    if (this.persistence) {
      this.persist(this.persistence.updateSession(session));
      this.persist(this.persistence.updateGame(game));
    }
  }

  leaveSeat(game: Game, session: Session) {
    session.seatIndex = null;
    game.stateVersion += 1;
    game.updatedAt = new Date().toISOString();
    if (this.persistence) {
      this.persist(this.persistence.updateSession(session));
      this.persist(this.persistence.updateGame(game));
    }
  }

  snapshot(game: Game): TableState {
    const players: TablePlayer[] = [...game.sessions.values()].map((session) => ({
      sessionId: session.id,
      nickname: session.nickname,
      seatIndex: session.seatIndex,
      isHost: session.isHost,
      connectionStatus: session.connectionStatus
    }));
    const seats: TableSeat[] = Array.from({ length: game.configuration.maxPlayers }, (_, seatIndex) => {
      const player = players.find((item) => item.seatIndex === seatIndex);
      return { seatIndex, occupiedBySessionId: player?.sessionId ?? null, occupiedByNickname: player?.nickname ?? null };
    });
    return {
      gameId: game.id,
      configuration: game.configuration,
      status: game.status,
      hostSessionId: game.hostSessionId,
      players,
      seats,
      stateVersion: game.stateVersion
    };
  }
}
