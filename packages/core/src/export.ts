import { DEFAULT_FARM_SETTINGS } from './analytics';
import { normalizeAccountPermissions } from './network';
import {
  inferDefaultLivestockSex,
  LIVESTOCK_SEXES,
  type AlertItem,
  type AnimalOwnership,
  type CloudSyncLog,
  type FarmAccount,
  type FarmSettings,
  type FarmWorker,
  type FinancialLog,
  type Livestock,
  type LivestockSex,
  type MedicalRecord,
  type ProductRecord,
  type WorkerPayment,
  type WorkerTask,
} from './types';
import { validateFarmSettings } from './validation';

export interface FarmDbSnapshot {
  version: 1;
  app: 'farmDB';
  exportedAt: string;
  settings: FarmSettings;
  settingsUpdatedAt?: number;
  livestock: Livestock[];
  productRecords: ProductRecord[];
  medicalRecords: MedicalRecord[];
  financialLogs: FinancialLog[];
  alerts: AlertItem[];
  workers?: FarmWorker[];
  workerPayments?: WorkerPayment[];
  workerTasks?: WorkerTask[];
  animalOwnerships?: AnimalOwnership[];
  farmAccounts?: FarmAccount[];
  cloudSyncLogs?: CloudSyncLog[];
}

export type ExportTableKey =
  | 'livestock'
  | 'product_records'
  | 'medical_records'
  | 'financial_logs'
  | 'alerts'
  | 'workers'
  | 'worker_payments'
  | 'worker_tasks'
  | 'animal_ownerships'
  | 'farm_accounts';

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
      'sex',
      'tag_number',
      'name',
      'breed',
      'dob',
      'image_uri',
      'sire_id',
      'dam_id',
      'status',
      'created_at',
      'updated_at',
    ],
    rows.map((r) => [
      r.id,
      r.species,
      r.sex ?? inferDefaultLivestockSex(r.tagNumber),
      r.tagNumber,
      r.name,
      r.breed,
      r.dob,
      r.imageUri,
      r.sireId ?? null,
      r.damId ?? null,
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

export function exportWorkersToCsv(rows: readonly FarmWorker[]): string {
  return serializeRowsToCsv(
    [
      'id',
      'name',
      'role',
      'phone',
      'responsibilities',
      'salary_amount',
      'pay_frequency',
      'next_payment_due_date',
      'status',
      'hire_date',
      'payment_notified_for_due_date',
      'created_at',
      'updated_at',
    ],
    rows.map((r) => [
      r.id,
      r.name,
      r.role,
      r.phone,
      r.responsibilities,
      r.salaryAmount,
      r.payFrequency,
      r.nextPaymentDueDate,
      r.status,
      r.hireDate,
      r.paymentNotifiedForDueDate ?? null,
      r.createdAt,
      r.updatedAt,
    ])
  );
}

export function exportWorkerPaymentsToCsv(
  rows: readonly WorkerPayment[]
): string {
  return serializeRowsToCsv(
    [
      'id',
      'worker_id',
      'financial_log_id',
      'amount',
      'due_date',
      'paid_date',
      'status',
      'period_label',
      'notes',
      'notified_at',
      'created_at',
      'updated_at',
    ],
    rows.map((r) => [
      r.id,
      r.workerId,
      r.financialLogId,
      r.amount,
      r.dueDate,
      r.paidDate,
      r.status,
      r.periodLabel,
      r.notes,
      r.notifiedAt,
      r.createdAt,
      r.updatedAt,
    ])
  );
}

export function exportWorkerTasksToCsv(rows: readonly WorkerTask[]): string {
  return serializeRowsToCsv(
    [
      'id',
      'worker_id',
      'livestock_id',
      'title',
      'description',
      'priority',
      'status',
      'due_date',
      'completed_at',
      'created_at',
      'updated_at',
    ],
    rows.map((r) => [
      r.id,
      r.workerId,
      r.livestockId,
      r.title,
      r.description,
      r.priority,
      r.status,
      r.dueDate,
      r.completedAt,
      r.createdAt,
      r.updatedAt,
    ])
  );
}

export function exportAnimalOwnershipsToCsv(
  rows: readonly AnimalOwnership[]
): string {
  return serializeRowsToCsv(
    [
      'id',
      'livestock_id',
      'owner_name',
      'owner_contact',
      'account_id',
      'ownership_category',
      'share_percentage',
      'purpose',
      'start_date',
      'expected_end_date',
      'boarding_fee',
      'status',
      'notes',
      'created_at',
      'updated_at',
    ],
    rows.map((r) => [
      r.id,
      r.livestockId,
      r.ownerName,
      r.ownerContact,
      r.accountId,
      r.ownershipCategory,
      r.sharePercentage,
      r.purpose,
      r.startDate,
      r.expectedEndDate,
      r.boardingFee,
      r.status,
      r.notes,
      r.createdAt,
      r.updatedAt,
    ])
  );
}

export function exportFarmAccountsToCsv(rows: readonly FarmAccount[]): string {
  return serializeRowsToCsv(
    [
      'id',
      'display_name',
      'email',
      'phone',
      'role',
      'relationship',
      'avatar_key',
      'is_primary_admin',
      'can_manage_network',
      'can_sync_cloud',
      'permissions',
      'status',
      'last_synced_at',
      'created_at',
      'updated_at',
    ],
    rows.map((r) => [
      r.id,
      r.displayName,
      r.email,
      r.phone,
      r.role,
      r.relationship,
      r.avatarKey,
      r.isPrimaryAdmin ? 1 : 0,
      r.canManageNetwork ? 1 : 0,
      r.canSyncCloud ? 1 : 0,
      JSON.stringify(r.permissions),
      r.status,
      r.lastSyncedAt,
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
    'workers.csv': exportWorkersToCsv(snapshot.workers ?? []),
    'worker_payments.csv': exportWorkerPaymentsToCsv(snapshot.workerPayments ?? []),
    'worker_tasks.csv': exportWorkerTasksToCsv(snapshot.workerTasks ?? []),
    'animal_ownerships.csv': exportAnimalOwnershipsToCsv(
      snapshot.animalOwnerships ?? []
    ),
    'farm_accounts.csv': exportFarmAccountsToCsv(snapshot.farmAccounts ?? []),
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
    case 'workers':
      return exportWorkersToCsv(snapshot.workers ?? []);
    case 'worker_payments':
      return exportWorkerPaymentsToCsv(snapshot.workerPayments ?? []);
    case 'worker_tasks':
      return exportWorkerTasksToCsv(snapshot.workerTasks ?? []);
    case 'animal_ownerships':
      return exportAnimalOwnershipsToCsv(snapshot.animalOwnerships ?? []);
    case 'farm_accounts':
      return exportFarmAccountsToCsv(snapshot.farmAccounts ?? []);
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

  const mergedSettingsInput: Partial<FarmSettings> =
    candidate.settings && typeof candidate.settings === 'object'
      ? { ...DEFAULT_FARM_SETTINGS, ...candidate.settings }
      : { ...DEFAULT_FARM_SETTINGS };
  const validatedSettings = validateFarmSettings(mergedSettingsInput);

  return {
    version: 1,
    app: 'farmDB',
    exportedAt:
      typeof candidate.exportedAt === 'string'
        ? candidate.exportedAt
        : new Date().toISOString(),
    settings: validatedSettings.ok && validatedSettings.data
      ? validatedSettings.data
      : { ...DEFAULT_FARM_SETTINGS },
    ...(typeof candidate.settingsUpdatedAt === 'number' &&
    Number.isFinite(candidate.settingsUpdatedAt)
      ? { settingsUpdatedAt: candidate.settingsUpdatedAt }
      : {}),
    livestock: candidate.livestock.map((row) => ({
      ...row,
      sex: (LIVESTOCK_SEXES as readonly string[]).includes(row.sex)
        ? (row.sex as LivestockSex)
        : inferDefaultLivestockSex(row.tagNumber),
      sireId: row.sireId ?? null,
      damId: row.damId ?? null,
    })),
    productRecords: candidate.productRecords,
    medicalRecords: candidate.medicalRecords,
    financialLogs: candidate.financialLogs,
    alerts: candidate.alerts,
    ...(Array.isArray(candidate.workers) ? { workers: candidate.workers } : {}),
    ...(Array.isArray(candidate.workerPayments)
      ? { workerPayments: candidate.workerPayments }
      : {}),
    ...(Array.isArray(candidate.workerTasks)
      ? { workerTasks: candidate.workerTasks }
      : {}),
    ...(Array.isArray(candidate.animalOwnerships)
      ? { animalOwnerships: candidate.animalOwnerships }
      : {}),
    ...(Array.isArray(candidate.farmAccounts)
      ? {
          farmAccounts: candidate.farmAccounts.map((acc) => ({
            ...acc,
            accessCode: acc.accessCode ?? null,
            supabaseUrl: acc.supabaseUrl ?? null,
            supabaseAnonKey: acc.supabaseAnonKey ?? null,
            cloudWorkspaceId: acc.cloudWorkspaceId ?? null,
            canManageNetwork: Boolean(acc.canManageNetwork ?? acc.isPrimaryAdmin),
            canSyncCloud: acc.canSyncCloud ?? true,
            permissions: normalizeAccountPermissions(acc.permissions, acc.role),
            status: acc.status ?? 'active',
          })),
        }
      : {}),
    ...(Array.isArray(candidate.cloudSyncLogs)
      ? { cloudSyncLogs: candidate.cloudSyncLogs }
      : {}),
  };
}
