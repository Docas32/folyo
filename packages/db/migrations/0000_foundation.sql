CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "google_sub" text NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "avatar_url" text,
  "locale" text DEFAULT 'pt-BR' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "users_google_sub_unique" UNIQUE("google_sub"),
  CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "handle" text NOT NULL,
  "title" text,
  "description" text,
  "favicon_key" text,
  "template_id" text DEFAULT 'blank' NOT NULL,
  "theme" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "published_version" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "sites_user_id_unique" UNIQUE("user_id"),
  CONSTRAINT "sites_handle_unique" UNIQUE("handle"),
  CONSTRAINT "sites_handle_check" CHECK ("sites"."handle" ~ '^[a-z0-9-]{3,30}$'),
  CONSTRAINT "sites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "pages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_id" uuid NOT NULL,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "position" integer NOT NULL,
  CONSTRAINT "pages_site_slug_unique" UNIQUE("site_id", "slug"),
  CONSTRAINT "pages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "blocks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "page_id" uuid NOT NULL,
  "type" text NOT NULL,
  "content" jsonb NOT NULL,
  "position" integer NOT NULL,
  CONSTRAINT "blocks_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "r2_key" text NOT NULL,
  "mime" text NOT NULL,
  "size" integer NOT NULL,
  "width" integer,
  "height" integer,
  "alt" text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "assets_r2_key_unique" UNIQUE("r2_key"),
  CONSTRAINT "assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "publications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "r2_prefix" text NOT NULL,
  "published_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "publications_site_version_unique" UNIQUE("site_id", "version"),
  CONSTRAINT "publications_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_id" uuid NOT NULL,
  "reason" text NOT NULL,
  "details" text,
  "status" text DEFAULT 'open' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "reports_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "reserved_handles" (
  "handle" text PRIMARY KEY NOT NULL
);
