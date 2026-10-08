CREATE TYPE "public"."tweet_by" AS ENUM('site', 'author');--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "tweet_by" "tweet_by" DEFAULT 'site' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "author_tweet_id" varchar(20);--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_tweet_by_author" CHECK ("posts"."author_tweet_id" is null or "posts"."tweet_by" = 'author');