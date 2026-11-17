import { describe, expect, it } from 'vitest';
import {
  buildLivestockImageStem,
  DEFAULT_FARM_SETTINGS,
  extractSafeImageExtension,
  formatAnimalAge,
  formatDisplayDate,
  formatVolume,
  generateId,
  normalizeTagNumber,
  validateFarmSettings,
  validateNewLivestock,
  validateUpdateLivestock,
} from '../src/index';

describe('@farmdb/core validation', () => {
  it('normalizes tag numbers consistently', () => {
    expect(normalizeTagNumber('  cow 402  ')).toBe('COW-402');
    expect(normalizeTagNumber('a-12')).toBe('A-12');
  });

  it('defaults species to cow and status to active when valid', () => {
    const result = validateNewLivestock(
      {
        tagNumber: 'cow 402',
        name: 'Bessie',
        breed: 'Holstein',
        dob: '2022-04-15',
      },
      { existingTags: ['COW-101'], todayIso: '2026-11-16' }
    );

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({
      species: 'cow',
      tagNumber: 'COW-402',
      name: 'Bessie',
      breed: 'Holstein',
      dob: '2022-04-15',
      imageUri: null,
      sireId: null,
      damId: null,
      status: 'active',
    });
  });

  it('rejects duplicate tag numbers case-insensitively', () => {
    const result = validateNewLivestock(
      { tagNumber: 'cow-402' },
      { existingTags: ['COW 402'] }
    );

    expect(result.ok).toBe(false);
    expect(result.errors.tagNumber).toContain('already assigned');
  });

  it('rejects invalid or future dates of birth', () => {
    const invalidFormat = validateNewLivestock(
      { tagNumber: 'COW-500', dob: '2022-02-30' },
      { todayIso: '2026-11-16' }
    );
    expect(invalidFormat.ok).toBe(false);
    expect(invalidFormat.errors.dob).toBeDefined();

    const futureDate = validateNewLivestock(
      { tagNumber: 'COW-501', dob: '2027-01-01' },
      { todayIso: '2026-11-16' }
    );
    expect(futureDate.ok).toBe(false);
    expect(futureDate.errors.dob).toContain('future');
  });

  it('allows updating own record without triggering duplicate tag error', () => {
    const result = validateUpdateLivestock(
      { tagNumber: 'cow-402', status: 'sold' },
      { existingTags: ['COW-402', 'COW-101'], currentTag: 'COW-402' }
    );

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ tagNumber: 'COW-402', status: 'sold' });
  });

  it('generates distinct UUID v4 identifiers', () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('formats animal age accurately from YYYY-MM-DD', () => {
    const ref = new Date(Date.UTC(2026, 10, 17));
    expect(formatAnimalAge('2024-09-17', ref)).toBe('2 yrs 2 mos');
    expect(formatAnimalAge('2026-08-17', ref)).toBe('3 mos');
    expect(formatAnimalAge('2026-11-10', ref)).toBe('7 days');
    expect(formatAnimalAge(null, ref)).toBe('Unknown');
  });

  it('builds safe image stems and extracts allowed image extensions', () => {
    expect(buildLivestockImageStem('COW 402/A', 'ab-1234-5678')).toBe(
      'cow-402-a-ab12345678'
    );
    expect(extractSafeImageExtension('file:///tmp/photo.PNG?v=1')).toBe('png');
    expect(extractSafeImageExtension('C:\\temp\\weird.exe')).toBe('jpg');
  });

  it('validates extended farm settings and formats dates and volumes', () => {
    const ok = validateFarmSettings({
      farmName: '  Green Pastures  ',
      defaultMilkRatePerLiter: 0.855,
      currencySymbol: ' KES ',
      fontScale: 'large',
      uiDensity: 'spacious',
      dateFormat: 'dmy',
      volumeUnit: 'gallons',
      defaultSpecies: 'goat',
      autoRecordMilkSaleByDefault: false,
      autoRecordMedicalExpenseByDefault: true,
      alertCheckIntervalSeconds: 120,
      enableNotifications: false,
      confirmBeforeDelete: true,
      mobileIconMode: false,
    });
    expect(ok.ok).toBe(true);
    expect(ok.data).toEqual({
      ...DEFAULT_FARM_SETTINGS,
      farmName: 'Green Pastures',
      defaultMilkRatePerLiter: 0.86,
      currencySymbol: 'KES',
      fontScale: 'large',
      uiDensity: 'spacious',
      dateFormat: 'dmy',
      volumeUnit: 'gallons',
      defaultSpecies: 'goat',
      autoRecordMilkSaleByDefault: false,
      autoRecordMedicalExpenseByDefault: true,
      alertCheckIntervalSeconds: 120,
      enableNotifications: false,
      confirmBeforeDelete: true,
      mobileIconMode: false,
    });

    const invalid = validateFarmSettings({
      farmName: '   ',
      defaultMilkRatePerLiter: -2,
      currencySymbol: 'TOO_LONG_CUR',
      alertCheckIntervalSeconds: 5,
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.errors.farmName).toBeDefined();
    expect(invalid.errors.defaultMilkRatePerLiter).toBeDefined();
    expect(invalid.errors.currencySymbol).toBeDefined();
    expect(invalid.errors.alertCheckIntervalSeconds).toBeDefined();

    expect(formatDisplayDate('2026-11-17', 'iso')).toBe('2026-11-17');
    expect(formatDisplayDate('2026-11-17', 'dmy')).toBe('17/11/2026');
    expect(formatDisplayDate('2026-11-17', 'mdy')).toBe('11/17/2026');
    expect(formatVolume(10, 'liters')).toBe('10.0 L');
    expect(formatVolume(3.785411784, 'gallons')).toBe('1.0 gal');
  });
});
