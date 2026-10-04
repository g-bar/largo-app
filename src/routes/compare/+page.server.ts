import { error } from '@sveltejs/kit'
import * as v from 'valibot'
import {
	getAwareness,
	getFieldingDates,
	getQuestion,
	listCategories,
	listCelebrities,
} from '#lib/server/db/accessors.ts'
import { compareParamsSchema } from '#lib/server/types.ts'
import type { QuestionData } from '#lib/server/types.ts'
import type { PageServerLoad } from './$types'

// Celebrity comparison: compare the selected subjects on one metric at one slice
// (fielding date / gender / age), always as rates. Subjects are celebrities and (for
// non-E-Score metrics) categories. E-Score has no category figure, so category ids are
// dropped when metric = e_score. Awareness is read from the awareness table as a
// derived % (awareAny / sampleBase); the gated metrics read awarenessMode = any.
export const load: PageServerLoad = async ({ url }) => {
	const parsed = v.safeParse(compareParamsSchema, Object.fromEntries(url.searchParams))
	if (!parsed.success) error(404, 'Invalid comparison parameters')
	const { fieldingDate, gender, ageBand, metric, subjects } = parsed.output

	const [celebrities, categories, fieldingDates] = await Promise.all([
		listCelebrities(),
		listCategories(),
		getFieldingDates(),
	])

	// id -> { name, kind }. Categories are only valid subjects for non-E-Score metrics.
	const kindOf = new Map<string, { name: string; kind: 'celebrity' | 'category' }>()
	for (const c of celebrities) kindOf.set(c.id, { name: c.name, kind: 'celebrity' })
	for (const c of categories) kindOf.set(c.id, { name: c.name, kind: 'category' })

	// Keep only known ids; drop categories entirely when the metric is E-Score.
	const selectedIds = subjects.filter(id => {
		const k = kindOf.get(id)
		return k && !(metric === 'e_score' && k.kind === 'category')
	})

	// Awareness is a scalar % per subject (awareAny / sampleBase); the gated metrics
	// return the question payload (number / distribution / ordered map).
	const results = await Promise.all(
		selectedIds.map(async id => {
			const meta = kindOf.get(id)!
			if (metric === 'awareness') {
				const a = await getAwareness({ subjectId: id, fieldingDate, gender, ageBand })
				const data = a ? Math.round((a.awareAny / a.sampleBase) * 100) : null
				return data === null ? null : { id, name: meta.name, kind: meta.kind, data: data as QuestionData }
			}
			const r = await getQuestion({
				subjectId: id,
				fieldingDate,
				gender,
				ageBand,
				awarenessMode: 'any',
				question: metric,
			})
			return r ? { id, name: meta.name, kind: meta.kind, data: r.data as QuestionData } : null
		}),
	)

	return {
		filter: { fieldingDate, gender, ageBand },
		metric,
		selectedIds,
		subjects: results.filter(r => r !== null),
		pickers: { celebrities, categories },
		fieldingDates,
	}
}
