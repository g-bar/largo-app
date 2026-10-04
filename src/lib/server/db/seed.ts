// Synthetic seed. Run with `pnpm db:seed` (node --env-file=.env). Runs under plain
// Node, so it builds its own postgres connection from process.env.DATABASE_URL
// rather than importing the SvelteKit-coupled db client.
//
// Design: everything is built from atomic leaf cells (one gender x one age band), then
// rolled up by summation (counts) and base-weighted averaging (rates). Nothing at a
// `total` level is chosen independently, so every rollup identity in DATA_METHODOLOGY
// holds by construction:
//   - sampleBase/awareAny/awareName/awareFace at gender=total or ageBand=total are the
//     exact sum of their leaf slices.
//   - awareAny = awareName + awareFace - both (OR-union), preserved under summation
//     because `both` sums linearly too.
//   - a gated row's base equals the matching awareness count for that cell.
//   - a category is the rating-weighted pool of its member celebrities (base = sum of
//     member aware counts, so >= any member; distribution = aware-weighted average).
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

// ---------------------------------------------------------------------------
// Dimensions
// ---------------------------------------------------------------------------

const FIELDING_DATES = ['2025-01-24', '2025-07-25'] as const
const LEAF_GENDERS = ['male', 'female'] as const
const LEAF_AGE_BANDS = ['13-20', '21-34', '35-54', '55+'] as const
const MODES = ['any', 'name', 'face'] as const

type Gender = 'total' | 'male' | 'female'
type AgeBand = 'total' | (typeof LEAF_AGE_BANDS)[number]
type Mode = (typeof MODES)[number]

type Appeal = {
	likeALot: number
	like: number
	likeSomewhat: number
	dislikeSomewhat: number
	dislike: number
	dislikeALot: number
}
const APPEAL_KEYS: (keyof Appeal)[] = [
	'likeALot',
	'like',
	'likeSomewhat',
	'dislikeSomewhat',
	'dislike',
	'dislikeALot',
]

const ATTRIBUTE_KEYS = [
	'Attractive',
	'Approachable',
	'Aspirational',
	'Believable',
	'Confident',
	'Compassionate',
	'Cool/Hip',
	'Creative',
	'Distinguished',
	'Edgy',
	'Influential',
	'One-of-a-Kind',
] as const

const POWER_KEYS = [
	'Talented',
	'Funny',
	'Exciting',
	'Sexy',
	'Intelligent',
	'Beautiful',
	'Good Energy',
	'Trustworthy',
	'Sincere',
] as const

// ---------------------------------------------------------------------------
// Deterministic PRNG so re-seeding is stable and verifiable.
// ---------------------------------------------------------------------------

function hashString(s: string): number {
	let h = 2166136261
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i)
		h = Math.imul(h, 16777619)
	}
	return h >>> 0
}

// mulberry32: tiny deterministic generator seeded from a string key.
function rng(key: string): () => number {
	let a = hashString(key)
	return () => {
		a |= 0
		a = (a + 0x6d2b79f5) | 0
		let t = Math.imul(a ^ (a >>> 15), 1 | a)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

const randInt = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))

// ---------------------------------------------------------------------------
// Celebrities and their category memberships. A celebrity can belong to several
// categories. Each celebrity carries base "personality" dials (popularity, how
// positive their appeal skews) that make their numbers plausible and distinct.
// ---------------------------------------------------------------------------

type CelebDef = {
	id: string
	name: string
	photoUrl: string
	imdbUrl: string
	popularity: number // 0..1, drives awareness level
	positivity: number // 0..1, drives how positive appeal / attributes skew
	categories: string[] // membership; first is the primary benchmark (position 1)
}

