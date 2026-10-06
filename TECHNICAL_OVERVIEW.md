# Technical overview

Largo E-Score is a SvelteKit (Svelte 5) application that renders celebrity survey
scorecards from a Postgres database. This document covers the architecture: how a request flows,
how the data is modelled and read, and how the app is built and deployed.


## Running locally

```sh
pnpm install
pnpm db:start      # Postgres via docker compose
pnpm db:migrate    # apply schema
pnpm db:seed       # load synthetic data
pnpm dev           # start the dev server
```

## Stack

- **Framework**: SvelteKit on Svelte 5 (runes), `@sveltejs/adapter-node` producing a
  Node server (`node build`, port 3000).
- **Database**: Postgres 17, accessed through Drizzle ORM over the `postgres` driver.
- **Validation**: valibot schemas validate query params.
- **Charts**: ECharts, with a shared chart layer in `src/lib/chart.ts`.
- **Export**: jsPDF for the one-page PDF; a hand-rolled CSV builder for scorecards.
- **Tooling**: Vite, ESLint, Prettier, drizzle-kit for migrations, pnpm workspace.

## Layout

```
src/
  routes/
    +page.svelte / +page.server.ts        celebrity list (home)
    celebrity/[id]/                        the scorecard page
    compare/                               the comparison view
    api/                                   JSON endpoints (question, celebrity, search)
  lib/
    server/
      db/schema.ts                         Drizzle table + enum definitions
      db/accessors.ts                      pure data accessors (no SvelteKit coupling)
      db/seed.ts                           synthetic data generator
      db/index.ts                          db client
      types.ts                             shared types + valibot schemas
    components/                            Svelte UI (charts, cards, header, nav)
    chart.ts                               chart view adapter, axis base, color tokens
    oneSheet.ts / oneSheetPdf.ts           CSV and PDF export
    api.ts                                 client-side fetch wrappers
infra/                                     Terraform (Azure Container Apps + Postgres)
drizzle/                                   generated migrations
```

## Delivery: load + JSON endpoint

The app is server-rendered, with a deliberate split between two delivery paths that both
call the same pure accessors:

- **Data known before the page renders goes through a `+page.server.ts` `load`.** It
  arrives in the first response, so there is fast paint, no spinner, no client waterfall,
  and full type safety. This serves the fixed scorecard, the list, and the compare view.
- **Data requested after the page renders goes through a JSON endpoint**
  (`routes/api/`). This is the stable way to serve arbitrary client-driven queries at
  runtime with the client showing a skeleton until it resolves.

## Request flow

Each page's `load`:

1. Parses the URL query params with a valibot schema (`pageParamsSchema`,
   `compareParamsSchema`). Invalid params are a 404, not a silent fallback. Missing
   params fall back to defaults: the default fielding date and the "all" sentinels
   (`gender = total`, `ageBand = total`).
2. Calls the database accessors, fanning out concurrent reads with `Promise.all`.
3. Returns a plain data object the Svelte page renders.

The scorecard load (`celebrity/[id]/+page.server.ts`) 404s if the celebrity is unknown
or the selected awareness cell is missing, but individual chart slices degrade
independently (a missing slice returns `null` and the chart shows an empty state rather
than failing the page). Each chart inherits the page filter on every dimension except
its own comparison axis: Total Appeal fans over awareness mode, Attributes fans over
gender, the rest inherit gender.

The JSON endpoints under `routes/api/` (question, celebrity, celebrity search) validate
with the same schemas and call the same accessors.
The endpoint is a public surface and would need auth before holding subscriber-only data.

## Data model

The measurement model has two levels, distinguished by the population a number is
measured over. **Awareness** is measured over the whole sample. **Appeal,
attributes, power factors, and E-Score** are asked only of respondents who are
aware of the subject, so they are measured over the aware subpopulation. This split
decides which denominator (base) each number carries.

### Tables (`schema.ts`)

- `celebrity`, `category`, `celebrity_category`: subjects and their benchmark
  memberships (position 1 is the primary benchmark, used by Appeal and Power Factors).
- `awareness`: one row per subject x fieldingDate x gender x ageBand, holding
  `sampleBase` (people surveyed) and the aware counts by recognition mode (`awareAny`,
  `awareName`, `awareFace`). These counts are the single source of truth for the
  `question_result` bases.
