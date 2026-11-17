import {
  DEFAULT_FARM_SETTINGS,
  generateId,
  getTodayIsoDate,
  normalizeTagNumber,
  roundAmount,
  validateFarmSettings,
  validateNewAlert,
  validateNewFinancialLog,
  validateNewLivestock,
  validateNewMedicalRecord,
  validateNewProductRecord,
  validateUpdateAlert,
  validateUpdateFinancialLog,
  validateUpdateLivestock,
  validateUpdateMedicalRecord,
  validateUpdateProductRecord,
  type AlertFilter,
  type AlertItem,
  type FarmDbSnapshot,
  type FarmSettings,
  type FinancialLog,
  type FinancialLogFilter,
  type Livestock,
  type LivestockFilter,
  type MedicalRecord,
  type MedicalRecordFilter,
  type NewAlertInput,
  type NewFinancialLogInput,
  type NewLivestockInput,
  type NewMedicalRecordInput,
  type NewProductRecordInput,
  type ProductRecord,
  type ProductRecordFilter,
  type UpdateAlertInput,
  type UpdateFinancialLogInput,
  type UpdateLivestockInput,
  type UpdateMedicalRecordInput,
  type UpdateProductRecordInput,
} from '@farmdb/core';
import {
  AlertNotFoundError,
  AlertValidationError,
  DatabaseEventBus,
  FinancialLogNotFoundError,
  FinancialValidationError,
  LivestockNotFoundError,
  LivestockValidationError,
  MedicalRecordNotFoundError,
  MedicalValidationError,
  ProductionValidationError,
  ProductRecordNotFoundError,
  SettingsValidationError,
  type AlertsRepository,
  type BackupRepository,
  type CreateMedicalRecordOptions,
  type CreateMedicalRecordResult,
  type CreateProductRecordResult,
  type FarmDbContextValue,
  type FarmSummary,
  type FinancialRepository,
  type LivestockRepository,
  type LogMilkYieldOptions,
  type MedicalRepository,
  type ProductionRepository,
  type RestoreSnapshotResult,
  type SettingsRepository,
} from '@farmdb/db';

const LIVESTOCK_KEY = 'farmdb_browser_preview_livestock_v1';
const PRODUCTION_KEY = 'farmdb_browser_preview_production_v1';
const MEDICAL_KEY = 'farmdb_browser_preview_medical_v1';
const FINANCIAL_KEY = 'farmdb_browser_preview_financial_v1';
const ALERTS_KEY = 'farmdb_browser_preview_alerts_v1';
const SETTINGS_KEY = 'farmdb_browser_preview_settings_v1';

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

/**
 * Browser-only fallback session used when Vite is opened outside the Tauri
 * desktop shell so UI development works without failing on Tauri IPC.
 */
