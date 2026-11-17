import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen } from 'lucide-react';
import {
  APP_SECTIONS,
  canAccountViewModule,
  DEFAULT_FARM_SETTINGS,
  formatAccountTierLabel,
  isAdminAccount,
  type AppSectionId,
} from '@farmdb/core';
import {
  FarmDbProvider,
  runMigrations,
  useActiveFarmAccount,
  useAlertBackgroundWorker,
  useCloudAutoSyncWorker,
  useFarmDb,
  useFarmSettings,
  useFarmSummary,
  type AlertNotificationPayload,
  type FarmDbContextValue,
  type SqlDriver,
} from '@farmdb/db';
import { APP_ICONS } from './assets/icons';
import { createBrowserPreviewSession } from './db/browserPreviewSession';
import {
  createTauriSqliteController,
  type TauriSqlController,
} from './db/tauriDriver';
import { dispatchDesktopNotification } from './services/notifications';
import { AlertsView } from './components/AlertsView';
import { AuthPortalView } from './components/AuthPortalView';
import { AnimalQuickPreviewProvider } from './components/AnimalQuickPreviewModal';
import { BackupView } from './components/BackupView';
import { FamilyTreeView } from './components/FamilyTreeView';
import { FarmNetworkView } from './components/FarmNetworkView';
import { FarmStatisticsView } from './components/FarmStatisticsView';
import { FinancialView } from './components/FinancialView';
import { HumanResourcesView } from './components/HumanResourcesView';
import { LivestockView } from './components/LivestockView';
import { MedicalView } from './components/MedicalView';
import { OwnershipsView } from './components/OwnershipsView';
import { ProductionView } from './components/ProductionView';
import { SettingsView } from './components/SettingsView';
import { TutorialOverlay } from './components/TutorialOverlay';

function isRunningInsideTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    '__TAURI_INTERNALS__' in (window as unknown as Record<string, unknown>)
  );
}

function getSectionIconSrc(id: AppSectionId): string {
  switch (id) {
    case 'livestock':
      return APP_ICONS.group;
    case 'ownerships':
      return APP_ICONS.ownership;
    case 'family_tree':
      return APP_ICONS.tree;
    case 'production':
      return APP_ICONS.milkBottle;
    case 'medical':
      return APP_ICONS.syringe;
    case 'financial':
      return APP_ICONS.budget;
    case 'alerts':
      return APP_ICONS.notification;
    case 'hr':
      return APP_ICONS.staff;
    case 'statistics':
      return APP_ICONS.livestockGroup;
    case 'network':
      return APP_ICONS.network;
    case 'backup':
      return APP_ICONS.databaseCloud;
    case 'settings':
      return APP_ICONS.settings;
  }
}

function getSectionIcon(id: AppSectionId, label: string) {
  return (
    <img
      src={getSectionIconSrc(id)}
      alt={label}
      className="nav-icon-img"
    />
  );
}

