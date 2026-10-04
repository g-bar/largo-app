import { error, json } from '@sveltejs/kit'
import { getCelebrity } from '#lib/server/db/accessors.ts'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params }) => {
	const celeb = await getCelebrity(params.id)
	if (!celeb) error(404, 'No such celebrity')
	return json(celeb)
}
