// Pure data accessors: plain args in, plain data out, no SvelteKit coupling. Called
// directly by the +page.server.ts load, by the JSON endpoints (after validation),
// and by any future remote function alike.
import { and, desc, eq, or } from 'drizzle-orm'
import { db } from './index'
import { awareness, category, celebrity, celebrityCategory, questionResult } from './schema'
import type {
	AgeBand,
	Awareness,
	AwarenessMode,
	CelebrityResult,
	Gender,
	Question,
	QuestionResult,
} from '../types'

// A subject is a celebrity or a category; the id is unique across both, so a row
// matches when either column equals it.

export async function getCelebrity(id: string): Promise<CelebrityResult | null> {
	const [celeb] = await db.select().from(celebrity).where(eq(celebrity.id, id))
	if (!celeb) return null
	const cats = await db
		.select({
			id: celebrityCategory.categoryId,
			name: category.name,
			position: celebrityCategory.position,
		})
		.from(celebrityCategory)
		.innerJoin(category, eq(category.id, celebrityCategory.categoryId))
		.where(eq(celebrityCategory.celebrityId, id))
		.orderBy(celebrityCategory.position)
	return { ...celeb, categories: cats }
}

export async function getAwareness(args: {
	subjectId: string
	fieldingDate: string
	gender: Gender
	ageBand: AgeBand
}): Promise<Awareness | null> {
	const [row] = await db
		.select({
			sampleBase: awareness.sampleBase,
			awareAny: awareness.awareAny,
			awareName: awareness.awareName,
			awareFace: awareness.awareFace,
		})
		.from(awareness)
		.where(
			and(
				or(eq(awareness.celebrityId, args.subjectId), eq(awareness.categoryId, args.subjectId)),
				eq(awareness.fieldingDate, args.fieldingDate),
				eq(awareness.gender, args.gender),
				eq(awareness.ageBand, args.ageBand),
			),
		)
	return row ?? null
}

export async function getQuestion(args: {
	subjectId: string
	fieldingDate: string
	gender: Gender
	ageBand: AgeBand
	awarenessMode: AwarenessMode
	question: Question
}): Promise<QuestionResult | null> {
	const [row] = await db
		.select({ base: questionResult.base, data: questionResult.data })
		.from(questionResult)
		.where(
			and(
				or(eq(questionResult.celebrityId, args.subjectId), eq(questionResult.categoryId, args.subjectId)),
				eq(questionResult.fieldingDate, args.fieldingDate),
				eq(questionResult.gender, args.gender),
				eq(questionResult.ageBand, args.ageBand),
				eq(questionResult.awarenessMode, args.awarenessMode),
				eq(questionResult.question, args.question),
			),
		)
	if (!row) return null
	return { base: row.base, data: row.data as QuestionResult['data'] }
}

// Distinct fielding dates present in the data, newest first. Drives the date filter.
export async function getFieldingDates(): Promise<string[]> {
	const rows = await db
		.selectDistinct({ fieldingDate: awareness.fieldingDate })
		.from(awareness)
		.orderBy(desc(awareness.fieldingDate))
	return rows.map(r => r.fieldingDate)
}

// The list view: every celebrity, name-ordered. No filter: the list just links to
// each scorecard, which applies its own default slice.
export async function listCelebrities(): Promise<{ id: string; name: string; photoUrl: string }[]> {
	return db
		.select({ id: celebrity.id, name: celebrity.name, photoUrl: celebrity.photoUrl })
		.from(celebrity)
		.orderBy(celebrity.name)
}
