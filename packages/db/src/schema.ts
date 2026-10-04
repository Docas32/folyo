import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  unique,
  check,
  index,
} from 'drizzle-orm/pg-core';
import type { TemplateId, SiteStatus, BlockType } from '@folyo/core';
const id = () => uuid('id').defaultRandom().primaryKey();
const createdAt = () =>
  timestamp('created_at', {
    withTimezone: true,
  }).defaultNow();
export const users = pgTable('users', {
  id: id(),
  googleSub: text('google_sub').unique().notNull(),
  email: text('email').unique().notNull(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
  termsVersion: text('terms_version'),
  locale: text('locale').notNull().default('pt-BR'),
  createdAt: createdAt(),
});
export const sites = pgTable(
  'sites',
  {
    id: id(),
    userId: uuid('user_id')
      .unique()
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),
    handle: text('handle').unique().notNull(),
    handleChangedAt: timestamp('handle_changed_at', { withTimezone: true }),
    title: text('title'),
    description: text('description'),
    faviconKey: text('favicon_key'),
    templateId: text('template_id')
      .$type<TemplateId>()
      .notNull()
      .default('blank'),
    theme: jsonb('theme')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    status: text('status').$type<SiteStatus>().notNull().default('draft'),
    publishedVersion: integer('published_version').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', {
      withTimezone: true,
    }).defaultNow(),
  },
  (table) => [
    check('sites_handle_check', sql`${table.handle} ~ '^[a-z0-9-]{3,30}$'`),
  ],
);
export const pages = pgTable(
  'pages',
  {
    id: id(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, {
        onDelete: 'cascade',
      }),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [unique('pages_site_slug_unique').on(table.siteId, table.slug)],
);
export const blocks = pgTable('blocks', {
  id: id(),
  pageId: uuid('page_id')
    .notNull()
    .references(() => pages.id, {
      onDelete: 'cascade',
    }),
  type: text('type').$type<BlockType>().notNull(),
  content: jsonb('content').$type<Record<string, unknown>>().notNull(),
  position: integer('position').notNull(),
});
export const assets = pgTable(
  'assets',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),
    r2Key: text('r2_key').unique().notNull(),
    mime: text('mime').notNull(),
    size: integer('size').notNull(),
    width: integer('width'),
    height: integer('height'),
    alt: text('alt'),
    orphanedAt: timestamp('orphaned_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    index('idx_assets_orphaned')
      .on(table.orphanedAt)
      .where(sql`${table.orphanedAt} is not null`),
  ],
);
export const publications = pgTable(
  'publications',
  {
    id: id(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, {
        onDelete: 'cascade',
      }),
    version: integer('version').notNull(),
    r2Prefix: text('r2_prefix').notNull(),
    assetsKeys: jsonb('assets_keys').$type<string[]>().notNull().default([]),
    publishedAt: timestamp('published_at', {
      withTimezone: true,
    }).defaultNow(),
  },
  (table) => [
    unique('publications_site_version_unique').on(table.siteId, table.version),
  ],
);
export const reports = pgTable('reports', {
  id: id(),
  siteId: uuid('site_id')
    .notNull()
    .references(() => sites.id, {
      onDelete: 'cascade',
    }),
  reason: text('reason').notNull(),
  details: text('details'),
  status: text('status').notNull().default('open'),
  createdAt: createdAt(),
});
export const reservedHandles = pgTable('reserved_handles', {
  handle: text('handle').primaryKey(),
});

// Durable serialization across R2/KV calls; crash recovery is explicit (README).
export const publicationOperations = pgTable('publication_operations', {
  siteId: uuid('site_id')
    .primaryKey()
    .references(() => sites.id, { onDelete: 'cascade' }),
  token: uuid('token').notNull(),
  assetsKeys: jsonb('assets_keys').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// No foreign keys: cleanup must survive deletion of the site/account itself.
export const siteDeletions = pgTable('site_deletions', {
  siteId: uuid('site_id').primaryKey(),
  userId: uuid('user_id').notNull(),
  handle: text('handle').notNull(),
  assetKeys: jsonb('asset_keys').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
