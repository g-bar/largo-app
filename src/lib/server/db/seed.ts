// Synthetic seed. Run with `pnpm db:seed` (node --env-file=.env). Runs under plain
// Node, so it builds its own postgres connection from process.env.DATABASE_URL
// rather than importing the SvelteKit-coupled db client.
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {
	awareness,
	category,
	celebrity,
	celebrityCategory,
	questionResult,
} from './schema.ts'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set')

const sql = postgres(DATABASE_URL)
const db = drizzle(sql)

const FIELDING_DATE = '2025-07-25'

type Gender = 'total' | 'male' | 'female'
type Appeal = {
	likeALot: number
	like: number
	likeSomewhat: number
	dislikeSomewhat: number
	dislike: number
	dislikeALot: number
}

// The source figures (ported from the old scorecards.json). appeal is the `any`
// slice (everyone aware). attributes / power_factors are ordered maps; order is the
// bar order and is preserved by the json column.
const BRAD_PITT: Record<
	Gender,
	{
		sampleBase: number
		awareness: number
		eScore: number
		appeal: Appeal
		attributes: Record<string, number>
		powerFactors: Record<string, number>
	}
> = {
	total: {
		sampleBase: 1200,
		awareness: 60,
		eScore: 99,
		appeal: { likeALot: 27, like: 25, likeSomewhat: 34, dislikeSomewhat: 9, dislike: 3, dislikeALot: 2 },
		attributes: {
			Attractive: 29,
			Approachable: 2,
			Aspirational: 3,
			Believable: 21,
			Confident: 35,
			Compassionate: 8,
			'Cool/Hip': 23,
			Creative: 5,
			Distinguished: 3,
			Edgy: 12,
			Influential: 10,
			'One-of-a-Kind': 15,
		},
		powerFactors: {
			Talented: 47,
			Funny: 12,
			Exciting: 11,
			Sexy: 14,
			Intelligent: 13,
			Beautiful: 6,
			'Good Energy': 19,
			Trustworthy: 6,
			Sincere: 6,
		},
	},
	male: {
		sampleBase: 590,
		awareness: 58,
		eScore: 97,
		appeal: { likeALot: 25, like: 24, likeSomewhat: 36, dislikeSomewhat: 9, dislike: 4, dislikeALot: 2 },
		attributes: {
			Attractive: 28,
			Approachable: 2,
			Aspirational: 2,
			Believable: 20,
			Confident: 34,
			Compassionate: 7,
			'Cool/Hip': 22,
			Creative: 4,
			Distinguished: 2,
			Edgy: 11,
			Influential: 9,
			'One-of-a-Kind': 14,
		},
		powerFactors: {
			Talented: 45,
			Funny: 11,
			Exciting: 10,
			Sexy: 12,
			Intelligent: 13,
			Beautiful: 5,
			'Good Energy': 18,
			Trustworthy: 6,
			Sincere: 5,
		},
	},
	female: {
		sampleBase: 610,
		awareness: 56,
		eScore: 96,
		appeal: { likeALot: 24, like: 23, likeSomewhat: 37, dislikeSomewhat: 10, dislike: 4, dislikeALot: 2 },
		attributes: {
			Attractive: 26,
			Approachable: 1,
			Aspirational: 2,
			Believable: 20,
			Confident: 33,
			Compassionate: 7,
			'Cool/Hip': 21,
			Creative: 4,
			Distinguished: 2,
			Edgy: 10,
			Influential: 8,
			'One-of-a-Kind': 13,
		},
		powerFactors: {
			Talented: 44,
			Funny: 12,
			Exciting: 11,
			Sexy: 15,
			Intelligent: 12,
			Beautiful: 7,
			'Good Energy': 19,
			Trustworthy: 6,
			Sincere: 6,
		},
	},
}

// Categories. Only awareness (header) + appeal / attributes / power_factors for the
// `any` slice, gender total. No eScore. sampleBase is synthetic (same panel).
const CATEGORIES: Record<
	string,
	{
		name: string
		awareness: number
		appeal: Appeal
		attributes: Record<string, number>
		powerFactors: Record<string, number>
	}
