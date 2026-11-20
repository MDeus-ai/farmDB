import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { AlertTriangle, BookOpen } from 'lucide-react';
import {
  APP_SECTIONS,
  canAccountEditModule,
  canAccountViewModule,
  DEFAULT_FARM_SETTINGS,
  FARMDB_APP_VERSION,
  formatAccountTierLabel,
  formatUpdateNotificationSummary,
  isAdminAccount,
  type AppSectionId,
  type AppUpdateInfo,
} from '@farmdb/core';
import {
  FarmDbProvider,
  runMigrations,
  useActiveFarmAccount,
  useAlertBackgroundWorker,
  useCloudAutoSyncWorker,
  useFarmAccountList,
  useFarmDb,
  useFarmSettings,
  useFarmSummary,
  useLivestockList,
  useRefreshFarmDb,
  useTriggerCloudSync,
  useUpdateLivestock,
  type AlertNotificationPayload,
  type FarmDbContextValue,
  type SqlDriver,
} from '@farmdb/db';
import { resolveDesktopAvatarSrc } from './assets/avatars';
import { APP_ICONS } from './assets/icons';
import { createBrowserPreviewSession } from './db/browserPreviewSession';
import {
  createTauriSqliteController,
  type TauriSqlController,
} from './db/tauriDriver';
import { convertLocalImageUriToOptimizedDataUrl } from './services/imageStorage';
import { dispatchDesktopNotification } from './services/notifications';
import {
  checkDesktopUpdate,
  getDesktopCurrentVersion,
  type DesktopUpdateController,
  type DesktopUpdateFeedback,
  type DesktopUpdateProgress,
} from './services/updater';
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
import { UpdateAvailableModal } from './components/UpdateAvailableModal';

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
  const [isRefreshingApp, setIsRefreshingApp] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState<string | null>(null);
  const [currentAppVersion, setCurrentAppVersion] = useState(FARMDB_APP_VERSION);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateInstalling, setUpdateInstalling] = useState(false);
  const [updateProgressPercent, setUpdateProgressPercent] = useState<number | null>(null);
  const [updateProgressLabel, setUpdateProgressLabel] = useState<string | null>(null);
  const [updateLastCheckedAt, setUpdateLastCheckedAt] = useState<string | null>(null);
  const [updateFeedback, setUpdateFeedback] = useState<DesktopUpdateFeedback | null>(null);
  const [availableUpdate, setAvailableUpdate] = useState<AppUpdateInfo | null>(null);
  const [updateBannerDismissedVersion, setUpdateBannerDismissedVersion] = useState<string | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateInstallError, setUpdateInstallError] = useState<string | null>(null);
  const updateInstallFnRef = useRef<
    ((onProgress?: (progress: DesktopUpdateProgress) => void) => Promise<void>) | undefined
  >(undefined);
  const notifiedUpdateVersionRef = useRef<string | null>(null);
  const autoUpdateCheckedRef = useRef(false);
  const { driverKind } = useFarmDb();
  const summaryQuery = useFarmSummary();
  const settingsQuery = useFarmSettings();
  const activeAccountQuery = useActiveFarmAccount();
  const accountsListQuery = useFarmAccountList({});
  const livestockListQuery = useLivestockList({});
  const updateLivestockMut = useUpdateLivestock();
  const cloudSyncMut = useTriggerCloudSync();
  const refreshAllDb = useRefreshFarmDb();
  const migratedPhotoIdsRef = useRef<Set<string>>(new Set());
  const summary = summaryQuery.data;
  const settings = settingsQuery.data ?? DEFAULT_FARM_SETTINGS;
  const activeAccount = activeAccountQuery.data;
  const enableNotificationsRef = useRef(settings.enableNotifications);
  enableNotificationsRef.current = settings.enableNotifications;

  useEffect(() => {
    void getDesktopCurrentVersion().then(setCurrentAppVersion);
  }, []);

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

  useEffect(() => {
    if (!refreshFeedback) return;
    const timer = window.setTimeout(() => setRefreshFeedback(null), 2500);
    return () => window.clearTimeout(timer);
  }, [refreshFeedback]);

  const dispatcher = useMemo(
    () => ({
      deliver: dispatchDesktopNotification,
    }),
    []
  );

  const isPendingGate = activeAccount?.status === 'pending';
  const showAuthPortal =
    authPortalOpen || isSignedOut || isPendingGate || !activeAccount;
  const showOnboarding =
    !showAuthPortal &&
    !isSignedOut &&
    !isPendingGate &&
    activeAccount?.onboardingCompleted === false;

  const runUpdateCheck = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    setUpdateChecking(true);
    setUpdateInstallError(null);
    if (!silent) {
      setUpdateFeedback(null);
    }
    try {
      const outcome = await checkDesktopUpdate();
      setCurrentAppVersion(outcome.currentVersion);
      setUpdateLastCheckedAt(outcome.checkedAt);
      if (outcome.status === 'available' && outcome.availableUpdate) {
        const nextUpdate = outcome.availableUpdate;
        setAvailableUpdate(nextUpdate);
        updateInstallFnRef.current = outcome.install;
        if (!silent) {
          setUpdateBannerDismissedVersion(null);
          setUpdateFeedback({ kind: 'ok', text: outcome.message });
        }
        if (
          notifiedUpdateVersionRef.current !== nextUpdate.version &&
          enableNotificationsRef.current
        ) {
          notifiedUpdateVersionRef.current = nextUpdate.version;
          const summaryMsg = formatUpdateNotificationSummary(nextUpdate);
          void dispatchDesktopNotification(summaryMsg);
        }
      } else {
        setAvailableUpdate(null);
        updateInstallFnRef.current = undefined;
        if (!silent) {
          setUpdateFeedback({ kind: 'ok', text: outcome.message });
        }
      }
    } catch (err) {
      if (!silent) {
        setUpdateFeedback({
          kind: 'err',
          text:
            err instanceof Error
              ? `Update check failed: ${err.message}`
              : 'Unable to check for desktop updates.',
        });
      }
    } finally {
      setUpdateChecking(false);
    }
  }, []);

  const handleInstallDesktopUpdate = useCallback(async () => {
    const installer = updateInstallFnRef.current;
    if (!installer) return;
    setUpdateInstalling(true);
    setUpdateInstallError(null);
    setUpdateProgressPercent(0);
    setUpdateProgressLabel(
      availableUpdate
        ? `Downloading farmDB v${availableUpdate.version}...`
        : 'Downloading farmDB update...'
    );
    try {
      await installer((progress) => {
        setUpdateProgressPercent(progress.percent);
        setUpdateProgressLabel(progress.label);
      });
    } catch (err) {
      const errText =
        err instanceof Error
          ? `Update installation failed: ${err.message}`
          : 'Unable to install update automatically.';
      setUpdateInstallError(errText);
      setUpdateFeedback({ kind: 'err', text: errText });
    } finally {
      setUpdateInstalling(false);
    }
  }, [availableUpdate]);

  useEffect(() => {
    if (isSignedOut || showAuthPortal || showOnboarding) {
      return;
    }
    if (autoUpdateCheckedRef.current) {
      return;
    }
    const timer = window.setTimeout(() => {
      autoUpdateCheckedRef.current = true;
      void runUpdateCheck({ silent: true });
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [isSignedOut, showAuthPortal, showOnboarding, runUpdateCheck]);

  const desktopUpdateController = useMemo<DesktopUpdateController>(
    () => ({
      currentVersion: currentAppVersion,
      checking: updateChecking,
      installing: updateInstalling,
      progressPercent: updateProgressPercent,
      progressLabel: updateProgressLabel,
      lastCheckedAt: updateLastCheckedAt,
      feedback: updateFeedback,
      availableUpdate,
      onCheckForUpdates: () => runUpdateCheck({ silent: false }),
      onOpenModal: () => setUpdateModalOpen(true),
      onInstallUpdate: handleInstallDesktopUpdate,
    }),
    [
      currentAppVersion,
      updateChecking,
      updateInstalling,
      updateProgressPercent,
      updateProgressLabel,
      updateLastCheckedAt,
      updateFeedback,
      availableUpdate,
      runUpdateCheck,
      handleInstallDesktopUpdate,
    ]
  );

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

  const {
    syncNow: autoSyncNow,
    flushPendingSync,
    hasUnsyncedChangesRef,
    lastSyncCompletedAtRef,
  } = useCloudAutoSyncWorker(settings, {
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

  const closingWindowRef = useRef(false);
  useEffect(() => {
    if (!isRunningInsideTauri()) return;
    let active = true;
    let unlisten: (() => void) | undefined;

    void getCurrentWindow()
      .onCloseRequested(async (event) => {
        if (closingWindowRef.current) return;
        const needsFlush =
          hasUnsyncedChangesRef.current || cloudSyncMut.isPending;
        if (!needsFlush) return;
        event.preventDefault();
        closingWindowRef.current = true;
        setSyncFeedback('Syncing before close...');
        try {
          await flushPendingSync(6000);
        } catch {
          // Proceed closing safely even if offline or network times out.
        } finally {
          void getCurrentWindow().destroy().catch(() => {});
        }
      })
      .then((fn) => {
        if (active) {
          unlisten = fn;
        } else {
          fn();
        }
      })
      .catch(() => {});

    return () => {
      active = false;
      unlisten?.();
    };
  }, [flushPendingSync, hasUnsyncedChangesRef, cloudSyncMut.isPending]);

  useEffect(() => {
    const syncIfStale = () => {
      if (document.visibilityState === 'hidden') return;
      if (Date.now() - lastSyncCompletedAtRef.current < 10_000) return;
      void autoSyncNow().catch(() => {});
    };
    window.addEventListener('focus', syncIfStale);
    document.addEventListener('visibilitychange', syncIfStale);
    return () => {
      window.removeEventListener('focus', syncIfStale);
      document.removeEventListener('visibilitychange', syncIfStale);
    };
  }, [autoSyncNow, lastSyncCompletedAtRef]);

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

  const isLockedShell = isSignedOut || showAuthPortal || showOnboarding;
  const isAdminSession =
    !isLockedShell &&
    Boolean(
      activeAccount &&
        (isAdminAccount(activeAccount) || activeAccount.canManageNetwork)
    );
  const pendingJoinAccounts = useMemo(
    () =>
      isAdminSession
        ? (accountsListQuery.data ?? []).filter((a) => a.status === 'pending')
        : [],
    [isAdminSession, accountsListQuery.data]
  );
  const pendingJoinSignature = useMemo(
    () => pendingJoinAccounts.map((a) => a.id).sort().join(','),
    [pendingJoinAccounts]
  );
  const notifiedPendingIdsRef = useRef<Set<string>>(new Set());
  const [dismissedPendingSignature, setDismissedPendingSignature] = useState('');

  useEffect(() => {
    if (!isAdminSession || pendingJoinAccounts.length === 0) {
      return;
    }
    const newlyArrived = pendingJoinAccounts.filter(
      (a) => !notifiedPendingIdsRef.current.has(a.id)
    );
    if (newlyArrived.length === 0) {
      return;
    }
    for (const acc of newlyArrived) {
      notifiedPendingIdsRef.current.add(acc.id);
    }
    setDismissedPendingSignature('');
    if (enableNotificationsRef.current) {
      const title =
        pendingJoinAccounts.length === 1
          ? 'New Farm Network Join Request'
          : `${pendingJoinAccounts.length} Pending Network Join Requests`;
      const body = `${newlyArrived[0]!.displayName} wants to join ${settings.farmName}. Review & assign privileges before granting access.`;
      void dispatchDesktopNotification({ title, body });
    }
  }, [isAdminSession, pendingJoinAccounts, settings.farmName]);

  function getCountForSection(id: AppSectionId): number | null {
    if (id === 'network') {
      return pendingJoinAccounts.length > 0 ? pendingJoinAccounts.length : null;
    }
    if (!summary) {
      return id === 'backup' ||
        id === 'settings' ||
        id === 'family_tree' ||
        id === 'hr' ||
        id === 'statistics' ||
        id === 'ownerships'
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

  async function handleRefreshApp() {
    if (isRefreshingApp) return;
    setIsRefreshingApp(true);
    setRefreshFeedback(null);
    try {
      const canCloudSync = Boolean(
        !isLockedShell &&
          settings.cloudSyncEnabled &&
          settings.supabaseUrl.trim() &&
          settings.supabaseAnonKey.trim() &&
          (isAdminAccount(activeAccount) || activeAccount?.canSyncCloud)
      );
      if (canCloudSync) {
        try {
          await cloudSyncMut.mutateAsync('bidirectional');
        } catch {
          // Offline safe fallback: local database & queries still refresh cleanly.
        }
      }
      await refreshAllDb();
      const freshSettings = (await settingsQuery.refetch()).data;
      if (freshSettings) {
        const root = document.documentElement;
        root.dataset.fontScale = freshSettings.fontScale;
        root.dataset.uiDensity = freshSettings.uiDensity;
      }
      if (
        !isLockedShell &&
        (freshSettings?.enableNotifications ?? settings.enableNotifications)
      ) {
        void checkNow();
      }
      setRefreshFeedback('Refreshed');
    } finally {
      setIsRefreshingApp(false);
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
    isRefreshing: isRefreshingApp,
    refreshFeedback,
    onRefreshApp: isLockedShell
      ? undefined
      : () => {
          void handleRefreshApp();
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
                    <span className={`nav-badge ${badgeCount === 0 ? 'is-zero' : ''}`}>
                      {badgeCount}
                    </span>
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
              {availableUpdate && (
                <span className="nav-badge nav-badge-update" title={`farmDB v${availableUpdate.version} available`}>
                  1
                </span>
              )}
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
                src={resolveDesktopAvatarSrc(activeAccount?.avatarKey)}
                alt=""
                className="app-icon-md"
                style={{ borderRadius: 6 }}
              />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                      flexShrink: 1,
                    }}
                  >
                    {activeAccount?.displayName ?? settings.farmName}
                  </span>
                  {isAdminAccount(activeAccount) && (
                    <span
                      style={{
                        flexShrink: 0,
                        padding: '1px 6px',
                        borderRadius: 999,
                        background: 'rgba(183, 228, 199, 0.18)',
                        border: '1px solid rgba(183, 228, 199, 0.3)',
                        color: '#b7e4c7',
                        fontSize: '0.66rem',
                        fontWeight: 700,
                      }}
                    >
                      Admin
                    </span>
                  )}
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

        {availableUpdate &&
          updateBannerDismissedVersion !== availableUpdate.version && (
            <div className="update-notification-banner" role="status">
              <div className="update-notification-main">
                <img src={APP_ICONS.downloads} alt="" className="app-icon-md" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong>farmDB v{availableUpdate.version} Available</strong>
                    <span className="update-version-pill">
                      v{currentAppVersion} → v{availableUpdate.version}
                    </span>
                  </div>
                  <p className="update-notification-summary">
                    {availableUpdate.fixes.length > 0
                      ? `${availableUpdate.fixes[0]}${availableUpdate.fixes.length > 1 ? ` (+${availableUpdate.fixes.length - 1} more fixes)` : ''}`
                      : availableUpdate.summary || 'New bug fixes and improvements ready to install.'}
                  </p>
                </div>
              </div>
              <div className="row-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setUpdateModalOpen(true)}
                >
                  View Fixes &amp; Update
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setUpdateBannerDismissedVersion(availableUpdate.version)}
                  aria-label="Dismiss update notification banner"
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

        {isAdminSession &&
          pendingJoinAccounts.length > 0 &&
          dismissedPendingSignature !== pendingJoinSignature && (
            <div className="pending-join-banner" role="alert">
              <div className="pending-join-main">
                <img src={APP_ICONS.hourglass} alt="" className="app-icon-md" />
                <div style={{ minWidth: 0 }}>
                  <strong>
                    Pending Network Join Request ({pendingJoinAccounts.length})
                  </strong>
                  <p className="pending-join-summary">
                    {pendingJoinAccounts[0]!.displayName}
                    {pendingJoinAccounts.length > 1
                      ? ` (+${pendingJoinAccounts.length - 1} more)`
                      : ''}{' '}
                    wants to join {settings.farmName}. Assign privileges before granting access.
                  </p>
                </div>
              </div>
              <div className="row-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setActiveSection('network')}
                >
                  Review &amp; Assign Privileges
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setDismissedPendingSignature(pendingJoinSignature)}
                  aria-label="Dismiss pending request notification"
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
            updateController={desktopUpdateController}
          />
        )}
      </main>

      <TutorialOverlay
        visible={tutorialOpen}
        activeAccount={activeAccount}
        activeSection={activeSection}
        onClose={() => setTutorialOpen(false)}
      />

      <UpdateAvailableModal
        visible={updateModalOpen}
        currentVersion={currentAppVersion}
        update={availableUpdate}
        installing={updateInstalling}
        progressPercent={updateProgressPercent}
        progressLabel={updateProgressLabel}
        errorText={updateInstallError}
        onInstall={() => void handleInstallDesktopUpdate()}
        onClose={() => {
          if (!updateInstalling) {
            setUpdateModalOpen(false);
          }
        }}
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
          await controller.driver.execute(
            `DELETE FROM farm_accounts
             WHERE id = 'owner-admin'
               AND display_name = 'Farm Owner (Administrator)'
               AND created_at = 1
               AND updated_at = 1
               AND access_code IS NULL
               AND email IS NULL
               AND phone IS NULL
               AND supabase_url IS NULL
               AND onboarding_completed = 0;`
          );
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
    <FarmDbProvider
      driver={driver ?? undefined}
      session={previewSession ?? undefined}
      autoSeedDefaultAdmin={false}
    >
      <AnimalQuickPreviewProvider>
        <DesktopShell sqlController={sqlController} />
        <FarmHoverHintOverlay />
      </AnimalQuickPreviewProvider>
    </FarmDbProvider>
  );
}
