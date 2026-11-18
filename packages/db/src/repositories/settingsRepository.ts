import { eq } from 'drizzle-orm';
import {
  DATE_FORMATS,
  DEFAULT_FARM_SETTINGS,
  FONT_SCALES,
  SPECIES_LIST,
  SYNC_CONFLICT_STRATEGIES,
  UI_DENSITIES,
  VOLUME_UNITS,
  validateFarmSettings,
  type DateFormatPreference,
  type FarmSettings,
  type FontScale,
  type Species,
  type SyncConflictStrategy,
  type UiDensity,
  type ValidationErrors,
  type VolumeUnit,
} from '@farmdb/core';
import type { FarmDrizzleDb } from '../driver';
import type { DatabaseEventBus } from '../events';
import { farmSettings } from '../schema';

export class SettingsValidationError extends Error {
  readonly errors: ValidationErrors<FarmSettings>;

  constructor(
    errors: ValidationErrors<FarmSettings>,
    message = 'Invalid farm settings.'
  ) {
    super(message);
    this.name = 'SettingsValidationError';
    this.errors = errors;
  }
}

export interface SettingsRepository {
  get(): Promise<FarmSettings>;
  getUpdatedAt(): Promise<number>;
  update(input: Partial<FarmSettings>): Promise<FarmSettings>;
  restoreSettings(
    input: FarmSettings,
    updatedAt?: number
  ): Promise<FarmSettings>;
  reset(): Promise<FarmSettings>;
}

function parseEnum<T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  return raw !== undefined && allowed.includes(raw as T) ? (raw as T) : fallback;
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return fallback;
}

function parseStoredSettings(rawMap: Map<string, string>): FarmSettings {
  const rate = Number(rawMap.get('defaultMilkRatePerLiter'));
  const interval = Number(rawMap.get('alertCheckIntervalSeconds'));
  const leadDays = Number(rawMap.get('paymentAlertLeadDays'));
  const syncInterval = Number(rawMap.get('cloudSyncIntervalSeconds'));
  const rawName = rawMap.get('farmName')?.trim();
  const rawCurrency = rawMap.get('currencySymbol')?.trim();
  const rawAccountId = rawMap.get('activeAccountId')?.trim();
  const rawWorkspace = rawMap.get('cloudWorkspaceId')?.trim();

  return {
    farmName:
      rawName && rawName.length <= 60
        ? rawName
        : DEFAULT_FARM_SETTINGS.farmName,
    defaultMilkRatePerLiter:
      Number.isFinite(rate) && rate >= 0
        ? rate
        : DEFAULT_FARM_SETTINGS.defaultMilkRatePerLiter,
    currencySymbol:
      rawCurrency && rawCurrency.length <= 6
        ? rawCurrency
        : DEFAULT_FARM_SETTINGS.currencySymbol,
    fontScale: parseEnum<FontScale>(
      rawMap.get('fontScale'),
      FONT_SCALES,
      DEFAULT_FARM_SETTINGS.fontScale
    ),
    uiDensity: parseEnum<UiDensity>(
      rawMap.get('uiDensity'),
      UI_DENSITIES,
      DEFAULT_FARM_SETTINGS.uiDensity
    ),
    dateFormat: parseEnum<DateFormatPreference>(
      rawMap.get('dateFormat'),
      DATE_FORMATS,
      DEFAULT_FARM_SETTINGS.dateFormat
    ),
    volumeUnit: parseEnum<VolumeUnit>(
      rawMap.get('volumeUnit'),
      VOLUME_UNITS,
      DEFAULT_FARM_SETTINGS.volumeUnit
    ),
    defaultSpecies: parseEnum<Species>(
      rawMap.get('defaultSpecies'),
      SPECIES_LIST,
      DEFAULT_FARM_SETTINGS.defaultSpecies
    ),
    autoRecordMilkSaleByDefault: parseBool(
      rawMap.get('autoRecordMilkSaleByDefault'),
      DEFAULT_FARM_SETTINGS.autoRecordMilkSaleByDefault
    ),
    autoRecordMedicalExpenseByDefault: parseBool(
      rawMap.get('autoRecordMedicalExpenseByDefault'),
      DEFAULT_FARM_SETTINGS.autoRecordMedicalExpenseByDefault
    ),
    autoRecordPayrollExpenseByDefault: parseBool(
      rawMap.get('autoRecordPayrollExpenseByDefault'),
      DEFAULT_FARM_SETTINGS.autoRecordPayrollExpenseByDefault
    ),
    paymentAlertLeadDays:
      Number.isInteger(leadDays) && leadDays >= 0 && leadDays <= 30
        ? leadDays
        : DEFAULT_FARM_SETTINGS.paymentAlertLeadDays,
    alertCheckIntervalSeconds:
      Number.isInteger(interval) && interval >= 15 && interval <= 3600
        ? interval
        : DEFAULT_FARM_SETTINGS.alertCheckIntervalSeconds,
    enableNotifications: parseBool(
      rawMap.get('enableNotifications'),
      DEFAULT_FARM_SETTINGS.enableNotifications
    ),
    confirmBeforeDelete: parseBool(
      rawMap.get('confirmBeforeDelete'),
      DEFAULT_FARM_SETTINGS.confirmBeforeDelete
    ),
    mobileIconMode: parseBool(
      rawMap.get('mobileIconMode'),
      DEFAULT_FARM_SETTINGS.mobileIconMode
    ),
    activeAccountId:
      rawAccountId && rawAccountId.length > 0
        ? rawAccountId
        : DEFAULT_FARM_SETTINGS.activeAccountId,
    cloudSyncEnabled: parseBool(
      rawMap.get('cloudSyncEnabled'),
      DEFAULT_FARM_SETTINGS.cloudSyncEnabled
    ),
    supabaseUrl: (rawMap.get('supabaseUrl') ?? DEFAULT_FARM_SETTINGS.supabaseUrl).trim(),
    supabaseAnonKey: (
      rawMap.get('supabaseAnonKey') ?? DEFAULT_FARM_SETTINGS.supabaseAnonKey
    ).trim(),
    cloudWorkspaceId:
      rawWorkspace && rawWorkspace.length <= 80
        ? rawWorkspace
        : DEFAULT_FARM_SETTINGS.cloudWorkspaceId,
    autoSyncOnInternet: parseBool(
      rawMap.get('autoSyncOnInternet'),
      DEFAULT_FARM_SETTINGS.autoSyncOnInternet
    ),
    cloudSyncIntervalSeconds:
      Number.isInteger(syncInterval) && syncInterval >= 30 && syncInterval <= 86400
        ? syncInterval
        : DEFAULT_FARM_SETTINGS.cloudSyncIntervalSeconds,
    syncConflictStrategy: parseEnum<SyncConflictStrategy>(
      rawMap.get('syncConflictStrategy'),
      SYNC_CONFLICT_STRATEGIES,
      DEFAULT_FARM_SETTINGS.syncConflictStrategy
    ),
    syncIncludeFinancials: parseBool(
      rawMap.get('syncIncludeFinancials'),
      DEFAULT_FARM_SETTINGS.syncIncludeFinancials
    ),
    syncIncludeHr: parseBool(
      rawMap.get('syncIncludeHr'),
      DEFAULT_FARM_SETTINGS.syncIncludeHr
    ),
    networkJoinKey:
      rawMap.get('networkJoinKey')?.trim().toUpperCase() ||
      DEFAULT_FARM_SETTINGS.networkJoinKey,
  };
}

