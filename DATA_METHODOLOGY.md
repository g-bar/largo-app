# Data methodology

How scorecard data is modelled: what each table and metric means, which population
each number is measured over, and the invariants that must hold. All data in this app
is synthetic, but the model follows E-Poll survey methodology.

## Two levels: the gate and the gated

Every metric sits at one of two levels, distinguished by the population it is measured
over.

- **The gate (whole sample).** Awareness: of everyone surveyed, how many recognise
  the subject. Measured over the full sample.
- **The gated metrics (awares only).** Appeal, attributes, power factors, and E-Score.
  These are only asked of respondents who are aware of the subject. A non-aware person
  never answers them, so they are measured over the aware subpopulation, not the whole
  sample.

Awareness is the gate; the rest are gated. This split is the backbone of the model and
decides which denominator (base) each number carries.

## Tables

- **awareness** (the gate): one row per subject x fieldingDate x gender. Holds the
  whole-sample facts: `sampleBase` (people surveyed) and the aware counts by
  recognition mode: `awareAny`, `awareName`, `awareFace`.
- **question_result** (the gated detail): one row per subject x fieldingDate x gender x
  ageBand x awarenessMode x question. Holds `base` (the aware count for that cell) and
  `data` (the metric payload).
- **celebrity**, **category**, **celebrity_category**: subjects and the benchmark
  memberships (which categories are shown for a celebrity, and in what order; position
  1 is the primary benchmark).

There is no separate "scorecard" table. A scorecard is just the set of rows for a
subject x fieldingDate, assembled at read time.

## Dimensions and sentinels

Dimensions on `question_result`: `gender` (total / male / female), `ageBand` (total,
plus future bands), `awarenessMode` (any / name / face), `question` (appeal /
attributes / power_factors / e_score). The `awareness` table is keyed only by `gender`
(plus subject and fieldingDate); its recognition cut is columns, not an `awarenessMode`
dimension (see below).

Every dimension always carries a real value, never NULL. The "all" value is a real
sentinel: `gender = total`, `ageBand = total`, `awarenessMode = any`. Reasons:

- unique constraints dedup correctly (Postgres treats NULLs as distinct),
- one convention for "all" across every dimension,
- uniform querying (`WHERE gender = 'total'`).

NULL is used only for `celebrityId` / `categoryId`, where exactly one is set (the other
is "not applicable"). That is enforced by a check: exactly one of the two is non-null.

## Bases: which population a number is measured over

The `base` on a question row is the size of the population that metric was measured
over, i.e. its denominator. It is not a cosmetic field; it is the honest denominator.

- Awareness is measured over the **sample**, so its denominator is `sampleBase`.
- Gated metrics are measured over the **awares**, so their denominator is the aware
  count for that cell's awareness mode.

The awareness row's aware counts are the single source of truth for the gated
denominators. For a given subject x fieldingDate x gender:

```
question_result.base (awarenessMode = any)  == awareness.awareAny
question_result.base (awarenessMode = name) == awareness.awareName
question_result.base (awarenessMode = face) == awareness.awareFace
```

This is a hard invariant: a gated row's base equals the matching awareness count.

### `base` unit: people for a celebrity, ratings for a category

`base` is the row's denominator, but its unit depends on the subject kind:

- **Celebrity row:** `base` is **people** aware of that celebrity.
- **Category row:** `base` is **ratings** (person x actor evaluations), the member-actor
  rating pool, not distinct people. See the category section below.

The same column therefore carries two units. The schema does not tag which; the unit is
implied by whether `celebrityId` or `categoryId` is set. This is tolerated because the
UI never renders a category `base` as a count: category figures are only ever shown as
rates (see Display modes), where the denominator does not surface. The category `base`
is still retained, it is the honest denominator for that row's percentages and keeps the
uniform `{ base, data }` row shape, and a future category-first view could show it as a
ratings count. If such a view lands, make the unit explicit (e.g. a `baseUnit` column)
rather than relying on the subject kind.

### Awareness % is derived, not stored

