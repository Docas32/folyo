CREATE TABLE "publication_operations" (
	"site_id" uuid PRIMARY KEY NOT NULL,
	"token" uuid NOT NULL,
	"assets_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "publications" ADD COLUMN "assets_keys" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "publication_operations" ADD CONSTRAINT "publication_operations_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;