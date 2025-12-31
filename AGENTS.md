# Repository Guidelines

## Project Structure & Module Organization
This is a Bun-powered Turborepo. Apps live in `apps/`:
- `apps/api` (Bun + Hono REST API, source in `apps/api/src`, modules in `apps/api/src/modules`)
- `apps/web` (TanStack Start + Vite, source in `apps/web/src`)
- `apps/mobile` (Expo, routes in `apps/mobile/app`)
- `apps/svelte-app` (SvelteKit, source in `apps/svelte-app/src`)
Shared packages live in `packages/` (`ui`, `eslint-config`, `typescript-config`).

## Build, Test, and Development Commands
- `bun install` installs workspace deps (Bun is the pinned package manager).
- `bun run dev` runs `turbo run dev` for all apps; scope with `bun run dev --filter=web`.
- `bun run build`, `bun run lint`, `bun run check-types`, `bun run format`.
- App-specific: `cd apps/api && bun run dev`; `cd apps/web && bun run dev`; `cd apps/mobile && bun run start|ios|android`; `cd apps/svelte-app && bun run dev`.

## Coding Style & Naming Conventions
- TypeScript-first; shared config lives in `packages/typescript-config`.
- Formatting is via Prettier (`bun run format` at root; `cd apps/svelte-app && bun run format` for Svelte) and linting via shared ESLint (`packages/eslint-config`) plus Expo lint in `apps/mobile`.
- API file naming: module component files use dot notation `module.function.ts` (e.g., `health.routes.ts`), and role/purpose files use kebab-case like `auth-middleware.ts`.

## Testing Guidelines
- Web uses Vitest + Testing Library; tests live in `apps/web/src` and use `*.test.ts`.
- Run `cd apps/web && bun run test` for the current suite.

## Commit & Pull Request Guidelines
- Commit messages are short, imperative, and often prefixed with `add/` or `fix/` (e.g., `add/ skeleton for loading data`).
- PRs should include a brief summary, testing notes, and linked issues; add screenshots for UI changes and call out migrations or env updates.

## Configuration & Secrets
- API env: copy `apps/api/.env.example` to `apps/api/.env` and set DB/Better Auth/AWS values.
- Web env: copy `apps/web/.env.example` to `apps/web/.env` and set `VITE_API_URL`.
- Mobile uses `EXPO_PUBLIC_API_URL` (see `apps/mobile/.env`) for API base URL.
