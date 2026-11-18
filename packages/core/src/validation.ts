import { DEFAULT_FARM_SETTINGS } from './analytics';
import {
  normalizeAccountPermissions,
  normalizeSupabaseBaseUrl,
} from './network';
import {
  ALERT_ENTRY_KINDS,
  DATE_FORMATS,
  EXPENSE_CATEGORIES,
  FARM_ACCOUNT_AVATARS,
  FARM_ACCOUNT_ROLES,
  FARM_ACCOUNT_STATUSES,
  FINANCIAL_CATEGORIES,
  FONT_SCALES,
  INCOME_CATEGORIES,
  inferDefaultLivestockSex,
  isMilkProducingSpecies,
  LIVESTOCK_SEXES,
  LIVESTOCK_STATUSES,
  OWNERSHIP_CATEGORIES,
  OWNERSHIP_STATUSES,
  SPECIES_LIST,
  SYNC_CONFLICT_STRATEGIES,
  TRANSACTION_TYPES,
  UI_DENSITIES,
  VOLUME_UNITS,
  WORKER_PAY_FREQUENCIES,
  WORKER_PAYMENT_STATUSES,
  WORKER_STATUSES,
  WORKER_TASK_PRIORITIES,
  WORKER_TASK_STATUSES,
  type AlertEntryKind,
  type DateFormatPreference,
  type FarmAccountAvatar,
  type FarmAccountPermissions,
  type FarmAccountRole,
  type FarmAccountStatus,
  type FarmSettings,
  type FinancialCategory,
  type FontScale,
  type Livestock,
  type LivestockSex,
  type LivestockStatus,
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
  type OwnershipCategory,
  type OwnershipStatus,
  type Species,
  type SyncConflictStrategy,
  type TransactionType,
  type UiDensity,
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
  type VolumeUnit,
  type WorkerPayFrequency,
  type WorkerPaymentStatus,
  type WorkerStatus,
  type WorkerTaskPriority,
  type WorkerTaskStatus,
} from './types';

export type ValidationErrors<T> = Partial<Record<keyof T, string>>;

