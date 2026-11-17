import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellRing,
  ClipboardList,
  Database as DbIcon,
  DollarSign,
  HardDriveDownload,
  Milk,
  Stethoscope,
  X,
} from 'lucide-react';
import { APP_SECTIONS, type AppSectionId } from '@farmdb/core';
import {
  FarmDbProvider,
  runMigrations,
  useAlertBackgroundWorker,
  useFarmDb,
  useFarmSummary,
  type AlertNotificationPayload,
  type FarmDbContextValue,
  type SqlDriver,
} from '@farmdb/db';
import { createBrowserPreviewSession } from './db/browserPreviewSession';
import {
  createTauriSqliteController,
  type TauriSqlController,
} from './db/tauriDriver';
import { dispatchDesktopNotification } from './services/notifications';
import { AlertsView } from './components/AlertsView';
import { BackupView } from './components/BackupView';
import { FinancialView } from './components/FinancialView';
import { LivestockView } from './components/LivestockView';
import { MedicalView } from './components/MedicalView';
import { ProductionView } from './components/ProductionView';

function isRunningInsideTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    '__TAURI_INTERNALS__' in (window as unknown as Record<string, unknown>)
  );
}

function getSectionIcon(id: AppSectionId) {
  switch (id) {
    case 'livestock':
      return <ClipboardList size={17} />;
    case 'production':
      return <Milk size={17} />;
    case 'medical':
      return <Stethoscope size={17} />;
    case 'financial':
      return <DollarSign size={17} />;
    case 'alerts':
      return <Bell size={17} />;
    case 'backup':
      return <HardDriveDownload size={17} />;
  }
}

function DesktopShell({
  sqlController,
}: {
  sqlController: TauriSqlController | null;
}) {
  const [activeSection, setActiveSection] = useState<AppSectionId>('livestock');
  const [dueBanners, setDueBanners] = useState<AlertNotificationPayload[]>([]);
  const { driverKind } = useFarmDb();
  const summaryQuery = useFarmSummary();
  const summary = summaryQuery.data;

  const dispatcher = useMemo(
    () => ({
      deliver: dispatchDesktopNotification,
    }),
    []
  );

  const { checkNow } = useAlertBackgroundWorker(dispatcher, {
    intervalMs: 60_000,
    onDelivered: (items) => {
      setDueBanners((prev) => [...items, ...prev].slice(0, 4));
    },
  });

  function getCountForSection(id: AppSectionId): number | null {
    if (!summary) return id === 'backup' ? null : 0;
    switch (id) {
      case 'livestock':
        return summary.activeLivestock;
      case 'production':
        return summary.productRecordCount;
      case 'medical':
        return summary.medicalRecordCount;
      case 'financial':
        return summary.financialLogCount;
      case 'alerts':
        return summary.openAlertCount;
      case 'backup':
        return null;
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">
            <div className="brand-mark">fDB</div>
            <div>
              <p className="brand-title">farmDB</p>
              <p className="brand-sub">Offline Livestock Ledger</p>
            </div>
          </div>

          <nav className="nav-list" aria-label="Main navigation">
            {APP_SECTIONS.map((section) => {
              const badgeCount = getCountForSection(section.id);
              return (
                <button
                  key={section.id}
                  type="button"
                  className={`nav-item ${activeSection === section.id ? 'active' : ''}`}
                  onClick={() => setActiveSection(section.id)}
                >
                  <span className="nav-item-left">
                    {getSectionIcon(section.id)}
                    <span>{section.label}</span>
                  </span>
                  {badgeCount !== null && (
                    <span className="nav-badge">{badgeCount}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="engine-pill">
            <DbIcon size={13} />
            <span>
              {driverKind === 'tauri-sqlite'
                ? 'SQLite (Tauri Local)'
                : 'Browser Preview'}
            </span>
          </div>
          <div>Local-first device storage. No cloud required.</div>
        </div>
      </aside>

      <main className="main-area">
        {driverKind !== 'tauri-sqlite' && (
          <div className="notice-banner" role="status">
            <AlertTriangle size={17} />
            <span>
              Running in browser preview mode (<code>localStorage</code> fallback).
              Launch with <code>npm run dev:tauri</code> to persist to native SQLite.
            </span>
          </div>
        )}

        {dueBanners.length > 0 && (
          <div className="alert-toast-banner" role="alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <BellRing size={17} />
              <span>
                <strong>{dueBanners[0]!.title}</strong> — {dueBanners[0]!.body}
                {dueBanners.length > 1 ? ` (+${dueBanners.length - 1} more)` : ''}
              </span>
            </div>
            <div className="row-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setActiveSection('alerts')}
              >
                View Alerts
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDueBanners([])}
                aria-label="Dismiss notification banner"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {activeSection === 'livestock' ? (
          <LivestockView />
        ) : activeSection === 'production' ? (
          <ProductionView />
        ) : activeSection === 'medical' ? (
          <MedicalView />
        ) : activeSection === 'financial' ? (
          <FinancialView />
        ) : activeSection === 'alerts' ? (
          <AlertsView onCheckDueNow={async () => (await checkNow()).length} />
        ) : (
          <BackupView sqlController={sqlController} />
        )}
      </main>
    </div>
  );
}

export default function App() {
  const [driver, setDriver] = useState<SqlDriver | null>(null);
  const [sqlController, setSqlController] = useState<TauriSqlController | null>(
    null
  );
  const [previewSession, setPreviewSession] = useState<FarmDbContextValue | null>(
    null
  );
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        if (isRunningInsideTauri()) {
          const controller = await createTauriSqliteController('sqlite:farmdb.db');
          await runMigrations(controller.driver);
          if (!cancelled) {
            setSqlController(controller);
            setDriver(controller.driver);
          }
        } else if (!cancelled) {
          setPreviewSession(createBrowserPreviewSession());
        }
      } catch (err) {
        if (!cancelled) {
          setInitError(
            err instanceof Error ? err.message : 'Failed to initialize local database.'
          );
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  if (initError) {
    return (
      <div style={{ padding: 32 }}>
        <h1>Database Initialization Error</h1>
        <p>{initError}</p>
      </div>
    );
  }

  if (!driver && !previewSession) {
    return (
      <div style={{ padding: 32, color: '#5d675f' }}>
        Initializing local farmDB SQLite engine...
      </div>
    );
  }

  return (
    <FarmDbProvider driver={driver ?? undefined} session={previewSession ?? undefined}>
      <DesktopShell sqlController={sqlController} />
    </FarmDbProvider>
  );
}
