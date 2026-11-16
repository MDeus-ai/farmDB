import { drizzle, type SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { schema, type FarmDbSchema } from './schema';
import { extractProjectedColumns, mapRowObjectToValues } from './sqlHelpers';

export interface SqlRunResult {
  rowsAffected: number;
  lastInsertId?: number;
}

export type SqlDriverKind =
  | 'tauri-sqlite'
  | 'expo-sqlite'
  | 'node-sqlite'
  | 'memory-fallback';

export interface SqlDriver {
  readonly kind: SqlDriverKind;
  execute(sql: string, params?: unknown[]): Promise<SqlRunResult>;
  select<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  execScript?(script: string): Promise<void>;
  transaction?<T>(fn: () => Promise<T>): Promise<T>;
}

export type FarmDrizzleDb = SqliteRemoteDatabase<FarmDbSchema>;

export function createDrizzleClient(driver: SqlDriver): FarmDrizzleDb {
  return drizzle(
    async (sql, params, method) => {
      if (method === 'run') {
        await driver.execute(sql, params);
        return { rows: [] };
      }

      const rows = await driver.select<Record<string, unknown>>(sql, params);
      const projectedColumns = extractProjectedColumns(sql);

      if (method === 'get') {
        const first = rows[0];
        if (!first) {
          // drizzle-orm/sqlite-proxy checks `if (!row)` in mapGetResult
          return { rows: undefined as unknown as unknown[] };
        }
        return { rows: mapRowObjectToValues(first, projectedColumns) };
      }

      return {
        rows: rows.map((row) => mapRowObjectToValues(row, projectedColumns)),
      };
    },
    { schema }
  );
}
