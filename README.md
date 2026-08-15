มีแค่พระเจ้าที่จะเข้าใจโค้ดในตอนนี้ Amen

# FihDar

**FihDar = Fish + Radar** — a citizen-reporting and GIS surveillance app for suspected
Blackchin Tilapia sightings and aquatic-risk information in Eastern Thailand
(ฉะเชิงเทรา, ชลบุรี, ระยอง).

Citizens submit a sighting with a photo and real coordinates. Every submission is stored
in PostgreSQL as `PENDING`. Only reports a reviewer has marked `VERIFIED` appear on the
public map. The UI language is Thai.

> The map shows exactly what is in the database. There is no seeded or demo report data —
> an empty database renders an empty map, which is the correct behaviour.

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| UI | Tailwind CSS 4, shadcn/ui (Base UI), Motion, Tabler Icons |
| Data fetching | TanStack Query |
| Validation | Zod (client and server) |
| Auth | Clerk |
| Database | PostgreSQL via Prisma 6 |
| Map | MapLibre GL JS + OpenFreeMap Liberty (OpenStreetMap vector tiles) |
| Hosting | Railway (app + Postgres + Volume) |

---

## Routes

### Pages

| Route | Auth | Purpose |
| --- | --- | --- |
| `/` | — | redirects to `/map` |
| `/map` | public | interactive Eastern Thailand waterway map with verified reports |
| `/report` | required | citizen sighting submission form |
| `/about` | public | what FihDar is and how it works |
| `/profile` | required | profile details + the user's own reports |
| `/auth/sign-in`, `/auth/sign-up` | — | Clerk-hosted components, FihDar-branded |

### API

| Endpoint | Auth | Notes |
| --- | --- | --- |
| `POST /api/reports` | required | multipart submission; stores image, inserts `PENDING`, returns the generated reference |
| `GET /api/reports/public` | public | `VERIFIED` only; no reporter PII; coordinates rounded to 3 decimals |
| `GET /api/reports/me` | required | current user's reports + real per-status counts |
| `GET /api/reports/[id]` | mixed | `VERIFIED` readable by anyone; `PENDING`/`REJECTED` owner-only |
| `GET /api/reports/[id]/image` | mixed | same rule as above; streams bytes, never a filesystem path |
| `GET /api/profile` | required | reads/creates the current user's profile from Clerk identity |
| `PATCH /api/profile` | required | edits `displayName`, `phone`, `organization`, `province` only |

---

## Local setup

```bash
npm install
```

Copy the env template and fill it in:

```bash
cp env.example.txt .env
```

Minimum for local development:

```
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/fihdar
UPLOAD_DIR=
```

Leave `UPLOAD_DIR` empty locally — images then go to `./.data/uploads` (git-ignored).
Leave the Clerk keys empty to use Clerk's keyless development mode, or paste real keys
from the Clerk dashboard.

Apply the schema and start:

```bash
npx prisma migrate dev
```

```bash
npm run dev
```

Then open **http://localhost:3000/map**.

