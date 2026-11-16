import { describe, expect, it } from 'vitest';
import {
  generateId,
  normalizeTagNumber,
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
});
