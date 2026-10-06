# Largo E-Score

Example dashboard for Largo E-Score. This version builds on the pure-HTML version and
turns it into a web application, with working filters and controls and a new compare feature.

Available live at <https://largo.delightfulocean-699c94af.northeurope.azurecontainerapps.io/>

## Under the hood

The dashboard is a SvelteKit web app backed by a Postgres database, with charts rendered
in the browser and PDF/CSV export generated on the fly. It runs on Azure Container Apps.
For the architecture, data model, and deployment, see [`TECHNICAL_OVERVIEW.md`](TECHNICAL_OVERVIEW.md).

## The metrics

The data model was inferred from the original mock-up and some research about E-Poll and
similar methodologies; real methods might differ, and the data model would be adjusted
accordingly.

A survey works in two stages, and the metrics follow that split. First everyone is asked
whether they recognise the subject at all. Only the people who do recognise them go on to
rate them. So awareness is measured over everyone surveyed, while every other metric
is measured only among the people who know the subject.

- **Awareness**: of everyone surveyed, how many recognise the subject (by name, by face,
  or either).
- **E-Score**: a single 0-100 appeal index among the people who know the subject.
- **Appeal**: the full like/dislike breakdown, from "like a lot" down to "dislike a
  lot," so you see the shape of sentiment, not just the average.
- **Attributes**: the traits people associate with the subject (for example confident,
  attractive, trustworthy).
- **Power factors**: the deeper drivers of influence and endorsement potential.

Every metric (including the E-Score) can be read for the audience as a whole or sliced
down to a specific group (a gender, an age band, a fielding date).

## Features

### Celebrity list

"List view" lists every subject with a photo. Pick anyone to open their full
scorecard.

### Scorecard

The single-celebrity view brings every metric together on one page: the E-Score and
awareness up top, then charts for appeal, attributes, and power factors, each shown
against the relevant category benchmark so you can see where the person sits relative to
their peers.

The whole page is filterable. Narrow it to a fielding date, a gender, or an age band,
and every number and chart re-reads for exactly that audience. The filters live in the
URL, so a particular filtered scorecard is shareable with a link. Charts can switch
between a percentage view and a count view (how many
people). Counts are only offered where they're a fair comparison, within a single
subject; different actors or category benchmarks sit on a different base than the
celebrity. The two are counted over different populations (people surveyed about Brad
Pitt vs all surveys about any actor in a given category), so their raw counts are not
comparable.

Each chart has two controls in its top-right corner. There was no spec for these, so
their functionality was inferred. The expand icon opens the chart full-size in a
dialog for a closer look. The options menu (the three dots) lets users switch to a
table view or download the chart as a PNG or CSV.

### Compare

The comparison view puts several subjects side by side on a single audience slice and
fielding date, and shows every metric at once (awareness, appeal, attributes, and power
factors), each as its own bar chart. You can mix individual celebrities with category
benchmarks. The whole comparison lives in the URL, so any given side-by-side is shareable
with a link. For example <https://largo.delightfulocean-699c94af.northeurope.azurecontainerapps.io/compare?subjects=brad-pitt%2Cchristian-bale%2Cfilm-actor>.

Each subject appears as an E-Score badge above the chart. The badges are draggable, and
reordering them reorders the bars in the chart to match.

### Export

Any scorecard can be downloaded as a CSV for further analysis, or as a one-page
PDF summary suitable for sharing or dropping into a deck. The PDF is a dummy built
from the data already on the page; a real implementation would replace it with the
properly formatted report.

### Not yet wired up

A few pieces of the interface are present but inert, to match the look of the source
dashboard:

- The top-nav Dashboard and Smart search links, and the user badge, are
  placeholders. There is no authentication; a real dashboard would sit behind a
  login and tie the badge to the signed-in user.
- On the scorecard toolbar, the Subscription details button and the table-view
  toggle are decorative. Only the percentage/count toggle is active.

## Sample data

All data is synthetic. The seed generates two fielding dates for 20 celebrities
across every gender, age band, and recognition slice. The numbers are made up, but they
are built so the slices always reconcile: for a given celebrity and fielding date the
total equals male plus female, and the total equals the sum across the age bands.

The celebrity names, IMDb links, and photos are real (the photo is just the main
IMDb profile image and the link points at the real IMDb profile).
