import { relations, sql } from 'drizzle-orm'
import {
	check,
	date,
	integer,
	json,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	unique,
} from 'drizzle-orm/pg-core'

// Dimension enums. Every dimension carries a real "all" sentinel (never NULL), so
// unique constraints dedup correctly and "all" is queried like any other value.
export const gender = pgEnum('gender', ['total', 'male', 'female'])
export const ageBand = pgEnum('age_band', ['total'])
export const awarenessMode = pgEnum('awareness_mode', ['any', 'name', 'face'])
export const question = pgEnum('question', ['appeal', 'attributes', 'power_factors', 'e_score'])

export const celebrity = pgTable('celebrity', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	photoUrl: text('photo_url').notNull(),
	imdbUrl: text('imdb_url').notNull(),
})

export const category = pgTable('category', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
})

// Benchmarks shown for a celebrity. position 1 is the primary one (Appeal, Power
// Factors use it).
export const celebrityCategory = pgTable(
	'celebrity_category',
	{
		celebrityId: text('celebrity_id')
			.notNull()
			.references(() => celebrity.id),
		categoryId: text('category_id')
			.notNull()
			.references(() => category.id),
		position: integer('position').notNull(),
	},
	t => [primaryKey({ columns: [t.celebrityId, t.categoryId] })],
)

// Awareness gate: the whole-sample facts, one row per subject x fieldingDate x
// gender. sampleBase is the surveyed count; awareAny/awareName/awareFace are the
// counts recognising the subject by name-or-face / name / face. These counts are the
// source of truth for the gated questions' denominators: a gated question_result row
// with awarenessMode = face has base = awareFace (same subject/fielding/gender), etc.
// (name and face overlap, so they do not sum to any.) No eScore here: E-Score is
// gated, so it lives in question_result like appeal.
export const awareness = pgTable(
	'awareness',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		celebrityId: text('celebrity_id').references(() => celebrity.id),
		categoryId: text('category_id').references(() => category.id),
		fieldingDate: date('fielding_date').notNull(),
		gender: gender('gender').notNull(),
		sampleBase: integer('sample_base').notNull(),
		awareAny: integer('aware_any').notNull(),
		awareName: integer('aware_name').notNull(),
		awareFace: integer('aware_face').notNull(),
	},
	t => [
		unique().on(t.celebrityId, t.categoryId, t.fieldingDate, t.gender),
		check(
			'awareness_subject_exactly_one',
			sql`(${t.celebrityId} is not null) <> (${t.categoryId} is not null)`,
		),
	],
)

// Gated detail (appeal, attributes, power_factors, e_score). base is the aware count
// for that cell's awarenessMode (= the matching awareness.aware* count). data is a
// JSON shape that depends on the question (see QuestionData in the data layer): the
// appeal distribution, an ordered map for attributes/power_factors, or a plain number
// for e_score. Stored as json (not jsonb) to preserve object key order, which is the
// bar order for attributes and power factors.
export const questionResult = pgTable(
	'question_result',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		celebrityId: text('celebrity_id').references(() => celebrity.id),
		categoryId: text('category_id').references(() => category.id),
		fieldingDate: date('fielding_date').notNull(),
		gender: gender('gender').notNull(),
		ageBand: ageBand('age_band').notNull(),
		awarenessMode: awarenessMode('awareness_mode').notNull(),
		question: question('question').notNull(),
		base: integer('base').notNull(),
		data: json('data').notNull(),
	},
	t => [
		unique().on(
			t.celebrityId,
			t.categoryId,
			t.fieldingDate,
			t.gender,
			t.ageBand,
			t.awarenessMode,
			t.question,
		),
		check(
			'question_result_subject_exactly_one',
			sql`(${t.celebrityId} is not null) <> (${t.categoryId} is not null)`,
		),
	],
)

export const celebrityRelations = relations(celebrity, ({ many }) => ({
	categories: many(celebrityCategory),
}))

export const categoryRelations = relations(category, ({ many }) => ({
	celebrities: many(celebrityCategory),
}))

export const celebrityCategoryRelations = relations(celebrityCategory, ({ one }) => ({
	celebrity: one(celebrity, {
		fields: [celebrityCategory.celebrityId],
		references: [celebrity.id],
	}),
	category: one(category, {
		fields: [celebrityCategory.categoryId],
		references: [category.id],
	}),
}))
