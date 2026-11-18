import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Check, Minus, RefreshCw, Square, X } from 'lucide-react';
import {
  APP_SECTIONS,
  formatAccountTierLabel,
  isAdminAccount,
  type AppSectionId,
  type FarmAccount,
  type FarmSettings,
} from '@farmdb/core';
import type { SqlDriverKind } from '@farmdb/db';
import { APP_ICONS } from '../assets/icons';

export function getSectionIconSrc(id: AppSectionId): string {
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

function isTauriRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    '__TAURI_INTERNALS__' in (window as unknown as Record<string, unknown>)
  );
}

function RestoreWindowIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.5 3.5V1.75C3.5 1.33579 3.83579 1 4.25 1H10.25C10.6642 1 11 1.33579 11 1.75V7.75C11 8.16421 10.6642 8.5 10.25 8.5H8.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="1"
        y="3.5"
        width="7.5"
        height="7.5"
        rx="1.1"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export interface DesktopTitlebarProps {
  minimal?: boolean;
  statusLabel?: string;
  activeSection?: AppSectionId;
  sectionCount?: number | null;
  authPortalOpen?: boolean;
  settings?: FarmSettings;
  activeAccount?: FarmAccount | null;
  driverKind?: SqlDriverKind;
  openAlertCount?: number;
  isSyncing?: boolean;
  syncFeedback?: string | null;
  onTriggerCloudSync?: () => void;
  onOpenAlerts?: () => void;
  onOpenSettings?: () => void;
  onOpenAccountPortal?: () => void;
}

