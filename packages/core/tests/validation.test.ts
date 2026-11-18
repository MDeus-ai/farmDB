import { describe, expect, it } from 'vitest';
import {
  buildLivestockImageStem,
  DEFAULT_FARM_SETTINGS,
  extractSafeImageExtension,
  formatAnimalAge,
  formatDisplayDate,
  formatVolume,
  generateId,
  isMilkProducingSpecies,
  normalizeTagNumber,
  validateFarmSettings,
  validateNewAnimalOwnership,
  validateNewFinancialLog,
  validateNewLivestock,
  validateNewProductRecord,
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
      sex: 'female',
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

  it('enforces milk-producing species, realistic yields, date coherence, and category matching', () => {
    expect(isMilkProducingSpecies('cow')).toBe(true);
    expect(isMilkProducingSpecies('goat')).toBe(true);
    expect(isMilkProducingSpecies('sheep')).toBe(true);
    expect(isMilkProducingSpecies('duck')).toBe(false);
    expect(isMilkProducingSpecies('other')).toBe(false);

    const nonDairyMilk = validateNewProductRecord(
      { livestockId: 'd1', date: '2026-11-10', yieldAmount: 5 },
      { animal: { species: 'duck', dob: '2024-01-01', status: 'active' }, todayIso: '2026-11-18' }
    );
    expect(nonDairyMilk.ok).toBe(false);
    expect(nonDairyMilk.errors.livestockId).toContain('milk-producing animals');

    const bullMilk = validateNewProductRecord(
      { livestockId: 'b1', date: '2026-11-10', yieldAmount: 10 },
      { animal: { species: 'cow', sex: 'male', dob: '2022-01-01', status: 'active' }, todayIso: '2026-11-18' }
    );
    expect(bullMilk.ok).toBe(false);
    expect(bullMilk.errors.livestockId).toContain('male');

    const invalidSireSex = validateNewLivestock(
      { tagNumber: 'COW-777', species: 'cow', sex: 'female', sireId: 'f1' },
      {
        allLivestock: [
          {
            id: 'f1',
            species: 'cow',
            sex: 'female',
            tagNumber: 'COW-100',
            name: 'Bella',
            breed: null,
            dob: '2020-01-01',
            imageUri: null,
            sireId: null,
            damId: null,
            status: 'active',
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }
    );
    expect(invalidSireSex.ok).toBe(false);
    expect(invalidSireSex.errors.sireId).toContain('male');

    const absurdYield = validateNewProductRecord(
      { livestockId: 'c1', date: '2026-11-10', yieldAmount: 400 },
      { animal: { species: 'cow', dob: '2022-01-01', status: 'active' }, todayIso: '2026-11-18' }
    );
    expect(absurdYield.ok).toBe(false);
    expect(absurdYield.errors.yieldAmount).toBeDefined();

    const preBirthMilk = validateNewProductRecord(
      { livestockId: 'c1', date: '2021-05-01', yieldAmount: 12 },
      { animal: { species: 'cow', dob: '2022-01-01', status: 'active' }, todayIso: '2026-11-18' }
    );
    expect(preBirthMilk.ok).toBe(false);
    expect(preBirthMilk.errors.date).toBeDefined();

    const badFinCategory = validateNewFinancialLog(
      { date: '2026-11-10', transactionType: 'income', category: 'veterinary', amount: 50 },
      { todayIso: '2026-11-18' }
    );
    expect(badFinCategory.ok).toBe(false);
    expect(badFinCategory.errors.category).toBeDefined();

    const badOwnershipEnd = validateNewAnimalOwnership({
      livestockId: 'c1',
      ownerName: 'Partner Farm',
      startDate: '2026-11-15',
      expectedEndDate: '2026-11-01',
    });
    expect(badOwnershipEnd.ok).toBe(false);
    expect(badOwnershipEnd.errors.expectedEndDate).toBeDefined();

    const pre1980Animal = validateNewLivestock(
      { tagNumber: 'COW-OLD', dob: '1970-01-01' },
      { todayIso: '2026-11-18' }
    );
    expect(pre1980Animal.ok).toBe(false);
    expect(pre1980Animal.errors.dob).toBeDefined();
  });
});
