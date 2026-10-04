// Client fetch wrappers for the JSON endpoints. Used by charts that are added at
// runtime (no load data): they fetch their own slice and show a skeleton until it
// resolves. The query params reuse the shared contract types.
import type { AgeBand, AwarenessMode, CelebrityResult, Gender, Question, QuestionResult } from '#lib/server/types.ts'

export type QuestionParams = {
	subjectId: string
	fieldingDate: string
	gender: Gender
	ageBand: AgeBand
	awarenessMode: AwarenessMode
	question: Question
}

// subjectId is a celebrity or a category id; the endpoint accepts either as
// celebrityId or categoryId. We send it as celebrityId by default; a caller
// querying a category passes isCategory.
export async function fetchQuestion(p: QuestionParams, isCategory = false): Promise<QuestionResult> {
	const params = new URLSearchParams({
		[isCategory ? 'categoryId' : 'celebrityId']: p.subjectId,
		fieldingDate: p.fieldingDate,
		gender: p.gender,
		ageBand: p.ageBand,
		awarenessMode: p.awarenessMode,
		question: p.question,
	})
	const res = await fetch(`/api/question?${params}`)
	if (!res.ok) throw new Error(`question fetch failed: ${res.status}`)
	return res.json()
}

export async function fetchCelebrity(id: string): Promise<CelebrityResult> {
	const res = await fetch(`/api/celebrity/${id}`)
	if (!res.ok) throw new Error(`celebrity fetch failed: ${res.status}`)
	return res.json()
}
