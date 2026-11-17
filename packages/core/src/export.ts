import type {
  AlertItem,
  FarmSettings,
  FinancialLog,
  Livestock,
  MedicalRecord,
  ProductRecord,
} from './types';

export interface FarmDbSnapshot {
  version: 1;
  app: 'farmDB';
  exportedAt: string;
  settings: FarmSettings;
  livestock: Livestock[];
  productRecords: ProductRecord[];
  medicalRecords: MedicalRecord[];
  financialLogs: FinancialLog[];
  alerts: AlertItem[];
}

export type ExportTableKey =
  | 'livestock'
  | 'product_records'
  | 'medical_records'
  | 'financial_logs'
  | 'alerts';

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (
    str.includes(',') ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function serializeRowsToCsv(
  headers: readonly string[],
  rows: ReadonlyArray<readonly unknown[]>
): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(','));
  return [headerLine, ...dataLines].join('\r\n');
}

export function exportLivestockToCsv(rows: readonly Livestock[]): string {
  return serializeRowsToCsv(
    [
      'id',
      'species',
      'tag_number',
      'name',
      'breed',
      'dob',
      'image_uri',
      'status',
      'created_at',
      'updated_at',
    ],
    rows.map((r) => [
      r.id,
      r.species,
      r.tagNumber,
      r.name,
      r.breed,
      r.dob,
      r.imageUri,
      r.status,
      r.createdAt,
      r.updatedAt,
    ])
  );
}

export function exportProductRecordsToCsv(
  rows: readonly ProductRecord[]
): string {
  return serializeRowsToCsv(
    [
      'id',
      'livestock_id',
      'date',
      'yield_amount',
      'quality_notes',
      'created_at',
      'updated_at',
    ],
    rows.map((r) => [
      r.id,
      r.livestockId,
      r.date,
      r.yieldAmount,
      r.qualityNotes,
      r.createdAt,
      r.updatedAt,
    ])
  );
}

export function exportMedicalRecordsToCsv(
  rows: readonly MedicalRecord[]
): string {
  return serializeRowsToCsv(
    [
      'id',
      'livestock_id',
      'date',
      'condition',
      'treatment',
      'cost',
      'veterinarian',
      'created_at',
      'updated_at',
    ],
    rows.map((r) => [
      r.id,
      r.livestockId,
      r.date,
      r.condition,
      r.treatment,
      r.cost,
      r.veterinarian,
      r.createdAt,
      r.updatedAt,
    ])
  );
}

export function exportFinancialLogsToCsv(
  rows: readonly FinancialLog[]
): string {
  return serializeRowsToCsv(
    [
      'id',
      'livestock_id',
      'product_record_id',
      'transaction_type',
      'amount',
      'date',
      'category',
      'notes',
      'created_at',
      'updated_at',
    ],
    rows.map((r) => [
      r.id,
      r.livestockId,
      r.productRecordId,
      r.transactionType,
      r.amount,
      r.date,
      r.category,
      r.notes,
      r.createdAt,
      r.updatedAt,
    ])
  );
}

export function exportAlertsToCsv(rows: readonly AlertItem[]): string {
  return serializeRowsToCsv(
    [
      'id',
      'livestock_id',
      'entry_kind',
      'title',
      'description',
      'trigger_date',
      'is_resolved',
      'notified_at',
      'created_at',
      'updated_at',
    ],
    rows.map((r) => [
      r.id,
      r.livestockId,
      r.entryKind,
      r.title,
      r.description,
      r.triggerDate,
      r.isResolved ? 1 : 0,
      r.notifiedAt,
      r.createdAt,
      r.updatedAt,
    ])
  );
}

export function buildAllCsvExports(
  snapshot: FarmDbSnapshot
): Record<`${ExportTableKey}.csv`, string> {
  return {
    'livestock.csv': exportLivestockToCsv(snapshot.livestock),
    'product_records.csv': exportProductRecordsToCsv(snapshot.productRecords),
    'medical_records.csv': exportMedicalRecordsToCsv(snapshot.medicalRecords),
    'financial_logs.csv': exportFinancialLogsToCsv(snapshot.financialLogs),
    'alerts.csv': exportAlertsToCsv(snapshot.alerts),
  };
}

export function exportCsvByTable(
  snapshot: FarmDbSnapshot,
  table: ExportTableKey
): string {
  switch (table) {
    case 'livestock':
      return exportLivestockToCsv(snapshot.livestock);
    case 'product_records':
      return exportProductRecordsToCsv(snapshot.productRecords);
    case 'medical_records':
      return exportMedicalRecordsToCsv(snapshot.medicalRecords);
    case 'financial_logs':
      return exportFinancialLogsToCsv(snapshot.financialLogs);
    case 'alerts':
      return exportAlertsToCsv(snapshot.alerts);
  }
}

export function serializeFarmSnapshotJson(snapshot: FarmDbSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

export function parseFarmSnapshotJson(raw: string): FarmDbSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Selected file does not contain valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid farmDB snapshot format.');
  }

  const candidate = parsed as Partial<FarmDbSnapshot>;
  if (candidate.app !== 'farmDB' || candidate.version !== 1) {
    throw new Error('Unsupported or unrecognized farmDB JSON backup version.');
  }

  if (
    !Array.isArray(candidate.livestock) ||
    !Array.isArray(candidate.productRecords) ||
    !Array.isArray(candidate.medicalRecords) ||
    !Array.isArray(candidate.financialLogs) ||
    !Array.isArray(candidate.alerts)
  ) {
    throw new Error('Backup JSON is missing one or more required tables.');
  }

  return {
    version: 1,
    app: 'farmDB',
    exportedAt:
      typeof candidate.exportedAt === 'string'
        ? candidate.exportedAt
        : new Date().toISOString(),
    settings:
      candidate.settings &&
      typeof candidate.settings.defaultMilkRatePerLiter === 'number' &&
      typeof candidate.settings.currencySymbol === 'string'
        ? candidate.settings
        : { defaultMilkRatePerLiter: 0.65, currencySymbol: '$' },
    livestock: candidate.livestock,
    productRecords: candidate.productRecords,
    medicalRecords: candidate.medicalRecords,
    financialLogs: candidate.financialLogs,
    alerts: candidate.alerts,
  };
}
