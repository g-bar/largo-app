import { error, json } from '@sveltejs/kit'
import * as v from 'valibot'
import { getQuestion } from '#lib/server/db/accessors.ts'
import { questionQuerySchema } from '#lib/server/types.ts'
import type { RequestHandler } from './$types'

// Generic validated endpoint for runtime, user-added charts. Validates params with
// valibot (400 on bad input, 404 on a missing cell), then calls the same accessor
// the load uses.
export const GET: RequestHandler = async ({ url }) => {
	const parsed = v.safeParse(questionQuerySchema, Object.fromEntries(url.searchParams))
	if (!parsed.success) error(400, v.summarize(parsed.issues))

	const { celebrityId, categoryId, ...rest } = parsed.output
	const result = await getQuestion({ subjectId: (celebrityId ?? categoryId)!, ...rest })
	if (!result) error(404, 'No data for that cell')

	return json(result)
}