const CELEBRITIES: CelebDef[] = [
	{
		id: 'brad-pitt',
		name: 'Brad Pitt',
		photoUrl: 'https://m.media-amazon.com/images/M/MV5BMjA1MjE2MTQ2MV5BMl5BanBnXkFtZTcwMjE5MDY0Nw@@._V1_.jpg',
		imdbUrl: 'https://www.imdb.com/name/nm0000093/',
		popularity: 0.78,
		positivity: 0.72,
		categories: ['film-actor', 'action-adventure-actor', 'spokesperson', 'romance-actor'],
	},
	{
		id: 'margot-robbie',
		name: 'Margot Robbie',
		photoUrl: 'https://m.media-amazon.com/images/M/MV5BMTgxNDcwMzU2Nl5BMl5BanBnXkFtZTcwNDc4NzkzOQ@@._V1_.jpg',
		imdbUrl: 'https://www.imdb.com/name/nm3053338/',
		popularity: 0.71,
		positivity: 0.76,
		categories: ['film-actor', 'romance-actor', 'comedy-actor', 'streaming-actor'],
	},
	{
		id: 'denzel-washington',
		name: 'Denzel Washington',
		photoUrl: 'https://m.media-amazon.com/images/M/MV5BMjExMjY5ODYyM15BMl5BanBnXkFtZTgwOTU0OTg0NDM@._V1_.jpg',
		imdbUrl: 'https://www.imdb.com/name/nm0000243/',
		popularity: 0.74,
		positivity: 0.81,
		categories: ['film-actor', 'drama-actor', 'action-adventure-actor'],
	},
	{
		id: 'zendaya',
		name: 'Zendaya',
		photoUrl: 'https://m.media-amazon.com/images/M/MV5BZjM5N2U3MzQtZWU5My00YzE0LThmZTgtYjE1NDJjNmIzZmIxXkEyXkFqcGc@._V1_.jpg',
		imdbUrl: 'https://www.imdb.com/name/nm3918035/',
		popularity: 0.69,
		positivity: 0.74,
		categories: ['streaming-actor', 'film-actor', 'spokesperson', 'drama-actor'],
	},
	{
		id: 'ryan-reynolds',
		name: 'Ryan Reynolds',
		photoUrl: 'https://m.media-amazon.com/images/M/MV5BMzRiNDhiMDQtYWZkMS00ZjU5LTg5NzUtOTc4NzE2Yzc0ZWUwXkEyXkFqcGc@._V1_.jpg',
		imdbUrl: 'https://www.imdb.com/name/nm0005351/',
		popularity: 0.76,
		positivity: 0.7,
		categories: ['comedy-actor', 'action-adventure-actor', 'spokesperson', 'film-actor'],
	},
	{
		id: 'viola-davis',
		name: 'Viola Davis',
		photoUrl: 'https://m.media-amazon.com/images/M/MV5BNzUxNjM4ODI1OV5BMl5BanBnXkFtZTgwNTEwNDE2OTE@._V1_.jpg',
		imdbUrl: 'https://www.imdb.com/name/nm0205626/',
		popularity: 0.62,
		positivity: 0.8,
		categories: ['drama-actor', 'film-actor', 'streaming-actor'],
	},
	{
		id: 'tom-holland',
		name: 'Tom Holland',
		photoUrl: 'https://m.media-amazon.com/images/M/MV5BYzU3NWRhMjgtNmNmMS00YjQ1LWIyYzgtYzdkYjRjNWEzM2E3XkEyXkFqcGc@._V1_.jpg',
		imdbUrl: 'https://www.imdb.com/name/nm4043618/',
		popularity: 0.68,
		positivity: 0.73,
		categories: ['action-adventure-actor', 'film-actor', 'streaming-actor'],
	},
	{
		id: 'florence-pugh',
		name: 'Florence Pugh',
		photoUrl: 'https://m.media-amazon.com/images/M/MV5BZmIxMTFkZTctYzhkZi00MmQ4LThhYzEtMmQwMGZjNzA5MDg0XkEyXkFqcGc@._V1_.jpg',
		imdbUrl: 'https://www.imdb.com/name/nm6073955/',
		popularity: 0.55,
		positivity: 0.75,
		categories: ['drama-actor', 'film-actor', 'romance-actor'],
	},
	{
		id: 'will-smith',
		name: 'Will Smith',
		photoUrl: 'https://m.media-amazon.com/images/M/MV5BNTczMzk1MjU1MV5BMl5BanBnXkFtZTcwNDk2MzAyMg@@._V1_.jpg',
		imdbUrl: 'https://www.imdb.com/name/nm0000226/',
		popularity: 0.8,
		positivity: 0.58,
		categories: ['action-adventure-actor', 'comedy-actor', 'film-actor', 'spokesperson'],
	},
	{
		id: 'anya-taylor-joy',
		name: 'Anya Taylor-Joy',
		photoUrl: 'https://m.media-amazon.com/images/M/MV5BMGZjYzcxNDEtNTU1Yi00Nzc3LTlhZjQtZTUwZDQxNjQ5MDIzXkEyXkFqcGc@._V1_.jpg',
		imdbUrl: 'https://www.imdb.com/name/nm5896355/',
		popularity: 0.5,
		positivity: 0.72,
		categories: ['streaming-actor', 'film-actor', 'drama-actor'],
	},
]