The displayed awareness percentage is `awareAny / sampleBase`. Counts are stored (not
percentages) so this derivation and the base invariant above are exact, with no
rounding drift.

## Awareness mode lives differently at the two levels

The recognition cut (aware by name, by face, or either) exists in both tables, but it
is modelled differently, deliberately.

- **On the awareness table (the gate):** it is **not a dimension**. There is one row
  per subject x fieldingDate x gender, and the recognition cut is three columns on that
  row: `awareAny`, `awareName`, `awareFace`, each a count of how many of the sample
  recognise the subject by that mode. (name and face overlap, so they do not sum to
  any; `any` = name OR face.) It is "what you count", a facet of one sample
  measurement, so it is columns, not a dimension. Making it an `awarenessMode` dimension
  here would have been confusing, because on the gate the mode does not filter the
  population (the denominator is always the whole sample).

- **On question_result (gated metrics):** it **is** the `awarenessMode` dimension. Here
  the mode is "who you keep": it filters the population to the name-aware or face-aware
  subgroup, so the row's base shrinks to that subgroup, and that base equals the
  matching column from the awareness row (`awareName` / `awareFace`).

So the same recognition cut is columns on the gate (a measured facet of the sample) and
a filtering dimension on the gated metrics (a smaller population). That difference is
why it is not one shared `awarenessMode` field across both tables.

## Slices are stored rollups (not computed on the fly)

The point of storing a slice is that a filtered view is a single read. Filtering the
page by `female` means every card and chart reads its `gender = female` row directly:
no summing of genders, no deriving female from total. The same holds for any dimension
combination (e.g. `gender = female, awarenessMode = face`).

So the "all" sentinels (`gender = total`, `ageBand = total`) are **stored precomputed
rollups**, read directly, never aggregated at query time. The obligation is at write
time: a stored `total` must equal what its slices roll up to.

### Rollup identities (gender, age)

Because gender partitions the people, aware counts must add up exactly:

```
awareAny_total  = awareAny_male  + awareAny_female
awareName_total = awareName_male + awareName_female
awareFace_total = awareFace_male + awareFace_female
```

(and likewise over age bands). The overall awareness % is therefore pinned by the
parts: you cannot independently choose total, male, and female awareness, the total is
determined. `awarenessMode = any` is the one non-additive axis: it is the OR-union of
name and face (they overlap), not a sum.

## Categories are rating-pool aggregates of their member actors

A category (e.g. "Film Personality - Actor") is not a standalone subject. It is the
aggregate of the member actors in it. This has two consequences.

### The unit is a rating, not a person

For a category, the unit is a **rating**: one respondent evaluating one actor. A
respondent aware of three actors in the category contributes three ratings. We use
ratings (not distinct people) deliberately: collapsing a multi-actor respondent to one
vote would require arbitrarily picking which actor they rate, which makes the metric
meaningless. Pooling ratings keeps every real evaluation, nothing invented or dropped.

### Category base and distribution

For member actors `i` with aware count `aware_i` and metric percentage `pct_i`:

```
category base          = sum of aware_i                      (the rating pool)
category pct(option)   = sum(pct_i x aware_i) / sum(aware_i)  (rating-weighted pool)
```

Per awareness mode, the pool is taken over that mode's member counts (category
`awareFace` ratings = sum of members' face-aware counts, pooled face distribution
weighted by those).

### What this gives

- **Strictly larger than any member.** The category rating pool includes every
  member's ratings, so it is `>=` any single member (strictly `>` once any other member
  has one aware person). A category benchmark can never be below a member it contains.
- **Can exceed the sample size.** Ratings are not people. Summing member aware counts
  can be larger than `sampleBase`; that is correct for a rating count, and it is why the
  category base is labelled "ratings", not "aware" (people).
- **Comparable across categories.** "31% of ratings of actors in this segment were
  Confident" is a rate over the same kind of unit in every category, so one segment can
  be compared to another, and to a celebrity's own aware-based rate.

### Reading a category figure

"Film Personality - Actor: 31% Confident" means: of all the ratings given to actors in
that segment, 31% rated the actor Confident. Not 31% of people (a respondent can appear
multiple times), and not any one actor.

