import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  CURRENT_RELEASE_HIGHLIGHTS,
  CURRENCY_OPTIONS,
  DATE_FORMATS,
  describeModuleAccessLevel,
  FARMDB_APP_VERSION,
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
  type Species,
  type SyncConflictStrategy,
  type UiDensity,
  type VolumeUnit,
} from '@farmdb/core';
import {
  useActiveFarmAccount,
  useClearCloudSyncLogs,
  useCloudSyncLogs,
  useModulePermissions,
  useResetFarmSettings,
  useTriggerCloudSync,
  useUpdateFarmAccount,
  useUpdateFarmSettings,
} from '@farmdb/db';
import type {
  ExpoSqlController,
  MobileStorageInfo,
} from '../db/mobileDriver';
import {
  getCurrencyFlagSource,
  getCurrencyOptionFlagSource,
  getSpeciesPngSource,
  MOBILE_APP_ICONS,
} from '../assets/icons';
import {
  FARMDB_COLORS,
  FARMDB_FONTS,
  useUiScale,
} from '../theme/uiScale';
import {
  checkMobileUpdate,
  type MobileUpdateController,
  type MobileUpdateFeedback,
} from '../services/updates';
import { AppIcon } from './FarmIcons';
import { FarmScrollView } from './FarmScrollView';
import { MobileFileTabs } from './MobileFileTabs';
import { MobileNumberStepper } from './MobileNumberStepper';
import {
  ModernDropdown,
  type ModernDropdownOption,
} from './ModernDropdown';

interface SettingsViewProps {
  sqlController?: ExpoSqlController | null;
  onOpenBackup: () => void;
  onSignOut?: () => void;
  onOpenTutorial?: () => void;
  updateController?: MobileUpdateController;
}

const FONT_SCALE_LABELS: Record<FontScale, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  xlarge: 'X-Large',
};

const UI_DENSITY_LABELS: Record<UiDensity, string> = {
  compact: 'Compact',
  comfortable: 'Comfort',
  spacious: 'Spacious',
};

const DATE_FORMAT_LABELS: Record<DateFormatPreference, string> = {
  iso: 'YYYY-MM-DD',
  mdy: 'MM/DD/YYYY',
  dmy: 'DD/MM/YYYY',
};

const VOLUME_UNIT_LABELS: Record<VolumeUnit, string> = {
  liters: 'Liters (L)',
  gallons: 'Gallons (gal)',
};

interface PresetOption {
  value: number;
  label: string;
}

const INTERVAL_PRESETS: readonly PresetOption[] = [
  { value: 30, label: '30s' },
  { value: 60, label: '1m' },
  { value: 300, label: '5m' },
  { value: 900, label: '15m' },
];

const LEAD_DAYS_PRESETS: readonly PresetOption[] = [
  { value: 0, label: '0d' },
  { value: 1, label: '1d' },
  { value: 3, label: '3d' },
  { value: 7, label: '7d' },
  { value: 14, label: '14d' },
];

const CLOUD_SYNC_PRESETS: readonly PresetOption[] = [
  { value: 60, label: '1m' },
  { value: 120, label: '2m' },
  { value: 300, label: '5m' },
  { value: 900, label: '15m' },
];