const CATEGORY_NAMES: Record<string, string> = {
	'film-actor': 'Film Personality - Actor',
	'action-adventure-actor': 'Film Personality - Actor - Action-Adventure',
	'romance-actor': 'Film Personality - Actor - Romance',
	'comedy-actor': 'Film Personality - Actor - Comedy',
	'drama-actor': 'Film Personality - Actor - Drama',
	'streaming-actor': 'Streaming Actor',
	spokesperson: 'Spokesperson',
}

// ---------------------------------------------------------------------------
// Leaf-cell generation. For one (celebrity, fieldingDate, gender, ageBand) leaf we
// produce the whole-sample counts and, per awareness mode, the gated metric rates.
// Everything above the leaf is derived from these by summing counts and
// base-weighting rates, never chosen independently.
// ---------------------------------------------------------------------------

type ModeMetrics = {
	appeal: Appeal
	attributes: Record<string, number>
	powerFactors: Record<string, number>
	eScore: number
}

type Leaf = {
	sampleBase: number
	awareName: number
	awareFace: number
	both: number // name AND face overlap; awareAny = name + face - both
	awareAny: number
	// gated metric rates per awareness mode (percentages)
	metrics: Record<Mode, ModeMetrics>
}

// Age-band share of the panel (sums to 1 across the four bands); roughly realistic.
const AGE_SHARE: Record<(typeof LEAF_AGE_BANDS)[number], number> = {
	'13-20': 0.18,
	'21-34': 0.3,
	'35-54': 0.32,
	'55+': 0.2,
}

// Build a 6-point appeal distribution (sums to 100) from a positivity dial. Higher
// positivity shifts mass toward the top boxes.
function makeAppeal(r: () => number, positivity: number): Appeal {
	const topWeight = 40 + positivity * 35 // 40..75 of mass in the top three
	const likeALot = topWeight * (0.3 + 0.1 * r())
	const like = topWeight * (0.33 + 0.08 * r())
	const likeSomewhat = topWeight - likeALot - like
	const bottom = 100 - topWeight
	const dislikeSomewhat = bottom * (0.5 + 0.1 * r())
	const dislike = bottom * (0.3 + 0.05 * r())
	const dislikeALot = bottom - dislikeSomewhat - dislike
	const raw = [likeALot, like, likeSomewhat, dislikeSomewhat, dislike, dislikeALot]
	return normalizeDist(raw) as unknown as Appeal
}

// Round a list of fractional values to integers summing to `total` (largest-remainder).
function roundToTotal(values: number[], total: number): number[] {
	const floors = values.map(Math.floor)
	let used = floors.reduce((s, v) => s + v, 0)
	const remainders = values
		.map((v, i) => ({ i, frac: v - floors[i] }))
		.sort((a, b) => b.frac - a.frac)
	let k = 0
	while (used < total) {
		floors[remainders[k % remainders.length].i]++
		used++
		k++
	}
	return floors
}

// Normalise a 6-point distribution to integers summing to 100, returned as an Appeal.
function normalizeDist(raw: number[]): Appeal {
	const sum = raw.reduce((s, v) => s + v, 0)
	const scaled = raw.map(v => (v * 100) / sum)
	const ints = roundToTotal(scaled, 100)
	return {
		likeALot: ints[0],
		like: ints[1],
		likeSomewhat: ints[2],
		dislikeSomewhat: ints[3],
		dislike: ints[4],
		dislikeALot: ints[5],
	}
}

// Independent attribute / power-factor percentages (each is "% of awares who picked
// this"), so they do NOT sum to 100. Each is a plausible value nudged by positivity.
function makeOrderedMap(r: () => number, keys: readonly string[], positivity: number): Record<string, number> {
	const out: Record<string, number> = {}
	for (const k of keys) {
		const lo = 3
		const hi = 20 + positivity * 25 // more positive celebs score higher on traits
		out[k] = Math.round(lo + r() * (hi - lo))
	}
	return out
}

