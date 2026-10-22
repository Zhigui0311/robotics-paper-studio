import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const papers = sqliteTable('papers', {
  id: text('id').primaryKey(), userId: text('user_id').notNull(),
  fingerprint: text('fingerprint').notNull(), record: text('record').notNull(),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, (t) => [uniqueIndex('paper_owner_identity').on(t.userId, t.fingerprint)]);
export const comparisons = sqliteTable('comparisons', {
  id: text('id').primaryKey(), userId: text('user_id').notNull(),
  record: text('record').notNull(), createdAt: text('created_at').notNull(),
});
