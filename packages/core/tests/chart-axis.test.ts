import { describe, expect, it } from 'vitest';
import {
  buildSampleAxisNumbers,
  estimateTextWidthPx,
  fitCategoryLabelToWidth,
  formatCategoryAxisLabel,
  formatCompactAxisNumber,
} from '../src/index';

describe('@farmdb/core chart axis helpers', () => {
  it('formats small and large axis numbers compactly', () => {
    expect(formatCompactAxisNumber(0)).toBe('0');
    expect(formatCompactAxisNumber(7.5, 1)).toBe('7.5');
    expect(formatCompactAxisNumber(10.0, 1)).toBe('10');
    expect(formatCompactAxisNumber(250.4, 1)).toBe('250');
    expect(formatCompactAxisNumber(1_500)).toBe('1.5k');
    expect(formatCompactAxisNumber(15_400)).toBe('15k');
    expect(formatCompactAxisNumber(2_450_000)).toBe('2.5M');
    expect(formatCompactAxisNumber(1_200_000_000)).toBe('1.2B');
    expect(formatCompactAxisNumber(-12_500)).toBe('-13k');
  });

  it('truncates long category labels while preserving trailing animal tags', () => {
    expect(formatCategoryAxisLabel('Willow (COW-318)', 24)).toBe('Willow (COW-318)');
    const compacted = formatCategoryAxisLabel(
      'Princess Victoria Beatrice (COW-318)',
      24
    );
    expect(compacted).toBe('Princess Vict… (COW-318)');
    expect(compacted.length).toBeLessThanOrEqual(24);
    expect(formatCategoryAxisLabel('Super Long UnTagged Animal Name', 18)).toBe(
      'Super Long UnTagg…'
    );
  });

  it('allocates enough width for multi-word tags like Willow (COW-318)', () => {
    expect(estimateTextWidthPx('Willow (COW-318)', 11)).toBeGreaterThan(96);
  });

  it('fits wide strings within a pixel budget using custom measurer', () => {
    const fitted = fitCategoryLabelToWidth(
      'Wide Named Producer (COW-318)',
      120,
      (t) => estimateTextWidthPx(t, 11)
    );
    expect(estimateTextWidthPx(fitted, 11)).toBeLessThanOrEqual(120);
    expect(fitted).toContain('(COW-318)');
  });

  it('generates sample axis numbers including midpoints and headroom', () => {
    expect(buildSampleAxisNumbers([])).toEqual([0]);
    const samples = buildSampleAxisNumbers([4, 10]);
    expect(samples).toContain(10);
    expect(samples).toContain(5);
    expect(samples).toContain(2.5);
  });
});
