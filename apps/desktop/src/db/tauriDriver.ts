import { invoke } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';
import {
  convertQuestionPlaceholdersToDollar,
  type SqlDriver,
  type SqlRunResult,
} from '@farmdb/db';

export interface TauriSqlController {
  driver: SqlDriver;
  getConnectionString(): string;
  close(): Promise<void>;
  reopen(): Promise<void>;
  reloadAtPath(newDbPath: string): Promise<void>;
}

/**
 * Wraps `@tauri-apps/plugin-sql` (SQLite via Rust `sqlx`) in the shared
 * `@farmdb/db` `SqlDriver` contract, translating `?` placeholders to `$n`,
 * serializing operations, managing read-only disk protection between writes,
 * and exposing close/reopen/relocate lifecycle controls.
 */
export async function createTauriSqliteController(
  initialConnectionString = 'sqlite:farmdb.db'
): Promise<TauriSqlController> {
  let currentConnStr = initialConnectionString;
  if (!initialConnectionString || initialConnectionString === 'sqlite:farmdb.db') {
    try {
      const preparedPath = await invoke<string>('prepare_sqlite_storage');
      if (preparedPath && preparedPath.trim()) {
        currentConnStr = `sqlite:${preparedPath}`;
      }
    } catch {
      // Fall back to default connection string if running outside Tauri commands.
    }
  }

  let db: Database | null = await Database.load(currentConnStr);
  await invoke('set_sqlite_write_lock', { locked: true }).catch(() => {});

  let pendingWrites = 0;
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
      pendingWrites += 1;
      return enqueue(async () => {
        if (!db) {
          throw new Error('SQLite connection is currently closed.');
        }
        await invoke('set_sqlite_write_lock', { locked: false }).catch(
          () => {}
        );
        return db.execute(translated, params).then((result) => ({
          rowsAffected: result.rowsAffected,
          lastInsertId: result.lastInsertId,
        }));
      }).finally(async () => {
        pendingWrites = Math.max(0, pendingWrites - 1);
        if (pendingWrites === 0 && db) {
          await enqueue(async () => {
            if (pendingWrites === 0 && db) {
              try {
                await db.execute('PRAGMA wal_checkpoint(PASSIVE);');
              } catch {
                // Non-fatal in DELETE journal mode.
              }
              await invoke('set_sqlite_write_lock', { locked: true }).catch(
                () => {}
              );
            }
          });
        }
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
    getConnectionString(): string {
      return currentConnStr;
    },
    close(): Promise<void> {
      return enqueue(async () => {
        if (db) {
          await db.close(currentConnStr);
          db = null;
        }
      });
    },
    reopen(): Promise<void> {
      return enqueue(async () => {
        if (!db) {
          await invoke('prepare_sqlite_storage').catch(() => {});
          db = await Database.load(currentConnStr);
          await invoke('set_sqlite_write_lock', { locked: true }).catch(
            () => {}
          );
        }
      });
    },
    reloadAtPath(newDbPath: string): Promise<void> {
      return enqueue(async () => {
        if (db) {
          await db.close(currentConnStr);
          db = null;
        }
        currentConnStr = `sqlite:${newDbPath}`;
        await invoke('prepare_sqlite_storage').catch(() => {});
        db = await Database.load(currentConnStr);
        await invoke('set_sqlite_write_lock', { locked: true }).catch(() => {});
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
