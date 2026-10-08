CREATE TABLE "delegation_invites" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delegation_invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "profile_delegations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"delegate_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_delegations_not_self" CHECK ("profile_delegations"."owner_id" <> "profile_delegations"."delegate_id")
);
--> statement-breakpoint
ALTER TABLE "delegation_invites" ADD CONSTRAINT "delegation_invites_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_delegations" ADD CONSTRAINT "profile_delegations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_delegations" ADD CONSTRAINT "profile_delegations_delegate_id_users_id_fk" FOREIGN KEY ("delegate_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delegation_invites_owner_idx" ON "delegation_invites" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_delegations_pair" ON "profile_delegations" USING btree ("owner_id","delegate_id");--> statement-breakpoint
CREATE INDEX "profile_delegations_delegate_idx" ON "profile_delegations" USING btree ("delegate_id");