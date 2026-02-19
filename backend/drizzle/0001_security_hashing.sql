-- Custom SQL migration file, put your code below! --

-- Security hardening migration:
-- 1. All existing users/api_keys invalidated — passwords required, api_keys rehashed
-- 2. Add password_hash to users
-- 3. Replace plaintext api_keys.key with key_hash + hint
-- 4. Create sessions table

DELETE FROM api_keys;
--> statement-breakpoint
DELETE FROM usage_logs;
--> statement-breakpoint
DELETE FROM generators;
--> statement-breakpoint
DELETE FROM users;
--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN "password_hash" varchar(256) NOT NULL;
--> statement-breakpoint

ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_key_unique";
--> statement-breakpoint
ALTER TABLE "api_keys" DROP COLUMN "key";
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "key_hash" varchar(64) NOT NULL;
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "hint" varchar(4) NOT NULL;
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash");
--> statement-breakpoint

CREATE TABLE "sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
