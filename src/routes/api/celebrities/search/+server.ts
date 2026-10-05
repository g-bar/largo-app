import { json } from '@sveltejs/kit'
import { ilike } from 'drizzle-orm'
import { db } from '#lib/server/db/index.ts'
import { category, celebrity } from '#lib/server/db/schema.ts'
import type { RequestHandler } from './$types'

// Search subjects by name prefix: celebrities always, categories when
// includeCategories is set. Used by the compare page subject picker.
export const GET: RequestHandler = async ({ url }) => {
	const q = (url.searchParams.get('q') || '').trim()
	const includeCategories = url.searchParams.get('includeCategories') === '1'

	if (!q) return json([])

	const celebrities = await db
		.select({ id: celebrity.id, name: celebrity.name })
		.from(celebrity)
		.where(ilike(celebrity.name, `${q}%`))
		.orderBy(celebrity.name)
		.limit(20)

	const results: { id: string; name: string; kind: 'celebrity' | 'category' }[] = celebrities.map(
		r => ({ ...r, kind: 'celebrity' }),
	)

	if (includeCategories) {
		const categories = await db
			.select({ id: category.id, name: category.name })
			.from(category)
			.where(ilike(category.name, `${q}%`))
			.orderBy(category.name)
			.limit(20)
		for (const r of categories) results.push({ ...r, kind: 'category' })
	}

	return json(results)
}
