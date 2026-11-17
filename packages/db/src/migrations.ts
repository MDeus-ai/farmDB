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
];
