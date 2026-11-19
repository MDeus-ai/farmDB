import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  canAccountEditModule,
  CURRENCY_OPTIONS,
  DEFAULT_FARM_SETTINGS,
  encodeFarmNetworkJoinKey,
  FONT_SCALES,
  formatCurrency,
  generateSupabaseSetupSql,
  isAdminAccount,
  UI_DENSITIES,
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
import { getCurrencyOptionFlagSource } from '../assets/icons';
import type { ExpoSqlController, MobileStorageInfo } from '../db/mobileDriver';
import { FARMDB_COLORS, FARMDB_FONTS, useUiScale } from '../theme/uiScale';
import { AppIcon } from './FarmIcons';
import { FarmScrollView } from './FarmScrollView';
import {
  ModernDropdown,
  type ModernDropdownOption,
} from './ModernDropdown';

interface FirstTimeSetupViewProps {
  activeAccount: FarmAccount;
  sqlController?: ExpoSqlController | null;
  onComplete: () => void;
}

const FONT_SCALE_LABELS: Record<FontScale, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  xlarge: 'X-Large',
};

const UI_DENSITY_LABELS: Record<UiDensity, string> = {
  compact: 'Compact',
  comfortable: 'Comfortable',
  spacious: 'Spacious',
};

const VOLUME_UNIT_LABELS: Record<VolumeUnit, string> = {
  liters: 'Liters (L)',
  gallons: 'US Gallons (gal)',
};

const PREVIEW_FONT_FACTORS: Record<FontScale, number> = {
  small: 0.9,
  medium: 1.0,
  large: 1.14,
  xlarge: 1.28,
};

const PREVIEW_HEIGHTS: Record<UiDensity, number> = {
  compact: 36,
  comfortable: 44,
  spacious: 52,
};