export interface ValidationResult<T> {
  ok: boolean;
  data?: T;
  errors: ValidationErrors<T>;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MIN_SENSIBLE_FARM_DATE = '1980-01-01';
export const MIN_SENSIBLE_HIRE_DATE = '1960-01-01';
const MAX_MILK_YIELD_LITERS_PER_LOG = 120;
const MAX_MEDICAL_COST = 1_000_000_000;
const MAX_FINANCIAL_AMOUNT = 10_000_000_000;

function wouldCreateAncestorCycle(
  childId: string,
  candidateParentId: string,
  byId: ReadonlyMap<string, Livestock>
): boolean {
  if (candidateParentId === childId) return true;
  const visited = new Set<string>();
  const queue: string[] = [candidateParentId];
  while (queue.length > 0) {
    const curId = queue.shift()!;
    if (curId === childId) return true;
    if (visited.has(curId)) continue;
    visited.add(curId);
    const cur = byId.get(curId);
    if (!cur) continue;
    if (cur.sireId) queue.push(cur.sireId);
    if (cur.damId) queue.push(cur.damId);
  }
  return false;
}

/**
 * Normalizes a livestock tag number so comparisons and unique checks are
 * consistent across mobile and desktop inputs (e.g., " cow-402 " -> "COW-402").
 */
export function normalizeTagNumber(raw: string): string {
  return raw.trim().replace(/\s+/g, '-').toUpperCase();
}

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) {
    return false;
  }
  const [yStr, mStr, dStr] = value.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function normalizeOptionalText(value?: string | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isValidSex(value: string): value is LivestockSex {
  return (LIVESTOCK_SEXES as readonly string[]).includes(value);
}

export function validateNewLivestock(
  input: NewLivestockInput,
  options?: {
    existingTags?: Iterable<string>;
    todayIso?: string;
    allLivestock?: readonly Livestock[];
  }
): ValidationResult<Required<NewLivestockInput>> {
  const errors: ValidationErrors<NewLivestockInput> = {};

  const tagNumber = normalizeTagNumber(input.tagNumber ?? '');
  if (!tagNumber) {
    errors.tagNumber = 'Tag number is required.';
  } else if (tagNumber.length > 40) {
    errors.tagNumber = 'Tag number must be 40 characters or fewer.';
  } else if (!/[A-Z0-9]/i.test(tagNumber)) {
    errors.tagNumber = 'Tag number must include at least one letter or number.';
  } else if (options?.existingTags) {
    for (const existing of options.existingTags) {
      if (normalizeTagNumber(existing) === tagNumber) {
        errors.tagNumber = `Tag "${tagNumber}" is already assigned to another animal.`;
        break;
      }
    }
  }

  const species: Species = input.species ?? 'cow';
  if (!SPECIES_LIST.includes(species)) {
    errors.species = 'Invalid species selection.';
  }

  const sex: LivestockSex = input.sex ?? inferDefaultLivestockSex(tagNumber);
  if (!isValidSex(sex)) {
    errors.sex = 'Sex must be female or male.';
  }

  const status: LivestockStatus = input.status ?? 'active';
  if (!LIVESTOCK_STATUSES.includes(status)) {
    errors.status = 'Invalid livestock status.';
  }

  const dob = normalizeOptionalText(input.dob);
  if (dob !== null) {
    if (!isValidIsoDate(dob)) {
      errors.dob = 'Date of birth must use YYYY-MM-DD format.';
    } else if (dob < MIN_SENSIBLE_FARM_DATE) {
      errors.dob = 'Date of birth must be 1980-01-01 or later.';
    } else {
      const today = options?.todayIso ?? new Date().toISOString().slice(0, 10);
      if (dob > today) {
        errors.dob = 'Date of birth cannot be in the future.';
      }
    }
  }

  const sireId = normalizeOptionalText(input.sireId);
  const damId = normalizeOptionalText(input.damId);
  if (sireId && damId && sireId === damId) {
    errors.damId = 'Sire and Dam must be two different animals.';
  }

  if (options?.allLivestock && (sireId || damId)) {
    const byId = new Map(options.allLivestock.map((a) => [a.id, a]));
    const sire = sireId ? byId.get(sireId) : undefined;
    const dam = damId ? byId.get(damId) : undefined;
    if (sire && sire.species !== species) {
      errors.sireId = 'Sire must be the same species as the animal.';
    } else if (
      sire &&
      (sire.sex ?? inferDefaultLivestockSex(sire.tagNumber, 'sire')) !== 'male'
    ) {
      errors.sireId = 'Sire (Father) must be a male animal.';
    } else if (dob && sire?.dob && sire.dob >= dob) {
      errors.sireId = 'Sire date of birth must be earlier than the offspring date of birth.';
    }
    if (dam && dam.species !== species) {
      errors.damId = 'Dam must be the same species as the animal.';
    } else if (
      dam &&
      (dam.sex ?? inferDefaultLivestockSex(dam.tagNumber, 'dam')) !== 'female'
    ) {
      errors.damId = 'Dam (Mother) must be a female animal.';
    } else if (dob && dam?.dob && dam.dob >= dob) {
      errors.damId = 'Dam date of birth must be earlier than the offspring date of birth.';
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: {},
    data: {
      species,
      sex,
      tagNumber,
      name: normalizeOptionalText(input.name),
      breed: normalizeOptionalText(input.breed),
      dob,
      imageUri: normalizeOptionalText(input.imageUri),
      sireId,
      damId,
      status,
    },
  };
}

export function validateUpdateLivestock(
  input: UpdateLivestockInput,
  options?: {
    existingTags?: Iterable<string>;
    currentTag?: string;
    currentId?: string;
    currentSpecies?: Species;
    currentDob?: string | null;
    todayIso?: string;
    allLivestock?: readonly Livestock[];
  }
): ValidationResult<UpdateLivestockInput> {
  const errors: ValidationErrors<UpdateLivestockInput> = {};
  const sanitized: UpdateLivestockInput = {};

  if (input.tagNumber !== undefined) {
    const tagNumber = normalizeTagNumber(input.tagNumber);
    if (!tagNumber) {
      errors.tagNumber = 'Tag number cannot be empty.';
    } else if (tagNumber.length > 40) {
      errors.tagNumber = 'Tag number must be 40 characters or fewer.';
    } else if (!/[A-Z0-9]/i.test(tagNumber)) {
      errors.tagNumber = 'Tag number must include at least one letter or number.';
    } else if (
      options?.existingTags &&
      (!options.currentTag || normalizeTagNumber(options.currentTag) !== tagNumber)
    ) {
      for (const existing of options.existingTags) {
        if (normalizeTagNumber(existing) === tagNumber) {
          errors.tagNumber = `Tag "${tagNumber}" is already assigned to another animal.`;
          break;
        }
      }
    }
    sanitized.tagNumber = tagNumber;
  }

  if (input.species !== undefined) {
    if (!SPECIES_LIST.includes(input.species)) {
      errors.species = 'Invalid species selection.';
    } else {
      sanitized.species = input.species;
    }
  }

  if (input.sex !== undefined) {
    if (!isValidSex(input.sex)) {
      errors.sex = 'Sex must be female or male.';
    } else {
      sanitized.sex = input.sex;
    }
  }

  if (input.status !== undefined) {
    if (!LIVESTOCK_STATUSES.includes(input.status)) {
      errors.status = 'Invalid livestock status.';
    } else {
      sanitized.status = input.status;
    }
  }

  if (input.name !== undefined) {
    sanitized.name = normalizeOptionalText(input.name);
  }
  if (input.breed !== undefined) {
    sanitized.breed = normalizeOptionalText(input.breed);
  }
  if (input.imageUri !== undefined) {
    sanitized.imageUri = normalizeOptionalText(input.imageUri);
  }

  if (input.dob !== undefined) {
    const dob = normalizeOptionalText(input.dob);
    if (dob !== null) {
      if (!isValidIsoDate(dob)) {
        errors.dob = 'Date of birth must use YYYY-MM-DD format.';
      } else if (dob < MIN_SENSIBLE_FARM_DATE) {
        errors.dob = 'Date of birth must be 1980-01-01 or later.';
      } else {
        const today = options?.todayIso ?? new Date().toISOString().slice(0, 10);
        if (dob > today) {
          errors.dob = 'Date of birth cannot be in the future.';
        }
      }
    }
    sanitized.dob = dob;
  }

  if (input.sireId !== undefined) {
    const sireId = normalizeOptionalText(input.sireId);
    if (options?.currentId && sireId === options.currentId) {
      errors.sireId = 'An animal cannot be its own sire.';
    } else {
      sanitized.sireId = sireId;
    }
  }

  if (input.damId !== undefined) {
    const damId = normalizeOptionalText(input.damId);
    if (options?.currentId && damId === options.currentId) {
      errors.damId = 'An animal cannot be its own dam.';
    } else {
      sanitized.damId = damId;
    }
  }

  if (
    sanitized.sireId &&
    sanitized.damId &&
    sanitized.sireId === sanitized.damId
  ) {
    errors.damId = 'Sire and Dam must be two different animals.';
  }

  if (options?.allLivestock) {
    const byId = new Map(options.allLivestock.map((a) => [a.id, a]));
    const currentAnimal = options.currentId ? byId.get(options.currentId) : undefined;
    const effectiveSpecies =
      sanitized.species ?? options.currentSpecies ?? currentAnimal?.species;
    const effectiveDob =
      sanitized.dob !== undefined
        ? sanitized.dob
        : (options.currentDob ?? currentAnimal?.dob ?? null);
    const effectiveSireId =
      sanitized.sireId !== undefined ? sanitized.sireId : currentAnimal?.sireId ?? null;
    const effectiveDamId =
      sanitized.damId !== undefined ? sanitized.damId : currentAnimal?.damId ?? null;

    if (effectiveSireId && !errors.sireId) {
      const sire = byId.get(effectiveSireId);
      if (sire && effectiveSpecies && sire.species !== effectiveSpecies) {
        errors.sireId = 'Sire must be the same species as the animal.';
      } else if (
        sire &&
        (sire.sex ?? inferDefaultLivestockSex(sire.tagNumber, 'sire')) !== 'male'
      ) {
        errors.sireId = 'Sire (Father) must be a male animal.';
      } else if (effectiveDob && sire?.dob && sire.dob >= effectiveDob) {
        errors.sireId = 'Sire date of birth must be earlier than the offspring date of birth.';
      } else if (
        options.currentId &&
        wouldCreateAncestorCycle(options.currentId, effectiveSireId, byId)
      ) {
        errors.sireId = 'Cannot link a descendant as a parent (circular family tree).';
      }
    }

    if (effectiveDamId && !errors.damId) {
      const dam = byId.get(effectiveDamId);
      if (dam && effectiveSpecies && dam.species !== effectiveSpecies) {
        errors.damId = 'Dam must be the same species as the animal.';
      } else if (
        dam &&
        (dam.sex ?? inferDefaultLivestockSex(dam.tagNumber, 'dam')) !== 'female'
      ) {
        errors.damId = 'Dam (Mother) must be a female animal.';
      } else if (effectiveDob && dam?.dob && dam.dob >= effectiveDob) {
        errors.damId = 'Dam date of birth must be earlier than the offspring date of birth.';
      } else if (
        options.currentId &&
        wouldCreateAncestorCycle(options.currentId, effectiveDamId, byId)
      ) {
        errors.damId = 'Cannot link a descendant as a parent (circular family tree).';
      }
    }

    if (options.currentId && sanitized.sex && !errors.sex) {
      if (
        sanitized.sex === 'female' &&
        options.allLivestock.some((a) => a.sireId === options.currentId)
      ) {
        errors.sex =
          'Cannot change sex to female while recorded as Sire (Father) of existing offspring.';
      } else if (
        sanitized.sex === 'male' &&
        options.allLivestock.some((a) => a.damId === options.currentId)
      ) {
        errors.sex =
          'Cannot change sex to male while recorded as Dam (Mother) of existing offspring.';
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, errors: {}, data: sanitized };
}

export function validateNewProductRecord(
  input: NewProductRecordInput,
  options?: {
    todayIso?: string;
    animal?: Pick<Livestock, 'species' | 'dob' | 'status'> & {
      sex?: LivestockSex | null;
    };
  }
): ValidationResult<Required<NewProductRecordInput>> {
  const errors: ValidationErrors<NewProductRecordInput> = {};

  const livestockId = (input.livestockId ?? '').trim();
  if (!livestockId) {
    errors.livestockId = 'Please select an animal.';
  } else if (options?.animal && !isMilkProducingSpecies(options.animal.species)) {
    errors.livestockId =
      'Only milk-producing animals (Cow, Goat, Sheep) can log milk yields.';
  } else if (options?.animal?.sex === 'male') {
    errors.livestockId =
      'Selected animal is male and cannot log milk yields. Only female milk-producing animals can log milk production.';
  }

  const date = (input.date ?? '').trim();
  if (!isValidIsoDate(date)) {
    errors.date = 'Date must use YYYY-MM-DD format.';
  } else if (date < MIN_SENSIBLE_FARM_DATE) {
    errors.date = 'Production date cannot be before 1980-01-01.';
  } else {
    const today = options?.todayIso ?? new Date().toISOString().slice(0, 10);
    if (date > today) {
      errors.date = 'Production date cannot be in the future.';
    } else if (options?.animal?.dob && date < options.animal.dob) {
      errors.date = 'Production date cannot be earlier than the animal’s date of birth.';
    }
  }

  const yieldAmount = Number(input.yieldAmount);
  if (!Number.isFinite(yieldAmount) || yieldAmount <= 0) {
    errors.yieldAmount = 'Milk yield must be greater than 0 liters.';
  } else if (yieldAmount > MAX_MILK_YIELD_LITERS_PER_LOG) {
    errors.yieldAmount =
      'Milk yield cannot exceed 120 liters for a single log.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: {},
    data: {
      livestockId,
      date,
      yieldAmount: roundToTwo(yieldAmount),
      qualityNotes: normalizeOptionalText(input.qualityNotes),
    },
  };
}

export function validateUpdateProductRecord(
  input: UpdateProductRecordInput,
  options?: {
    todayIso?: string;
    animal?: Pick<Livestock, 'species' | 'dob' | 'status'> & {
      sex?: LivestockSex | null;
    };
  }
): ValidationResult<UpdateProductRecordInput> {
  const errors: ValidationErrors<UpdateProductRecordInput> = {};
  const sanitized: UpdateProductRecordInput = {};

  if (input.livestockId !== undefined) {
    const livestockId = input.livestockId.trim();
    if (!livestockId) {
      errors.livestockId = 'Animal selection is required.';
    } else if (options?.animal && !isMilkProducingSpecies(options.animal.species)) {
      errors.livestockId =
        'Only milk-producing animals (Cow, Goat, Sheep) can log milk yields.';
    } else if (options?.animal?.sex === 'male') {
      errors.livestockId =
        'Selected animal is male and cannot log milk yields. Only female milk-producing animals can log milk production.';
    } else {
      sanitized.livestockId = livestockId;
    }
  } else if (options?.animal && !isMilkProducingSpecies(options.animal.species)) {
    errors.livestockId =
      'Only milk-producing animals (Cow, Goat, Sheep) can log milk yields.';
  } else if (options?.animal?.sex === 'male') {
    errors.livestockId =
      'Selected animal is male and cannot log milk yields. Only female milk-producing animals can log milk production.';
  }

  if (input.date !== undefined) {
    const date = input.date.trim();
    if (!isValidIsoDate(date)) {
      errors.date = 'Date must use YYYY-MM-DD format.';
    } else if (date < MIN_SENSIBLE_FARM_DATE) {
      errors.date = 'Production date cannot be before 1980-01-01.';
    } else {
      const today = options?.todayIso ?? new Date().toISOString().slice(0, 10);
      if (date > today) {
        errors.date = 'Production date cannot be in the future.';
      } else if (options?.animal?.dob && date < options.animal.dob) {
        errors.date =
          'Production date cannot be earlier than the animal’s date of birth.';
      } else {
        sanitized.date = date;
      }
    }
  }

  if (input.yieldAmount !== undefined) {
    const yieldAmount = Number(input.yieldAmount);
    if (!Number.isFinite(yieldAmount) || yieldAmount <= 0) {
      errors.yieldAmount = 'Milk yield must be greater than 0 liters.';
    } else if (yieldAmount > MAX_MILK_YIELD_LITERS_PER_LOG) {
      errors.yieldAmount =
        'Milk yield cannot exceed 120 liters for a single log.';
    } else {
      sanitized.yieldAmount = roundToTwo(yieldAmount);
    }
  }

  if (input.qualityNotes !== undefined) {
    sanitized.qualityNotes = normalizeOptionalText(input.qualityNotes);
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, errors: {}, data: sanitized };
}

export function validateNewFinancialLog(
  input: NewFinancialLogInput,
  options?: { todayIso?: string }
): ValidationResult<Required<NewFinancialLogInput>> {
  const errors: ValidationErrors<NewFinancialLogInput> = {};

  const transactionType = input.transactionType as TransactionType;
  if (!TRANSACTION_TYPES.includes(transactionType)) {
    errors.transactionType = 'Transaction type must be income or expense.';
  }

  const category = input.category as FinancialCategory;
  if (!FINANCIAL_CATEGORIES.includes(category)) {
    errors.category = 'Invalid financial category.';
  } else if (transactionType === 'income' && !INCOME_CATEGORIES.includes(category)) {
    errors.category = 'Selected category is not valid for an income entry.';
  } else if (transactionType === 'expense' && !EXPENSE_CATEGORIES.includes(category)) {
    errors.category = 'Selected category is not valid for an expense entry.';
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Amount must be greater than 0.';
  } else if (amount > MAX_FINANCIAL_AMOUNT) {
    errors.amount = 'Amount exceeds the maximum allowed limit.';
  }

  const date = (input.date ?? '').trim();
  if (!isValidIsoDate(date)) {
    errors.date = 'Date must use YYYY-MM-DD format.';
  } else if (date < MIN_SENSIBLE_FARM_DATE) {
    errors.date = 'Transaction date cannot be before 1980-01-01.';
  } else {
    const today = options?.todayIso ?? new Date().toISOString().slice(0, 10);
    if (date > today) {
      errors.date = 'Transaction date cannot be in the future.';
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: {},
    data: {
      livestockId: normalizeOptionalText(input.livestockId),
      productRecordId: normalizeOptionalText(input.productRecordId),
      transactionType,
      amount: roundToTwo(amount),
      date,
      category,
      notes: normalizeOptionalText(input.notes),
    },
  };
}

export function validateUpdateFinancialLog(
  input: UpdateFinancialLogInput,
  options?: { todayIso?: string; currentTransactionType?: TransactionType }
): ValidationResult<UpdateFinancialLogInput> {
  const errors: ValidationErrors<UpdateFinancialLogInput> = {};
  const sanitized: UpdateFinancialLogInput = {};

  if (input.transactionType !== undefined) {
    if (!TRANSACTION_TYPES.includes(input.transactionType)) {
      errors.transactionType = 'Transaction type must be income or expense.';
    } else {
      sanitized.transactionType = input.transactionType;
    }
  }

  const effectiveType = sanitized.transactionType ?? options?.currentTransactionType;

  if (input.category !== undefined) {
    if (!FINANCIAL_CATEGORIES.includes(input.category)) {
      errors.category = 'Invalid financial category.';
    } else if (
      effectiveType === 'income' &&
      !INCOME_CATEGORIES.includes(input.category)
    ) {
      errors.category = 'Selected category is not valid for an income entry.';
    } else if (
      effectiveType === 'expense' &&
      !EXPENSE_CATEGORIES.includes(input.category)
    ) {
      errors.category = 'Selected category is not valid for an expense entry.';
    } else {
      sanitized.category = input.category;
    }
  }

  if (input.amount !== undefined) {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.amount = 'Amount must be greater than 0.';
    } else if (amount > MAX_FINANCIAL_AMOUNT) {
      errors.amount = 'Amount exceeds the maximum allowed limit.';
    } else {
      sanitized.amount = roundToTwo(amount);
    }
  }

  if (input.date !== undefined) {
    const date = input.date.trim();
    if (!isValidIsoDate(date)) {
      errors.date = 'Date must use YYYY-MM-DD format.';
    } else if (date < MIN_SENSIBLE_FARM_DATE) {
      errors.date = 'Transaction date cannot be before 1980-01-01.';
    } else {
      const today = options?.todayIso ?? new Date().toISOString().slice(0, 10);
      if (date > today) {
        errors.date = 'Transaction date cannot be in the future.';
      } else {
        sanitized.date = date;
      }
    }
  }

  if (input.livestockId !== undefined) {
    sanitized.livestockId = normalizeOptionalText(input.livestockId);
  }
  if (input.notes !== undefined) {
    sanitized.notes = normalizeOptionalText(input.notes);
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, errors: {}, data: sanitized };
}

export function validateFarmSettings(
  input: Partial<FarmSettings>
): ValidationResult<FarmSettings> {
  const errors: ValidationErrors<FarmSettings> = {};

  const farmName = (input.farmName ?? DEFAULT_FARM_SETTINGS.farmName).trim();
  if (!farmName || farmName.length > 60) {
    errors.farmName = 'Farm name must be between 1 and 60 characters.';
  }

  const rate = Number(
    input.defaultMilkRatePerLiter ?? DEFAULT_FARM_SETTINGS.defaultMilkRatePerLiter
  );
  if (!Number.isFinite(rate) || rate < 0) {
    errors.defaultMilkRatePerLiter = 'Milk rate cannot be negative.';
  }

  const currencySymbol = (
    input.currencySymbol ?? DEFAULT_FARM_SETTINGS.currencySymbol
  ).trim();
  if (!currencySymbol || currencySymbol.length > 6) {
    errors.currencySymbol = 'Currency symbol must be 1 to 6 characters.';
  }

  const fontScale = (input.fontScale ??
    DEFAULT_FARM_SETTINGS.fontScale) as FontScale;
  if (!FONT_SCALES.includes(fontScale)) {
    errors.fontScale = 'Select a valid font size.';
  }

  const uiDensity = (input.uiDensity ??
    DEFAULT_FARM_SETTINGS.uiDensity) as UiDensity;
  if (!UI_DENSITIES.includes(uiDensity)) {
    errors.uiDensity = 'Select a valid UI element density.';
  }

  const dateFormat = (input.dateFormat ??
    DEFAULT_FARM_SETTINGS.dateFormat) as DateFormatPreference;
  if (!DATE_FORMATS.includes(dateFormat)) {
    errors.dateFormat = 'Select a valid date format.';
  }

  const volumeUnit = (input.volumeUnit ??
    DEFAULT_FARM_SETTINGS.volumeUnit) as VolumeUnit;
  if (!VOLUME_UNITS.includes(volumeUnit)) {
    errors.volumeUnit = 'Select a valid volume unit.';
  }

  const defaultSpecies = (input.defaultSpecies ??
    DEFAULT_FARM_SETTINGS.defaultSpecies) as Species;
  if (!SPECIES_LIST.includes(defaultSpecies)) {
    errors.defaultSpecies = 'Select a valid default livestock species.';
  }

  const alertCheckIntervalSeconds = Number(
    input.alertCheckIntervalSeconds ??
      DEFAULT_FARM_SETTINGS.alertCheckIntervalSeconds
  );
  if (
    !Number.isInteger(alertCheckIntervalSeconds) ||
    alertCheckIntervalSeconds < 15 ||
    alertCheckIntervalSeconds > 3600
  ) {
    errors.alertCheckIntervalSeconds =
      'Alert check interval must be a whole number between 15 and 3600 seconds.';
  }

  const paymentAlertLeadDays = Number(
    input.paymentAlertLeadDays ?? DEFAULT_FARM_SETTINGS.paymentAlertLeadDays
  );
  if (
    !Number.isInteger(paymentAlertLeadDays) ||
    paymentAlertLeadDays < 0 ||
    paymentAlertLeadDays > 30
  ) {
    errors.paymentAlertLeadDays =
      'Payment due lead time must be a whole number between 0 and 30 days.';
  }

  const activeAccountId =
    (input.activeAccountId ?? DEFAULT_FARM_SETTINGS.activeAccountId).trim() ||
    DEFAULT_FARM_SETTINGS.activeAccountId;

  const supabaseUrl = normalizeSupabaseBaseUrl(
    input.supabaseUrl ?? DEFAULT_FARM_SETTINGS.supabaseUrl
  );
  if (
    supabaseUrl.length > 0 &&
    !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(supabaseUrl)
  ) {
    errors.supabaseUrl =
      'Supabase Project URL must start with https:// or http:// (or leave blank).';
  }

  const supabaseAnonKey = (
    input.supabaseAnonKey ?? DEFAULT_FARM_SETTINGS.supabaseAnonKey
  ).trim();

  const cloudWorkspaceId = (
    input.cloudWorkspaceId ?? DEFAULT_FARM_SETTINGS.cloudWorkspaceId
  ).trim();
  if (!cloudWorkspaceId || cloudWorkspaceId.length > 80) {
    errors.cloudWorkspaceId =
      'Cloud workspace ID must be between 1 and 80 characters.';
  }

  const cloudSyncIntervalSeconds = Number(
    input.cloudSyncIntervalSeconds ??
      DEFAULT_FARM_SETTINGS.cloudSyncIntervalSeconds
  );
  if (
    !Number.isInteger(cloudSyncIntervalSeconds) ||
    cloudSyncIntervalSeconds < 30 ||
    cloudSyncIntervalSeconds > 86400
  ) {
    errors.cloudSyncIntervalSeconds =
      'Cloud sync interval must be between 30 and 86400 seconds.';
  }

  const syncConflictStrategy = (input.syncConflictStrategy ??
    DEFAULT_FARM_SETTINGS.syncConflictStrategy) as SyncConflictStrategy;
  if (!SYNC_CONFLICT_STRATEGIES.includes(syncConflictStrategy)) {
    errors.syncConflictStrategy = 'Select a valid cloud conflict resolution mode.';
  }

  const networkJoinKey = (
    input.networkJoinKey ?? DEFAULT_FARM_SETTINGS.networkJoinKey
  )
    .trim()
    .toUpperCase();
  if (!networkJoinKey || networkJoinKey.length > 40) {
    errors.networkJoinKey =
      'Network join key must be between 1 and 40 characters.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: {},
    data: {
      farmName,
      defaultMilkRatePerLiter: roundToTwo(rate),
      currencySymbol,
      fontScale,
      uiDensity,
      dateFormat,
      volumeUnit,
      defaultSpecies,
      autoRecordMilkSaleByDefault: Boolean(
        input.autoRecordMilkSaleByDefault ??
          DEFAULT_FARM_SETTINGS.autoRecordMilkSaleByDefault
      ),
      autoRecordMedicalExpenseByDefault: Boolean(
        input.autoRecordMedicalExpenseByDefault ??
          DEFAULT_FARM_SETTINGS.autoRecordMedicalExpenseByDefault
      ),
      autoRecordPayrollExpenseByDefault: Boolean(
        input.autoRecordPayrollExpenseByDefault ??
          DEFAULT_FARM_SETTINGS.autoRecordPayrollExpenseByDefault
      ),
      paymentAlertLeadDays,
      alertCheckIntervalSeconds,
      enableNotifications: Boolean(
        input.enableNotifications ?? DEFAULT_FARM_SETTINGS.enableNotifications
      ),
      confirmBeforeDelete: Boolean(
        input.confirmBeforeDelete ?? DEFAULT_FARM_SETTINGS.confirmBeforeDelete
      ),
      mobileIconMode: Boolean(
        input.mobileIconMode ?? DEFAULT_FARM_SETTINGS.mobileIconMode
      ),
      activeAccountId,
      cloudSyncEnabled: Boolean(
        input.cloudSyncEnabled ?? DEFAULT_FARM_SETTINGS.cloudSyncEnabled
      ),
      supabaseUrl,
      supabaseAnonKey,
      cloudWorkspaceId,
      autoSyncOnInternet: Boolean(
        input.autoSyncOnInternet ?? DEFAULT_FARM_SETTINGS.autoSyncOnInternet
      ),
      cloudSyncIntervalSeconds,
      syncConflictStrategy,
      syncIncludeFinancials: Boolean(
        input.syncIncludeFinancials ?? DEFAULT_FARM_SETTINGS.syncIncludeFinancials
      ),
      syncIncludeHr: Boolean(
        input.syncIncludeHr ?? DEFAULT_FARM_SETTINGS.syncIncludeHr
      ),
      networkJoinKey,
    },
  };
}

export function validateNewMedicalRecord(
  input: NewMedicalRecordInput,
  options?: { todayIso?: string; animal?: Pick<Livestock, 'dob'> }
): ValidationResult<Required<NewMedicalRecordInput>> {
  const errors: ValidationErrors<NewMedicalRecordInput> = {};

  const livestockId = (input.livestockId ?? '').trim();
  if (!livestockId) {
    errors.livestockId = 'Please select an animal.';
  }

  const date = (input.date ?? '').trim();
  if (!isValidIsoDate(date)) {
    errors.date = 'Date must use YYYY-MM-DD format.';
  } else if (date < MIN_SENSIBLE_FARM_DATE) {
    errors.date = 'Medical record date cannot be before 1980-01-01.';
  } else {
    const today = options?.todayIso ?? new Date().toISOString().slice(0, 10);
    if (date > today) {
      errors.date = 'Medical record date cannot be in the future.';
    } else if (options?.animal?.dob && date < options.animal.dob) {
      errors.date =
        'Medical record date cannot be earlier than the animal’s date of birth.';
    }
  }

  const condition = (input.condition ?? '').trim();
  if (!condition) {
    errors.condition = 'Condition or checkup reason is required.';
  }

  const treatment = (input.treatment ?? '').trim();
  if (!treatment) {
    errors.treatment = 'Treatment or action taken is required.';
  }

  const cost = Number(input.cost ?? 0);
  if (!Number.isFinite(cost) || cost < 0) {
    errors.cost = 'Cost cannot be negative.';
  } else if (cost > MAX_MEDICAL_COST) {
    errors.cost = 'Cost exceeds the maximum allowed limit.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: {},
    data: {
      livestockId,
      date,
      condition,
      treatment,
      cost: roundToTwo(cost),
      veterinarian: normalizeOptionalText(input.veterinarian),
    },
  };
}

export function validateUpdateMedicalRecord(
  input: UpdateMedicalRecordInput,
  options?: { todayIso?: string; animal?: Pick<Livestock, 'dob'> }
): ValidationResult<UpdateMedicalRecordInput> {
  const errors: ValidationErrors<UpdateMedicalRecordInput> = {};
  const sanitized: UpdateMedicalRecordInput = {};

  if (input.livestockId !== undefined) {
    const livestockId = input.livestockId.trim();
    if (!livestockId) {
      errors.livestockId = 'Animal selection is required.';
    } else {
      sanitized.livestockId = livestockId;
    }
  }

  if (input.date !== undefined) {
    const date = input.date.trim();
    if (!isValidIsoDate(date)) {
      errors.date = 'Date must use YYYY-MM-DD format.';
    } else if (date < MIN_SENSIBLE_FARM_DATE) {
      errors.date = 'Medical record date cannot be before 1980-01-01.';
    } else {
      const today = options?.todayIso ?? new Date().toISOString().slice(0, 10);
      if (date > today) {
        errors.date = 'Medical record date cannot be in the future.';
      } else if (options?.animal?.dob && date < options.animal.dob) {
        errors.date =
          'Medical record date cannot be earlier than the animal’s date of birth.';
      } else {
        sanitized.date = date;
      }
    }
  }

  if (input.condition !== undefined) {
    const condition = input.condition.trim();
    if (!condition) {
      errors.condition = 'Condition cannot be empty.';
    } else {
      sanitized.condition = condition;
    }
  }

  if (input.treatment !== undefined) {
    const treatment = input.treatment.trim();
    if (!treatment) {
      errors.treatment = 'Treatment cannot be empty.';
    } else {
      sanitized.treatment = treatment;
    }
  }

  if (input.cost !== undefined) {
    const cost = Number(input.cost);
    if (!Number.isFinite(cost) || cost < 0) {
      errors.cost = 'Cost cannot be negative.';
    } else if (cost > MAX_MEDICAL_COST) {
      errors.cost = 'Cost exceeds the maximum allowed limit.';
    } else {
      sanitized.cost = roundToTwo(cost);
    }
  }

  if (input.veterinarian !== undefined) {
    sanitized.veterinarian = normalizeOptionalText(input.veterinarian);
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, errors: {}, data: sanitized };
}

export function validateNewAlert(
  input: NewAlertInput,
  options?: { todayIso?: string }
): ValidationResult<Required<NewAlertInput>> {
  const errors: ValidationErrors<NewAlertInput> = {};

  const entryKind: AlertEntryKind = input.entryKind ?? 'alert';
  if (!ALERT_ENTRY_KINDS.includes(entryKind)) {
    errors.entryKind = 'Entry kind must be alert or note.';
  }

  const title = (input.title ?? '').trim();
  if (!title) {
    errors.title = 'Title is required.';
  }

  const fallbackToday = options?.todayIso ?? new Date().toISOString().slice(0, 10);
  const triggerDate = (input.triggerDate ?? fallbackToday).trim();
  if (!isValidIsoDate(triggerDate)) {
    errors.triggerDate = 'Trigger date must use YYYY-MM-DD format.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: {},
    data: {
      livestockId: normalizeOptionalText(input.livestockId),
      entryKind,
      title,
      description: normalizeOptionalText(input.description),
      triggerDate,
      isResolved: Boolean(input.isResolved ?? false),
    },
  };
}

export function validateUpdateAlert(
  input: UpdateAlertInput
): ValidationResult<UpdateAlertInput> {
  const errors: ValidationErrors<UpdateAlertInput> = {};
  const sanitized: UpdateAlertInput = {};

  if (input.entryKind !== undefined) {
    if (!ALERT_ENTRY_KINDS.includes(input.entryKind)) {
      errors.entryKind = 'Entry kind must be alert or note.';
    } else {
      sanitized.entryKind = input.entryKind;
    }
  }

  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) {
      errors.title = 'Title cannot be empty.';
    } else {
      sanitized.title = title;
    }
  }

  if (input.triggerDate !== undefined) {
    const triggerDate = input.triggerDate.trim();
    if (!isValidIsoDate(triggerDate)) {
      errors.triggerDate = 'Trigger date must use YYYY-MM-DD format.';
    } else {
      sanitized.triggerDate = triggerDate;
    }
  }

  if (input.livestockId !== undefined) {
    sanitized.livestockId = normalizeOptionalText(input.livestockId);
  }
  if (input.description !== undefined) {
    sanitized.description = normalizeOptionalText(input.description);
  }
  if (input.isResolved !== undefined) {
    sanitized.isResolved = Boolean(input.isResolved);
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, errors: {}, data: sanitized };
}

export function validateNewFarmWorker(
  input: NewFarmWorkerInput,
  options?: { todayIso?: string }
): ValidationResult<Required<NewFarmWorkerInput>> {
  const errors: ValidationErrors<NewFarmWorkerInput> = {};

  const name = (input.name ?? '').trim();
  if (!name) {
    errors.name = 'Worker name is required.';
  } else if (name.length > 80) {
    errors.name = 'Worker name must be 80 characters or fewer.';
  }

  const role = (input.role ?? '').trim();
  if (!role) {
    errors.role = 'Role / job title is required.';
  } else if (role.length > 60) {
    errors.role = 'Role must be 60 characters or fewer.';
  }

  const salaryAmount = Number(input.salaryAmount);
  if (!Number.isFinite(salaryAmount) || salaryAmount < 0) {
    errors.salaryAmount = 'Salary amount cannot be negative.';
  }

  const payFrequency = (input.payFrequency ?? 'monthly') as WorkerPayFrequency;
  if (!WORKER_PAY_FREQUENCIES.includes(payFrequency)) {
    errors.payFrequency = 'Select a valid pay frequency.';
  }

  const status = (input.status ?? 'active') as WorkerStatus;
  if (!WORKER_STATUSES.includes(status)) {
    errors.status = 'Select a valid worker status.';
  }

  const fallbackToday = options?.todayIso ?? new Date().toISOString().slice(0, 10);
  const nextPaymentDueDate = (input.nextPaymentDueDate ?? fallbackToday).trim();
  if (!isValidIsoDate(nextPaymentDueDate)) {
    errors.nextPaymentDueDate = 'Next payment due date must use YYYY-MM-DD format.';
  } else if (nextPaymentDueDate < MIN_SENSIBLE_FARM_DATE) {
    errors.nextPaymentDueDate = 'Next payment due date must be 1980-01-01 or later.';
  }

  const hireDate = normalizeOptionalText(input.hireDate);
  if (hireDate !== null) {
    if (!isValidIsoDate(hireDate)) {
      errors.hireDate = 'Hire date must use YYYY-MM-DD format.';
    } else if (hireDate < MIN_SENSIBLE_HIRE_DATE) {
      errors.hireDate = 'Hire date must be 1960-01-01 or later.';
    } else if (hireDate > fallbackToday) {
      errors.hireDate = 'Hire date cannot be in the future.';
    } else if (
      isValidIsoDate(nextPaymentDueDate) &&
      nextPaymentDueDate < hireDate
    ) {
      errors.nextPaymentDueDate =
        'Next payment due date cannot be earlier than the hire date.';
    }
  }

  const phone = normalizeOptionalText(input.phone);
  if (phone !== null && (phone.match(/\d/g)?.length ?? 0) < 5) {
    errors.phone = 'Enter a valid phone number with at least 5 digits.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: {},
    data: {
      name,
      role,
      phone,
      responsibilities: normalizeOptionalText(input.responsibilities),
      salaryAmount: roundToTwo(salaryAmount),
      payFrequency,
      nextPaymentDueDate,
      status,
      hireDate,
    },
  };
}

export function validateUpdateFarmWorker(
  input: UpdateFarmWorkerInput,
  options?: {
    todayIso?: string;
    currentHireDate?: string | null;
    currentNextPaymentDueDate?: string;
  }
): ValidationResult<UpdateFarmWorkerInput> {
  const errors: ValidationErrors<UpdateFarmWorkerInput> = {};
  const sanitized: UpdateFarmWorkerInput = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) {
      errors.name = 'Worker name cannot be empty.';
    } else if (name.length > 80) {
      errors.name = 'Worker name must be 80 characters or fewer.';
    } else {
      sanitized.name = name;
    }
  }

  if (input.role !== undefined) {
    const role = input.role.trim();
    if (!role) {
      errors.role = 'Role cannot be empty.';
    } else if (role.length > 60) {
      errors.role = 'Role must be 60 characters or fewer.';
    } else {
      sanitized.role = role;
    }
  }

  if (input.phone !== undefined) {
    const phone = normalizeOptionalText(input.phone);
    if (phone !== null && (phone.match(/\d/g)?.length ?? 0) < 5) {
      errors.phone = 'Enter a valid phone number with at least 5 digits.';
    } else {
      sanitized.phone = phone;
    }
  }
  if (input.responsibilities !== undefined) {
    sanitized.responsibilities = normalizeOptionalText(input.responsibilities);
  }

  if (input.salaryAmount !== undefined) {
    const salaryAmount = Number(input.salaryAmount);
    if (!Number.isFinite(salaryAmount) || salaryAmount < 0) {
      errors.salaryAmount = 'Salary amount cannot be negative.';
    } else {
      sanitized.salaryAmount = roundToTwo(salaryAmount);
    }
  }

  if (input.payFrequency !== undefined) {
    if (!WORKER_PAY_FREQUENCIES.includes(input.payFrequency)) {
      errors.payFrequency = 'Select a valid pay frequency.';
    } else {
      sanitized.payFrequency = input.payFrequency;
    }
  }

  if (input.status !== undefined) {
    if (!WORKER_STATUSES.includes(input.status)) {
      errors.status = 'Select a valid worker status.';
    } else {
      sanitized.status = input.status;
    }
  }

  if (input.nextPaymentDueDate !== undefined) {
    const dueDate = input.nextPaymentDueDate.trim();
    if (!isValidIsoDate(dueDate)) {
      errors.nextPaymentDueDate = 'Next payment due date must use YYYY-MM-DD format.';
    } else if (dueDate < MIN_SENSIBLE_FARM_DATE) {
      errors.nextPaymentDueDate = 'Next payment due date must be 1980-01-01 or later.';
    } else {
      sanitized.nextPaymentDueDate = dueDate;
    }
  }

  const today = options?.todayIso ?? new Date().toISOString().slice(0, 10);
  if (input.hireDate !== undefined) {
    const hireDate = normalizeOptionalText(input.hireDate);
    if (hireDate !== null) {
      if (!isValidIsoDate(hireDate)) {
        errors.hireDate = 'Hire date must use YYYY-MM-DD format.';
      } else if (hireDate < MIN_SENSIBLE_HIRE_DATE) {
        errors.hireDate = 'Hire date must be 1960-01-01 or later.';
      } else if (hireDate > today) {
        errors.hireDate = 'Hire date cannot be in the future.';
      } else {
        sanitized.hireDate = hireDate;
      }
    } else {
      sanitized.hireDate = null;
    }
  }

  const effectiveHire =
    sanitized.hireDate !== undefined
      ? sanitized.hireDate
      : (options?.currentHireDate ?? null);
  const effectiveDue =
    sanitized.nextPaymentDueDate ?? options?.currentNextPaymentDueDate;
  if (
    effectiveHire &&
    effectiveDue &&
    isValidIsoDate(effectiveHire) &&
    isValidIsoDate(effectiveDue) &&
    effectiveDue < effectiveHire
  ) {
    errors.nextPaymentDueDate =
      'Next payment due date cannot be earlier than the hire date.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, errors: {}, data: sanitized };
}

export function validateNewWorkerPayment(
  input: NewWorkerPaymentInput,
  options?: { todayIso?: string }
): ValidationResult<Required<NewWorkerPaymentInput>> {
  const errors: ValidationErrors<NewWorkerPaymentInput> = {};

  const workerId = (input.workerId ?? '').trim();
  if (!workerId) {
    errors.workerId = 'Please select a worker.';
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Payment amount must be greater than 0.';
  }

  const dueDate = (input.dueDate ?? '').trim();
  if (!isValidIsoDate(dueDate)) {
    errors.dueDate = 'Due date must use YYYY-MM-DD format.';
  } else if (dueDate < MIN_SENSIBLE_FARM_DATE) {
    errors.dueDate = 'Due date must be 1980-01-01 or later.';
  }

  const status = (input.status ?? 'pending') as WorkerPaymentStatus;
  if (!WORKER_PAYMENT_STATUSES.includes(status)) {
    errors.status = 'Payment status must be pending or paid.';
  }

  const fallbackToday = options?.todayIso ?? new Date().toISOString().slice(0, 10);
  let paidDate = normalizeOptionalText(input.paidDate);
  if (status === 'paid' && paidDate === null) {
    paidDate = fallbackToday;
  }
  if (paidDate !== null) {
    if (!isValidIsoDate(paidDate)) {
      errors.paidDate = 'Paid date must use YYYY-MM-DD format.';
    } else if (paidDate < MIN_SENSIBLE_FARM_DATE) {
      errors.paidDate = 'Paid date must be 1980-01-01 or later.';
    } else if (paidDate > fallbackToday) {
      errors.paidDate = 'Paid date cannot be in the future.';
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: {},
    data: {
      workerId,
      amount: roundToTwo(amount),
      dueDate,
      paidDate: status === 'paid' ? paidDate : null,
      status,
      periodLabel: normalizeOptionalText(input.periodLabel),
      notes: normalizeOptionalText(input.notes),
    },
  };
}

export function validateUpdateWorkerPayment(
  input: UpdateWorkerPaymentInput,
  options?: { todayIso?: string }
): ValidationResult<UpdateWorkerPaymentInput> {
  const errors: ValidationErrors<UpdateWorkerPaymentInput> = {};
  const sanitized: UpdateWorkerPaymentInput = {};

  if (input.workerId !== undefined) {
    const workerId = input.workerId.trim();
    if (!workerId) {
      errors.workerId = 'Worker selection is required.';
    } else {
      sanitized.workerId = workerId;
    }
  }

  if (input.amount !== undefined) {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.amount = 'Payment amount must be greater than 0.';
    } else {
      sanitized.amount = roundToTwo(amount);
    }
  }

  if (input.dueDate !== undefined) {
    const dueDate = input.dueDate.trim();
    if (!isValidIsoDate(dueDate)) {
      errors.dueDate = 'Due date must use YYYY-MM-DD format.';
    } else if (dueDate < MIN_SENSIBLE_FARM_DATE) {
      errors.dueDate = 'Due date must be 1980-01-01 or later.';
    } else {
      sanitized.dueDate = dueDate;
    }
  }

  if (input.status !== undefined) {
    if (!WORKER_PAYMENT_STATUSES.includes(input.status)) {
      errors.status = 'Payment status must be pending or paid.';
    } else {
      sanitized.status = input.status;
    }
  }

  const today = options?.todayIso ?? new Date().toISOString().slice(0, 10);
  if (input.paidDate !== undefined) {
    const paidDate = normalizeOptionalText(input.paidDate);
    if (paidDate !== null) {
      if (!isValidIsoDate(paidDate)) {
        errors.paidDate = 'Paid date must use YYYY-MM-DD format.';
      } else if (paidDate < MIN_SENSIBLE_FARM_DATE) {
        errors.paidDate = 'Paid date must be 1980-01-01 or later.';
      } else if (paidDate > today) {
        errors.paidDate = 'Paid date cannot be in the future.';
      } else {
        sanitized.paidDate = paidDate;
      }
    } else {
      sanitized.paidDate = null;
    }
  }

  if (input.periodLabel !== undefined) {
    sanitized.periodLabel = normalizeOptionalText(input.periodLabel);
  }
  if (input.notes !== undefined) {
    sanitized.notes = normalizeOptionalText(input.notes);
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, errors: {}, data: sanitized };
}

export function validateNewWorkerTask(
  input: NewWorkerTaskInput
): ValidationResult<Required<NewWorkerTaskInput>> {
  const errors: ValidationErrors<NewWorkerTaskInput> = {};

  const workerId = (input.workerId ?? '').trim();
  if (!workerId) {
    errors.workerId = 'Please assign the task to a worker.';
  }

  const title = (input.title ?? '').trim();
  if (!title) {
    errors.title = 'Task title is required.';
  }

  const priority = (input.priority ?? 'medium') as WorkerTaskPriority;
  if (!WORKER_TASK_PRIORITIES.includes(priority)) {
    errors.priority = 'Select a valid priority level.';
  }

  const status = (input.status ?? 'pending') as WorkerTaskStatus;
  if (!WORKER_TASK_STATUSES.includes(status)) {
    errors.status = 'Select a valid task status.';
  }

  const dueDate = normalizeOptionalText(input.dueDate);
  if (dueDate !== null && !isValidIsoDate(dueDate)) {
    errors.dueDate = 'Due date must use YYYY-MM-DD format.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: {},
    data: {
      workerId,
      livestockId: normalizeOptionalText(input.livestockId),
      title,
      description: normalizeOptionalText(input.description),
      priority,
      status,
      dueDate,
    },
  };
}

export function validateUpdateWorkerTask(
  input: UpdateWorkerTaskInput
): ValidationResult<UpdateWorkerTaskInput> {
  const errors: ValidationErrors<UpdateWorkerTaskInput> = {};
  const sanitized: UpdateWorkerTaskInput = {};

  if (input.workerId !== undefined) {
    const workerId = input.workerId.trim();
    if (!workerId) {
      errors.workerId = 'Worker selection is required.';
    } else {
      sanitized.workerId = workerId;
    }
  }

  if (input.livestockId !== undefined) {
    sanitized.livestockId = normalizeOptionalText(input.livestockId);
  }

  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) {
      errors.title = 'Task title cannot be empty.';
    } else {
      sanitized.title = title;
    }
  }

  if (input.description !== undefined) {
    sanitized.description = normalizeOptionalText(input.description);
  }

  if (input.priority !== undefined) {
    if (!WORKER_TASK_PRIORITIES.includes(input.priority)) {
      errors.priority = 'Select a valid priority level.';
    } else {
      sanitized.priority = input.priority;
    }
  }

  if (input.status !== undefined) {
    if (!WORKER_TASK_STATUSES.includes(input.status)) {
      errors.status = 'Select a valid task status.';
    } else {
      sanitized.status = input.status;
    }
  }

  if (input.dueDate !== undefined) {
    const dueDate = normalizeOptionalText(input.dueDate);
    if (dueDate !== null && !isValidIsoDate(dueDate)) {
      errors.dueDate = 'Due date must use YYYY-MM-DD format.';
    } else {
      sanitized.dueDate = dueDate;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, errors: {}, data: sanitized };
}

