# CLAUDE.md

FihDar — a Thai-language environmental surveillance app (citizen sighting reports + a
MapLibre waterway map for Eastern Thailand), built on a Next.js 16 + shadcn/ui base.

## Key References

- **[AGENTS.md](./AGENTS.md)** — project overview, structure, conventions, map specifics, verification
- **[README.md](./README.md)** — setup, database, image storage, security model, Railway deployment
- **[docs/forms.md](./docs/forms.md)** — Form system: TanStack Form + Zod, composable fields, validation, multi-step, sheet/dialog forms
- **[docs/themes.md](./docs/themes.md)** — Theme system: OKLCH colors, adding themes, font config
- **[docs/clerk_setup.md](./docs/clerk_setup.md)** — Clerk auth setup: organizations, billing, environment variables
- **[docs/INGESTION.md](./docs/INGESTION.md)** — six-source ingestion pipeline (`/sources`), Railway cron schedule, run/failure semantics
- **[docs/intelligence.md](./docs/intelligence.md)**, **[docs/FIHDAR_INTELLIGENCE_SPEC.md](./docs/FIHDAR_INTELLIGENCE_SPEC.md)** — relevance/species gate, location extraction, dedupe, event grouping, priority scoring
- **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)** — Railway operational reference for `fihdar-app` and `fihdar-ingestion-cron`

## Critical Conventions

- **No fake data** — no mocks, seeded reports, or hardcoded counts in runtime code. An empty database renders an empty UI
- **Server boundary** — `src/server/**` and `src/lib/prisma.ts` are `import 'server-only'`; components never touch Prisma or the filesystem
- **Auth per resource** — pages use `requireAuthOrRedirect()`, route handlers use `requireCurrentClerkUser()`; `proxy.ts` only attaches the Clerk session. No endpoint accepts `reporterId`/`clerkUserId` from the client
- **React Query** for all data fetching — key factories in `features/reports/api/queries.ts`, `useMutation` for forms; components import from `api/service.ts` and `api/queries.ts`, never `fetch` directly
- **API layer** per feature — `api/types.ts` → `api/service.ts` → `api/queries.ts`
- **Route handlers stay thin** — delegate to `src/server` services, map errors through `errorResponse`, never leak a stack trace
- **MapLibre** — import only via `loadMapLibre()`; waterway styling must read source/source-layer names back out of the loaded style, never hardcode or invent geometry
- **Icons** — only import from `@/components/icons`, never from `@tabler/icons-react` directly
- **Forms** — `useAppForm` from `@/lib/form` (TanStack `createFormHook`) + `form.AppField` rendering the field components in `@/components/forms/fields` (`field.TextField`, `field.SelectField`, …); raw `form.Field` for one-off custom fields; form-level Zod `onSubmit` validators
- **Page headers** — use `PageContainer` props (`pageTitle`, `pageDescription`, `pageHeaderAction`), never import `<Heading>` manually
- **Thai** is the UI language; comments and identifiers stay English
- **Formatting** — single quotes, JSX single quotes, no trailing comma, 2-space indent
- **Source health ≠ signal yield** — a source's technical status (`OK`/`DEGRADED`/`UNKNOWN`, did fetch/parse/upsert succeed) is a different fact from whether it has ever produced a relevant FihDar signal. Never collapse these into one label; `src/features/sources/lib/format.ts:signalCaption()` is the canonical distinction — see docs/INGESTION.md

## Repository Hygiene

The working tree can grow to multiple GB purely from regenerable local state — none of
it indicates a real problem:

- **`.next/`** — Next.js/Turbopack build + dev cache. Under long-running `npm run dev`
  sessions this can grow to multiple GB (Turbopack's persistent dev cache database does
  not self-prune). Safe to delete any time (`rm -rf .next`); it fully regenerates on the
  next `npm run dev` or `npm run build`. Gitignored.
- **`node_modules/`** — regenerate with `npm install` (npm is canonical — see below).
  Gitignored.
- **`.data/`** — local runtime state: uploaded images (dev only), the cached
  `@huggingface/transformers` ONNX embedding model (`.data/intel/models/`, ~110MB,
  expensive to re-download but disposable), embedding/result caches. Gitignored.
- **`test-results/`, `playwright-report/`** — Playwright QA output. Safe to delete;
  regenerates on the next `npm run test:e2e`. Gitignored.
- **`.freebuff/`** — **not a FihDar artifact.** It is another external agent tool's own
  worktree + local SQLite state, parked inside this directory because that tool was
  invoked here. Never delete or modify it without checking whether that tool still needs
  it — it may be actively in use.
- **Package manager**: `npm` is canonical (Dockerfile, `railway.json`, all `package.json`
  scripts use `npm`). `bun.lock` is kept only for contributors who prefer `bun` for
  `format`/`lint:fix`; it is not used by CI, Docker, or Railway and can drift — regenerate
  it with `bun install` if you rely on it, don't hand-edit it.
- Before adding a dependency, grep for whether something already installed covers it —
  this repo has previously accumulated unused packages (scaffold leftovers, abandoned
  feature branches) that sat in `package.json` with zero real imports.
- If disk usage looks abnormal, measure before deleting: `git status --short` (tracked vs
  untracked), then size the top-level directories — do not assume "large" means "unused"
  or that "gitignored" means "safe to delete" without checking what's actually in it.
