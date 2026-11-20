import {
  advancePayDueDate,
  buildStandardUserPermissions,
  computeHrSummary,
  decodeFarmNetworkJoinKey,
  DEFAULT_ADMIN_ACCOUNT,
  DEFAULT_FARM_SETTINGS,
  generateId,
  generateShortJoinCode,
  getDefaultPermissionsForRole,
  getTodayIsoDate,
  inferDefaultLivestockSex,
  isAdminAccount,
  LIVESTOCK_SEXES,
  mergeFarmSnapshots,
  normalizeAccountPermissions,
  normalizeSupabaseBaseUrl,
  normalizeTagNumber,
  parseFarmSnapshotJson,
  roundAmount,
  validateFarmSettings,
  validateNewAlert,
  validateNewAnimalOwnership,
  validateNewFarmAccount,
  validateNewFarmWorker,
  validateNewFinancialLog,
  validateNewLivestock,
  validateNewMedicalRecord,
  validateNewProductRecord,
  validateNewWorkerPayment,
  validateNewWorkerTask,
  validateUpdateAlert,
  validateUpdateAnimalOwnership,
  validateUpdateFarmAccount,
  validateUpdateFarmWorker,
  validateUpdateFinancialLog,
  validateUpdateLivestock,
  validateUpdateMedicalRecord,
  validateUpdateProductRecord,
  validateUpdateWorkerPayment,
  validateUpdateWorkerTask,
  type AlertFilter,
  type AlertItem,
  type AnimalOwnership,
  type AnimalOwnershipFilter,
  type CloudSyncDirection,
  type CloudSyncLog,
  type FarmAccount,
  type FarmAccountFilter,
  type FarmAccountRole,
  type FarmDbSnapshot,
  type FarmSettings,
  type FarmWorker,
  type FarmWorkerFilter,
  type FinancialLog,
  type FinancialLogFilter,
  type HrDuePaymentAlertItem,
  type Livestock,
  type LivestockFilter,
  type LivestockSex,
  type MedicalRecord,
  type MedicalRecordFilter,
  type NewAlertInput,
  type NewAnimalOwnershipInput,
  type NewFarmAccountInput,
  type NewFarmWorkerInput,
  type NewFinancialLogInput,
  type NewLivestockInput,
  type NewMedicalRecordInput,
  type NewProductRecordInput,
  type NewWorkerPaymentInput,
  type NewWorkerTaskInput,
  type ProductRecord,
  type ProductRecordFilter,
  type UpdateAlertInput,
  type UpdateAnimalOwnershipInput,
  type UpdateFarmAccountInput,
  type UpdateFarmWorkerInput,
  type UpdateFinancialLogInput,
  type UpdateLivestockInput,
  type UpdateMedicalRecordInput,
  type UpdateProductRecordInput,
  type UpdateWorkerPaymentInput,
  type UpdateWorkerTaskInput,
  type WorkerPayment,
  type WorkerPaymentFilter,
  type WorkerTask,
  type WorkerTaskFilter,
} from '@farmdb/core';
import {
  AlertNotFoundError,
  AlertValidationError,
  DatabaseEventBus,
  FarmAccountNotFoundError,
  FinancialLogNotFoundError,
  FinancialValidationError,
  HrValidationError,
  LivestockNotFoundError,
  LivestockValidationError,
  MedicalRecordNotFoundError,
  MedicalValidationError,
  NetworkValidationError,
  OwnershipNotFoundError,
  OwnershipValidationError,
  ProductionValidationError,
  ProductRecordNotFoundError,
  SettingsValidationError,
  WorkerNotFoundError,
  WorkerPaymentNotFoundError,
  WorkerTaskNotFoundError,
  wrapSessionWithRbac,
  type AcceptPendingAccountOptions,
  type AlertsRepository,
  type BackupRepository,
  type CloudSyncResult,
  type CreateMedicalRecordOptions,
  type CreateMedicalRecordResult,
  type CreateProductRecordResult,
  type CreateWorkerPaymentOptions,
  type CreateWorkerPaymentResult,
  type FarmDbContextValue,
  type FarmSummary,
  type FinancialRepository,
  type HrRepository,
  type JoinFarmNetworkInput,
  type JoinFarmNetworkResult,
  type LeaveFarmNetworkResult,
  type LivestockRepository,
  type LogMilkYieldOptions,
  type MarkWorkerPaymentPaidOptions,
  type MedicalRepository,
  type NetworkRepository,
  type OwnershipRepository,
  type ProductionRepository,
  type RecoverAdminCloudInput,
  type RecoverAdminCloudResult,
  type RestoreSnapshotOptions,
  type RestoreSnapshotResult,
  type SettingsRepository,
} from '@farmdb/db';

const LIVESTOCK_KEY = 'farmdb_browser_preview_livestock_v1';
const PRODUCTION_KEY = 'farmdb_browser_preview_production_v1';
const MEDICAL_KEY = 'farmdb_browser_preview_medical_v1';
const FINANCIAL_KEY = 'farmdb_browser_preview_financial_v1';
const ALERTS_KEY = 'farmdb_browser_preview_alerts_v1';
const WORKERS_KEY = 'farmdb_browser_preview_workers_v1';
const WORKER_PAYMENTS_KEY = 'farmdb_browser_preview_worker_payments_v1';
const WORKER_TASKS_KEY = 'farmdb_browser_preview_worker_tasks_v1';
const OWNERSHIPS_KEY = 'farmdb_browser_preview_ownerships_v1';
const ACCOUNTS_KEY = 'farmdb_browser_preview_accounts_v1';
const LOCAL_DEVICE_ACCOUNTS_KEY = 'farmdb_preview_local_account_ids';
const SYNC_LOGS_KEY = 'farmdb_browser_preview_sync_logs_v1';
const SETTINGS_KEY = 'farmdb_browser_preview_settings_v1';
const SETTINGS_UPDATED_AT_KEY = 'farmdb_browser_preview_settings_updated_at_v1';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota failures in non-persistent preview mode.
  }
}

