CREATE TYPE "public"."roster_spot" AS ENUM('player', 'sub');--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "roster_spot" "roster_spot";--> statement-breakpoint
UPDATE "posts" SET "roster_spot" = 'player' WHERE "type" in ('lft', 'lfp');--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_roster_spot_type" CHECK (("posts"."type" in ('lft', 'lfp')) = ("posts"."roster_spot" is not null));