ALTER TABLE "player_links" RENAME COLUMN "gc_person_id" TO "gcs_person_id";--> statement-breakpoint
ALTER TABLE "player_links" RENAME COLUMN "gc_change_request_id" TO "gcs_change_request_id";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "gc_user_id" TO "gcs_user_id";--> statement-breakpoint
ALTER TABLE "users" RENAME CONSTRAINT "users_gc_user_id_unique" TO "users_gcs_user_id_unique";--> statement-breakpoint
ALTER TABLE "posts" RENAME COLUMN "gc_team_id" TO "gcs_team_id";--> statement-breakpoint
ALTER TABLE "posts" RENAME COLUMN "gc_summary" TO "gcs_summary";--> statement-breakpoint
ALTER TABLE "posts" RENAME COLUMN "gc_summary_synced_at" TO "gcs_summary_synced_at";
