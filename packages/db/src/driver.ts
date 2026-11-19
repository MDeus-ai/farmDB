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

export function extractDatabaseErrorCause(err: unknown): string {
  const messages: string[] = [];
  let current: unknown = err;
  for (
    let depth = 0;
    depth < 4 && current !== null && current !== undefined;
    depth += 1
  ) {
    if (current instanceof Error) {
      if (current.message && current.message.trim()) {
        messages.push(current.message.trim());
      }
      current = (current as { cause?: unknown }).cause;
    } else if (typeof current === 'string') {
      if (current.trim()) {
        messages.push(current.trim());
      }
      break;
    } else {
      try {
        const serialized = JSON.stringify(current);
        if (serialized && serialized !== '{}') {
          messages.push(serialized);
        }
      } catch {
        // Ignore unserializable error objects
      }
      break;
    }
  }
  const unique = Array.from(new Set(messages));
  return unique.length > 0 ? unique.join(' | ') : 'Unknown database error.';
}

export function formatFriendlyDatabaseError(err: unknown): Error {
  const fullChain = extractDatabaseErrorCause(err);
  const lower = fullChain.toLowerCase();

  if (/readonly|read-only|code:\s*(?:8|1032)\b/i.test(fullChain)) {
    return new Error(
      'Unable to save because the local SQLite database file was marked read-only. Click Refresh or restart farmDB to unlock writes.'
    );
  }
  if (lower.includes('unique constraint') || lower.includes('unique failed')) {
    return new Error('A record with this unique value already exists.');
  }
  if (lower.includes('foreign key constraint')) {
    return new Error(
      'A linked parent or referenced record could not be found in the database.'
    );
  }
  if (/database is locked|sqlite_busy|busy/i.test(fullChain)) {
    return new Error(
      'The local SQLite database is temporarily busy. Please wait a moment and try again.'
    );
  }

  const segments = fullChain
    .split(' | ')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^failed query:/i.test(s));
  if (segments.length > 0) {
    return new Error(segments[segments.length - 1]);
  }
  return new Error(
    'Unable to save record to the local database. Please verify your inputs or click Refresh and try again.'
  );
}

function isMissingSchemaError(err: unknown): boolean {
  const msg = extractDatabaseErrorCause(err);
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