function DesktopShell({
  sqlController,
}: {
  sqlController: TauriSqlController | null;
}) {
  const [activeSection, setActiveSection] = useState<AppSectionId>('livestock');
  const [familyFocusAnimalId, setFamilyFocusAnimalId] = useState<string | null>(null);
  const [authPortalOpen, setAuthPortalOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [dueBanners, setDueBanners] = useState<AlertNotificationPayload[]>([]);
  const { driverKind } = useFarmDb();
  const summaryQuery = useFarmSummary();
  const settingsQuery = useFarmSettings();
  const activeAccountQuery = useActiveFarmAccount();
  const summary = summaryQuery.data;
  const settings = settingsQuery.data ?? DEFAULT_FARM_SETTINGS;
  const activeAccount = activeAccountQuery.data;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.fontScale = settings.fontScale;
    root.dataset.uiDensity = settings.uiDensity;
  }, [settings.fontScale, settings.uiDensity]);

  const dispatcher = useMemo(
    () => ({
      deliver: dispatchDesktopNotification,
    }),
    []
  );

  const { checkNow } = useAlertBackgroundWorker(dispatcher, {
    enabled: settings.enableNotifications,
    intervalMs: settings.alertCheckIntervalSeconds * 1000,
    onDelivered: (items) => {
      setDueBanners((prev) => [...items, ...prev].slice(0, 4));
    },
  });

  useCloudAutoSyncWorker(settings, {
    canSyncAccount:
      isAdminAccount(activeAccount) || Boolean(activeAccount?.canSyncCloud),
  });

  const visibleSections = useMemo(
    () =>
      APP_SECTIONS.filter((sec) => canAccountViewModule(activeAccount, sec.id)),
    [activeAccount]
  );

  useEffect(() => {
    if (!visibleSections.some((s) => s.id === activeSection)) {
      setActiveSection(visibleSections[0]?.id ?? 'livestock');
    }
  }, [visibleSections, activeSection]);

  const topNavSections = useMemo(
    () => visibleSections.filter((s) => s.id !== 'settings'),
    [visibleSections]
  );

  if (authPortalOpen || activeAccount?.status === 'pending') {
    return (
      <div
        data-font-scale={settings.fontScale}
        data-ui-density={settings.uiDensity}
      >
        <AuthPortalView
          canCancel={activeAccount?.status !== 'pending'}
          onSuccessEnterApp={() => setAuthPortalOpen(false)}
          onCancelToApp={() => setAuthPortalOpen(false)}
        />
      </div>
    );
  }

  function getCountForSection(id: AppSectionId): number | null {
    if (!summary) {
      return id === 'backup' ||
        id === 'settings' ||
        id === 'family_tree' ||
        id === 'hr' ||
        id === 'statistics' ||
        id === 'ownerships' ||
        id === 'network'
        ? null
        : 0;
    }
    switch (id) {
      case 'livestock':
        return summary.activeLivestock;
      case 'ownerships':
      case 'family_tree':
      case 'hr':
      case 'statistics':
      case 'network':
        return null;
      case 'production':
        return summary.productRecordCount;
      case 'medical':
        return summary.medicalRecordCount;
      case 'financial':
        return summary.financialLogCount;
      case 'alerts':
        return summary.openAlertCount;
      case 'backup':
      case 'settings':
        return null;
    }
  }

  return (
    <div
      className="app-shell"
      data-font-scale={settings.fontScale}
      data-ui-density={settings.uiDensity}
    >
      <aside className="sidebar">
        <div>
          <div className="brand">
            <div className="brand-mark">
              <img src={APP_ICONS.barn} alt="farmDB barn logo" />
            </div>
            <div>
              <p className="brand-title">farmDB</p>
              <p className="brand-sub">{settings.farmName}</p>
            </div>
          </div>

          <nav className="nav-list" aria-label="Main navigation">
            {topNavSections.map((section) => {
              const badgeCount = getCountForSection(section.id);
              return (
                <button
                  key={section.id}
                  type="button"
                  className={`nav-item ${activeSection === section.id ? 'active' : ''}`}
                  onClick={() => {
                    if (section.id !== 'family_tree') {
                      setFamilyFocusAnimalId(null);
                    }
                    setActiveSection(section.id);
                  }}
                >
                  <span className="nav-item-left">
                    {getSectionIcon(section.id, section.label)}
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
          <button
            type="button"
            className="nav-item"
            onClick={() => setTutorialOpen(true)}
          >
            <span className="nav-item-left">
              <BookOpen size={17} />
              <span>App Guide</span>
            </span>
          </button>

          {canAccountViewModule(activeAccount, 'settings') && (
            <button
              type="button"
              className={`nav-item ${activeSection === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveSection('settings')}
            >
              <span className="nav-item-left">
                {getSectionIcon('settings', 'Settings')}
                <span>Settings</span>
              </span>
            </button>
          )}

          <div className="sidebar-user-card">
            <button
              type="button"
              className="sidebar-account-btn"
              onClick={() => {
                if (isAdminAccount(activeAccount)) {
                  setActiveSection('network');
                } else {
                  setAuthPortalOpen(true);
                }
              }}
              title={
                isAdminAccount(activeAccount)
                  ? 'Manage Farm Network accounts & join keys'
                  : 'Switch account or enter an Admin Join Key'
              }
            >
              <img
                src={
                  isAdminAccount(activeAccount)
                    ? APP_ICONS.networking
                    : APP_ICONS.farmer
                }
                alt=""
                className="app-icon-md"
              />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {activeAccount?.displayName ?? 'Farm Owner (Admin)'}
                </span>
                <small style={{ display: 'block', opacity: 0.78, fontWeight: 500 }}>
                  {formatAccountTierLabel(activeAccount)}
                  {!isAdminAccount(activeAccount)
                    ? activeAccount?.canSyncCloud
                      ? ' · Network DB'
                      : ' · Local DB'
                    : ''}
                </small>
              </span>
            </button>

            <button
              type="button"
              className="sidebar-auth-btn"
              onClick={() => setAuthPortalOpen(true)}
            >
              <img src={APP_ICONS.farmer} alt="" className="app-icon-sm" />
              <span>Login / Sign Up</span>
            </button>
          </div>
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
              <img
                src={APP_ICONS.notification}
                alt=""
                className="app-icon-md"
              />
              <span>
                <strong>{dueBanners[0]!.title}</strong> — {dueBanners[0]!.body}
                {dueBanners.length > 1 ? ` (+${dueBanners.length - 1} more)` : ''}
              </span>
            </div>
            <div className="row-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  setActiveSection(dueBanners[0]?.kind === 'hr_payment' ? 'hr' : 'alerts')
                }
              >
                {dueBanners[0]?.kind === 'hr_payment' ? 'View Staff & Payroll' : 'View Alerts'}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDueBanners([])}
                aria-label="Dismiss notification banner"
              >
                <img
                  src={APP_ICONS.letterX}
                  alt=""
                  className="app-icon-sm"
                />
              </button>
            </div>
          </div>
        )}

        {activeSection === 'livestock' ? (
          <LivestockView
            onOpenFamilyTree={(animalId) => {
              setFamilyFocusAnimalId(animalId);
              setActiveSection('family_tree');
            }}
          />
        ) : activeSection === 'ownerships' ? (
          <OwnershipsView onOpenNetwork={() => setActiveSection('network')} />
        ) : activeSection === 'family_tree' ? (
          <FamilyTreeView initialAnimalId={familyFocusAnimalId} />
        ) : activeSection === 'production' ? (
          <ProductionView />
        ) : activeSection === 'medical' ? (
          <MedicalView />
        ) : activeSection === 'financial' ? (
          <FinancialView />
        ) : activeSection === 'alerts' ? (
          <AlertsView onCheckDueNow={async () => (await checkNow()).length} />
        ) : activeSection === 'hr' ? (
          <HumanResourcesView onOpenSettings={() => setActiveSection('settings')} />
        ) : activeSection === 'statistics' ? (
          <FarmStatisticsView />
        ) : activeSection === 'network' ? (
          <FarmNetworkView onOpenAuthPortal={() => setAuthPortalOpen(true)} />
        ) : activeSection === 'backup' ? (
          <BackupView sqlController={sqlController} />
        ) : (
          <SettingsView
            onOpenBackup={() => setActiveSection('backup')}
            onOpenTutorial={() => setTutorialOpen(true)}
          />
        )}
      </main>

      <TutorialOverlay
        visible={tutorialOpen}
        activeAccount={activeAccount}
        activeSection={activeSection}
        onClose={() => setTutorialOpen(false)}
      />
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
      <AnimalQuickPreviewProvider>
        <DesktopShell sqlController={sqlController} />
      </AnimalQuickPreviewProvider>
    </FarmDbProvider>
  );
}
