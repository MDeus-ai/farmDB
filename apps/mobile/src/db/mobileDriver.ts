import { File } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { runMigrations, type SqlDriver, type SqlRunResult } from '@farmdb/db';

const SQLITE_MAGIC_BYTES = [
  0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66,
  0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00,
] as const;

export function hasValidSqliteHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 100) {
    return false;
  }
  for (let i = 0; i < SQLITE_MAGIC_BYTES.length; i += 1) {
    if (bytes[i] !== SQLITE_MAGIC_BYTES[i]) {
      return false;
    }
  }
  return true;
}

export interface ExpoSqlController {
  driver: SqlDriver;
  getDatabasePath(): string;
  serializeDatabaseBytes(): Promise<Uint8Array>;
  restoreDatabaseBytes(bytes: Uint8Array): Promise<void>;
}

/**
 * Wraps Expo's `expo-sqlite` async API into the shared `@farmdb/db` `SqlDriver`
 * interface, serializing write operations cleanly and exposing `.db` backup
 * and restore helpers.
 */
async function configureNativeDatabase(database: SQLite.SQLiteDatabase) {
  if (Platform.OS !== 'web') {
    try {
      await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    } catch {
      // Non-fatal if pragmas are unsupported on the current runtime.
    }
  }
}

export async function createExpoSqliteController(
  databaseName = 'farmdb.db'
): Promise<ExpoSqlController> {
  let db = await SQLite.openDatabaseAsync(databaseName);
  await configureNativeDatabase(db);
  let inTransaction = false;
  let queue: Promise<void> = Promise.resolve();

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  function runLocked<T>(task: () => Promise<T>): Promise<T> {
    return inTransaction ? task() : enqueue(task);
  }

  const driver: SqlDriver = {
    kind: 'expo-sqlite',
    execute(sql: string, params: unknown[] = []): Promise<SqlRunResult> {
      return runLocked(async () => {
        const result = await db.runAsync(
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
      return runLocked(async () => {
        return db.getAllAsync<T>(
          sql,
          params as SQLite.SQLiteBindParams
        );
      });
    },
    transaction<T>(fn: () => Promise<T>): Promise<T> {
      if (inTransaction) {
        return fn();
      }
      return enqueue(async () => {
        inTransaction = true;
        try {
          await db.execAsync('BEGIN');
          const result = await fn();
          await db.execAsync('COMMIT');
          return result;
        } catch (err) {
          try {
            await db.execAsync('ROLLBACK');
          } catch {
            // Preserve the original failure if SQLite already rolled back.
          }
          throw err;
        } finally {
          inTransaction = false;
        }
      });
    },
  };

  return {
    driver,
    getDatabasePath(): string {
      return db.databasePath;
    },
    serializeDatabaseBytes(): Promise<Uint8Array> {
      return enqueue(() => db.serializeAsync());
    },
    async restoreDatabaseBytes(bytes: Uint8Array): Promise<void> {
      if (!hasValidSqliteHeader(bytes)) {
        throw new Error('Selected file is not a valid SQLite 3 database (.db).');
      }
      if (Platform.OS === 'web') {
        throw new Error(
          'Binary .db file replacement is supported on iOS/Android devices. On web, use JSON Export/Restore.'
        );
      }

      await enqueue(async () => {
        const dbFilePath = db.databasePath;
        await db.closeAsync();

        try {
          for (const suffix of ['-wal', '-shm']) {
            const sidecar = new File(`${dbFilePath}${suffix}`);
            if (sidecar.exists) {
              sidecar.delete();
            }
          }

          const targetFile = new File(dbFilePath);
          targetFile.create({ intermediates: true, overwrite: true });
          await targetFile.write(bytes);
        } finally {
          db = await SQLite.openDatabaseAsync(databaseName);
          await configureNativeDatabase(db);
        }
      });

      await runMigrations(driver);
    },
  };
}

export async function createExpoSqliteDriver(
  databaseName = 'farmdb.db'
): Promise<SqlDriver> {
  const controller = await createExpoSqliteController(databaseName);
  return controller.driver;
}