export function validateNewAnimalOwnership(
  input: NewAnimalOwnershipInput,
  options?: { todayIso?: string }
): ValidationResult<Required<NewAnimalOwnershipInput>> {
  const errors: ValidationErrors<NewAnimalOwnershipInput> = {};

  const livestockId = (input.livestockId ?? '').trim();
  if (!livestockId) {
    errors.livestockId = 'Please select an animal.';
  }

  const ownerName = (input.ownerName ?? '').trim();
  if (!ownerName) {
    errors.ownerName = 'Owner / partner name is required.';
  } else if (ownerName.length > 80) {
    errors.ownerName = 'Owner name must be 80 characters or fewer.';
  }

  const ownershipCategory = (input.ownershipCategory ??
    'external_boarded') as OwnershipCategory;
  if (!OWNERSHIP_CATEGORIES.includes(ownershipCategory)) {
    errors.ownershipCategory = 'Select a valid ownership category.';
  }

  const sharePercentage = Number(input.sharePercentage ?? 100);
  if (
    !Number.isFinite(sharePercentage) ||
    sharePercentage <= 0 ||
    sharePercentage > 100
  ) {
    errors.sharePercentage = 'Ownership share must be between 1% and 100%.';
  }

  const boardingFee = Number(input.boardingFee ?? 0);
  if (!Number.isFinite(boardingFee) || boardingFee < 0) {
    errors.boardingFee = 'Agreed boarding or care fee cannot be negative.';
  }

  const fallbackToday = options?.todayIso ?? new Date().toISOString().slice(0, 10);
  const startDate = (input.startDate ?? fallbackToday).trim();
  if (!isValidIsoDate(startDate)) {
    errors.startDate = 'Start date must use YYYY-MM-DD format.';
  } else if (startDate < MIN_SENSIBLE_FARM_DATE) {
    errors.startDate = 'Start date cannot be before 1980-01-01.';
  }

  const expectedEndDate = normalizeOptionalText(input.expectedEndDate);
  if (expectedEndDate !== null) {
    if (!isValidIsoDate(expectedEndDate)) {
      errors.expectedEndDate =
        'Expected return / pickup date must use YYYY-MM-DD format.';
    } else if (isValidIsoDate(startDate) && expectedEndDate < startDate) {
      errors.expectedEndDate =
        'Expected return / pickup date cannot be earlier than the start date.';
    }
  }

  const status = (input.status ?? 'active') as OwnershipStatus;
  if (!OWNERSHIP_STATUSES.includes(status)) {
    errors.status = 'Select a valid custody status.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: {},
    data: {
      livestockId,
      ownerName,
      ownerContact: normalizeOptionalText(input.ownerContact),
      accountId: normalizeOptionalText(input.accountId),
      ownershipCategory,
      sharePercentage: roundToTwo(sharePercentage),
      purpose: normalizeOptionalText(input.purpose),
      startDate,
      expectedEndDate,
      boardingFee: roundToTwo(boardingFee),
      status,
      notes: normalizeOptionalText(input.notes),
    },
  };
}

