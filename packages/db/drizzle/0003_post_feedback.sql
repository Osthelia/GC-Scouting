CREATE TYPE "public"."compensation" AS ENUM('paid', 'free');--> statement-breakpoint
ALTER TYPE "public"."staff_role" ADD VALUE 'assistant_coach' BEFORE 'analyst';--> statement-breakpoint
ALTER TYPE "public"."staff_role" ADD VALUE 'performance_coach' BEFORE 'analyst';--> statement-breakpoint
ALTER TYPE "public"."staff_role" ADD VALUE 'mental_coach' BEFORE 'analyst';--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT "posts_experience_years_range";--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "compensation" "compensation";--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "experience" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "posts" SET "compensation" = 'free' WHERE "type" = 'lfo';--> statement-breakpoint
UPDATE "posts" SET "experience" = coalesce((SELECT jsonb_object_agg(level, greatest("experience_years" * 12, 3)) FROM unnest("tournament_levels") AS level), '{}'::jsonb);--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_compensation_type" CHECK (("posts"."type" = 'lfo') = ("posts"."compensation" is not null));--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN "experience_years";