// Shift an appeal distribution for name/face recognition cuts: name-aware skews
// slightly less positive than the pooled aware, face-aware slightly more.
function shiftAppeal(a: Appeal, delta: number): Appeal {
	const raw = [
		Math.max(0, a.likeALot + delta),
		Math.max(0, a.like + delta),
		a.likeSomewhat,
		a.dislikeSomewhat,
		Math.max(0, a.dislike - delta),
		Math.max(0, a.dislikeALot - delta),
	]
	return normalizeDist(raw)
}

function shiftMap(m: Record<string, number>, factor: number): Record<string, number> {
	const out: Record<string, number> = {}
	for (const k of Object.keys(m)) out[k] = Math.max(0, Math.round(m[k] * factor))
	return out
}

function makeLeaf(celeb: CelebDef, date: string, gender: 'male' | 'female', ageBand: (typeof LEAF_AGE_BANDS)[number]): Leaf {
	const r = rng(`${celeb.id}|${date}|${gender}|${ageBand}`)

	// Sample base for this gender x age leaf. ~1200 per gender per date, split by age.
	const genderPanel = gender === 'male' ? 590 : 610
	const dateNudge = date === FIELDING_DATES[1] ? 1.04 : 1 // slight panel growth wave 2
	const sampleBase = Math.round(genderPanel * dateNudge * AGE_SHARE[ageBand])

	// Awareness level: popularity, with age/gender texture. Older bands tend to know
	// film actors a bit more; small gender wobble. Clamped to a sane range.
	const ageAwareBoost = { '13-20': -0.08, '21-34': 0.0, '35-54': 0.05, '55+': 0.03 }[ageBand]
	const genderWobble = gender === 'male' ? -0.02 : 0.02
	let awarePct = celeb.popularity + ageAwareBoost + genderWobble + (r() - 0.5) * 0.06
	awarePct = Math.min(0.95, Math.max(0.15, awarePct))

	// name and face are overlapping subsets of the aware. Generate name and face
	// counts and their overlap directly, then awareAny = name + face - both.
	const awareNameShare = 0.8 + r() * 0.1 // name recognition
	const awareFaceShare = 0.88 + r() * 0.08 // face recognition (usually higher)
	const awareName = Math.round(sampleBase * awarePct * awareNameShare)
	const awareFace = Math.round(sampleBase * awarePct * awareFaceShare)
	// Overlap: most name-aware are also face-aware. both in [max(0, name+face-sampleBase), min]
	const minNF = Math.min(awareName, awareFace)
	const both = Math.round(minNF * (0.78 + r() * 0.14))
	const awareAny = awareName + awareFace - both

	// Gated metrics per awareness mode. The `any` pool is the base; name/face are
	// recognition cuts nudged off it (so they're genuinely different slices).
	const appealAny = makeAppeal(r, celeb.positivity)
	const attrAny = makeOrderedMap(r, ATTRIBUTE_KEYS, celeb.positivity)
	const powerAny = makeOrderedMap(r, POWER_KEYS, celeb.positivity)
	const eScoreAny = Math.round(60 + celeb.positivity * 40 + (r() - 0.5) * 10)

	const metrics: Record<Mode, ModeMetrics> = {
		any: { appeal: appealAny, attributes: attrAny, powerFactors: powerAny, eScore: eScoreAny },
		name: {
			appeal: shiftAppeal(appealAny, -2),
			attributes: shiftMap(attrAny, 0.95),
			powerFactors: shiftMap(powerAny, 0.95),
			eScore: Math.max(0, eScoreAny - 3),
		},
		face: {
			appeal: shiftAppeal(appealAny, 2),
			attributes: shiftMap(attrAny, 1.05),
			powerFactors: shiftMap(powerAny, 1.05),
			eScore: eScoreAny + 2,
		},
	}

	return { sampleBase, awareName, awareFace, both, awareAny, metrics }
}

// ---------------------------------------------------------------------------
// Rollups. A cell is a set of leaves; aggregate counts by sum and rates by
// aware-weighted average (per mode). This is the single aggregation used for every
// gender/age combination, so totals equal the sum of their slices exactly.
// ---------------------------------------------------------------------------

