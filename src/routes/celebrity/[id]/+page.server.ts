import { error } from '@sveltejs/kit'
import * as v from 'valibot'
import { getAwareness, getCelebrity, getFieldingDates, getQuestion } from '#lib/server/db/accessors.ts'
import { type AppealData, type Gender, type OrderedMap, pageParamsSchema } from '#lib/server/types.ts'
import type { PageServerLoad } from './$types'

// awareness % shown on the card is derived from the aware counts: awareAny / sampleBase.
const awarenessPct = (a: { awareAny: number; sampleBase: number }) =>
	Math.round((a.awareAny / a.sampleBase) * 100)

const slice = <T>(r: { data: unknown; base: number } | null) =>
	r ? { data: r.data as T, base: r.base } : null

// The scorecard page for one celebrity. The celebrity is the route param; the
// fielding date / gender / age band come from the query string and filter the whole
// page. Each chart inherits the page filter on every dimension except its own
// comparison axis: Total Appeal compares awarenessMode (inherits gender/age/fielding);
// Attributes compares gender (inherits age/fielding); the rest inherit gender too.
//
// The page 404s only when the celebrity is unknown or the selected awareness cell is
// missing. Individual chart slices degrade on their own: a missing slice is returned
// as null and the chart shows an empty state, rather than failing the page.
export const load: PageServerLoad = async ({ params, url }) => {
	const parsed = v.safeParse(pageParamsSchema, Object.fromEntries(url.searchParams))
	if (!parsed.success) error(404, 'Invalid page parameters')
	const { fieldingDate, gender, ageBand } = parsed.output

	const celebrity = await getCelebrity(params.id)
	if (!celebrity) error(404, 'Celebrity not found')

	// The page exists only if the selected awareness cell exists for this celebrity.
	const awareness = await getAwareness({ subjectId: params.id, fieldingDate, gender, ageBand })
	if (!awareness) error(404, 'No scorecard for this filter')

	const primaryCategory = celebrity.categories[0]

	const appeal = (subjectId: string, g: Gender, awarenessMode: 'any' | 'name' | 'face') =>
		getQuestion({ subjectId, fieldingDate, gender: g, ageBand, awarenessMode, question: 'appeal' })

	// Attributes compares gender, so it always fans over total/male/female and ignores
	// the page gender (it inherits age/fielding).
	const attributes = (g: Gender) =>
		getQuestion({ subjectId: params.id, fieldingDate, gender: g, ageBand, awarenessMode: 'any', question: 'attributes' })

	const powerFactors = (subjectId: string) =>
		getQuestion({ subjectId, fieldingDate, gender, ageBand, awarenessMode: 'any', question: 'power_factors' })

	const fieldingDates = await getFieldingDates()

	const [
		eScore,
		appealAny,
		appealName,
		appealFace,
		attrTotal,
		attrMale,
		attrFemale,
		categoryAppeal,
		celebPower,
		categoryPower,
		...categoryAwareness
	] = await Promise.all([
		getQuestion({ subjectId: params.id, fieldingDate, gender, ageBand, awarenessMode: 'any', question: 'e_score' }),
		// Total Appeal fans over awarenessMode, inheriting the page gender/age/fielding.
		appeal(params.id, gender, 'any'),
		appeal(params.id, gender, 'name'),
		appeal(params.id, gender, 'face'),
		attributes('total'),
		attributes('male'),
		attributes('female'),
		appeal(primaryCategory.id, 'total', 'any'),
		powerFactors(params.id),
		powerFactors(primaryCategory.id),
		...celebrity.categories.map(c => getAwareness({ subjectId: c.id, fieldingDate, gender, ageBand })),
	])

	return {
		celebrity,
		filter: { fieldingDate, gender, ageBand },
		fieldingDates,
		eScore: (eScore?.data as number) ?? null,
		awareness: awarenessPct(awareness),
		// Category averages are always shown as rates (the awareness card is percent-only:
		// a cross-category comparison is only meaningful as a rate, not raw counts on
		// different bases).
		awarenessCategories: celebrity.categories.map((c, i) => {
			const a = categoryAwareness[i]
			return { id: c.id, label: c.name, pct: a ? awarenessPct(a) : null }
		}),
		totalAppeal: {
			any: slice<AppealData>(appealAny),
			name: slice<AppealData>(appealName),
			face: slice<AppealData>(appealFace),
		},
		attributes: {
			total: slice<OrderedMap>(attrTotal),
			male: slice<OrderedMap>(attrMale),
			female: slice<OrderedMap>(attrFemale),
		},
		appeal: {
			categoryName: primaryCategory?.name ?? null,
			slice: slice<AppealData>(categoryAppeal),
		},
		powerFactors: {
			categoryName: primaryCategory?.name ?? null,
			celeb: slice<OrderedMap>(celebPower),
			category: slice<OrderedMap>(categoryPower),
		},
	}
}