function MobileIntervalControl({
  label,
  accessibilityLabel,
  min,
  max,
  step,
  value,
  onChangeText,
  presets,
}: {
  label: string;
  accessibilityLabel: string;
  min: number;
  max: number;
  step: number;
  value: string;
  onChangeText: (next: string) => void;
  presets: readonly PresetOption[];
}) {
  const ui = useUiScale();
  const numericValue = Number(value);

  const stepperMinWidth = Math.max(118, Math.round(108 * ui.fontMult));
  const presetMinWidth = Math.max(40, Math.round(ui.font(11) * 3.2));
  const stackPresets =
    presets.length > 4 || ui.isCramped || ui.isLargeText || ui.isLargeDensity;

  return (
    <View style={{ gap: ui.space(6) }}>
      <Text style={[styles.label, { fontSize: ui.font(12) }]}>{label}</Text>
      <View
        style={[
          styles.presetRow,
          {
            gap: ui.space(8),
            flexDirection: stackPresets ? 'column' : 'row',
            alignItems: stackPresets ? 'stretch' : 'center',
          },
        ]}
      >
        <View
          style={{
            minWidth: stepperMinWidth,
            width: stackPresets ? stepperMinWidth : undefined,
            alignSelf: stackPresets ? 'flex-start' : 'auto',
            flexGrow: 0,
          }}
        >
          <MobileNumberStepper
            accessibilityLabel={accessibilityLabel}
            compact
            min={min}
            max={max}
            step={step}
            decimals={0}
            keyboardType="number-pad"
            value={value}
            onChangeText={onChangeText}
          />
        </View>
        <View
          style={[
            styles.presetBar,
            stackPresets
              ? { flex: 0, width: '100%' }
              : { minWidth: 168 },
          ]}
        >
          {presets.map((preset) => {
            const active = numericValue === preset.value;
            return (
              <Pressable
                key={`${preset.value}-${preset.label}`}
                style={[
                  styles.presetBtn,
                  active && styles.presetBtnActive,
                  {
                    minHeight: Math.max(34, ui.controlHeight - 8),
                    minWidth: stackPresets ? 0 : presetMinWidth,
                    paddingHorizontal: ui.space(4),
                    paddingVertical: ui.space(5),
                  },
                ]}
                onPress={() => onChangeText(String(preset.value))}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                  style={[
                    styles.presetBtnText,
                    active && styles.presetBtnTextActive,
                    { fontSize: ui.font(11) },
                  ]}
                >
                  {preset.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export function SettingsView({
  sqlController,
  onOpenBackup,
  onSignOut,
  onOpenTutorial,
  updateController,
}: SettingsViewProps) {
  const ui = useUiScale();
  const { settings } = ui;
  const { canEdit, canDelete, accessLevel } = useModulePermissions('settings');
  const updateMutation = useUpdateFarmSettings();
  const updateAccountMutation = useUpdateFarmAccount();
  const resetMutation = useResetFarmSettings();
  const activeAccountQuery = useActiveFarmAccount();
  const logsQuery = useCloudSyncLogs(25);
  const syncMut = useTriggerCloudSync();
  const clearLogsMut = useClearCloudSyncLogs();

  const activeAccount = activeAccountQuery.data;
  const syncLogs = logsQuery.data ?? [];
  const isAdmin = isAdminAccount(activeAccount);
  const isAdminOrManager = isAdmin;
  const [storageInfo, setStorageInfo] = useState<MobileStorageInfo | null>(null);
  const [storageBusy, setStorageBusy] = useState(false);

  useEffect(() => {
    if (!sqlController) return;
    void sqlController
      .getStorageInfo()
      .then(setStorageInfo)
      .catch(() => setStorageInfo(null));
  }, [sqlController]);

  async function handleToggleReadOnlyProtection(enabled: boolean) {
    if (!sqlController || !(isAdmin || canDelete)) return;
    setStorageFeedback(null);
    setStorageBusy(true);
    try {
      const updated = await sqlController.setReadOnlyProtection(enabled);
      setStorageInfo(updated);
      setStorageFeedback({
        kind: 'ok',
        text: enabled
          ? 'Read-only SQLite protection enabled: direct external edits blocked via PRAGMA query_only + verified copy.'
          : 'Read-only SQLite protection paused.',
      });
    } catch (err) {
      setStorageFeedback({
        kind: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'Unable to update read-only protection.',
      });
    } finally {
      setStorageBusy(false);
    }
  }

  const [farmName, setFarmName] = useState(settings.farmName);
  const [currencySymbol, setCurrencySymbol] = useState(settings.currencySymbol);
  const [useCustomCurrency, setUseCustomCurrency] = useState(
    !CURRENCY_OPTIONS.some((c) => c.symbol === settings.currencySymbol)
  );
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
  const [showSqlScript, setShowSqlScript] = useState(false);
  const [showCurrentHighlights, setShowCurrentHighlights] = useState(false);
  const [localOtaChecking, setLocalOtaChecking] = useState(false);
  const [localOtaFeedback, setLocalOtaFeedback] = useState<MobileUpdateFeedback | null>(null);

  const otaBusy = updateController
    ? updateController.checking || updateController.installing
    : localOtaChecking;
  const otaFeedback = updateController ? updateController.feedback : localOtaFeedback;
  const availableUpdate = updateController?.availableUpdate ?? null;
  const currentVersion = updateController?.currentVersion ?? FARMDB_APP_VERSION;

  async function handleCheckOtaUpdate() {
    if (updateController) {
      await updateController.onCheckForUpdates();
      return;
    }
    setLocalOtaChecking(true);
    setLocalOtaFeedback(null);
    try {
      const res = await checkMobileUpdate();
      setLocalOtaFeedback({
        kind: res.status === 'unavailable' ? 'err' : 'ok',
        text: res.message,
      });
    } catch (err) {
      setLocalOtaFeedback({
        kind: 'err',
        text:
          err instanceof Error
            ? `Update check failed: ${err.message}`
            : 'Unable to check for mobile updates.',
      });
    } finally {
      setLocalOtaChecking(false);
    }
  }

  // Cloud Sync & Supabase DB form state (database settings)
  const [cloudEnabled, setCloudEnabled] = useState(settings.cloudSyncEnabled);
  const [supabaseUrl, setSupabaseUrl] = useState(settings.supabaseUrl);
  const [supabaseKey, setSupabaseKey] = useState(settings.supabaseAnonKey);
  const [workspaceId, setWorkspaceId] = useState(settings.cloudWorkspaceId);
  const [autoSync, setAutoSync] = useState(settings.autoSyncOnInternet);
  const [cloudInterval, setCloudInterval] = useState(
    String(settings.cloudSyncIntervalSeconds)
  );
  const [strategy, setStrategy] = useState<SyncConflictStrategy>(
    settings.syncConflictStrategy
  );
  const [syncFinancials, setSyncFinancials] = useState(
    settings.syncIncludeFinancials
  );
  const [syncHr, setSyncHr] = useState(settings.syncIncludeHr);

  useEffect(() => {
    setFarmName(settings.farmName);
    setCurrencySymbol(settings.currencySymbol);
    setUseCustomCurrency(
      !CURRENCY_OPTIONS.some((c) => c.symbol === settings.currencySymbol)
    );
    setRateText(settings.defaultMilkRatePerLiter.toFixed(2));
    setIntervalText(String(settings.alertCheckIntervalSeconds));
    setLeadDaysText(String(settings.paymentAlertLeadDays));
    setCloudEnabled(settings.cloudSyncEnabled);
    setSupabaseUrl(settings.supabaseUrl);
    setSupabaseKey(settings.supabaseAnonKey);
    setWorkspaceId(settings.cloudWorkspaceId);
    setAutoSync(settings.autoSyncOnInternet);
    setCloudInterval(String(settings.cloudSyncIntervalSeconds));
    setStrategy(settings.syncConflictStrategy);
    setSyncFinancials(settings.syncIncludeFinancials);
    setSyncHr(settings.syncIncludeHr);
  }, [settings]);

  async function persistCloudForm() {
    await updateMutation.mutateAsync({
      cloudSyncEnabled: cloudEnabled,
      supabaseUrl,
      supabaseAnonKey: supabaseKey,
      cloudWorkspaceId: workspaceId,
      autoSyncOnInternet: autoSync,
      cloudSyncIntervalSeconds: Number(cloudInterval),
      syncConflictStrategy: strategy,
      syncIncludeFinancials: syncFinancials,
      syncIncludeHr: syncHr,
    });
    if (
      activeAccount &&
      isAdminAccount(activeAccount) &&
      supabaseUrl.trim().length > 0 &&
      supabaseKey.trim().length > 0
    ) {
      await updateAccountMutation.mutateAsync({
        id: activeAccount.id,
        input: {
          supabaseUrl: supabaseUrl.trim(),
          supabaseAnonKey: supabaseKey.trim(),
          cloudWorkspaceId: workspaceId.trim() || 'farmdb-homestead-main',
        },
      });
    }
  }

  async function handleSaveCloud() {
    setCloudFeedback(null);
    try {
      await persistCloudForm();
      setCloudFeedback({
        kind: 'ok',
        text: 'Saved Supabase credentials to SQLite and active Admin account.',
      });
    } catch (err) {
      setCloudFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Invalid Supabase configuration.',
      });
    }
  }

  async function handleSync(dir: CloudSyncDirection) {
    setCloudFeedback(null);
    try {
      await persistCloudForm();
      const res = await syncMut.mutateAsync(dir);
      setCloudFeedback({ kind: res.ok ? 'ok' : 'err', text: res.message });
    } catch (err) {
      setCloudFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Supabase sync failed.',
      });
    }
  }

  const dateFormatOptions = useMemo<ModernDropdownOption<DateFormatPreference>[]>(
    () =>
      DATE_FORMATS.map((fmt) => ({
        value: fmt,
        label: DATE_FORMAT_LABELS[fmt],
        iconSource: MOBILE_APP_ICONS.calendar,
        hint: fmt === 'iso' ? 'ISO standard' : fmt === 'mdy' ? 'Month first' : 'Day first',
      })),
    []
  );

  const volumeUnitOptions = useMemo<ModernDropdownOption<VolumeUnit>[]>(
    () =>
      VOLUME_UNITS.map((unit) => ({
        value: unit,
        label: VOLUME_UNIT_LABELS[unit],
        iconSource:
          unit === 'liters' ? MOBILE_APP_ICONS.liter : MOBILE_APP_ICONS.gallon,
      })),
    []
  );

  const speciesOptions = useMemo<ModernDropdownOption<Species>[]>(
    () =>
      SPECIES_LIST.map((sp) => ({
        value: sp,
        label: formatSpeciesLabel(sp),
        iconSource: getSpeciesPngSource(sp),
      })),
    []
  );

  const currencyOptions = useMemo<ModernDropdownOption<string>[]>(
    () => [
      ...CURRENCY_OPTIONS.map((opt) => ({
        value: opt.symbol,
        label: opt.label,
        iconSource: getCurrencyOptionFlagSource(opt),
        hint: opt.code,
      })),
      {
        value: '__custom__',
        label: 'Custom symbol...',
        iconSource: getCurrencyFlagSource(currencySymbol),
        hint: 'Enter any custom code or sign',
      },
    ],
    [currencySymbol]
  );

  const selectedCurrencyValue =
    !useCustomCurrency && CURRENCY_OPTIONS.some((c) => c.symbol === currencySymbol)
      ? currencySymbol
      : '__custom__';

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

  async function handleSaveProfile() {
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
        text: 'Farm profile, financial rates, and check cadence saved.',
      });
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Invalid settings input.',
      });
    }
  }

  async function handleReset() {
    if (!canDelete) return;
    setFeedback(null);
    try {
      await resetMutation.mutateAsync();
      setConfirmReset(false);
      setFeedback({
        kind: 'ok',
        text: 'Preferences restored to default settings.',
      });
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Could not reset settings.',
      });
    }
  }

  const cardStyle = [
    styles.card,
    { padding: ui.space(14), borderRadius: ui.radius, gap: ui.space(12) },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FarmScrollView
        dockAware
        contentContainerStyle={{
          padding: ui.contentPadding,
          paddingBottom: ui.bottomDockReserve,
          gap: ui.space(12),
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.topBar, { gap: ui.space(10), flexWrap: 'wrap' }]}>
          <View style={{ flex: 1, minWidth: ui.isCramped ? 220 : 180 }}>
            <Text style={[styles.heading, { fontSize: ui.font(20) }]}>
              Settings &amp; UI
            </Text>
            <Text style={[styles.subHeading, { fontSize: ui.font(12) }]}>
              Adjust readability, element sizes, formatting, and defaults
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 6,
              alignItems: 'center',
            }}
          >
            {!canEdit || !canDelete ? (
              <View style={styles.previewStatus}>
                <Text style={[styles.previewStatusText, { fontSize: ui.font(11) }]}>
                  {describeModuleAccessLevel(accessLevel)}
                </Text>
              </View>
            ) : null}
            {!isAdmin ? (
              <View style={styles.previewStatus}>
                <Text style={[styles.previewStatusText, { fontSize: ui.font(11) }]}>
                  {activeAccount?.canSyncCloud
                    ? 'User Account · Admin Network'
                    : 'User Account · Local DB'}
                </Text>
              </View>
            ) : null}
            <Pressable
              style={[
                styles.secondaryBtn,
                {
                  minHeight: ui.chipHeight + 2,
                  paddingHorizontal: ui.space(12),
                  borderRadius: 999,
                  flexDirection: 'row',
                  gap: 6,
                },
              ]}
              onPress={onOpenBackup}
              accessibilityLabel="Open Backup"
            >
              <AppIcon name="backup" size={ui.font(16)} color={FARMDB_COLORS.text} />
              {!settings.mobileIconMode ? (
                <Text style={[styles.secondaryBtnText, { fontSize: ui.font(12) }]}>
                  Backup
                </Text>
              ) : null}
            </Pressable>

            {onOpenTutorial ? (
              <Pressable
                style={[
                  styles.secondaryBtn,
                  {
                    minHeight: ui.chipHeight + 2,
                    paddingHorizontal: ui.space(12),
                    borderRadius: 999,
                    flexDirection: 'row',
                    gap: 6,
                  },
                ]}
                onPress={onOpenTutorial}
                accessibilityLabel="App Guide"
              >
                <AppIcon name="note" size={ui.font(16)} color={FARMDB_COLORS.text} />
                {!settings.mobileIconMode ? (
                  <Text style={[styles.secondaryBtnText, { fontSize: ui.font(12) }]}>
                    Guide
                  </Text>
                ) : null}
              </Pressable>
            ) : null}
          </View>
        </View>

        <MobileFileTabs
          surfaceTone="page"
          activeId={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: 'settings', label: 'Settings', icon: 'settings' },
            { id: 'advanced', label: 'Advanced Settings', icon: 'cloudHosting' },
            ...(isAdmin
              ? [{ id: 'logs' as const, label: `Sync Logs (${syncLogs.length})`, icon: 'dataSync' as const }]
              : []),
          ]}
        />

        {activeTab === 'settings' && feedback ? (
          <View
            style={[
              styles.feedbackBanner,
              feedback.kind === 'err' && styles.feedbackBannerErr,
              { padding: ui.space(11), borderRadius: ui.radius },
            ]}
          >
            <Text
              style={[
                styles.feedbackText,
                feedback.kind === 'err' && styles.feedbackTextErr,
                { fontSize: ui.font(13) },
              ]}
            >
              {feedback.text}
            </Text>
          </View>
        ) : null}

        {!canEdit ? (
          <View
            style={[
              styles.feedbackBanner,
              { padding: ui.space(11), borderRadius: ui.radius },
            ]}
          >
            <Text style={[styles.feedbackText, { fontSize: ui.font(12) }]}>
              Settings are read-only for your account ({describeModuleAccessLevel(accessLevel)}).
            </Text>
          </View>
        ) : null}

        {isAdmin && activeTab === 'logs' ? (
          <View style={cardStyle}>
            {cloudFeedback ? (
              <View
                style={[
                  styles.feedbackBanner,
                  cloudFeedback.kind === 'err' && styles.feedbackBannerErr,
                  { padding: ui.space(11), borderRadius: ui.radius },
                ]}
              >
                <Text
                  style={[
                    styles.feedbackText,
                    cloudFeedback.kind === 'err' && styles.feedbackTextErr,
                    { fontSize: ui.font(12) },
                  ]}
                >
                  {cloudFeedback.text}
                </Text>
              </View>
            ) : null}
            <View
              style={[
                styles.saveBar,
                ui.isCramped && { flexDirection: 'column', alignItems: 'flex-start' },
              ]}
            >
              <View style={styles.sectionTitleRow}>
                <AppIcon name="dataSync" size={ui.font(18)} />
                <Text style={[styles.cardTitle, { fontSize: ui.font(16) }]}>
                  Cloud Sync Logs ({syncLogs.length})
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Pressable
                  style={[
                    styles.primaryBtn,
                    {
                      minHeight: 34,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      flexDirection: 'row',
                      gap: 5,
                    },
                  ]}
                  onPress={() => void handleSync('bidirectional')}
                  disabled={syncMut.isPending}
                >
                  <AppIcon name="dataSync" size={ui.font(13)} color="#ffffff" />
                  <Text
                    style={[styles.primaryBtnText, { fontSize: ui.font(11) }]}
                  >
                    {syncMut.isPending ? 'Syncing...' : 'Sync Now'}
                  </Text>
                </Pressable>
                {syncLogs.length > 0 && isAdminOrManager ? (
                  <Pressable
                    style={[
                      styles.secondaryBtn,
                      {
                        minHeight: 34,
                        paddingHorizontal: 12,
                        borderRadius: 999,
                      },
                    ]}
                    onPress={() => void clearLogsMut.mutateAsync()}
                  >
                    <Text
                      style={[styles.secondaryBtnText, { fontSize: ui.font(11) }]}
                    >
                      Clear Logs
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {syncLogs.length === 0 ? (
              <Text style={[styles.subHeading, { fontSize: ui.font(12) }]}>
                No cloud sync logs recorded yet. Tap Sync Now above or configure Supabase under Settings.
              </Text>
            ) : (
              <View style={{ gap: ui.space(8) }}>
                {syncLogs.map((log) => (
                  <View key={log.id} style={styles.logRowCard}>
                    <View style={styles.rowBetween}>
                      <Text
                        style={[
                          styles.switchLabel,
                          { fontSize: ui.font(12), textTransform: 'capitalize' },
                        ]}
                      >
                        {log.direction} · {log.status}
                      </Text>
                      <Text
                        style={[styles.subHeading, { fontSize: ui.font(11) }]}
                      >
                        {log.recordsPulled}↓ / {log.recordsPushed}↑
                      </Text>
                    </View>
                    <Text style={[styles.subHeading, { fontSize: ui.font(11) }]}>
                      {log.summary}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : activeTab === 'settings' ? (
          <>

        <View style={cardStyle}>
          <Text style={[styles.cardTitle, { fontSize: ui.font(16) }]}>
            Appearance &amp; Accessibility
          </Text>

          <View style={{ gap: ui.space(6) }}>
            <Text style={[styles.label, { fontSize: ui.font(12) }]}>
              Font Size
            </Text>
            <View style={styles.segmentWrap}>
              {FONT_SCALES.map((scale) => {
                const active = settings.fontScale === scale;
                return (
                  <Pressable
                    key={scale}
                    disabled={!canEdit}
                    style={[
                      styles.segmentBtn,
                      active && styles.segmentBtnActive,
                      !canEdit && { opacity: 0.6 },
                      {
                        minHeight: ui.chipHeight,
                        flexBasis: ui.isCramped ? '47%' : undefined,
                        minWidth: ui.isCramped ? '45%' : 76,
                        paddingHorizontal: ui.space(8),
                        paddingVertical: ui.space(6),
                        borderRadius: Math.max(8, ui.radius - 5),
                      },
                    ]}
                    onPress={() =>
                      void patchSetting(
                        { fontScale: scale },
                        `Font size set to ${FONT_SCALE_LABELS[scale]}.`
                      )
                    }
                  >
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      style={[
                        styles.segmentText,
                        active && styles.segmentTextActive,
                        { fontSize: ui.font(12), textAlign: 'center' },
                      ]}
                    >
                      {FONT_SCALE_LABELS[scale]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ gap: ui.space(6) }}>
            <Text style={[styles.label, { fontSize: ui.font(12) }]}>
              UI Element Size &amp; Touch Spacing
            </Text>
            <View style={[styles.segmentWrap, { flexWrap: 'nowrap' }]}>
              {UI_DENSITIES.map((density) => {
                const active = settings.uiDensity === density;
                return (
                  <Pressable
                    key={density}
                    disabled={!canEdit}
                    style={[
                      styles.segmentBtn,
                      active && styles.segmentBtnActive,
                      !canEdit && { opacity: 0.6 },
                      {
                        flex: 1,
                        minWidth: 0,
                        minHeight: ui.chipHeight,
                        paddingHorizontal: ui.space(6),
                        paddingVertical: ui.space(6),
                        borderRadius: Math.max(8, ui.radius - 5),
                      },
                    ]}
                    onPress={() =>
                      void patchSetting(
                        { uiDensity: density },
                        `Element size set to ${UI_DENSITY_LABELS[density]}.`
                      )
                    }
                  >
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.76}
                      style={[
                        styles.segmentText,
                        active && styles.segmentTextActive,
                        { fontSize: ui.font(12), textAlign: 'center' },
                      ]}
                    >
                      {UI_DENSITY_LABELS[density]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.label, { fontSize: ui.font(13) }]}>
                Compact Icon UI (Default)
              </Text>
              <Text style={[styles.subHeading, { fontSize: ui.font(11) }]}>
                Use icons for navigation tabs, species badges, and row actions. Switch off for text labels. System buttons always stay iconic.
              </Text>
            </View>
            <Switch
              value={settings.mobileIconMode}
              disabled={!canEdit}
              onValueChange={(v) =>
                void patchSetting(
                  { mobileIconMode: v },
                  v
                    ? 'Compact Icon UI enabled.'
                    : 'Word labels enabled alongside system icons.'
                )
              }
              trackColor={{
                false: FARMDB_COLORS.border,
                true: FARMDB_COLORS.accent,
              }}
            />
          </View>
        </View>

        <View style={cardStyle}>
          <Text style={[styles.cardTitle, { fontSize: ui.font(16) }]}>
            Units &amp; Herd Defaults
          </Text>

          <View
            pointerEvents={canEdit ? 'auto' : 'none'}
            style={[{ gap: ui.space(12) }, !canEdit && { opacity: 0.65 }]}
          >
            <View style={{ gap: ui.space(6) }}>
              <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                Date Format
              </Text>
              <ModernDropdown
                value={settings.dateFormat}
                options={dateFormatOptions}
                title="Date Format"
                accessibilityLabel="Date Format"
                onChange={(fmt) =>
                  void patchSetting(
                    { dateFormat: fmt },
                    `Date format set to ${DATE_FORMAT_LABELS[fmt]}.`
                  )
                }
              />
            </View>

            <View style={{ gap: ui.space(6) }}>
              <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                Milk Yield Display Unit
              </Text>
              <ModernDropdown
                value={settings.volumeUnit}
                options={volumeUnitOptions}
                title="Milk Yield Display Unit"
                accessibilityLabel="Milk Yield Display Unit"
                onChange={(unit) =>
                  void patchSetting(
                    { volumeUnit: unit },
                    `Yields will show in ${VOLUME_UNIT_LABELS[unit]}.`
                  )
                }
              />
            </View>

            <View style={{ gap: ui.space(6) }}>
              <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                Default Species for New Livestock
              </Text>
              <ModernDropdown
                value={settings.defaultSpecies}
                options={speciesOptions}
                title="Default Livestock Species"
                accessibilityLabel="Default Livestock Species"
                onChange={(sp) =>
                  void patchSetting(
                    { defaultSpecies: sp },
                    `Default species set to ${formatSpeciesLabel(sp)}.`
                  )
                }
              />
            </View>
          </View>
        </View>

        <View style={cardStyle}>
          <View style={styles.sectionTitleRow}>
            <AppIcon name="farmer" size={ui.font(20)} />
            <Text style={[styles.cardTitle, { fontSize: ui.font(16) }]}>
              Farm Profile &amp; Financial Rate
            </Text>
          </View>

          <View
            pointerEvents={canEdit ? 'auto' : 'none'}
            style={[{ gap: ui.space(12) }, !canEdit && { opacity: 0.65 }]}
          >
            <View style={{ gap: ui.space(6) }}>
              <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                Farm / Operation Name
              </Text>
              <TextInput
                editable={canEdit}
                style={[
                  styles.input,
                  { minHeight: ui.controlHeight, fontSize: ui.font(14) },
                ]}
                value={farmName}
                maxLength={60}
                onChangeText={setFarmName}
                placeholder="farmDB Homestead"
                placeholderTextColor={FARMDB_COLORS.textMuted}
              />
            </View>

            <View style={{ gap: ui.space(6) }}>
              <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                Currency
              </Text>
              <ModernDropdown
                value={selectedCurrencyValue}
                options={currencyOptions}
                title="Select Currency"
                accessibilityLabel="Currency"
                onChange={(nextVal) => {
                  if (nextVal === '__custom__') {
                    setUseCustomCurrency(true);
                  } else {
                    setUseCustomCurrency(false);
                    setCurrencySymbol(nextVal);
                    void patchSetting(
                      { currencySymbol: nextVal },
                      `Currency set to ${nextVal}.`
                    );
                  }
                }}
              />
            </View>

            {selectedCurrencyValue === '__custom__' ? (
              <View style={{ gap: ui.space(6) }}>
                <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                  Custom Currency Symbol
                </Text>
                <TextInput
                  editable={canEdit}
                  style={[
                    styles.input,
                    { minHeight: ui.controlHeight, fontSize: ui.font(14) },
                  ]}
                  value={currencySymbol}
                  maxLength={6}
                  onChangeText={setCurrencySymbol}
                  placeholder="e.g. KES, EUR, €"
                  placeholderTextColor={FARMDB_COLORS.textMuted}
                />
              </View>
            ) : null}

            <View style={{ gap: ui.space(6) }}>
              <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                Milk Rate ({currencySymbol || '$'}/L)
              </Text>
              <MobileNumberStepper
                accessibilityLabel="Milk Rate"
                min={0}
                step={currencySymbol === 'UGX' ? 100 : 0.05}
                decimals={currencySymbol === 'UGX' ? 0 : 2}
                value={rateText}
                onChangeText={setRateText}
                placeholder="0.65"
              />
            </View>

            <MobileIntervalControl
              label="Background Alert Check Interval (15–3600s)"
              accessibilityLabel="Background Alert Check Interval"
              min={15}
              max={3600}
              step={5}
              value={intervalText}
              onChangeText={setIntervalText}
              presets={INTERVAL_PRESETS}
            />

            <MobileIntervalControl
              label="Alert Before Worker Payment Due (0–30 days)"
              accessibilityLabel="Payment Alert Lead Days"
              min={0}
              max={30}
              step={1}
              value={leadDaysText}
              onChangeText={setLeadDaysText}
              presets={LEAD_DAYS_PRESETS}
            />
          </View>

          <View style={styles.saveBar}>
            <Text style={[styles.subHeading, { fontSize: ui.font(12), flexShrink: 1 }]}>
              10 L est.:{' '}
              {formatCurrency(
                (Number(rateText) || 0) * 10,
                currencySymbol || '$'
              )}
            </Text>
            {canEdit ? (
              <Pressable
                style={[
                  styles.primaryBtn,
                  {
                    minHeight: ui.controlHeight,
                    paddingHorizontal: ui.space(16),
                    paddingVertical: ui.space(7),
                    borderRadius: Math.max(10, ui.radius - 2),
                  },
                ]}
                onPress={() => void handleSaveProfile()}
                disabled={updateMutation.isPending}
              >
                <Text style={[styles.primaryBtnText, { fontSize: ui.font(14) }]}>
                  {updateMutation.isPending ? 'Saving...' : 'Save Profile'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={cardStyle}>
          <Text style={[styles.cardTitle, { fontSize: ui.font(16) }]}>
            Automation, Alerts &amp; Safety
          </Text>

          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.switchLabel, { fontSize: ui.font(13) }]}>
                Auto-record milk sale income
              </Text>
              <Text style={[styles.subHeading, { fontSize: ui.font(11) }]}>
                Pre-enable Milk Sale creation on yield logs
              </Text>
            </View>
            <Switch
              value={settings.autoRecordMilkSaleByDefault}
              disabled={!canEdit}
              onValueChange={(v) =>
                void patchSetting(
                  { autoRecordMilkSaleByDefault: v },
                  'Milk sale default updated.'
                )
              }
              trackColor={{
                false: FARMDB_COLORS.border,
                true: FARMDB_COLORS.accent,
              }}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.switchLabel, { fontSize: ui.font(13) }]}>
                Auto-record medical expenses
              </Text>
              <Text style={[styles.subHeading, { fontSize: ui.font(11) }]}>
                Pre-enable financial expense entry for vet costs
              </Text>
            </View>
            <Switch
              value={settings.autoRecordMedicalExpenseByDefault}
              disabled={!canEdit}
              onValueChange={(v) =>
                void patchSetting(
                  { autoRecordMedicalExpenseByDefault: v },
                  'Medical expense default updated.'
                )
              }
              trackColor={{
                false: FARMDB_COLORS.border,
                true: FARMDB_COLORS.accent,
              }}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.switchLabel, { fontSize: ui.font(13) }]}>
                Auto-record salary payments as expenses
              </Text>
              <Text style={[styles.subHeading, { fontSize: ui.font(11) }]}>
                Pre-enable Payroll Expense creation when paying farm workers
              </Text>
            </View>
            <Switch
              value={settings.autoRecordPayrollExpenseByDefault}
              disabled={!canEdit}
              onValueChange={(v) =>
                void patchSetting(
                  { autoRecordPayrollExpenseByDefault: v },
                  'Payroll expense default updated.'
                )
              }
              trackColor={{
                false: FARMDB_COLORS.border,
                true: FARMDB_COLORS.accent,
              }}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.switchLabel, { fontSize: ui.font(13) }]}>
                Due-alert local notifications
              </Text>
              <Text style={[styles.subHeading, { fontSize: ui.font(11) }]}>
                Notify automatically when scheduled tasks are due
              </Text>
            </View>
            <Switch
              value={settings.enableNotifications}
              disabled={!canEdit}
              onValueChange={(v) =>
                void patchSetting(
                  { enableNotifications: v },
                  v
                    ? 'Alert notifications enabled.'
                    : 'Alert notifications paused.'
                )
              }
              trackColor={{
                false: FARMDB_COLORS.border,
                true: FARMDB_COLORS.accent,
              }}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.switchLabel, { fontSize: ui.font(13) }]}>
                Confirm before deleting records
              </Text>
              <Text style={[styles.subHeading, { fontSize: ui.font(11) }]}>
                Require an extra confirmation tap before deletions
              </Text>
            </View>
            <Switch
              value={settings.confirmBeforeDelete}
              disabled={!canEdit}
              onValueChange={(v) =>
                void patchSetting(
                  { confirmBeforeDelete: v },
                  v
                    ? 'Delete confirmation enabled.'
                    : 'Single-tap delete enabled.'
                )
              }
              trackColor={{
                false: FARMDB_COLORS.border,
                true: FARMDB_COLORS.accent,
              }}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.saveBar}>
            <Text
              style={[styles.subHeading, { flex: 1, fontSize: ui.font(11) }]}
            >
              Stored locally in SQLite farm_settings
            </Text>
            {canDelete ? (
              confirmReset ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    style={[
                      styles.dangerBtn,
                      {
                        minHeight: ui.chipHeight,
                        paddingHorizontal: ui.space(10),
                        borderRadius: Math.max(8, ui.radius - 4),
                      },
                    ]}
                    onPress={() => void handleReset()}
                    disabled={resetMutation.isPending}
                  >
                    <Text
                      style={[styles.dangerBtnText, { fontSize: ui.font(12) }]}
                    >
                      Confirm
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.secondaryBtn,
                      {
                        minHeight: ui.chipHeight,
                        paddingHorizontal: ui.space(10),
                        borderRadius: Math.max(8, ui.radius - 4),
                      },
                    ]}
                    onPress={() => setConfirmReset(false)}
                  >
                    <Text
                      style={[styles.secondaryBtnText, { fontSize: ui.font(12) }]}
                    >
                      Cancel
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={[
                    styles.secondaryBtn,
                    {
                      minHeight: ui.chipHeight,
                      paddingHorizontal: ui.space(12),
                      borderRadius: Math.max(8, ui.radius - 4),
                    },
                  ]}
                  onPress={() => setConfirmReset(true)}
                >
                  <Text
                    style={[styles.secondaryBtnText, { fontSize: ui.font(12) }]}
                  >
                    Reset Defaults
                  </Text>
                </Pressable>
              )
            ) : (
              <Text style={[styles.subHeading, { fontSize: ui.font(11) }]}>
                Full privilege required
              </Text>
            )}
          </View>
        </View>
          </>
        ) : (
          <>
        <View style={cardStyle}>
          <View style={{ gap: ui.space(6) }}>
            <View style={[styles.sectionTitleRow, { alignItems: 'flex-start' }]}>
              <View style={{ marginTop: 2 }}>
                <AppIcon name="database" size={ui.font(18)} />
              </View>
              <Text style={[styles.cardTitle, { fontSize: ui.font(16), flex: 1 }]}>
                Native SQLite Database Storage &amp; Read-Only Protection
              </Text>
            </View>
            {Platform.OS !== 'web' && storageInfo ? (
              <View style={[styles.previewStatus, { alignSelf: 'flex-start' }]}>
                <Text style={[styles.previewStatusText, { fontSize: ui.font(11) }]}>
                  {storageInfo.readOnlyProtection ? 'Read-Only Outside App Active' : 'Unlocked'}
                </Text>
              </View>
            ) : null}
          </View>

          {Platform.OS === 'web' ? (
            <Text style={[styles.subHeading, { fontSize: ui.font(12) }]}>
              Web preview uses browser runtime storage. On iOS/Android native builds, the SQLite database sits in private app sandbox storage and is protected with PRAGMA query_only + a verified shadow copy.
            </Text>
          ) : (
            <>
              <View style={{ gap: 4 }}>
                <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                  Active SQLite Storage Path
                </Text>
                <Text
                  selectable
                  style={[
                    styles.sqlBox,
                    { fontSize: ui.font(11), padding: ui.space(9) },
                  ]}
                >
                  {storageInfo?.dbPath ?? sqlController?.getDatabasePath() ?? 'Loading...'}
                </Text>
                {storageInfo ? (
                  <Text style={[styles.subHeading, { fontSize: ui.font(11) }]}>
                    Size: {(storageInfo.fileSizeBytes / 1024).toFixed(1)} KB
                    {storageInfo.isProtectedCopyAvailable
                      ? ' · Verified shadow copy active'
                      : ''}
                  </Text>
                ) : null}
              </View>

              <View style={styles.switchRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={[styles.switchLabel, { fontSize: ui.font(13) }]}>
                    Read-Only SQLite Protection
                  </Text>
                  <Text style={[styles.subHeading, { fontSize: ui.font(11) }]}>
                    Keeps native SQLite in PRAGMA query_only between verified app writes and maintains a verified copy to guard against tampering.
                  </Text>
                </View>
                <Switch
                  value={storageInfo?.readOnlyProtection ?? true}
                  disabled={storageBusy || !sqlController || !(isAdmin || canDelete)}
                  onValueChange={(v) => void handleToggleReadOnlyProtection(v)}
                  trackColor={{
                    false: FARMDB_COLORS.border,
                    true: FARMDB_COLORS.accent,
                  }}
                />
              </View>

              {storageFeedback ? (
                <View
                  style={[
                    styles.feedbackBanner,
                    storageFeedback.kind === 'err' && styles.feedbackBannerErr,
                    { padding: ui.space(10), borderRadius: ui.radius },
                  ]}
                >
                  <Text
                    style={[
                      styles.feedbackText,
                      storageFeedback.kind === 'err' && styles.feedbackTextErr,
                      { fontSize: ui.font(12) },
                    ]}
                  >
                    {storageFeedback.text}
                  </Text>
                </View>
              ) : null}

              {!(isAdmin || canDelete) ? (
                <Text style={[styles.subHeading, { fontSize: ui.font(11) }]}>
                  Admin or Full Settings access required to change database lock protection.
                </Text>
              ) : null}
            </>
          )}
        </View>

        {/* Cloud Sync & Supabase Database Settings (Admin only) */}
        {isAdmin ? (
        <View style={cardStyle}>
          <View style={styles.sectionTitleRow}>
            <AppIcon
              name={settings.supabaseUrl ? 'cloudHosting' : 'cloudOffline'}
              size={ui.font(18)}
            />
            <Text style={[styles.cardTitle, { fontSize: ui.font(16) }]}>
              Cloud Sync &amp; Supabase Database
            </Text>
          </View>
          <Text style={[styles.subHeading, { fontSize: ui.font(11) }]}>
            Connect your local SQLite database to a Supabase cloud project for cross-device and Farm Network sync.
          </Text>

          {cloudFeedback ? (
            <View
              style={[
                styles.feedbackBanner,
                cloudFeedback.kind === 'err' && styles.feedbackBannerErr,
                { padding: ui.space(10), borderRadius: ui.radius },
              ]}
            >
              <Text
                style={[
                  styles.feedbackText,
                  cloudFeedback.kind === 'err' && styles.feedbackTextErr,
                  { fontSize: ui.font(12) },
                ]}
              >
                {cloudFeedback.text}
              </Text>
            </View>
          ) : null}

          <View style={styles.syncActionRow}>
            <Pressable
              style={[
                styles.secondaryBtn,
                styles.syncActionBtn,
                {
                  minHeight: ui.chipHeight,
                  borderRadius: 999,
                  flexBasis: ui.isCramped ? '47%' : undefined,
                  minWidth: ui.isCramped ? '45%' : 76,
                },
              ]}
              onPress={() => void handleSync('test')}
              disabled={syncMut.isPending}
            >
              <AppIcon name="web" size={ui.font(14)} />
              <Text style={[styles.secondaryBtnText, { fontSize: ui.font(11) }]}>
                Test
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.primaryBtn,
                styles.syncActionBtn,
                {
                  minHeight: ui.chipHeight,
                  borderRadius: 999,
                  flexBasis: ui.isCramped ? '47%' : undefined,
                  minWidth: ui.isCramped ? '45%' : 96,
                },
              ]}
              onPress={() => void handleSync('bidirectional')}
              disabled={syncMut.isPending}
            >
              <AppIcon name="dataSync" size={ui.font(14)} />
              <Text style={[styles.primaryBtnText, { fontSize: ui.font(11) }]}>
                {syncMut.isPending ? 'Syncing...' : 'Sync Now'}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.secondaryBtn,
                styles.syncActionBtn,
                {
                  minHeight: ui.chipHeight,
                  borderRadius: 999,
                  flexBasis: ui.isCramped ? '47%' : undefined,
                  minWidth: ui.isCramped ? '45%' : 76,
                },
              ]}
              onPress={() => void handleSync('push')}
              disabled={syncMut.isPending}
            >
              <AppIcon name="upload" size={ui.font(14)} />
              <Text style={[styles.secondaryBtnText, { fontSize: ui.font(11) }]}>
                Push
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.secondaryBtn,
                styles.syncActionBtn,
                {
                  minHeight: ui.chipHeight,
                  borderRadius: 999,
                  flexBasis: ui.isCramped ? '47%' : undefined,
                  minWidth: ui.isCramped ? '45%' : 76,
                },
              ]}
              onPress={() => void handleSync('pull')}
              disabled={syncMut.isPending}
            >
              <AppIcon name="download" size={ui.font(14)} />
              <Text style={[styles.secondaryBtnText, { fontSize: ui.font(11) }]}>
                Pull
              </Text>
            </Pressable>
          </View>

          <View style={{ gap: ui.space(6) }}>
            <Text style={[styles.label, { fontSize: ui.font(12) }]}>
              Supabase Project URL
            </Text>
            <TextInput
              style={[styles.input, { fontSize: ui.font(13) }]}
              value={supabaseUrl}
              onChangeText={setSupabaseUrl}
              placeholder="https://your-project.supabase.co"
              autoCapitalize="none"
            />
          </View>

          <View style={{ gap: ui.space(6) }}>
            <Text style={[styles.label, { fontSize: ui.font(12) }]}>
              Supabase Anon / Publishable Key
            </Text>
            <TextInput
              style={[styles.input, { fontSize: ui.font(13) }]}
              value={supabaseKey}
              onChangeText={setSupabaseKey}
              placeholder="sb_publishable_... or eyJhbGci..."
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View style={{ gap: ui.space(6) }}>
            <Text style={[styles.label, { fontSize: ui.font(12) }]}>
              Shared Workspace ID
            </Text>
            <TextInput
              style={[styles.input, { fontSize: ui.font(13) }]}
              value={workspaceId}
              onChangeText={setWorkspaceId}
              placeholder="farmdb-homestead-main"
              autoCapitalize="none"
            />
          </View>

          <View style={{ gap: ui.space(6) }}>
            <Text style={[styles.label, { fontSize: ui.font(12) }]}>
              Sync Conflict Resolution
            </Text>
            <ModernDropdown
              value={strategy}
              options={SYNC_CONFLICT_STRATEGIES.map((s) => ({
                value: s,
                label:
                  s === 'last_write_wins'
                    ? 'Latest Edit Wins'
                    : s === 'local_priority'
                      ? 'Local Device Priority'
                      : 'Cloud Priority',
                iconSource: MOBILE_APP_ICONS.dataSync,
              }))}
              title="Conflict Resolution"
              onChange={setStrategy}
            />
          </View>

          <MobileIntervalControl
            label="Auto-Sync Interval (seconds: 30–86400)"
            accessibilityLabel="Auto-Sync Interval"
            min={30}
            max={86400}
            step={30}
            value={cloudInterval}
            onChangeText={setCloudInterval}
            presets={CLOUD_SYNC_PRESETS}
          />

          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { flex: 1, minWidth: 0, paddingRight: 10, fontSize: ui.font(13) }]}>
              Enable Supabase Cloud Sync
            </Text>
            <Switch
              value={cloudEnabled}
              onValueChange={setCloudEnabled}
              trackColor={{
                false: FARMDB_COLORS.border,
                true: FARMDB_COLORS.accent,
              }}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { flex: 1, minWidth: 0, paddingRight: 10, fontSize: ui.font(13) }]}>
              Auto-sync on internet connect
            </Text>
            <Switch
              value={autoSync}
              onValueChange={setAutoSync}
              trackColor={{
                false: FARMDB_COLORS.border,
                true: FARMDB_COLORS.accent,
              }}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { flex: 1, minWidth: 0, paddingRight: 10, fontSize: ui.font(13) }]}>
              Include Financial Ledger in sync
            </Text>
            <Switch
              value={syncFinancials}
              onValueChange={setSyncFinancials}
              trackColor={{
                false: FARMDB_COLORS.border,
                true: FARMDB_COLORS.accent,
              }}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { flex: 1, minWidth: 0, paddingRight: 10, fontSize: ui.font(13) }]}>
              Include Human Resources in sync
            </Text>
            <Switch
              value={syncHr}
              onValueChange={setSyncHr}
              trackColor={{
                false: FARMDB_COLORS.border,
                true: FARMDB_COLORS.accent,
              }}
            />
          </View>

          <View style={styles.syncActionRow}>
            <Pressable
              style={[
                styles.primaryBtn,
                {
                  flex: 1,
                  minWidth: 148,
                  minHeight: ui.controlHeight,
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: ui.space(6),
                },
              ]}
              onPress={() => void handleSaveCloud()}
              disabled={updateMutation.isPending}
            >
              <Text style={[styles.primaryBtnText, { fontSize: ui.font(13), textAlign: 'center' }]}>
                Save Cloud Settings
              </Text>
            </Pressable>
            {onSignOut ? (
              <Pressable
                style={[
                  styles.secondaryBtn,
                  {
                    flexGrow: 1,
                    minWidth: 132,
                    minHeight: ui.controlHeight,
                    borderRadius: 999,
                    paddingHorizontal: 14,
                    paddingVertical: ui.space(6),
                  },
                ]}
                onPress={onSignOut}
              >
                <Text
                  style={[styles.secondaryBtnText, { fontSize: ui.font(12), textAlign: 'center' }]}
                >
                  Sign Out
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.divider} />
          <View style={styles.saveBar}>
            <Text style={[styles.label, { fontSize: ui.font(12), flex: 1, minWidth: 160 }]}>
              Supabase SQL Setup Script
            </Text>
            <Pressable
              style={[
                styles.secondaryBtn,
                {
                  minHeight: ui.chipHeight,
                  borderRadius: 999,
                  paddingHorizontal: ui.space(14),
                },
              ]}
              onPress={() => setShowSqlScript((prev) => !prev)}
            >
              <Text style={[styles.secondaryBtnText, { fontSize: ui.font(12) }]}>
                {showSqlScript ? 'Hide Script' : 'Show Script'}
              </Text>
            </Pressable>
          </View>
          {showSqlScript ? (
            <Text style={styles.sqlBox} selectable>
              {generateSupabaseSetupSql()}
            </Text>
          ) : null}
        </View>
        ) : (
        <View style={cardStyle}>
          <View style={styles.sectionTitleRow}>
            <AppIcon
              name={settings.supabaseUrl ? 'cloudHosting' : 'cloudOffline'}
              size={ui.font(18)}
            />
            <Text style={[styles.cardTitle, { fontSize: ui.font(16) }]}>
              Cloud Sync &amp; Supabase Database
            </Text>
          </View>
          <Text style={[styles.subHeading, { fontSize: ui.font(12) }]}>
            {activeAccount?.canSyncCloud
              ? 'Linked to the Farm Admin cloud database via Network Join Key.'
              : 'Using local SQLite storage only. Join an Admin network on the Farm Network page to connect to a cloud database.'}
          </Text>
        </View>
        )}

        {/* Mobile OTA App Updates Card */}
        <View style={cardStyle}>
          <View style={{ gap: ui.space(6) }}>
            <View style={[styles.sectionTitleRow, { alignItems: 'flex-start' }]}>
              <View style={{ marginTop: 2 }}>
                <AppIcon name="download" size={ui.font(18)} />
              </View>
              <Text style={[styles.cardTitle, { fontSize: ui.font(16), flex: 1 }]}>
                App Updates
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <View style={styles.updateVersionPill}>
                <Text style={[styles.updateVersionPillText, { fontSize: ui.font(11) }]}>
                  v{currentVersion}
                </Text>
              </View>
              <View
                style={[
                  styles.previewStatus,
                  !availableUpdate && !otaBusy && styles.updateStatusNeutral,
                ]}
              >
                <Text
                  style={[
                    styles.previewStatusText,
                    !availableUpdate && !otaBusy && styles.updateStatusNeutralText,
                    { fontSize: ui.font(11) },
                  ]}
                >
                  {updateController?.installing
                    ? 'Applying Update...'
                    : otaBusy
                      ? 'Checking...'
                      : availableUpdate
                        ? `v${availableUpdate.version} Available`
                        : updateController?.otaEnabled
                          ? 'OTA Active · Up to Date'
                          : 'Up to Date'}
                </Text>
              </View>
            </View>
          </View>

          <Text style={[styles.subHeading, { fontSize: ui.font(11.5) }]}>
            Check for published Expo EAS over-the-air updates and GitHub Release fixes without reinstalling an APK.
            {updateController?.otaChannel ? ` Channel: ${updateController.otaChannel}.` : ''}
            {updateController?.lastCheckedAt
              ? ` Last checked ${new Date(updateController.lastCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
              : ''}
          </Text>

          {availableUpdate ? (
            <View
              style={[
                styles.updateHighlightCard,
                { padding: ui.space(12), borderRadius: ui.radius, gap: ui.space(8) },
              ]}
            >
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <Text style={[styles.switchLabel, { fontSize: ui.font(14) }]}>
                  farmDB v{availableUpdate.version} Available
                </Text>
                <View style={styles.updateVersionPill}>
                  <Text style={[styles.updateVersionPillText, { fontSize: ui.font(10.5) }]}>
                    {availableUpdate.version !== currentVersion
                      ? `v${currentVersion} → v${availableUpdate.version}`
                      : `v${availableUpdate.version} OTA`}
                  </Text>
                </View>
              </View>
              {availableUpdate.summary ? (
                <Text style={[styles.subHeading, { fontSize: ui.font(12), color: FARMDB_COLORS.text }]}>
                  {availableUpdate.summary}
                </Text>
              ) : null}
              {availableUpdate.fixes.slice(0, 4).map((fix, idx) => (
                <View key={`${idx}-${fix.slice(0, 20)}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 7 }}>
                  <View style={{ marginTop: 2 }}>
                    <AppIcon name="check" size={ui.font(13)} />
                  </View>
                  <Text style={[styles.subHeading, { flex: 1, fontSize: ui.font(12), color: FARMDB_COLORS.text, marginTop: 0 }]}>
                    {fix}
                  </Text>
                </View>
              ))}
              {updateController?.installing && updateController.progressLabel ? (
                <Text style={[styles.feedbackText, { fontSize: ui.font(12) }]}>
                  {updateController.progressLabel}
                </Text>
              ) : null}
              <View style={[styles.syncActionRow, { marginTop: 2 }]}>
                {availableUpdate.canDirectInstall && updateController ? (
                  <Pressable
                    style={[
                      styles.primaryBtn,
                      styles.updateActionBtn,
                      {
                        minHeight: ui.controlHeight,
                        borderRadius: 999,
                        paddingHorizontal: ui.space(16),
                        paddingVertical: ui.space(8),
                      },
                    ]}
                    disabled={otaBusy}
                    onPress={() => void updateController.onInstallUpdate()}
                  >
                    <AppIcon name="download" size={ui.font(15)} />
                    <Text style={[styles.primaryBtnText, { fontSize: ui.font(12.5) }]}>
                      {updateController.installing ? 'Downloading...' : 'Download & Restart'}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={[
                      styles.primaryBtn,
                      styles.updateActionBtn,
                      {
                        minHeight: ui.controlHeight,
                        borderRadius: 999,
                        paddingHorizontal: ui.space(16),
                        paddingVertical: ui.space(8),
                      },
                    ]}
                    onPress={() => {
                      void Linking.openURL(availableUpdate.releaseUrl);
                    }}
                  >
                    <AppIcon name="web" size={ui.font(15)} />
                    <Text style={[styles.primaryBtnText, { fontSize: ui.font(12.5) }]}>
                      View on GitHub
                    </Text>
                  </Pressable>
                )}
                {updateController ? (
                  <Pressable
                    style={[
                      styles.secondaryBtn,
                      {
                        minHeight: ui.controlHeight,
                        borderRadius: 999,
                        paddingHorizontal: ui.space(14),
                        paddingVertical: ui.space(8),
                        flexGrow: 1,
                      },
                    ]}
                    onPress={updateController.onOpenModal}
                  >
                    <Text style={[styles.secondaryBtnText, { fontSize: ui.font(12) }]}>
                      Full Release Notes
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={styles.syncActionRow}>
            <Pressable
              style={[
                styles.secondaryBtn,
                {
                  minHeight: ui.controlHeight,
                  borderRadius: 999,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingHorizontal: ui.space(16),
                  paddingVertical: ui.space(9),
                  flexGrow: 1,
                },
              ]}
              disabled={otaBusy}
              onPress={() => void handleCheckOtaUpdate()}
            >
              <AppIcon name="dataSync" size={ui.font(15)} />
              <Text style={[styles.secondaryBtnText, { fontSize: ui.font(12.5) }]}>
                {otaBusy && !updateController?.installing
                  ? 'Checking Updates...'
                  : 'Check for Updates'}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.secondaryBtn,
                {
                  minHeight: ui.controlHeight,
                  borderRadius: 999,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingHorizontal: ui.space(14),
                  paddingVertical: ui.space(9),
                  flexGrow: 1,
                },
              ]}
              onPress={() => setShowCurrentHighlights((prev) => !prev)}
            >
              <AppIcon name={showCurrentHighlights ? 'chevronUp' : 'chevronDown'} size={ui.font(14)} />
              <Text style={[styles.secondaryBtnText, { fontSize: ui.font(12) }]}>
                {showCurrentHighlights ? 'Hide Notes' : `What's New (v${currentVersion})`}
              </Text>
            </Pressable>
          </View>

          {showCurrentHighlights ? (
            <View
              style={[
                styles.logRowCard,
                { padding: ui.space(12), gap: ui.space(7) },
              ]}
            >
              <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                Highlights in farmDB v{currentVersion}
              </Text>
              {CURRENT_RELEASE_HIGHLIGHTS.map((item, idx) => (
                <View key={`${idx}-${item.slice(0, 18)}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 7 }}>
                  <View style={{ marginTop: 2 }}>
                    <AppIcon name="check" size={ui.font(13)} />
                  </View>
                  <Text style={[styles.subHeading, { flex: 1, fontSize: ui.font(11.5), color: FARMDB_COLORS.text, marginTop: 0 }]}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {otaFeedback ? (
            <View
              style={[
                styles.feedbackBanner,
                otaFeedback.kind === 'err' && styles.feedbackBannerErr,
                { padding: ui.space(10), borderRadius: ui.radius },
              ]}
            >
              <Text
                style={[
                  styles.feedbackText,
                  otaFeedback.kind === 'err' && styles.feedbackTextErr,
                  { fontSize: ui.font(12) },
                ]}
              >
                {otaFeedback.text}
              </Text>
            </View>
          ) : null}
        </View>
          </>
        )}
      </FarmScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {
    fontFamily: FARMDB_FONTS.extrabold,
    color: FARMDB_COLORS.text,
  },
  subHeading: {
    fontFamily: FARMDB_FONTS.regular,
    color: FARMDB_COLORS.textMuted,
    marginTop: 2,
  },
  feedbackBanner: {
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1,
    borderColor: '#a8d5be',
  },
  feedbackBannerErr: {
    backgroundColor: FARMDB_COLORS.warnBg,
    borderColor: FARMDB_COLORS.warnBorder,
  },
  feedbackText: {
    color: '#173e2b',
    fontFamily: FARMDB_FONTS.semibold,
  },
  feedbackTextErr: {
    color: FARMDB_COLORS.warnText,
  },
  card: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.text,
    flexShrink: 1,
  },
  label: {
    fontFamily: FARMDB_FONTS.semibold,
    color: FARMDB_COLORS.text,
  },
  segmentWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 4,
    borderRadius: 10,
    backgroundColor: FARMDB_COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
  },
  segmentBtn: {
    flexGrow: 1,
    minWidth: 74,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 2,
    borderColor: FARMDB_COLORS.accent,
  },
  segmentText: {
    color: FARMDB_COLORS.textMuted,
    fontFamily: FARMDB_FONTS.semibold,
  },
  segmentTextActive: {
    color: FARMDB_COLORS.accent,
    fontFamily: FARMDB_FONTS.bold,
  },
  previewStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: FARMDB_COLORS.successSoft,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  previewStatusText: {
    color: FARMDB_COLORS.success,
    fontFamily: FARMDB_FONTS.bold,
  },
  input: {
    backgroundColor: FARMDB_COLORS.cardAlt,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: FARMDB_FONTS.regular,
    color: FARMDB_COLORS.text,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  presetBar: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 3,
    padding: 3,
    borderRadius: 10,
    backgroundColor: FARMDB_COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
  },
  presetBtn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  presetBtnActive: {
    backgroundColor: FARMDB_COLORS.surface,
    borderColor: FARMDB_COLORS.accent,
  },
  presetBtnText: {
    color: FARMDB_COLORS.textMuted,
    fontFamily: FARMDB_FONTS.semibold,
  },
  presetBtnTextActive: {
    color: FARMDB_COLORS.accent,
    fontFamily: FARMDB_FONTS.bold,
  },
  saveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  primaryBtn: {
    backgroundColor: FARMDB_COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontFamily: FARMDB_FONTS.bold,
  },
  secondaryBtn: {
    backgroundColor: FARMDB_COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: FARMDB_COLORS.text,
    fontFamily: FARMDB_FONTS.bold,
  },
  dangerBtn: {
    backgroundColor: FARMDB_COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: '#f4c7c3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: {
    color: FARMDB_COLORS.danger,
    fontFamily: FARMDB_FONTS.bold,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchLabel: {
    fontFamily: FARMDB_FONTS.semibold,
    color: FARMDB_COLORS.text,
  },
  divider: {
    height: 1,
    backgroundColor: FARMDB_COLORS.surfaceMuted,
  },
  syncActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  syncActionBtn: {
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 12,
    flexGrow: 1,
  },
  sqlBox: {
    backgroundColor: '#17271d',
    color: '#e6f2ec',
    padding: 12,
    borderRadius: 10,
    fontFamily: FARMDB_FONTS.mono,
    fontSize: 10,
  },
  logRowCard: {
    backgroundColor: FARMDB_COLORS.cardAlt,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  updateVersionPill: {
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1,
    borderColor: '#9fd0b6',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  updateVersionPillText: {
    fontFamily: FARMDB_FONTS.monoBold,
    color: FARMDB_COLORS.accentHover,
  },
  updateStatusNeutral: {
    backgroundColor: FARMDB_COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
  },
  updateStatusNeutralText: {
    color: FARMDB_COLORS.textMuted,
  },
  updateHighlightCard: {
    backgroundColor: '#f4faf6',
    borderWidth: 1,
    borderColor: '#9fd0b6',
  },
  updateActionBtn: {
    flexDirection: 'row',
    gap: 7,
    flexGrow: 1,
  },
});
