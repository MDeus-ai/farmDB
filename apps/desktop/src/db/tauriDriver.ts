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
  await db.execute('PRAGMA busy_timeout = 5000;').catch(() => {});

  let queue: Promise<void> = Promise.resolve();
  let shadowTimer: ReturnType<typeof setTimeout> | null = null;

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  function scheduleShadowBackupRefresh() {
    if (shadowTimer) {
      clearTimeout(shadowTimer);
    }
    shadowTimer = setTimeout(() => {
      shadowTimer = null;
      void enqueue(async () => {
        if (!db) return;
        try {
          await db.execute('PRAGMA wal_checkpoint(PASSIVE);');
        } catch {
          // Non-fatal in DELETE journal mode.
        }
        await invoke('set_sqlite_write_lock', { locked: true }).catch(() => {});
      });
    }, 700);
  }

  const isReadonlyError = (err: unknown): boolean => {
    const msg = err instanceof Error ? err.message : String(err);
    return /readonly|read-only|code:\s*(?:8|1032)\b/i.test(msg);
  };

  const driver: SqlDriver = {
    kind: 'tauri-sqlite',
    execute(sql: string, params: unknown[] = []): Promise<SqlRunResult> {
      const translated = convertQuestionPlaceholdersToDollar(sql);
      return enqueue(async () => {
        if (!db) {
          throw new Error('SQLite connection is currently closed.');
        }
        await invoke('set_sqlite_write_lock', { locked: false }).catch(
          () => {}
        );
        try {
          const result = await db.execute(translated, params);
          scheduleShadowBackupRefresh();
          return {
            rowsAffected: result.rowsAffected,
            lastInsertId: result.lastInsertId,
          };
        } catch (err) {
          if (!isReadonlyError(err)) {
            throw err;
          }
          // Recover from any pooled connection that opened read-only while the
          // file was locked: close the pool, unlock the file, reopen, and retry once.
          await db.close(currentConnStr).catch(() => {});
          db = null;
          await invoke('prepare_sqlite_storage').catch(() => {});
          db = await Database.load(currentConnStr);
          await db.execute('PRAGMA busy_timeout = 5000;').catch(() => {});
          const retried = await db.execute(translated, params);
          scheduleShadowBackupRefresh();
          return {
            rowsAffected: retried.rowsAffected,
            lastInsertId: retried.lastInsertId,
          };
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
        if (shadowTimer) {
          clearTimeout(shadowTimer);
          shadowTimer = null;
        }
        if (db) {
          await db.close(currentConnStr);
          db = null;
        }
        await invoke('lock_sqlite_on_close').catch(() => {});
      });
    },
    reopen(): Promise<void> {
      return enqueue(async () => {
        if (!db) {
          await invoke('prepare_sqlite_storage').catch(() => {});
          db = await Database.load(currentConnStr);
          await db.execute('PRAGMA busy_timeout = 5000;').catch(() => {});
        }
      });
    },
    reloadAtPath(newDbPath: string): Promise<void> {
      return enqueue(async () => {
        if (shadowTimer) {
          clearTimeout(shadowTimer);
          shadowTimer = null;
        }
        if (db) {
          await db.close(currentConnStr);
          db = null;
        }
        currentConnStr = `sqlite:${newDbPath}`;
        await invoke('prepare_sqlite_storage').catch(() => {});
        db = await Database.load(currentConnStr);
        await db.execute('PRAGMA busy_timeout = 5000;').catch(() => {});
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