export function validateUpdateAnimalOwnership(
  input: UpdateAnimalOwnershipInput,
  options?: { currentStartDate?: string }
): ValidationResult<UpdateAnimalOwnershipInput> {
  const errors: ValidationErrors<UpdateAnimalOwnershipInput> = {};
  const sanitized: UpdateAnimalOwnershipInput = {};

  if (input.livestockId !== undefined) {
    const livestockId = input.livestockId.trim();
    if (!livestockId) {
      errors.livestockId = 'Animal selection is required.';
    } else {
      sanitized.livestockId = livestockId;
    }
  }

  if (input.ownerName !== undefined) {
    const ownerName = input.ownerName.trim();
    if (!ownerName) {
      errors.ownerName = 'Owner name cannot be empty.';
    } else if (ownerName.length > 80) {
      errors.ownerName = 'Owner name must be 80 characters or fewer.';
    } else {
      sanitized.ownerName = ownerName;
    }
  }

  if (input.ownerContact !== undefined) {
    sanitized.ownerContact = normalizeOptionalText(input.ownerContact);
  }
  if (input.accountId !== undefined) {
    sanitized.accountId = normalizeOptionalText(input.accountId);
  }

  if (input.ownershipCategory !== undefined) {
    if (!OWNERSHIP_CATEGORIES.includes(input.ownershipCategory)) {
      errors.ownershipCategory = 'Select a valid ownership category.';
    } else {
      sanitized.ownershipCategory = input.ownershipCategory;
    }
  }

  if (input.sharePercentage !== undefined) {
    const sharePercentage = Number(input.sharePercentage);
    if (
      !Number.isFinite(sharePercentage) ||
      sharePercentage <= 0 ||
      sharePercentage > 100
    ) {
      errors.sharePercentage = 'Ownership share must be between 1% and 100%.';
    } else {
      sanitized.sharePercentage = roundToTwo(sharePercentage);
    }
  }

  if (input.purpose !== undefined) {
    sanitized.purpose = normalizeOptionalText(input.purpose);
  }

  if (input.startDate !== undefined) {
    const startDate = input.startDate.trim();
    if (!isValidIsoDate(startDate)) {
      errors.startDate = 'Start date must use YYYY-MM-DD format.';
    } else if (startDate < MIN_SENSIBLE_FARM_DATE) {
      errors.startDate = 'Start date cannot be before 1980-01-01.';
    } else {
      sanitized.startDate = startDate;
    }
  }

  if (input.expectedEndDate !== undefined) {
    const expectedEndDate = normalizeOptionalText(input.expectedEndDate);
    if (expectedEndDate !== null && !isValidIsoDate(expectedEndDate)) {
      errors.expectedEndDate = 'Expected date must use YYYY-MM-DD format.';
    } else {
      sanitized.expectedEndDate = expectedEndDate;
    }
  }

  const effectiveStartDate = sanitized.startDate ?? options?.currentStartDate;
  if (
    effectiveStartDate &&
    sanitized.expectedEndDate &&
    isValidIsoDate(effectiveStartDate) &&
    isValidIsoDate(sanitized.expectedEndDate) &&
    sanitized.expectedEndDate < effectiveStartDate
  ) {
    errors.expectedEndDate =
      'Expected return / pickup date cannot be earlier than the start date.';
  }

  if (input.boardingFee !== undefined) {
    const fee = Number(input.boardingFee);
    if (!Number.isFinite(fee) || fee < 0) {
      errors.boardingFee = 'Boarding or care fee cannot be negative.';
    } else {
      sanitized.boardingFee = roundToTwo(fee);
    }
  }

  if (input.status !== undefined) {
    if (!OWNERSHIP_STATUSES.includes(input.status)) {
      errors.status = 'Select a valid custody status.';
    } else {
      sanitized.status = input.status;
    }
  }

  if (input.notes !== undefined) {
    sanitized.notes = normalizeOptionalText(input.notes);
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, errors: {}, data: sanitized };
}