export function FirstTimeSetupView({
  activeAccount,
  sqlController,
  onComplete,
}: FirstTimeSetupViewProps) {
  const ui = useUiScale();
  const settingsQuery = useFarmSettings();
  const currentSettings = settingsQuery.data ?? DEFAULT_FARM_SETTINGS;
  const updateSettingsMut = useUpdateFarmSettings();
  const updateAccountMut = useUpdateFarmAccount();
  const syncMut = useTriggerCloudSync();

  const isAdmin = isAdminAccount(activeAccount);
  const canEditSettings = canAccountEditModule(activeAccount, 'settings');

  const [fontScale, setFontScale] = useState<FontScale>(currentSettings.fontScale);
  const [uiDensity, setUiDensity] = useState<UiDensity>(currentSettings.uiDensity);
  const [mobileIconMode, setMobileIconMode] = useState<boolean>(
    currentSettings.mobileIconMode
  );
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>(currentSettings.volumeUnit);
  const [currencySymbol, setCurrencySymbol] = useState(
    currentSettings.currencySymbol
  );
  const [useCustomCurrency, setUseCustomCurrency] = useState(
    !CURRENCY_OPTIONS.some((c) => c.symbol === currentSettings.currencySymbol)
  );

  const [storageInfo, setStorageInfo] = useState<MobileStorageInfo | null>(null);
  const [storageBusy, setStorageBusy] = useState(false);
  const [storageFeedback, setStorageFeedback] = useState<string | null>(null);

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
  const [cloudFeedback, setCloudFeedback] = useState<{
    kind: 'ok' | 'err';
    text: string;
  } | null>(null);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const wizardSteps = useMemo(() => {
    const base = [
      { id: 'db' as const, shortLabel: '1. DB', title: '1. Location of Your Databases' },
      { id: 'font' as const, shortLabel: '2. Font', title: '2. Font Size' },
      { id: 'density' as const, shortLabel: '3. Spacing', title: '3. UI Element Size' },
      { id: 'icon_ui' as const, shortLabel: '4. Icon UI', title: '4. Compact Icon UI' },
      { id: 'units' as const, shortLabel: '5. Units', title: '5. Milk / Volume Units' },
      { id: 'currency' as const, shortLabel: '6. Currency', title: '6. Currency' },
    ];
    if (isAdmin && canEditSettings) {
      return [
        ...base,
        {
          id: 'cloud' as const,
          shortLabel: '7. Cloud',
          title: '7. Optional: Supabase Cloud Setup',
        },
      ];
    }
    return base;
  }, [isAdmin, canEditSettings]);

  const safeStepIndex = Math.min(stepIndex, wizardSteps.length - 1);
  const activeStep = wizardSteps[safeStepIndex];
  const isFirstStep = safeStepIndex === 0;
  const isLastStep = safeStepIndex === wizardSteps.length - 1;

  useEffect(() => {
    setFontScale(currentSettings.fontScale);
    setUiDensity(currentSettings.uiDensity);
    setMobileIconMode(currentSettings.mobileIconMode);
    setVolumeUnit(currentSettings.volumeUnit);
    setCurrencySymbol(currentSettings.currencySymbol);
    setUseCustomCurrency(
      !CURRENCY_OPTIONS.some((c) => c.symbol === currentSettings.currencySymbol)
    );
    setSupabaseUrl(currentSettings.supabaseUrl);
    setSupabaseKey(currentSettings.supabaseAnonKey);
    setWorkspaceId(currentSettings.cloudWorkspaceId || 'farmdb-homestead-main');
    setCloudEnabled(currentSettings.cloudSyncEnabled);
    setAutoSync(currentSettings.autoSyncOnInternet);
  }, [currentSettings]);

  const setPreviewOverrides = ui.setPreviewOverrides;
  useEffect(() => {
    setPreviewOverrides({ fontScale, uiDensity, mobileIconMode });
  }, [fontScale, uiDensity, mobileIconMode, setPreviewOverrides]);

  useEffect(() => {
    return () => {
      setPreviewOverrides(null);
    };
  }, [setPreviewOverrides]);

  useEffect(() => {
    if (!sqlController) return;
    let active = true;
    void sqlController
      .getStorageInfo()
      .then((info) => {
        if (active) setStorageInfo(info);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [sqlController]);

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
        label: 'Custom Currency Symbol',
        icon: 'money' as const,
        hint: 'Custom',
      },
    ],
    []
  );

  const selectedCurrencyValue =
    !useCustomCurrency &&
    CURRENCY_OPTIONS.some((c) => c.symbol === currencySymbol)
      ? currencySymbol
      : '__custom__';

  async function handleToggleReadOnly(enabled: boolean) {
    if (!sqlController) return;
    setStorageBusy(true);
    setStorageFeedback(null);
    try {
      const info = await sqlController.setReadOnlyProtection(enabled);
      setStorageInfo(info);
      setStorageFeedback(
        enabled
          ? 'Read-only SQLite protection active between verified writes.'
          : 'Read-only SQLite protection paused.'
      );
    } catch (err) {
      setStorageFeedback(
        err instanceof Error
          ? err.message
          : 'Unable to update read-only protection.'
      );
    } finally {
      setStorageBusy(false);
    }
  }

  async function handleTestCloud() {
    setCloudFeedback(null);
    const url = supabaseUrl.trim();
    const key = supabaseKey.trim();
    const ws = workspaceId.trim() || 'farmdb-homestead-main';
    if (!url || !key) {
      setCloudFeedback({
        kind: 'err',
        text: 'Paste your Supabase URL and Anon/Publishable Key in Step 3 before testing.',
      });
      return;
    }
    try {
      await updateSettingsMut.mutateAsync({
        supabaseUrl: url,
        supabaseAnonKey: key,
        cloudWorkspaceId: ws,
      });
      const res = await syncMut.mutateAsync('test');
      setCloudFeedback({
        kind: res.ok ? 'ok' : 'err',
        text: res.message,
      });
    } catch (err) {
      setCloudFeedback({
        kind: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'Unable to test Supabase connection.',
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
          mobileIconMode,
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
          : 'Could not complete initial setup.'
      );
    } finally {
      setIsFinishing(false);
    }
  }

  const previewTextSize = Math.round(14 * PREVIEW_FONT_FACTORS[fontScale]);
  const previewBtnHeight = PREVIEW_HEIGHTS[uiDensity];
  const sampleYield = volumeUnit === 'gallons' ? '3.3 gal' : '12.5 L';
  const sampleMoney = formatCurrency(
    currencySymbol === 'UGX' ? 45000 : 125,
    currencySymbol || '$'
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      {/* Forest-Green Header */}
      <View style={[styles.heroBanner, { padding: ui.space(16), gap: ui.space(6) }]}>
        <View style={styles.heroTopRow}>
          <View style={styles.badge}>
            <Text style={[styles.badgeText, { fontSize: ui.font(10) }]}>
              FIRST-TIME SETUP · APPEARS ONCE
            </Text>
          </View>
          <Pressable
            onPress={() => void handleFinish(false)}
            disabled={isFinishing}
            hitSlop={8}
          >
            <Text style={[styles.skipTopText, { fontSize: ui.font(12) }]}>
              Skip
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.heroTitle, { fontSize: ui.font(20) }]}>
          Personalize Your Workspace
        </Text>
        <Text style={[styles.heroSub, { fontSize: ui.font(12) }]}>
          Step {safeStepIndex + 1} of {wizardSteps.length} — Welcome,{' '}
          {activeAccount.displayName}. Configure one preference at a time;
          you only see this wizard once.
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${((safeStepIndex + 1) / wizardSteps.length) * 100}%` },
            ]}
          />
        </View>
        <View style={styles.stepPillRow}>
          {wizardSteps.map((step, idx) => {
            const isActive = idx === safeStepIndex;
            const isDone = idx < safeStepIndex;
            return (
              <Pressable
                key={step.id}
                style={[
                  styles.stepPill,
                  isDone && styles.stepPillDone,
                  isActive && styles.stepPillActive,
                ]}
                onPress={() => setStepIndex(idx)}
              >
                <Text
                  style={[
                    styles.stepPillText,
                    isActive && styles.stepPillTextActive,
                    { fontSize: ui.font(10) },
                  ]}
                >
                  {step.shortLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <FarmScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: ui.contentPadding,
          gap: ui.space(14),
          paddingBottom: ui.space(28),
        }}
      >
        {!canEditSettings ? (
          <View style={[styles.noticeCard, { padding: ui.space(12), borderRadius: ui.radius }]}>
            <Text style={[styles.noticeText, { fontSize: ui.font(12) }]}>
              Shared farm units and currency are controlled by your Farm
              Administrator. Review the active workspace settings below to get
              started.
            </Text>
          </View>
        ) : null}

        {submitError ? (
          <View style={[styles.errorCard, { padding: ui.space(12), borderRadius: ui.radius }]}>
            <Text style={[styles.errorText, { fontSize: ui.font(12) }]}>
              {submitError}
            </Text>
          </View>
        ) : null}

        {/* Step 1. Location of the DBs */}
        {activeStep.id === 'db' ? (
        <View style={[styles.card, { padding: ui.space(14), borderRadius: ui.radius, gap: ui.space(8) }]}>
          <View style={styles.cardHeader}>
            <AppIcon name="database" size={ui.font(18)} />
            <Text style={[styles.cardTitle, { fontSize: ui.font(15) }]}>
              1. Location of Your Databases (SQLite)
            </Text>
          </View>
          <Text style={[styles.explainText, { fontSize: ui.font(12) }]}>
            Every animal, milk yield, health log, and finance record is saved in
            a private SQLite file (farmdb.db) inside your phone&apos;s protected
            app storage so everything works offline. You can export portable
            JSON or .db backups anytime under Export &amp; Backup.
          </Text>

          {Platform.OS === 'web' ? (
            <Text style={[styles.hintText, { fontSize: ui.font(11) }]}>
              Running in web mode. On Android/iOS builds, native SQLite sits
              inside protected app sandbox storage.
            </Text>
          ) : (
            <>
              <View style={styles.pathBox}>
                <Text style={[styles.label, { fontSize: ui.font(11) }]}>
                  Active Mobile Database File
                </Text>
                <Text selectable style={[styles.codeText, { fontSize: ui.font(11) }]}>
                  {storageInfo?.dbPath ?? sqlController?.getDatabasePath() ?? 'Loading...'}
                </Text>
                {storageInfo ? (
                  <Text style={[styles.hintText, { fontSize: ui.font(11) }]}>
                    Size: {(storageInfo.fileSizeBytes / 1024).toFixed(1)} KB
                    {storageInfo.isProtectedCopyAvailable
                      ? ' · Verified shadow copy active'
                      : ''}
                  </Text>
                ) : null}
              </View>

              <View style={styles.switchRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={[styles.label, { fontSize: ui.font(13) }]}>
                    Read-Only SQLite Protection
                  </Text>
                  <Text style={[styles.hintText, { fontSize: ui.font(11) }]}>
                    Locks SQLite between verified writes and keeps a shadow copy
                    to prevent tampering.
                  </Text>
                </View>
                <Switch
                  value={storageInfo?.readOnlyProtection ?? true}
                  disabled={storageBusy || !sqlController || !canEditSettings}
                  onValueChange={(v) => void handleToggleReadOnly(v)}
                  trackColor={{
                    false: FARMDB_COLORS.border,
                    true: FARMDB_COLORS.accent,
                  }}
                />
              </View>

              {storageFeedback ? (
                <Text style={[styles.okText, { fontSize: ui.font(11) }]}>
                  {storageFeedback}
                </Text>
              ) : null}
            </>
          )}
        </View>
        ) : null}

        {/* Step 2. Font Size */}
        {activeStep.id === 'font' ? (
        <View style={[styles.card, { padding: ui.space(14), borderRadius: ui.radius, gap: ui.space(10) }]}>
          <View style={styles.cardHeader}>
            <AppIcon name="settings" size={ui.font(18)} />
            <Text style={[styles.cardTitle, { fontSize: ui.font(15) }]}>
              2. Font Size
            </Text>
          </View>
          <Text style={[styles.explainText, { fontSize: ui.font(12) }]}>
            Controls how big words, herd numbers, notes, and labels appear across
            every screen of farmDB. Tap an option below to preview live sizing.
          </Text>

          <View style={{ gap: 6 }}>
            <Text style={[styles.label, { fontSize: ui.font(12) }]}>
              Preferred Font Size
            </Text>
            <View style={styles.segmentGrid}>
              {FONT_SCALES.map((scale) => {
                const active = fontScale === scale;
                return (
                  <Pressable
                    key={scale}
                    disabled={!canEditSettings}
                    style={[
                      styles.segBtn,
                      active && styles.segBtnActive,
                      { minHeight: 38 },
                    ]}
                    onPress={() => setFontScale(scale)}
                  >
                    <Text
                      style={[
                        styles.segBtnText,
                        active && styles.segBtnTextActive,
                        { fontSize: ui.font(12) },
                      ]}
                    >
                      {FONT_SCALE_LABELS[scale]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.previewBox}>
            <Text style={[styles.hintText, { fontSize: ui.font(10) }]}>
              LIVE TEXT PREVIEW ({FONT_SCALE_LABELS[fontScale].toUpperCase()})
            </Text>
            <Text style={{ fontFamily: FARMDB_FONTS.bold, fontSize: ui.font(14), color: FARMDB_COLORS.text }}>
              Clover (COW-512) · {sampleYield} · {sampleMoney}
            </Text>
          </View>
        </View>
        ) : null}

        {/* Step 3. UI Element Size */}
        {activeStep.id === 'density' ? (
        <View style={[styles.card, { padding: ui.space(14), borderRadius: ui.radius, gap: ui.space(10) }]}>
          <View style={styles.cardHeader}>
            <AppIcon name="settings" size={ui.font(18)} />
            <Text style={[styles.cardTitle, { fontSize: ui.font(15) }]}>
              3. UI Element Size
            </Text>
          </View>
          <Text style={[styles.explainText, { fontSize: ui.font(12) }]}>
            Controls button height, tap targets, and spacing between cards —
            pick Spacious for larger touch buttons or Compact to show more rows
            at once.
          </Text>

          <View style={{ gap: 6 }}>
            <Text style={[styles.label, { fontSize: ui.font(12) }]}>
              Preferred UI Element Size
            </Text>
            <View style={styles.segmentGrid}>
              {UI_DENSITIES.map((density) => {
                const active = uiDensity === density;
                return (
                  <Pressable
                    key={density}
                    disabled={!canEditSettings}
                    style={[
                      styles.segBtn,
                      active && styles.segBtnActive,
                      { minHeight: 38 },
                    ]}
                    onPress={() => setUiDensity(density)}
                  >
                    <Text
                      style={[
                        styles.segBtnText,
                        active && styles.segBtnTextActive,
                        { fontSize: ui.font(12) },
                      ]}
                    >
                      {UI_DENSITY_LABELS[density]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.previewBox}>
            <Text style={[styles.hintText, { fontSize: ui.font(10) }]}>
              LIVE BUTTON HEIGHT PREVIEW ({UI_DENSITY_LABELS[uiDensity].toUpperCase()})
            </Text>
            <View style={[styles.previewBtnSample, { height: ui.controlHeight }]}>
              <Text style={{ fontFamily: FARMDB_FONTS.bold, fontSize: ui.font(13), color: '#fff' }}>
                Sample Button Height ({ui.controlHeight}px)
              </Text>
            </View>
          </View>
        </View>
        ) : null}

        {/* Step 4. Compact Icon UI */}
        {activeStep.id === 'icon_ui' ? (
        <View style={[styles.card, { padding: ui.space(14), borderRadius: ui.radius, gap: ui.space(10) }]}>
          <View style={styles.cardHeader}>
            <AppIcon name="livestock" size={ui.font(18)} />
            <Text style={[styles.cardTitle, { fontSize: ui.font(15) }]}>
              4. Compact Icon UI
            </Text>
          </View>
          <Text style={[styles.explainText, { fontSize: ui.font(12) }]}>
            Uses crisp icons for navigation tabs, species badges, and row
            actions so more livestock details fit comfortably on phone screens.
            Turn this off if you prefer full word labels beside icons.
          </Text>

          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.label, { fontSize: ui.font(13) }]}>
                Compact Icon UI (Recommended)
              </Text>
              <Text style={[styles.hintText, { fontSize: ui.font(11) }]}>
                {mobileIconMode
                  ? 'Icon-first navigation and compact badges active.'
                  : 'Word labels visible alongside icons across navigation & lists.'}
              </Text>
            </View>
            <Switch
              value={mobileIconMode}
              disabled={!canEditSettings}
              onValueChange={setMobileIconMode}
              trackColor={{
                false: FARMDB_COLORS.border,
                true: FARMDB_COLORS.accent,
              }}
            />
          </View>

          <View style={styles.segmentGrid}>
            <Pressable
              disabled={!canEditSettings}
              style={[
                styles.segBtn,
                mobileIconMode && styles.segBtnActive,
                { minHeight: 38 },
              ]}
              onPress={() => setMobileIconMode(true)}
            >
              <Text
                style={[
                  styles.segBtnText,
                  mobileIconMode && styles.segBtnTextActive,
                  { fontSize: ui.font(12) },
                ]}
              >
                Compact Icons
              </Text>
            </Pressable>
            <Pressable
              disabled={!canEditSettings}
              style={[
                styles.segBtn,
                !mobileIconMode && styles.segBtnActive,
                { minHeight: 38 },
              ]}
              onPress={() => setMobileIconMode(false)}
            >
              <Text
                style={[
                  styles.segBtnText,
                  !mobileIconMode && styles.segBtnTextActive,
                  { fontSize: ui.font(12) },
                ]}
              >
                Icons + Word Labels
              </Text>
            </Pressable>
          </View>

          <View style={styles.previewBox}>
            <Text style={[styles.hintText, { fontSize: ui.font(10) }]}>
              LIVE NAVIGATION BAR PREVIEW ({mobileIconMode ? 'COMPACT ICONS' : 'ICONS + LABELS'})
            </Text>
            <View style={styles.dockPreviewRow}>
              {(
                [
                  { icon: 'livestock', label: 'Herd', active: true },
                  { icon: 'production', label: 'Milk', active: false },
                  { icon: 'medical', label: 'Health', active: false },
                  { icon: 'financial', label: 'Finance', active: false },
                ] as const
              ).map((item) => (
                <View
                  key={item.label}
                  style={[
                    styles.dockPreviewItem,
                    item.active && styles.dockPreviewItemActive,
                  ]}
                >
                  <AppIcon
                    name={item.icon}
                    size={ui.font(mobileIconMode ? 18 : 15)}
                    color={item.active ? '#ffffff' : FARMDB_COLORS.textMuted}
                  />
                  {!mobileIconMode ? (
                    <Text
                      style={{
                        fontFamily: FARMDB_FONTS.semibold,
                        fontSize: ui.font(10),
                        color: item.active ? '#ffffff' : FARMDB_COLORS.text,
                      }}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        </View>
        ) : null}

        {/* Step 5. Units */}
        {activeStep.id === 'units' ? (
        <View style={[styles.card, { padding: ui.space(14), borderRadius: ui.radius, gap: ui.space(10) }]}>
          <View style={styles.cardHeader}>
            <AppIcon name="production" size={ui.font(18)} />
            <Text style={[styles.cardTitle, { fontSize: ui.font(15) }]}>
              5. Milk &amp; Volume Units
            </Text>
          </View>
          <Text style={[styles.explainText, { fontSize: ui.font(12) }]}>
            Chooses Liters or US Gallons for daily milk logs and charts (saved
            records convert automatically if changed later).
          </Text>

          <View style={{ gap: 6 }}>
            <Text style={[styles.label, { fontSize: ui.font(12) }]}>
              Milk / Volume Units
            </Text>
            <View style={styles.segmentGrid}>
              {VOLUME_UNITS.map((unit) => {
                const active = volumeUnit === unit;
                return (
                  <Pressable
                    key={unit}
                    disabled={!canEditSettings}
                    style={[
                      styles.segBtn,
                      active && styles.segBtnActive,
                      { minHeight: 40 },
                    ]}
                    onPress={() => setVolumeUnit(unit)}
                  >
                    <Text
                      style={[
                        styles.segBtnText,
                        active && styles.segBtnTextActive,
                        { fontSize: ui.font(12) },
                      ]}
                    >
                      {VOLUME_UNIT_LABELS[unit]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.previewBox}>
            <Text style={[styles.hintText, { fontSize: ui.font(10) }]}>
              SAMPLE READING
            </Text>
            <Text style={{ fontFamily: FARMDB_FONTS.bold, fontSize: ui.font(14), color: FARMDB_COLORS.text }}>
              Daily Average: {sampleYield} / cow
            </Text>
          </View>
        </View>
        ) : null}

        {/* Step 6. Currency */}
        {activeStep.id === 'currency' ? (
        <View style={[styles.card, { padding: ui.space(14), borderRadius: ui.radius, gap: ui.space(10) }]}>
          <View style={styles.cardHeader}>
            <AppIcon name="financial" size={ui.font(18)} />
            <Text style={[styles.cardTitle, { fontSize: ui.font(15) }]}>
              6. Currency
            </Text>
          </View>
          <Text style={[styles.explainText, { fontSize: ui.font(12) }]}>
            Sets the money symbol displayed across milk sales, vet expenses,
            worker payroll, and financial profit totals.
          </Text>

          <View style={{ gap: 6 }}>
            <Text style={[styles.label, { fontSize: ui.font(12) }]}>
              Preferred Currency
            </Text>
            <ModernDropdown
              value={selectedCurrencyValue}
              options={currencyOptions}
              disabled={!canEditSettings}
              title="Select Preferred Currency"
              onChange={(next) => {
                if (next === '__custom__') {
                  setUseCustomCurrency(true);
                  setCurrencySymbol((prev) =>
                    CURRENCY_OPTIONS.some((c) => c.symbol === prev) ? '' : prev
                  );
                } else {
                  setUseCustomCurrency(false);
                  setCurrencySymbol(next);
                }
              }}
            />
            {useCustomCurrency ? (
              <TextInput
                style={[styles.input, { minHeight: ui.controlHeight, fontSize: ui.font(14) }]}
                editable={canEditSettings}
                value={currencySymbol}
                maxLength={6}
                onChangeText={setCurrencySymbol}
                placeholder="Enter symbol (e.g. KES)"
                placeholderTextColor={FARMDB_COLORS.textMuted}
              />
            ) : null}
          </View>

          <View style={styles.previewBox}>
            <Text style={[styles.hintText, { fontSize: ui.font(10) }]}>
              FORMATTED SAMPLE
            </Text>
            <Text style={{ fontFamily: FARMDB_FONTS.bold, fontSize: ui.font(14), color: FARMDB_COLORS.text }}>
              Sample Revenue Entry: {sampleMoney}
            </Text>
          </View>
        </View>
        ) : null}

        {/* 7. Admin Only: Optional Step-by-Step Supabase Cloud DB Setup */}
        {activeStep.id === 'cloud' && isAdmin && canEditSettings ? (
          <View style={[styles.card, { padding: ui.space(14), borderRadius: ui.radius, gap: ui.space(10) }]}>
            <View style={styles.cardHeader}>
              <AppIcon name="cloudHosting" size={ui.font(18)} />
              <Text style={[styles.cardTitle, { fontSize: ui.font(15) }]}>
                7. Optional: Supabase Cloud DB Setup
              </Text>
            </View>
            <Text style={[styles.explainText, { fontSize: ui.font(12) }]}>
              Skip this if using farmDB offline only, or toggle below for
              step-by-step instructions to link your Supabase cloud database.
            </Text>

            <View style={styles.switchRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.label, { fontSize: ui.font(13) }]}>
                  Set up Supabase Cloud Sync Now (Optional)
                </Text>
                <Text style={[styles.hintText, { fontSize: ui.font(11) }]}>
                  Can always be configured later under Settings → Advanced Settings.
                </Text>
              </View>
              <Switch
                value={configureCloudNow}
                onValueChange={setConfigureCloudNow}
                trackColor={{
                  false: FARMDB_COLORS.border,
                  true: FARMDB_COLORS.accent,
                }}
              />
            </View>

            {configureCloudNow ? (
              <View style={{ gap: ui.space(10) }}>
                <View style={styles.stepBox}>
                  <Text style={[styles.stepTitle, { fontSize: ui.font(13) }]}>
                    Step 1 — Create Free Supabase Project
                  </Text>
                  <Text style={[styles.explainText, { fontSize: ui.font(12) }]}>
                    Sign in at supabase.com, click New Project, and wait ~1 minute
                    for it to initialize.
                  </Text>
                </View>

                <View style={styles.stepBox}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <Text style={[styles.stepTitle, { fontSize: ui.font(13) }]}>
                      Step 2 — Run SQL Setup Script
                    </Text>
                    <Pressable
                      style={[
                        styles.secondaryBtn,
                        { minHeight: Math.max(ui.chipHeight - 4, 34) },
                      ]}
                      onPress={() => setShowSqlScript((prev) => !prev)}
                    >
                      <Text style={[styles.secondaryBtnText, { fontSize: ui.font(12) }]}>
                        {showSqlScript ? 'Hide Script' : 'Show Script'}
                      </Text>
                    </Pressable>
                  </View>
                  <Text style={[styles.explainText, { fontSize: ui.font(12) }]}>
                    Open SQL Editor → New Query in Supabase, tap Show Script to
                    view and long-press/copy the full SQL script, then tap Run.
                  </Text>
                  {showSqlScript ? (
                    <Text
                      selectable
                      style={[
                        styles.sqlPreview,
                        {
                          fontSize: ui.font(10),
                          lineHeight: ui.lineHeight(10, 1.5),
                        },
                      ]}
                    >
                      {supabaseSql}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.stepBox}>
                  <Text style={[styles.stepTitle, { fontSize: ui.font(13) }]}>
                    Step 3 — Paste URL, Key &amp; Test Connection
                  </Text>
                  <Text style={[styles.explainText, { fontSize: ui.font(12) }]}>
                    Find Project URL and Anon / Publishable Key under Supabase
                    Project Settings → API:
                  </Text>

                  <TextInput
                    style={[styles.input, { minHeight: ui.controlHeight, fontSize: ui.font(13) }]}
                    value={supabaseUrl}
                    onChangeText={setSupabaseUrl}
                    placeholder="https://your-project-ref.supabase.co"
                    placeholderTextColor={FARMDB_COLORS.textMuted}
                    autoCapitalize="none"
                  />

                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TextInput
                      style={[
                        styles.input,
                        { flex: 1, minHeight: ui.controlHeight, fontSize: ui.font(13) },
                      ]}
                      value={supabaseKey}
                      onChangeText={setSupabaseKey}
                      secureTextEntry={!showKey}
                      placeholder="sb_publishable_... or eyJhbGci..."
                      placeholderTextColor={FARMDB_COLORS.textMuted}
                      autoCapitalize="none"
                    />
                    <Pressable
                      style={[styles.secondaryBtn, { minHeight: ui.controlHeight }]}
                      onPress={() => setShowKey((prev) => !prev)}
                    >
                      <Text style={[styles.secondaryBtnText, { fontSize: ui.font(12) }]}>
                        {showKey ? 'Hide' : 'Show'}
                      </Text>
                    </Pressable>
                  </View>

                  <TextInput
                    style={[styles.input, { minHeight: ui.controlHeight, fontSize: ui.font(13) }]}
                    value={workspaceId}
                    onChangeText={setWorkspaceId}
                    placeholder="farmdb-homestead-main"
                    placeholderTextColor={FARMDB_COLORS.textMuted}
                    autoCapitalize="none"
                  />

                  <Pressable
                    style={[styles.secondaryBtn, { minHeight: ui.chipHeight, alignSelf: 'flex-start' }]}
                    disabled={syncMut.isPending}
                    onPress={() => void handleTestCloud()}
                  >
                    <AppIcon name="web" size={ui.font(14)} />
                    <Text style={[styles.secondaryBtnText, { fontSize: ui.font(12) }]}>
                      {syncMut.isPending ? 'Testing...' : 'Test Connection'}
                    </Text>
                  </Pressable>

                  {cloudFeedback ? (
                    <Text
                      style={[
                        cloudFeedback.kind === 'ok' ? styles.okText : styles.errorText,
                        { fontSize: ui.font(12) },
                      ]}
                    >
                      {cloudFeedback.text}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.stepBox}>
                  <Text style={[styles.stepTitle, { fontSize: ui.font(13) }]}>
                    Step 4 — Enable Cloud Sync &amp; Save Key
                  </Text>
                  <View style={styles.switchRow}>
                    <Text style={[styles.label, { fontSize: ui.font(12), flex: 1 }]}>
                      Enable Supabase Cloud Sync
                    </Text>
                    <Switch
                      value={cloudEnabled}
                      onValueChange={setCloudEnabled}
                      trackColor={{ false: FARMDB_COLORS.border, true: FARMDB_COLORS.accent }}
                    />
                  </View>
                  <View style={styles.switchRow}>
                    <Text style={[styles.label, { fontSize: ui.font(12), flex: 1 }]}>
                      Auto-Sync When Online
                    </Text>
                    <Switch
                      value={autoSync}
                      onValueChange={setAutoSync}
                      trackColor={{ false: FARMDB_COLORS.border, true: FARMDB_COLORS.accent }}
                    />
                  </View>
                  {previewCloudKey ? (
                    <Text selectable style={[styles.codeText, { fontSize: ui.font(10) }]}>
                      Admin Key (long-press to copy): {previewCloudKey}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Wizard Navigation Footer */}
        <View style={styles.footerBtns}>
          {!isFirstStep ? (
            <Pressable
              style={[styles.secondaryBtn, { flex: 1, minHeight: ui.controlHeight }]}
              disabled={isFinishing}
              onPress={() => setStepIndex((prev) => Math.max(0, prev - 1))}
            >
              <Text style={[styles.secondaryBtnText, { fontSize: ui.font(13) }]}>
                ← Back
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.secondaryBtn, { flex: 1, minHeight: ui.controlHeight }]}
              disabled={isFinishing}
              onPress={() => void handleFinish(false)}
            >
              <Text style={[styles.secondaryBtnText, { fontSize: ui.font(13) }]}>
                Skip Setup
              </Text>
            </Pressable>
          )}
          {!isLastStep ? (
            <Pressable
              style={[styles.primaryBtn, { flex: 1.5, minHeight: ui.controlHeight }]}
              disabled={isFinishing}
              onPress={() =>
                setStepIndex((prev) => Math.min(wizardSteps.length - 1, prev + 1))
              }
            >
              <Text style={[styles.primaryBtnText, { fontSize: ui.font(13) }]}>
                Next Step →
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.primaryBtn, { flex: 1.5, minHeight: ui.controlHeight }]}
              disabled={isFinishing || updateSettingsMut.isPending}
              onPress={() => void handleFinish(true)}
            >
              <Text style={[styles.primaryBtnText, { fontSize: ui.font(13) }]}>
                {isFinishing ? 'Saving...' : 'Save & Enter farmDB'}
              </Text>
            </Pressable>
          )}
        </View>
      </FarmScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FARMDB_COLORS.bg },
  heroBanner: {
    backgroundColor: FARMDB_COLORS.darkHeader,
    borderBottomWidth: 1,
    borderBottomColor: '#254231',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(183, 228, 199, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(183, 228, 199, 0.3)',
  },
  badgeText: {
    color: '#b7e4c7',
    fontFamily: FARMDB_FONTS.bold,
    letterSpacing: 0.4,
  },
  skipTopText: {
    color: '#d8efe2',
    fontFamily: FARMDB_FONTS.semibold,
  },
  heroTitle: {
    color: '#ffffff',
    fontFamily: FARMDB_FONTS.bold,
  },
  heroSub: {
    color: '#c9ded1',
    fontFamily: FARMDB_FONTS.regular,
    lineHeight: 18,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    overflow: 'hidden',
    marginTop: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#74c69d',
  },
  stepPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  stepPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  stepPillDone: {
    backgroundColor: 'rgba(116, 198, 157, 0.22)',
    borderColor: 'rgba(116, 198, 157, 0.45)',
  },
  stepPillActive: {
    backgroundColor: '#74c69d',
    borderColor: '#74c69d',
  },
  stepPillText: {
    color: '#d8efe2',
    fontFamily: FARMDB_FONTS.semibold,
  },
  stepPillTextActive: {
    color: '#102218',
    fontFamily: FARMDB_FONTS.bold,
  },
  card: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    color: FARMDB_COLORS.text,
    fontFamily: FARMDB_FONTS.bold,
  },
  explainText: {
    color: FARMDB_COLORS.textMuted,
    fontFamily: FARMDB_FONTS.regular,
    lineHeight: 18,
  },
  hintText: {
    color: FARMDB_COLORS.textMuted,
    fontFamily: FARMDB_FONTS.regular,
  },
  label: {
    color: FARMDB_COLORS.text,
    fontFamily: FARMDB_FONTS.semibold,
  },
  pathBox: {
    backgroundColor: FARMDB_COLORS.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    padding: 10,
    gap: 4,
  },
  codeText: {
    fontFamily: FARMDB_FONTS.mono,
    color: FARMDB_COLORS.darkHeader,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  segmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segBtn: {
    flexGrow: 1,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: FARMDB_COLORS.border,
    backgroundColor: FARMDB_COLORS.surface,
  },
  segBtnActive: {
    borderColor: FARMDB_COLORS.accent,
    backgroundColor: FARMDB_COLORS.accentSoft,
  },
  segBtnText: {
    fontFamily: FARMDB_FONTS.semibold,
    color: FARMDB_COLORS.textMuted,
  },
  segBtnTextActive: {
    color: FARMDB_COLORS.accentHover,
    fontFamily: FARMDB_FONTS.bold,
  },
  previewBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: FARMDB_COLORS.bg,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    gap: 8,
  },
  previewBtnSample: {
    borderRadius: 10,
    backgroundColor: FARMDB_COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dockPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 999,
    padding: 6,
  },
  dockPreviewItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 999,
  },
  dockPreviewItemActive: {
    backgroundColor: FARMDB_COLORS.accent,
  },
  input: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1.5,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: FARMDB_COLORS.text,
    fontFamily: FARMDB_FONTS.regular,
  },
  stepBox: {
    backgroundColor: FARMDB_COLORS.bg,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  stepTitle: {
    color: FARMDB_COLORS.darkHeader,
    fontFamily: FARMDB_FONTS.bold,
  },
  sqlPreview: {
    backgroundColor: '#13241a',
    color: '#d8f3dc',
    fontFamily: FARMDB_FONTS.mono,
    padding: 10,
    borderRadius: 8,
  },
  noticeCard: {
    backgroundColor: '#fff8e6',
    borderWidth: 1,
    borderColor: '#e9c46a',
  },
  noticeText: {
    color: '#6b4f0f',
    fontFamily: FARMDB_FONTS.medium,
  },
  errorCard: {
    backgroundColor: '#fdecec',
    borderWidth: 1,
    borderColor: '#f2b8b5',
  },
  errorText: {
    color: FARMDB_COLORS.danger,
    fontFamily: FARMDB_FONTS.semibold,
  },
  okText: {
    color: FARMDB_COLORS.accentHover,
    fontFamily: FARMDB_FONTS.semibold,
  },
  footerBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryBtn: {
    backgroundColor: FARMDB_COLORS.accent,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontFamily: FARMDB_FONTS.bold,
  },
  secondaryBtn: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1.5,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryBtnText: {
    color: FARMDB_COLORS.text,
    fontFamily: FARMDB_FONTS.semibold,
  },
});