## Display modes (% and #)

- **% mode:** rates. The denominator (base) is normalised out, so rates are the honest
  unit for comparing anything, slices of a subject, two celebrities, a celebrity vs a
  category. This is always a valid comparison.
- **# mode:** literal counts on a series' own base: `count = round(pct x base / 100)`.
  No indexing (rescaling to a common base). A count answers "how many of the people
  asked about this subject said X."

### Counts are only meaningful within a single subject

A count is a rate times an exposure base. In a real panel, respondents are shown a
random subset of subjects, so each subject (and each slice) has its own exposure/aware
base, drawn from a different sub-sample. Consequences:

- **Across subjects, counts do not compare, and can invert the truth.** If Pitt (asked
  of 1,200, 80% confident) shows 960 and Clooney (asked of 1,371, 70% confident) shows
  ~960, the counts look equal while the rates clearly favour Pitt. The larger exposure
  base inflated the weaker rate back to the same count. So counts are not a valid
  cross-subject comparison; rates are.
- **Within one subject, slices (genders, recognition modes) also sit on different
  bases**, but those bases partition the same subject's exposure, so they are of
  commensurate magnitude. Counts there are "roughly" readable as magnitudes, and % is
  still the comparison unit.
- **Celebrity (people) vs category (ratings) is also a unit mismatch**, not just a base
  mismatch, so their counts are doubly incomparable.

### The rule

The page has a subject (the celebrity). # is a within-subject magnitude view, so it is
offered only on charts whose series are all that subject, measured in its unit (people
aware of the celebrity):

- **# available:** Total Appeal (the celebrity's any/name/face recognition slices) and
  Attributes (the celebrity's gender slices). The %/# toggle drives these.
- **% only (ignore the toggle):** any chart with a category/benchmark series, because a
  category is a different population and unit (ratings), and a count of category ratings
  is meaningless on the celebrity's page. This covers the Appeal pie, the Power Factors
  celebrity-vs-category chart, and the awareness card's category list.

Earlier designs re-indexed every series to one common reference base in # mode. That
was dropped: indexing just rescales percentages by a constant, so it conveys nothing %
mode doesn't already show, while hiding real counts. For the charts that do keep #, each
series uses its own base and the y-axis is scaled to the largest series base so all
series fit.

### Base label

- Celebrity series (bar charts in # mode): `Base: N (aware)`, people aware of the
  celebrity.

## E-Score

E-Score is a gated metric, not a header fact. It is measured among awares (non-awares
cannot rate the subject), so it lives in `question_result` as `question = e_score`, with
`base` = the aware count and `data` = the score (a single number). It is celebrity-level
and sliceable by gender; categories have no E-Score.

## Summary of invariants

1. Exactly one of `celebrityId` / `categoryId` is set on every subject row.
2. A gated row's `base` equals the matching awareness count
   (`any -> awareAny`, `name -> awareName`, `face -> awareFace`).
3. Stored `total` (gender, age) equals the sum of its slices; `awarenessMode = any` is
   the OR-union of name/face, not a sum.
4. A category's base and distribution are the rating-weighted pool of its member actors,
   so a category base is `>=` any member and may exceed `sampleBase` (ratings, not
   people).
5. Awareness % is derived from counts (`awareAny / sampleBase`), never stored
   independently.
6. Counts (# mode) are only shown within a single subject in that subject's unit;
   comparisons (cross-subject, or any chart with a category series) are shown as rates
   (%), because counts on different exposure bases are not comparable.

## Out of scope / not yet implemented

- **Category derivation from members.** The methodology above defines a category as a
  rating pool over its member actors, but the member roster beyond the primary celebrity
  is not in the data, so category figures are currently synthetic placeholders, not
  derived. The chart labels already reflect the rating unit.
- **Reconciling synthetic totals.** The current synthetic awareness figures carry the
  source's independent per-gender percentages, which do not perfectly satisfy the gender
  rollup identity. That is a data-write reconciliation task, not a model gap.