export function createBrowserPreviewSession(): FarmDbContextValue {
  const events = new DatabaseEventBus();

  const settings: SettingsRepository = {
    async get(): Promise<FarmSettings> {
      return readJson<FarmSettings>(SETTINGS_KEY, { ...DEFAULT_FARM_SETTINGS });
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
      writeJson(SETTINGS_KEY, validation.data);
      events.emit(['settings']);
      return validation.data;
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
      const rows = readJson<FinancialLog[]>(FINANCIAL_KEY, []);
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
      const validation = validateUpdateFinancialLog(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid financial entry update.';
        throw new FinancialValidationError(validation.errors, msg);
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
      events.emit(['financial'], id);
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
      const validation = validateNewProductRecord(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid production record.';
        throw new ProductionValidationError(validation.errors, msg);
      }

      const animals = readJson<Livestock[]>(LIVESTOCK_KEY, []);
      const animal = animals.find((a) => a.id === validation.data!.livestockId);
      if (!animal) {
        throw new ProductionValidationError(
          { livestockId: 'Selected animal does not exist.' },
          'Selected animal does not exist.'
        );
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
      const rows = readJson<ProductRecord[]>(PRODUCTION_KEY, []);
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
      const validation = validateUpdateProductRecord(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid production record update.';
        throw new ProductionValidationError(validation.errors, msg);
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
      const rows = readJson<MedicalRecord[]>(MEDICAL_KEY, []);
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
      const rows = readJson<AlertItem[]>(ALERTS_KEY, []);
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

  const livestock: LivestockRepository = {
    async list(filter?: LivestockFilter): Promise<Livestock[]> {
      const search = filter?.search?.trim().toLowerCase() ?? '';
      return readJson<Livestock[]>(LIVESTOCK_KEY, [])
        .filter((row) => {
          if (filter?.species && filter.species !== 'all' && row.species !== filter.species) {
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
      return (
        readJson<Livestock[]>(LIVESTOCK_KEY, []).find((row) => row.id === id) ??
        null
      );
    },

    async getByTagNumber(tagNumber: string): Promise<Livestock | null> {
      const normalized = normalizeTagNumber(tagNumber);
      return (
        readJson<Livestock[]>(LIVESTOCK_KEY, []).find(
          (row) => row.tagNumber === normalized
        ) ?? null
      );
    },

    async create(input: NewLivestockInput): Promise<Livestock> {
      const rows = readJson<Livestock[]>(LIVESTOCK_KEY, []);
      const validation = validateNewLivestock(input, {
        existingTags: rows.map((r) => r.tagNumber),
      });
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ?? 'Invalid livestock data.';
        throw new LivestockValidationError(validation.errors, msg);
      }

      const now = Date.now();
      const created: Livestock = {
        id: generateId(),
        species: validation.data.species,
        tagNumber: validation.data.tagNumber,
        name: validation.data.name,
        breed: validation.data.breed,
        dob: validation.data.dob,
        imageUri: validation.data.imageUri,
        status: validation.data.status,
        createdAt: now,
        updatedAt: now,
      };
      writeJson(LIVESTOCK_KEY, [created, ...rows]);
      events.emit(['livestock'], created.id);
      return created;
    },

    async update(id: string, input: UpdateLivestockInput): Promise<Livestock> {
      const rows = readJson<Livestock[]>(LIVESTOCK_KEY, []);
      const index = rows.findIndex((r) => r.id === id);
      if (index === -1 || !rows[index]) {
        throw new LivestockNotFoundError(id);
      }
      const existing = rows[index];
      const validation = validateUpdateLivestock(input, {
        existingTags: rows.map((r) => r.tagNumber),
        currentTag: existing.tagNumber,
      });
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ?? 'Invalid livestock update.';
        throw new LivestockValidationError(validation.errors, msg);
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
      const rows = readJson<Livestock[]>(LIVESTOCK_KEY, []);
      const next = rows.filter((r) => r.id !== id);
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
      events.emit(
        ['livestock', 'production', 'medical', 'financial', 'alerts'],
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

  const backup: BackupRepository = {
    async exportSnapshot(): Promise<FarmDbSnapshot> {
      const [
        currentSettings,
        allLivestock,
        allProduction,
        allMedical,
        allFinancial,
        allAlerts,
      ] = await Promise.all([
        settings.get(),
        livestock.list({}),
        production.list({}),
        medical.list({}),
        financial.list({}),
        alerts.list({}),
      ]);

      return {
        version: 1,
        app: 'farmDB',
        exportedAt: new Date().toISOString(),
        settings: currentSettings,
        livestock: allLivestock,
        productRecords: allProduction,
        medicalRecords: allMedical,
        financialLogs: allFinancial,
        alerts: allAlerts,
      };
    },
    async restoreSnapshot(
      snapshot: FarmDbSnapshot
    ): Promise<RestoreSnapshotResult> {
      writeJson(SETTINGS_KEY, snapshot.settings);
      writeJson(LIVESTOCK_KEY, snapshot.livestock);
      writeJson(PRODUCTION_KEY, snapshot.productRecords);
      writeJson(MEDICAL_KEY, snapshot.medicalRecords);
      writeJson(FINANCIAL_KEY, snapshot.financialLogs);
      writeJson(ALERTS_KEY, snapshot.alerts);
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

  return {
    driverKind: 'memory-fallback',
    events,
    livestock,
    production,
    medical,
    financial,
    alerts,
    settings,
    backup,
  };
}
