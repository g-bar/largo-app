import { json } from '@sveltejs/kit'
import { ilike, and, eq } from 'drizzle-orm'
import { db } from '#lib/server/db/index.ts'
import { celebrity, celebrityCategory } from '#lib/server/db/schema.ts'
import type { RequestHandler } from './$types'

// Search celebrities by name prefix, optionally filtered by category.
// Used by the compare page subject picker.
export const GET: RequestHandler = async ({ url }) => {
	const q = (url.searchParams.get('q') || '').trim()
	const categoryId = url.searchParams.get('category')

	if (!q) return json([])

	if (categoryId) {
		// Search within a category: join through celebrity_category.
		const rows = await db
			.select({ id: celebrity.id, name: celebrity.name })
			.from(celebrity)
			.innerJoin(celebrityCategory, eq(celebrityCategory.celebrityId, celebrity.id))
			.where(
				and(
					ilike(celebrity.name, `${q}%`),
					eq(celebrityCategory.categoryId, categoryId),
				),
			)
			.orderBy(celebrity.name)
			.limit(20)
		return json(rows)
	}

	// No category filter: search all celebrities.
	const rows = await db
		.select({ id: celebrity.id, name: celebrity.name })
		.from(celebrity)
		.where(ilike(celebrity.name, `${q}%`))
		.orderBy(celebrity.name)
		.limit(20)
	return json(rows)
}