- `question_result`: one row per subject x fieldingDate x gender x
  ageBand x awarenessMode x question, holding `base` (the aware count for that cell) and
  `data` (a JSON payload whose shape depends on the question).

There is no separate scorecard table; a scorecard is just the set of rows for a
subject x fieldingDate, assembled at read time.

### Dimensions and sentinels

Every dimension is a Postgres enum carrying a real "all" sentinel value, never NULL
(`gender = total`, `ageBand = total`, `awarenessMode = any`). This makes unique
constraints dedup correctly (Postgres treats NULLs as distinct), gives one convention
for "all" across every dimension, and keeps querying uniform (`WHERE gender = 'total'`).
NULL is used only for `celebrityId` / `categoryId`, where exactly one is set; a check
constraint enforces that exactly one of the two is non-null on every subject row.

### `data` payloads (json)

- **appeal**: the 6-point distribution
  `{ likeALot, like, likeSomewhat, dislikeSomewhat, dislike, dislikeALot }`. Box scores
  (Top Two / Top Three / Bottom Two / Bottom Three) are derived at render, not stored.
- **attributes** / **power_factors**: ordered maps (name -> pct).
- **e_score**: a single number.

### Bases and invariants

The `base` on a question row is the honest denominator: the size of the population that
metric was measured over. Awareness is measured over the sample (`sampleBase`); `question_reults`
are measured over the awares, so a row's base equals the matching awareness
count. The invariants the data must satisfy:

1. Exactly one of `celebrityId` / `categoryId` is set on every subject row.
2. A `question_result` row's `base` equals the matching awareness count
   (`any -> awareAny`, `name -> awareName`, `face -> awareFace`).
3. Stored `total` (gender, age) equals the sum of its slices; `awarenessMode = any` is
   the OR-union of name/face (they overlap), not a sum.
4. A category's base and distribution are the rating-weighted pool of its member actors,
   so a category base is `>=` any member and may exceed `sampleBase` (its unit is
   ratings, not people).
5. Awareness % is derived from counts (`awareAny / sampleBase`), never stored
   independently.
