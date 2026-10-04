# Scorecard data migration plan

Move the hardcoded scorecard data into Postgres via Drizzle, serve it through a
hybrid of a SvelteKit server load (for the fixed page) and a JSON API endpoint (for
runtime, user-added charts), and refactor each chart to receive only its own
question's data. All data in this app is synthetic.

## Decisions

- Postgres in Docker, accessed with Drizzle (postgres.js client).
- `adapter-node`. Deploy target is Azure (App Service or Container Apps) with
  Postgres on Azure Database for PostgreSQL Flexible Server.
- No experimental SvelteKit features. Delivery is a hybrid: a `+page.server.ts`
  load serves the fixed page (fast first paint, no spinners), and a JSON API
  endpoint serves runtime, user-added charts (client fetch with skeletons). Both
  call the same framework-agnostic data accessors. Each chart receives only its
  slice and builds its own ECharts option.
- `DATABASE_URL` read at runtime via `$env/dynamic/private`.
- Migrations via `db:generate` + `db:migrate` (SQL files committed to git). No
  `db:push`, so the migration files stay the source of truth.

### Why hybrid (load + JSON endpoint), not remote functions

Remote functions let a chart issue its own query from inside the component, which
is the natural fit for user-added charts, but they are experimental and ruled out.
Of the stable options:

- A route-level `load` fetches a predetermined set of data per navigation. Perfect
  for the current fixed page: data arrives in the first response, so fast paint, no
  loading states, no client waterfalls, full type safety for free.
- A `load` cannot serve charts the user adds after the page is live (the query set
  is not known at page-load time). That is the dynamic case, landing today or
  tomorrow.
- A JSON endpoint (`+server.ts`) is the stable way to serve arbitrary, client-driven
  queries at runtime. User-added charts fetch it and show skeletons.

So the split is principled, not a compromise: **data known before the page renders
goes through the load (no spinner); data requested after the page renders goes
through the endpoint (spinner).** This is close to React Server Components in effect
(server-rendered data, no initial spinner) but route-level rather than per-component;
the per-component equivalent is remote functions. Even with RSCs, runtime
client-driven reads still fall back to an endpoint, so the hybrid is not a SvelteKit
limitation one would escape by switching frameworks.

The key design rule that makes it clean: the data accessors
(`getQuestion(...)`, `getCelebrity(...)`, `getScorecardHeader(...)`) are **pure, with
no SvelteKit coupling** (plain args in, plain data out, no request objects, no
`load` types). The load calls them directly; the endpoint validates params then
calls the same accessors. One data layer, two deliveries. If remote functions ever
stabilise, both collapse into `query()` calls reusing the same accessors. No
data-layer rewrite in any direction.

## Data model

Two levels, with explicit dimension columns (no composite segment strings).

### Tables

- **celebrity**: id, name, photoUrl, imdbUrl.
- **category**: id, name.
- **celebrity_category**: celebrityId, categoryId, position. Benchmarks shown for a
  celebrity; position 1 is the primary one (used by Appeal and Power Factors).
- **scorecard** (header, the awareness gate): subject x fieldingDate x gender,
  holding sampleBase, awareness, eScore (nullable; categories have no eScore). Owns
  the sample-level, non-gated facts.
- **question_result** (the gated detail): subject x fieldingDate x gender x ageBand
  x awarenessMode x question, holding `base` (aware count for that cell) + `data`.

### Enums

- gender: `total` / `male` / `female`
- ageBand: `total` / (future bands). Added now, always `total` for the mock.
- awarenessMode: `any` / `name` / `face`
- question: `appeal` / `attributes` / `power_factors`

Dropped from the question set: `total_appeal` (derived from appeal), `awareness`
and `e_score` (moved to the scorecard header).

### Dimension sentinels, not NULL

Dimension columns always carry a real "all" value (`gender='total'`,
`ageBand='total'`, `awarenessMode='any'`), never NULL. Reasons:

- unique constraints work (Postgres treats NULLs as distinct, so NULL dimensions
  would not dedup),
- one convention for "all" across every dimension,
- uniform querying (`WHERE ageBand = 'total'`).

NULL is used only for `celebrityId` / `categoryId` on the subject rows, where
exactly one is set. That is "not applicable", which is what NULL means. Dimension
"all" is a value, so it gets a sentinel. Different meanings, different mechanisms.

