CREATE TYPE "public"."lan_option" AS ENUM('lan', 'online');--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT "posts_compensation_type";--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "lan" "lan_option";--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_lan_type" CHECK ("posts"."lan" is null or "posts"."type" in ('lft', 'lfp', 'lfs', 'lfst'));--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_compensation_type" CHECK ("posts"."type" <> 'lfo' or "posts"."compensation" is not null);