Other scripts:

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm run build
```

```bash
npm run db:studio
```

---

## Database

Two models, in `prisma/schema.prisma`:

- **`UserProfile`** — `clerkUserId` (unique), `displayName`, `email`, `phone?`,
  `organization?`, `province?`, `avatarUrl?`, timestamps. Clerk owns credentials;
  **no passwords are stored here**.
- **`SightingReport`** — UUID `id`, unique `publicReference` (`FD-YYYY-XXXXXXXX`),
  `reporterId` → `UserProfile`, `latitude`/`longitude`, `province`, `district?`,
  `subdistrict?`, `locationDescription?`, `observedAt`, `quantityRange`, `note?`,
  `imagePath`, `status` (`PENDING` | `VERIFIED` | `REJECTED`, default `PENDING`),
  `riskLevel?` (`LOW` | `MEDIUM` | `HIGH`), `verifiedAt?`, timestamps.

Indexed on `clerkUserId`, `reporterId`, `status`, `province`, `observedAt`, `createdAt`.

Migration: `prisma/migrations/20260815000000_init/`.

There is no admin review UI yet. To verify a report during development, flip its `status`
to `VERIFIED` in Prisma Studio, then reload `/map`.

---

## Image storage

Uploads never touch the database or the repository. `src/server/storage.ts` is the only
module that reads or writes the filesystem, so it can be swapped for S3/R2 later without
changing report business logic.

- Destination is `UPLOAD_DIR`, falling back to `./.data/uploads`.
- Filenames are freshly generated UUIDs — the original filename is discarded.
- Accepted types: JPEG, PNG, WebP; max 5 MB.
- The declared MIME type must match the file's **magic bytes**, checked server-side.
- Stored paths are validated against a strict pattern and confined to the upload root,
  so `../` traversal cannot escape it.
- Only the relative path is persisted; images are served through
  `GET /api/reports/[id]/image`, which re-checks authorisation on every request.
- If the DB insert fails after a successful write, the orphaned file is deleted.

---

## Map data

```
PostgreSQL → GET /api/reports/public → GeoJSON → MapLibre source → MapLibre layers
```

The basemap is **OpenFreeMap Liberty**, an OpenStreetMap-derived vector style on the
OpenMapTiles schema, served without an API key. Attribution is carried in the style and
rendered by MapLibre's `AttributionControl`. Override with `NEXT_PUBLIC_MAP_STYLE_URL`.

**Waterways are real map data.** `src/features/map/lib/waterways.ts` reads the loaded
style back and re-styles the basemap's own `water` and `waterway` source-layers in
Keppel. No river geometry is authored by this project; on a style with no hydrography the
emphasis is simply skipped.

Report layers are GeoJSON-driven (clustered points, a selection layer, and a heatmap
built from verified coordinates). The heatmap is labelled
*ความหนาแน่นของรายงานที่ยืนยันแล้ว* — report density — not an outbreak area, because no
analysis supporting that claim exists.

---

## Security and privacy

- Every protected route handler derives the user from `auth()` server-side. No endpoint
  accepts `reporterId` or `clerkUserId` from the client — supplying either is rejected.
- Ownership is checked per record: changing a report id or query parameter cannot expose
  another user's `PENDING`/`REJECTED` report or its image.
- Public responses expose no email, phone, Clerk id, or filesystem path, and errors never
  carry stack traces.
- **Coordinate precision:** sighting locations can be homes. Exact coordinates are stored
  in PostgreSQL and shown to the owner, but `/api/reports/public` rounds them to 3
  decimals (~110 m) before they leave the server. The map cannot reveal more than the API
  returns.
- Private values never use the `NEXT_PUBLIC_` prefix. `NEXT_PUBLIC_MAP_STYLE_URL` is the
  only map-related public variable and is a public tile URL by design.

---

## Deploying to Railway

1. **Postgres** — add the Postgres plugin; Railway injects `DATABASE_URL`.
2. **Volume** — attach a Volume to the app service, mount it at `/data`, and set
   `UPLOAD_DIR=/data/fihdar/uploads`. Without a Volume, uploaded images are lost on every
   redeploy.
3. **Variables** — set `DATABASE_URL`, `UPLOAD_DIR`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
   `CLERK_SECRET_KEY`, `NEXT_PUBLIC_APP_URL`, and optionally
   `NEXT_PUBLIC_MAP_STYLE_URL`.
4. **Build / start** — `railway.json` runs `npm run build`, then `npm run start`, which
   applies `prisma migrate deploy` before booting Next.

No Windows paths are hardcoded anywhere; local Windows paths are a development detail
only.

---

## Implemented vs. planned

**Implemented:** interactive waterway map with filters, layers, clustering, heatmap,
quick navigation, and a detail drawer; citizen reporting end-to-end with real uploads and
persistence; profile with live counts and the user's own reports; Clerk sign-in/sign-up;
the full API surface above; Railway-compatible storage and deployment config; an offline
intelligence pipeline (`npm run db:intel`) that classifies relevance, extracts location,
links near-duplicates, and groups external observations into event candidates — see
[docs/FIHDAR_INTELLIGENCE_SPEC.md](./docs/FIHDAR_INTELLIGENCE_SPEC.md); an EXPERIMENTAL
operational priority ranking over those event candidates, exposed on `/map` — see
[docs/FIHDAR_PRIORITY_MVP.md](./docs/FIHDAR_PRIORITY_MVP.md).

**Planned / not built:** staff review UI for moving reports out of `PENDING`; automated
species identification (no model is connected — nothing in the app claims to identify a
species); external geocoding (map search navigates a curated EEC waypoint list, not a
geocoder); risk-level scoring (the `riskLevel` column exists but nothing writes it);
habitat suitability / protected aquaculture value / field accessibility in the priority
score (see docs/FIHDAR_PRIORITY_MVP.md §4).

---

## Documentation

- [AGENTS.md](./AGENTS.md) — structure, conventions, map specifics
- [docs/FIHDAR_INTELLIGENCE_SPEC.md](./docs/FIHDAR_INTELLIGENCE_SPEC.md),
  [docs/FIHDAR_INTELLIGENCE_ROADMAP.md](./docs/FIHDAR_INTELLIGENCE_ROADMAP.md) — pipeline design
- [docs/FIHDAR_PRELIMINARY_VALIDATION.md](./docs/FIHDAR_PRELIMINARY_VALIDATION.md),
  [docs/FIHDAR_SPECIES_GATE_VALIDATION.md](./docs/FIHDAR_SPECIES_GATE_VALIDATION.md),
  [docs/FIHDAR_LOCATION_VALIDATION.md](./docs/FIHDAR_LOCATION_VALIDATION.md),
  [docs/FIHDAR_DEDUPE_EVENT_VALIDATION.md](./docs/FIHDAR_DEDUPE_EVENT_VALIDATION.md) —
  controlled-benchmark validation for each pipeline phase, with measured accuracy and
  documented limitations (not real-world accuracy claims)
- [docs/FIHDAR_PRIORITY_MVP.md](./docs/FIHDAR_PRIORITY_MVP.md) — operational priority scoring
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — Railway operational reference
- [docs/AI_USAGE_DISCLOSURE.md](./docs/AI_USAGE_DISCLOSURE.md),
  [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) — disclosure and attribution
