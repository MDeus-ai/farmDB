import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import type { SqlDriver, SqlRunResult } from '@farmdb/db';

/**
 * Wraps Expo's `expo-sqlite` async API into the shared `@farmdb/db` `SqlDriver`
 * interface, serializing write operations cleanly over a local queue.
 */
export async function createExpoSqliteDriver(
  databaseName = 'farmdb.db'
): Promise<SqlDriver> {
  const db = await SQLite.openDatabaseAsync(databaseName);
  let activeExecutor: SQLite.SQLiteDatabase = db;
  let queue: Promise<void> = Promise.resolve();

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  return {
    kind: 'expo-sqlite',
    execute(sql: string, params: unknown[] = []): Promise<SqlRunResult> {
      return enqueue(async () => {
        const result = await activeExecutor.runAsync(
          sql,
          params as SQLite.SQLiteBindParams
        );
        return {
          rowsAffected: result.changes,
          lastInsertId: result.lastInsertRowId,
        };
      });
    },
    select<T extends Record<string, unknown>>(
      sql: string,
      params: unknown[] = []
    ): Promise<T[]> {
      return enqueue(async () => {
        return activeExecutor.getAllAsync<T>(
          sql,
          params as SQLite.SQLiteBindParams
        );
      });
    },
    transaction<T>(fn: () => Promise<T>): Promise<T> {
      if (Platform.OS === 'web') {
        return enqueue(async () => {
          let result!: T;
          await db.withTransactionAsync(async () => {
            result = await fn();
          });
          return result;
        });
      }

      let result!: T;
      return db
        .withExclusiveTransactionAsync(async (txn) => {
          const prev = activeExecutor;
          activeExecutor = txn;
          try {
            result = await fn();
          } finally {
            activeExecutor = prev;
          }
        })
        .then(() => result);
    },
  };
}
