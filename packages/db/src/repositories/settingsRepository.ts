import { eq } from 'drizzle-orm';
import {
  DEFAULT_FARM_SETTINGS,
  validateFarmSettings,
  type FarmSettings,
  type ValidationErrors,
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
  update(input: Partial<FarmSettings>): Promise<FarmSettings>;
}

const KEY_MILK_RATE = 'defaultMilkRatePerLiter';
const KEY_CURRENCY = 'currencySymbol';

export function createSettingsRepository(
  db: FarmDrizzleDb,
  events: DatabaseEventBus
): SettingsRepository {
  return {
    async get(): Promise<FarmSettings> {
      const rows = await db.select().from(farmSettings);
      let defaultMilkRatePerLiter: number =
        DEFAULT_FARM_SETTINGS.defaultMilkRatePerLiter;
      let currencySymbol: string = DEFAULT_FARM_SETTINGS.currencySymbol;

      for (const row of rows) {
        if (row.key === KEY_MILK_RATE) {
          const parsed = Number(row.value);
          if (Number.isFinite(parsed) && parsed >= 0) {
            defaultMilkRatePerLiter = parsed;
          }
        } else if (row.key === KEY_CURRENCY && row.value.trim()) {
          currencySymbol = row.value.trim();
        }
      }

      return { defaultMilkRatePerLiter, currencySymbol };
    },

    async update(input: Partial<FarmSettings>): Promise<FarmSettings> {
      const current = await this.get();
      const merged: FarmSettings = {
        defaultMilkRatePerLiter:
          input.defaultMilkRatePerLiter ?? current.defaultMilkRatePerLiter,
        currencySymbol: input.currencySymbol ?? current.currencySymbol,
      };

      const validation = validateFarmSettings(merged);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid farm settings.';
        throw new SettingsValidationError(validation.errors, msg);
      }

      const now = Date.now();
      const pairs: Array<[string, string]> = [
        [KEY_MILK_RATE, String(validation.data.defaultMilkRatePerLiter)],
        [KEY_CURRENCY, validation.data.currencySymbol],
      ];

      for (const [key, value] of pairs) {
        const existing = await db
          .select()
          .from(farmSettings)
          .where(eq(farmSettings.key, key))
          .get();

        if (existing) {
          await db
            .update(farmSettings)
            .set({ value, updatedAt: now })
            .where(eq(farmSettings.key, key))
            .run();
        } else {
          await db
            .insert(farmSettings)
            .values({ key, value, updatedAt: now })
            .run();
        }
      }

      events.emit(['settings']);
      return validation.data;
    },
  };
}
