import { drizzle, type SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { ensureSchemaReady } from './migrate';
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

function isMissingSchemaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /no such (?:table|column)/i.test(msg);
}

export function createDrizzleClient(driver: SqlDriver): FarmDrizzleDb {
  return drizzle(
    async (sql, params, method) => {
      if (method === 'run') {
        try {
          await driver.execute(sql, params);
        } catch (err) {
          if (isMissingSchemaError(err)) {
            await ensureSchemaReady(driver);
            await driver.execute(sql, params);
          } else {
            throw err;
          }
        }
        return { rows: [] };
      }

      let rows: Record<string, unknown>[];
      try {
        rows = await driver.select<Record<string, unknown>>(sql, params);
      } catch (err) {
        if (isMissingSchemaError(err)) {
          await ensureSchemaReady(driver);
          rows = await driver.select<Record<string, unknown>>(sql, params);
        } else {
          throw err;
        }
      }
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
