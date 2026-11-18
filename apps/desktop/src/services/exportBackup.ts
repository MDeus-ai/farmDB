import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import {
  buildAllCsvExports,
  exportCsvByTable,
  getTodayIsoDate,
  parseFarmSnapshotJson,
  serializeFarmSnapshotJson,
  type ExportTableKey,
  type FarmDbSnapshot,
} from '@farmdb/core';
import { runMigrations, type SqlDriver } from '@farmdb/db';
import type { TauriSqlController } from '../db/tauriDriver';
import { isTauriEnvironment } from './imageStorage';

function triggerBrowserDownload(
  filename: string,
  content: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export async function exportSnapshotAsJson(
  snapshot: FarmDbSnapshot
): Promise<string | null> {
  const content = serializeFarmSnapshotJson(snapshot);
  const defaultName = `farmdb-export-${getTodayIsoDate()}.json`;

  if (!isTauriEnvironment()) {
    triggerBrowserDownload(defaultName, content, 'application/json');
    return defaultName;
  }

  const destPath = await save({
    title: 'Export farmDB Data as JSON',
    defaultPath: defaultName,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (!destPath) {
    return null;
  }

  await invoke('write_text_export_file', { destPath, content });
  return destPath;
}

export async function exportTableAsCsv(
  snapshot: FarmDbSnapshot,
  table: ExportTableKey
): Promise<string | null> {
  const content = exportCsvByTable(snapshot, table);
  const defaultName = `farmdb-${table}-${getTodayIsoDate()}.csv`;

  if (!isTauriEnvironment()) {
    triggerBrowserDownload(defaultName, content, 'text/csv;charset=utf-8');
    return defaultName;
  }

  const destPath = await save({
    title: `Export ${table} CSV`,
    defaultPath: defaultName,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (!destPath) {
    return null;
  }

  await invoke('write_text_export_file', { destPath, content });
  return destPath;
}

export async function exportAllTablesAsCsvBundle(
  snapshot: FarmDbSnapshot
): Promise<string[] | null> {
  const bundle = buildAllCsvExports(snapshot);
  const entries = Object.entries(bundle) as Array<[string, string]>;
  const today = getTodayIsoDate();

  if (!isTauriEnvironment()) {
    for (const [filename, content] of entries) {
      triggerBrowserDownload(
        `farmdb-${today}-${filename}`,
        content,
        'text/csv;charset=utf-8'
      );
    }
    return entries.map(([name]) => name);
  }

  const selectedFolder = await open({
    title: 'Choose Folder for farmDB CSV Export',
    directory: true,
    multiple: false,
  });

  if (!selectedFolder || typeof selectedFolder !== 'string') {
    return null;
  }

  return invoke<string[]>('write_csv_export_bundle', {
    folderPath: selectedFolder,
    subfolderName: `farmdb-csv-${today}`,
    files: entries,
  });
}

export async function pickAndParseJsonSnapshot(): Promise<FarmDbSnapshot | null> {
  if (!isTauriEnvironment()) {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        try {
          const text = await file.text();
          resolve(parseFarmSnapshotJson(text));
        } catch (err) {
          reject(err);
        }
      };
      input.click();
    });
  }

  const sourcePath = await open({
    title: 'Select farmDB JSON Export File',
    multiple: false,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });

  if (!sourcePath || typeof sourcePath !== 'string') {
    return null;
  }

  const raw = await invoke<string>('read_text_import_file', { sourcePath });
  return parseFarmSnapshotJson(raw);
}

export interface SqliteStorageInfo {
  dbPath: string;
  defaultDbPath: string;
  storageDir: string;
  isCustomLocation: boolean;
  readOnlyProtection: boolean;
  isFileReadOnly: boolean;
  fileSizeBytes: number;
}

export async function getDesktopSqlitePath(): Promise<string | null> {
  if (!isTauriEnvironment()) {
    return null;
  }
  return invoke<string>('get_sqlite_db_path');
}

export async function getDesktopSqliteStorageInfo(): Promise<SqliteStorageInfo | null> {
  if (!isTauriEnvironment()) {
    return null;
  }
  return invoke<SqliteStorageInfo>('get_sqlite_storage_info');
}

export async function setDesktopSqliteReadOnlyProtection(
  enabled: boolean
): Promise<SqliteStorageInfo> {
  if (!isTauriEnvironment()) {
    throw new Error(
      'Native SQLite storage protection is available in the Tauri desktop app.'
    );
  }
  return invoke<SqliteStorageInfo>('set_sqlite_readonly_protection', {
    enabled,
  });
}

export async function relocateDesktopSqliteStorage(
  controller: TauriSqlController
): Promise<SqliteStorageInfo | null> {
  if (!isTauriEnvironment()) {
    throw new Error(
      'SQLite storage location can be changed in the Tauri desktop app.'
    );
  }

  const targetDir = await open({
    title: 'Choose Folder for Native SQLite Database (farmdb.db)',
    directory: true,
    multiple: false,
  });

  if (!targetDir || typeof targetDir !== 'string') {
    return null;
  }

  try {
    await controller.driver.execute('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch {
    // Ignore if database is not using WAL journal mode.
  }

  await controller.close();
  try {
    const info = await invoke<SqliteStorageInfo>('relocate_sqlite_storage', {
      targetDir,
    });
    await controller.reloadAtPath(info.dbPath);
    await runMigrations(controller.driver);
    return info;
  } catch (err) {
    await controller.reopen();
    throw err;
  }
}

export async function resetDesktopSqliteStorage(
  controller: TauriSqlController
): Promise<SqliteStorageInfo> {
  if (!isTauriEnvironment()) {
    throw new Error(
      'SQLite storage location can be changed in the Tauri desktop app.'
    );
  }

  try {
    await controller.driver.execute('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch {
    // Ignore if database is not using WAL journal mode.
  }

  await controller.close();
  try {
    const info = await invoke<SqliteStorageInfo>(
      'reset_sqlite_storage_location'
    );
    await controller.reloadAtPath(info.dbPath);
    await runMigrations(controller.driver);
    return info;
  } catch (err) {
    await controller.reopen();
    throw err;
  }
}

export async function backupDesktopSqliteFile(
  driver: SqlDriver
): Promise<string | null> {
  if (!isTauriEnvironment()) {
    throw new Error(
      'Raw .db file backup is available in the Tauri desktop app (npm run dev:tauri).'
    );
  }

  const destPath = await save({
    title: 'Save SQLite Database Backup (.db)',
    defaultPath: `farmdb-backup-${getTodayIsoDate()}.db`,
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
  });

  if (!destPath) {
    return null;
  }

  try {
    await driver.execute('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch {
    // Proceed even if database is in DELETE journal mode.
  }

  return invoke<string>('copy_sqlite_backup', { destPath });
}

export async function restoreDesktopSqliteFile(
  controller: TauriSqlController
): Promise<string | null> {
  if (!isTauriEnvironment()) {
    throw new Error(
      'Raw .db file restore is available in the Tauri desktop app (npm run dev:tauri).'
    );
  }

  const sourcePath = await open({
    title: 'Restore SQLite Database Backup (.db)',
    multiple: false,
    filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }],
  });

  if (!sourcePath || typeof sourcePath !== 'string') {
    return null;
  }

  await invoke<number>('validate_sqlite_backup_file', { sourcePath });

  await controller.close();
  try {
    const restoredPath = await invoke<string>('replace_sqlite_db_from_backup', {
      sourcePath,
    });
    await controller.reopen();
    await runMigrations(controller.driver);
    return restoredPath;
  } catch (err) {
    await controller.reopen();
    throw err;
  }
}
