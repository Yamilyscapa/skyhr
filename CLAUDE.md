# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository

Bun-managed Turborepo for SkyHR. Workspaces live under `apps/*` and `packages/*`. The package manager is pinned to `bun@1.2.13`; do not use npm/yarn/pnpm even though a `package-lock.json` is present.

Note: `AGENTS.md` is partly stale — it still references `apps/web` and `apps/svelte-app`, which have been removed (see commit `2f3d061`). The real apps today are listed below.

## Apps

- `apps/api` — Hono REST API on Bun, Drizzle ORM + Postgres, Better Auth, AWS S3/Rekognition, Railway Buckets in prod. Entry `src/index.ts`; all routes mounted in `src/router.ts`. Domain code is sliced into `src/modules/<domain>/` using the `module.controller.ts | module.routes.ts | module.service.ts` dot-notation convention (see `src/modules/attendance/`).
- `apps/dashboard` — TanStack Start (Vite + Nitro) admin web app on port 3001. File-based routes in `src/routes/`, generated tree at `src/routeTree.gen.ts`, shadcn-style primitives in `src/components/ui/`. Wired to the API via the typed client + TanStack Query layer in `src/lib/api/` (see "Dashboard ↔ API data layer"). `src/data/` now holds only types and the Copilot/schedule fixtures still awaiting endpoints — it is no longer the primary data source.
- `apps/mobile` — Expo app for employees (check-in, face liveness via Rekognition, etc.). Expo Router with `(public)`, `(no-org)`, `(protected)` route groups under `app/`.
- `apps/worker` — Bun script that imports the API's Drizzle `db` and schema directly (`../api/src/db/...`). It falls back to `apps/api/.env` when its own `.env` still holds the placeholder DB URL. Any change to API schema or db exports can break the worker — keep them in sync.

## Shared packages

`packages/ui`, `packages/eslint-config`, `packages/typescript-config`. The dashboard does NOT consume `@repo/ui` — it has its own local `components/ui/` (vendored shadcn). The shared `@repo/ui` is currently only relevant if you add a new web app.

## Commands

Root (run from repo root with `bun run <cmd>`):

- `bun install` — install workspace deps.
- `bun run dev` — `turbo run dev` across all apps. Scope with `--filter`, e.g. `bun run dev --filter=dashboard`.
- `bun run build`, `bun run lint`, `bun run check-types`, `bun run format`.
- `bun run clean` / `bun run clean:mobile` — wipe caches.
- `bun run eas:build:{development,preview,production}` — EAS mobile builds.

Per-app (run from the app directory):

- API: `bun run dev` (watches `src`), `bun run start`, `bun run db:generate|db:migrate|db:push|db:studio` (Drizzle Kit).
- Dashboard: `bun run dev` (Vite on `:3001`), `bun run build`, `bun run start` (Nitro server output).
- Mobile: `bun run start` (Expo), `bun run ios`, `bun run android`.
- Worker: `bun run dev` / `bun run start`.

No test suite is wired in any current app. Don't claim a change is tested by running tests — verify by hitting the running app instead.

## Dashboard specifics

- TanStack Start streams SSR. Components that need the DOM (e.g. Recharts) gate render behind a `useMounted()` hook in `src/components/charts/index.tsx`. If client JS fails to load, those skeletons stay forever — check the browser console first.
- `vite.config.ts` pre-bundles `use-sync-external-store/shim/{with-selector,index}.js` via `optimizeDeps.include`. `@tanstack/react-store` imports `useSyncExternalStoreWithSelector` as an ESM named export from a CJS shim, which Vite otherwise refuses to serve. Don't remove this without re-verifying hydration.
- Status pills live in `src/components/status-badge.tsx` — one `Pill` primitive with `tone` (`success | warning | danger | info | neutral | outline`), `size` (`sm | md`), and forwarded `className`. The legacy `components/ui/badge.tsx` has been deleted; do not reintroduce it. In tables, pills are given a fixed width per column (e.g. `w-36 justify-center`) so the status reads as a stable vertical strip.
- Table primitives in `src/components/ui/table.tsx` use a `data-numeric` attribute on `TableHead` / `TableCell` for right-align + `tabular-nums`. Prefer this over re-implementing alignment classes.

## Dashboard ↔ API data layer

