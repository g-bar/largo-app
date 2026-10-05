import { error } from '@sveltejs/kit'
import * as v from 'valibot'
import {
	getAwareness,
	getCelebrity,
	getFieldingDates,
	getQuestion,
	listCategories,
	listCelebrities,
} from '#lib/server/db/accessors.ts'
import { compareParamsSchema } from '#lib/server/types.ts'
import type { CompareMetric, QuestionData } from '#lib/server/types.ts'
import type { PageServerLoad } from './$types'

// Metrics shown as comparison charts: every question except E-Score (E-Score is a
// scalar shown per subject in the badges, not a comparison chart), plus awareness.
const CHART_METRICS = ['awareness', 'appeal', 'attributes', 'power_factors'] as const

type ChartSubject = { id: string; name: string; kind: 'celebrity' | 'category'; data: QuestionData }

// Celebrity comparison: the selected subjects (celebrities + categories) are compared
// across all chart metrics at one slice (fielding date / gender / age), always as
// rates. Awareness is read from the awareness table as a derived % (awareAny /
// sampleBase); the questions read awarenessMode = any.
export const load: PageServerLoad = async ({ url }) => {
	const parsed = v.safeParse(compareParamsSchema, Object.fromEntries(url.searchParams))
	if (!parsed.success) error(404, 'Invalid comparison parameters')
	const { fieldingDate, gender, ageBand, subjects } = parsed.output

	const [celebrities, categories, fieldingDates] = await Promise.all([
		listCelebrities(),
		listCategories(),
		getFieldingDates(),
	])

	// id -> { name, kind } across celebrities and categories.
	const kindOf = new Map<string, { name: string; kind: 'celebrity' | 'category' }>()
	for (const c of celebrities) kindOf.set(c.id, { name: c.name, kind: 'celebrity' })
	for (const c of categories) kindOf.set(c.id, { name: c.name, kind: 'category' })

	// Keep only known ids, in the order given.
	const selectedIds = subjects.filter(id => kindOf.has(id))

	// Read one metric's value for one subject. Awareness is a derived %; the questions
	// return the stored payload (number / distribution / ordered map).
	async function readMetric(id: string, metric: CompareMetric): Promise<QuestionData | null> {
		if (metric === 'awareness') {
			const a = await getAwareness({ subjectId: id, fieldingDate, gender, ageBand })
			return a ? Math.round((a.awareAny / a.sampleBase) * 100) : null
		}
		const r = await getQuestion({ subjectId: id, fieldingDate, gender, ageBand, awarenessMode: 'any', question: metric })
		return r ? (r.data as QuestionData) : null
	}

	// Per-metric subject arrays for the chart grid.
	const charts: Record<CompareMetric, ChartSubject[]> = {
		awareness: [],
		appeal: [],
		attributes: [],
		power_factors: [],
		e_score: [],
	}
	await Promise.all(
		CHART_METRICS.map(async metric => {
			const rows = await Promise.all(
				selectedIds.map(async id => {
					const meta = kindOf.get(id)!
					const data = await readMetric(id, metric)
					return data === null ? null : { id, name: meta.name, kind: meta.kind, data }
				}),
			)
			charts[metric] = rows.filter(r => r !== null)
		}),
	)

	// One badge per selected subject, in selection order. Celebrities carry photo / IMDb /
	// E-Score; categories are name-only (no E-Score, no photo).
	const badges = await Promise.all(
		selectedIds.map(async id => {
			const meta = kindOf.get(id)!
			if (meta.kind === 'category') {
				return { id, name: meta.name, kind: 'category' as const, photoUrl: null, imdbUrl: null, eScore: null }
			}
			const [celeb, eScore] = await Promise.all([
				getCelebrity(id),
				getQuestion({ subjectId: id, fieldingDate, gender, ageBand, awarenessMode: 'any', question: 'e_score' }),
			])
			return celeb
				? {
						id,
						name: celeb.name,
						kind: 'celebrity' as const,
						photoUrl: celeb.photoUrl,
						imdbUrl: celeb.imdbUrl,
						eScore: (eScore?.data as number) ?? null,
					}
				: null
		}),
	)

	return {
		filter: { fieldingDate, gender, ageBand },
		selectedIds,
		fieldingDates,
		badges: badges.filter(b => b !== null),
		charts,
	}
}
