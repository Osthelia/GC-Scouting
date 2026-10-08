CREATE TYPE "public"."action_token_action" AS ENUM('renew', 'delete');--> statement-breakpoint
CREATE TYPE "public"."agent_role" AS ENUM('duelist', 'initiator', 'controller', 'sentinel', 'flex');--> statement-breakpoint
CREATE TYPE "public"."discord_channel_kind" AS ENUM('feed', 'moderation');--> statement-breakpoint
CREATE TYPE "public"."igl_role" AS ENUM('igl', 'co_igl');--> statement-breakpoint
CREATE TYPE "public"."moderation_action" AS ENUM('remove', 'restore', 'tweeted');--> statement-breakpoint
CREATE TYPE "public"."player_link_status" AS ENUM('pending', 'approved', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('active', 'closed', 'removed');--> statement-breakpoint
CREATE TYPE "public"."post_type" AS ENUM('lft', 'lfp', 'lfs', 'lfo', 'lfst');--> statement-breakpoint
CREATE TYPE "public"."region" AS ENUM('eu', 'na', 'latam', 'br', 'apac', 'kr', 'jp', 'oce', 'mena', 'cn');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('spam', 'fake', 'inappropriate', 'harassment', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'handled', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('coach', 'analyst', 'manager');--> statement-breakpoint
CREATE TYPE "public"."tournament_level" AS ENUM('cash_cup', 'playoffs', 'main_event');--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"user_id" text PRIMARY KEY NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text,
	"expires_at" timestamp with time zone NOT NULL,
	"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_links" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"gc_person_id" bigint NOT NULL,
	"gc_change_request_id" bigint,
	"status" "player_link_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"checked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"gc_user_id" text NOT NULL,
	"username" varchar(32) NOT NULL,
	"avatar_url" text,
	"email" text,
	"discord_id" text,
	"notify_email" boolean DEFAULT false NOT NULL,
	"notify_discord" boolean DEFAULT false NOT NULL,
	"notify_prompted_at" timestamp with time zone,
	"locale" varchar(5) DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_gc_user_id_unique" UNIQUE("gc_user_id"),
	CONSTRAINT "users_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
CREATE TABLE "discord_channels" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"kind" "discord_channel_kind" DEFAULT 'feed' NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"moderator_role_id" text,
	"locale" varchar(5) DEFAULT 'en' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by_discord_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discord_channels_channel_id_unique" UNIQUE("channel_id"),
	CONSTRAINT "discord_channels_moderator_role" CHECK ("discord_channels"."kind" = 'moderation' or "discord_channels"."moderator_role_id" is null)
);
--> statement-breakpoint
CREATE TABLE "discord_deliveries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"post_id" bigint NOT NULL,
	"channel_config_id" bigint NOT NULL,
	"message_id" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"post_id" bigint NOT NULL,
	"report_id" bigint,
	"action" "moderation_action" NOT NULL,
	"discord_user_id" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"post_id" bigint NOT NULL,
	"reporter_user_id" text,
	"reporter_discord_id" text,
	"reason" "report_reason" NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"moderation_message_id" text,
	"handled_by_discord_id" text,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_has_reporter" CHECK ("reports"."reporter_user_id" is not null or "reports"."reporter_discord_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "action_tokens" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"post_id" bigint NOT NULL,
	"action" "action_token_action" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "action_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"type" "post_type" NOT NULL,
	"status" "post_status" DEFAULT 'active' NOT NULL,
	"display_name" varchar(32) NOT NULL,
	"gc_team_id" bigint,
	"region" "region" NOT NULL,
	"country" char(2),
	"languages" varchar(2)[] NOT NULL,
	"roles" "agent_role"[] DEFAULT '{}' NOT NULL,
	"igl" "igl_role"[] DEFAULT '{}' NOT NULL,
	"staff_roles" "staff_role"[] DEFAULT '{}' NOT NULL,
	"rank_current" smallint,
	"rank_peak" smallint,
	"rank_min" smallint,
	"rank_max" smallint,
	"experience_years" smallint DEFAULT 0 NOT NULL,
	"tournament_levels" "tournament_level"[] DEFAULT '{}' NOT NULL,
	"tier_list" jsonb,
	"strong_agents" text[] DEFAULT '{}'::text[] NOT NULL,
	"timezone" text NOT NULL,
	"availability" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"availability_utc" "int4multirange" DEFAULT '{}'::int4multirange NOT NULL,
	"weekly_minutes" smallint DEFAULT 0 NOT NULL,
	"active_days" smallint DEFAULT 0 NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"contact" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"gc_summary" jsonb,
	"gc_summary_synced_at" timestamp with time zone,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"bumped_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"expiry_notice_sent_at" timestamp with time zone,
	"tweeted_at" timestamp with time zone,
	"tweeted_by_discord_id" text,
	"closed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_languages_not_empty" CHECK (cardinality("posts"."languages") > 0),
	CONSTRAINT "posts_rank_current_range" CHECK ("posts"."rank_current" between 0 and 24),
	CONSTRAINT "posts_rank_peak_range" CHECK ("posts"."rank_peak" between 0 and 24),
	CONSTRAINT "posts_rank_min_range" CHECK ("posts"."rank_min" between 0 and 24),
	CONSTRAINT "posts_rank_max_range" CHECK ("posts"."rank_max" between 0 and 24),
	CONSTRAINT "posts_rank_min_max" CHECK ("posts"."rank_min" is null or "posts"."rank_max" is null or "posts"."rank_min" <= "posts"."rank_max"),
	CONSTRAINT "posts_experience_years_range" CHECK ("posts"."experience_years" between 0 and 30),
	CONSTRAINT "posts_weekly_minutes_range" CHECK ("posts"."weekly_minutes" between 0 and 10080),
	CONSTRAINT "posts_active_days_range" CHECK ("posts"."active_days" between 0 and 7),
	CONSTRAINT "posts_removed_has_deleted_at" CHECK (("posts"."status" = 'removed') = ("posts"."deleted_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_links" ADD CONSTRAINT "player_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_deliveries" ADD CONSTRAINT "discord_deliveries_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_deliveries" ADD CONSTRAINT "discord_deliveries_channel_config_id_discord_channels_id_fk" FOREIGN KEY ("channel_config_id") REFERENCES "public"."discord_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_tokens" ADD CONSTRAINT "action_tokens_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "player_links_one_active_per_user" ON "player_links" USING btree ("user_id") WHERE "player_links"."status" in ('pending', 'approved');--> statement-breakpoint
CREATE INDEX "player_links_pending_idx" ON "player_links" USING btree ("checked_at") WHERE "player_links"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "discord_channels_guild_idx" ON "discord_channels" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "discord_deliveries_post_channel_idx" ON "discord_deliveries" USING btree ("post_id","channel_config_id","sent_at");--> statement-breakpoint
CREATE INDEX "discord_deliveries_channel_idx" ON "discord_deliveries" USING btree ("channel_config_id");--> statement-breakpoint
CREATE INDEX "moderation_actions_post_idx" ON "moderation_actions" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "reports_post_idx" ON "reports" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "reports_open_idx" ON "reports" USING btree ("created_at") WHERE "reports"."status" = 'open';--> statement-breakpoint
CREATE INDEX "action_tokens_post_idx" ON "action_tokens" USING btree ("post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_single_active_per_type" ON "posts" USING btree ("author_id","type") WHERE "posts"."type" in ('lft', 'lfst') and "posts"."status" = 'active';--> statement-breakpoint
CREATE INDEX "posts_feed_idx" ON "posts" USING btree ("bumped_at" DESC NULLS LAST) WHERE "posts"."status" = 'active' and "posts"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "posts_type_region_idx" ON "posts" USING btree ("type","region");--> statement-breakpoint
CREATE INDEX "posts_author_idx" ON "posts" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "posts_expiry_notice_idx" ON "posts" USING btree ("expires_at") WHERE "posts"."status" = 'active' and "posts"."expiry_notice_sent_at" is null;--> statement-breakpoint
CREATE INDEX "posts_languages_idx" ON "posts" USING gin ("languages");--> statement-breakpoint
CREATE INDEX "posts_roles_idx" ON "posts" USING gin ("roles");--> statement-breakpoint
CREATE INDEX "posts_staff_roles_idx" ON "posts" USING gin ("staff_roles");--> statement-breakpoint
CREATE INDEX "posts_tournament_levels_idx" ON "posts" USING gin ("tournament_levels");--> statement-breakpoint
CREATE INDEX "posts_strong_agents_idx" ON "posts" USING gin ("strong_agents");--> statement-breakpoint
CREATE INDEX "posts_availability_idx" ON "posts" USING gist ("availability_utc");