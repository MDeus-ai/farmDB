import { useEffect, useState } from 'react';
import {
  Database as DbIcon,
  Download,
  FileJson,
  FileSpreadsheet,
  FolderOutput,
  HardDriveDownload,
  Upload,
} from 'lucide-react';
import type { ExportTableKey } from '@farmdb/core';
import { useFarmDb, useFarmSummary } from '@farmdb/db';
import type { TauriSqlController } from '../db/tauriDriver';
import {
  backupDesktopSqliteFile,
  exportAllTablesAsCsvBundle,
  exportSnapshotAsJson,
  exportTableAsCsv,
  getDesktopSqlitePath,
  pickAndParseJsonSnapshot,
  restoreDesktopSqliteFile,
} from '../services/exportBackup';
import { isTauriEnvironment } from '../services/imageStorage';

interface BackupViewProps {
  sqlController: TauriSqlController | null;
}

const EXPORT_TABLES: Array<{ key: ExportTableKey; label: string }> = [
  { key: 'livestock', label: 'Livestock Registry' },
  { key: 'product_records', label: 'Milk Production' },
  { key: 'medical_records', label: 'Medical History' },
  { key: 'financial_logs', label: 'Financial Ledger' },
  { key: 'alerts', label: 'Alerts & Notes' },
];

export function BackupView({ sqlController }: BackupViewProps) {
  const { backup, events, driverKind } = useFarmDb();
  const summaryQuery = useFarmSummary();
  const summary = summaryQuery.data;

  const [dbPath, setDbPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void getDesktopSqlitePath()
      .then(setDbPath)
      .catch(() => setDbPath(null));
  }, []);

  async function runAction(task: () => Promise<void>) {
    setBusy(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      await task();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Operation failed.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleExportJson() {
    await runAction(async () => {
      const snapshot = await backup.exportSnapshot();
      const dest = await exportSnapshotAsJson(snapshot);
      if (dest) {
        setStatusMessage(`Exported full JSON backup to ${dest}`);
      }
    });
  }

  async function handleExportAllCsv() {
    await runAction(async () => {
      const snapshot = await backup.exportSnapshot();
      const paths = await exportAllTablesAsCsvBundle(snapshot);
      if (paths) {
        setStatusMessage(`Exported ${paths.length} CSV table files.`);
      }
    });
  }

  async function handleExportTableCsv(table: ExportTableKey) {
    await runAction(async () => {
      const snapshot = await backup.exportSnapshot();
      const dest = await exportTableAsCsv(snapshot, table);
      if (dest) {
        setStatusMessage(`Exported ${table} CSV to ${dest}`);
      }
    });
  }

  async function handleImportJson() {
    await runAction(async () => {
      const snapshot = await pickAndParseJsonSnapshot();
      if (!snapshot) return;
      const counts = await backup.restoreSnapshot(snapshot);
      setStatusMessage(
        `Restored JSON snapshot (${counts.livestockCount} animals, ${counts.productCount} yields, ${counts.medicalCount} medical, ${counts.financialCount} financial, ${counts.alertCount} alerts/notes).`
      );
    });
  }

  async function handleBackupSqlite() {
    if (!sqlController) return;
    await runAction(async () => {
      const dest = await backupDesktopSqliteFile(sqlController.driver);
      if (dest) {
        setStatusMessage(`Saved SQLite .db backup to ${dest}`);
      }
    });
  }

  async function handleRestoreSqlite() {
    if (!sqlController) return;
    await runAction(async () => {
      const restored = await restoreDesktopSqliteFile(sqlController);
      if (restored) {
        events.emit(['*']);
        setStatusMessage(
          `Restored SQLite database from backup and refreshed local ledger.`
        );
      }
    });
  }

  const inTauri = isTauriEnvironment() && driverKind === 'tauri-sqlite';

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Export &amp; Backup</h1>
          <p className="page-subtitle">
            Export portable CSV/JSON spreadsheets or copy and restore your physical SQLite database file.
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-label">Livestock Records</p>
          <p className="stat-value">{summary?.totalLivestock ?? 0}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Production Logs</p>
          <p className="stat-value">{summary?.productRecordCount ?? 0}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Medical &amp; Alerts</p>
          <p className="stat-value">
            {(summary?.medicalRecordCount ?? 0) + (summary?.openAlertCount ?? 0)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Financial Entries</p>
          <p className="stat-value">{summary?.financialLogCount ?? 0}</p>
        </div>
      </div>

      {statusMessage && (
        <div className="alert-toast-banner" role="status">
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="notice-banner" role="alert">
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="split-grid">
        <div className="card">
          <div className="chart-header">
            <div>
              <h2 className="card-section-title" style={{ marginBottom: 2 }}>
                Portable CSV &amp; JSON Export
              </h2>
              <p className="page-subtitle" style={{ fontSize: '0.82rem' }}>
                Download all farm tables for spreadsheets or cross-device transfer
              </p>
            </div>
            <FileSpreadsheet size={18} color="#2d6a4f" />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleExportJson()}
              disabled={busy}
            >
              <FileJson size={16} />
              Export Full JSON
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void handleExportAllCsv()}
              disabled={busy}
            >
              <FolderOutput size={16} />
              Export All CSVs
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void handleImportJson()}
              disabled={busy}
            >
              <Upload size={16} />
              Restore from JSON
            </button>
          </div>

          <p className="form-label" style={{ marginBottom: 8 }}>
            Individual Table CSVs
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {EXPORT_TABLES.map((tbl) => (
              <button
                key={tbl.key}
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void handleExportTableCsv(tbl.key)}
                disabled={busy}
              >
                <Download size={14} />
                {tbl.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="chart-header">
            <div>
              <h2 className="card-section-title" style={{ marginBottom: 2 }}>
                SQLite File Backup &amp; Restore (.db)
              </h2>
              <p className="page-subtitle" style={{ fontSize: '0.82rem' }}>
                Copy the local <code>farmdb.db</code> file to an external drive or restore on a new PC
              </p>
            </div>
            <DbIcon size={18} color="#2d6a4f" />
          </div>

          {dbPath && (
            <p className="photo-uri-hint" style={{ marginBottom: 14 }} title={dbPath}>
              Local file: <code>{dbPath}</code>
            </p>
          )}

          {!inTauri ? (
            <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
              Raw <code>.db</code> file backup and restore is active when running
              inside the Tauri desktop app (<code>npm run dev:tauri</code>). Use
              JSON Export/Restore above while previewing in a browser.
            </p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleBackupSqlite()}
                disabled={busy || !sqlController}
              >
                <HardDriveDownload size={16} />
                Save .db Backup
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void handleRestoreSqlite()}
                disabled={busy || !sqlController}
              >
                <Upload size={16} />
                Restore from .db File
              </button>
            </div>
          )}

          {inTauri && (
            <p style={{ marginTop: 12, marginBottom: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Restoring validates the SQLite header, saves a safety copy (
              <code>.pre-restore.bak</code>), replaces <code>farmdb.db</code>, and
              applies any pending migrations automatically.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
