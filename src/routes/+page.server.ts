import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

const DEFAULT_CELEBRITY_ID = 'brad-pitt'

// The app opens on a default celebrity's scorecard.
export const load: PageServerLoad = () => {
	redirect(307, `/celebrity/${DEFAULT_CELEBRITY_ID}`)
}