### `data` shapes (JSON, not jsonb)

Stored as `json` to preserve object key order, which is the bar order for the
attribute and power-factor charts. `jsonb` reorders keys.

- **appeal**: the 6-point distribution
  `{ likeALot, like, likeSomewhat, dislikeSomewhat, dislike, dislikeALot }`.
  Box scores (Top Two / Top Three / Bottom Two / Bottom Three) are derived at
  render, not stored.
- **attributes**: ordered map name -> pct.
- **power_factors**: ordered map name -> pct.

### Constraints

- unique on (subjectId, fieldingDate, gender, ageBand, awarenessMode, question).
- check that a subject is exactly one of celebrity or category.

## Appeal, awareness mode, and base (the core modelling result)

Background, confirmed against E-Poll methodology:

- Awareness is measured over the whole sample. Appeal, attributes, and power
  factors are measured only among respondents aware of the subject. Awareness is
  the gate; the others are gated. This is why awareness and eScore live on the
  header, and the question rows' `base` is the aware count.
- In real E-Poll, name vs face is the awareness recognition cut. Tabulating appeal
  by it is a cross-tab that cannot be recovered from aggregates. The box scores
  (Total Appeal) are a pure rollup of the one appeal distribution, so Total Appeal
  is not a separate question.

Appeal slices by awarenessMode:

- `any` = appeal among everyone aware (by name or face)
- `name` = appeal among those aware by name
- `face` = appeal among those aware by face

These are three different-sized subpopulations. Each appeal row stores its own
honest `base` (the real synthetic size of that group). Since the data is synthetic,
we generate plausible name/face distributions and bases (name-aware and face-aware
both smaller than the all-aware total).

### # mode and comparability (one indexing rule, several places)

A count is `pct x base / 100`, and a percentage must be multiplied by the base it
was measured against. When a chart overlays several series measured against
different bases, raw counts across them are not comparable (different denominators).
So in # mode such a chart **indexes every series to one common reference base**:

```
displayed count = seriesPct x referenceBase / 100
```

and shows an "indexed to base: N" note. The per-series base cancels out of this
formula, so it is not used for the # display; it is still stored as the honest
denominator.

This single rule covers every multi-series overlay in the app:

- **Category benchmarks** (Appeal, Power Factors): the category's rate is on a
  different base scale, indexed to the celebrity's base. (Already in the app today.)
- **Total Appeal name/face slices**: `any` / `name` / `face` have different real
  aware bases, indexed to the `any` (all-aware) base.
- **Attributes Total/Male/Female**: the three genders have different bases
  (1200 / 590 / 610), indexed to the total base so the gender bars are comparable.
  (This is what the app already does; it is correct, not a quirk.)

The honest per-row base is stored in every case, for truthful data and for
potential future charts, tooltips, or exports that show a single series on its own.

## Seeding (all synthetic)

- celebrities (Brad Pitt), categories (the five), celebrity_category benchmarks
  with positions.
- scorecard headers from the current records' base / awareness / eScore.
- question_result rows:
  - appeal: three awarenessMode slices (any / name / face) per subject x gender.
    `any` uses the existing 6-point distribution; name and face get synthetic
    6-point distributions and their own synthetic bases.
  - attributes, power_factors: awarenessMode = `any` only.
  - ageBand = `total` throughout.
- Idempotent: wipe + insert in one transaction. Run via a `db:seed` script
  (`node --env-file=.env ...`, Node 24 runs the TS directly).

## Server data layer

- `src/lib/server/db/` : client (`index.ts`), `schema.ts`.
- Pure data accessors (no SvelteKit coupling, so callable from a load, an endpoint,
  or a future remote function alike):
  - `getCelebrity(id)`: celebrity + its categories ordered by position.
  - `getScorecardHeader({ subjectId, fieldingDate, gender })`: sampleBase,
    awareness, eScore.
  - `getQuestion({ subjectId, fieldingDate, gender, ageBand, awarenessMode,
    question })`: `{ base, data }`, or a miss.

### Delivery (hybrid)

- **Fixed page**: `+page.server.ts` `load` calls the accessors directly for the
  known charts + celebrity + header, and returns a keyed object. Server-rendered,
  no spinner, full typing.