type Counts = { sampleBase: number; awareName: number; awareFace: number; both: number; awareAny: number }

function sumCounts(leaves: Leaf[]): Counts {
	return leaves.reduce(
		(acc, l) => ({
			sampleBase: acc.sampleBase + l.sampleBase,
			awareName: acc.awareName + l.awareName,
			awareFace: acc.awareFace + l.awareFace,
			both: acc.both + l.both,
			awareAny: acc.awareAny + l.awareAny,
		}),
		{ sampleBase: 0, awareName: 0, awareFace: 0, both: 0, awareAny: 0 },
	)
}

const awareFor = (c: Counts, mode: Mode) =>
	mode === 'any' ? c.awareAny : mode === 'name' ? c.awareName : c.awareFace

// Aware-weighted pooled distribution over leaves for a given mode. Weight each leaf's
// rate by that leaf's aware count for the mode, then renormalise appeal to 100.
function poolAppeal(leaves: Leaf[], mode: Mode): Appeal {
	const weighted = APPEAL_KEYS.map(() => 0)
	let w = 0
	for (const l of leaves) {
		const aw = mode === 'any' ? l.awareAny : mode === 'name' ? l.awareName : l.awareFace
		const d = l.metrics[mode].appeal
		APPEAL_KEYS.forEach((k, i) => (weighted[i] += d[k] * aw))
		w += aw
	}
	if (w === 0) return { likeALot: 0, like: 0, likeSomewhat: 0, dislikeSomewhat: 0, dislike: 0, dislikeALot: 0 }
	return normalizeDist(weighted.map(v => v / w))
}

function poolMap(leaves: Leaf[], mode: Mode, which: 'attributes' | 'powerFactors', keys: readonly string[]): Record<string, number> {
	const out: Record<string, number> = {}
	let w = 0
	const acc: Record<string, number> = {}
	for (const k of keys) acc[k] = 0
	for (const l of leaves) {
		const aw = mode === 'any' ? l.awareAny : mode === 'name' ? l.awareName : l.awareFace
		const m = l.metrics[mode][which]
		for (const k of keys) acc[k] += m[k] * aw
		w += aw
	}
	for (const k of keys) out[k] = w === 0 ? 0 : Math.round(acc[k] / w)
	return out
}

function poolEScore(leaves: Leaf[], mode: Mode): number {
	let num = 0
	let w = 0
	for (const l of leaves) {
		const aw = mode === 'any' ? l.awareAny : mode === 'name' ? l.awareName : l.awareFace
		num += l.metrics[mode].eScore * aw
		w += aw
	}
	return w === 0 ? 0 : Math.round(num / w)
}

// The gender x age combinations we store (including the `total` rollups). For each we
// know which leaves fall into it.
type Combo = { gender: Gender; ageBand: AgeBand }
const COMBOS: Combo[] = (() => {
	const genders: Gender[] = ['total', 'male', 'female']
	const ages: AgeBand[] = ['total', ...LEAF_AGE_BANDS]
	const out: Combo[] = []
	for (const g of genders) for (const a of ages) out.push({ gender: g, ageBand: a })
	return out
})()

function leavesFor(all: Record<string, Leaf>, combo: Combo): Leaf[] {
	const gs = combo.gender === 'total' ? LEAF_GENDERS : [combo.gender as 'male' | 'female']
	const as = combo.ageBand === 'total' ? LEAF_AGE_BANDS : [combo.ageBand as (typeof LEAF_AGE_BANDS)[number]]
	const out: Leaf[] = []
	for (const g of gs) for (const a of as) out.push(all[`${g}|${a}`])
	return out
}

// ---------------------------------------------------------------------------
// Build the rows.
// ---------------------------------------------------------------------------

type AwarenessRow = typeof awareness.$inferInsert
type QuestionRow = typeof questionResult.$inferInsert

// For each subject (celeb or category), per fielding date, the aggregated cell data
// at every combo + mode. We compute celebrity cells first, then pool categories from
// their members using the SAME per-combo aware counts and rates.
type CellMetrics = {
	counts: Counts
	// pooled gated metrics per mode
	byMode: Record<Mode, ModeMetrics>
}

