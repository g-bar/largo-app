import { listCelebrities } from '#lib/server/db/accessors.ts'
import type { PageServerLoad } from './$types'

// The list view: all celebrities, linking to each scorecard with no filter (the
// scorecard applies its own defaults: all genders, all ages, latest fielding date).
export const load: PageServerLoad = async () => {
	const celebrities = await listCelebrities()
	return { celebrities }
}
