CREATE TABLE "discord_sync_leases" (
	"post_id" bigint PRIMARY KEY NOT NULL,
	"holder" uuid NOT NULL,
	"locked_until" timestamp with time zone NOT NULL,
	"refresh_pending" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_edits" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"post_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD COLUMN "access_subject" text;--> statement-breakpoint
ALTER TABLE "discord_sync_leases" ADD CONSTRAINT "discord_sync_leases_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_edits" ADD CONSTRAINT "post_edits_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_edits_post_idx" ON "post_edits" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "conversations_post_idx" ON "conversations" USING btree ("post_id") WHERE "conversations"."post_id" is not null;--> statement-breakpoint
CREATE INDEX "conversations_created_by_idx" ON "conversations" USING btree ("created_by_id") WHERE "conversations"."created_by_id" is not null;--> statement-breakpoint
CREATE INDEX "message_reports_reporter_idx" ON "message_reports" USING btree ("reporter_id") WHERE "message_reports"."reporter_id" is not null;--> statement-breakpoint
CREATE INDEX "message_reports_handled_by_idx" ON "message_reports" USING btree ("handled_by_id") WHERE "message_reports"."handled_by_id" is not null;--> statement-breakpoint
CREATE INDEX "messages_sent_by_idx" ON "messages" USING btree ("sent_by_id") WHERE "messages"."sent_by_id" is not null;--> statement-breakpoint
CREATE INDEX "messages_reviewed_by_idx" ON "messages" USING btree ("reviewed_by_id") WHERE "messages"."reviewed_by_id" is not null;--> statement-breakpoint
CREATE INDEX "moderation_actions_report_idx" ON "moderation_actions" USING btree ("report_id") WHERE "moderation_actions"."report_id" is not null;--> statement-breakpoint
CREATE INDEX "moderation_actions_actor_user_idx" ON "moderation_actions" USING btree ("actor_user_id") WHERE "moderation_actions"."actor_user_id" is not null;--> statement-breakpoint
CREATE INDEX "reports_reporter_user_idx" ON "reports" USING btree ("reporter_user_id") WHERE "reports"."reporter_user_id" is not null;--> statement-breakpoint
CREATE INDEX "reports_handled_by_user_idx" ON "reports" USING btree ("handled_by_user_id") WHERE "reports"."handled_by_user_id" is not null;