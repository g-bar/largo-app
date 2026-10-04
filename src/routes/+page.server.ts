import { error } from '@sveltejs/kit'
import { getAwareness, getCelebrity, getQuestion } from '#lib/server/db/accessors.ts'
import type { AppealData, Gender, OrderedMap } from '#lib/server/types.ts'
import type { PageServerLoad } from './$types'

const CELEBRITY_ID = 'brad-pitt'
const FIELDING_DATE = '2025-07-25'

// Awareness % shown on the card is derived from the aware counts: awareAny / sampleBase.
const awarenessPct = (a: { awareAny: number; sampleBase: number }) =>
	Math.round((a.awareAny / a.sampleBase) * 100)

// The fixed page: fetch everything the known cards + charts need, server-side, so
// first paint has data and needs no spinner. Each chart receives only its slice.
export const load: PageServerLoad = async () => {
	const celebrity = await getCelebrity(CELEBRITY_ID)
	if (!celebrity) error(404, 'Celebrity not found')

	const awareness = await getAwareness({
		subjectId: CELEBRITY_ID,
		fieldingDate: FIELDING_DATE,
		gender: 'total',
	})
	if (!awareness) error(404, 'Awareness row not found')

	const primaryCategory = celebrity.categories[0]

	const appeal = (subjectId: string, gender: Gender, awarenessMode: 'any' | 'name' | 'face') =>
		getQuestion({ subjectId, fieldingDate: FIELDING_DATE, gender, ageBand: 'total', awarenessMode, question: 'appeal' })

	const attributes = (gender: Gender) =>
		getQuestion({
			subjectId: CELEBRITY_ID,
			fieldingDate: FIELDING_DATE,
			gender,
			ageBand: 'total',
			awarenessMode: 'any',
			question: 'attributes',
		})

	const powerFactors = (subjectId: string) =>
		getQuestion({
			subjectId,
			fieldingDate: FIELDING_DATE,
			gender: 'total',
			ageBand: 'total',
			awarenessMode: 'any',
			question: 'power_factors',
		})

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
		getQuestion({
			subjectId: CELEBRITY_ID,
			fieldingDate: FIELDING_DATE,
			gender: 'total',
			ageBand: 'total',
			awarenessMode: 'any',
			question: 'e_score',
		}),
		appeal(CELEBRITY_ID, 'total', 'any'),
		appeal(CELEBRITY_ID, 'total', 'name'),
		appeal(CELEBRITY_ID, 'total', 'face'),
		attributes('total'),
		attributes('male'),
		attributes('female'),
		appeal(primaryCategory.id, 'total', 'any'),
		powerFactors(CELEBRITY_ID),
		powerFactors(primaryCategory.id),
		...celebrity.categories.map(c =>
			getAwareness({ subjectId: c.id, fieldingDate: FIELDING_DATE, gender: 'total' }),
		),
	])

	// These cells are expected to exist for the fixed page; a miss is a data error.
	// (Name/Face appeal are optional additive slices.)
	if (
		!appealAny ||
		!attrTotal ||
		!attrMale ||
		!attrFemale ||
		!categoryAppeal ||
		!celebPower ||
		!categoryPower
	) {
		error(500, 'Missing expected scorecard data')
	}

	const slice = <T>(r: { data: unknown; base: number }) => ({ data: r.data as T, base: r.base })

	return {
		celebrity,
		// Awareness card indexes to the whole sample (awareness is a sample-level fact).
		// The gated charts each use their own slice's aware base for # counts (passed
		// per slice below), so there is no single page-level chart base.
		sampleBase: awareness.sampleBase,
		eScore: (eScore?.data as number) ?? null,
		awareness: awarenessPct(awareness),
		awarenessCategories: celebrity.categories.map((c, i) => {
			const a = categoryAwareness[i]
			return { id: c.id, label: c.name, awareness: a ? awarenessPct(a) : 0 }
		}),
		totalAppeal: {
			any: slice<AppealData>(appealAny),
			name: appealName ? slice<AppealData>(appealName) : undefined,
			face: appealFace ? slice<AppealData>(appealFace) : undefined,
		},
		attributes: {
			total: slice<OrderedMap>(attrTotal),
			male: slice<OrderedMap>(attrMale),
			female: slice<OrderedMap>(attrFemale),
		},
		appeal: {
			categoryName: primaryCategory.name,
			data: categoryAppeal.data as AppealData,
			base: categoryAppeal.base,
		},
		powerFactors: {
			categoryName: primaryCategory.name,
			celeb: slice<OrderedMap>(celebPower),
			category: slice<OrderedMap>(categoryPower),
		},
	}
}
