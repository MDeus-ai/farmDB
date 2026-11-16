import type { SqlDriver } from './driver';
import { FARMDB_MIGRATIONS } from './migrations';

export async function runMigrations(driver: SqlDriver): Promise<string[]> {
  await driver.execute('PRAGMA foreign_keys = ON;');
  await driver.execute(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY NOT NULL,
      applied_at INTEGER NOT NULL
    );`
  );

  const appliedRows = await driver.select<{ id: string }>(
    'SELECT id FROM schema_migrations'
  );
  const appliedIds = new Set(appliedRows.map((row) => row.id));
  const newlyApplied: string[] = [];

  for (const migration of FARMDB_MIGRATIONS) {
    if (appliedIds.has(migration.id)) {
      continue;
    }

    const applyStatements = async () => {
      for (const stmt of migration.statements) {
        await driver.execute(stmt);
      }
      await driver.execute(
        'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)',
        [migration.id, Date.now()]
      );
    };

    if (driver.transaction) {
      await driver.transaction(applyStatements);
    } else {
      await applyStatements();
    }

    newlyApplied.push(migration.id);
  }

  return newlyApplied;
}
