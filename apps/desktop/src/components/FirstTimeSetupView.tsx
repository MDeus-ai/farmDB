import { useEffect, useMemo, useRef, useState } from 'react';
import {
  canAccountEditModule,
  CURRENCY_OPTIONS,
  DEFAULT_FARM_SETTINGS,
  encodeFarmNetworkJoinKey,
  FONT_SCALE_HINTS,
  FONT_SCALES,
  formatCurrency,
  generateSupabaseSetupSql,
  isAdminAccount,
  UI_DENSITIES,
  UI_DENSITY_HINTS,
  VOLUME_UNIT_HINTS,
  VOLUME_UNITS,
  type FarmAccount,
  type FarmSettings,
  type FontScale,
  type UiDensity,
  type VolumeUnit,
} from '@farmdb/core';
import {
  useFarmSettings,
  useTriggerCloudSync,
  useUpdateFarmAccount,
  useUpdateFarmSettings,
} from '@farmdb/db';
import { APP_ICONS, getCurrencyFlagIcon } from '../assets/icons';
import type { TauriSqlController } from '../db/tauriDriver';
import {
  getDesktopSqliteStorageInfo,
  relocateDesktopSqliteStorage,
  resetDesktopSqliteStorage,
  setDesktopSqliteReadOnlyProtection,
  type SqliteStorageInfo,
} from '../services/exportBackup';
import { isTauriEnvironment } from '../services/imageStorage';
import { ModernSelect, type ModernSelectOption } from './ModernSelect';

interface FirstTimeSetupViewProps {
  activeAccount: FarmAccount;
  sqlController?: TauriSqlController | null;
  onComplete: () => void;
}

const FONT_SCALE_LABELS: Record<FontScale, string> = {
  small: 'Small',
  medium: 'Medium (Default)',
  large: 'Large',
  xlarge: 'Extra Large',
};

const UI_DENSITY_LABELS: Record<UiDensity, string> = {
  compact: 'Compact',
  comfortable: 'Comfortable (Default)',
  spacious: 'Spacious',
};

const VOLUME_UNIT_LABELS: Record<VolumeUnit, string> = {
  liters: 'Liters (L)',
  gallons: 'US Gallons (gal)',
};

