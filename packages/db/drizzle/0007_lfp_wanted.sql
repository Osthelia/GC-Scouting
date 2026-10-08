ALTER TABLE "posts" ADD COLUMN "players_wanted" smallint;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "subs_wanted" smallint;--> statement-breakpoint
-- Existing LFP look for one player or one sub, from their roster spot.
UPDATE "posts" SET "players_wanted" = CASE WHEN "roster_spot" = 'sub' THEN 0 ELSE 1 END, "subs_wanted" = CASE WHEN "roster_spot" = 'sub' THEN 1 ELSE 0 END WHERE "type" = 'lfp';--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_wanted_type" CHECK (("posts"."type" = 'lfp') = ("posts"."players_wanted" is not null and "posts"."subs_wanted" is not null));--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_wanted_range" CHECK ("posts"."players_wanted" between 0 and 5 and "posts"."subs_wanted" between 0 and 5);--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_wanted_not_empty" CHECK ("posts"."players_wanted" + "posts"."subs_wanted" > 0);