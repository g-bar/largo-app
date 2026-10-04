ALTER TYPE "public"."age_band" ADD VALUE '13-20';--> statement-breakpoint
ALTER TYPE "public"."age_band" ADD VALUE '21-34';--> statement-breakpoint
ALTER TYPE "public"."age_band" ADD VALUE '35-54';--> statement-breakpoint
ALTER TYPE "public"."age_band" ADD VALUE '55+';--> statement-breakpoint
ALTER TABLE "awareness" DROP CONSTRAINT "awareness_celebrity_id_category_id_fielding_date_gender_unique";--> statement-breakpoint
ALTER TABLE "awareness" ADD COLUMN "age_band" "age_band" NOT NULL;--> statement-breakpoint
ALTER TABLE "awareness" ADD CONSTRAINT "awareness_celebrity_id_category_id_fielding_date_gender_age_band_unique" UNIQUE("celebrity_id","category_id","fielding_date","gender","age_band");