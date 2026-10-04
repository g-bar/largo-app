// Shared contract across the HTTP boundary: the valibot schema validates endpoint
// query params; the data types describe accessor returns (and so the endpoint
// responses). Imported by the load, the endpoints, and the client fetch wrappers.
import * as v from 'valibot'

export const genders = ['total', 'male', 'female'] as const
export const ageBands = ['total'] as const
export const awarenessModes = ['any', 'name', 'face'] as const
export const questions = ['appeal', 'attributes', 'power_factors', 'e_score'] as const

export type Gender = (typeof genders)[number]
export type AgeBand = (typeof ageBands)[number]
export type AwarenessMode = (typeof awarenessModes)[number]
export type Question = (typeof questions)[number]

// The /api/question query params. A subject is a celebrity or a category: exactly
// one of celebrityId / categoryId is set.
export const questionQuerySchema = v.pipe(
	v.object({
		celebrityId: v.optional(v.string()),
		categoryId: v.optional(v.string()),
		fieldingDate: v.pipe(v.string(), v.isoDate()),
		gender: v.picklist(genders),
		ageBand: v.picklist(ageBands),
		awarenessMode: v.picklist(awarenessModes),
		question: v.picklist(questions),
	}),
	v.check(
		o => (o.celebrityId == null) !== (o.categoryId == null),
		'Exactly one of celebrityId / categoryId is required',
	),
)

export type QuestionQuery = v.InferOutput<typeof questionQuerySchema>

// Response shapes. The data payload depends on the question.
export type AppealData = {
	likeALot: number
	like: number
	likeSomewhat: number
	dislikeSomewhat: number
	dislike: number
	dislikeALot: number
}
// attributes and power_factors are ordered maps (bar order preserved by the json column).
export type OrderedMap = Record<string, number>
// e_score is a single number. appeal is the 6-point distribution; attributes /
// power_factors are ordered maps.
export type QuestionData = AppealData | OrderedMap | number

export type QuestionResult = { base: number; data: QuestionData }

export type CelebrityResult = {
	id: string
	name: string
	photoUrl: string
	imdbUrl: string
	categories: { id: string; name: string; position: number }[]
}

// Awareness gate row: the whole-sample size plus the aware counts by recognition
// mode. The displayed awareness % is derived (awareAny / sampleBase).
export type Awareness = {
	sampleBase: number
	awareAny: number
	awareName: number
	awareFace: number
}
