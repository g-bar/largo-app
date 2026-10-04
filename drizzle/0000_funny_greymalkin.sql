CREATE TYPE "public"."age_band" AS ENUM('total');--> statement-breakpoint
CREATE TYPE "public"."awareness_mode" AS ENUM('any', 'name', 'face');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('total', 'male', 'female');--> statement-breakpoint
CREATE TYPE "public"."question" AS ENUM('appeal', 'attributes', 'power_factors', 'e_score');--> statement-breakpoint
CREATE TABLE "awareness" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "awareness_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"celebrity_id" text,
	"category_id" text,
	"fielding_date" date NOT NULL,
	"gender" "gender" NOT NULL,
	"sample_base" integer NOT NULL,
	"aware_any" integer NOT NULL,
	"aware_name" integer NOT NULL,
	"aware_face" integer NOT NULL,
	CONSTRAINT "awareness_celebrity_id_category_id_fielding_date_gender_unique" UNIQUE("celebrity_id","category_id","fielding_date","gender"),
	CONSTRAINT "awareness_subject_exactly_one" CHECK (("awareness"."celebrity_id" is not null) <> ("awareness"."category_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "celebrity" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"photo_url" text NOT NULL,
	"imdb_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "celebrity_category" (
	"celebrity_id" text NOT NULL,
	"category_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "celebrity_category_celebrity_id_category_id_pk" PRIMARY KEY("celebrity_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "question_result" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "question_result_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"celebrity_id" text,
	"category_id" text,
	"fielding_date" date NOT NULL,
	"gender" "gender" NOT NULL,
	"age_band" "age_band" NOT NULL,
	"awareness_mode" "awareness_mode" NOT NULL,
	"question" "question" NOT NULL,
	"base" integer NOT NULL,
	"data" json NOT NULL,
	CONSTRAINT "question_result_celebrity_id_category_id_fielding_date_gender_age_band_awareness_mode_question_unique" UNIQUE("celebrity_id","category_id","fielding_date","gender","age_band","awareness_mode","question"),
	CONSTRAINT "question_result_subject_exactly_one" CHECK (("question_result"."celebrity_id" is not null) <> ("question_result"."category_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "awareness" ADD CONSTRAINT "awareness_celebrity_id_celebrity_id_fk" FOREIGN KEY ("celebrity_id") REFERENCES "public"."celebrity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awareness" ADD CONSTRAINT "awareness_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "celebrity_category" ADD CONSTRAINT "celebrity_category_celebrity_id_celebrity_id_fk" FOREIGN KEY ("celebrity_id") REFERENCES "public"."celebrity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "celebrity_category" ADD CONSTRAINT "celebrity_category_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_result" ADD CONSTRAINT "question_result_celebrity_id_celebrity_id_fk" FOREIGN KEY ("celebrity_id") REFERENCES "public"."celebrity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_result" ADD CONSTRAINT "question_result_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;