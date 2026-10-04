CREATE TABLE "site_deletions" (
	"site_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"handle" text NOT NULL,
	"asset_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
