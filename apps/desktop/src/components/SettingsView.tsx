import React, { useEffect, useMemo, useState } from 'react';
import {
  CURRENCY_OPTIONS,
  DATE_FORMATS,
  DEFAULT_FARM_SETTINGS,
  describeModuleAccessLevel,
  FONT_SCALES,
  formatCurrency,
  formatSpeciesLabel,
  generateSupabaseSetupSql,
  isAdminAccount,
  SPECIES_LIST,
  SYNC_CONFLICT_STRATEGIES,
  UI_DENSITIES,
  VOLUME_UNITS,
  type CloudSyncDirection,
  type DateFormatPreference,
  type FarmSettings,
  type FontScale,
  type SyncConflictStrategy,
  type UiDensity,
  type VolumeUnit,
} from '@farmdb/core';
import {
  useActiveFarmAccount,
  useClearCloudSyncLogs,
  useCloudSyncLogs,
  useFarmSettings,
  useModulePermissions,
  useResetFarmSettings,
  useTriggerCloudSync,
  useUpdateFarmAccount,
  useUpdateFarmSettings,
} from '@farmdb/db';
import {
  APP_ICONS,
  getCurrencyFlagIcon,
  getSpeciesPngIcon,
} from '../assets/icons';
import type { TauriSqlController } from '../db/tauriDriver';
import {
  getDesktopSqliteStorageInfo,
  relocateDesktopSqliteStorage,
  resetDesktopSqliteStorage,
  setDesktopSqliteReadOnlyProtection,
  type SqliteStorageInfo,
} from '../services/exportBackup';
import { isTauriEnvironment } from '../services/imageStorage';
import { FileTabs } from './FileTabs';
import { ModernSelect, type ModernSelectOption } from './ModernSelect';
import { NumberStepper } from './NumberStepper';

interface SettingsViewProps {
  sqlController?: TauriSqlController | null;
  onOpenBackup: () => void;
  onOpenTutorial?: () => void;
}

const FONT_SCALE_LABELS: Record<FontScale, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  xlarge: 'Extra Large',
};

const UI_DENSITY_LABELS: Record<UiDensity, string> = {
  compact: 'Compact',
  comfortable: 'Comfortable',
  spacious: 'Spacious',
};

const DATE_FORMAT_LABELS: Record<DateFormatPreference, string> = {
  iso: 'YYYY-MM-DD',
  mdy: 'MM/DD/YYYY',
  dmy: 'DD/MM/YYYY',
};

const VOLUME_UNIT_LABELS: Record<VolumeUnit, string> = {
  liters: 'Liters (L)',
  gallons: 'US Gallons (gal)',
};

interface IntervalPresetOption {
  value: number;
  label: string;
}

const INTERVAL_PRESETS: readonly IntervalPresetOption[] = [
  { value: 30, label: '30s' },
  { value: 60, label: '1m' },
  { value: 300, label: '5m' },
  { value: 900, label: '15m' },
];

const LEAD_DAYS_PRESETS: readonly IntervalPresetOption[] = [
  { value: 0, label: 'Due Day' },
  { value: 1, label: '1d' },
  { value: 3, label: '3d' },
  { value: 7, label: '7d' },
  { value: 14, label: '14d' },
];

const CLOUD_SYNC_PRESETS: readonly IntervalPresetOption[] = [
  { value: 60, label: '1m' },
  { value: 120, label: '2m' },
  { value: 300, label: '5m' },
  { value: 900, label: '15m' },
];