export function DesktopTitlebar({
  minimal = false,
  statusLabel,
  activeSection = 'livestock',
  sectionCount = null,
  authPortalOpen = false,
  settings,
  activeAccount,
  driverKind = 'tauri-sqlite',
  openAlertCount = 0,
  isSyncing = false,
  syncFeedback = null,
  onTriggerCloudSync,
  onOpenAlerts,
  onOpenSettings,
  onOpenAccountPortal,
}: DesktopTitlebarProps) {
  const isTauri = isTauriRuntime();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;

    if (isTauri) {
      const appWindow = getCurrentWindow();
      void appWindow
        .isMaximized()
        .then((val) => {
          if (active) setIsMaximized(val);
        })
        .catch(() => {});

      void appWindow
        .onResized(() => {
          void appWindow
            .isMaximized()
            .then((val) => {
              if (active) setIsMaximized(val);
            })
            .catch(() => {});
        })
        .then((fn) => {
          if (active) {
            unlisten = fn;
          } else {
            fn();
          }
        })
        .catch(() => {});
    } else if (typeof document !== 'undefined') {
      const syncFullscreen = () => {
        if (active) setIsMaximized(Boolean(document.fullscreenElement));
      };
      syncFullscreen();
      document.addEventListener('fullscreenchange', syncFullscreen);
      unlisten = () =>
        document.removeEventListener('fullscreenchange', syncFullscreen);
    }

    return () => {
      active = false;
      unlisten?.();
    };
  }, [isTauri]);

  const handleMinimize = useCallback(() => {
    if (!isTauri) return;
    void getCurrentWindow().minimize().catch(() => {});
  }, [isTauri]);

  const handleToggleMaximize = useCallback(() => {
    if (isTauri) {
      void getCurrentWindow()
        .toggleMaximize()
        .then(() => getCurrentWindow().isMaximized())
        .then((val) => setIsMaximized(val))
        .catch(() => {});
      return;
    }

    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }, [isTauri]);

  const handleClose = useCallback(() => {
    if (!isTauri) return;
    void getCurrentWindow().close().catch(() => {});
  }, [isTauri]);

  const handleDragMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest('button, a, input, select')) {
        return;
      }
      if (e.detail === 2) {
        handleToggleMaximize();
        return;
      }
      if (isTauri && e.detail === 1) {
        void getCurrentWindow().startDragging().catch(() => {});
      }
    },
    [handleToggleMaximize, isTauri]
  );

  const sectionMeta = APP_SECTIONS.find((s) => s.id === activeSection);
  const breadcrumbLabel = authPortalOpen
    ? 'Account Portal'
    : (sectionMeta?.label ?? 'Herd Registry');
  const breadcrumbIcon = authPortalOpen
    ? APP_ICONS.farmer
    : getSectionIconSrc(activeSection);

  const hasCloudCredentials = Boolean(
    settings?.cloudSyncEnabled &&
      settings.supabaseUrl.trim().length > 0 &&
      settings.supabaseAnonKey.trim().length > 0
  );
  const canSyncCloud = Boolean(
    hasCloudCredentials &&
      (isAdminAccount(activeAccount) || Boolean(activeAccount?.canSyncCloud))
  );

  const dbEngineText =
    driverKind === 'tauri-sqlite' ? 'SQLite Native' : 'Browser Preview';
  const cloudStatusText = isSyncing
    ? 'Syncing...'
    : syncFeedback
      ? syncFeedback
      : hasCloudCredentials
        ? 'Cloud Ready'
        : 'Local Offline';

  return (
    <header className="window-titlebar" aria-label="Application titlebar and toolbar">
      <div
        className="titlebar-left"
        data-tauri-drag-region
        onMouseDown={handleDragMouseDown}
      >
        <div className="titlebar-brand" data-tauri-drag-region>
          <span className="titlebar-brand-badge" data-tauri-drag-region>
            <img src={APP_ICONS.field} alt="" />
          </span>
          <span className="titlebar-app-name" data-tauri-drag-region>
            farmDB
          </span>
        </div>

        <div className="titlebar-breadcrumb" data-tauri-drag-region>
          {minimal ? (
            <span className="titlebar-module-name" data-tauri-drag-region>
              {statusLabel ?? 'Offline Livestock Ledger'}
            </span>
          ) : (
            <>
              <img
                src={breadcrumbIcon}
                alt=""
                className="titlebar-module-icon"
                data-tauri-drag-region
              />
              <span className="titlebar-module-name" data-tauri-drag-region>
                {breadcrumbLabel}
              </span>
              {!authPortalOpen && sectionCount !== null ? (
                <span className="titlebar-count-chip" data-tauri-drag-region>
                  {sectionCount}
                </span>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div
        className="titlebar-drag-spacer"
        data-tauri-drag-region
        onMouseDown={handleDragMouseDown}
      />

      {!minimal ? (
        <div className="titlebar-toolbar">
          <div className="titlebar-sync-group">
            <button
              type="button"
              className={`titlebar-sync-status ${
                hasCloudCredentials ? 'is-cloud' : 'is-local'
              } ${syncFeedback ? 'is-synced' : ''}`}
              onClick={onOpenSettings}
              disabled={!onOpenSettings}
              title={
                hasCloudCredentials
                  ? `${dbEngineText} · Supabase Cloud Sync configured (click for Settings)`
                  : `${dbEngineText} · Offline local database only (click to configure Cloud Sync)`
              }
            >
              <img
                src={
                  hasCloudCredentials
                    ? APP_ICONS.databaseCloud
                    : APP_ICONS.databaseLeaf
                }
                alt=""
                className="titlebar-pill-icon"
              />
              <span className="titlebar-sync-engine">{dbEngineText}</span>
              <span className="titlebar-dot" aria-hidden="true" />
              <span className="titlebar-sync-label">{cloudStatusText}</span>
              {syncFeedback && !isSyncing ? (
                <Check size={12} strokeWidth={2.5} />
              ) : null}
            </button>

            {canSyncCloud && onTriggerCloudSync ? (
              <button
                type="button"
                className="titlebar-sync-btn"
                onClick={onTriggerCloudSync}
                disabled={isSyncing}
                title="Sync local SQLite database with Supabase cloud"
                aria-label="Sync local database with cloud"
              >
                <RefreshCw
                  size={13}
                  className={isSyncing ? 'titlebar-spin' : undefined}
                />
                <span className="titlebar-btn-text">
                  {isSyncing ? 'Syncing' : 'Sync'}
                </span>
              </button>
            ) : null}
          </div>

          <button
            type="button"
            className={`titlebar-action-btn ${
              openAlertCount > 0 ? 'has-alerts' : ''
            }`}
            onClick={onOpenAlerts}
            disabled={!onOpenAlerts}
            title={
              openAlertCount > 0
                ? `${openAlertCount} open alert${openAlertCount === 1 ? '' : 's'} — view Alerts & Notes`
                : 'View Alerts & Notes'
            }
          >
            <img
              src={APP_ICONS.notification}
              alt=""
              className="titlebar-pill-icon"
            />
            <span className="titlebar-btn-text">Alerts</span>
            {openAlertCount > 0 ? (
              <span className="titlebar-alert-badge">{openAlertCount}</span>
            ) : null}
          </button>

          <button
            type="button"
            className="titlebar-account-pill"
            onClick={onOpenAccountPortal}
            disabled={!onOpenAccountPortal}
            title="Open Farm Network, Join Keys & Account settings"
          >
            <img
              src={
                isAdminAccount(activeAccount)
                  ? APP_ICONS.networking
                  : APP_ICONS.farmer
              }
              alt=""
              className="titlebar-pill-icon"
            />
            <span className="titlebar-account-name">
              {activeAccount?.displayName ?? 'Farm Owner (Admin)'}
            </span>
            <span className="titlebar-account-tier">
              {formatAccountTierLabel(activeAccount)}
            </span>
          </button>
        </div>
      ) : null}

      <div className="window-controls" role="group" aria-label="Window controls">
        <button
          type="button"
          className="window-ctrl-btn"
          onClick={handleMinimize}
          disabled={!isTauri}
          title={isTauri ? 'Minimize window' : 'Minimize (desktop app only)'}
          aria-label="Minimize window"
        >
          <Minus size={14} strokeWidth={1.8} />
        </button>

        <button
          type="button"
          className="window-ctrl-btn"
          onClick={handleToggleMaximize}
          title={isMaximized ? 'Restore window' : 'Maximize window'}
          aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
        >
          {isMaximized ? (
            <RestoreWindowIcon />
          ) : (
            <Square size={11} strokeWidth={1.8} />
          )}
        </button>

        <button
          type="button"
          className="window-ctrl-btn is-close"
          onClick={handleClose}
          disabled={!isTauri}
          title={isTauri ? 'Close window' : 'Close (desktop app only)'}
          aria-label="Close window"
        >
          <X size={15} strokeWidth={1.8} />
        </button>
      </div>
    </header>
  );
}
