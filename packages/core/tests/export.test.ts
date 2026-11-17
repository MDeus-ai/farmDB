import { describe, expect, it } from 'vitest';
import {
  buildAllCsvExports,
  escapeCsvCell,
  parseFarmSnapshotJson,
  serializeFarmSnapshotJson,
  type FarmDbSnapshot,
} from '../src/index';

describe('@farmdb/core phase 5 export & snapshot', () => {
  it('escapes RFC-4180 CSV values safely', () => {
    expect(escapeCsvCell('plain')).toBe('plain');
    expect(escapeCsvCell('a, "b"\nc')).toBe('"a, ""b""\nc"');
    expect(escapeCsvCell(null)).toBe('');
  });

  it('serializes and parses full snapshots and generates CSV tables', () => {
    const snapshot: FarmDbSnapshot = {
      version: 1,
      app: 'farmDB',
      exportedAt: '2026-11-17T12:00:00.000Z',
      settings: { defaultMilkRatePerLiter: 0.75, currencySymbol: '$' },
      livestock: [
        {
          id: 'c1',
          species: 'cow',
          tagNumber: 'COW-402',
          name: 'Bessie, Jr.',
          breed: 'Holstein',
          dob: '2022-04-01',
          imageUri: null,
          status: 'active',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      productRecords: [
        {
          id: 'p1',
          livestockId: 'c1',
          date: '2026-11-16',
          yieldAmount: 18.5,
          qualityNotes: 'Clean "Grade A"',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      medicalRecords: [],
      financialLogs: [],
      alerts: [
        {
          id: 'a1',
          livestockId: 'c1',
          entryKind: 'alert',
          title: 'Vaccination',
          description: null,
          triggerDate: '2026-11-20',
          isResolved: false,
          notifiedAt: null,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    };

    const json = serializeFarmSnapshotJson(snapshot);
    const parsed = parseFarmSnapshotJson(json);
    expect(parsed).toEqual(snapshot);

    const csvs = buildAllCsvExports(snapshot);
    expect(csvs['livestock.csv']).toContain('"Bessie, Jr."');
    expect(csvs['product_records.csv']).toContain('"Clean ""Grade A"""');
    expect(csvs['alerts.csv']).toContain('Vaccination');

    expect(() => parseFarmSnapshotJson('{bad json')).toThrow('valid JSON');
    expect(() => parseFarmSnapshotJson('{"app":"other"}')).toThrow(
      'Unsupported'
    );
  });
});