function cellFromLeaves(leaves: Leaf[]): CellMetrics {
	const counts = sumCounts(leaves)
	const byMode = {} as Record<Mode, ModeMetrics>
	for (const mode of MODES) {
		byMode[mode] = {
			appeal: poolAppeal(leaves, mode),
			attributes: poolMap(leaves, mode, 'attributes', ATTRIBUTE_KEYS),
			powerFactors: poolMap(leaves, mode, 'powerFactors', POWER_KEYS),
			eScore: poolEScore(leaves, mode),
		}
	}
	return { counts, byMode }
}

// A category cell is the rating-weighted pool of its member celebrity cells for the
// same (date, combo). base/counts = sum of member aware counts (ratings), distribution
// = member-aware-weighted average of member rates. Built per mode so each mode pools
// over that mode's member counts.
function categoryCell(memberCells: CellMetrics[]): CellMetrics {
	const counts: Counts = memberCells.reduce(
		(acc, c) => ({
			sampleBase: acc.sampleBase + c.counts.sampleBase,
			awareName: acc.awareName + c.counts.awareName,
			awareFace: acc.awareFace + c.counts.awareFace,
			both: acc.both + c.counts.both,
			awareAny: acc.awareAny + c.counts.awareAny,
		}),
		{ sampleBase: 0, awareName: 0, awareFace: 0, both: 0, awareAny: 0 },
	)
	const byMode = {} as Record<Mode, ModeMetrics>
	for (const mode of MODES) {
		// aware-weighted pool over member cells for this mode
		const appealAcc = APPEAL_KEYS.map(() => 0)
		const attrAcc: Record<string, number> = {}
		const powerAcc: Record<string, number> = {}
		for (const k of ATTRIBUTE_KEYS) attrAcc[k] = 0
		for (const k of POWER_KEYS) powerAcc[k] = 0
		let w = 0
		for (const c of memberCells) {
			const aw = awareFor(c.counts, mode)
			const m = c.byMode[mode]
			APPEAL_KEYS.forEach((k, i) => (appealAcc[i] += m.appeal[k] * aw))
			for (const k of ATTRIBUTE_KEYS) attrAcc[k] += m.attributes[k] * aw
			for (const k of POWER_KEYS) powerAcc[k] += m.powerFactors[k] * aw
			w += aw
		}
		const attributes: Record<string, number> = {}
		const powerFactors: Record<string, number> = {}
		for (const k of ATTRIBUTE_KEYS) attributes[k] = w === 0 ? 0 : Math.round(attrAcc[k] / w)
		for (const k of POWER_KEYS) powerFactors[k] = w === 0 ? 0 : Math.round(powerAcc[k] / w)
		byMode[mode] = {
			appeal: w === 0 ? { likeALot: 0, like: 0, likeSomewhat: 0, dislikeSomewhat: 0, dislike: 0, dislikeALot: 0 } : normalizeDist(appealAcc.map(v => v / w)),
			attributes,
			powerFactors,
			eScore: 0, // categories have no E-Score
		}
	}
	return { counts, byMode }
}

