import Database from '@tauri-apps/plugin-sql';
import {
  convertQuestionPlaceholdersToDollar,
  type SqlDriver,
  type SqlRunResult,
} from '@farmdb/db';

export interface TauriSqlController {
  driver: SqlDriver;
  close(): Promise<void>;
  reopen(): Promise<void>;
}

/**
 * Wraps `@tauri-apps/plugin-sql` (SQLite via Rust `sqlx`) in the shared
 * `@farmdb/db` `SqlDriver` contract, translating `?` placeholders to `$n`,
 * serializing operations, and exposing close/reopen lifecycle controls for
 * single-file `.db` backup and restore.
 */
export async function createTauriSqliteController(
  connectionString = 'sqlite:farmdb.db'
): Promise<TauriSqlController> {
  let db: Database | null = await Database.load(connectionString);
  let queue: Promise<void> = Promise.resolve();

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  const driver: SqlDriver = {
    kind: 'tauri-sqlite',
    execute(sql: string, params: unknown[] = []): Promise<SqlRunResult> {
      const translated = convertQuestionPlaceholdersToDollar(sql);
      return enqueue(async () => {
        if (!db) {
          throw new Error('SQLite connection is currently closed.');
        }
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
        if (!db) {
          throw new Error('SQLite connection is currently closed.');
        }
        return db.select<T[]>(translated, params);
      });
    },
  };

  return {
    driver,
    close(): Promise<void> {
      return enqueue(async () => {
        if (db) {
          await db.close(connectionString);
          db = null;
        }
      });
    },
    reopen(): Promise<void> {
      return enqueue(async () => {
        if (!db) {
          db = await Database.load(connectionString);
        }
      });
    },
  };
}

export async function createTauriSqliteDriver(
  connectionString = 'sqlite:farmdb.db'
): Promise<SqlDriver> {
  const controller = await createTauriSqliteController(connectionString);
  return controller.driver;
}
