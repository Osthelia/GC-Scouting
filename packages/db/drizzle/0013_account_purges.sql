CREATE TABLE "discord_message_purges" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"message_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "discord_message_purges_message_idx" ON "discord_message_purges" USING btree ("channel_id","message_id");