export function FirstTimeSetupView({
  activeAccount,
  sqlController,
  onComplete,
}: FirstTimeSetupViewProps) {
  const settingsQuery = useFarmSettings();
  const currentSettings = settingsQuery.data ?? DEFAULT_FARM_SETTINGS;
  const updateSettingsMut = useUpdateFarmSettings();
  const updateAccountMut = useUpdateFarmAccount();
  const syncMut = useTriggerCloudSync();

  const isAdmin = isAdminAccount(activeAccount);
  const canEditSettings = canAccountEditModule(activeAccount, 'settings');
  const inTauri = isTauriEnvironment();

  const [fontScale, setFontScale] = useState<FontScale>(currentSettings.fontScale);
  const [uiDensity, setUiDensity] = useState<UiDensity>(currentSettings.uiDensity);
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>(currentSettings.volumeUnit);
  const [currencySymbol, setCurrencySymbol] = useState<string>(
    currentSettings.currencySymbol
  );

  // Native SQLite DB Location State
  const [storageInfo, setStorageInfo] = useState<SqliteStorageInfo | null>(null);
  const [storageBusy, setStorageBusy] = useState(false);
  const [storageFeedback, setStorageFeedback] = useState<{
    kind: 'ok' | 'err';
    text: string;
  } | null>(null);

  // Admin Optional Cloud Setup State
  const [configureCloudNow, setConfigureCloudNow] = useState(false);
  const [showSqlScript, setShowSqlScript] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState(currentSettings.supabaseUrl);
  const [supabaseKey, setSupabaseKey] = useState(currentSettings.supabaseAnonKey);
  const [showKey, setShowKey] = useState(false);
  const [workspaceId, setWorkspaceId] = useState(
    currentSettings.cloudWorkspaceId || 'farmdb-homestead-main'
  );
  const [cloudEnabled, setCloudEnabled] = useState(currentSettings.cloudSyncEnabled);
  const [autoSync, setAutoSync] = useState(currentSettings.autoSyncOnInternet);
  const [cloudTestFeedback, setCloudTestFeedback] = useState<{
    kind: 'ok' | 'err';
    text: string;
  } | null>(null);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const mainScrollRef = useRef<HTMLElement | null>(null);

  const wizardSteps = useMemo(() => {
    const base = [
      { id: 'db' as const, shortLabel: '1. DB Location', title: 'Location of Your Databases (SQLite)' },
      { id: 'font' as const, shortLabel: '2. Font Size', title: 'Font Size' },
      { id: 'density' as const, shortLabel: '3. UI Size', title: 'UI Element Size (Spacing & Buttons)' },
      { id: 'units' as const, shortLabel: '4. Units', title: 'Milk / Volume Units' },
      { id: 'currency' as const, shortLabel: '5. Currency', title: 'Currency' },
    ];
    if (isAdmin && canEditSettings) {
      return [
        ...base,
        {
          id: 'cloud' as const,
          shortLabel: '6. Cloud DB (Optional)',
          title: 'Optional: Supabase Cloud DB Setup',
        },
      ];
    }
    return base;
  }, [isAdmin, canEditSettings]);

  const safeStepIndex = Math.min(stepIndex, wizardSteps.length - 1);
  const activeStep = wizardSteps[safeStepIndex];
  const isFirstStep = safeStepIndex === 0;
  const isLastStep = safeStepIndex === wizardSteps.length - 1;

  function goToStep(nextIndex: number) {
    const clamped = Math.max(0, Math.min(nextIndex, wizardSteps.length - 1));
    setStepIndex(clamped);
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  useEffect(() => {
    setFontScale(currentSettings.fontScale);
    setUiDensity(currentSettings.uiDensity);
    setVolumeUnit(currentSettings.volumeUnit);
    setCurrencySymbol(currentSettings.currencySymbol);
    setSupabaseUrl(currentSettings.supabaseUrl);
    setSupabaseKey(currentSettings.supabaseAnonKey);
    setWorkspaceId(currentSettings.cloudWorkspaceId || 'farmdb-homestead-main');
    setCloudEnabled(currentSettings.cloudSyncEnabled);
    setAutoSync(currentSettings.autoSyncOnInternet);
  }, [currentSettings]);

  useEffect(() => {
    if (!inTauri) return;
    let active = true;
    void getDesktopSqliteStorageInfo()
      .then((info) => {
        if (active) setStorageInfo(info);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [inTauri]);

  const supabaseSql = useMemo(() => generateSupabaseSetupSql(), []);
  const previewCloudKey = useMemo(() => {
    const url = supabaseUrl.trim();
    const key = supabaseKey.trim();
    if (!url || !key) return '';
    return encodeFarmNetworkJoinKey({
      joinCode: currentSettings.networkJoinKey || 'FARM-7842',
      workspaceId: workspaceId.trim() || 'farmdb-homestead-main',
      farmName: currentSettings.farmName || 'farmDB Homestead',
      supabaseUrl: url,
      supabaseAnonKey: key,
    });
  }, [
    supabaseUrl,
    supabaseKey,
    workspaceId,
    currentSettings.networkJoinKey,
    currentSettings.farmName,
  ]);

  const isPresetCurrency = CURRENCY_OPTIONS.some(
    (c) => c.symbol === currencySymbol
  );

  const currencyOptions = useMemo<ModernSelectOption<string>[]>(
    () => [
      ...CURRENCY_OPTIONS.map((opt) => ({
        value: opt.symbol,
        label: opt.label,
        iconSrc: getCurrencyFlagIcon(opt.flagKey),
        hint: opt.code,
      })),
      {
        value: '__custom__',
        label: 'Custom Currency Symbol',
        iconSrc: APP_ICONS.money,
        hint: 'Custom',
      },
    ],
    []
  );

  async function handleChooseDbFolder() {
    if (!sqlController) return;
    setStorageBusy(true);
    setStorageFeedback(null);
    try {
      const updated = await relocateDesktopSqliteStorage(sqlController);
      if (updated) {
        setStorageInfo(updated);
        setStorageFeedback({
          kind: 'ok',
          text: `Database moved to ${updated.dbPath}.`,
        });
      }
    } catch (err) {
      setStorageFeedback({
        kind: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'Could not move SQLite database folder.',
      });
    } finally {
      setStorageBusy(false);
    }
  }

  async function handleResetDbFolder() {
    if (!sqlController) return;
    setStorageBusy(true);
    setStorageFeedback(null);
    try {
      const updated = await resetDesktopSqliteStorage(sqlController);
      setStorageInfo(updated);
      setStorageFeedback({
        kind: 'ok',
        text: `Database kept in default protected folder: ${updated.dbPath}`,
      });
    } catch (err) {
      setStorageFeedback({
        kind: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'Could not reset SQLite storage folder.',
      });
    } finally {
      setStorageBusy(false);
    }
  }

  async function handleToggleReadOnly(enabled: boolean) {
    setStorageBusy(true);
    setStorageFeedback(null);
    try {
      const updated = await setDesktopSqliteReadOnlyProtection(enabled);
      setStorageInfo(updated);
      setStorageFeedback({
        kind: 'ok',
        text: enabled
          ? 'Read-only file lock enabled between writes + verified shadow backup active.'
          : 'Read-only disk lock paused.',
      });
    } catch (err) {
      setStorageFeedback({
        kind: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'Could not change read-only protection.',
      });
    } finally {
      setStorageBusy(false);
    }
  }

  async function handleTestCloudConnection() {
    setCloudTestFeedback(null);
    const trimmedUrl = supabaseUrl.trim();
    const trimmedKey = supabaseKey.trim();
    const trimmedWs = workspaceId.trim() || 'farmdb-homestead-main';
    if (!trimmedUrl || !trimmedKey) {
      setCloudTestFeedback({
        kind: 'err',
        text: 'Enter your Supabase Project URL and Anon/Publishable Key from Step 3 before testing.',
      });
      return;
    }
    try {
      await updateSettingsMut.mutateAsync({
        supabaseUrl: trimmedUrl,
        supabaseAnonKey: trimmedKey,
        cloudWorkspaceId: trimmedWs,
      });
      const res = await syncMut.mutateAsync('test');
      setCloudTestFeedback({
        kind: res.ok ? 'ok' : 'err',
        text: res.message,
      });
    } catch (err) {
      setCloudTestFeedback({
        kind: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'Failed to connect to Supabase.',
      });
    }
  }

  async function handleFinish(applyPreferences: boolean) {
    setSubmitError(null);
    setIsFinishing(true);
    try {
      if (applyPreferences && canEditSettings) {
        const cleanCurrency = currencySymbol.trim() || '$';
        const patch: Partial<FarmSettings> = {
          fontScale,
          uiDensity,
          volumeUnit,
          currencySymbol: cleanCurrency,
        };
        const hasCloudInputs =
          isAdmin &&
          configureCloudNow &&
          supabaseUrl.trim().length > 0 &&
          supabaseKey.trim().length > 0;
        if (hasCloudInputs) {
          patch.supabaseUrl = supabaseUrl.trim();
          patch.supabaseAnonKey = supabaseKey.trim();
          patch.cloudWorkspaceId = workspaceId.trim() || 'farmdb-homestead-main';
          patch.cloudSyncEnabled = cloudEnabled;
          patch.autoSyncOnInternet = autoSync;
        }
        await updateSettingsMut.mutateAsync(patch);

        await updateAccountMut.mutateAsync({
          id: activeAccount.id,
          input: {
            onboardingCompleted: true,
            ...(hasCloudInputs
              ? {
                  supabaseUrl: supabaseUrl.trim(),
                  supabaseAnonKey: supabaseKey.trim(),
                  cloudWorkspaceId:
                    workspaceId.trim() || 'farmdb-homestead-main',
                }
              : {}),
          },
        });
      } else {
        await updateAccountMut.mutateAsync({
          id: activeAccount.id,
          input: { onboardingCompleted: true },
        });
      }
      onComplete();
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Could not save initial setup preferences.'
      );
    } finally {
      setIsFinishing(false);
    }
  }

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.fontScale = fontScale;
    root.dataset.uiDensity = uiDensity;
    return () => {
      root.dataset.fontScale = currentSettings.fontScale;
      root.dataset.uiDensity = currentSettings.uiDensity;
    };
  }, [fontScale, uiDensity, currentSettings.fontScale, currentSettings.uiDensity]);

  const heroFontLabel = FONT_SCALE_LABELS[fontScale].replace(/\s*\(Default\)$/, '');
  const heroDensityLabel = UI_DENSITY_LABELS[uiDensity].replace(/\s*\(Default\)$/, '');
  const sampleVolumeText =
    volumeUnit === 'gallons' ? '3.3 gal / cow' : '12.5 L / cow';
  const sampleMoneyText = formatCurrency(
    currencySymbol === 'UGX' ? 45000 : 125,
    currencySymbol || '$'
  );

  return (
    <div
      className="auth-portal-backdrop"
      data-font-scale={fontScale}
      data-ui-density={uiDensity}
    >
      <div className="auth-portal-shell onboarding-shell">
        <aside className="auth-portal-hero">
          <img
            src={APP_ICONS.sprout}
            alt=""
            className="auth-hero-watermark"
            aria-hidden="true"
          />

          <div className="auth-hero-brand">
            <div className="brand-mark">
              <img src={APP_ICONS.field} alt="farmDB logo" />
            </div>
            <div>
              <p className="brand-title">farmDB Setup</p>
              <p className="brand-sub">First-Time Account Welcome</p>
            </div>
          </div>

          <div>
            <span className="auth-hero-kicker">
              <img src={APP_ICONS.checkmark} alt="" className="app-icon-sm" />
              Appears Once Per New Account
            </span>
            <h1 className="auth-hero-title">
              Welcome, {activeAccount.displayName}
            </h1>
            <p className="auth-hero-copy">
              Take a moment to set your preferred database location, text size,
              button spacing, milk units, and currency. You only see this setup
              wizard once on your first sign-in — and you can adjust everything
              anytime later in Settings.
            </p>
          </div>

          <div className="auth-hero-features">
            <div className="auth-hero-feature">
              <img src={APP_ICONS.databaseLeaf} alt="" />
              <div>
                <strong>1. Local SQLite Storage</strong>
                <span>
                  Choose where your private farm database lives on disk with
                  tamper protection.
                </span>
              </div>
            </div>
            <div className="auth-hero-feature">
              <img src={APP_ICONS.settings} alt="" />
              <div>
                <strong>2. Live Text &amp; Button Sizing</strong>
                <span>
                  Click Small–Extra Large or Compact–Spacious on the right to
                  preview live sizing immediately: {sampleVolumeText} ·{' '}
                  {sampleMoneyText}
                </span>
              </div>
            </div>
            {isAdmin ? (
              <div className="auth-hero-feature">
                <img src={APP_ICONS.cloudHosting} alt="" />
                <div>
                  <strong>3. Optional Admin Cloud DB</strong>
                  <span>
                    Keep everything offline-only or follow the 4-step Supabase
                    guide to sync with family &amp; phone devices.
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="auth-hero-footer onboarding-hero-footer">
            <div className="auth-hero-stat">
              <strong>{heroFontLabel}</strong>
              <span>Font Size</span>
            </div>
            <div className="auth-hero-stat">
              <strong>{heroDensityLabel}</strong>
              <span>UI Element Size</span>
            </div>
            <div className="auth-hero-stat">
              <strong>{currencySymbol || '$'} / {volumeUnit === 'gallons' ? 'gal' : 'L'}</strong>
              <span>Currency &amp; Unit</span>
            </div>
          </div>
        </aside>

        <main className="auth-portal-main" ref={mainScrollRef}>
          <div className="auth-portal-main-inner onboarding-main-inner">
            <div className="auth-portal-brand-row">
              <div>
                <h2 className="page-title" style={{ marginBottom: 4 }}>
                  Personalize Your Workspace
                </h2>
                <p className="page-subtitle" style={{ margin: 0 }}>
                  Configure one setting per step — each includes a plain
                  explanation of what it controls.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={isFinishing}
                onClick={() => void handleFinish(false)}
              >
                Skip Setup
              </button>
            </div>

            <div className="onboarding-wizard-progress">
              <div className="onboarding-progress-head">
                <span>
                  Step {safeStepIndex + 1} of {wizardSteps.length} — {activeStep.title}
                </span>
                <span className="rate-preview">
                  {Math.round(((safeStepIndex + 1) / wizardSteps.length) * 100)}% complete
                </span>
              </div>
              <div className="onboarding-progress-track">
                <div
                  className="onboarding-progress-fill"
                  style={{
                    width: `${((safeStepIndex + 1) / wizardSteps.length) * 100}%`,
                  }}
                />
              </div>
              <div className="onboarding-step-pills" role="tablist" aria-label="Setup steps">
                {wizardSteps.map((step, idx) => {
                  const statusClass =
                    idx === safeStepIndex
                      ? 'is-active'
                      : idx < safeStepIndex
                        ? 'is-done'
                        : '';
                  return (
                    <button
                      key={step.id}
                      type="button"
                      role="tab"
                      aria-selected={idx === safeStepIndex}
                      className={`onboarding-step-pill ${statusClass}`}
                      onClick={() => goToStep(idx)}
                    >
                      {step.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            {!canEditSettings && (
              <div className="notice-banner" role="status">
                <span>
                  Shared farm preferences (units, currency) are managed by your
                  Farm Administrator. Review the active settings below and
                  continue into farmDB.
                </span>
              </div>
            )}

            {submitError && (
              <div className="notice-banner" role="alert">
                <span>{submitError}</span>
              </div>
            )}

            {/* Step 1: Location of the DBs */}
            {activeStep.id === 'db' && (
            <section className="card onboarding-card">
              <div className="onboarding-card-header">
                <div className="settings-card-icon">
                  <img src={APP_ICONS.databaseLeaf} alt="" className="app-icon-sm" />
                </div>
                <div>
                  <h3 className="card-section-title" style={{ margin: 0 }}>
                    1. Location of Your Databases (Local SQLite Storage)
                  </h3>
                  <p className="onboarding-explain">
                    farmDB saves all herd records, milk logs, finances, and
                    account profiles into a local SQLite database file (
                    <code>farmdb.db</code>) on your computer first — so it works
                    offline without internet.
                  </p>
                </div>
              </div>

              {!inTauri ? (
                <p className="rate-preview" style={{ margin: 0 }}>
                  Currently previewing in browser mode. In the installed Desktop
                  software, your SQLite file defaults to a protected AppData
                  folder and can be relocated to any custom folder here.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div
                    className="toggle-card"
                    style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 4 }}
                  >
                    <div className="form-label">Active Database File Path</div>
                    <code style={{ wordBreak: 'break-all', fontSize: '0.8rem' }}>
                      {storageInfo?.dbPath ?? 'Resolving SQLite storage path...'}
                    </code>
                    {storageInfo && (
                      <span className="rate-preview">
                        {storageInfo.isCustomLocation
                          ? 'Custom Folder'
                          : 'Default Protected App Folder'}{' '}
                        · {(storageInfo.fileSizeBytes / 1024).toFixed(1)} KB
                      </span>
                    )}
                  </div>

                  <label className="toggle-card">
                    <div>
                      <div className="form-label">Read-Only Disk Protection</div>
                      <div className="rate-preview">
                        Keeps <code>farmdb.db</code> read-only on disk outside
                        verified app writes to protect against accidental
                        corruption.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={storageInfo?.readOnlyProtection ?? true}
                      disabled={storageBusy || !canEditSettings}
                      onChange={(e) =>
                        void handleToggleReadOnly(e.target.checked)
                      }
                    />
                  </label>

                  {storageFeedback && (
                    <div
                      className={
                        storageFeedback.kind === 'ok'
                          ? 'alert-toast-banner'
                          : 'notice-banner'
                      }
                    >
                      <span>{storageFeedback.text}</span>
                    </div>
                  )}

                  {canEditSettings && (
                    <div className="settings-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={storageBusy || !sqlController}
                        onClick={() => void handleChooseDbFolder()}
                      >
                        <img src={APP_ICONS.databaseLeaf} alt="" className="app-icon-sm" />
                        Choose DB Folder...
                      </button>
                      {storageInfo?.isCustomLocation && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={storageBusy || !sqlController}
                          onClick={() => void handleResetDbFolder()}
                        >
                          Reset to Default Folder
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
            )}

            {/* Step 2: Font Size */}
            {activeStep.id === 'font' && (
              <section className="card onboarding-card">
                <div className="onboarding-card-header">
                  <div className="settings-card-icon">
                    <img src={APP_ICONS.settings} alt="" className="app-icon-sm" />
                  </div>
                  <div>
                    <h3 className="card-section-title" style={{ margin: 0 }}>
                      2. Font Size
                    </h3>
                    <p className="onboarding-explain">
                      Controls how large words, table entries, labels, and numbers
                      appear across every screen of farmDB. Click any option
                      below to preview the text scale immediately.
                    </p>
                  </div>
                </div>

                <div className="form-field full">
                  <label className="form-label">Preferred Font Size</label>
                  <div className="segmented-group">
                    {FONT_SCALES.map((scale) => (
                      <button
                        key={scale}
                        type="button"
                        disabled={!canEditSettings}
                        title={FONT_SCALE_HINTS[scale]}
                        className={`segmented-btn ${fontScale === scale ? 'active' : ''}`}
                        onClick={() => setFontScale(scale)}
                      >
                        {FONT_SCALE_LABELS[scale]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="onboarding-live-preview">
                  <span className="onboarding-live-preview-kicker">
                    Live Text Preview — {heroFontLabel}
                  </span>
                  <strong style={{ fontSize: '1.05rem', color: 'var(--dark-header)' }}>
                    Clover (COW-512) · Holstein · {sampleVolumeText}
                  </strong>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                    Today&apos;s milk logs, alerts, and financial ledgers scale
                    proportionally so everything remains easy to read.
                  </span>
                </div>
              </section>
            )}

            {/* Step 3: UI Element Size */}
            {activeStep.id === 'density' && (
              <section className="card onboarding-card">
                <div className="onboarding-card-header">
                  <div className="settings-card-icon">
                    <img src={APP_ICONS.settings} alt="" className="app-icon-sm" />
                  </div>
                  <div>
                    <h3 className="card-section-title" style={{ margin: 0 }}>
                      3. UI Element Size (Spacing &amp; Buttons)
                    </h3>
                    <p className="onboarding-explain">
                      Adjusts button heights, input box padding, card margins, and
                      row spacing. Choose <strong>Compact</strong> to see more
                      records per screen, or <strong>Spacious</strong> for larger
                      targets.
                    </p>
                  </div>
                </div>

                <div className="form-field full">
                  <label className="form-label">Preferred UI Element Size</label>
                  <div className="segmented-group">
                    {UI_DENSITIES.map((density) => (
                      <button
                        key={density}
                        type="button"
                        disabled={!canEditSettings}
                        title={UI_DENSITY_HINTS[density]}
                        className={`segmented-btn ${uiDensity === density ? 'active' : ''}`}
                        onClick={() => setUiDensity(density)}
                      >
                        {UI_DENSITY_LABELS[density]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="onboarding-live-preview">
                  <span className="onboarding-live-preview-kicker">
                    Live Element Spacing Preview — {heroDensityLabel}
                  </span>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-primary" tabIndex={-1}>
                      Sample Action Button
                    </button>
                    <input
                      readOnly
                      className="input"
                      style={{ maxWidth: 240 }}
                      value="Sample input spacing"
                    />
                  </div>
                </div>
              </section>
            )}

            {/* Step 4: Units */}
            {activeStep.id === 'units' && (
              <section className="card onboarding-card">
                <div className="onboarding-card-header">
                  <div className="settings-card-icon">
                    <img src={APP_ICONS.liter} alt="" className="app-icon-sm" />
                  </div>
                  <div>
                    <h3 className="card-section-title" style={{ margin: 0 }}>
                      4. Milk &amp; Volume Units
                    </h3>
                    <p className="onboarding-explain">
                      Chooses whether daily milk yields, herd production averages,
                      and analytics charts display in <strong>Liters (L)</strong>{' '}
                      or <strong>US Gallons (gal)</strong>. Stored records convert
                      automatically if changed later.
                    </p>
                  </div>
                </div>

                <div className="form-field full">
                  <label className="form-label">Milk / Volume Units</label>
                  <div className="segmented-group">
                    {VOLUME_UNITS.map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        disabled={!canEditSettings}
                        title={VOLUME_UNIT_HINTS[unit]}
                        className={`segmented-btn ${volumeUnit === unit ? 'active' : ''}`}
                        onClick={() => setVolumeUnit(unit)}
                      >
                        {VOLUME_UNIT_LABELS[unit]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="onboarding-live-preview">
                  <span className="onboarding-live-preview-kicker">
                    Sample Yield Format
                  </span>
                  <strong style={{ fontSize: '1.05rem', color: 'var(--dark-header)' }}>
                    Daily Recording Sample: {sampleVolumeText}
                  </strong>
                </div>
              </section>
            )}

            {/* Step 5: Currency */}
            {activeStep.id === 'currency' && (
              <section className="card onboarding-card">
                <div className="onboarding-card-header">
                  <div className="settings-card-icon">
                    <img src={APP_ICONS.dollarSymbol} alt="" className="app-icon-sm" />
                  </div>
                  <div>
                    <h3 className="card-section-title" style={{ margin: 0 }}>
                      5. Currency
                    </h3>
                    <p className="onboarding-explain">
                      Sets the currency symbol shown across milk income, medicine
                      bills, worker payroll, boarding fees, and Financial Ledger
                      summaries.
                    </p>
                  </div>
                </div>

                <div className="form-field full">
                  <label className="form-label">Currency</label>
                  <ModernSelect
                    fullWidth
                    showSelectedHint
                    disabled={!canEditSettings}
                    value={isPresetCurrency ? currencySymbol : '__custom__'}
                    options={currencyOptions}
                    ariaLabel="Select preferred currency"
                    onChange={(next) => {
                      if (next === '__custom__') {
                        setCurrencySymbol((prev) =>
                          CURRENCY_OPTIONS.some((o) => o.symbol === prev)
                            ? ''
                            : prev
                        );
                      } else {
                        setCurrencySymbol(next);
                      }
                    }}
                  />
                  {!isPresetCurrency && (
                    <input
                      className="input"
                      style={{ marginTop: 8 }}
                      disabled={!canEditSettings}
                      value={currencySymbol}
                      maxLength={6}
                      onChange={(e) => setCurrencySymbol(e.target.value)}
                      placeholder="Enter symbol (e.g. KES)"
                    />
                  )}
                </div>

                <div className="onboarding-live-preview">
                  <span className="onboarding-live-preview-kicker">
                    Formatted Money Preview
                  </span>
                  <strong style={{ fontSize: '1.05rem', color: 'var(--dark-header)' }}>
                    Sample Entry Total: {sampleMoneyText}
                  </strong>
                </div>
              </section>
            )}

            {/* 6. Admin Only: Optional Step-by-Step Supabase Cloud Setup */}
            {activeStep.id === 'cloud' && isAdmin && canEditSettings && (
              <section className="card onboarding-card">
                <div
                  className="onboarding-card-header"
                  style={{ justifyContent: 'space-between', width: '100%' }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div className="settings-card-icon">
                      <img src={APP_ICONS.cloudHosting} alt="" className="app-icon-sm" />
                    </div>
                    <div>
                      <h3 className="card-section-title" style={{ margin: 0 }}>
                        6. Optional: Step-by-Step Supabase Cloud DB Setup
                      </h3>
                      <p className="onboarding-explain">
                        Want your Desktop, phone, and family accounts to back up
                        and sync automatically over the internet? Follow these
                        optional steps now — or skip and use farmDB 100% offline.
                      </p>
                    </div>
                  </div>
                </div>

                <label className="toggle-card">
                  <div>
                    <div className="form-label">
                      Show Supabase Cloud Setup Guide Now (Optional)
                    </div>
                    <div className="rate-preview">
                      Recommended if using multiple devices or inviting family
                      accounts. You can also configure this later in Settings →
                      Advanced Settings.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={configureCloudNow}
                    onChange={(e) => setConfigureCloudNow(e.target.checked)}
                  />
                </label>

                {configureCloudNow && (
                  <div className="onboarding-cloud-steps">
                    <div className="onboarding-step-box">
                      <strong>Step 1 — Create a Free Supabase Project</strong>
                      <p>
                        Sign in at <code>supabase.com</code>, click{' '}
                        <em>New Project</em>, give it a name (e.g.{' '}
                        <code>farmDB</code>), and wait ~1 minute for provisioning.
                      </p>
                    </div>

                    <div className="onboarding-step-box">
                      <div className="onboarding-step-header">
                        <strong>Step 2 — Run the One-Time SQL Setup Script</strong>
                        <div className="onboarding-step-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            aria-expanded={showSqlScript}
                            onClick={() => setShowSqlScript((prev) => !prev)}
                          >
                            {showSqlScript ? 'Hide Script' : 'Show Script'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              void navigator.clipboard?.writeText(supabaseSql);
                              setCloudTestFeedback({
                                kind: 'ok',
                                text: 'Copied SQL setup script! Paste and Run it in Supabase SQL Editor.',
                              });
                            }}
                          >
                            Copy SQL Script
                          </button>
                        </div>
                      </div>
                      <p>
                        In your Supabase dashboard, open{' '}
                        <strong>SQL Editor → New Query</strong>, click{' '}
                        <strong>Copy SQL Script</strong> (or{' '}
                        <strong>Show Script</strong> to inspect the full code),
                        paste it, and click <strong>Run</strong> to create{' '}
                        <code>farmdb_cloud_snapshots</code>.
                      </p>
                      {showSqlScript && (
                        <pre className="sql-preview-box onboarding-sql-preview">
                          {supabaseSql}
                        </pre>
                      )}
                    </div>

                    <div className="onboarding-step-box">
                      <strong>
                        Step 3 — Copy Your Project URL, Key &amp; Test Connection
                      </strong>
                      <p>
                        In Supabase, open <strong>Project Settings → API</strong>{' '}
                        (or <em>API Keys</em>), copy the{' '}
                        <strong>Project URL</strong> and{' '}
                        <strong>Anon / Publishable Key</strong>, paste them
                        below, and choose a unique Workspace ID:
                      </p>

                      <div className="form-grid" style={{ marginTop: 8 }}>
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
                        <div className="form-field full">
                          <label className="form-label">Cloud Workspace ID</label>
                          <input
                            className="input"
                            value={workspaceId}
                            onChange={(e) => setWorkspaceId(e.target.value)}
                            placeholder="farmdb-homestead-main"
                          />
                        </div>
                      </div>

                      <div
                        className="settings-actions"
                        style={{ marginTop: 10 }}
                      >
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={syncMut.isPending}
                          onClick={() => void handleTestCloudConnection()}
                        >
                          <img src={APP_ICONS.web} alt="" className="app-icon-sm" />
                          {syncMut.isPending ? 'Testing...' : 'Test Connection'}
                        </button>
                      </div>

                      {cloudTestFeedback && (
                        <div
                          className={
                            cloudTestFeedback.kind === 'ok'
                              ? 'alert-toast-banner'
                              : 'notice-banner'
                          }
                          style={{ marginTop: 10 }}
                        >
                          <span>{cloudTestFeedback.text}</span>
                        </div>
                      )}
                    </div>

                    <div className="onboarding-step-box">
                      <strong>
                        Step 4 — Enable Auto-Sync &amp; Save Admin Cloud Key
                      </strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                        <label className="toggle-card">
                          <div>
                            <div className="form-label">Enable Cloud Sync</div>
                            <div className="rate-preview">
                              Links this device to your Supabase workspace.
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
                              Auto-sync when internet connects
                            </div>
                            <div className="rate-preview">
                              Keeps records, photos, and settings backed up
                              automatically.
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={autoSync}
                            onChange={(e) => setAutoSync(e.target.checked)}
                          />
                        </label>

                        {previewCloudKey && (
                          <div className="toggle-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                width: '100%',
                              }}
                            >
                              <span className="form-label">
                                Admin Recovery Key (Save for Other Devices)
                              </span>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  void navigator.clipboard?.writeText(previewCloudKey);
                                  setCloudTestFeedback({
                                    kind: 'ok',
                                    text: 'Copied Admin Cloud Key to clipboard.',
                                  });
                                }}
                              >
                                Copy Key
                              </button>
                            </div>
                            <code
                              style={{
                                wordBreak: 'break-all',
                                fontSize: '0.75rem',
                              }}
                            >
                              {previewCloudKey}
                            </code>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            <div className="onboarding-footer-actions">
              <div>
                {!isFirstStep ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={isFinishing}
                    onClick={() => goToStep(safeStepIndex - 1)}
                  >
                    ← Back
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={isFinishing}
                    onClick={() => void handleFinish(false)}
                  >
                    Skip for Now
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {!isLastStep ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isFinishing}
                    onClick={() => goToStep(safeStepIndex + 1)}
                  >
                    Next Step →
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isFinishing || updateSettingsMut.isPending}
                    onClick={() => void handleFinish(true)}
                  >
                    <img src={APP_ICONS.checkmark} alt="" className="app-icon-sm" />
                    {isFinishing ? 'Saving Setup...' : 'Save Preferences & Enter farmDB'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
