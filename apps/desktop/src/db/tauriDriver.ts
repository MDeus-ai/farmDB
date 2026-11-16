import Database from '@tauri-apps/plugin-sql';
import {
  convertQuestionPlaceholdersToDollar,
  type SqlDriver,
  type SqlRunResult,
} from '@farmdb/db';

/**
 * Wraps `@tauri-apps/plugin-sql` (SQLite via Rust `sqlx`) in the shared
 * `@farmdb/db` `SqlDriver` contract, translating `?` placeholders to `$n`
 * and serializing operations through an async queue.
 */
export async function createTauriSqliteDriver(
  connectionString = 'sqlite:farmdb.db'
): Promise<SqlDriver> {
  const db = await Database.load(connectionString);
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
    kind: 'tauri-sqlite',
    execute(sql: string, params: unknown[] = []): Promise<SqlRunResult> {
      const translated = convertQuestionPlaceholdersToDollar(sql);
      return enqueue(async () => {
        const result = await db.execute(translated, params);
        return {
          rowsAffected: result.rowsAffected,
          lastInsertId: result.lastInsertId,
        };
      });
    },
    select<T extends Record<string, unknown>>(
      sql: string,
      params: unknown[] = []
    ): Promise<T[]> {
      const translated = convertQuestionPlaceholdersToDollar(sql);
      return enqueue(async () => {
        return db.select<T[]>(translated, params);
      });
    },
  };
}