function PresetStrip({
  label,
  value,
  presets,
  onSelect,
}: {
  label: string;
  value: string;
  presets: readonly IntervalPresetOption[];
  onSelect: (nextValue: string) => void;
}) {
  const numericValue = Number(value);
  return (
    <div className="preset-strip" role="group" aria-label={label}>
      {presets.map((preset) => (
        <button
          key={preset.value}
          type="button"
          className={`preset-strip-btn${numericValue === preset.value ? ' active' : ''}`}
          onClick={() => onSelect(String(preset.value))}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}

function getSyncStrategyLabel(strategy: SyncConflictStrategy): string {
  switch (strategy) {
    case 'last_write_wins':
      return 'Latest Edit Wins (Recommended)';
    case 'local_priority':
      return 'Prefer Local Device SQLite';
    case 'cloud_priority':
      return 'Prefer Supabase Cloud Database';
  }
}

export function SettingsView({
  sqlController,
  onOpenBackup,
  onOpenTutorial,
}: SettingsViewProps) {
  const settingsQuery = useFarmSettings();
  const updateMutation = useUpdateFarmSettings();
  const updateAccountMutation = useUpdateFarmAccount();
  const resetMutation = useResetFarmSettings();
  const activeAccountQuery = useActiveFarmAccount();
  const { canEdit, canDelete, accessLevel } = useModulePermissions('settings');
  const logsQuery = useCloudSyncLogs(30);
  const syncMut = useTriggerCloudSync();
  const clearLogsMut = useClearCloudSyncLogs();

  const settings = settingsQuery.data ?? DEFAULT_FARM_SETTINGS;
  const activeAccount = activeAccountQuery.data;
  const syncLogs = logsQuery.data ?? [];
  const isAdmin = isAdminAccount(activeAccount);
  const isAdminOrManager = isAdmin;
  const inTauri = isTauriEnvironment();
  const [storageInfo, setStorageInfo] = useState<SqliteStorageInfo | null>(null);
  const [storageBusy, setStorageBusy] = useState(false);

  useEffect(() => {
    if (!inTauri) return;
    void getDesktopSqliteStorageInfo()
      .then(setStorageInfo)
      .catch(() => setStorageInfo(null));
  }, [inTauri]);

  async function handleChangeStorageDir() {
    if (!sqlController) return;
    setStorageFeedback(null);
    setStorageBusy(true);
    try {
      const updated = await relocateDesktopSqliteStorage(sqlController);
      if (updated) {
        setStorageInfo(updated);
        setStorageFeedback({
          kind: 'ok',
          text: `Moved native SQLite database to ${updated.dbPath}. External writes are ${updated.readOnlyProtection ? 'blocked (read-only protected)' : 'unlocked'}.`,
        });
      }
    } catch (err) {
      setStorageFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Unable to move SQLite database folder.',
      });
    } finally {
      setStorageBusy(false);
    }
  }

  async function handleResetStorageDir() {
    if (!sqlController) return;
    setStorageFeedback(null);
    setStorageBusy(true);
    try {
      const updated = await resetDesktopSqliteStorage(sqlController);
      setStorageInfo(updated);
      setStorageFeedback({
        kind: 'ok',
        text: `Restored native SQLite database to default folder: ${updated.dbPath}`,
      });
    } catch (err) {
      setStorageFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Unable to reset SQLite storage folder.',
      });
    } finally {
      setStorageBusy(false);
    }
  }

  async function handleToggleReadOnlyProtection(enabled: boolean) {
    setStorageFeedback(null);
    setStorageBusy(true);
    try {
      const updated = await setDesktopSqliteReadOnlyProtection(enabled);
      setStorageInfo(updated);
      setStorageFeedback({
        kind: 'ok',
        text: enabled
          ? 'Read-only file protection enabled: native SQLite .db is read-only outside farmDB.'
          : 'Read-only file protection paused.',
      });
    } catch (err) {
      setStorageFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Unable to update read-only protection.',
      });
    } finally {
      setStorageBusy(false);
    }
  }

  const [farmName, setFarmName] = useState(settings.farmName);
  const [currencySymbol, setCurrencySymbol] = useState(settings.currencySymbol);
  const [rateText, setRateText] = useState(
    settings.defaultMilkRatePerLiter.toFixed(2)
  );
  const [intervalText, setIntervalText] = useState(
    String(settings.alertCheckIntervalSeconds)
  );
  const [leadDaysText, setLeadDaysText] = useState(
    String(settings.paymentAlertLeadDays)
  );
  const [activeTab, setActiveTab] = useState<'settings' | 'advanced' | 'logs'>('settings');
  const [confirmReset, setConfirmReset] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [storageFeedback, setStorageFeedback] = useState<{
    kind: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [cloudFeedback, setCloudFeedback] = useState<{
    kind: 'ok' | 'err';
    text: string;
  } | null>(null);

  // Cloud & Supabase settings state
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );
  const [cloudEnabled, setCloudEnabled] = useState(settings.cloudSyncEnabled);
  const [supabaseUrl, setSupabaseUrl] = useState(settings.supabaseUrl);
  const [supabaseKey, setSupabaseKey] = useState(settings.supabaseAnonKey);
  const [showKey, setShowKey] = useState(false);
  const [workspaceId, setWorkspaceId] = useState(settings.cloudWorkspaceId);
  const [autoSync, setAutoSync] = useState(settings.autoSyncOnInternet);
  const [syncIntervalSec, setSyncIntervalSec] = useState(
    String(settings.cloudSyncIntervalSeconds)
  );
  const [conflictStrategy, setConflictStrategy] = useState<SyncConflictStrategy>(
    settings.syncConflictStrategy
  );
  const [syncFinancials, setSyncFinancials] = useState(
    settings.syncIncludeFinancials
  );
  const [syncHr, setSyncHr] = useState(settings.syncIncludeHr);

  const supabaseSql = useMemo(() => generateSupabaseSetupSql(), []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (settingsQuery.data) {
      setFarmName(settingsQuery.data.farmName);
      setCurrencySymbol(settingsQuery.data.currencySymbol);
      setRateText(settingsQuery.data.defaultMilkRatePerLiter.toFixed(2));
      setIntervalText(String(settingsQuery.data.alertCheckIntervalSeconds));
      setLeadDaysText(String(settingsQuery.data.paymentAlertLeadDays));
      setCloudEnabled(settingsQuery.data.cloudSyncEnabled);
      setSupabaseUrl(settingsQuery.data.supabaseUrl);
      setSupabaseKey(settingsQuery.data.supabaseAnonKey);
      setWorkspaceId(settingsQuery.data.cloudWorkspaceId);
      setAutoSync(settingsQuery.data.autoSyncOnInternet);
      setSyncIntervalSec(String(settingsQuery.data.cloudSyncIntervalSeconds));
      setConflictStrategy(settingsQuery.data.syncConflictStrategy);
      setSyncFinancials(settingsQuery.data.syncIncludeFinancials);
      setSyncHr(settingsQuery.data.syncIncludeHr);
    }
  }, [settingsQuery.data]);

  async function persistCloudAndAdminCredentials() {
    await updateMutation.mutateAsync({
      cloudSyncEnabled: cloudEnabled,
      supabaseUrl,
      supabaseAnonKey: supabaseKey,
      cloudWorkspaceId: workspaceId,
      autoSyncOnInternet: autoSync,
      cloudSyncIntervalSeconds: Number(syncIntervalSec),
      syncConflictStrategy: conflictStrategy,
      syncIncludeFinancials: syncFinancials,
      syncIncludeHr: syncHr,
    });
    const activeAcc = activeAccountQuery.data;
    if (
      activeAcc &&
      isAdminAccount(activeAcc) &&
      supabaseUrl.trim().length > 0 &&
      supabaseKey.trim().length > 0
    ) {
      await updateAccountMutation.mutateAsync({
        id: activeAcc.id,
        input: {
          supabaseUrl: supabaseUrl.trim(),
          supabaseAnonKey: supabaseKey.trim(),
          cloudWorkspaceId: workspaceId.trim() || 'farmdb-homestead-main',
        },
      });
    }
  }

  async function handleSaveCloudSettings(e: React.FormEvent) {
    e.preventDefault();
    setCloudFeedback(null);
    try {
      await persistCloudAndAdminCredentials();
      setCloudFeedback({
        kind: 'ok',
        text: 'Saved Supabase credentials to local SQLite and active Admin account.',
      });
    } catch (err) {
      setCloudFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Invalid Supabase settings.',
      });
    }
  }

  async function handleSyncAction(direction: CloudSyncDirection) {
    setCloudFeedback(null);
    try {
      await persistCloudAndAdminCredentials();
      const res = await syncMut.mutateAsync(direction);
      setCloudFeedback({
        kind: res.ok ? 'ok' : 'err',
        text: res.message,
      });
    } catch (err) {
      setCloudFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Supabase sync failed.',
      });
    }
  }

  async function patchSetting(
    patch: Partial<FarmSettings>,
    successText = 'Preference updated.'
  ) {
    if (!canEdit) return;
    setFeedback(null);
    try {
      await updateMutation.mutateAsync(patch);
      setFeedback({ kind: 'ok', text: successText });
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Unable to save setting.',
      });
    }
  }

  async function handleSaveNumericAndText(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    setFeedback(null);
    try {
      await updateMutation.mutateAsync({
        farmName,
        currencySymbol,
        defaultMilkRatePerLiter: Number(rateText),
        alertCheckIntervalSeconds: Number(intervalText),
        paymentAlertLeadDays: Number(leadDaysText),
      });
      setFeedback({
        kind: 'ok',
        text: 'Farm profile, financial defaults, and alert cadence saved.',
      });
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Invalid settings input.',
      });
    }
  }

  async function handleResetDefaults() {
    if (!canDelete) return;
    setFeedback(null);
    try {
      await resetMutation.mutateAsync();
      setConfirmReset(false);
      setFeedback({
        kind: 'ok',
        text: 'All preferences restored to recommended defaults.',
      });
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Could not reset settings.',
      });
    }
  }

  const currencyPresetOptions = useMemo<ModernSelectOption<string>[]>(
    () => [
      ...CURRENCY_OPTIONS.map((opt) => ({
        value: opt.symbol,
        label: opt.label,
        iconSrc: getCurrencyFlagIcon(opt.flagKey),
      })),
      {
        value: '__custom__',
        label: 'Custom Symbol...',
        iconSrc: APP_ICONS.dollarSymbol,
      },
    ],
    []
  );

  const isPresetCurrency = CURRENCY_OPTIONS.some(
    (opt) => opt.symbol === currencySymbol
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings &amp; Preferences</h1>
          <p className="page-subtitle">
            Customize typography, UI spacing, regional formatting, and workflow defaults for your operation.
          </p>
        </div>

        <div className="row-actions">
          {(!canEdit || !canDelete) && (
            <span className="status-pill status-sold">
              {describeModuleAccessLevel(accessLevel)}
            </span>
          )}
          {!isAdmin && (
            <span className="status-pill status-active">
              {activeAccount?.canSyncCloud
                ? 'User Account · Connected to Admin Network'
                : 'User Account · Local SQLite'}
            </span>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onOpenBackup}
          >
            <img src={APP_ICONS.databaseCloud} alt="" className="app-icon-sm" />
            Export &amp; Backup
          </button>
          {onOpenTutorial && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onOpenTutorial}
            >
              <img src={APP_ICONS.copyWriting} alt="" className="app-icon-sm" />
              App Guide
            </button>
          )}
        </div>
      </div>

      {!canEdit && (
        <div className="notice-banner" role="status" style={{ marginBottom: 14 }}>
          <span>
            Settings are currently read-only for your account ({describeModuleAccessLevel(accessLevel)}). Ask your Farm Admin to grant Edit or Full permission to modify preferences.
          </span>
        </div>
      )}

      <FileTabs
        ariaLabel="Settings sections"
        surface="page"
        activeId={activeTab}
        onChange={setActiveTab}
        tabs={[
          {
            id: 'settings',
            label: 'Settings',
            iconSrc: APP_ICONS.settings,
          },
          {
            id: 'advanced',
            label: 'Advanced Settings',
            iconSrc: APP_ICONS.databaseCloud,
          },
          ...(isAdmin
            ? [
                {
                  id: 'logs' as const,
                  label: `Sync Logs (${syncLogs.length})`,
                  iconSrc: APP_ICONS.dataSync,
                },
              ]
            : []),
        ]}
      />

      {activeTab === 'settings' && feedback && (
        <div
          className={
            feedback.kind === 'ok' ? 'alert-toast-banner' : 'notice-banner'
          }
          role="status"
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setFeedback(null)}
          >
            <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
            Dismiss
          </button>
        </div>
      )}

      {isAdmin && activeTab === 'logs' ? (
        <section className="card">
          {cloudFeedback && (
            <div
              className={
                cloudFeedback.kind === 'ok' ? 'alert-toast-banner' : 'notice-banner'
              }
              role={cloudFeedback.kind === 'err' ? 'alert' : 'status'}
              style={{ marginBottom: 14 }}
            >
              <span>{cloudFeedback.text}</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCloudFeedback(null)}
              >
                <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
                Dismiss
              </button>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="settings-card-icon">
                <img src={APP_ICONS.dataSync} alt="" className="app-icon-sm" />
              </div>
              <div>
                <h2 className="card-section-title" style={{ margin: 0 }}>
                  Cloud Sync Activity Logs ({syncLogs.length})
                </h2>
                <p className="page-subtitle" style={{ margin: 0, fontSize: '0.84rem' }}>
                  History of Supabase push, pull, two-way synchronization, and connection checks.
                </p>
              </div>
            </div>
            <div className="row-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={syncMut.isPending}
                onClick={() => void handleSyncAction('bidirectional')}
              >
                <img src={APP_ICONS.dataSync} alt="" className="app-icon-sm" />
                {syncMut.isPending ? 'Syncing...' : 'Two-Way Sync Now'}
              </button>
              {syncLogs.length > 0 && isAdminOrManager && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void clearLogsMut.mutateAsync()}
                >
                  Clear Logs
                </button>
              )}
            </div>
          </div>

          {syncLogs.length === 0 ? (
            <div className="empty-state">
              No cloud sync activity recorded yet. Configure Supabase under Settings &amp; Cloud DB or click Two-Way Sync Now.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Direction</th>
                    <th>Status</th>
                    <th>Pulled / Pushed</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>{log.direction}</td>
                      <td>
                        <span
                          className={`status-pill ${log.status === 'success'
                            ? 'status-active'
                            : log.status === 'offline'
                              ? 'status-sold'
                              : 'status-deceased'
                            }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td>
                        {log.recordsPulled} pulled / {log.recordsPushed} pushed
                      </td>
                      <td>{log.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : activeTab === 'settings' ? (
        <div className="settings-grid">
            <div className="settings-column">
              <section className="card settings-card">
                <div className="settings-card-header">
                  <div className="settings-card-title-row">
                    <div className="settings-card-icon">
                      <img src={APP_ICONS.settings} alt="" className="app-icon-sm" />
                    </div>
                    <h2 className="card-section-title" style={{ margin: 0 }}>
                      Appearance &amp; Readability
                    </h2>
                  </div>
                  <p className="page-subtitle" style={{ margin: 0, fontSize: '0.84rem' }}>
                    Adjust text scale and UI control sizing without changing farmDB colors.
                  </p>
                </div>

                <div className="settings-field-group">
                  <label className="form-label">Font Size</label>
                  <div className="segmented-group" role="group" aria-label="Font Size">
                    {FONT_SCALES.map((scale) => (
                      <button
                        key={scale}
                        type="button"
                        disabled={!canEdit}
                        className={`segmented-btn ${settings.fontScale === scale ? 'active' : ''
                          }`}
                        onClick={() =>
                          void patchSetting(
                            { fontScale: scale },
                            `Font size set to ${FONT_SCALE_LABELS[scale]}.`
                          )
                        }
                      >
                        {FONT_SCALE_LABELS[scale]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="settings-field-group">
                  <label className="form-label">UI Element Size &amp; Density</label>
                  <div
                    className="segmented-group"
                    role="group"
                    aria-label="UI Element Size"
                  >
                    {UI_DENSITIES.map((density) => (
                      <button
                        key={density}
                        type="button"
                        disabled={!canEdit}
                        className={`segmented-btn ${settings.uiDensity === density ? 'active' : ''
                          }`}
                        onClick={() =>
                          void patchSetting(
                            { uiDensity: density },
                            `UI element sizing set to ${UI_DENSITY_LABELS[density]}.`
                          )
                        }
                      >
                        {UI_DENSITY_LABELS[density]}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="card settings-card">
                <div className="settings-card-header">
                  <div className="settings-card-title-row">
                    <div className="settings-card-icon">
                      <img src={APP_ICONS.notification} alt="" className="app-icon-sm" />
                    </div>
                    <h2 className="card-section-title" style={{ margin: 0 }}>
                      Automation, Notifications &amp; Safety
                    </h2>
                  </div>
                  <p className="page-subtitle" style={{ margin: 0, fontSize: '0.84rem' }}>
                    Control auto-ledger creation, local reminders, delete prompts, and defaults.
                  </p>
                </div>

                <div className="toggle-list">
                  <label className="toggle-card">
                    <div>
                      <div className="form-label">Auto-record milk sale income</div>
                      <div className="rate-preview">
                        Pre-select automatic financial income when logging milk yields.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={settings.autoRecordMilkSaleByDefault}
                      onChange={(e) =>
                        void patchSetting(
                          { autoRecordMilkSaleByDefault: e.target.checked },
                          'Milk sale automation default updated.'
                        )
                      }
                    />
                  </label>

                  <label className="toggle-card">
                    <div>
                      <div className="form-label">Auto-record medical expenses</div>
                      <div className="rate-preview">
                        Pre-select automatic expense entries for treatments with cost &gt; 0.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={settings.autoRecordMedicalExpenseByDefault}
                      onChange={(e) =>
                        void patchSetting(
                          { autoRecordMedicalExpenseByDefault: e.target.checked },
                          'Medical expense automation default updated.'
                        )
                      }
                    />
                  </label>

                  <label className="toggle-card">
                    <div>
                      <div className="form-label">Auto-record salary payments as expenses</div>
                      <div className="rate-preview">
                        Pre-select automatic Payroll Expense creation in Financial Ledger when paying workers.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={settings.autoRecordPayrollExpenseByDefault}
                      onChange={(e) =>
                        void patchSetting(
                          { autoRecordPayrollExpenseByDefault: e.target.checked },
                          'Payroll expense automation default updated.'
                        )
                      }
                    />
                  </label>

                  <label className="toggle-card">
                    <div>
                      <div className="form-label">Background due-alert notifications</div>
                      <div className="rate-preview">
                        Check SQLite periodically and notify when scheduled tasks fall due.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={settings.enableNotifications}
                      onChange={(e) =>
                        void patchSetting(
                          { enableNotifications: e.target.checked },
                          e.target.checked
                            ? 'Background alert notifications enabled.'
                            : 'Background alert notifications paused.'
                        )
                      }
                    />
                  </label>

                  <label className="toggle-card">
                    <div>
                      <div className="form-label">Confirm before deleting records</div>
                      <div className="rate-preview">
                        Require a confirmation click before removing animals, logs, or alerts.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={settings.confirmBeforeDelete}
                      onChange={(e) =>
                        void patchSetting(
                          { confirmBeforeDelete: e.target.checked },
                          e.target.checked
                            ? 'Delete confirmation protection enabled.'
                            : 'Single-click delete enabled.'
                        )
                      }
                    />
                  </label>
                </div>

                <div className="section-divider" />

                <div className="settings-footer-bar">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src={APP_ICONS.databaseLeaf} alt="" className="app-icon-sm" />
                    <span className="rate-preview">
                      All settings are stored locally inside SQLite <code>farm_settings</code>.
                    </span>
                  </div>

                  {canDelete ? (
                    confirmReset ? (
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={resetMutation.isPending}
                          onClick={() => void handleResetDefaults()}
                        >
                          <img src={APP_ICONS.checkmark} alt="" className="app-icon-sm" />
                          Confirm Reset
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setConfirmReset(false)}
                        >
                          <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
                          Keep Current
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setConfirmReset(true)}
                      >
                        <img src={APP_ICONS.sync} alt="" className="app-icon-sm" />
                        Reset Defaults
                      </button>
                    )
                  ) : (
                    <span className="rate-preview">Full privilege required to reset defaults</span>
                  )}
                </div>
              </section>
            </div>

            <div className="settings-column">
              <section className="card settings-card">
                <div className="settings-card-header">
                  <div className="settings-card-title-row">
                    <div className="settings-card-icon">
                      <img src={APP_ICONS.calendar} alt="" className="app-icon-sm" />
                    </div>
                    <h2 className="card-section-title" style={{ margin: 0 }}>
                      Formatting &amp; Herd Defaults
                    </h2>
                  </div>
                  <p className="page-subtitle" style={{ margin: 0, fontSize: '0.84rem' }}>
                    Applies immediately across logs, analytics cards, and new animal forms.
                  </p>
                </div>

                <div className="settings-field-group">
                  <label className="form-label">Date Format</label>
                  <div className="segmented-group" role="group" aria-label="Date Format">
                    {DATE_FORMATS.map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        disabled={!canEdit}
                        className={`segmented-btn ${settings.dateFormat === fmt ? 'active' : ''
                          }`}
                        onClick={() =>
                          void patchSetting(
                            { dateFormat: fmt },
                            `Date format set to ${DATE_FORMAT_LABELS[fmt]}.`
                          )
                        }
                      >
                        {DATE_FORMAT_LABELS[fmt]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="settings-field-group">
                  <label className="form-label">Milk Yield Display Unit</label>
                  <div
                    className="segmented-group"
                    role="group"
                    aria-label="Milk Volume Unit"
                  >
                    {VOLUME_UNITS.map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        disabled={!canEdit}
                        className={`segmented-btn ${settings.volumeUnit === unit ? 'active' : ''
                          }`}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        onClick={() =>
                          void patchSetting(
                            { volumeUnit: unit },
                            `Milk yields will display in ${VOLUME_UNIT_LABELS[unit]}.`
                          )
                        }
                      >
                        <img
                          src={unit === 'liters' ? APP_ICONS.liter : APP_ICONS.gallon}
                          alt=""
                          className="app-icon-sm"
                        />
                        {VOLUME_UNIT_LABELS[unit]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="settings-field-group">
                  <label className="form-label">Default Species for New Livestock</label>
                  <div
                    className="segmented-group"
                    role="group"
                    aria-label="Default Livestock Species"
                  >
                    {SPECIES_LIST.map((sp) => (
                      <button
                        key={sp}
                        type="button"
                        disabled={!canEdit}
                        className={`segmented-btn ${settings.defaultSpecies === sp ? 'active' : ''
                          }`}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        onClick={() =>
                          void patchSetting(
                            { defaultSpecies: sp },
                            `Default species set to ${formatSpeciesLabel(sp)}.`
                          )
                        }
                      >
                        <img src={getSpeciesPngIcon(sp)} alt="" className="app-icon-sm" />
                        {formatSpeciesLabel(sp)}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="card settings-card">
                <div className="settings-card-header">
                  <div className="settings-card-title-row">
                    <div className="settings-card-icon">
                      <img src={APP_ICONS.farmer} alt="" className="app-icon-sm" />
                    </div>
                    <h2 className="card-section-title" style={{ margin: 0 }}>
                      Farm Profile &amp; Financial Rate
                    </h2>
                  </div>
                  <p className="page-subtitle" style={{ margin: 0, fontSize: '0.84rem' }}>
                    Configure your operation header, currency (USD, UGX, GBP), default milk price, and check interval.
                  </p>
                </div>

                <form className="settings-form" onSubmit={handleSaveNumericAndText}>
                  <fieldset
                    disabled={!canEdit}
                    style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
                  >
                    <div className="form-grid">
                      <div className="form-field full">
                        <label className="form-label" htmlFor="set-farm-name">
                          Farm / Operation Name
                        </label>
                        <input
                          id="set-farm-name"
                          className="input"
                          value={farmName}
                          maxLength={60}
                          onChange={(e) => setFarmName(e.target.value)}
                          placeholder="farmDB Homestead"
                        />
                      </div>

                      <div className="form-field">
                        <label className="form-label" htmlFor="set-currency-preset">
                          Currency
                        </label>
                        <ModernSelect
                          id="set-currency-preset"
                          fullWidth
                          value={isPresetCurrency ? currencySymbol : '__custom__'}
                          options={currencyPresetOptions}
                          ariaLabel="Select currency"
                          onChange={(next) => {
                            if (!canEdit) return;
                            if (next === '__custom__') {
                              setCurrencySymbol((prev) =>
                                CURRENCY_OPTIONS.some((o) => o.symbol === prev)
                                  ? ''
                                  : prev
                              );
                            } else {
                              setCurrencySymbol(next);
                              void patchSetting(
                                { currencySymbol: next },
                                `Currency set to ${next}.`
                              );
                            }
                          }}
                        />
                        {!isPresetCurrency && (
                          <input
                            id="set-currency"
                            className="input"
                            style={{ marginTop: 6 }}
                            value={currencySymbol}
                            maxLength={6}
                            onChange={(e) => setCurrencySymbol(e.target.value)}
                            placeholder="Enter symbol (e.g. KES)"
                          />
                        )}
                      </div>

                      <div className="form-field">
                        <label className="form-label" htmlFor="set-milk-rate">
                          Default Milk Rate ({currencySymbol || '$'} / Liter)
                        </label>
                        <NumberStepper
                          id="set-milk-rate"
                          ariaLabel="Default Milk Rate"
                          min={0}
                          step={currencySymbol === 'UGX' ? 100 : 0.05}
                          decimals={currencySymbol === 'UGX' ? 0 : 2}
                          value={rateText}
                          onChange={setRateText}
                        />
                      </div>

                      <div className="form-field full">
                        <label className="form-label" htmlFor="set-alert-interval">
                          Alert Check Interval (seconds: 15–3600)
                        </label>
                        <div className="inline-rate-row">
                          <img src={APP_ICONS.hourglass} alt="" className="app-icon-md" />
                          <NumberStepper
                            id="set-alert-interval"
                            ariaLabel="Alert Check Interval"
                            compact
                            min={15}
                            max={3600}
                            step={5}
                            decimals={0}
                            value={intervalText}
                            onChange={setIntervalText}
                          />
                          <PresetStrip
                            label="Alert check interval presets"
                            value={intervalText}
                            presets={INTERVAL_PRESETS}
                            onSelect={setIntervalText}
                          />
                        </div>
                      </div>

                      <div className="form-field full">
                        <label className="form-label" htmlFor="set-payment-lead-days">
                          Alert Before Worker Payment Due (days: 0–30)
                        </label>
                        <div className="inline-rate-row">
                          <img src={APP_ICONS.money} alt="" className="app-icon-md" />
                          <NumberStepper
                            id="set-payment-lead-days"
                            ariaLabel="Payment Alert Lead Days"
                            compact
                            min={0}
                            max={30}
                            step={1}
                            decimals={0}
                            value={leadDaysText}
                            onChange={setLeadDaysText}
                          />
                          <PresetStrip
                            label="Payment lead days presets"
                            value={leadDaysText}
                            presets={LEAD_DAYS_PRESETS}
                            onSelect={setLeadDaysText}
                          />
                        </div>
                      </div>
                    </div>
                  </fieldset>

                  <div className="settings-actions" style={{ marginTop: 6 }}>
                    {canEdit && (
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={updateMutation.isPending}
                      >
                        <img src={APP_ICONS.checkmark} alt="" className="app-icon-sm" />
                        {updateMutation.isPending ? 'Saving...' : 'Save Profile & Rates'}
                      </button>
                    )}
                    <span className="rate-preview">
                      10 L est.:{' '}
                      <strong>
                        {formatCurrency(
                          (Number(rateText) || 0) * 10,
                          currencySymbol || '$'
                        )}
                      </strong>
                    </span>
                  </div>
                </form>
              </section>
            </div>
          </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="settings-card-icon">
                  <img src={APP_ICONS.databaseLeaf} alt="" className="app-icon-sm" />
                </div>
                <div>
                  <h2 className="card-section-title" style={{ margin: 0 }}>
                    Native SQLite Database Storage &amp; Read-Only Protection
                  </h2>
                  <p className="page-subtitle" style={{ margin: 0, fontSize: '0.84rem' }}>
                    Choose where your native SQLite database file is stored and lock it against external modification outside farmDB.
                  </p>
                </div>
              </div>

              {inTauri && storageInfo && (
                <div className="row-actions">
                  <span className={`status-pill ${storageInfo.isCustomLocation ? 'status-active' : 'status-sold'}`}>
                    {storageInfo.isCustomLocation ? 'Custom Storage Folder' : 'Default App Folder'}
                  </span>
                  <span className={`status-pill ${storageInfo.isFileReadOnly ? 'status-active' : 'status-sold'}`}>
                    {storageInfo.isFileReadOnly ? 'Read-Only Outside App Active' : 'Unlocked'}
                  </span>
                </div>
              )}
            </div>

            {!inTauri ? (
              <p className="rate-preview" style={{ margin: 0 }}>
                Running in web preview mode. Native SQLite folder relocation and OS-level read-only file protection are active in the Desktop Tauri app.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="toggle-card" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 6 }}>
                  <div className="form-label">Active SQLite Database File</div>
                  <code style={{ wordBreak: 'break-all', fontSize: '0.82rem' }}>
                    {storageInfo?.dbPath ?? 'Inspecting SQLite storage path...'}
                  </code>
                  {storageInfo && (
                    <span className="rate-preview">
                      File size: {(storageInfo.fileSizeBytes / 1024).toFixed(1)} KB
                      {storageInfo.isFileReadOnly
                        ? ' · Protected by OS read-only attribute + verified shadow copy when idle'
                        : ' · External write protection currently paused'}
                    </span>
                  )}
                </div>

                <label className="toggle-card">
                  <div>
                    <div className="form-label">
                      Read-Only File Protection (Prevent External Modification / Corruption)
                    </div>
                    <div className="rate-preview">
                      Keeps native SQLite <code>.db</code> files read-only on disk except during verified transactions inside farmDB, and maintains an internal verified copy against tampering.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={storageInfo?.readOnlyProtection ?? true}
                    disabled={storageBusy || !(isAdmin || canDelete)}
                    onChange={(e) => void handleToggleReadOnlyProtection(e.target.checked)}
                  />
                </label>

                {storageFeedback && (
                  <div
                    className={
                      storageFeedback.kind === 'ok'
                        ? 'alert-toast-banner'
                        : 'notice-banner'
                    }
                    role={storageFeedback.kind === 'err' ? 'alert' : 'status'}
                  >
                    <span>{storageFeedback.text}</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setStorageFeedback(null)}
                    >
                      <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
                      Dismiss
                    </button>
                  </div>
                )}

                <div className="settings-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={storageBusy || !sqlController || !(isAdmin || canDelete)}
                    onClick={() => void handleChangeStorageDir()}
                  >
                    <img src={APP_ICONS.databaseLeaf} alt="" className="app-icon-sm" />
                    {storageBusy ? 'Updating SQLite Storage...' : 'Change Storage Folder...'}
                  </button>
                  {storageInfo?.isCustomLocation && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={storageBusy || !sqlController || !(isAdmin || canDelete)}
                      onClick={() => void handleResetStorageDir()}
                    >
                      <img src={APP_ICONS.sync} alt="" className="app-icon-sm" />
                      Reset to Default Folder
                    </button>
                  )}
                  {!(isAdmin || canDelete) && (
                    <span className="rate-preview">
                      Admin or Full Settings access required to relocate database files or toggle file lock.
                    </span>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Database Cloud Sync & Supabase */}
          {isAdmin ? (
            <section className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="settings-card-icon">
                    <img src={APP_ICONS.cloudHosting} alt="" className="app-icon-sm" />
                  </div>
                  <div>
                    <h2 className="card-section-title" style={{ margin: 0 }}>
                      Cloud Sync &amp; Supabase Database
                    </h2>
                    <p className="page-subtitle" style={{ margin: 0, fontSize: '0.84rem' }}>
                      Link your local SQLite database to Supabase so connected accounts and farm records sync automatically when online.
                    </p>
                  </div>
                </div>

                <span
                  className={`cloud-status-pill ${isOnline && settings.supabaseUrl ? 'is-online' : 'is-offline'}`}
                >
                  <img
                    src={
                      !isOnline
                        ? APP_ICONS.cloudOffline
                        : settings.supabaseUrl
                          ? APP_ICONS.cloudHosting
                          : APP_ICONS.web
                    }
                    alt=""
                    className="app-icon-sm"
                  />
                  {!isOnline
                    ? 'Offline · SQLite Queue Active'
                    : settings.supabaseUrl
                      ? settings.cloudSyncEnabled
                        ? 'Internet Online · Supabase Ready'
                        : 'Supabase Linked (Manual Sync)'
                      : 'Supabase Not Configured'}
                </span>
              </div>

              {cloudFeedback && (
                <div
                  className={
                    cloudFeedback.kind === 'ok'
                      ? 'alert-toast-banner'
                      : 'notice-banner'
                  }
                  role={cloudFeedback.kind === 'err' ? 'alert' : 'status'}
                  style={{ marginBottom: 12 }}
                >
                  <span>{cloudFeedback.text}</span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setCloudFeedback(null)}
                  >
                    <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
                    Dismiss
                  </button>
                </div>
              )}

              <div className="network-sync-actions-bar" style={{ marginBottom: 16 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={syncMut.isPending}
                  onClick={() => void handleSyncAction('test')}
                >
                  <img src={APP_ICONS.web} alt="" className="app-icon-sm" />
                  Test Connection
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={syncMut.isPending}
                  onClick={() => void handleSyncAction('bidirectional')}
                >
                  <img src={APP_ICONS.dataSync} alt="" className="app-icon-sm" />
                  {syncMut.isPending ? 'Syncing...' : 'Two-Way Sync Now'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={syncMut.isPending}
                  onClick={() => void handleSyncAction('push')}
                >
                  <img src={APP_ICONS.uploadArrow} alt="" className="app-icon-sm" />
                  Push Local → Cloud
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={syncMut.isPending}
                  onClick={() => void handleSyncAction('pull')}
                >
                  <img src={APP_ICONS.downloadDrive} alt="" className="app-icon-sm" />
                  Pull Cloud → Local
                </button>
              </div>

              <form onSubmit={handleSaveCloudSettings} className="split-grid">
                <div className="settings-form">
                  <div className="form-grid">
                    <div className="form-field full">
                      <label className="form-label">Supabase Project URL</label>
                      <input
                        className="input"
                        value={supabaseUrl}
                        onChange={(e) => setSupabaseUrl(e.target.value)}
                        placeholder="https://your-project-ref.supabase.co"
                      />
                    </div>
                    <div className="form-field full">
                      <label className="form-label">
                        Supabase Anon / Publishable Key
                      </label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          className="input"
                          type={showKey ? 'text' : 'password'}
                          value={supabaseKey}
                          onChange={(e) => setSupabaseKey(e.target.value)}
                          placeholder="sb_publishable_... or eyJhbGci..."
                        />
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setShowKey((prev) => !prev)}
                        >
                          {showKey ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </div>
                    <div className="form-field">
                      <label className="form-label">Shared Workspace ID</label>
                      <input
                        className="input"
                        value={workspaceId}
                        onChange={(e) => setWorkspaceId(e.target.value)}
                        placeholder="farmdb-homestead-main"
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Sync Conflict Resolution</label>
                      <ModernSelect
                        fullWidth
                        value={conflictStrategy}
                        options={SYNC_CONFLICT_STRATEGIES.map((st) => ({
                          value: st,
                          label: getSyncStrategyLabel(st),
                          iconSrc: APP_ICONS.dataSync,
                        }))}
                        onChange={setConflictStrategy}
                      />
                    </div>
                    <div className="form-field full">
                      <label className="form-label" htmlFor="set-cloud-interval">
                        Auto-Sync Interval (seconds: 30–86400)
                      </label>
                      <div className="inline-rate-row">
                        <img src={APP_ICONS.sync} alt="" className="app-icon-md" />
                        <NumberStepper
                          id="set-cloud-interval"
                          ariaLabel="Auto-Sync Interval"
                          compact
                          min={30}
                          max={86400}
                          step={30}
                          decimals={0}
                          value={syncIntervalSec}
                          onChange={setSyncIntervalSec}
                        />
                        <PresetStrip
                          label="Auto-sync interval presets"
                          value={syncIntervalSec}
                          presets={CLOUD_SYNC_PRESETS}
                          onSelect={setSyncIntervalSec}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                    <label className="toggle-card">
                      <div>
                        <div className="form-label">Enable Supabase Cloud Sync</div>
                        <div className="rate-preview">
                          Link this device&apos;s local SQLite database with your Supabase cloud workspace.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={cloudEnabled}
                        onChange={(e) => setCloudEnabled(e.target.checked)}
                      />
                    </label>

                    <label className="toggle-card">
                      <div>
                        <div className="form-label">
                          Auto-sync automatically when internet connects
                        </div>
                        <div className="rate-preview">
                          Runs bidirectional sync whenever internet connection returns and on schedule.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={autoSync}
                        onChange={(e) => setAutoSync(e.target.checked)}
                      />
                    </label>

                    <label className="toggle-card">
                      <div>
                        <div className="form-label">Include Financial Ledger in cloud sync</div>
                        <div className="rate-preview">
                          Share farm income &amp; expense logs across synced devices.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={syncFinancials}
                        onChange={(e) => setSyncFinancials(e.target.checked)}
                      />
                    </label>

                    <label className="toggle-card">
                      <div>
                        <div className="form-label">
                          Include Human Resources &amp; payroll in cloud sync
                        </div>
                        <div className="rate-preview">
                          Keep worker profiles, tasks, and wage statuses synced across devices.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={syncHr}
                        onChange={(e) => setSyncHr(e.target.checked)}
                      />
                    </label>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={updateMutation.isPending}
                    >
                      <img src={APP_ICONS.checkmark} alt="" className="app-icon-sm" />
                      Save Cloud Settings
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h3 className="card-section-title" style={{ margin: 0 }}>
                      Supabase SQL Setup Script
                    </h3>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        void navigator.clipboard?.writeText(supabaseSql);
                        setCloudFeedback({
                          kind: 'ok',
                          text: 'Copied Supabase SQL setup script to clipboard.',
                        });
                      }}
                    >
                      Copy SQL
                    </button>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 0 }}>
                    Run this once in your Supabase SQL Editor so both desktop and mobile apps can sync local SQLite snapshots reliably via HTTPS REST.
                  </p>
                  <pre className="sql-preview-box">{supabaseSql}</pre>
                </div>
              </form>
            </section>
          ) : (
            <section className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="settings-card-icon">
                    <img src={APP_ICONS.cloudHosting} alt="" className="app-icon-sm" />
                  </div>
                  <div>
                    <h2 className="card-section-title" style={{ margin: 0 }}>
                      Cloud Sync &amp; Supabase Database
                    </h2>
                    <p className="page-subtitle" style={{ margin: 0, fontSize: '0.84rem' }}>
                      {activeAccount?.canSyncCloud
                        ? 'Your User Account is linked to the Admin cloud workspace via Network Join Key.'
                        : 'Running on local SQLite storage only. Join an Admin network from Farm Network to link a cloud database.'}
                    </p>
                  </div>
                </div>
                <span
                  className={`cloud-status-pill ${isOnline && settings.supabaseUrl ? 'is-online' : 'is-offline'}`}
                >
                  {!isOnline
                    ? 'Offline · Local SQLite Active'
                    : settings.supabaseUrl
                      ? 'Connected to Admin Cloud DB'
                      : 'Local SQLite Only'}
                </span>
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
