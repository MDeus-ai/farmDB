import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  ClipboardList,
  Database as DbIcon,
  DollarSign,
  Milk,
  Stethoscope,
} from 'lucide-react';
import { APP_SECTIONS, type AppSectionId } from '@farmdb/core';
import {
  FarmDbProvider,
  runMigrations,
  useFarmDb,
  useFarmSummary,
  type FarmDbContextValue,
  type SqlDriver,
} from '@farmdb/db';
import { createBrowserPreviewSession } from './db/browserPreviewSession';
import { createTauriSqliteDriver } from './db/tauriDriver';
import { LivestockView } from './components/LivestockView';
import { SectionPlaceholder } from './components/SectionPlaceholder';

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
  }
}

function DesktopShell() {
  const [activeSection, setActiveSection] = useState<AppSectionId>('livestock');
  const { driverKind } = useFarmDb();
  const summaryQuery = useFarmSummary();
  const summary = summaryQuery.data;

  function getCountForSection(id: AppSectionId): number {
    if (!summary) return 0;
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
    }
  }

  const currentSection =
    APP_SECTIONS.find((s) => s.id === activeSection) ?? APP_SECTIONS[0]!;

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
            {APP_SECTIONS.map((section) => (
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
                <span className="nav-badge">{getCountForSection(section.id)}</span>
              </button>
            ))}
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

        {activeSection === 'livestock' ? (
          <LivestockView />
        ) : activeSection === 'production' ? (
          <SectionPlaceholder
            section={currentSection}
            tableName="product_records"
            recordCount={summary?.productRecordCount ?? 0}
          />
        ) : activeSection === 'medical' ? (
          <SectionPlaceholder
            section={currentSection}
            tableName="medical_records"
            recordCount={summary?.medicalRecordCount ?? 0}
          />
        ) : activeSection === 'financial' ? (
          <SectionPlaceholder
            section={currentSection}
            tableName="financial_logs"
            recordCount={summary?.financialLogCount ?? 0}
          />
        ) : (
          <SectionPlaceholder
            section={currentSection}
            tableName="alerts"
            recordCount={summary?.openAlertCount ?? 0}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  const [driver, setDriver] = useState<SqlDriver | null>(null);
  const [previewSession, setPreviewSession] = useState<FarmDbContextValue | null>(
    null
  );
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        if (isRunningInsideTauri()) {
          const sqliteDriver = await createTauriSqliteDriver('sqlite:farmdb.db');
          await runMigrations(sqliteDriver);
          if (!cancelled) {
            setDriver(sqliteDriver);
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
      <DesktopShell />
    </FarmDbProvider>
  );
}
