# Poker Trial

Phase 1 foundation for private, real-time multiplayer poker rooms. This phase implements room creation, secure invitations, temporary sessions, lobby seating, host controls, state synchronization, reconnection, and table chat. Poker gameplay is intentionally not implemented.

## Workspace

- `apps/web` — Next.js frontend with `/`, `/create`, and `/game/[inviteToken]`
- `apps/server` — Fastify HTTP API and authoritative Socket.IO room server
- `packages/protocol` — shared Zod schemas and TypeScript contracts
- `packages/engine` — future engine interfaces only
- `packages/ui` — shared presentational components

## Local setup

Requirements: Node.js 22+, pnpm 9+, and PostgreSQL 14+.

```bash
corepack enable
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm dev
```

The web app runs on `http://localhost:3000`; the server runs on `http://localhost:4000`.

## Environment

`.env.example` contains the required values:

- `DATABASE_URL` — PostgreSQL connection string
- `SERVER_PORT` — backend port
- `FRONTEND_URL` — allowed browser origin
- `SESSION_SECRET` — local session configuration secret
- `RATE_LIMIT_MAX` and `RATE_LIMIT_TIME_WINDOW` — HTTP rate limiting

The raw invitation token and raw session identifier are never stored in PostgreSQL. Active authoritative room state is held in server memory and persisted game/session records are written to PostgreSQL when a valid PostgreSQL URL is configured.

## Validation

```bash
pnpm test
pnpm typecheck
pnpm build
```

The server tests cover creation, invite validation, duplicate nicknames, room-scoped Socket.IO synchronization, seating, host authorization, and chat delivery. No cards, dealing, betting, hand evaluation, or other poker rules are included in Phase 1.

Optional real PostgreSQL persistence coverage uses an isolated temporary schema:

```bash
RUN_POSTGRES_INTEGRATION=1 \
POSTGRES_TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/poker_trial \
pnpm --filter @poker/server test
```

Without `RUN_POSTGRES_INTEGRATION=1`, the PostgreSQL integration test is reported as skipped; the default test suite uses `pg-mem` for migration constraints.
