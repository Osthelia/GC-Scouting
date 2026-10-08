CREATE TYPE "public"."age_group" AS ENUM('minor', 'adult');--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "age_group" "age_group";--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "minors_accepted" boolean;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_age_group_type" CHECK ("posts"."age_group" is null or "posts"."type" = 'lft');--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_minors_accepted_type" CHECK ("posts"."minors_accepted" is null or "posts"."type" in ('lfp', 'lfs', 'lfst'));