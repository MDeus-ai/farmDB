export interface SqlMigration {
  id: string;
  statements: readonly string[];
}

export const FARMDB_MIGRATIONS: readonly SqlMigration[] = [
  {
    id: '0001_initial_schema',
    statements: [
      `CREATE TABLE IF NOT EXISTS livestock (
        id TEXT PRIMARY KEY NOT NULL,
        species TEXT NOT NULL DEFAULT 'cow',
        tag_number TEXT NOT NULL UNIQUE,
        name TEXT,
        breed TEXT,
        dob TEXT,
        image_uri TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_livestock_species ON livestock (species);`,
      `CREATE INDEX IF NOT EXISTS idx_livestock_status ON livestock (status);`,
      `CREATE INDEX IF NOT EXISTS idx_livestock_updated_at ON livestock (updated_at);`,

      `CREATE TABLE IF NOT EXISTS product_records (
        id TEXT PRIMARY KEY NOT NULL,
        livestock_id TEXT NOT NULL REFERENCES livestock(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        yield_amount REAL NOT NULL,
        quality_notes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_product_records_livestock_id ON product_records (livestock_id);`,
      `CREATE INDEX IF NOT EXISTS idx_product_records_date ON product_records (date);`,

      `CREATE TABLE IF NOT EXISTS medical_records (
        id TEXT PRIMARY KEY NOT NULL,
        livestock_id TEXT NOT NULL REFERENCES livestock(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        condition TEXT NOT NULL,
        treatment TEXT NOT NULL,
        cost REAL NOT NULL DEFAULT 0,
        veterinarian TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_medical_records_livestock_id ON medical_records (livestock_id);`,
      `CREATE INDEX IF NOT EXISTS idx_medical_records_date ON medical_records (date);`,

      `CREATE TABLE IF NOT EXISTS financial_logs (
        id TEXT PRIMARY KEY NOT NULL,
        livestock_id TEXT REFERENCES livestock(id) ON DELETE SET NULL,
        transaction_type TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        notes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_financial_logs_livestock_id ON financial_logs (livestock_id);`,
      `CREATE INDEX IF NOT EXISTS idx_financial_logs_date ON financial_logs (date);`,
      `CREATE INDEX IF NOT EXISTS idx_financial_logs_type ON financial_logs (transaction_type);`,

      `CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY NOT NULL,
        livestock_id TEXT REFERENCES livestock(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        trigger_date TEXT NOT NULL,
        is_resolved INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_alerts_livestock_id ON alerts (livestock_id);`,
      `CREATE INDEX IF NOT EXISTS idx_alerts_trigger_date ON alerts (trigger_date);`,
      `CREATE INDEX IF NOT EXISTS idx_alerts_is_resolved ON alerts (is_resolved);`,
    ],
  },
  {
    id: '0002_production_financial_links',
    statements: [
      `ALTER TABLE financial_logs ADD COLUMN product_record_id TEXT REFERENCES product_records(id) ON DELETE SET NULL;`,
      `CREATE INDEX IF NOT EXISTS idx_financial_logs_product_record_id ON financial_logs (product_record_id);`,
      `CREATE TABLE IF NOT EXISTS farm_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );`,
    ],
  },
  {
    id: '0003_alerts_notification_tracking',
    statements: [
      `ALTER TABLE alerts ADD COLUMN entry_kind TEXT NOT NULL DEFAULT 'alert';`,
      `ALTER TABLE alerts ADD COLUMN notified_at INTEGER;`,
      `CREATE INDEX IF NOT EXISTS idx_alerts_entry_kind ON alerts (entry_kind);`,
    ],
  },
  {
    id: '0004_livestock_lineage',
    statements: [
      `ALTER TABLE livestock ADD COLUMN sire_id TEXT REFERENCES livestock(id) ON DELETE SET NULL;`,
      `ALTER TABLE livestock ADD COLUMN dam_id TEXT REFERENCES livestock(id) ON DELETE SET NULL;`,
      `CREATE INDEX IF NOT EXISTS idx_livestock_sire_id ON livestock (sire_id);`,
      `CREATE INDEX IF NOT EXISTS idx_livestock_dam_id ON livestock (dam_id);`,
    ],
  },
  {
    id: '0005_human_resources',
    statements: [
      `CREATE TABLE IF NOT EXISTS workers (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        phone TEXT,
        responsibilities TEXT,
        salary_amount REAL NOT NULL DEFAULT 0,
        pay_frequency TEXT NOT NULL DEFAULT 'monthly',
        next_payment_due_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        hire_date TEXT,
        payment_notified_for_due_date TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_workers_status ON workers (status);`,
      `CREATE INDEX IF NOT EXISTS idx_workers_next_due_date ON workers (next_payment_due_date);`,

      `CREATE TABLE IF NOT EXISTS worker_payments (
        id TEXT PRIMARY KEY NOT NULL,
        worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        financial_log_id TEXT REFERENCES financial_logs(id) ON DELETE SET NULL,
        amount REAL NOT NULL,
        due_date TEXT NOT NULL,
        paid_date TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        period_label TEXT,
        notes TEXT,
        notified_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_worker_payments_worker_id ON worker_payments (worker_id);`,
      `CREATE INDEX IF NOT EXISTS idx_worker_payments_status ON worker_payments (status);`,
      `CREATE INDEX IF NOT EXISTS idx_worker_payments_due_date ON worker_payments (due_date);`,

      `CREATE TABLE IF NOT EXISTS worker_tasks (
        id TEXT PRIMARY KEY NOT NULL,
        worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        livestock_id TEXT REFERENCES livestock(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'pending',
        due_date TEXT,
        completed_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_worker_tasks_worker_id ON worker_tasks (worker_id);`,
      `CREATE INDEX IF NOT EXISTS idx_worker_tasks_status ON worker_tasks (status);`,
      `CREATE INDEX IF NOT EXISTS idx_worker_tasks_due_date ON worker_tasks (due_date);`,
    ],
  },
  {
    id: '0006_ownerships_network_cloud',
    statements: [
      `CREATE TABLE IF NOT EXISTS farm_accounts (
        id TEXT PRIMARY KEY NOT NULL,
        display_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        role TEXT NOT NULL DEFAULT 'family_member',
        relationship TEXT,
        avatar_key TEXT NOT NULL DEFAULT 'farmer',
        access_code TEXT,
        is_primary_admin INTEGER NOT NULL DEFAULT 0,
        can_manage_network INTEGER NOT NULL DEFAULT 0,
        can_sync_cloud INTEGER NOT NULL DEFAULT 1,
        permissions_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        last_synced_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_farm_accounts_role ON farm_accounts (role);`,
      `CREATE INDEX IF NOT EXISTS idx_farm_accounts_status ON farm_accounts (status);`,

      `CREATE TABLE IF NOT EXISTS animal_ownerships (
        id TEXT PRIMARY KEY NOT NULL,
        livestock_id TEXT NOT NULL REFERENCES livestock(id) ON DELETE CASCADE,
        owner_name TEXT NOT NULL,
        owner_contact TEXT,
        account_id TEXT,
        ownership_category TEXT NOT NULL DEFAULT 'external_boarded',
        share_percentage REAL NOT NULL DEFAULT 100,
        purpose TEXT,
        start_date TEXT NOT NULL,
        expected_end_date TEXT,
        boarding_fee REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        notes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_animal_ownerships_livestock_id ON animal_ownerships (livestock_id);`,
      `CREATE INDEX IF NOT EXISTS idx_animal_ownerships_account_id ON animal_ownerships (account_id);`,
      `CREATE INDEX IF NOT EXISTS idx_animal_ownerships_category ON animal_ownerships (ownership_category);`,
      `CREATE INDEX IF NOT EXISTS idx_animal_ownerships_status ON animal_ownerships (status);`,

      `CREATE TABLE IF NOT EXISTS cloud_sync_logs (
        id TEXT PRIMARY KEY NOT NULL,
        direction TEXT NOT NULL,
        status TEXT NOT NULL,
        records_pushed INTEGER NOT NULL DEFAULT 0,
        records_pulled INTEGER NOT NULL DEFAULT 0,
        summary TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_cloud_sync_logs_created_at ON cloud_sync_logs (created_at);`,
    ],
  },
  {
    id: '0007_livestock_sex',
    statements: [
      `ALTER TABLE livestock ADD COLUMN sex TEXT NOT NULL DEFAULT 'female';`,
      `CREATE INDEX IF NOT EXISTS idx_livestock_sex ON livestock (sex);`,
      `UPDATE livestock
       SET sex = 'male'
       WHERE upper(tag_number) LIKE 'BULL-%'
          OR upper(tag_number) LIKE 'RAM-%'
          OR upper(tag_number) LIKE 'BUCK-%'
          OR upper(tag_number) LIKE 'DRAKE-%'
          OR id IN (SELECT DISTINCT sire_id FROM livestock WHERE sire_id IS NOT NULL);`,
    ],
  },
  {
    id: '0008_admin_cloud_credentials',
    statements: [
      `ALTER TABLE farm_accounts ADD COLUMN supabase_url TEXT;`,
      `ALTER TABLE farm_accounts ADD COLUMN supabase_anon_key TEXT;`,
      `ALTER TABLE farm_accounts ADD COLUMN cloud_workspace_id TEXT;`,
    ],
  },
];
