CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" integer PRIMARY KEY NOT NULL,
	"email" citext NOT NULL
);