export function validateNewFarmAccount(
  input: NewFarmAccountInput
): ValidationResult<
  Required<Omit<NewFarmAccountInput, 'id' | 'permissions'>> & {
    id?: string;
    permissions: FarmAccountPermissions;
  }
> {
  const errors: ValidationErrors<NewFarmAccountInput> = {};

  const displayName = (input.displayName ?? '').trim();
  if (!displayName) {
    errors.displayName = 'Account display name is required.';
  } else if (displayName.length > 70) {
    errors.displayName = 'Display name must be 70 characters or fewer.';
  }

  const email = normalizeOptionalText(input.email);
  if (email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address or leave blank.';
  }

  const role = (input.role ?? 'family_member') as FarmAccountRole;
  if (!FARM_ACCOUNT_ROLES.includes(role)) {
    errors.role = 'Select a valid farm network role.';
  }

  const avatarKey = (input.avatarKey ??
    (role === 'external_owner' ? 'peasant' : 'farmer')) as FarmAccountAvatar;
  if (!FARM_ACCOUNT_AVATARS.includes(avatarKey)) {
    errors.avatarKey = 'Select a valid account avatar.';
  }

  const status = (input.status ?? 'active') as FarmAccountStatus;
  if (!FARM_ACCOUNT_STATUSES.includes(status)) {
    errors.status = 'Select a valid account status.';
  }

  const accessCode = normalizeOptionalText(input.accessCode);
  if (
    accessCode !== null &&
    (accessCode.length < 4 || accessCode.length > 32)
  ) {
    errors.accessCode = 'Login PIN / passcode must be between 4 and 32 characters.';
  }

  const rawSupabaseUrl = normalizeOptionalText(input.supabaseUrl);
  const supabaseUrl =
    rawSupabaseUrl !== null ? normalizeSupabaseBaseUrl(rawSupabaseUrl) : null;
  if (supabaseUrl !== null && !/^https?:\/\/.+/i.test(supabaseUrl)) {
    errors.supabaseUrl = 'Supabase URL must start with https:// or http://.';
  }
  const supabaseAnonKey = normalizeOptionalText(input.supabaseAnonKey);
  const cloudWorkspaceId = normalizeOptionalText(input.cloudWorkspaceId);

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const isPrimaryAdmin = Boolean(input.isPrimaryAdmin ?? false);
  const effectiveRole: FarmAccountRole = isPrimaryAdmin ? 'admin' : role;

  return {
    ok: true,
    errors: {},
    data: {
      ...(input.id ? { id: input.id.trim() } : {}),
      displayName,
      email,
      phone: normalizeOptionalText(input.phone),
      role: effectiveRole,
      relationship: normalizeOptionalText(input.relationship),
      avatarKey,
      accessCode,
      supabaseUrl,
      supabaseAnonKey,
      cloudWorkspaceId,
      isPrimaryAdmin,
      canManageNetwork: Boolean(
        input.canManageNetwork ?? effectiveRole === 'admin'
      ),
      canSyncCloud: Boolean(
        input.canSyncCloud ??
          (effectiveRole === 'admin' ||
            effectiveRole === 'manager' ||
            effectiveRole === 'family_member')
      ),
      permissions: normalizeAccountPermissions(input.permissions, effectiveRole),
      status: isPrimaryAdmin ? 'active' : status,
    },
  };
}

