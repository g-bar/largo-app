# Feature draft: Celebrity comparison

Status: draft for review. No implementation yet.

Compare multiple subjects (celebrities, and categories where allowed) on one metric,
at one slice (fielding date / gender / age), rendered as a bar chart.

## User flow

1. Pick a **slice**: fielding date, gender, age. Same three controls as the celebrity
   page / top filter, read from and written to the query params.
2. Pick a **metric**: E-Score, Appeal, Attributes, or Power Factors.
3. Pick the **subjects**: a multi-select of celebrities (and categories, except when
   the metric is E-Score, which categories do not have).
4. See a **bar chart** comparing the chosen subjects on the chosen metric.

Everything lives on a new route, e.g. `/compare`, driven entirely by query params so a
comparison is shareable by URL.

## The chart shape depends on the metric's data shape

The four metrics have three underlying data shapes (see DATA_METHODOLOGY / types.ts),
and the comparison chart adapts to them:

- **E-Score (scalar `number`).** One bar per subject. x-axis = subjects, y = score.
  This is the simple case: each subject contributes exactly one bar.

  ```
  score
   90 |  █         █
   80 |  █    █    █    █
      |  Pitt  Robbie  Denzel  Zendaya
  ```

- **Appeal (6-point distribution) / Attributes / Power Factors (ordered maps).** Each
  subject has *many* values (6 appeal buckets, 12 attributes, 9 power factors). So this
  is a **grouped bar chart**: x-axis = the metric's keys (the attributes / buckets),
  and within each key group, one bar per subject.

  ```
  %
     |  Attractive      Confident      Cool/Hip
     | ██ ██ ██        ██ ██ ██       ██ ██ ██
     | P  R  D         P  R  D        P  R  D      ...one group per attribute
  ```

  Legend identifies subjects by color. This is the same grouped-bar structure the
  existing AttributesChart uses for total/male/female, generalised to N subjects.

Appeal note: Appeal is a 6-bucket distribution. For comparison we have two options
(open question below): show the 6 raw buckets, or show the derived box scores
(Top Two / Top Three / Bottom Two / Bottom Three, as TotalAppealChart already does).
Box scores are the more legible comparison. Leaning box scores.

## % vs # (display mode)

Per the methodology's display rules:

- **Comparing celebrities to each other is a cross-subject comparison, so it must be
  shown as rates (%).** Counts sit on each subject's own aware base (different
  exposure), so a raw count comparison across subjects can invert the truth. The
  comparison chart is therefore **% only**; no %/# toggle. (Same reasoning the
  category-benchmark charts already use to force % mode.)
- **Categories are a different unit again (ratings, not people)**, so mixing a category
  series with celebrity series is doubly a unit mismatch, and is still fine *as a rate*
  (a rate normalises the base out). So categories can appear alongside celebrities in
  the comparison, as long as it stays %.
- E-Score is already a 0-100 index (a rate-like figure), so it is directly comparable
  across subjects.

Conclusion: the comparison chart renders percentages only. We reuse `makeView('pct',
...)` from chart.ts, which already ignores bases in % mode.

## Metric -> allowed subjects

| Metric        | Data shape        | Celebrities | Categories |
| ------------- | ----------------- | ----------- | ---------- |
| E-Score       | number            | yes         | NO         |
| Appeal        | 6-point dist      | yes         | yes        |
| Attributes    | ordered map (12)  | yes         | yes        |
| Power Factors | ordered map (9)   | yes         | yes        |

When the metric is E-Score, the subject multi-select hides / disables categories, and
any already-selected categories are dropped from the query.

## Slice handling

- E-Score, Attributes, Power Factors are stored on `awarenessMode = any` only, so the
  comparison reads the `any` row at the chosen gender/age/fielding. No awareness-mode
  control needed for those.
- Appeal exists for any/name/face. For v1 we read `any` for appeal too, to keep the
  control set to just date/gender/age. (A later version could add an awareness-mode
  control, appeal-only.)
- All subjects are read at the *same* slice. A subject missing that cell (shouldn't
  happen with current full-coverage seed, but categories/edge cases) is dropped from
  the chart with a note, rather than failing the page.

## Data / read path

Reuse the existing `getQuestion` accessor, once per selected subject:

```ts
getQuestion({ subjectId, fieldingDate, gender, ageBand, awarenessMode: 'any', question })
```

- subjectId is a celebrity id or a category id (getQuestion already matches either).
- Fan out over the selected subjects with Promise.all in the compare route's load.
- Each returns `{ base, data }`. For E-Score, data is the number; for the others, the
  ordered map / distribution. We only use the rates (%), base is not surfaced.

No new accessor strictly required, though a small `listCategories()` (mirror of
`listCelebrities()`) is needed to populate the category side of the subject picker.

## Route / params

New route `/compare`, params:

- `fieldingDate`, `gender`, `ageBand`  (same `pageParamsSchema` shape, shared)
- `metric` = `appeal | attributes | power_factors | e_score`
- `subjects` = comma-separated ids, e.g. `brad-pitt,margot-robbie,film-actor`

Load:
1. Parse params (valibot). Default metric = e_score (or appeal), default subjects = a
   couple of celebrities so the page isn't empty.
2. If metric is e_score, filter out any category ids from `subjects`.
3. Fetch each subject's `{ base, data }` for the cell; also fetch the celebrity list
   (+ category list) for the pickers, and the fielding dates for the date control.
4. Return `{ filter, metric, subjects: [{ id, name, kind, data }], pickers, dates }`.

The chart component picks its layout from `metric` (scalar -> single bars; map/dist ->
grouped bars), reusing `barBase` + `makeView('pct', ...)` and the color-per-subject
legend pattern from AttributesChart.

## Reused building blocks

- `chart.ts`: `barBase`, `makeView`, `boxScores` (if appeal uses box scores), tokens.
- Grouped-bar structure: generalise AttributesChart (total/male/female -> N subjects).
- Filter controls: the date/gender/age selects already built for the list view and
  CelebHeader, factored or copied.
- Subject multi-select: new small component (checkbox list or multi-select), writes the
  `subjects` param.

## Open questions (need your call)

1. **Appeal representation**: box scores (Top/Bottom Two/Three, 4 groups) or the raw
   6-bucket distribution? Leaning box scores for legibility.
2. **Subject cap**: a grouped bar with 12 attributes x N subjects gets unreadable past
   ~4-5 subjects. Cap the selection (e.g. max 5)? Leaning yes, max ~5.
3. **Default metric and default subjects** on first load (empty params).
4. **Colors**: a fixed palette cycled per subject (need N distinct colors; current
   charts only use 2-3). Define a palette in chart.ts.
5. **E-Score + category**: confirmed categories are simply excluded when metric =
   e_score (not shown greyed, just absent).
6. **Route name**: `/compare` ok? And should it get a nav tab like LIST VIEW?
