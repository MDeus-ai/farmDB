import { relations } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const livestock = sqliteTable(
  'livestock',
  {
    id: text('id').primaryKey(),
    species: text('species').notNull().default('cow'),
    tagNumber: text('tag_number').notNull().unique(),
    name: text('name'),
    breed: text('breed'),
    dob: text('dob'),
    imageUri: text('image_uri'),
    status: text('status').notNull().default('active'),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('idx_livestock_species').on(table.species),
    index('idx_livestock_status').on(table.status),
    index('idx_livestock_updated_at').on(table.updatedAt),
  ]
);

export const productRecords = sqliteTable(
  'product_records',
  {
    id: text('id').primaryKey(),
    livestockId: text('livestock_id')
      .notNull()
      .references(() => livestock.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    yieldAmount: real('yield_amount').notNull(),
    qualityNotes: text('quality_notes'),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('idx_product_records_livestock_id').on(table.livestockId),
    index('idx_product_records_date').on(table.date),
  ]
);

export const medicalRecords = sqliteTable(
  'medical_records',
  {
    id: text('id').primaryKey(),
    livestockId: text('livestock_id')
      .notNull()
      .references(() => livestock.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    condition: text('condition').notNull(),
    treatment: text('treatment').notNull(),
    cost: real('cost').notNull().default(0),
    veterinarian: text('veterinarian'),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('idx_medical_records_livestock_id').on(table.livestockId),
    index('idx_medical_records_date').on(table.date),
  ]
);

export const financialLogs = sqliteTable(
  'financial_logs',
  {
    id: text('id').primaryKey(),
    livestockId: text('livestock_id').references(() => livestock.id, {
      onDelete: 'set null',
    }),
    productRecordId: text('product_record_id').references(
      () => productRecords.id,
      { onDelete: 'set null' }
    ),
    transactionType: text('transaction_type').notNull(),
    amount: real('amount').notNull(),
    date: text('date').notNull(),
    category: text('category').notNull(),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('idx_financial_logs_livestock_id').on(table.livestockId),
    index('idx_financial_logs_product_record_id').on(table.productRecordId),
    index('idx_financial_logs_date').on(table.date),
    index('idx_financial_logs_type').on(table.transactionType),
  ]
);

export const farmSettings = sqliteTable('farm_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});

export const alerts = sqliteTable(
  'alerts',
  {
    id: text('id').primaryKey(),
    livestockId: text('livestock_id').references(() => livestock.id, {
      onDelete: 'cascade',
    }),
    entryKind: text('entry_kind').notNull().default('alert'),
    title: text('title').notNull(),
    description: text('description'),
    triggerDate: text('trigger_date').notNull(),
    isResolved: integer('is_resolved', { mode: 'boolean' }).notNull().default(false),
    notifiedAt: integer('notified_at', { mode: 'number' }),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('idx_alerts_livestock_id').on(table.livestockId),
    index('idx_alerts_entry_kind').on(table.entryKind),
    index('idx_alerts_trigger_date').on(table.triggerDate),
    index('idx_alerts_is_resolved').on(table.isResolved),
  ]
);

export const livestockRelations = relations(livestock, ({ many }) => ({
  productRecords: many(productRecords),
  medicalRecords: many(medicalRecords),
  financialLogs: many(financialLogs),
  alerts: many(alerts),
}));

export const productRecordsRelations = relations(productRecords, ({ one }) => ({
  animal: one(livestock, {
    fields: [productRecords.livestockId],
    references: [livestock.id],
  }),
}));

export const medicalRecordsRelations = relations(medicalRecords, ({ one }) => ({
  animal: one(livestock, {
    fields: [medicalRecords.livestockId],
    references: [livestock.id],
  }),
}));

export const financialLogsRelations = relations(financialLogs, ({ one }) => ({
  animal: one(livestock, {
    fields: [financialLogs.livestockId],
    references: [livestock.id],
  }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  animal: one(livestock, {
    fields: [alerts.livestockId],
    references: [livestock.id],
  }),
}));

export const schema = {
  livestock,
  productRecords,
  medicalRecords,
  financialLogs,
  alerts,
  farmSettings,
  livestockRelations,
  productRecordsRelations,
  medicalRecordsRelations,
  financialLogsRelations,
  alertsRelations,
};

export type FarmDbSchema = typeof schema;