export function createSettingsRepository(
  db: FarmDrizzleDb,
  events: DatabaseEventBus
): SettingsRepository {
  async function persistSettings(
    validated: FarmSettings,
    options?: { updatedAt?: number; forceTimestamp?: boolean }
  ): Promise<FarmSettings> {
    const now = options?.updatedAt ?? Date.now();
    const forceTimestamp = Boolean(options?.forceTimestamp);
    const keys = Object.keys(validated) as Array<keyof FarmSettings>;

    for (const key of keys) {
      const value = String(validated[key]);
      const existing = await db
        .select()
        .from(farmSettings)
        .where(eq(farmSettings.key, key))
        .get();

      if (existing) {
        if (existing.value !== value || forceTimestamp) {
          await db
            .update(farmSettings)
            .set({ value, updatedAt: now })
            .where(eq(farmSettings.key, key))
            .run();
        }
      } else {
        await db
          .insert(farmSettings)
          .values({ key, value, updatedAt: now })
          .run();
      }
    }

    events.emit(['settings']);
    return validated;
  }

  return {
    async get(): Promise<FarmSettings> {
      const rows = await db.select().from(farmSettings);
      const rawMap = new Map<string, string>();
      for (const row of rows) {
        rawMap.set(row.key, row.value);
      }
      return parseStoredSettings(rawMap);
    },

    async getUpdatedAt(): Promise<number> {
      const rows = await db.select().from(farmSettings);
      let maxUpdatedAt = 0;
      for (const row of rows) {
        if (row.key === 'activeAccountId') continue;
        if (row.updatedAt > maxUpdatedAt) {
          maxUpdatedAt = row.updatedAt;
        }
      }
      return maxUpdatedAt;
    },

    async update(input: Partial<FarmSettings>): Promise<FarmSettings> {
      const current = await this.get();
      const merged: FarmSettings = {
        ...current,
        ...input,
      };

      const validation = validateFarmSettings(merged);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid farm settings.';
        throw new SettingsValidationError(validation.errors, msg);
      }

      return persistSettings(validation.data);
    },

    async restoreSettings(
      input: FarmSettings,
      updatedAt?: number
    ): Promise<FarmSettings> {
      const validation = validateFarmSettings(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid farm settings.';
        throw new SettingsValidationError(validation.errors, msg);
      }
      return persistSettings(validation.data, {
        updatedAt: updatedAt ?? Date.now(),
        forceTimestamp: true,
      });
    },

    async reset(): Promise<FarmSettings> {
      return persistSettings({ ...DEFAULT_FARM_SETTINGS });
    },
  };
}
