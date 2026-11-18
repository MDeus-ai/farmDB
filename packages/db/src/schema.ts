import { relations } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const livestock = sqliteTable(
  'livestock',
  {
    id: text('id').primaryKey(),
    species: text('species').notNull().default('cow'),
    sex: text('sex').notNull().default('female'),
    tagNumber: text('tag_number').notNull().unique(),
    name: text('name'),
    breed: text('breed'),
    dob: text('dob'),
    imageUri: text('image_uri'),
    sireId: text('sire_id'),
    damId: text('dam_id'),
    status: text('status').notNull().default('active'),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('idx_livestock_species').on(table.species),
    index('idx_livestock_sex').on(table.sex),
    index('idx_livestock_status').on(table.status),
    index('idx_livestock_sire_id').on(table.sireId),
    index('idx_livestock_dam_id').on(table.damId),
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

export const workers = sqliteTable(
  'workers',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    role: text('role').notNull(),
    phone: text('phone'),
    responsibilities: text('responsibilities'),
    salaryAmount: real('salary_amount').notNull().default(0),
    payFrequency: text('pay_frequency').notNull().default('monthly'),
    nextPaymentDueDate: text('next_payment_due_date').notNull(),
    status: text('status').notNull().default('active'),
    hireDate: text('hire_date'),
    paymentNotifiedForDueDate: text('payment_notified_for_due_date'),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('idx_workers_status').on(table.status),
    index('idx_workers_next_due_date').on(table.nextPaymentDueDate),
  ]
);

export const workerPayments = sqliteTable(
  'worker_payments',
  {
    id: text('id').primaryKey(),
    workerId: text('worker_id')
      .notNull()
      .references(() => workers.id, { onDelete: 'cascade' }),
    financialLogId: text('financial_log_id').references(() => financialLogs.id, {
      onDelete: 'set null',
    }),
    amount: real('amount').notNull(),
    dueDate: text('due_date').notNull(),
    paidDate: text('paid_date'),
    status: text('status').notNull().default('pending'),
    periodLabel: text('period_label'),
    notes: text('notes'),
    notifiedAt: integer('notified_at', { mode: 'number' }),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('idx_worker_payments_worker_id').on(table.workerId),
    index('idx_worker_payments_status').on(table.status),
    index('idx_worker_payments_due_date').on(table.dueDate),
  ]
);

export const workerTasks = sqliteTable(
  'worker_tasks',
  {
    id: text('id').primaryKey(),
    workerId: text('worker_id')
      .notNull()
      .references(() => workers.id, { onDelete: 'cascade' }),
    livestockId: text('livestock_id').references(() => livestock.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    description: text('description'),
    priority: text('priority').notNull().default('medium'),
    status: text('status').notNull().default('pending'),
    dueDate: text('due_date'),
    completedAt: integer('completed_at', { mode: 'number' }),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('idx_worker_tasks_worker_id').on(table.workerId),
    index('idx_worker_tasks_status').on(table.status),
    index('idx_worker_tasks_due_date').on(table.dueDate),
  ]
);

export const animalOwnerships = sqliteTable(
  'animal_ownerships',
  {
    id: text('id').primaryKey(),
    livestockId: text('livestock_id')
      .notNull()
      .references(() => livestock.id, { onDelete: 'cascade' }),
    ownerName: text('owner_name').notNull(),
    ownerContact: text('owner_contact'),
    accountId: text('account_id'),
    ownershipCategory: text('ownership_category')
      .notNull()
      .default('external_boarded'),
    sharePercentage: real('share_percentage').notNull().default(100),
    purpose: text('purpose'),
    startDate: text('start_date').notNull(),
    expectedEndDate: text('expected_end_date'),
    boardingFee: real('boarding_fee').notNull().default(0),
    status: text('status').notNull().default('active'),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('idx_animal_ownerships_livestock_id').on(table.livestockId),
    index('idx_animal_ownerships_account_id').on(table.accountId),
    index('idx_animal_ownerships_category').on(table.ownershipCategory),
    index('idx_animal_ownerships_status').on(table.status),
  ]
);

export const farmAccounts = sqliteTable(
  'farm_accounts',
  {
    id: text('id').primaryKey(),
    displayName: text('display_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    role: text('role').notNull().default('family_member'),
    relationship: text('relationship'),
    avatarKey: text('avatar_key').notNull().default('farmer'),
    accessCode: text('access_code'),
    supabaseUrl: text('supabase_url'),
    supabaseAnonKey: text('supabase_anon_key'),
    cloudWorkspaceId: text('cloud_workspace_id'),
    isPrimaryAdmin: integer('is_primary_admin', { mode: 'boolean' })
      .notNull()
      .default(false),
    canManageNetwork: integer('can_manage_network', { mode: 'boolean' })
      .notNull()
      .default(false),
    canSyncCloud: integer('can_sync_cloud', { mode: 'boolean' })
      .notNull()
      .default(true),
    permissionsJson: text('permissions_json').notNull(),
    status: text('status').notNull().default('active'),
    lastSyncedAt: integer('last_synced_at', { mode: 'number' }),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('idx_farm_accounts_role').on(table.role),
    index('idx_farm_accounts_status').on(table.status),
  ]
);

export const cloudSyncLogs = sqliteTable(
  'cloud_sync_logs',
  {
    id: text('id').primaryKey(),
    direction: text('direction').notNull(),
    status: text('status').notNull(),
    recordsPushed: integer('records_pushed', { mode: 'number' })
      .notNull()
      .default(0),
    recordsPulled: integer('records_pulled', { mode: 'number' })
      .notNull()
      .default(0),
    summary: text('summary').notNull(),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
  },
  (table) => [index('idx_cloud_sync_logs_created_at').on(table.createdAt)]
);

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
  ownerships: many(animalOwnerships),
}));

export const animalOwnershipsRelations = relations(
  animalOwnerships,
  ({ one }) => ({
    animal: one(livestock, {
      fields: [animalOwnerships.livestockId],
      references: [livestock.id],
    }),
  })
);

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

export const workersRelations = relations(workers, ({ many }) => ({
  payments: many(workerPayments),
  tasks: many(workerTasks),
}));

export const workerPaymentsRelations = relations(workerPayments, ({ one }) => ({
  worker: one(workers, {
    fields: [workerPayments.workerId],
    references: [workers.id],
  }),
  financialLog: one(financialLogs, {
    fields: [workerPayments.financialLogId],
    references: [financialLogs.id],
  }),
}));

export const workerTasksRelations = relations(workerTasks, ({ one }) => ({
  worker: one(workers, {
    fields: [workerTasks.workerId],
    references: [workers.id],
  }),
  animal: one(livestock, {
    fields: [workerTasks.livestockId],
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
  workers,
  workerPayments,
  workerTasks,
  animalOwnerships,
  farmAccounts,
  cloudSyncLogs,
  livestockRelations,
  productRecordsRelations,
  medicalRecordsRelations,
  financialLogsRelations,
  alertsRelations,
  workersRelations,
  workerPaymentsRelations,
  workerTasksRelations,
  animalOwnershipsRelations,
};

export type FarmDbSchema = typeof schema;