function normDupText(raw?: string | null): string {
  return (raw ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normPhoneDigits(raw?: string | null): string {
  return (raw ?? '').replace(/\D+/g, '');
}

/**
 * Browser-only fallback session used when Vite is opened outside the Tauri
 * desktop shell so UI development works without failing on Tauri IPC.
 */
export function createBrowserPreviewSession(): FarmDbContextValue {
  const events = new DatabaseEventBus();

  const settings: SettingsRepository = {
    async get(): Promise<FarmSettings> {
      const stored = readJson<Partial<FarmSettings>>(SETTINGS_KEY, {});
      const merged = validateFarmSettings({
        ...DEFAULT_FARM_SETTINGS,
        ...stored,
      });
      return merged.ok && merged.data ? merged.data : { ...DEFAULT_FARM_SETTINGS };
    },
    async getUpdatedAt(): Promise<number> {
      const val = readJson<number>(SETTINGS_UPDATED_AT_KEY, 0);
      return typeof val === 'number' && Number.isFinite(val) ? val : 0;
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
      writeJson(SETTINGS_KEY, validation.data);
      const changedSharedKey = (Object.keys(input) as Array<keyof FarmSettings>).some(
        (key) => key !== 'activeAccountId' && validation.data![key] !== current[key]
      );
      if (changedSharedKey) {
        writeJson(SETTINGS_UPDATED_AT_KEY, Date.now());
      }
      events.emit(['settings']);
      return validation.data;
    },
    async restoreSettings(
      nextSettings: Partial<FarmSettings>,
      updatedAt?: number
    ): Promise<FarmSettings> {
      const validation = validateFarmSettings({
        ...DEFAULT_FARM_SETTINGS,
        ...nextSettings,
      });
      const valid =
        validation.ok && validation.data
          ? validation.data
          : { ...DEFAULT_FARM_SETTINGS };
      writeJson(SETTINGS_KEY, valid);
      writeJson(
        SETTINGS_UPDATED_AT_KEY,
        typeof updatedAt === 'number' && Number.isFinite(updatedAt) && updatedAt > 0
          ? Math.floor(updatedAt)
          : Date.now()
      );
      events.emit(['settings']);
      return valid;
    },
    async reset(): Promise<FarmSettings> {
      const defaults: FarmSettings = { ...DEFAULT_FARM_SETTINGS };
      writeJson(SETTINGS_KEY, defaults);
      writeJson(SETTINGS_UPDATED_AT_KEY, Date.now());
      events.emit(['settings']);
      return defaults;
    },
  };

  const financial: FinancialRepository = {
    async list(filter?: FinancialLogFilter): Promise<FinancialLog[]> {
      const search = filter?.search?.trim().toLowerCase() ?? '';
      return readJson<FinancialLog[]>(FINANCIAL_KEY, [])
        .filter((row) => {
          if (
            filter?.transactionType &&
            filter.transactionType !== 'all' &&
            row.transactionType !== filter.transactionType
          ) {
            return false;
          }
          if (
            filter?.category &&
            filter.category !== 'all' &&
            row.category !== filter.category
          ) {
            return false;
          }
          if (filter?.livestockId && row.livestockId !== filter.livestockId) {
            return false;
          }
          if (filter?.fromDate && row.date < filter.fromDate) {
            return false;
          }
          if (filter?.toDate && row.date > filter.toDate) {
            return false;
          }
          if (search) {
            const hay = `${row.category} ${row.notes ?? ''}`.toLowerCase();
            if (!hay.includes(search)) return false;
          }
          return true;
        })
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) || b.createdAt - a.createdAt
        );
    },
    async getById(id: string): Promise<FinancialLog | null> {
      return (
        readJson<FinancialLog[]>(FINANCIAL_KEY, []).find((r) => r.id === id) ??
        null
      );
    },
    async create(input: NewFinancialLogInput): Promise<FinancialLog> {
      const validation = validateNewFinancialLog(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid financial entry.';
        throw new FinancialValidationError(validation.errors, msg);
      }
      const rows = readJson<FinancialLog[]>(FINANCIAL_KEY, []);
      const targetCents = Math.round(validation.data.amount * 100);
      const targetLivestock = validation.data.livestockId ?? null;
      const targetNotes = normDupText(validation.data.notes);
      const targetProdId = validation.data.productRecordId ?? null;
      if (
        rows.some(
          (r) =>
            (targetProdId !== null && r.productRecordId === targetProdId) ||
            (r.date === validation.data!.date &&
              r.transactionType === validation.data!.transactionType &&
              r.category === validation.data!.category &&
              Math.round(Number(r.amount) * 100) === targetCents &&
              (r.livestockId ?? null) === targetLivestock &&
              normDupText(r.notes) === targetNotes)
        )
      ) {
        const msg = `Duplicate financial entry detected: an identical ${validation.data.transactionType} record on ${validation.data.date} already exists.`;
        throw new FinancialValidationError({ amount: msg }, msg);
      }
      const now = Date.now();
      const created: FinancialLog = {
        id: generateId(),
        livestockId: validation.data.livestockId,
        productRecordId: validation.data.productRecordId,
        transactionType: validation.data.transactionType,
        amount: validation.data.amount,
        date: validation.data.date,
        category: validation.data.category,
        notes: validation.data.notes,
        createdAt: now,
        updatedAt: now,
      };
      writeJson(FINANCIAL_KEY, [created, ...rows]);
      events.emit(['financial'], created.id);
      return created;
    },
    async update(
      id: string,
      input: UpdateFinancialLogInput
    ): Promise<FinancialLog> {
      const rows = readJson<FinancialLog[]>(FINANCIAL_KEY, []);
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1 || !rows[idx]) {
        throw new FinancialLogNotFoundError(id);
      }
      const validation = validateUpdateFinancialLog(input, {
        currentTransactionType: rows[idx].transactionType,
      });
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid financial entry update.';
        throw new FinancialValidationError(validation.errors, msg);
      }
      const nextDate = validation.data.date ?? rows[idx].date;
      const nextType =
        validation.data.transactionType ?? rows[idx].transactionType;
      const nextCategory = validation.data.category ?? rows[idx].category;
      const nextAmount = validation.data.amount ?? rows[idx].amount;
      const nextLivestock =
        validation.data.livestockId !== undefined
          ? validation.data.livestockId
          : rows[idx].livestockId;
      const nextNotes =
        validation.data.notes !== undefined
          ? validation.data.notes
          : rows[idx].notes;
      const targetCents = Math.round(nextAmount * 100);
      const targetNotes = normDupText(nextNotes);
      if (
        rows.some(
          (r) =>
            r.id !== id &&
            r.date === nextDate &&
            r.transactionType === nextType &&
            r.category === nextCategory &&
            Math.round(Number(r.amount) * 100) === targetCents &&
            (r.livestockId ?? null) === (nextLivestock ?? null) &&
            normDupText(r.notes) === targetNotes
        )
      ) {
        const msg = `Duplicate financial entry detected: an identical ${nextType} record on ${nextDate} already exists.`;
        throw new FinancialValidationError({ amount: msg }, msg);
      }
      const updated: FinancialLog = {
        ...rows[idx],
        ...validation.data,
        updatedAt: Date.now(),
      };
      rows[idx] = updated;
      writeJson(FINANCIAL_KEY, rows);
      events.emit(['financial'], id);
      return updated;
    },
    async remove(id: string): Promise<boolean> {
      const rows = readJson<FinancialLog[]>(FINANCIAL_KEY, []);
      const next = rows.filter((r) => r.id !== id);
      if (next.length === rows.length) return false;
      writeJson(FINANCIAL_KEY, next);
      writeJson(
        WORKER_PAYMENTS_KEY,
        readJson<WorkerPayment[]>(WORKER_PAYMENTS_KEY, []).map((p) =>
          p.financialLogId === id ? { ...p, financialLogId: null } : p
        )
      );
      events.emit(['financial', 'hr'], id);
      return true;
    },
  };

  const production: ProductionRepository = {
    async list(filter?: ProductRecordFilter): Promise<ProductRecord[]> {
      const search = filter?.search?.trim().toLowerCase() ?? '';
      return readJson<ProductRecord[]>(PRODUCTION_KEY, [])
        .filter((row) => {
          if (filter?.livestockId && row.livestockId !== filter.livestockId) {
            return false;
          }
          if (filter?.fromDate && row.date < filter.fromDate) {
            return false;
          }
          if (filter?.toDate && row.date > filter.toDate) {
            return false;
          }
          if (search) {
            const hay = `${row.date} ${row.qualityNotes ?? ''}`.toLowerCase();
            if (!hay.includes(search)) return false;
          }
          return true;
        })
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) || b.createdAt - a.createdAt
        );
    },
    async getById(id: string): Promise<ProductRecord | null> {
      return (
        readJson<ProductRecord[]>(PRODUCTION_KEY, []).find((r) => r.id === id) ??
        null
      );
    },
    async create(
      input: NewProductRecordInput,
      options?: LogMilkYieldOptions
    ): Promise<CreateProductRecordResult> {
      const targetId = (input.livestockId ?? '').trim();
      const animals = readJson<Livestock[]>(LIVESTOCK_KEY, []).map(
        normalizePreviewLivestock
      );
      const animal = targetId ? animals.find((a) => a.id === targetId) : undefined;
      if (targetId && !animal) {
        throw new ProductionValidationError(
          { livestockId: 'Selected animal does not exist.' },
          'Selected animal does not exist.'
        );
      }

      const validation = validateNewProductRecord(input, { animal });
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid production record.';
        throw new ProductionValidationError(validation.errors, msg);
      }
      if (!animal) {
        throw new ProductionValidationError(
          { livestockId: 'Selected animal does not exist.' },
          'Selected animal does not exist.'
        );
      }

      const rows = readJson<ProductRecord[]>(PRODUCTION_KEY, []);
      const targetCenti = Math.round(validation.data.yieldAmount * 100);
      const targetNotes = normDupText(validation.data.qualityNotes);
      if (
        rows.some(
          (r) =>
            r.livestockId === validation.data!.livestockId &&
            r.date === validation.data!.date &&
            Math.round(Number(r.yieldAmount) * 100) === targetCenti &&
            normDupText(r.qualityNotes) === targetNotes
        )
      ) {
        const msg = `Duplicate milk yield entry detected for this animal on ${validation.data.date} (${validation.data.yieldAmount} L).`;
        throw new ProductionValidationError({ yieldAmount: msg }, msg);
      }

      const now = Date.now();
      const record: ProductRecord = {
        id: generateId(),
        livestockId: validation.data.livestockId,
        date: validation.data.date,
        yieldAmount: validation.data.yieldAmount,
        qualityNotes: validation.data.qualityNotes,
        createdAt: now,
        updatedAt: now,
      };
      writeJson(PRODUCTION_KEY, [record, ...rows]);

      let generatedIncomeLog: FinancialLog | null = null;
      if (options?.autoRecordSale) {
        const currentSettings = await settings.get();
        const rate =
          options.ratePerLiter !== undefined
            ? options.ratePerLiter
            : currentSettings.defaultMilkRatePerLiter;
        if (Number.isFinite(rate) && rate > 0) {
          const amount = roundAmount(record.yieldAmount * rate);
          if (amount > 0) {
            generatedIncomeLog = await financial.create({
              livestockId: record.livestockId,
              productRecordId: record.id,
              transactionType: 'income',
              category: 'milk_sale',
              amount,
              date: record.date,
              notes: `Auto milk sale (${animal.tagNumber}): ${record.yieldAmount.toFixed(2)} L @ ${rate.toFixed(2)}/L`,
            });
          }
        }
      }

      events.emit(
        generatedIncomeLog ? ['production', 'financial'] : ['production'],
        record.id
      );
      return { record, generatedIncomeLog };
    },
    async update(
      id: string,
      input: UpdateProductRecordInput
    ): Promise<ProductRecord> {
      const rows = readJson<ProductRecord[]>(PRODUCTION_KEY, []);
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1 || !rows[idx]) {
        throw new ProductRecordNotFoundError(id);
      }
      const targetId = (input.livestockId ?? rows[idx].livestockId).trim();
      const animals = readJson<Livestock[]>(LIVESTOCK_KEY, []).map(
        normalizePreviewLivestock
      );
      const animal = targetId ? animals.find((a) => a.id === targetId) : undefined;
      if (targetId && !animal) {
        throw new ProductionValidationError(
          { livestockId: 'Selected animal does not exist.' },
          'Selected animal does not exist.'
        );
      }
      const validation = validateUpdateProductRecord(input, { animal });
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid production record update.';
        throw new ProductionValidationError(validation.errors, msg);
      }
      if (
        input.date === undefined &&
        animal?.dob &&
        rows[idx].date < animal.dob
      ) {
        const msg =
          'Production date cannot be earlier than the animal’s date of birth.';
        throw new ProductionValidationError({ date: msg }, msg);
      }
      const nextLivestockId = validation.data.livestockId ?? rows[idx].livestockId;
      const nextDate = validation.data.date ?? rows[idx].date;
      const nextYield = validation.data.yieldAmount ?? rows[idx].yieldAmount;
      const nextNotes =
        validation.data.qualityNotes !== undefined
          ? validation.data.qualityNotes
          : rows[idx].qualityNotes;
      const targetCenti = Math.round(nextYield * 100);
      const targetNotes = normDupText(nextNotes);
      if (
        rows.some(
          (r) =>
            r.id !== id &&
            r.livestockId === nextLivestockId &&
            r.date === nextDate &&
            Math.round(Number(r.yieldAmount) * 100) === targetCenti &&
            normDupText(r.qualityNotes) === targetNotes
        )
      ) {
        const msg = `Duplicate milk yield entry detected for this animal on ${nextDate} (${nextYield} L).`;
        throw new ProductionValidationError({ yieldAmount: msg }, msg);
      }
      const updated: ProductRecord = {
        ...rows[idx],
        ...validation.data,
        updatedAt: Date.now(),
      };
      rows[idx] = updated;
      writeJson(PRODUCTION_KEY, rows);
      events.emit(['production'], id);
      return updated;
    },
    async remove(id: string): Promise<boolean> {
      const rows = readJson<ProductRecord[]>(PRODUCTION_KEY, []);
      const next = rows.filter((r) => r.id !== id);
      if (next.length === rows.length) return false;
      writeJson(PRODUCTION_KEY, next);
      const finRows = readJson<FinancialLog[]>(FINANCIAL_KEY, []).map((l) =>
        l.productRecordId === id ? { ...l, productRecordId: null } : l
      );
      writeJson(FINANCIAL_KEY, finRows);
      events.emit(['production', 'financial'], id);
      return true;
    },
  };

  const medical: MedicalRepository = {
    async list(filter?: MedicalRecordFilter): Promise<MedicalRecord[]> {
      const search = filter?.search?.trim().toLowerCase() ?? '';
      return readJson<MedicalRecord[]>(MEDICAL_KEY, [])
        .filter((row) => {
          if (filter?.livestockId && row.livestockId !== filter.livestockId) {
            return false;
          }
          if (search) {
            const hay = [
              row.condition,
              row.treatment,
              row.veterinarian ?? '',
            ]
              .join(' ')
              .toLowerCase();
            if (!hay.includes(search)) return false;
          }
          return true;
        })
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) || b.createdAt - a.createdAt
        );
    },
    async getById(id: string): Promise<MedicalRecord | null> {
      return (
        readJson<MedicalRecord[]>(MEDICAL_KEY, []).find((r) => r.id === id) ??
        null
      );
    },
    async create(
      input: NewMedicalRecordInput,
      options?: CreateMedicalRecordOptions
    ): Promise<CreateMedicalRecordResult> {
      const validation = validateNewMedicalRecord(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid medical record.';
        throw new MedicalValidationError(validation.errors, msg);
      }

      const animals = readJson<Livestock[]>(LIVESTOCK_KEY, []);
      const animal = animals.find((a) => a.id === validation.data!.livestockId);
      if (!animal) {
        throw new MedicalValidationError(
          { livestockId: 'Selected animal does not exist.' },
          'Selected animal does not exist.'
        );
      }

      const rows = readJson<MedicalRecord[]>(MEDICAL_KEY, []);
      const targetCond = normDupText(validation.data.condition);
      const targetTreat = normDupText(validation.data.treatment);
      if (
        rows.some(
          (r) =>
            r.livestockId === validation.data!.livestockId &&
            r.date === validation.data!.date &&
            normDupText(r.condition) === targetCond &&
            normDupText(r.treatment) === targetTreat
        )
      ) {
        const msg = `Duplicate medical record detected for this animal on ${validation.data.date} with the same condition and treatment.`;
        throw new MedicalValidationError({ condition: msg }, msg);
      }

      const now = Date.now();
      const record: MedicalRecord = {
        id: generateId(),
        livestockId: validation.data.livestockId,
        date: validation.data.date,
        condition: validation.data.condition,
        treatment: validation.data.treatment,
        cost: validation.data.cost,
        veterinarian: validation.data.veterinarian,
        createdAt: now,
        updatedAt: now,
      };
      writeJson(MEDICAL_KEY, [record, ...rows]);

      let generatedExpenseLog: FinancialLog | null = null;
      if (options?.autoRecordExpense && record.cost > 0) {
        generatedExpenseLog = await financial.create({
          livestockId: record.livestockId,
          transactionType: 'expense',
          category: record.veterinarian ? 'veterinary' : 'meds',
          amount: record.cost,
          date: record.date,
          notes: `${animal.tagNumber}: ${record.condition} (${record.treatment})`,
        });
      }

      events.emit(
        generatedExpenseLog ? ['medical', 'financial'] : ['medical'],
        record.id
      );
      return { record, generatedExpenseLog };
    },
    async update(
      id: string,
      input: UpdateMedicalRecordInput
    ): Promise<MedicalRecord> {
      const rows = readJson<MedicalRecord[]>(MEDICAL_KEY, []);
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1 || !rows[idx]) {
        throw new MedicalRecordNotFoundError(id);
      }
      const validation = validateUpdateMedicalRecord(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid medical record update.';
        throw new MedicalValidationError(validation.errors, msg);
      }
      const nextLivestockId = validation.data.livestockId ?? rows[idx].livestockId;
      const nextDate = validation.data.date ?? rows[idx].date;
      const nextCondition = validation.data.condition ?? rows[idx].condition;
      const nextTreatment = validation.data.treatment ?? rows[idx].treatment;
      if (
        rows.some(
          (r) =>
            r.id !== id &&
            r.livestockId === nextLivestockId &&
            r.date === nextDate &&
            normDupText(r.condition) === normDupText(nextCondition) &&
            normDupText(r.treatment) === normDupText(nextTreatment)
        )
      ) {
        const msg = `Duplicate medical record detected for this animal on ${nextDate} with the same condition and treatment.`;
        throw new MedicalValidationError({ condition: msg }, msg);
      }
      const updated: MedicalRecord = {
        ...rows[idx],
        ...validation.data,
        updatedAt: Date.now(),
      };
      rows[idx] = updated;
      writeJson(MEDICAL_KEY, rows);
      events.emit(['medical'], id);
      return updated;
    },
    async remove(id: string): Promise<boolean> {
      const rows = readJson<MedicalRecord[]>(MEDICAL_KEY, []);
      const next = rows.filter((r) => r.id !== id);
      if (next.length === rows.length) return false;
      writeJson(MEDICAL_KEY, next);
      events.emit(['medical'], id);
      return true;
    },
  };

  const alerts: AlertsRepository = {
    async list(filter?: AlertFilter): Promise<AlertItem[]> {
      const search = filter?.search?.trim().toLowerCase() ?? '';
      return readJson<AlertItem[]>(ALERTS_KEY, [])
        .filter((row) => {
          if (
            filter?.entryKind &&
            filter.entryKind !== 'all' &&
            row.entryKind !== filter.entryKind
          ) {
            return false;
          }
          if (filter?.status === 'open' && row.isResolved) {
            return false;
          }
          if (filter?.status === 'resolved' && !row.isResolved) {
            return false;
          }
          if (filter?.livestockId && row.livestockId !== filter.livestockId) {
            return false;
          }
          if (search) {
            const hay = `${row.title} ${row.description ?? ''}`.toLowerCase();
            if (!hay.includes(search)) return false;
          }
          return true;
        })
        .sort(
          (a, b) =>
            Number(a.isResolved) - Number(b.isResolved) ||
            a.triggerDate.localeCompare(b.triggerDate) ||
            b.createdAt - a.createdAt
        );
    },
    async getById(id: string): Promise<AlertItem | null> {
      return (
        readJson<AlertItem[]>(ALERTS_KEY, []).find((r) => r.id === id) ?? null
      );
    },
    async create(input: NewAlertInput): Promise<AlertItem> {
      const validation = validateNewAlert(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid alert or note.';
        throw new AlertValidationError(validation.errors, msg);
      }
      const rows = readJson<AlertItem[]>(ALERTS_KEY, []);
      const targetTitle = normDupText(validation.data.title);
      const targetLivestock = validation.data.livestockId ?? null;
      const targetResolved = Boolean(validation.data.isResolved);
      if (
        rows.some(
          (r) =>
            r.entryKind === validation.data!.entryKind &&
            r.triggerDate === validation.data!.triggerDate &&
            Boolean(r.isResolved) === targetResolved &&
            (r.livestockId ?? null) === targetLivestock &&
            normDupText(r.title) === targetTitle
        )
      ) {
        const kindWord =
          validation.data.entryKind === 'note' ? 'farm note' : 'alert';
        const msg = `Duplicate ${kindWord} detected with the same title and date.`;
        throw new AlertValidationError({ title: msg }, msg);
      }
      const now = Date.now();
      const item: AlertItem = {
        id: generateId(),
        livestockId: validation.data.livestockId,
        entryKind: validation.data.entryKind,
        title: validation.data.title,
        description: validation.data.description,
        triggerDate: validation.data.triggerDate,
        isResolved: validation.data.isResolved,
        notifiedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      writeJson(ALERTS_KEY, [item, ...rows]);
      events.emit(['alerts'], item.id);
      return item;
    },
    async update(id: string, input: UpdateAlertInput): Promise<AlertItem> {
      const rows = readJson<AlertItem[]>(ALERTS_KEY, []);
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1 || !rows[idx]) {
        throw new AlertNotFoundError(id);
      }
      const existing = rows[idx];
      const validation = validateUpdateAlert(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid alert update.';
        throw new AlertValidationError(validation.errors, msg);
      }
      const nextKind = validation.data.entryKind ?? existing.entryKind;
      const nextDate = validation.data.triggerDate ?? existing.triggerDate;
      const nextTitle = validation.data.title ?? existing.title;
      const nextLivestock =
        validation.data.livestockId !== undefined
          ? validation.data.livestockId
          : existing.livestockId;
      const nextResolved =
        validation.data.isResolved !== undefined
          ? Boolean(validation.data.isResolved)
          : Boolean(existing.isResolved);
      if (
        rows.some(
          (r) =>
            r.id !== id &&
            r.entryKind === nextKind &&
            r.triggerDate === nextDate &&
            Boolean(r.isResolved) === nextResolved &&
            (r.livestockId ?? null) === (nextLivestock ?? null) &&
            normDupText(r.title) === normDupText(nextTitle)
        )
      ) {
        const kindWord = nextKind === 'note' ? 'farm note' : 'alert';
        const msg = `Duplicate ${kindWord} detected with the same title and date.`;
        throw new AlertValidationError({ title: msg }, msg);
      }
      const resetNotified =
        validation.data.triggerDate !== undefined &&
        validation.data.triggerDate !== existing.triggerDate;
      const updated: AlertItem = {
        ...existing,
        ...validation.data,
        notifiedAt: resetNotified ? null : existing.notifiedAt,
        updatedAt: Date.now(),
      };
      rows[idx] = updated;
      writeJson(ALERTS_KEY, rows);
      events.emit(['alerts'], id);
      return updated;
    },
    async toggleResolved(id: string, isResolved: boolean): Promise<AlertItem> {
      return this.update(id, { isResolved });
    },
    async listDueForNotification(
      todayIso: string = getTodayIsoDate()
    ): Promise<AlertItem[]> {
      return readJson<AlertItem[]>(ALERTS_KEY, [])
        .filter(
          (row) =>
            row.entryKind === 'alert' &&
            !row.isResolved &&
            row.notifiedAt === null &&
            row.triggerDate <= todayIso
        )
        .sort((a, b) => a.triggerDate.localeCompare(b.triggerDate));
    },
    async markNotified(
      ids: readonly string[],
      notifiedAt: number = Date.now()
    ): Promise<void> {
      if (ids.length === 0) return;
      const set = new Set(ids);
      const rows = readJson<AlertItem[]>(ALERTS_KEY, []).map((row) =>
        set.has(row.id) ? { ...row, notifiedAt, updatedAt: notifiedAt } : row
      );
      writeJson(ALERTS_KEY, rows);
      events.emit(['alerts']);
    },
    async remove(id: string): Promise<boolean> {
      const rows = readJson<AlertItem[]>(ALERTS_KEY, []);
      const next = rows.filter((r) => r.id !== id);
      if (next.length === rows.length) return false;
      writeJson(ALERTS_KEY, next);
      events.emit(['alerts'], id);
      return true;
    },
  };

  function normalizePreviewLivestock(row: Livestock): Livestock {
    const sex = (LIVESTOCK_SEXES as readonly string[]).includes(row.sex)
      ? (row.sex as LivestockSex)
      : inferDefaultLivestockSex(row.tagNumber);
    return {
      ...row,
      sex,
      sireId: row.sireId ?? null,
      damId: row.damId ?? null,
    };
  }

  const livestock: LivestockRepository = {
    async list(filter?: LivestockFilter): Promise<Livestock[]> {
      const search = filter?.search?.trim().toLowerCase() ?? '';
      return readJson<Livestock[]>(LIVESTOCK_KEY, [])
        .map(normalizePreviewLivestock)
        .filter((row) => {
          if (filter?.species && filter.species !== 'all' && row.species !== filter.species) {
            return false;
          }
          if (filter?.sex && filter.sex !== 'all' && row.sex !== filter.sex) {
            return false;
          }
          if (filter?.status && filter.status !== 'all' && row.status !== filter.status) {
            return false;
          }
          if (search) {
            const haystack = [row.tagNumber, row.name ?? '', row.breed ?? '']
              .join(' ')
              .toLowerCase();
            if (!haystack.includes(search)) {
              return false;
            }
          }
          return true;
        })
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },

    async getById(id: string): Promise<Livestock | null> {
      const found = readJson<Livestock[]>(LIVESTOCK_KEY, []).find(
        (row) => row.id === id
      );
      return found ? normalizePreviewLivestock(found) : null;
    },

    async getByTagNumber(tagNumber: string): Promise<Livestock | null> {
      const normalized = normalizeTagNumber(tagNumber);
      const found = readJson<Livestock[]>(LIVESTOCK_KEY, []).find(
        (row) => row.tagNumber === normalized
      );
      return found ? normalizePreviewLivestock(found) : null;
    },

    async create(input: NewLivestockInput): Promise<Livestock> {
      const rows = readJson<Livestock[]>(LIVESTOCK_KEY, []).map(
        normalizePreviewLivestock
      );
      const validation = validateNewLivestock(input, {
        existingTags: rows.map((r) => r.tagNumber),
        allLivestock: rows,
      });
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ?? 'Invalid livestock data.';
        throw new LivestockValidationError(validation.errors, msg);
      }

      const normTargetName = normDupText(validation.data.name);
      if (normTargetName && validation.data.dob) {
        const dupAnimal = rows.find(
          (r) =>
            r.species === validation.data!.species &&
            r.sex === validation.data!.sex &&
            r.dob === validation.data!.dob &&
            normDupText(r.name) === normTargetName
        );
        if (dupAnimal) {
          const msg = `An identical ${validation.data.species} named "${validation.data.name}" born on ${validation.data.dob} already exists (Tag ${dupAnimal.tagNumber}).`;
          throw new LivestockValidationError({ name: msg }, msg);
        }
      }

      const now = Date.now();
      const created: Livestock = {
        id: generateId(),
        species: validation.data.species,
        sex: validation.data.sex,
        tagNumber: validation.data.tagNumber,
        name: validation.data.name,
        breed: validation.data.breed,
        dob: validation.data.dob,
        imageUri: validation.data.imageUri,
        sireId: validation.data.sireId,
        damId: validation.data.damId,
        status: validation.data.status,
        createdAt: now,
        updatedAt: now,
      };
      writeJson(LIVESTOCK_KEY, [created, ...rows]);
      events.emit(['livestock'], created.id);
      return created;
    },

    async update(id: string, input: UpdateLivestockInput): Promise<Livestock> {
      const rows = readJson<Livestock[]>(LIVESTOCK_KEY, []).map(
        normalizePreviewLivestock
      );
      const index = rows.findIndex((r) => r.id === id);
      if (index === -1 || !rows[index]) {
        throw new LivestockNotFoundError(id);
      }
      const existing = rows[index];
      const validation = validateUpdateLivestock(input, {
        existingTags: rows.map((r) => r.tagNumber),
        currentTag: existing.tagNumber,
        currentId: id,
        currentSpecies: existing.species,
        currentBreed: existing.breed,
        currentDob: existing.dob,
        allLivestock: rows,
      });
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ?? 'Invalid livestock update.';
        throw new LivestockValidationError(validation.errors, msg);
      }

      const nextSpecies = validation.data.species ?? existing.species;
      const nextSex = validation.data.sex ?? existing.sex;
      const nextName =
        validation.data.name !== undefined ? validation.data.name : existing.name;
      const nextDob =
        validation.data.dob !== undefined ? validation.data.dob : existing.dob;
      const normTargetName = normDupText(nextName);
      if (normTargetName && nextDob) {
        const dupAnimal = rows.find(
          (r) =>
            r.id !== id &&
            r.species === nextSpecies &&
            r.sex === nextSex &&
            r.dob === nextDob &&
            normDupText(r.name) === normTargetName
        );
        if (dupAnimal) {
          const msg = `An identical ${nextSpecies} named "${nextName}" born on ${nextDob} already exists (Tag ${dupAnimal.tagNumber}).`;
          throw new LivestockValidationError({ name: msg }, msg);
        }
      }

      const nextSireId =
        validation.data.sireId !== undefined
          ? validation.data.sireId
          : existing.sireId;
      const nextDamId =
        validation.data.damId !== undefined
          ? validation.data.damId
          : existing.damId;
      if (nextSireId && nextDamId && nextSireId === nextDamId) {
        const msg = 'Sire and Dam must be two different animals.';
        throw new LivestockValidationError({ damId: msg }, msg);
      }

      const updated: Livestock = {
        ...existing,
        ...validation.data,
        updatedAt: Date.now(),
      };
      rows[index] = updated;
      writeJson(LIVESTOCK_KEY, rows);
      events.emit(['livestock'], id);
      return updated;
    },

    async remove(id: string): Promise<boolean> {
      const rows = readJson<Livestock[]>(LIVESTOCK_KEY, []).map(
        normalizePreviewLivestock
      );
      const next = rows
        .filter((r) => r.id !== id)
        .map((r) => ({
          ...r,
          sireId: r.sireId === id ? null : r.sireId,
          damId: r.damId === id ? null : r.damId,
        }));
      if (next.length === rows.length) {
        return false;
      }
      writeJson(LIVESTOCK_KEY, next);
      writeJson(
        PRODUCTION_KEY,
        readJson<ProductRecord[]>(PRODUCTION_KEY, []).filter(
          (p) => p.livestockId !== id
        )
      );
      writeJson(
        MEDICAL_KEY,
        readJson<MedicalRecord[]>(MEDICAL_KEY, []).filter(
          (m) => m.livestockId !== id
        )
      );
      writeJson(
        ALERTS_KEY,
        readJson<AlertItem[]>(ALERTS_KEY, []).filter(
          (a) => a.livestockId !== id
        )
      );
      writeJson(
        FINANCIAL_KEY,
        readJson<FinancialLog[]>(FINANCIAL_KEY, []).map((f) =>
          f.livestockId === id ? { ...f, livestockId: null } : f
        )
      );
      writeJson(
        WORKER_TASKS_KEY,
        readJson<WorkerTask[]>(WORKER_TASKS_KEY, []).map((t) =>
          t.livestockId === id ? { ...t, livestockId: null } : t
        )
      );
      writeJson(
        OWNERSHIPS_KEY,
        readJson<AnimalOwnership[]>(OWNERSHIPS_KEY, []).filter(
          (o) => o.livestockId !== id
        )
      );
      events.emit(
        [
          'livestock',
          'ownerships',
          'production',
          'medical',
          'financial',
          'alerts',
          'hr',
        ],
        id
      );
      return true;
    },

    async getSummary(): Promise<FarmSummary> {
      const rows = readJson<Livestock[]>(LIVESTOCK_KEY, []);
      const prodRows = readJson<ProductRecord[]>(PRODUCTION_KEY, []);
      const medRows = readJson<MedicalRecord[]>(MEDICAL_KEY, []);
      const finRows = readJson<FinancialLog[]>(FINANCIAL_KEY, []);
      const alertRows = readJson<AlertItem[]>(ALERTS_KEY, []);
      return {
        totalLivestock: rows.length,
        activeLivestock: rows.filter((r) => r.status === 'active').length,
        soldLivestock: rows.filter((r) => r.status === 'sold').length,
        deceasedLivestock: rows.filter((r) => r.status === 'deceased').length,
        cowCount: rows.filter((r) => r.species === 'cow').length,
        productRecordCount: prodRows.length,
        medicalRecordCount: medRows.length,
        financialLogCount: finRows.length,
        openAlertCount: alertRows.filter(
          (a) => a.entryKind === 'alert' && !a.isResolved
        ).length,
      };
    },
  };

  const hr: HrRepository = {
    async listWorkers(filter?: FarmWorkerFilter): Promise<FarmWorker[]> {
      const search = filter?.search?.trim().toLowerCase() ?? '';
      return readJson<FarmWorker[]>(WORKERS_KEY, [])
        .map((w) => ({
          ...w,
          paymentNotifiedForDueDate: w.paymentNotifiedForDueDate ?? null,
        }))
        .filter((w) => {
          if (filter?.status && filter.status !== 'all' && w.status !== filter.status) {
            return false;
          }
          if (search) {
            const hay = `${w.name} ${w.role} ${w.responsibilities ?? ''}`.toLowerCase();
            if (!hay.includes(search)) return false;
          }
          return true;
        })
        .sort(
          (a, b) =>
            a.nextPaymentDueDate.localeCompare(b.nextPaymentDueDate) ||
            a.name.localeCompare(b.name)
        );
    },
    async getWorkerById(id: string): Promise<FarmWorker | null> {
      const found = readJson<FarmWorker[]>(WORKERS_KEY, []).find((w) => w.id === id);
      return found
        ? {
          ...found,
          paymentNotifiedForDueDate: found.paymentNotifiedForDueDate ?? null,
        }
        : null;
    },
    async createWorker(input: NewFarmWorkerInput): Promise<FarmWorker> {
      const validation = validateNewFarmWorker(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ?? 'Invalid worker data.';
        throw new HrValidationError(validation.errors, msg);
      }
      const rows = readJson<FarmWorker[]>(WORKERS_KEY, []);
      const targetName = normDupText(validation.data.name);
      const targetRole = normDupText(validation.data.role);
      const targetPhone = normPhoneDigits(validation.data.phone);
      if (
        rows.some((w) => {
          if (normDupText(w.name) !== targetName) return false;
          const rowPhone = normPhoneDigits(w.phone);
          if (targetPhone && rowPhone && targetPhone === rowPhone) return true;
          return normDupText(w.role) === targetRole;
        })
      ) {
        const msg = `A worker named "${validation.data.name}" with the same phone or role already exists.`;
        throw new HrValidationError({ name: msg }, msg);
      }
      const now = Date.now();
      const created: FarmWorker = {
        id: generateId(),
        name: validation.data.name,
        role: validation.data.role,
        phone: validation.data.phone,
        responsibilities: validation.data.responsibilities,
        salaryAmount: validation.data.salaryAmount,
        payFrequency: validation.data.payFrequency,
        nextPaymentDueDate: validation.data.nextPaymentDueDate,
        status: validation.data.status,
        hireDate: validation.data.hireDate,
        paymentNotifiedForDueDate: null,
        createdAt: now,
        updatedAt: now,
      };
      writeJson(WORKERS_KEY, [created, ...rows]);
      events.emit(['hr'], created.id);
      return created;
    },
    async updateWorker(id: string, input: UpdateFarmWorkerInput): Promise<FarmWorker> {
      const rows = readJson<FarmWorker[]>(WORKERS_KEY, []);
      const idx = rows.findIndex((w) => w.id === id);
      if (idx === -1 || !rows[idx]) throw new WorkerNotFoundError(id);
      const validation = validateUpdateFarmWorker(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ?? 'Invalid worker update.';
        throw new HrValidationError(validation.errors, msg);
      }
      const nextName = validation.data.name ?? rows[idx].name;
      const nextRole = validation.data.role ?? rows[idx].role;
      const nextPhone =
        validation.data.phone !== undefined ? validation.data.phone : rows[idx].phone;
      const targetName = normDupText(nextName);
      const targetRole = normDupText(nextRole);
      const targetPhone = normPhoneDigits(nextPhone);
      if (
        rows.some((w) => {
          if (w.id === id) return false;
          if (normDupText(w.name) !== targetName) return false;
          const rowPhone = normPhoneDigits(w.phone);
          if (targetPhone && rowPhone && targetPhone === rowPhone) return true;
          return normDupText(w.role) === targetRole;
        })
      ) {
        const msg = `A worker named "${nextName}" with the same phone or role already exists.`;
        throw new HrValidationError({ name: msg }, msg);
      }
      const dueChanged =
        validation.data.nextPaymentDueDate !== undefined &&
        validation.data.nextPaymentDueDate !== rows[idx].nextPaymentDueDate;
      const updated: FarmWorker = {
        ...rows[idx],
        ...validation.data,
        paymentNotifiedForDueDate: dueChanged
          ? null
          : rows[idx].paymentNotifiedForDueDate ?? null,
        updatedAt: Date.now(),
      };
      rows[idx] = updated;
      writeJson(WORKERS_KEY, rows);
      events.emit(['hr'], id);
      return updated;
    },
    async removeWorker(id: string): Promise<boolean> {
      const rows = readJson<FarmWorker[]>(WORKERS_KEY, []);
      const next = rows.filter((w) => w.id !== id);
      if (next.length === rows.length) return false;
      writeJson(WORKERS_KEY, next);
      writeJson(
        WORKER_PAYMENTS_KEY,
        readJson<WorkerPayment[]>(WORKER_PAYMENTS_KEY, []).filter(
          (p) => p.workerId !== id
        )
      );
      writeJson(
        WORKER_TASKS_KEY,
        readJson<WorkerTask[]>(WORKER_TASKS_KEY, []).filter(
          (t) => t.workerId !== id
        )
      );
      events.emit(['hr'], id);
      return true;
    },
    async listPayments(filter?: WorkerPaymentFilter): Promise<WorkerPayment[]> {
      const search = filter?.search?.trim().toLowerCase() ?? '';
      return readJson<WorkerPayment[]>(WORKER_PAYMENTS_KEY, [])
        .filter((p) => {
          if (filter?.workerId && p.workerId !== filter.workerId) return false;
          if (filter?.status && filter.status !== 'all' && p.status !== filter.status) {
            return false;
          }
          if (search) {
            const hay = `${p.periodLabel ?? ''} ${p.notes ?? ''}`.toLowerCase();
            if (!hay.includes(search)) return false;
          }
          return true;
        })
        .sort(
          (a, b) =>
            a.status.localeCompare(b.status) ||
            b.dueDate.localeCompare(a.dueDate) ||
            b.createdAt - a.createdAt
        );
    },
    async getPaymentById(id: string): Promise<WorkerPayment | null> {
      return (
        readJson<WorkerPayment[]>(WORKER_PAYMENTS_KEY, []).find(
          (p) => p.id === id
        ) ?? null
      );
    },
    async createPayment(
      input: NewWorkerPaymentInput,
      options?: CreateWorkerPaymentOptions
    ): Promise<CreateWorkerPaymentResult> {
      const validation = validateNewWorkerPayment(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ?? 'Invalid payment data.';
        throw new HrValidationError(validation.errors, msg);
      }
      const worker = await this.getWorkerById(validation.data.workerId);
      if (!worker) {
        throw new HrValidationError(
          { workerId: 'Selected worker does not exist.' },
          'Selected worker does not exist.'
        );
      }
      const existingPays = readJson<WorkerPayment[]>(WORKER_PAYMENTS_KEY, []);
      const targetPayCents = Math.round(validation.data.amount * 100);
      const targetPeriod = normDupText(validation.data.periodLabel);
      if (
        existingPays.some(
          (p) =>
            p.workerId === validation.data!.workerId &&
            p.dueDate === validation.data!.dueDate &&
            Math.round(Number(p.amount) * 100) === targetPayCents &&
            normDupText(p.periodLabel) === targetPeriod
        )
      ) {
        const msg = `Duplicate payroll payment detected for this worker on ${validation.data.dueDate}.`;
        throw new HrValidationError({ dueDate: msg }, msg);
      }
      let generatedExpenseLog: FinancialLog | null = null;
      if (validation.data.status === 'paid' && options?.autoRecordExpense) {
        generatedExpenseLog = await financial.create({
          transactionType: 'expense',
          category: 'payroll',
          amount: validation.data.amount,
          date: validation.data.paidDate ?? getTodayIsoDate(),
          notes: `Payroll (${worker.name} · ${worker.role})${validation.data.periodLabel
            ? ` — ${validation.data.periodLabel}`
            : ''
            }`,
        });
      }
      const now = Date.now();
      const payment: WorkerPayment = {
        id: generateId(),
        workerId: validation.data.workerId,
        financialLogId: generatedExpenseLog?.id ?? null,
        amount: validation.data.amount,
        dueDate: validation.data.dueDate,
        paidDate: validation.data.paidDate,
        status: validation.data.status,
        periodLabel: validation.data.periodLabel,
        notes: validation.data.notes,
        notifiedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      const rows = readJson<WorkerPayment[]>(WORKER_PAYMENTS_KEY, []);
      writeJson(WORKER_PAYMENTS_KEY, [payment, ...rows]);

      if (
        validation.data.status === 'paid' &&
        options?.advanceWorkerDueDate &&
        validation.data.dueDate >= worker.nextPaymentDueDate
      ) {
        await this.updateWorker(worker.id, {
          nextPaymentDueDate: advancePayDueDate(
            worker.nextPaymentDueDate,
            worker.payFrequency
          ),
        });
      }

      events.emit(generatedExpenseLog ? ['hr', 'financial'] : ['hr'], payment.id);
      return { payment, generatedExpenseLog };
    },
    async updatePayment(
      id: string,
      input: UpdateWorkerPaymentInput
    ): Promise<WorkerPayment> {
      const rows = readJson<WorkerPayment[]>(WORKER_PAYMENTS_KEY, []);
      const idx = rows.findIndex((p) => p.id === id);
      if (idx === -1 || !rows[idx]) throw new WorkerPaymentNotFoundError(id);
      const existing = rows[idx];
      const validation = validateUpdateWorkerPayment(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ?? 'Invalid payment update.';
        throw new HrValidationError(validation.errors, msg);
      }
      const nextWorkerId = validation.data.workerId ?? existing.workerId;
      const nextDueDate = validation.data.dueDate ?? existing.dueDate;
      const nextAmount = validation.data.amount ?? existing.amount;
      const nextPeriod =
        validation.data.periodLabel !== undefined
          ? validation.data.periodLabel
          : existing.periodLabel;
      const targetPayCents = Math.round(nextAmount * 100);
      const targetPeriod = normDupText(nextPeriod);
      if (
        rows.some(
          (p) =>
            p.id !== id &&
            p.workerId === nextWorkerId &&
            p.dueDate === nextDueDate &&
            Math.round(Number(p.amount) * 100) === targetPayCents &&
            normDupText(p.periodLabel) === targetPeriod
        )
      ) {
        const msg = `Duplicate payroll payment detected for this worker on ${nextDueDate}.`;
        throw new HrValidationError({ dueDate: msg }, msg);
      }
      const nextStatus = validation.data.status ?? existing.status;
      let nextPaidDate =
        validation.data.paidDate !== undefined
          ? validation.data.paidDate
          : existing.paidDate;
      if (nextStatus === 'paid' && !nextPaidDate) {
        nextPaidDate = getTodayIsoDate();
      } else if (nextStatus === 'pending') {
        nextPaidDate = null;
      }
      const resetNotified =
        validation.data.dueDate !== undefined &&
        validation.data.dueDate !== existing.dueDate;
      const updated: WorkerPayment = {
        ...existing,
        ...validation.data,
        paidDate: nextPaidDate,
        notifiedAt: resetNotified ? null : existing.notifiedAt,
        updatedAt: Date.now(),
      };
      rows[idx] = updated;
      writeJson(WORKER_PAYMENTS_KEY, rows);
      events.emit(['hr'], id);
      return updated;
    },
    async markPaymentPaid(
      id: string,
      options?: MarkWorkerPaymentPaidOptions
    ): Promise<CreateWorkerPaymentResult> {
      const existing = await this.getPaymentById(id);
      if (!existing) throw new WorkerPaymentNotFoundError(id);
      const worker = await this.getWorkerById(existing.workerId);
      const effectivePaidDate = options?.paidDate ?? getTodayIsoDate();

      let generatedExpenseLog: FinancialLog | null = null;
      let nextFinancialLogId = existing.financialLogId;
      if (options?.autoRecordExpense && !existing.financialLogId && worker) {
        generatedExpenseLog = await financial.create({
          transactionType: 'expense',
          category: 'payroll',
          amount: existing.amount,
          date: effectivePaidDate,
          notes: `Payroll (${worker.name} · ${worker.role})${existing.periodLabel ? ` — ${existing.periodLabel}` : ''
            }`,
        });
        nextFinancialLogId = generatedExpenseLog.id;
      }

      const rows = readJson<WorkerPayment[]>(WORKER_PAYMENTS_KEY, []);
      const updated: WorkerPayment = {
        ...existing,
        status: 'paid',
        paidDate: effectivePaidDate,
        financialLogId: nextFinancialLogId,
        updatedAt: Date.now(),
      };
      writeJson(
        WORKER_PAYMENTS_KEY,
        rows.map((r) => (r.id === id ? updated : r))
      );

      if (
        worker &&
        options?.advanceWorkerDueDate &&
        existing.dueDate >= worker.nextPaymentDueDate
      ) {
        await this.updateWorker(worker.id, {
          nextPaymentDueDate: advancePayDueDate(
            worker.nextPaymentDueDate,
            worker.payFrequency
          ),
        });
      }

      events.emit(generatedExpenseLog ? ['hr', 'financial'] : ['hr'], id);
      return { payment: updated, generatedExpenseLog };
    },
    async removePayment(id: string): Promise<boolean> {
      const rows = readJson<WorkerPayment[]>(WORKER_PAYMENTS_KEY, []);
      const next = rows.filter((p) => p.id !== id);
      if (next.length === rows.length) return false;
      writeJson(WORKER_PAYMENTS_KEY, next);
      events.emit(['hr'], id);
      return true;
    },
    async listTasks(filter?: WorkerTaskFilter): Promise<WorkerTask[]> {
      const search = filter?.search?.trim().toLowerCase() ?? '';
      return readJson<WorkerTask[]>(WORKER_TASKS_KEY, [])
        .filter((t) => {
          if (filter?.workerId && t.workerId !== filter.workerId) return false;
          if (filter?.status && filter.status !== 'all' && t.status !== filter.status) {
            return false;
          }
          if (
            filter?.priority &&
            filter.priority !== 'all' &&
            t.priority !== filter.priority
          ) {
            return false;
          }
          if (search) {
            const hay = `${t.title} ${t.description ?? ''}`.toLowerCase();
            if (!hay.includes(search)) return false;
          }
          return true;
        })
        .sort(
          (a, b) =>
            (a.status === 'completed' ? 1 : 0) -
            (b.status === 'completed' ? 1 : 0) ||
            (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99') ||
            b.createdAt - a.createdAt
        );
    },
    async getTaskById(id: string): Promise<WorkerTask | null> {
      return (
        readJson<WorkerTask[]>(WORKER_TASKS_KEY, []).find((t) => t.id === id) ??
        null
      );
    },
    async createTask(input: NewWorkerTaskInput): Promise<WorkerTask> {
      const validation = validateNewWorkerTask(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ?? 'Invalid task data.';
        throw new HrValidationError(validation.errors, msg);
      }
      const rows = readJson<WorkerTask[]>(WORKER_TASKS_KEY, []);
      const targetTitle = normDupText(validation.data.title);
      const targetDue = validation.data.dueDate ?? null;
      const targetLivestock = validation.data.livestockId ?? null;
      if (
        rows.some(
          (t) =>
            t.workerId === validation.data!.workerId &&
            normDupText(t.title) === targetTitle &&
            (t.dueDate ?? null) === targetDue &&
            (t.livestockId ?? null) === targetLivestock
        )
      ) {
        const msg =
          'Duplicate task detected for this worker with the same title and due date.';
        throw new HrValidationError({ title: msg }, msg);
      }
      const now = Date.now();
      const created: WorkerTask = {
        id: generateId(),
        workerId: validation.data.workerId,
        livestockId: validation.data.livestockId,
        title: validation.data.title,
        description: validation.data.description,
        priority: validation.data.priority,
        status: validation.data.status,
        dueDate: validation.data.dueDate,
        completedAt: validation.data.status === 'completed' ? now : null,
        createdAt: now,
        updatedAt: now,
      };
      writeJson(WORKER_TASKS_KEY, [created, ...rows]);
      events.emit(['hr'], created.id);
      return created;
    },
    async updateTask(id: string, input: UpdateWorkerTaskInput): Promise<WorkerTask> {
      const rows = readJson<WorkerTask[]>(WORKER_TASKS_KEY, []);
      const idx = rows.findIndex((t) => t.id === id);
      if (idx === -1 || !rows[idx]) throw new WorkerTaskNotFoundError(id);
      const existing = rows[idx];
      const validation = validateUpdateWorkerTask(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ?? 'Invalid task update.';
        throw new HrValidationError(validation.errors, msg);
      }
      const nextWorkerId = validation.data.workerId ?? existing.workerId;
      const nextTitle = validation.data.title ?? existing.title;
      const nextDueDate =
        validation.data.dueDate !== undefined
          ? validation.data.dueDate
          : existing.dueDate;
      const nextLivestockId =
        validation.data.livestockId !== undefined
          ? validation.data.livestockId
          : existing.livestockId;
      if (
        rows.some(
          (t) =>
            t.id !== id &&
            t.workerId === nextWorkerId &&
            normDupText(t.title) === normDupText(nextTitle) &&
            (t.dueDate ?? null) === (nextDueDate ?? null) &&
            (t.livestockId ?? null) === (nextLivestockId ?? null)
        )
      ) {
        const msg =
          'Duplicate task detected for this worker with the same title and due date.';
        throw new HrValidationError({ title: msg }, msg);
      }
      const now = Date.now();
      const nextStatus = validation.data.status ?? existing.status;
      let completedAt = existing.completedAt;
      if (nextStatus === 'completed' && existing.status !== 'completed') {
        completedAt = now;
      } else if (nextStatus !== 'completed') {
        completedAt = null;
      }
      const updated: WorkerTask = {
        ...existing,
        ...validation.data,
        completedAt,
        updatedAt: now,
      };
      rows[idx] = updated;
      writeJson(WORKER_TASKS_KEY, rows);
      events.emit(['hr'], id);
      return updated;
    },
    async removeTask(id: string): Promise<boolean> {
      const rows = readJson<WorkerTask[]>(WORKER_TASKS_KEY, []);
      const next = rows.filter((t) => t.id !== id);
      if (next.length === rows.length) return false;
      writeJson(WORKER_TASKS_KEY, next);
      events.emit(['hr'], id);
      return true;
    },
    async listDuePaymentNotifications(
      todayIso: string = getTodayIsoDate(),
      leadDays = 3
    ): Promise<HrDuePaymentAlertItem[]> {
      const [allWorkers, allPayments] = await Promise.all([
        this.listWorkers({}),
        this.listPayments({ status: 'pending' }),
      ]);
      const summary = computeHrSummary(
        allWorkers,
        allPayments,
        [],
        todayIso,
        leadDays
      );
      return summary.duePaymentAlerts.filter((item) =>
        item.kind === 'pending_payment' && item.payment
          ? item.payment.notifiedAt === null
          : item.worker.paymentNotifiedForDueDate !== item.dueDate
      );
    },
    async markPaymentNotificationsDelivered(
      items: readonly HrDuePaymentAlertItem[],
      notifiedAt: number = Date.now()
    ): Promise<void> {
      if (items.length === 0) return;
      const payIds = new Set(
        items
          .filter((i) => i.kind === 'pending_payment' && i.payment)
          .map((i) => i.payment!.id)
      );
      const workerDueMap = new Map(
        items
          .filter((i) => i.kind === 'scheduled_salary')
          .map((i) => [i.worker.id, i.dueDate])
      );
      if (payIds.size > 0) {
        writeJson(
          WORKER_PAYMENTS_KEY,
          readJson<WorkerPayment[]>(WORKER_PAYMENTS_KEY, []).map((p) =>
            payIds.has(p.id) ? { ...p, notifiedAt, updatedAt: notifiedAt } : p
          )
        );
      }
      if (workerDueMap.size > 0) {
        writeJson(
          WORKERS_KEY,
          readJson<FarmWorker[]>(WORKERS_KEY, []).map((w) => {
            const notifiedDue = workerDueMap.get(w.id);
            return notifiedDue
              ? { ...w, paymentNotifiedForDueDate: notifiedDue, updatedAt: notifiedAt }
              : w;
          })
        );
      }
      events.emit(['hr']);
    },
  };

  const ownerships: OwnershipRepository = {
    async list(filter?: AnimalOwnershipFilter): Promise<AnimalOwnership[]> {
      const search = filter?.search?.trim().toLowerCase() ?? '';
      return readJson<AnimalOwnership[]>(OWNERSHIPS_KEY, [])
        .filter((row) => {
          if (filter?.livestockId && row.livestockId !== filter.livestockId) {
            return false;
          }
          if (filter?.accountId && row.accountId !== filter.accountId) {
            return false;
          }
          if (
            filter?.category &&
            filter.category !== 'all' &&
            row.ownershipCategory !== filter.category
          ) {
            return false;
          }
          if (
            filter?.status &&
            filter.status !== 'all' &&
            row.status !== filter.status
          ) {
            return false;
          }
          if (search) {
            const hay = `${row.ownerName} ${row.purpose ?? ''} ${row.notes ?? ''}`.toLowerCase();
            if (!hay.includes(search)) return false;
          }
          return true;
        })
        .sort(
          (a, b) =>
            a.status.localeCompare(b.status) || b.updatedAt - a.updatedAt
        );
    },
    async getById(id: string): Promise<AnimalOwnership | null> {
      return (
        readJson<AnimalOwnership[]>(OWNERSHIPS_KEY, []).find(
          (r) => r.id === id
        ) ?? null
      );
    },
    async create(input: NewAnimalOwnershipInput): Promise<AnimalOwnership> {
      const validation = validateNewAnimalOwnership(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid ownership data.';
        throw new OwnershipValidationError(validation.errors, msg);
      }
      const rows = readJson<AnimalOwnership[]>(OWNERSHIPS_KEY, []);
      const targetOwner = normDupText(validation.data.ownerName);
      if (
        rows.some(
          (r) =>
            r.livestockId === validation.data!.livestockId &&
            r.ownershipCategory === validation.data!.ownershipCategory &&
            r.startDate === validation.data!.startDate &&
            normDupText(r.ownerName) === targetOwner
        )
      ) {
        const msg = `Duplicate ownership record detected for this animal and owner (${validation.data.ownerName}) starting ${validation.data.startDate}.`;
        throw new OwnershipValidationError({ ownerName: msg }, msg);
      }
      const now = Date.now();
      const created: AnimalOwnership = {
        id: generateId(),
        livestockId: validation.data.livestockId,
        ownerName: validation.data.ownerName,
        ownerContact: validation.data.ownerContact,
        accountId: validation.data.accountId,
        ownershipCategory: validation.data.ownershipCategory,
        sharePercentage: validation.data.sharePercentage,
        purpose: validation.data.purpose,
        startDate: validation.data.startDate,
        expectedEndDate: validation.data.expectedEndDate,
        boardingFee: validation.data.boardingFee,
        status: validation.data.status,
        notes: validation.data.notes,
        createdAt: now,
        updatedAt: now,
      };
      writeJson(OWNERSHIPS_KEY, [created, ...rows]);
      events.emit(['ownerships'], created.id);
      return created;
    },
    async update(
      id: string,
      input: UpdateAnimalOwnershipInput
    ): Promise<AnimalOwnership> {
      const rows = readJson<AnimalOwnership[]>(OWNERSHIPS_KEY, []);
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1 || !rows[idx]) throw new OwnershipNotFoundError(id);
      const validation = validateUpdateAnimalOwnership(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid ownership update.';
        throw new OwnershipValidationError(validation.errors, msg);
      }
      const nextLivestockId = validation.data.livestockId ?? rows[idx].livestockId;
      const nextCategory =
        validation.data.ownershipCategory ?? rows[idx].ownershipCategory;
      const nextStartDate = validation.data.startDate ?? rows[idx].startDate;
      const nextOwnerName = validation.data.ownerName ?? rows[idx].ownerName;
      if (
        rows.some(
          (r) =>
            r.id !== id &&
            r.livestockId === nextLivestockId &&
            r.ownershipCategory === nextCategory &&
            r.startDate === nextStartDate &&
            normDupText(r.ownerName) === normDupText(nextOwnerName)
        )
      ) {
        const msg = `Duplicate ownership record detected for this animal and owner (${nextOwnerName}) starting ${nextStartDate}.`;
        throw new OwnershipValidationError({ ownerName: msg }, msg);
      }
      const updated: AnimalOwnership = {
        ...rows[idx],
        ...validation.data,
        updatedAt: Date.now(),
      };
      rows[idx] = updated;
      writeJson(OWNERSHIPS_KEY, rows);
      events.emit(['ownerships'], id);
      return updated;
    },
    async remove(id: string): Promise<boolean> {
      const rows = readJson<AnimalOwnership[]>(OWNERSHIPS_KEY, []);
      const next = rows.filter((r) => r.id !== id);
      if (next.length === rows.length) return false;
      writeJson(OWNERSHIPS_KEY, next);
      events.emit(['ownerships'], id);
      return true;
    },
  };

  let backup!: BackupRepository;
  let bypassSyncAccountGate = false;

  const createPreviewSupabaseFetcher = (anonKey: string) => {
    const isPublishableKey = anonKey.startsWith('sb_publishable_');
    const baseHeaders: Record<string, string> = {
      apikey: anonKey,
      'Content-Type': 'application/json',
      ...(isPublishableKey ? {} : { Authorization: `Bearer ${anonKey}` }),
    };

    return async (
      url: string,
      init: RequestInit & { extraHeaders?: Record<string, string> }
    ) => {
      const res = await fetch(url, {
        ...init,
        headers: {
          ...baseHeaders,
          ...(init.extraHeaders ?? {}),
        },
      });
      if (res.status === 401 && isPublishableKey) {
        return fetch(url, {
          ...init,
          headers: {
            ...baseHeaders,
            Authorization: `Bearer ${anonKey}`,
            ...(init.extraHeaders ?? {}),
          },
        });
      }
      return res;
    };
  };

  async function applyPreviewAdminCredsIfEmpty(account: FarmAccount): Promise<void> {
    if (!isAdminAccount(account)) return;
    const accUrl = account.supabaseUrl
      ? normalizeSupabaseBaseUrl(account.supabaseUrl)
      : '';
    const accKey = account.supabaseAnonKey?.trim() ?? '';
    if (!accUrl || !accKey) return;
    const cur = await settings.get();
    if (!cur.supabaseUrl.trim() || !cur.supabaseAnonKey.trim()) {
      await settings.update({
        supabaseUrl: accUrl,
        supabaseAnonKey: accKey,
        cloudWorkspaceId:
          account.cloudWorkspaceId?.trim() ||
          cur.cloudWorkspaceId ||
          'farmdb-homestead-main',
        cloudSyncEnabled: true,
      });
    }
  }

  // Purge untouched legacy auto-seeded admin row so desktop preview also lets users pick accounts
  const initialAccounts = readJson<FarmAccount[]>(ACCOUNTS_KEY, []);
  const filteredAccounts = initialAccounts.filter(
    (a) =>
      !(
        a.id === 'owner-admin' &&
        a.displayName === 'Farm Owner (Administrator)' &&
        a.createdAt === 1 &&
        a.updatedAt === 1 &&
        !a.accessCode &&
        !a.email &&
        !a.phone &&
        !a.supabaseUrl &&
        !a.onboardingCompleted
      )
  );
  if (filteredAccounts.length !== initialAccounts.length) {
    writeJson(ACCOUNTS_KEY, filteredAccounts);
  }

  function readPreviewLocalAccountIds(): Set<string> | null {
    try {
      const raw = window.localStorage.getItem(LOCAL_DEVICE_ACCOUNTS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(
          parsed.filter(
            (id): id is string => typeof id === 'string' && id.trim().length > 0
          )
        );
      }
    } catch {
      // Ignore malformed preview local account list
    }
    return new Set<string>();
  }

  function writePreviewLocalAccountIds(ids: Iterable<string>): Set<string> {
    const next = new Set(
      Array.from(ids)
        .map((id) => id.trim())
        .filter(Boolean)
    );
    writeJson(LOCAL_DEVICE_ACCOUNTS_KEY, Array.from(next));
    return next;
  }

  async function ensurePreviewLocalAccountIdsInitialized(): Promise<Set<string>> {
    const existing = readPreviewLocalAccountIds();
    if (existing !== null) return existing;
    const all = readJson<FarmAccount[]>(ACCOUNTS_KEY, []);
    if (all.length === 0) return writePreviewLocalAccountIds([]);
    const curSettings = await settings.get();
    const activeAcc = curSettings.activeAccountId
      ? all.find((a) => a.id === curSettings.activeAccountId)
      : undefined;
    if (
      curSettings.cloudSyncEnabled &&
      activeAcc &&
      !isAdminAccount(activeAcc) &&
      activeAcc.canSyncCloud &&
      all.some((a) => isAdminAccount(a))
    ) {
      return writePreviewLocalAccountIds([activeAcc.id]);
    }
    return writePreviewLocalAccountIds(all.map((a) => a.id));
  }

  async function addPreviewLocalAccountId(id: string): Promise<void> {
    const ids = await ensurePreviewLocalAccountIdsInitialized();
    if (!ids.has(id)) {
      ids.add(id);
      writePreviewLocalAccountIds(ids);
    }
  }

  async function removePreviewLocalAccountId(id: string): Promise<Set<string>> {
    const ids = await ensurePreviewLocalAccountIdsInitialized();
    if (ids.delete(id)) {
      writePreviewLocalAccountIds(ids);
    }
    return ids;
  }

  const network: NetworkRepository = {
    async listAccountsRaw(): Promise<FarmAccount[]> {
      return readJson<FarmAccount[]>(ACCOUNTS_KEY, []).sort(
        (a, b) =>
          (b.isPrimaryAdmin ? 1 : 0) - (a.isPrimaryAdmin ? 1 : 0) ||
          a.displayName.localeCompare(b.displayName)
      );
    },
    async listLocalSignInAccounts(): Promise<FarmAccount[]> {
      const localIds = await ensurePreviewLocalAccountIdsInitialized();
      const all = await this.listAccountsRaw();
      return all.filter((a) => localIds.has(a.id));
    },
    async listAccounts(filter?: FarmAccountFilter): Promise<FarmAccount[]> {
      const search = filter?.search?.trim().toLowerCase() ?? '';
      return (await this.listAccountsRaw()).filter((a) => {
        if (filter?.role && filter.role !== 'all' && a.role !== filter.role) {
          return false;
        }
        if (
          filter?.status &&
          filter.status !== 'all' &&
          a.status !== filter.status
        ) {
          return false;
        }
        if (search) {
          const hay = `${a.displayName} ${a.email ?? ''} ${a.relationship ?? ''}`.toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      });
    },
    async getAccountById(id: string): Promise<FarmAccount | null> {
      return (
        readJson<FarmAccount[]>(ACCOUNTS_KEY, []).find((a) => a.id === id) ??
        null
      );
    },
    async ensureAdminAccount(): Promise<FarmAccount> {
      const rows = readJson<FarmAccount[]>(ACCOUNTS_KEY, []);
      const found =
        rows.find((a) => a.id === DEFAULT_ADMIN_ACCOUNT.id) ??
        rows.find((a) => a.isPrimaryAdmin);
      if (found) return found;
      const now = Date.now();
      const created: FarmAccount = {
        ...DEFAULT_ADMIN_ACCOUNT,
        createdAt: now,
        updatedAt: now,
      };
      writeJson(ACCOUNTS_KEY, [created, ...rows]);
      await addPreviewLocalAccountId(created.id);
      events.emit(['network'], created.id);
      return created;
    },
    async getActiveAccount(): Promise<FarmAccount | null> {
      const localIds = await ensurePreviewLocalAccountIdsInitialized();
      const s = await settings.get();
      if (s.activeAccountId && localIds.has(s.activeAccountId)) {
        const found = await this.getAccountById(s.activeAccountId);
        if (found && found.status !== 'suspended') {
          return found;
        }
      }
      const all = await this.listAccountsRaw();
      const localAccounts = all.filter((acc) => localIds.has(acc.id));
      const fallback =
        localAccounts.find(
          (acc) => acc.isPrimaryAdmin && acc.status !== 'suspended'
        ) ??
        localAccounts.find((acc) => acc.status !== 'suspended') ??
        null;
      if (fallback) {
        await settings.update({ activeAccountId: fallback.id });
      }
      return fallback;
    },
    async switchActiveAccount(
      accountId: string,
      accessCode?: string
    ): Promise<FarmAccount> {
      const localIds = await ensurePreviewLocalAccountIdsInitialized();
      const account = await this.getAccountById(accountId);
      if (!account) throw new FarmAccountNotFoundError(accountId);
      if (!localIds.has(accountId)) {
        throw new NetworkValidationError(
          {
            displayName:
              'This account belongs to another device on the Farm Network and cannot be signed into from here.',
          },
          'This account belongs to another device on the Farm Network and cannot be signed into from here.'
        );
      }
      if (account.status === 'suspended' && !account.isPrimaryAdmin) {
        throw new NetworkValidationError(
          { status: 'This account is suspended.' },
          'This account is suspended.'
        );
      }
      if (!account.isPrimaryAdmin) {
        if (!account.accessCode || account.accessCode.trim().length === 0) {
          throw new NetworkValidationError(
            {
              accessCode:
                'This user account requires login credentials before it can be accessed.',
            },
            'This user account requires login credentials before it can be accessed.'
          );
        }
        if ((accessCode ?? '').trim() !== account.accessCode.trim()) {
          throw new NetworkValidationError(
            { accessCode: 'Incorrect access PIN / passcode.' },
            'Incorrect access PIN / passcode.'
          );
        }
      } else if (
        account.accessCode &&
        account.accessCode.trim().length > 0 &&
        (accessCode ?? '').trim() !== account.accessCode.trim()
      ) {
        throw new NetworkValidationError(
          { accessCode: 'Incorrect access PIN / passcode.' },
          'Incorrect access PIN / passcode.'
        );
      }
      await settings.update({ activeAccountId: account.id });
      await applyPreviewAdminCredsIfEmpty(account);
      events.emit(['network', 'settings'], account.id);
      return account;
    },
    async createAccount(input: NewFarmAccountInput): Promise<FarmAccount> {
      const validation = validateNewFarmAccount(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid account data.';
        throw new NetworkValidationError(validation.errors, msg);
      }
      const existingRows = readJson<FarmAccount[]>(ACCOUNTS_KEY, []);
      const targetName = normDupText(validation.data.displayName);
      const targetEmail = normDupText(validation.data.email);
      if (
        existingRows.some(
          (a) =>
            normDupText(a.displayName) === targetName &&
            a.role === validation.data!.role
        )
      ) {
        const msg = `An account for "${validation.data.displayName}" with the same role already exists.`;
        throw new NetworkValidationError({ displayName: msg }, msg);
      }
      if (targetEmail) {
        const emailMatch = existingRows.find(
          (a) => normDupText(a.email) === targetEmail
        );
        if (emailMatch) {
          const msg = `Email "${validation.data.email}" is already assigned to another account (${emailMatch.displayName}).`;
          throw new NetworkValidationError({ email: msg }, msg);
        }
      }
      const now = Date.now();
      const isAdminRole =
        validation.data.isPrimaryAdmin || validation.data.role === 'admin';
      const created: FarmAccount = {
        id: validation.data.id || generateId(),
        displayName: validation.data.displayName,
        email: validation.data.email,
        phone: validation.data.phone,
        role: validation.data.role,
        relationship: validation.data.relationship,
        avatarKey: validation.data.avatarKey,
        accessCode: validation.data.accessCode,
        supabaseUrl: isAdminRole ? validation.data.supabaseUrl : null,
        supabaseAnonKey: isAdminRole ? validation.data.supabaseAnonKey : null,
        cloudWorkspaceId: isAdminRole ? validation.data.cloudWorkspaceId : null,
        isPrimaryAdmin: validation.data.isPrimaryAdmin,
        canManageNetwork: validation.data.canManageNetwork,
        canSyncCloud: validation.data.canSyncCloud,
        permissions: validation.data.permissions,
        status: validation.data.status,
        onboardingCompleted: Boolean(validation.data.onboardingCompleted ?? false),
        lastSyncedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      const rows = readJson<FarmAccount[]>(ACCOUNTS_KEY, []);
      writeJson(ACCOUNTS_KEY, [created, ...rows]);
      await addPreviewLocalAccountId(created.id);
      events.emit(['network'], created.id);
      return created;
    },
    async signUpAccount(input: NewFarmAccountInput): Promise<FarmAccount> {
      let safeInput = input;
      if (input.isPrimaryAdmin) {
        const all = readJson<FarmAccount[]>(ACCOUNTS_KEY, []);
        if (all.some((a) => a.isPrimaryAdmin)) {
          safeInput = { ...input, isPrimaryAdmin: false };
        }
      }
      return this.createAccount(safeInput);
    },
    async updateAccount(
      id: string,
      input: UpdateFarmAccountInput
    ): Promise<FarmAccount> {
      const rows = readJson<FarmAccount[]>(ACCOUNTS_KEY, []);
      const idx = rows.findIndex((a) => a.id === id);
      if (idx === -1 || !rows[idx]) throw new FarmAccountNotFoundError(id);
      const existing = rows[idx];
      const validation = validateUpdateFarmAccount(input, existing.role);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid account update.';
        throw new NetworkValidationError(validation.errors, msg);
      }
      const currentActive = await this.getActiveAccount();
      const preserveExistingAccessCode =
        currentActive !== null &&
        currentActive.id !== existing.id &&
        Boolean(existing.accessCode && existing.accessCode.trim().length > 0);
      const nextRole: FarmAccountRole = existing.isPrimaryAdmin
        ? 'admin'
        : validation.data.role ?? existing.role;
      const nextName = validation.data.displayName ?? existing.displayName;
      const nextEmail =
        validation.data.email !== undefined
          ? validation.data.email
          : existing.email;
      const targetName = normDupText(nextName);
      const targetEmail = normDupText(nextEmail);
      if (
        rows.some(
          (a) =>
            a.id !== id &&
            normDupText(a.displayName) === targetName &&
            a.role === nextRole
        )
      ) {
        const msg = `An account for "${nextName}" with the same role already exists.`;
        throw new NetworkValidationError({ displayName: msg }, msg);
      }
      if (targetEmail) {
        const emailMatch = rows.find(
          (a) => a.id !== id && normDupText(a.email) === targetEmail
        );
        if (emailMatch) {
          const msg = `Email "${nextEmail}" is already assigned to another account (${emailMatch.displayName}).`;
          throw new NetworkValidationError({ email: msg }, msg);
        }
      }
      const updated: FarmAccount = {
        ...existing,
        ...validation.data,
        accessCode: preserveExistingAccessCode
          ? existing.accessCode
          : validation.data.accessCode !== undefined
            ? validation.data.accessCode
            : existing.accessCode,
        supabaseUrl:
          existing.isPrimaryAdmin || nextRole === 'admin'
            ? validation.data.supabaseUrl !== undefined
              ? validation.data.supabaseUrl
              : existing.supabaseUrl ?? null
            : null,
        supabaseAnonKey:
          existing.isPrimaryAdmin || nextRole === 'admin'
            ? validation.data.supabaseAnonKey !== undefined
              ? validation.data.supabaseAnonKey
              : existing.supabaseAnonKey ?? null
            : null,
        cloudWorkspaceId:
          existing.isPrimaryAdmin || nextRole === 'admin'
            ? validation.data.cloudWorkspaceId !== undefined
              ? validation.data.cloudWorkspaceId
              : existing.cloudWorkspaceId ?? null
            : null,
        role: nextRole,
        permissions: existing.isPrimaryAdmin
          ? normalizeAccountPermissions(undefined, 'admin')
          : validation.data.permissions
            ? normalizeAccountPermissions(validation.data.permissions, nextRole)
            : existing.permissions,
        canManageNetwork: existing.isPrimaryAdmin
          ? true
          : validation.data.canManageNetwork ?? existing.canManageNetwork,
        canSyncCloud: existing.isPrimaryAdmin
          ? true
          : validation.data.canSyncCloud ?? existing.canSyncCloud,
        status: existing.isPrimaryAdmin
          ? 'active'
          : validation.data.status ?? existing.status,
        updatedAt: Date.now(),
      };
      rows[idx] = updated;
      writeJson(ACCOUNTS_KEY, rows);
      if (currentActive?.id === updated.id) {
        await applyPreviewAdminCredsIfEmpty(updated);
      }
      events.emit(['network'], id);
      return updated;
    },
    async removeAccount(id: string): Promise<boolean> {
      const existing = await this.getAccountById(id);
      if (!existing) return false;
      const s = await settings.get();
      let nextRows = readJson<FarmAccount[]>(ACCOUNTS_KEY, []).filter(
        (a) => a.id !== id
      );
      if (existing.isPrimaryAdmin && !nextRows.some((a) => a.isPrimaryAdmin)) {
        const nextPrimary =
          nextRows
            .filter((a) => a.role === 'admin' && a.status !== 'suspended')
            .sort((a, b) => a.createdAt - b.createdAt)[0] ??
          nextRows
            .filter((a) => a.role === 'admin')
            .sort((a, b) => a.createdAt - b.createdAt)[0];
        if (nextPrimary) {
          nextRows = nextRows.map((a) =>
            a.id === nextPrimary.id
              ? {
                ...a,
                isPrimaryAdmin: true,
                canManageNetwork: true,
                canSyncCloud: true,
                updatedAt: Date.now(),
              }
              : a
          );
        }
      }
      writeJson(ACCOUNTS_KEY, nextRows);
      const remainingLocalIds = await removePreviewLocalAccountId(id);
      if (s.activeAccountId === id) {
        const remainingLocal = nextRows.filter((a) => remainingLocalIds.has(a.id));
        const nextActive =
          remainingLocal.find(
            (a) => a.isPrimaryAdmin && a.status !== 'suspended'
          ) ??
          remainingLocal.find((a) => a.status !== 'suspended') ??
          null;
        await settings.update({ activeAccountId: nextActive?.id ?? '' });
      }
      events.emit(['network', 'settings'], id);
      return true;
    },
    async removeAccountWithCredentials(
      id: string,
      accessCode?: string
    ): Promise<boolean> {
      const localIds = await ensurePreviewLocalAccountIdsInitialized();
      const existing = await this.getAccountById(id);
      if (!existing) return false;
      if (!localIds.has(id)) {
        throw new NetworkValidationError(
          {
            displayName:
              'Only accounts created or recovered on this device can be deleted from the Sign-In Portal.',
          },
          'Only accounts created or recovered on this device can be deleted from the Sign-In Portal.'
        );
      }
      if (existing.accessCode && existing.accessCode.trim().length > 0) {
        if ((accessCode ?? '').trim() !== existing.accessCode.trim()) {
          throw new NetworkValidationError(
            { accessCode: 'Enter the correct access PIN / passcode to delete this account.' },
            'Enter the correct access PIN / passcode to delete this account.'
          );
        }
      }
      return this.removeAccount(id);
    },
    async rotateNetworkJoinKey(): Promise<string> {
      const nextCode = generateShortJoinCode();
      await settings.update({ networkJoinKey: nextCode });
      events.emit(['network', 'settings']);
      return nextCode;
    },
    async joinNetworkWithKey(
      input: JoinFarmNetworkInput
    ): Promise<JoinFarmNetworkResult> {
      const decoded = decodeFarmNetworkJoinKey(input.joinKey);
      if (!decoded) {
        throw new NetworkValidationError(
          { joinKey: 'Enter a valid Farm Network Join Key (FARM-XXXX or FDB1:...).' },
          'Enter a valid Farm Network Join Key (FARM-XXXX or FDB1:...).'
        );
      }

      await ensurePreviewLocalAccountIdsInitialized();

      let syncedWithCloud = false;
      if (
        decoded.kind === 'full' &&
        decoded.supabaseUrl &&
        decoded.supabaseAnonKey
      ) {
        await settings.update({
          cloudSyncEnabled: true,
          supabaseUrl: decoded.supabaseUrl,
          supabaseAnonKey: decoded.supabaseAnonKey,
          cloudWorkspaceId:
            decoded.workspaceId || 'farmdb-homestead-main',
          networkJoinKey: decoded.joinCode,
        });
        let pullRes: CloudSyncResult;
        try {
          bypassSyncAccountGate = true;
          pullRes = await this.syncWithSupabase('pull');
        } finally {
          bypassSyncAccountGate = false;
        }
        if (!pullRes.ok) {
          throw new NetworkValidationError(
            { joinKey: `Unable to reach Supabase workspace: ${pullRes.message}` },
            `Unable to reach Supabase workspace: ${pullRes.message}`
          );
        }
        const postPull = await settings.get();
        if (
          pullRes.recordsPulled > 0 &&
          postPull.networkJoinKey.trim().toUpperCase() !==
          decoded.joinCode.toUpperCase()
        ) {
          throw new NetworkValidationError(
            { joinKey: 'This Farm Network Join Key was rotated or revoked by the Admin.' },
            'This Farm Network Join Key was rotated or revoked by the Admin.'
          );
        }
        syncedWithCloud = true;
      } else {
        const s = await settings.get();
        if (
          decoded.joinCode.toUpperCase() !==
          s.networkJoinKey.trim().toUpperCase()
        ) {
          throw new NetworkValidationError(
            { joinKey: 'Invalid Farm Join Key. Ask your Farm Admin for the current code.' },
            'Invalid Farm Join Key. Ask your Farm Admin for the current code.'
          );
        }
      }

      let targetAccount: FarmAccount;
      if (input.accountId) {
        const existing = await this.getAccountById(input.accountId);
        if (!existing) throw new FarmAccountNotFoundError(input.accountId);
        const isAdminJoining = existing.isPrimaryAdmin || existing.role === 'admin';
        targetAccount = await this.updateAccount(existing.id, {
          status: isAdminJoining ? 'active' : 'pending',
          canManageNetwork: isAdminJoining,
          canSyncCloud: true,
          ...(isAdminJoining
            ? {}
            : { permissions: getDefaultPermissionsForRole(existing.role) }),
        });
      } else if (input.newAccount) {
        targetAccount = await this.createAccount({
          ...input.newAccount,
          isPrimaryAdmin: false,
          canManageNetwork: false,
          canSyncCloud: true,
          status: 'pending',
        });
      } else {
        throw new NetworkValidationError(
          { displayName: 'Provide user account details to join the Farm Network.' },
          'Provide user account details to join the Farm Network.'
        );
      }

      const updatedSettings = await settings.update({
        activeAccountId: targetAccount.id,
      });
      await addPreviewLocalAccountId(targetAccount.id);

      if (updatedSettings.supabaseUrl && updatedSettings.supabaseAnonKey) {
        try {
          bypassSyncAccountGate = true;
          const pushRes = await this.syncWithSupabase('bidirectional');
          if (pushRes.ok) syncedWithCloud = true;
        } catch {
          // Safe fallback if offline.
        } finally {
          bypassSyncAccountGate = false;
        }
      }

      events.emit(['network', 'settings'], targetAccount.id);
      return {
        account: targetAccount,
        syncedWithCloud,
        farmName: updatedSettings.farmName,
      };
    },
    async leaveNetwork(accountId: string): Promise<LeaveFarmNetworkResult> {
      const existing = await this.getAccountById(accountId);
      if (!existing) throw new FarmAccountNotFoundError(accountId);
      if (existing.isPrimaryAdmin) {
        throw new NetworkValidationError(
          {
            role: 'Primary Farm Administrator cannot leave their own Farm Network. Disable Cloud Sync in Settings or delete the account instead.',
          },
          'Primary Farm Administrator cannot leave their own Farm Network. Disable Cloud Sync in Settings or delete the account instead.'
        );
      }

      const cur = await settings.get();
      const leftFarmName = cur.farmName || 'Farm Network';
      let syncedWithCloud = false;
      const baseUrl = normalizeSupabaseBaseUrl(cur.supabaseUrl);
      const anonKey = cur.supabaseAnonKey.trim();
      const workspaceId = cur.cloudWorkspaceId.trim() || 'farmdb-homestead-main';

      if (baseUrl && anonKey && workspaceId) {
        try {
          const fetchSupabase = createPreviewSupabaseFetcher(anonKey);
          const restEndpoint = `${baseUrl}/rest/v1/farmdb_cloud_snapshots`;
          const pullRes = await fetchSupabase(
            `${restEndpoint}?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=workspace_id,farm_name,snapshot`,
            { method: 'GET' }
          );
          if (pullRes.ok) {
            const rows = (await pullRes.json()) as Array<{
              farm_name?: string;
              snapshot?: unknown;
            }>;
            if (rows[0]?.snapshot) {
              const remoteSnap = parseFarmSnapshotJson(
                JSON.stringify(rows[0].snapshot)
              );
              const nextRemoteAccounts = (
                remoteSnap.farmAccounts ?? []
              ).filter((a) => a.id !== accountId);
              const pushRes = await fetchSupabase(
                `${restEndpoint}?on_conflict=workspace_id`,
                {
                  method: 'POST',
                  extraHeaders: {
                    Prefer: 'resolution=merge-duplicates,return=minimal',
                  },
                  body: JSON.stringify([
                    {
                      workspace_id: workspaceId,
                      farm_name:
                        rows[0].farm_name || remoteSnap.settings.farmName,
                      updated_by_account_id: accountId,
                      snapshot: {
                        ...remoteSnap,
                        farmAccounts: nextRemoteAccounts,
                      },
                      updated_at: new Date().toISOString(),
                    },
                  ]),
                }
              );
              if (pushRes.ok) syncedWithCloud = true;
            }
          }
        } catch {
          // Offline safe
        }
      }

      const localIds = await ensurePreviewLocalAccountIdsInitialized();
      const allAccounts = await this.listAccountsRaw();
      const hasLocalAdmin = allAccounts.some(
        (a) => isAdminAccount(a) && localIds.has(a.id) && a.id !== accountId
      );

      if (!hasLocalAdmin) {
        const localRemainingAccounts = allAccounts
          .filter((a) => localIds.has(a.id))
          .map((a) =>
            a.id === existing.id
              ? {
                ...a,
                status: 'active' as const,
                canManageNetwork: false,
                canSyncCloud: false,
                permissions: buildStandardUserPermissions(),
                lastSyncedAt: null,
                updatedAt: Date.now(),
              }
              : a
          );
        writeJson(ACCOUNTS_KEY, localRemainingAccounts);
        writeJson(LIVESTOCK_KEY, []);
        writeJson(PRODUCTION_KEY, []);
        writeJson(MEDICAL_KEY, []);
        writeJson(FINANCIAL_KEY, []);
        writeJson(ALERTS_KEY, []);
        writeJson(WORKERS_KEY, []);
        writeJson(WORKER_PAYMENTS_KEY, []);
        writeJson(WORKER_TASKS_KEY, []);
        writeJson(OWNERSHIPS_KEY, []);
        writeJson(SYNC_LOGS_KEY, []);
        await addPreviewLocalAccountId(existing.id);

        await settings.update({
          farmName: `${existing.displayName}'s Farm`.slice(0, 60),
          activeAccountId: existing.id,
          cloudSyncEnabled: false,
          supabaseUrl: '',
          supabaseAnonKey: '',
          cloudWorkspaceId: 'farmdb-homestead-main',
          networkJoinKey: generateShortJoinCode(),
        });
        events.emit(['*'], existing.id);
        return {
          leftFarmName,
          mode: 'disconnected_standalone',
          syncedWithCloud,
        };
      }

      await this.removeAccount(accountId);
      return {
        leftFarmName,
        mode: 'removed_from_shared_device',
        syncedWithCloud,
      };
    },
    async recoverAdminFromCloud(
      input: RecoverAdminCloudInput
    ): Promise<RecoverAdminCloudResult> {
      let baseUrl = '';
      let anonKey = '';
      let workspaceId =
        input.cloudWorkspaceId?.trim() || 'farmdb-homestead-main';

      if (input.cloudKey && input.cloudKey.trim().length > 0) {
        const decoded = decodeFarmNetworkJoinKey(input.cloudKey);
        if (
          !decoded ||
          decoded.kind !== 'full' ||
          !decoded.supabaseUrl ||
          !decoded.supabaseAnonKey
        ) {
          throw new NetworkValidationError(
            {
              cloudKey:
                'Paste a valid full Farm Cloud Key (FDB1:...) or enter your Supabase URL and Key below.',
            },
            'Paste a valid full Farm Cloud Key (FDB1:...) or enter your Supabase URL and Key below.'
          );
        }
        baseUrl = decoded.supabaseUrl;
        anonKey = decoded.supabaseAnonKey;
        workspaceId = decoded.workspaceId || workspaceId;
      } else {
        baseUrl = normalizeSupabaseBaseUrl(input.supabaseUrl ?? '');
        anonKey = (input.supabaseAnonKey ?? '').trim();
        if (!baseUrl || !/^https?:\/\/.+/i.test(baseUrl) || !anonKey) {
          throw new NetworkValidationError(
            {
              supabaseUrl:
                'Enter your Cloud Key (FDB1:...) or valid Supabase Project URL and Anon Key.',
            },
            'Enter your Cloud Key (FDB1:...) or valid Supabase Project URL and Anon Key.'
          );
        }
      }

      const fetchSupabase = createPreviewSupabaseFetcher(anonKey);
      const restEndpoint = `${baseUrl}/rest/v1/farmdb_cloud_snapshots`;
      const res = await fetchSupabase(
        `${restEndpoint}?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=workspace_id,farm_name,snapshot`,
        { method: 'GET' }
      );
      if (!res.ok) {
        throw new Error(`Unable to reach Supabase cloud (HTTP ${res.status}).`);
      }
      const rows = (await res.json()) as Array<{
        workspace_id: string;
        farm_name?: string;
        snapshot?: unknown;
      }>;
      if (!rows.length || !rows[0]?.snapshot) {
        throw new Error(
          `No synced cloud farm database was found for workspace "${workspaceId}".`
        );
      }

      const remoteSnapshot = parseFarmSnapshotJson(
        JSON.stringify(rows[0].snapshot)
      );
      const remoteAdmins = (remoteSnapshot.farmAccounts ?? []).filter((acc) =>
        isAdminAccount(acc)
      );
      const emailFilter = input.email?.trim().toLowerCase();
      let targetAdmin = emailFilter
        ? remoteAdmins.find(
          (acc) => (acc.email ?? '').trim().toLowerCase() === emailFilter
        )
        : undefined;
      if (emailFilter && !targetAdmin) {
        throw new NetworkValidationError(
          {
            email: `No Admin account matching "${input.email!.trim()}" was found in workspace "${workspaceId}".`,
          },
          `No Admin account matching "${input.email!.trim()}" was found in workspace "${workspaceId}".`
        );
      }
      targetAdmin =
        targetAdmin ??
        remoteAdmins.find((acc) => acc.isPrimaryAdmin) ??
        remoteAdmins[0];

      if (
        targetAdmin?.accessCode &&
        targetAdmin.accessCode.trim().length > 0 &&
        (input.accessCode ?? '').trim() !== targetAdmin.accessCode.trim()
      ) {
        throw new NetworkValidationError(
          { accessCode: 'Incorrect Admin password / PIN for the cloud workspace.' },
          'Incorrect Admin password / PIN for the cloud workspace.'
        );
      }

      await ensurePreviewLocalAccountIdsInitialized();

      const targetAdminId = targetAdmin?.id ?? DEFAULT_ADMIN_ACCOUNT.id;
      await settings.update({
        supabaseUrl: baseUrl,
        supabaseAnonKey: anonKey,
        cloudWorkspaceId: workspaceId,
        cloudSyncEnabled: true,
        activeAccountId: targetAdminId,
      });

      const restoredCounts = await backup.restoreSnapshot(remoteSnapshot, {
        preserveLocalSession: true,
      });
      const existingRows = readJson<FarmAccount[]>(ACCOUNTS_KEY, []);
      const now = Date.now();
      const updatedRows = existingRows.map((acc) =>
        acc.id === targetAdminId
          ? {
            ...acc,
            supabaseUrl: baseUrl,
            supabaseAnonKey: anonKey,
            cloudWorkspaceId: workspaceId,
            lastSyncedAt: now,
            updatedAt: now,
          }
          : acc
      );
      writeJson(ACCOUNTS_KEY, updatedRows);
      const recovered =
        updatedRows.find((a) => a.id === targetAdminId) ??
        updatedRows.find((a) => isAdminAccount(a)) ??
        null;
      if (!recovered) {
        throw new Error('No Admin account was found in this cloud workspace.');
      }
      await addPreviewLocalAccountId(recovered.id);
      const totalPulled =
        restoredCounts.livestockCount +
        restoredCounts.productCount +
        restoredCounts.medicalCount +
        restoredCounts.financialCount +
        restoredCounts.alertCount +
        (remoteSnapshot.workers?.length ?? 0) +
        (remoteSnapshot.workerPayments?.length ?? 0) +
        (remoteSnapshot.workerTasks?.length ?? 0) +
        (remoteSnapshot.animalOwnerships?.length ?? 0) +
        (remoteSnapshot.farmAccounts?.length ?? 0);

      const syncLogs = readJson<CloudSyncLog[]>(SYNC_LOGS_KEY, []);
      writeJson(
        SYNC_LOGS_KEY,
        [
          {
            id: generateId(),
            direction: 'pull' as CloudSyncDirection,
            status: 'success' as const,
            recordsPushed: 0,
            recordsPulled: totalPulled,
            summary: `Signed into Admin account "${recovered.displayName}" and downloaded ${totalPulled} records from Supabase workspace "${workspaceId}".`,
            createdAt: now,
          },
          ...syncLogs,
        ].slice(0, 60)
      );
      events.emit(['*']);

      return {
        account: recovered,
        farmName:
          remoteSnapshot.settings.farmName ||
          rows[0]?.farm_name ||
          'farmDB Homestead',
        recordsPulled: totalPulled,
      };
    },
    async acceptPendingAccount(
      accountId: string,
      options?: AcceptPendingAccountOptions
    ): Promise<FarmAccount> {
      const existing = await this.getAccountById(accountId);
      if (!existing) throw new FarmAccountNotFoundError(accountId);
      const updated = await this.updateAccount(accountId, {
        status: 'active',
        canManageNetwork: existing.isPrimaryAdmin ? true : false,
        canSyncCloud: options?.canSyncCloud ?? true,
        ...(options?.role !== undefined ? { role: options.role } : {}),
        ...(options?.permissions !== undefined
          ? { permissions: options.permissions }
          : {}),
      });
      const currentSettings = await settings.get();
      if (
        currentSettings.cloudSyncEnabled &&
        currentSettings.supabaseUrl &&
        currentSettings.supabaseAnonKey
      ) {
        try {
          await this.syncWithSupabase('bidirectional');
        } catch {
          // Local approval already saved.
        }
      }
      events.emit(['network'], updated.id);
      return updated;
    },
    async listSyncLogs(limit = 25): Promise<CloudSyncLog[]> {
      return readJson<CloudSyncLog[]>(SYNC_LOGS_KEY, [])
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit);
    },
    async clearSyncLogs(): Promise<void> {
      writeJson(SYNC_LOGS_KEY, []);
      events.emit(['network']);
    },
    async syncWithSupabase(
      direction: CloudSyncDirection
    ): Promise<CloudSyncResult> {
      const currentSettings = await settings.get();
      const baseUrl = normalizeSupabaseBaseUrl(currentSettings.supabaseUrl);
      const anonKey = currentSettings.supabaseAnonKey.trim();
      const workspaceId = currentSettings.cloudWorkspaceId.trim();

      const addLog = (
        status: 'success' | 'error' | 'offline',
        recordsPushed: number,
        recordsPulled: number,
        summary: string
      ): CloudSyncLog => {
        const log: CloudSyncLog = {
          id: generateId(),
          direction,
          status,
          recordsPushed,
          recordsPulled,
          summary,
          createdAt: Date.now(),
        };
        const existing = readJson<CloudSyncLog[]>(SYNC_LOGS_KEY, []);
        writeJson(SYNC_LOGS_KEY, [log, ...existing].slice(0, 60));
        events.emit(['network']);
        return log;
      };

      if (!bypassSyncAccountGate) {
        const activeAccount = await this.getActiveAccount();
        if (!activeAccount || (!isAdminAccount(activeAccount) && !activeAccount.canSyncCloud)) {
          const msg =
            'User accounts can only sync with a cloud database when connected with an Admin Join Key.';
          const log = addLog('error', 0, 0, msg);
          return {
            ok: false,
            direction,
            status: 'error',
            recordsPushed: 0,
            recordsPulled: 0,
            message: msg,
            log,
          };
        }
      }

      if (!baseUrl || !anonKey) {
        const msg =
          'Supabase URL and Anon/Publishable Key are required before cloud sync.';
        const log = addLog('error', 0, 0, msg);
        return {
          ok: false,
          direction,
          status: 'error',
          recordsPushed: 0,
          recordsPulled: 0,
          message: msg,
          log,
        };
      }

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const msg = 'Device appears offline. Local changes are safely queued.';
        const log = addLog('offline', 0, 0, msg);
        return {
          ok: false,
          direction,
          status: 'offline',
          recordsPushed: 0,
          recordsPulled: 0,
          message: msg,
          log,
        };
      }

      const fetchSupabase = createPreviewSupabaseFetcher(anonKey);
      const restEndpoint = `${baseUrl}/rest/v1/farmdb_cloud_snapshots`;

      try {
        if (direction === 'test') {
          const res = await fetchSupabase(
            `${restEndpoint}?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=workspace_id`,
            { method: 'GET' }
          );
          if (!res.ok) {
            const errText = await res.text();
            const isMissingTable =
              errText.includes('PGRST205') ||
              errText.includes('42P01') ||
              /does not exist|schema cache/i.test(errText);
            const hint = isMissingTable
              ? ' Table public.farmdb_cloud_snapshots not exposed yet — run the SQL Setup Script in Supabase SQL Editor.'
              : errText
                ? ` (${errText.slice(0, 140)})`
                : '';
            const msg = `Supabase returned HTTP ${res.status}.${hint}`;
            const log = addLog('error', 0, 0, msg);
            return {
              ok: false,
              direction,
              status: 'error',
              recordsPushed: 0,
              recordsPulled: 0,
              message: msg,
              log,
            };
          }
          const msg = `Connected cleanly to Supabase workspace "${workspaceId}".`;
          const log = addLog('success', 0, 0, msg);
          return {
            ok: true,
            direction,
            status: 'success',
            recordsPushed: 0,
            recordsPulled: 0,
            message: msg,
            log,
          };
        }

        const ensuredAdmin =
          (await this.listAccountsRaw()).find((acc) => acc.isPrimaryAdmin) ??
          null;
        const activeSyncAcc = await this.getActiveAccount();
        if (baseUrl && anonKey) {
          const targetId =
            activeSyncAcc && isAdminAccount(activeSyncAcc)
              ? activeSyncAcc.id
              : ensuredAdmin?.id;
          if (targetId) {
            const accRows = readJson<FarmAccount[]>(ACCOUNTS_KEY, []);
            let changedCreds = false;
            const nextAccRows = accRows.map((a) => {
              if (
                a.id === targetId &&
                (a.supabaseUrl !== baseUrl ||
                  a.supabaseAnonKey !== anonKey ||
                  a.cloudWorkspaceId !== workspaceId)
              ) {
                changedCreds = true;
                return {
                  ...a,
                  supabaseUrl: baseUrl,
                  supabaseAnonKey: anonKey,
                  cloudWorkspaceId: workspaceId,
                  updatedAt: Date.now(),
                };
              }
              return a;
            });
            if (changedCreds) {
              writeJson(ACCOUNTS_KEY, nextAccRows);
            }
          }
        }
        const localSnap = await backup.exportSnapshot();
        let pulled: FarmDbSnapshot | null = null;
        if (direction === 'pull' || direction === 'bidirectional') {
          const res = await fetchSupabase(
            `${restEndpoint}?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=snapshot`,
            { method: 'GET' }
          );
          if (!res.ok) {
            throw new Error(`Cloud pull failed (HTTP ${res.status})`);
          }
          const rows = (await res.json()) as Array<{ snapshot?: unknown }>;
          if (rows[0]?.snapshot) {
            pulled = parseFarmSnapshotJson(JSON.stringify(rows[0].snapshot));
          }
        }

        let payload = localSnap;
        let pulledCount = 0;
        let pushedCount = 0;

        if (pulled && (direction === 'pull' || direction === 'bidirectional')) {
          const mergeRes = mergeFarmSnapshots(
            localSnap,
            pulled,
            direction === 'pull'
              ? 'cloud_priority'
              : currentSettings.syncConflictStrategy,
            {
              includeFinancials: currentSettings.syncIncludeFinancials,
              includeHr: currentSettings.syncIncludeHr,
            }
          );
          payload = mergeRes.merged;
          pulledCount = mergeRes.recordsPulled;
          pushedCount = mergeRes.recordsPushed;
          await backup.restoreSnapshot(payload, { preserveLocalSession: true });
        }

        if (direction === 'push' || direction === 'bidirectional') {
          const pushRes = await fetchSupabase(
            `${restEndpoint}?on_conflict=workspace_id`,
            {
              method: 'POST',
              extraHeaders: {
                Prefer: 'resolution=merge-duplicates,return=minimal',
              },
              body: JSON.stringify([
                {
                  workspace_id: workspaceId,
                  farm_name: currentSettings.farmName,
                  updated_by_account_id: currentSettings.activeAccountId,
                  snapshot: payload,
                  updated_at: new Date().toISOString(),
                },
              ]),
            }
          );
          if (!pushRes.ok) {
            throw new Error(`Cloud push failed (HTTP ${pushRes.status})`);
          }
          if (direction === 'push') {
            pushedCount = payload.livestock.length + (payload.animalOwnerships?.length ?? 0);
          }
        }

        const msg = `Supabase ${direction} sync succeeded (${pulledCount} pulled, ${pushedCount} pushed).`;
        const log = addLog('success', pushedCount, pulledCount, msg);
        return {
          ok: true,
          direction,
          status: 'success',
          recordsPushed: pushedCount,
          recordsPulled: pulledCount,
          message: msg,
          log,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Supabase network error.';
        const log = addLog('offline', 0, 0, msg);
        return {
          ok: false,
          direction,
          status: 'offline',
          recordsPushed: 0,
          recordsPulled: 0,
          message: msg,
          log,
        };
      }
    },
  };

  backup = {
    async exportSnapshot(): Promise<FarmDbSnapshot> {
      const [
        currentSettings,
        settingsUpdatedAt,
        allLivestock,
        allProduction,
        allMedical,
        allFinancial,
        allAlerts,
        allWorkers,
        allWorkerPayments,
        allWorkerTasks,
        allOwnerships,
        allAccounts,
      ] = await Promise.all([
        settings.get(),
        settings.getUpdatedAt(),
        livestock.list({}),
        production.list({}),
        medical.list({}),
        financial.list({}),
        alerts.list({}),
        hr.listWorkers({}),
        hr.listPayments({}),
        hr.listTasks({}),
        ownerships.list({}),
        network.listAccountsRaw(),
      ]);

      return {
        version: 1,
        app: 'farmDB',
        exportedAt: new Date().toISOString(),
        settings: currentSettings,
        settingsUpdatedAt,
        livestock: allLivestock,
        productRecords: allProduction,
        medicalRecords: allMedical,
        financialLogs: allFinancial,
        alerts: allAlerts,
        workers: allWorkers,
        workerPayments: allWorkerPayments,
        workerTasks: allWorkerTasks,
        animalOwnerships: allOwnerships,
        farmAccounts: allAccounts,
        cloudSyncLogs: readJson<CloudSyncLog[]>(SYNC_LOGS_KEY, []),
      };
    },
    async restoreSnapshot(
      snapshot: FarmDbSnapshot,
      options?: RestoreSnapshotOptions
    ): Promise<RestoreSnapshotResult> {
      await ensurePreviewLocalAccountIdsInitialized();
      const localBefore = options?.preserveLocalSession
        ? await settings.get()
        : null;
      const localIdsBefore = readPreviewLocalAccountIds() ?? new Set<string>();
      const incomingAccounts = snapshot.farmAccounts ?? [];
      const hasValidLocalAccount = Boolean(
        localBefore?.activeAccountId &&
        incomingAccounts.some((acc) => acc.id === localBefore.activeAccountId)
      );
      const nextSettings: FarmSettings = {
        ...DEFAULT_FARM_SETTINGS,
        ...(snapshot.settings ?? {}),
      };
      if (localBefore) {
        nextSettings.cloudSyncEnabled = localBefore.cloudSyncEnabled;
        nextSettings.supabaseUrl = localBefore.supabaseUrl;
        nextSettings.supabaseAnonKey = localBefore.supabaseAnonKey;
        nextSettings.cloudWorkspaceId = localBefore.cloudWorkspaceId;
        nextSettings.autoSyncOnInternet = localBefore.autoSyncOnInternet;
        nextSettings.cloudSyncIntervalSeconds =
          localBefore.cloudSyncIntervalSeconds;
        nextSettings.syncConflictStrategy = localBefore.syncConflictStrategy;
        nextSettings.syncIncludeFinancials = localBefore.syncIncludeFinancials;
        nextSettings.syncIncludeHr = localBefore.syncIncludeHr;
        nextSettings.activeAccountId = hasValidLocalAccount
          ? localBefore.activeAccountId
          : incomingAccounts.find(
            (acc) => localIdsBefore.has(acc.id) && acc.status !== 'suspended'
          )?.id ?? '';
      }
      await settings.restoreSettings(nextSettings, snapshot.settingsUpdatedAt);
      writeJson(
        LIVESTOCK_KEY,
        snapshot.livestock.map(normalizePreviewLivestock)
      );
      writeJson(PRODUCTION_KEY, snapshot.productRecords);
      writeJson(MEDICAL_KEY, snapshot.medicalRecords);
      writeJson(FINANCIAL_KEY, snapshot.financialLogs);
      writeJson(ALERTS_KEY, snapshot.alerts);
      writeJson(WORKERS_KEY, snapshot.workers ?? []);
      writeJson(WORKER_PAYMENTS_KEY, snapshot.workerPayments ?? []);
      writeJson(WORKER_TASKS_KEY, snapshot.workerTasks ?? []);
      writeJson(OWNERSHIPS_KEY, snapshot.animalOwnerships ?? []);
      writeJson(
        ACCOUNTS_KEY,
        incomingAccounts.map((acc) => ({
          ...acc,
          onboardingCompleted: Boolean(acc.onboardingCompleted),
        }))
      );
      const existingLogs = readJson<CloudSyncLog[]>(SYNC_LOGS_KEY, []);
      const logMap = new Map(existingLogs.map((l) => [l.id, l]));
      for (const incoming of snapshot.cloudSyncLogs ?? []) {
        if (!logMap.has(incoming.id)) {
          logMap.set(incoming.id, incoming);
        }
      }
      writeJson(
        SYNC_LOGS_KEY,
        Array.from(logMap.values())
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 60)
      );
      events.emit(['*']);
      return {
        livestockCount: snapshot.livestock.length,
        productCount: snapshot.productRecords.length,
        medicalCount: snapshot.medicalRecords.length,
        financialCount: snapshot.financialLogs.length,
        alertCount: snapshot.alerts.length,
      };
    },
  };

  return wrapSessionWithRbac({
    driverKind: 'memory-fallback',
    events,
    livestock,
    ownerships,
    production,
    medical,
    financial,
    alerts,
    hr,
    network,
    settings,
    backup,
  });
}