export function validateUpdateFarmAccount(
  input: UpdateFarmAccountInput,
  currentRole: FarmAccountRole = 'family_member'
): ValidationResult<
  Omit<UpdateFarmAccountInput, 'permissions'> & {
    permissions?: Partial<FarmAccountPermissions>;
  }
> {
  const errors: ValidationErrors<UpdateFarmAccountInput> = {};
  const sanitized: UpdateFarmAccountInput = {};

  if (input.displayName !== undefined) {
    const displayName = input.displayName.trim();
    if (!displayName) {
      errors.displayName = 'Display name cannot be empty.';
    } else if (displayName.length > 70) {
      errors.displayName = 'Display name must be 70 characters or fewer.';
    } else {
      sanitized.displayName = displayName;
    }
  }

  if (input.email !== undefined) {
    const email = normalizeOptionalText(input.email);
    if (email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Enter a valid email address or leave blank.';
    } else {
      sanitized.email = email;
    }
  }

  if (input.phone !== undefined) {
    sanitized.phone = normalizeOptionalText(input.phone);
  }
  if (input.relationship !== undefined) {
    sanitized.relationship = normalizeOptionalText(input.relationship);
  }
  if (input.accessCode !== undefined) {
    const accessCode = normalizeOptionalText(input.accessCode);
    if (
      accessCode !== null &&
      (accessCode.length < 4 || accessCode.length > 32)
    ) {
      errors.accessCode =
        'Login PIN / passcode must be between 4 and 32 characters.';
    } else {
      sanitized.accessCode = accessCode;
    }
  }

  if (input.supabaseUrl !== undefined) {
    const rawUrl = normalizeOptionalText(input.supabaseUrl);
    const cleaned = rawUrl !== null ? normalizeSupabaseBaseUrl(rawUrl) : null;
    if (cleaned !== null && !/^https?:\/\/.+/i.test(cleaned)) {
      errors.supabaseUrl = 'Supabase URL must start with https:// or http://.';
    } else {
      sanitized.supabaseUrl = cleaned;
    }
  }
  if (input.supabaseAnonKey !== undefined) {
    sanitized.supabaseAnonKey = normalizeOptionalText(input.supabaseAnonKey);
  }
  if (input.cloudWorkspaceId !== undefined) {
    sanitized.cloudWorkspaceId = normalizeOptionalText(input.cloudWorkspaceId);
  }

  const nextRole = input.role ?? currentRole;
  if (input.role !== undefined) {
    if (!FARM_ACCOUNT_ROLES.includes(input.role)) {
      errors.role = 'Select a valid farm network role.';
    } else {
      sanitized.role = input.role;
    }
  }

  if (input.avatarKey !== undefined) {
    if (!FARM_ACCOUNT_AVATARS.includes(input.avatarKey)) {
      errors.avatarKey = 'Select a valid avatar.';
    } else {
      sanitized.avatarKey = input.avatarKey;
    }
  }

  if (input.status !== undefined) {
    if (!FARM_ACCOUNT_STATUSES.includes(input.status)) {
      errors.status = 'Select a valid account status.';
    } else {
      sanitized.status = input.status;
    }
  }

  if (input.canManageNetwork !== undefined) {
    sanitized.canManageNetwork = Boolean(input.canManageNetwork);
  }
  if (input.canSyncCloud !== undefined) {
    sanitized.canSyncCloud = Boolean(input.canSyncCloud);
  }
  if (input.lastSyncedAt !== undefined) {
    sanitized.lastSyncedAt = input.lastSyncedAt;
  }
  if (input.permissions !== undefined) {
    sanitized.permissions = normalizeAccountPermissions(
      input.permissions,
      nextRole
    );
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, errors: {}, data: sanitized };
}

