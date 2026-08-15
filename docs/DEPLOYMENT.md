# Deployment (Railway)

Full setup/local-dev walkthrough is in [README.md](../README.md#deploying-to-railway).
This doc is the operational reference: what actually runs, in what order, and
what you must configure.

## Build / start

`railway.json` points at the multi-stage `Dockerfile` (builder: `DOCKERFILE`).
Container start command:

```
prisma migrate deploy && node server.js
```

Migrations are applied on every boot, before the app accepts traffic.
`restartPolicyType: ON_FAILURE` (max 3 retries) — if `prisma migrate deploy`
fails (e.g. `DATABASE_URL` unset or unreachable), the container exits and
Railway retries rather than serving a broken app.

Healthcheck path: `/map` (`railway.json`). `/map` renders without requiring
auth, so the healthcheck doesn't depend on Clerk being configured correctly.

## Required environment variables (names only — set real values in Railway)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string — set automatically when you attach Railway's Postgres plugin |
| `UPLOAD_DIR` | Absolute path under an attached Volume (e.g. `/data/fihdar/uploads`) for citizen report images. **Without a Volume, uploaded images are lost on every redeploy.** |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `NEXT_PUBLIC_APP_URL` | Public URL of the deployed app (used in a few absolute-URL contexts) |

## Optional environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_MAP_STYLE_URL` | Override the default OpenFreeMap Liberty style URL |
| `NEXT_PUBLIC_SENTRY_DISABLED` | Set `true` to disable Sentry (also a Docker build ARG) |

Never put actual secret values in this file or any committed doc — set them
in the Railway dashboard/CLI.

## What does NOT run automatically in production

- **The intelligence worker** (`npm run db:intel`) is a CLI batch job, not a
  request-path or scheduled process. It must be run manually (or wired to a
  Railway cron/one-off job if you want scheduled ingestion) — see
  `docs/FIHDAR_INTELLIGENCE_SPEC.md`. The map and dashboard read whatever the
  worker last wrote; they never trigger processing themselves.
- **Ingestion** (`npm run db:ingest`) is likewise CLI-only.
- **Seeding** (`npm run db:seed`) is never run automatically — there is no
  auto-seed-on-boot behavior, so a fresh production database starts empty
  (per the project's no-fake-data rule) until real reports/ingestion arrive.

## Volume

Citizen-uploaded images are filesystem-backed (`src/server/storage.ts`), not
stored in the database. Attach a Railway Volume to the app service and point
`UPLOAD_DIR` at a path inside it, or every deploy silently discards prior
uploads.

## Node version

The Dockerfile pins `NODE_VERSION=24-slim` (build arg, all three stages).
Bump this in lockstep with `engines` in `package.json` if you change it.

## Known non-blocking build warning

`next build` prints a Turbopack "Encountered unexpected file in NFT list"
warning tracing through `next.config.ts` → `src/server/storage.ts` →
`src/server/report-service.ts` → `src/app/api/reports/public/route.ts`. The
build still succeeds and this does not affect the runtime — it is a
file-tracing heuristic warning from a `path.join(process.cwd(), ...)` call in
the storage module, not a missing file. Left unresolved because fixing it
would mean restructuring the upload-storage path resolution for a
non-blocking warning.

## Manual step this repository cannot automate

Provisioning the actual Railway project (linking it to this repo, attaching
Postgres, attaching a Volume, and setting the variables above) requires a
human with Railway account access — there is no way to do this safely from
inside an automated build/agent run without real credentials.