> = {
	'film-personality-actor': {
		name: 'Film Personality - Actor',
		awareness: 14,
		appeal: { likeALot: 27, like: 32, likeSomewhat: 31, dislikeSomewhat: 5, dislike: 3, dislikeALot: 2 },
		attributes: {
			Attractive: 22,
			Approachable: 4,
			Aspirational: 3,
			Believable: 18,
			Confident: 27,
			Compassionate: 6,
			'Cool/Hip': 17,
			Creative: 5,
			Distinguished: 3,
			Edgy: 9,
			Influential: 8,
			'One-of-a-Kind': 10,
		},
		powerFactors: {
			Talented: 37,
			Funny: 12,
			Exciting: 11,
			Sexy: 14,
			Intelligent: 13,
			Beautiful: 6,
			'Good Energy': 19,
			Trustworthy: 6,
			Sincere: 6,
		},
	},
	'film-personality-actor-action-adventure': {
		name: 'Film Personality - Actor - Action-Adventure',
		awareness: 16,
		appeal: { likeALot: 25, like: 30, likeSomewhat: 33, dislikeSomewhat: 6, dislike: 4, dislikeALot: 2 },
		attributes: {
			Attractive: 24,
			Approachable: 3,
			Aspirational: 4,
			Believable: 17,
			Confident: 30,
			Compassionate: 5,
			'Cool/Hip': 20,
			Creative: 5,
			Distinguished: 3,
			Edgy: 13,
			Influential: 9,
			'One-of-a-Kind': 11,
		},
		powerFactors: {
			Talented: 34,
			Funny: 10,
			Exciting: 16,
			Sexy: 13,
			Intelligent: 11,
			Beautiful: 6,
			'Good Energy': 17,
			Trustworthy: 5,
			Sincere: 5,
		},
	},
	spokesperson: {
		name: 'Spokesperson',
		awareness: 21,
		appeal: { likeALot: 20, like: 29, likeSomewhat: 34, dislikeSomewhat: 9, dislike: 5, dislikeALot: 3 },
		attributes: {
			Attractive: 18,
			Approachable: 6,
			Aspirational: 3,
			Believable: 20,
			Confident: 26,
			Compassionate: 8,
			'Cool/Hip': 13,
			Creative: 4,
			Distinguished: 4,
			Edgy: 6,
			Influential: 11,
			'One-of-a-Kind': 8,
		},
		powerFactors: {
			Talented: 28,
			Funny: 11,
			Exciting: 9,
			Sexy: 9,
			Intelligent: 15,
			Beautiful: 5,
			'Good Energy': 17,
			Trustworthy: 10,
			Sincere: 9,
		},
	},
	'film-personality-actor-romance': {
		name: 'Film Personality - Actor - Romance',
		awareness: 16,
		appeal: { likeALot: 28, like: 31, likeSomewhat: 29, dislikeSomewhat: 6, dislike: 4, dislikeALot: 2 },
		attributes: {
			Attractive: 27,
			Approachable: 5,
			Aspirational: 4,
			Believable: 18,
			Confident: 26,
			Compassionate: 9,
			'Cool/Hip': 18,
			Creative: 5,
			Distinguished: 3,
			Edgy: 7,
			Influential: 8,
			'One-of-a-Kind': 11,
		},
		powerFactors: {
			Talented: 33,
			Funny: 13,
			Exciting: 12,
			Sexy: 18,
			Intelligent: 11,
			Beautiful: 10,
			'Good Energy': 18,
			Trustworthy: 6,
			Sincere: 7,
		},
	},
	'streaming-actor': {
		name: 'Streaming Actor',
		awareness: 9,
		appeal: { likeALot: 22, like: 28, likeSomewhat: 33, dislikeSomewhat: 9, dislike: 5, dislikeALot: 3 },
		attributes: {
			Attractive: 23,
			Approachable: 5,
			Aspirational: 3,
			Believable: 16,
			Confident: 24,
			Compassionate: 6,
			'Cool/Hip': 19,
			Creative: 6,
			Distinguished: 2,
			Edgy: 11,
			Influential: 7,
			'One-of-a-Kind': 12,
		},
		powerFactors: {
			Talented: 30,
			Funny: 12,
			Exciting: 13,
			Sexy: 13,
			Intelligent: 11,
			Beautiful: 7,
			'Good Energy': 16,
			Trustworthy: 5,
			Sincere: 6,
		},
	},
}