await db.transaction(async tx => {
	// Idempotent: wipe then insert. Order respects FKs.
	await tx.delete(questionResult)
	await tx.delete(awareness)
	await tx.delete(celebrityCategory)
	await tx.delete(celebrity)
	await tx.delete(category)

	// Celebrities.
	await tx.insert(celebrity).values(
		CELEBRITIES.map(c => ({ id: c.id, name: c.name, photoUrl: c.photoUrl, imdbUrl: c.imdbUrl })),
	)

	// Categories (dedup across celebrities' memberships).
	const usedCategoryIds = [...new Set(CELEBRITIES.flatMap(c => c.categories))]
	await tx.insert(category).values(usedCategoryIds.map(id => ({ id, name: CATEGORY_NAMES[id] })))

	// Memberships: position by order listed per celebrity (position 1 = primary).
	await tx.insert(celebrityCategory).values(
		CELEBRITIES.flatMap(c => c.categories.map((categoryId, i) => ({ celebrityId: c.id, categoryId, position: i + 1 }))),
	)

	// members of each category (for pooling), by id.
	const categoryMembers = new Map<string, string[]>()
	for (const id of usedCategoryIds) categoryMembers.set(id, [])
	for (const c of CELEBRITIES) for (const cat of c.categories) categoryMembers.get(cat)!.push(c.id)

	const awarenessRows: AwarenessRow[] = []
	const questionRows: QuestionRow[] = []

	for (const date of FIELDING_DATES) {
		// Celebrity cells, indexed by [celebId][comboKey].
		const celebCells = new Map<string, Map<string, CellMetrics>>()

		for (const celeb of CELEBRITIES) {
			// leaves keyed by "gender|ageBand"
			const leaves: Record<string, Leaf> = {}
			for (const g of LEAF_GENDERS) for (const a of LEAF_AGE_BANDS) leaves[`${g}|${a}`] = makeLeaf(celeb, date, g, a)

			const cells = new Map<string, CellMetrics>()
			for (const combo of COMBOS) {
				cells.set(`${combo.gender}|${combo.ageBand}`, cellFromLeaves(leavesFor(leaves, combo)))
			}
			celebCells.set(celeb.id, cells)

			// Emit celebrity awareness + question rows for every combo.
			for (const combo of COMBOS) {
				const cell = cells.get(`${combo.gender}|${combo.ageBand}`)!
				emitAwareness(awarenessRows, { celebrityId: celeb.id }, date, combo, cell.counts)
				emitQuestions(questionRows, { celebrityId: celeb.id }, date, combo, cell, true)
			}
		}

		// Category cells pooled from member celebrity cells, per combo.
		for (const catId of usedCategoryIds) {
			const members = categoryMembers.get(catId)!
			for (const combo of COMBOS) {
				const comboKey = `${combo.gender}|${combo.ageBand}`
				const memberCells = members.map(mId => celebCells.get(mId)!.get(comboKey)!)
				const cell = categoryCell(memberCells)
				emitAwareness(awarenessRows, { categoryId: catId }, date, combo, cell.counts)
				emitQuestions(questionRows, { categoryId: catId }, date, combo, cell, false)
			}
		}
	}

	await tx.insert(awareness).values(awarenessRows)
	// Insert question rows in chunks to stay well under parameter limits.
	for (let i = 0; i < questionRows.length; i += 500) {
		await tx.insert(questionResult).values(questionRows.slice(i, i + 500))
	}

	console.log(`Inserted ${awarenessRows.length} awareness rows, ${questionRows.length} question rows.`)
})

type Subject = { celebrityId: string; categoryId?: undefined } | { categoryId: string; celebrityId?: undefined }

function emitAwareness(rows: AwarenessRow[], subject: Subject, date: string, combo: Combo, counts: Counts) {
	rows.push({
		celebrityId: subject.celebrityId ?? null,
		categoryId: subject.categoryId ?? null,
		fieldingDate: date,
		gender: combo.gender,
		ageBand: combo.ageBand,
		sampleBase: counts.sampleBase,
		awareAny: counts.awareAny,
		awareName: counts.awareName,
		awareFace: counts.awareFace,
	})
}

// Emit the gated question rows for one cell. appeal spans all three awareness modes;
// attributes / power_factors / e_score are the `any` slice only (matching the read
// side). Categories get no e_score. Each row's base is the matching aware count, so
// invariant #2 holds exactly.
function emitQuestions(rows: QuestionRow[], subject: Subject, date: string, combo: Combo, cell: CellMetrics, isCelebrity: boolean) {
	const base = (mode: Mode) => awareFor(cell.counts, mode)
	const common = {
		celebrityId: subject.celebrityId ?? null,
		categoryId: subject.categoryId ?? null,
		fieldingDate: date,
		gender: combo.gender,
		ageBand: combo.ageBand,
	}
	for (const mode of MODES) {
		rows.push({ ...common, awarenessMode: mode, question: 'appeal', base: base(mode), data: cell.byMode[mode].appeal })
	}
	rows.push({ ...common, awarenessMode: 'any', question: 'attributes', base: base('any'), data: cell.byMode.any.attributes })
	rows.push({ ...common, awarenessMode: 'any', question: 'power_factors', base: base('any'), data: cell.byMode.any.powerFactors })
	if (isCelebrity) {
		rows.push({ ...common, awarenessMode: 'any', question: 'e_score', base: base('any'), data: cell.byMode.any.eScore })
	}
}

await sql.end()
console.log('Seed complete.')