- `src/lib/api/` is the whole client: `client.ts` (low-level fetch wrapper, `credentials: "include"`), `index.ts` (typed `api.<domain>.<method>()` surface + base URL), `queries.ts` (TanStack Query `queryOptions` factories under the `queries` object, plus an `invalidate` map of root query keys), and `types.ts` (API response shapes). Add a new read by extending `queries`, not by calling `api` directly in components.
- Routes prefetch in their `loader` via `queryClient.ensureQueryData(queries.x())` and read the same `queries.x()` in the component with `useQuery` — the query key must match exactly, so build params through a shared helper (see `listParams` / `SUMMARY_PARAMS` in `attendance.tsx`). Mutations call `api.*` then `queryClient.invalidateQueries({ queryKey: invalidate.<domain> })`.
- SSR forwards the session cookie to the API (commit `18a4597`); `credentials: "include"` is a no-op on the server, so cookie forwarding is handled in the client wrapper, not by the browser.

## Statistics & metrics conventions

The `apps/api/src/modules/statistics/` module (mounted at `/statistics/*`, admin/owner only) is the source of all dashboard KPIs, trends, costs, and location rankings. Two conventions are load-bearing and easy to get wrong:

- **Rates are percentages (0–100), already multiplied by 100** in `statistics.service.ts` (`attendanceRate`, `punctualityIndex`, `unjustifiedAbsenteeism`, etc.). The dashboard must render them as-is — do NOT multiply by 100 again. (A double-`*100` bug previously produced "10000%".)
- **`AttendanceMetrics.hasData`** is `false` when a period has zero attendance events. In that case the service returns neutral zeros instead of treating every scheduled-but-unrecorded day as a 100% absence, and `statistics.controller.ts` gates alerts + the traffic light on `hasData` so empty/unused orgs don't surface phantom critical alerts. Preserve this flag when adding metrics.
- `calculateAttendanceMetrics` is the shared core; `getTrends` calls it per month. `getScheduledDaysForPeriod` expands recurring `shift.days_of_week` into calendar days — the absence denominator depends on it, so schedule changes shift the numbers.

To seed/inspect data, drop a throwaway `.ts` script **inside `apps/api/`** (so `import { db } from "./src/db"` resolves) and run it with `bun ./_script.ts`. `attendance_event.check_in` is a `timestamp` without time zone — JS `Date`s are stored at the machine's local offset, so seed times relative to "now" or they may land in the future / on the wrong day.

## Conventions

- Commit messages: short, imperative, prefixed with `add/`, `fix/`, `remove/`, `refactor/`, etc. (e.g. `fix/ harden scanning flows and auth routing across mobile and web`). Match this style for new commits.
- API module file naming: `<module>.routes.ts`, `<module>.controller.ts`, `<module>.service.ts`. Cross-cutting helpers use kebab-case (`auth-middleware.ts`, `webhook-auth.ts`).
- TypeScript everywhere; shared `tsconfig` bases live in `packages/typescript-config`.
- Prettier + the shared ESLint config (`packages/eslint-config`). Mobile additionally uses Expo lint.

## Environment

- `apps/api/.env` — DB URL, Better Auth secrets, AWS creds. In production also `RAILWAY_QR_BUCKET`, `RAILWAY_BIOMETRICS_BUCKET`, `RAILWAY_DOCUMENTS_BUCKET` (logged on startup in `src/index.ts`).
- `apps/mobile/.env` — `EXPO_PUBLIC_API_URL`.
- `apps/dashboard` — `VITE_API_URL` points the API client + Better Auth client at the API (both default to `http://localhost:8080`, matching the API's default `PORT`; see `src/lib/api/index.ts` and `src/lib/auth/client.ts`).
- `apps/api` — also reads `PORT` (defaults to `8080`).
- `apps/worker/.env` — own DB URL, or leave the placeholder and the worker will read `apps/api/.env`.

## CORS / auth gotcha

The API's `/auth/*` CORS is built around Better Auth's Hono integration. When `TRUSTED_ORIGINS` (`apps/api/src/utils/cors.ts`) is empty, the API echoes back the requesting origin — convenient locally, but anything that ships to prod needs the real origin list populated. Don't widen this to `*` (incompatible with `credentials: true`).