// Category order for Brad Pitt's benchmarks. position 1 is the primary one.
const BENCHMARK_ORDER = [
	'film-personality-actor',
	'film-personality-actor-action-adventure',
	'spokesperson',
	'film-personality-actor-romance',
	'streaming-actor',
]

// Synthetic name/face appeal slices. In real E-Poll these are a recognition cut
// that cannot be recovered from the `any` aggregate, so we generate plausible ones:
// name-aware skews slightly less positive than the all-aware pool, face-aware
// slightly more. We nudge the 6-point distribution and renormalise to 100.
function shiftAppeal(a: Appeal, delta: number): Appeal {
	const raw = {
		likeALot: Math.max(0, a.likeALot + delta),
		like: Math.max(0, a.like + delta),
		likeSomewhat: a.likeSomewhat,
		dislikeSomewhat: a.dislikeSomewhat,
		dislike: Math.max(0, a.dislike - delta),
		dislikeALot: Math.max(0, a.dislikeALot - delta),
	}
	const sum = Object.values(raw).reduce((s, v) => s + v, 0)
	const keys = Object.keys(raw) as (keyof Appeal)[]
	const scaled = keys.map(k => Math.round((raw[k] * 100) / sum))
	// Fix rounding drift onto the largest bucket so the six values sum to 100.
	const drift = 100 - scaled.reduce((s, v) => s + v, 0)
	const maxIdx = scaled.indexOf(Math.max(...scaled))
	scaled[maxIdx] += drift
	return {
		likeALot: scaled[0],
		like: scaled[1],
		likeSomewhat: scaled[2],
		dislikeSomewhat: scaled[3],
		dislike: scaled[4],
		dislikeALot: scaled[5],
	}
}

const awareCount = (sampleBase: number, awareness: number) => Math.round((sampleBase * awareness) / 100)

// Aware counts by recognition mode. These are the source of truth for every gated
// question's base. name/face are synthetic (name ~85% of all-aware, face ~70%); they
// overlap, so they do not sum to any.
function awareCounts(sampleBase: number, awarenessPct: number) {
	const any = awareCount(sampleBase, awarenessPct)
	return { awareAny: any, awareName: Math.round(any * 0.85), awareFace: Math.round(any * 0.7) }
}

type QuestionRow = typeof questionResult.$inferInsert

