# poker-trial

Phase 1 monorepo foundation for a realtime poker project.

## Workspace layout

- `apps/web` — Next.js shell (`/`, `/create`, `/game/[inviteToken]`)
- `apps/server` — Fastify + Socket.IO backend skeleton
- `packages/protocol` — shared Zod-validated socket contracts and core state types
- `packages/engine` — gameplay engine interfaces/stubs only
- `packages/ui` — shared dark-theme presentational components

## Prerequisites

- Node.js 22+
- Corepack enabled (`corepack enable`)
- PostgreSQL 14+

## Local setup

1. Copy `.env.example` to `.env` and fill values.
2. Install dependencies:
   - `pnpm install --no-frozen-lockfile`
3. Run database migrations:
   - `pnpm db:migrate`
4. Start web + server:
   - `pnpm dev`

## Scripts

- `pnpm dev` — runs web + server in watch mode
- `pnpm build` — builds all workspace packages/apps
- `pnpm lint` — runs lint/type assertions across workspace
- `pnpm typecheck` — TypeScript checks across workspace
- `pnpm test` — runs protocol + server tests (plus no-test placeholders elsewhere)
- `pnpm db:migrate` — applies SQL migrations in `apps/server/db/migrations`

## Implemented in this chunk

- Monorepo scaffold with strict package boundaries
- Shared protocol contract schemas + runtime validation
- Socket server with baseline validated event handling and `ACTION_REJECTED` responses
- PostgreSQL foundational migration for `games` and `player_sessions`
- Tests for protocol schemas, server boot/health, socket handshake + invalid payload rejection, and migration smoke coverage

## Explicitly out of scope (Phase 1 / Chunk 1)

- Invite-token generation flow
- `/create` submission flow
- Join-by-nickname business logic
- Lobby/host controls/reconnection/chat persistence
- Any poker gameplay logic