6. Counts (# mode) are only shown within a single subject in that subject's unit; any
   cross-subject or category chart is shown as rates (%), because counts on different
   exposure bases are not comparable.

Slices are stored precomputed rollups, read directly rather than aggregated at query
time, so a filtered view is a single read. The obligation is at write time: a stored
`total` must equal what its slices roll up to.

### Categories as rating pools

A category (for example "Film Personality - Actor") is the aggregate of its member
actors, not a standalone subject. Its unit is a rating (one respondent evaluating one
actor), so a respondent aware of three actors contributes three ratings. The category
rate is the rating-weighted pool of its members, which makes it comparable across
categories and against a celebrity's own aware-based rate, but means its raw count is a
different unit from a celebrity's (people) and is never rendered as a count.

### Accessors (`accessors.ts`)

Plain functions, no SvelteKit coupling. A subject id is unique across celebrities and
categories, so most reads match `celebrityId = id OR categoryId = id`. Key functions:
`getCelebrity`, `getAwareness`, `getQuestion`, `getFieldingDates`, `listCelebrities`,
`listCategories`.

### Types and validation (`types.ts`)

One module holds the shared enums (as `as const` tuples), the valibot query schemas, and
the response types (`AppealData`, `OrderedMap`, `QuestionResult`, `Awareness`). It is
imported by loads, endpoints, and client fetch wrappers, so types and runtime validation
stay in sync. The compare layer treats awareness as its own metric (it is not a DB
`question`, since its % is derived) and reads it via `getAwareness`;
`compareParamsSchema` parses the `subjects` param from a comma-separated string, then
trims, de-dupes, and caps it at `COMPARE_MAX_SUBJECTS`.

## Charts and display modes

`chart.ts` centralises chart behaviour so each component only builds its own ECharts
option on top:

- `makeView(mode, axisBase)`: the one place that knows about percentage vs count mode.
  In count mode each series shows literal counts on its own base
  (`count = round(pct * base / 100)`); series are not re-indexed to a common base, and
  the shared y-axis is scaled by the largest series base so every series fits.
- `barBase(...)`: shared axis/grid defaults for bar charts.
- `boxScores(...)`: the appeal box scores, computed at render.
- `PALETTE` / `paletteColor`: per-subject colors for the comparison chart.

Because counts are only comparable within a single subject's base, any cross-subject or
category chart is percentage-only; the %/# toggle only drives the within-subject charts.

## The compare view

`routes/compare/` puts several subjects side by side on one metric at one audience slice,
driven entirely by query params so a comparison is shareable by URL. The chart shape
adapts to the metric's data shape: a scalar metric (E-Score) renders one bar per subject,
while a distribution or ordered map (appeal, attributes, power factors) renders a grouped
bar chart (x-axis = the metric's keys, one bar per subject within each group, subjects
distinguished by color). Categories can be mixed in with celebrities except on E-Score
(which categories do not have); when the metric is E-Score the load drops any category
ids. The whole comparison renders as percentages only, for the cross-subject fairness
reason above.

## Export

- `oneSheet.ts`: builds scorecard CSV and the download filename.
- `oneSheetPdf.ts`: builds a one-page PDF summary (name, E-Score, awareness, category
  averages) with jsPDF.

## Build and deployment

### Docker

The `Dockerfile` is multi-stage with two final targets:

- `app`: the production SvelteKit server. Full install, `pnpm build`, then a lean image
  with pruned production dependencies running `node build` on port 3000 as the `node`
  user.
- `tools`: the migrate/seed image. Carries full deps (drizzle-kit), the migration SQL,
  the drizzle config, and the source tree. Default command applies migrations; seeding
  is a one-time command override.

### Local

`compose.yaml` runs a Postgres 17 container for development; the `pnpm db:*` scripts
drive migrate/seed/studio against it using `.env` for `DATABASE_URL`. Migrations are SQL
files committed to git via `db:generate` + `db:migrate` (no `db:push`), so the migration
files stay the source of truth.

### Azure (Terraform in `infra/`)

Deployed to Azure Container Apps in West Europe. The app is public (no login). Terraform
authenticates as the signed-in Azure CLI user, with state in a shared azurerm backend
under the `largo-app.tfstate` key.

Networking (`network.tf`):

```
             Internet
                │  HTTPS
                ▼
  ┌──────────── vnet-largo 10.0.0.0/16 ─────────────────┐
  │  snet-aca 10.0.0.0/23 (delegated: Microsoft.App)     │
  │   Container Apps environment                         │
  │     ├─ largo app (public URL)                        │
  │     └─ migrate job                                   │
  │                 │ 5432, TLS                          │
  │                 ▼                                    │
  │  snet-postgres 10.0.2.0/24 (delegated: Postgres)     │
  │   Postgres Flexible Server (no public IP)            │
  │  private DNS zone (linked): server name → 10.0.2.x   │
  └──────────────────────────────────────────────────────┘
```

- A VNet with two delegated subnets: `snet-aca` for the Container Apps environment (no
  NSG, since the platform needs specific traffic a wrong rule would break) and
  `snet-postgres` for the database, with an NSG that allows 5432 only from the app subnet
  and denies the rest of the VNet.
- A **Postgres Flexible Server** (v17, `B_Standard_B1ms`, 32 GB, 7-day backups),
  VNet-integrated with no public endpoint and TLS required, reached over a private DNS
  zone. The DNS zone link must exist before the server is created.
- An **Azure Container Registry** (Basic), pulled via a user-assigned managed identity
  with `AcrPull`.
- A **Log Analytics workspace** (30-day retention, required) and the **Container Apps
  environment** on the Consumption workload profile, keeping scale-to-zero.
- The **container app** itself: external HTTPS ingress on port 3000, `DATABASE_URL`
  injected as a secret, `PROTOCOL_HEADER` / `HOST_HEADER` set to the forwarded-proto /
  forwarded-host headers so SvelteKit's origin check uses the public host (avoiding a
  circular dependency on the app's own FQDN). Replicas scale from `var.min_replicas`
  (default 0) to 1. A placeholder image is used at create and `ignore_changes` is set on
  the image, since the real image is managed out of band.
- A manually triggered **migrate job** (`job-largo-migrate`) on the tools image, with
  the same secret and identity.

Release flow (`infra/deploy.sh`): read the infra names from Terraform outputs, build the
`app` and `tools` images in the cloud with `az acr build` (linux/amd64, so nothing
cross-compiles on an ARM Mac), run the migrate job and wait for it to succeed, then
`az containerapp update` the app to the new image. Seeding is a one-time step outside the
release (the synthetic seed runs once). Scale settings are managed through Terraform, not
the CLI, so a CLI change would show up as drift and be reverted on the next apply.