await db.transaction(async tx => {
	// Idempotent: wipe then insert. Order respects FKs.
	await tx.delete(questionResult)
	await tx.delete(awareness)
	await tx.delete(celebrityCategory)
	await tx.delete(celebrity)
	await tx.delete(category)

	await tx.insert(celebrity).values({
		id: 'brad-pitt',
		name: 'Brad Pitt',
		photoUrl: '/images/brad-pitt.jpg',
		imdbUrl: 'https://www.imdb.com/fr/name/nm0000093/',
	})

	await tx.insert(category).values(
		Object.entries(CATEGORIES).map(([id, c]) => ({ id, name: c.name })),
	)

	await tx.insert(celebrityCategory).values(
		BENCHMARK_ORDER.map((categoryId, i) => ({
			celebrityId: 'brad-pitt',
			categoryId,
			position: i + 1,
		})),
	)

	// Awareness gate rows: Brad Pitt per gender, plus each category (gender total).
	// Categories use a synthetic sample base (pooled panel). The aware counts here are
	// the denominators the gated question rows below reuse.
	const awarenessBySubject = new Map<string, ReturnType<typeof awareCounts> & { sampleBase: number }>()
	const awarenessRows: (typeof awareness.$inferInsert)[] = []

	for (const g of ['total', 'male', 'female'] as Gender[]) {
		const d = BRAD_PITT[g]
		const counts = awareCounts(d.sampleBase, d.awareness)
		awarenessBySubject.set(`brad-pitt:${g}`, { sampleBase: d.sampleBase, ...counts })
		awarenessRows.push({
			celebrityId: 'brad-pitt',
			categoryId: null,
			fieldingDate: FIELDING_DATE,
			gender: g,
			sampleBase: d.sampleBase,
			...counts,
		})
	}
	for (const [id, c] of Object.entries(CATEGORIES)) {
		const counts = awareCounts(1200, c.awareness)
		awarenessBySubject.set(`${id}:total`, { sampleBase: 1200, ...counts })
		awarenessRows.push({
			celebrityId: null,
			categoryId: id,
			fieldingDate: FIELDING_DATE,
			gender: 'total',
			sampleBase: 1200,
			...counts,
		})
	}
	await tx.insert(awareness).values(awarenessRows)

	// Every gated question's base is pulled from the awareness counts, so the
	// invariant (question base[mode] == awareness.aware<Mode>) holds exactly.
	const rows: QuestionRow[] = []
	const baseFor = (key: string, mode: 'any' | 'name' | 'face') => {
		const a = awarenessBySubject.get(key)!
		return mode === 'any' ? a.awareAny : mode === 'name' ? a.awareName : a.awareFace
	}

	// Brad Pitt question rows, per gender.
	for (const g of ['total', 'male', 'female'] as Gender[]) {
		const d = BRAD_PITT[g]
		const key = `brad-pitt:${g}`
		// appeal: three awarenessMode slices. `any` uses the source distribution;
		// name/face are synthetic distributions. Each base = the matching aware count.
		rows.push({
			celebrityId: 'brad-pitt',
			categoryId: null,
			fieldingDate: FIELDING_DATE,
			gender: g,
			ageBand: 'total',
			awarenessMode: 'any',
			question: 'appeal',
			base: baseFor(key, 'any'),
			data: d.appeal,
		})
		rows.push({
			celebrityId: 'brad-pitt',
			categoryId: null,
			fieldingDate: FIELDING_DATE,
			gender: g,
			ageBand: 'total',
			awarenessMode: 'name',
			question: 'appeal',
			base: baseFor(key, 'name'),
			data: shiftAppeal(d.appeal, -2),
		})
		rows.push({
			celebrityId: 'brad-pitt',
			categoryId: null,
			fieldingDate: FIELDING_DATE,
			gender: g,
			ageBand: 'total',
			awarenessMode: 'face',
			question: 'appeal',
			base: baseFor(key, 'face'),
			data: shiftAppeal(d.appeal, 2),
		})
		// attributes / power_factors / e_score: awarenessMode = any only.
		rows.push({
			celebrityId: 'brad-pitt',
			categoryId: null,
			fieldingDate: FIELDING_DATE,
			gender: g,
			ageBand: 'total',
			awarenessMode: 'any',
			question: 'attributes',
			base: baseFor(key, 'any'),
			data: d.attributes,
		})
		rows.push({
			celebrityId: 'brad-pitt',
			categoryId: null,
			fieldingDate: FIELDING_DATE,
			gender: g,
			ageBand: 'total',
			awarenessMode: 'any',
			question: 'power_factors',
			base: baseFor(key, 'any'),
			data: d.powerFactors,
		})
		// E-Score: a gated question. A single number, measured among all-aware.
		rows.push({
			celebrityId: 'brad-pitt',
			categoryId: null,
			fieldingDate: FIELDING_DATE,
			gender: g,
			ageBand: 'total',
			awarenessMode: 'any',
			question: 'e_score',
			base: baseFor(key, 'any'),
			data: d.eScore,
		})
	}

	// Category question rows: gender total, awarenessMode any only. No E-Score.
	for (const [id, c] of Object.entries(CATEGORIES)) {
		const key = `${id}:total`
		rows.push({
			celebrityId: null,
			categoryId: id,
			fieldingDate: FIELDING_DATE,
			gender: 'total',
			ageBand: 'total',
			awarenessMode: 'any',
			question: 'appeal',
			base: baseFor(key, 'any'),
			data: c.appeal,
		})
		rows.push({
			celebrityId: null,
			categoryId: id,
			fieldingDate: FIELDING_DATE,
			gender: 'total',
			ageBand: 'total',
			awarenessMode: 'any',
			question: 'attributes',
			base: baseFor(key, 'any'),
			data: c.attributes,
		})
		rows.push({
			celebrityId: null,
			categoryId: id,
			fieldingDate: FIELDING_DATE,
			gender: 'total',
			ageBand: 'total',
			awarenessMode: 'any',
			question: 'power_factors',
			base: baseFor(key, 'any'),
			data: c.powerFactors,
		})
	}

	await tx.insert(questionResult).values(rows)
})

await sql.end()
console.log('Seed complete.')
