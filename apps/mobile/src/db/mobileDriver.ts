import { Directory, File, Paths } from 'expo-file-system';
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

export interface MobileStorageInfo {
  dbPath: string;
  storageDir: string;
  readOnlyProtection: boolean;
  isProtectedCopyAvailable: boolean;
  fileSizeBytes: number;
}

export interface ExpoSqlController {
  driver: SqlDriver;
  getDatabasePath(): string;
  getStorageInfo(): Promise<MobileStorageInfo>;
  setReadOnlyProtection(enabled: boolean): Promise<MobileStorageInfo>;
  serializeDatabaseBytes(): Promise<Uint8Array>;
  restoreDatabaseBytes(bytes: Uint8Array): Promise<void>;
}

const PROTECTED_DIR_NAME = 'farmdb-protected';
const STORAGE_CONFIG_FILE = 'storage-config.json';
const SHADOW_DB_FILE = 'farmdb.verified.db';

function getProtectedDir(): Directory {
  return new Directory(Paths.document, PROTECTED_DIR_NAME);
}

async function loadMobileReadOnlyConfig(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  try {
    const cfgFile = new File(getProtectedDir(), STORAGE_CONFIG_FILE);
    if (!cfgFile.exists) return true;
    const raw = await cfgFile.text();
    const parsed = JSON.parse(raw) as { readOnlyProtection?: unknown };
    return typeof parsed.readOnlyProtection === 'boolean'
      ? parsed.readOnlyProtection
      : true;
  } catch {
    return true;
  }
}

async function saveMobileReadOnlyConfig(enabled: boolean): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const dir = getProtectedDir();
    dir.create({ intermediates: true, idempotent: true });
    const cfgFile = new File(dir, STORAGE_CONFIG_FILE);
    cfgFile.create({ intermediates: true, overwrite: true });
    await cfgFile.write(JSON.stringify({ readOnlyProtection: enabled }));
  } catch {
    // Non-fatal if storage config could not be persisted.
  }
}

async function applyQueryOnlyLock(
  database: SQLite.SQLiteDatabase,
  locked: boolean
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await database.execAsync(
      locked ? 'PRAGMA query_only = ON;' : 'PRAGMA query_only = OFF;'
    );
  } catch {
    // Non-fatal if PRAGMA query_only is unsupported on current runtime.
  }
}

/**
 * Wraps Expo's `expo-sqlite` async API into the shared `@farmdb/db` `SqlDriver`
 * interface, serializing write operations cleanly, managing `query_only` lock
 * & verified shadow copy, and exposing `.db` backup and restore helpers.
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
  let readOnlyProtection = await loadMobileReadOnlyConfig();
  await applyQueryOnlyLock(db, readOnlyProtection);
  let inTransaction = false;
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

  function runLocked<T>(task: () => Promise<T>): Promise<T> {
    return inTransaction ? task() : enqueue(task);
  }

  async function refreshShadowCopy(): Promise<void> {
    if (Platform.OS === 'web' || !readOnlyProtection) return;
    try {
      const bytes = await db.serializeAsync();
      if (!hasValidSqliteHeader(bytes)) return;
      const dir = getProtectedDir();
      dir.create({ intermediates: true, idempotent: true });
      const shadowFile = new File(dir, SHADOW_DB_FILE);
      shadowFile.create({ intermediates: true, overwrite: true });
      await shadowFile.write(bytes);
    } catch {
      // Non-fatal shadow backup warning.
    }
  }

  function scheduleShadowRefresh() {
    if (Platform.OS === 'web' || !readOnlyProtection) return;
    if (shadowTimer) clearTimeout(shadowTimer);
    shadowTimer = setTimeout(() => {
      shadowTimer = null;
      void enqueue(() => refreshShadowCopy());
    }, 900);
  }

  async function buildMobileStorageInfo(): Promise<MobileStorageInfo> {
    const dbPath = db.databasePath || databaseName;
    const slashIdx = dbPath.lastIndexOf('/');
    const storageDir =
      Platform.OS === 'web'
        ? 'Browser Web SQLite Sandbox'
        : slashIdx > 0
          ? dbPath.slice(0, slashIdx)
          : 'App SQLite Directory';
    let fileSizeBytes = 0;
    let isProtectedCopyAvailable = false;

    if (Platform.OS !== 'web') {
      try {
        const dbFile = new File(dbPath);
        if (dbFile.exists) {
          fileSizeBytes = dbFile.size ?? 0;
        }
      } catch {
        // Ignore if database path uses a non-file URI on this platform.
      }
      try {
        const shadowFile = new File(getProtectedDir(), SHADOW_DB_FILE);
        isProtectedCopyAvailable = shadowFile.exists;
      } catch {
        isProtectedCopyAvailable = false;
      }
    }

    return {
      dbPath,
      storageDir,
      readOnlyProtection,
      isProtectedCopyAvailable,
      fileSizeBytes,
    };
  }

  const driver: SqlDriver = {
    kind: 'expo-sqlite',
    execute(sql: string, params: unknown[] = []): Promise<SqlRunResult> {
      return runLocked(async () => {
        if (!inTransaction && readOnlyProtection) {
          await applyQueryOnlyLock(db, false);
        }
        try {
          const result = await db.runAsync(
            sql,
            params as SQLite.SQLiteBindParams
          );
          if (!inTransaction) {
            scheduleShadowRefresh();
          }
          return {
            rowsAffected: result.changes,
            lastInsertId: result.lastInsertRowId,
          };
        } finally {
          if (!inTransaction && readOnlyProtection) {
            await applyQueryOnlyLock(db, true);
          }
        }
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
        if (readOnlyProtection) {
          await applyQueryOnlyLock(db, false);
        }
        try {
          await db.execAsync('BEGIN');
          const result = await fn();
          await db.execAsync('COMMIT');
          scheduleShadowRefresh();
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
          if (readOnlyProtection) {
            await applyQueryOnlyLock(db, true);
          }
        }
      });
    },
  };

  return {
    driver,
    getDatabasePath(): string {
      return db.databasePath;
    },
    getStorageInfo(): Promise<MobileStorageInfo> {
      return enqueue(() => buildMobileStorageInfo());
    },
    setReadOnlyProtection(enabled: boolean): Promise<MobileStorageInfo> {
      return enqueue(async () => {
        readOnlyProtection = enabled;
        await saveMobileReadOnlyConfig(enabled);
        await applyQueryOnlyLock(db, enabled);
        if (enabled) {
          await refreshShadowCopy();
        }
        return buildMobileStorageInfo();
      });
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
          await applyQueryOnlyLock(db, readOnlyProtection);
        }
      });

      await runMigrations(driver);
      await enqueue(() => refreshShadowCopy());
    },
  };
}

export async function createExpoSqliteDriver(
  databaseName = 'farmdb.db'
): Promise<SqlDriver> {
  const controller = await createExpoSqliteController(databaseName);
  return controller.driver;
}
