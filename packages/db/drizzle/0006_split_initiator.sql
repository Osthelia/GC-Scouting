-- "initiator" is split in "initiator_reveal" and "initiator_flash", existing posts get both.
ALTER TABLE "posts" ALTER COLUMN "roles" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "roles" SET DATA TYPE text[] USING "roles"::text[];--> statement-breakpoint
DROP TYPE "public"."agent_role";--> statement-breakpoint
CREATE TYPE "public"."agent_role" AS ENUM('duelist', 'initiator_reveal', 'initiator_flash', 'controller', 'sentinel', 'flex');--> statement-breakpoint
UPDATE "posts" SET "roles" = array_remove("roles", 'initiator') || ARRAY['initiator_reveal', 'initiator_flash'] WHERE 'initiator' = ANY("roles");--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "roles" SET DATA TYPE "public"."agent_role"[] USING "roles"::"public"."agent_role"[];--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "roles" SET DEFAULT '{}';