- **Dynamic / user-added charts**: a generic, validated endpoint
  `GET /api/question?subjectId=...&question=...&gender=...&ageBand=...&awarenessMode=...&fieldingDate=...`
  and `GET /api/celebrity/:id`. The endpoint validates params with valibot (400 on
  bad input, 404 on a missing cell), then calls the same accessors.

### Shared types

A valibot schema defines the request params (and their allowed enum values); the
accessor return types define the responses. Both live in a shared module imported
by the load, the endpoint, and the client fetch wrapper, so the contract stays typed
across the HTTP boundary.

### Caching

Not needed day one. If many user-added charts hit the endpoint and want
dedup/caching/loading-state management, add TanStack Query
(`@tanstack/svelte-query`) in front of the endpoint later. It is the stable,
framework-agnostic equivalent of the caching remote functions would have provided.

## Component refactor

Charts become self-contained: each receives its question's data (+ mode, + base)
and builds its own ECharts option. `ChartCard` (the shell) is unchanged.

Each chart takes an **optional initial `data` prop**:

- if `data` is provided (load path, the fixed page), render immediately, no fetch,
  no spinner,
- if absent (user-added charts), fetch from the API endpoint on mount and show a
  skeleton until it resolves.

The same component serves both the fast load path and the dynamic endpoint path.

Chart specifics:

- **TotalAppealChart**: appeal distribution(s) -> derives box scores; renders
  whichever awarenessMode slices exist (Total always; Name/Face when present),
  indexed to the common base in # mode.
- **AttributesChart**: attributes for total / male / female.
- **AppealChart**: primary category's appeal distribution; celebrity's aware base
  for # mode.
- **PowerFactorsChart**: power_factors for celebrity + primary category.
- **AwarenessCard**, **EScoreCard**: read from the scorecard header.

`scorecard.ts` shrinks to the shared pieces (Mode, makeView, barBase, colours) and
is renamed `chart.ts`. `getScorecard`, the `Scorecard` type, `DATE`, and the JSON
import go away.

`+page.svelte` receives `data` from the loader and passes each slice down. The
hardcoded "Brad Pitt" name / photo / IMDb link and the category labels come from the
loaded celebrity. The page-level `base` prop disappears (base now lives per row and
on the header).

## Config / infra changes

- Replace adapter-static with adapter-node in `vite.config.ts`.
- Delete `src/routes/+layout.ts` (the `prerender = true`).
- No experimental flags.
- New files for delivery: `+page.server.ts` (load for the fixed page),
  `src/routes/api/question/+server.ts` and `src/routes/api/celebrity/[id]/+server.ts`
  (endpoints for dynamic charts), and a shared request/response types module.
- Drizzle scaffolding: `compose.yaml` (Postgres), `.env` / `.env.example`
  (`DATABASE_URL`), `drizzle.config.ts`, db client + schema, and scripts
  (`db:start`, `db:generate`, `db:migrate`, `db:studio`, `db:seed`). Pin exact
  dependency versions rather than caret ranges.

## Verification

- `svelte-check` and `build` pass.
- Every card and chart matches the current UI in both % and # mode, for the cells
  that exist today. The name/face appeal series are new synthetic data, so they are
  additive, not a regression against the old "Total" numbers.

## Out of scope (but designed for)

- **User-added charts / adding series to existing charts.** Landing today or
  tomorrow as a separate feature. This migration prepares for it: the JSON endpoint
  and the pure accessors already support arbitrary runtime queries, and charts take
  an optional initial `data` prop so a user-added chart just fetches + shows a
  skeleton. The feature's own design (how charts are defined, saved, validated,
  permissioned) is deferred.

## Out of scope

- Wiring the Fielding date and Filter by dropdowns.
- A route per celebrity.
- Auth. The data is currently public (the scorecard JSON already ships in the
  client bundle today), so this is no worse, but it would need auth before holding
  subscriber-only data. Note the API endpoint is a new public surface; it needs the
  same auth when that lands.
- news.json.

## Open, non-blocking details

- Exact synthetic base ratios for name vs face (e.g. name-aware ~85% of all-aware,
  face-aware ~70%).
- Whether the appeal chart's indexing note wording matches the category one
  verbatim or distinguishes "aware of Brad Pitt" from "Brad Pitt respondents".
