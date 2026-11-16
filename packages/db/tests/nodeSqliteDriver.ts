import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SqlDriver } from '../src/index';

export function createNodeSqliteDriver(filename = ':memory:'): {
  driver: SqlDriver;
  raw: DatabaseSync;
} {
  const raw = new DatabaseSync(filename);

  const driver: SqlDriver = {
    kind: 'node-sqlite',
    async execute(sqlText: string, params: unknown[] = []) {
      const stmt = raw.prepare(sqlText);
      const result = stmt.run(...(params as SQLInputValue[]));
      return {
        rowsAffected: Number(result.changes ?? 0),
        lastInsertId:
          result.lastInsertRowid !== undefined
            ? Number(result.lastInsertRowid)
            : undefined,
      };
    },
    async select<T extends Record<string, unknown>>(
      sqlText: string,
      params: unknown[] = []
    ): Promise<T[]> {
      const stmt = raw.prepare(sqlText);
      return stmt.all(...(params as SQLInputValue[])) as T[];
    },
    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      raw.exec('BEGIN IMMEDIATE');
      try {
        const result = await fn();
        raw.exec('COMMIT');
        return result;
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      }
    },
  };

  return { driver, raw };
}
