# CLAUDE.md

FihDar — a Thai-language environmental surveillance app (citizen sighting reports + a
MapLibre waterway map for Eastern Thailand), built on a Next.js 16 + shadcn/ui base.

## Key References

- **[AGENTS.md](./AGENTS.md)** — project overview, structure, conventions, map specifics, verification
- **[README.md](./README.md)** — setup, database, image storage, security model, Railway deployment
- **[docs/forms.md](./docs/forms.md)** — Form system: TanStack Form + Zod, composable fields, validation, multi-step, sheet/dialog forms
- **[docs/themes.md](./docs/themes.md)** — Theme system: OKLCH colors, adding themes, font config
- **[docs/clerk_setup.md](./docs/clerk_setup.md)** — Clerk auth setup: organizations, billing, environment variables

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
