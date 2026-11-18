import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BookOpen } from 'lucide-react';
import {
  APP_SECTIONS,
  canAccountEditModule,
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
  useLivestockList,
  useTriggerCloudSync,
  useUpdateLivestock,
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
import { convertLocalImageUriToOptimizedDataUrl } from './services/imageStorage';
import { dispatchDesktopNotification } from './services/notifications';
import { AlertsView } from './components/AlertsView';
import { AuthPortalView } from './components/AuthPortalView';
import { AnimalQuickPreviewProvider } from './components/AnimalQuickPreviewModal';
import { BackupView } from './components/BackupView';
import {
  DesktopTitlebar,
  getSectionIconSrc,
  type DesktopTitlebarProps,
} from './components/DesktopTitlebar';
import { FamilyTreeView } from './components/FamilyTreeView';
import { FarmHoverHintOverlay } from './components/FarmHoverHint';
import { FarmNetworkView } from './components/FarmNetworkView';
import { FarmStatisticsView } from './components/FarmStatisticsView';
import { FinancialView } from './components/FinancialView';
import { FirstTimeSetupView } from './components/FirstTimeSetupView';
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
  const [authPortalOpen, setAuthPortalOpen] = useState(true);
  const [isSignedOut, setIsSignedOut] = useState(true);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  function handleSignOut() {
    setIsSignedOut(true);
    setAuthPortalOpen(true);
  }
  const [dueBanners, setDueBanners] = useState<AlertNotificationPayload[]>([]);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const { driverKind } = useFarmDb();
  const summaryQuery = useFarmSummary();
  const settingsQuery = useFarmSettings();
  const activeAccountQuery = useActiveFarmAccount();
  const livestockListQuery = useLivestockList({});
  const updateLivestockMut = useUpdateLivestock();
  const cloudSyncMut = useTriggerCloudSync();
  const migratedPhotoIdsRef = useRef<Set<string>>(new Set());
  const summary = summaryQuery.data;
  const settings = settingsQuery.data ?? DEFAULT_FARM_SETTINGS;
  const activeAccount = activeAccountQuery.data;

  useEffect(() => {
    if (!isRunningInsideTauri()) return;
    if (!canAccountEditModule(activeAccount, 'livestock')) return;
    const rows = livestockListQuery.data;
    if (!rows || rows.length === 0) return;

    const pending = rows.filter(
      (a) =>
        a.imageUri &&
        !a.imageUri.startsWith('data:') &&
        !a.imageUri.startsWith('http') &&
        !a.imageUri.startsWith('blob:') &&
        !migratedPhotoIdsRef.current.has(a.id)
    );
    if (pending.length === 0) return;

    let cancelled = false;
    void (async () => {
      for (const animal of pending) {
        if (cancelled || !animal.imageUri) break;
        migratedPhotoIdsRef.current.add(animal.id);
        const optimized = await convertLocalImageUriToOptimizedDataUrl(animal.imageUri);
        if (optimized && !cancelled) {
          try {
            await updateLivestockMut.mutateAsync({
              id: animal.id,
              input: { imageUri: optimized },
            });
          } catch {
            // Skip silently if locked or permission changed
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [livestockListQuery.data, activeAccount, updateLivestockMut]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.fontScale = settings.fontScale;
    root.dataset.uiDensity = settings.uiDensity;
  }, [settings.fontScale, settings.uiDensity]);

  useEffect(() => {
    if (!syncFeedback) return;
    const timer = window.setTimeout(() => setSyncFeedback(null), 3500);
    return () => window.clearTimeout(timer);
  }, [syncFeedback]);

  const dispatcher = useMemo(
    () => ({
      deliver: dispatchDesktopNotification,
    }),
    []
  );

  const isPendingGate = activeAccount?.status === 'pending';
  const showAuthPortal = authPortalOpen || isSignedOut || isPendingGate;
  const showOnboarding =
    !showAuthPortal &&
    !isSignedOut &&
    !isPendingGate &&
    activeAccount?.onboardingCompleted === false;

  const { checkNow } = useAlertBackgroundWorker(dispatcher, {
    enabled:
      !isSignedOut &&
      !showAuthPortal &&
      !showOnboarding &&
      settings.enableNotifications,
    intervalMs: settings.alertCheckIntervalSeconds * 1000,
    onDelivered: (items) => {
      setDueBanners((prev) => [...items, ...prev].slice(0, 4));
    },
  });

  useCloudAutoSyncWorker(settings, {
    canSyncAccount:
      !isSignedOut &&
      !showAuthPortal &&
      !showOnboarding &&
      (isAdminAccount(activeAccount) || Boolean(activeAccount?.canSyncCloud)),
    onSynced: (result) => {
      if (result.ok) {
        const moved = result.recordsPushed + result.recordsPulled;
        setSyncFeedback(moved > 0 ? `Synced (${moved})` : 'Up to date');
      }
    },
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

  async function handleTitlebarCloudSync() {
    try {
      const result = await cloudSyncMut.mutateAsync('bidirectional');
      if (result.ok) {
        const moved = result.recordsPushed + result.recordsPulled;
        setSyncFeedback(moved > 0 ? `Synced (${moved})` : 'Up to date');
      } else {
        setSyncFeedback('Sync issue');
      }
    } catch {
      setSyncFeedback('Sync failed');
    }
  }

  const isLockedShell = isSignedOut || showAuthPortal || showOnboarding;

  const titlebarProps: DesktopTitlebarProps = {
    minimal: isLockedShell,
    statusLabel: isPendingGate
      ? 'Pending Admin Approval'
      : showAuthPortal
        ? 'Sign In or Create Account'
        : showOnboarding
          ? 'First-Time Setup'
          : undefined,
    activeSection,
    sectionCount: getCountForSection(activeSection),
    authPortalOpen: showAuthPortal,
    settings,
    activeAccount,
    driverKind,
    openAlertCount: summary?.openAlertCount ?? 0,
    isSyncing: cloudSyncMut.isPending,
    syncFeedback,
    onTriggerCloudSync: isLockedShell
      ? undefined
      : () => {
          void handleTitlebarCloudSync();
        },
    onOpenAlerts:
      !isLockedShell && canAccountViewModule(activeAccount, 'alerts')
        ? () => {
            setAuthPortalOpen(false);
            setActiveSection('alerts');
          }
        : undefined,
    onOpenSettings:
      !isLockedShell && canAccountViewModule(activeAccount, 'settings')
        ? () => {
            setAuthPortalOpen(false);
            setActiveSection('settings');
          }
        : undefined,
    onOpenAccountPortal: !isLockedShell
      ? () => setActiveSection('network')
      : undefined,
  };

  if (showAuthPortal) {
    return (
      <div
        className="desktop-window-frame"
        data-font-scale={settings.fontScale}
        data-ui-density={settings.uiDensity}
      >
        <DesktopTitlebar {...titlebarProps} />
        <AuthPortalView
          canCancel={!isPendingGate && !isSignedOut}
          onSuccessEnterApp={() => {
            setIsSignedOut(false);
            setAuthPortalOpen(false);
          }}
          onCancelToApp={() => setAuthPortalOpen(false)}
        />
      </div>
    );
  }

  if (showOnboarding && activeAccount) {
    return (
      <div
        className="desktop-window-frame"
        data-font-scale={settings.fontScale}
        data-ui-density={settings.uiDensity}
      >
        <DesktopTitlebar {...titlebarProps} />
        <FirstTimeSetupView
          activeAccount={activeAccount}
          sqlController={sqlController}
          onComplete={() => {
            setActiveSection('livestock');
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="desktop-window-frame"
      data-font-scale={settings.fontScale}
      data-ui-density={settings.uiDensity}
    >
      <DesktopTitlebar {...titlebarProps} />
      <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">
            <div className="brand-mark">
              <img src={APP_ICONS.field} alt="farmDB logo" />
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
              onClick={() => setActiveSection('network')}
              title="Open Farm Network, Join Keys & Password settings"
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
              onClick={handleSignOut}
            >
              <img src={APP_ICONS.farmer} alt="" className="app-icon-sm" />
              <span>Sign Out</span>
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

        {visibleSections.length === 0 ? (
          <div className="card">
            <h2 className="card-section-title">No Modules Assigned</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              This account currently has all modules set to Hidden. Ask your Farm Admin to grant
              module access or switch accounts.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSignOut}
            >
              Sign Out
            </button>
          </div>
        ) : activeSection === 'livestock' ? (
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
          <FarmNetworkView onSignOut={handleSignOut} />
        ) : activeSection === 'backup' ? (
          <BackupView sqlController={sqlController} />
        ) : (
          <SettingsView
            sqlController={sqlController}
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
      <div className="desktop-window-frame">
        <DesktopTitlebar minimal statusLabel="Database Initialization Error" />
        <div style={{ padding: 32, overflow: 'auto', flex: 1 }}>
          <h1>Database Initialization Error</h1>
          <p>{initError}</p>
        </div>
      </div>
    );
  }

  if (!driver && !previewSession) {
    return (
      <div className="desktop-window-frame">
        <DesktopTitlebar minimal statusLabel="Starting Offline Ledger..." />
        <div style={{ padding: 32, color: '#5d675f', flex: 1 }}>
          Initializing local farmDB SQLite engine...
        </div>
      </div>
    );
  }

  return (
    <FarmDbProvider driver={driver ?? undefined} session={previewSession ?? undefined}>
      <AnimalQuickPreviewProvider>
        <DesktopShell sqlController={sqlController} />
        <FarmHoverHintOverlay />
      </AnimalQuickPreviewProvider>
    </FarmDbProvider>
  );
}
