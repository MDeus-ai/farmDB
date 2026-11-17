import {
  ALERT_ENTRY_KINDS,
  FINANCIAL_CATEGORIES,
  LIVESTOCK_STATUSES,
  SPECIES_LIST,
  TRANSACTION_TYPES,
  type AlertEntryKind,
  type FarmSettings,
  type FinancialCategory,
  type LivestockStatus,
  type NewAlertInput,
  type NewFinancialLogInput,
  type NewLivestockInput,
  type NewMedicalRecordInput,
  type NewProductRecordInput,
  type Species,
  type TransactionType,
  type UpdateAlertInput,
  type UpdateFinancialLogInput,
  type UpdateLivestockInput,
  type UpdateMedicalRecordInput,
  type UpdateProductRecordInput,
} from './types';

export type ValidationErrors<T> = Partial<Record<keyof T, string>>;

export interface ValidationResult<T> {
  ok: boolean;
  data?: T;
  errors: ValidationErrors<T>;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

export function validateNewLivestock(
  input: NewLivestockInput,
  options?: { existingTags?: Iterable<string>; todayIso?: string }
): ValidationResult<Required<NewLivestockInput>> {
  const errors: ValidationErrors<NewLivestockInput> = {};

  const tagNumber = normalizeTagNumber(input.tagNumber ?? '');
  if (!tagNumber) {
    errors.tagNumber = 'Tag number is required.';
  } else if (tagNumber.length > 40) {
    errors.tagNumber = 'Tag number must be 40 characters or fewer.';
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

  const status: LivestockStatus = input.status ?? 'active';
  if (!LIVESTOCK_STATUSES.includes(status)) {
    errors.status = 'Invalid livestock status.';
  }

  const dob = normalizeOptionalText(input.dob);
  if (dob !== null) {
    if (!isValidIsoDate(dob)) {
      errors.dob = 'Date of birth must use YYYY-MM-DD format.';
    } else {
      const today = options?.todayIso ?? new Date().toISOString().slice(0, 10);
      if (dob > today) {
        errors.dob = 'Date of birth cannot be in the future.';
      }
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
      tagNumber,
      name: normalizeOptionalText(input.name),
      breed: normalizeOptionalText(input.breed),
      dob,
      imageUri: normalizeOptionalText(input.imageUri),
      status,
    },
  };
}

export function validateUpdateLivestock(
  input: UpdateLivestockInput,
  options?: { existingTags?: Iterable<string>; currentTag?: string; todayIso?: string }
): ValidationResult<UpdateLivestockInput> {
  const errors: ValidationErrors<UpdateLivestockInput> = {};
  const sanitized: UpdateLivestockInput = {};

  if (input.tagNumber !== undefined) {
    const tagNumber = normalizeTagNumber(input.tagNumber);
    if (!tagNumber) {
      errors.tagNumber = 'Tag number cannot be empty.';
    } else if (tagNumber.length > 40) {
      errors.tagNumber = 'Tag number must be 40 characters or fewer.';
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
      } else {
        const today = options?.todayIso ?? new Date().toISOString().slice(0, 10);
        if (dob > today) {
          errors.dob = 'Date of birth cannot be in the future.';
        }
      }
    }
    sanitized.dob = dob;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, errors: {}, data: sanitized };
}

export function validateNewProductRecord(
  input: NewProductRecordInput,
  options?: { todayIso?: string }
): ValidationResult<Required<NewProductRecordInput>> {
  const errors: ValidationErrors<NewProductRecordInput> = {};

  const livestockId = (input.livestockId ?? '').trim();
  if (!livestockId) {
    errors.livestockId = 'Please select an animal.';
  }

  const date = (input.date ?? '').trim();
  if (!isValidIsoDate(date)) {
    errors.date = 'Date must use YYYY-MM-DD format.';
  } else {
    const today = options?.todayIso ?? new Date().toISOString().slice(0, 10);
    if (date > today) {
      errors.date = 'Production date cannot be in the future.';
    }
  }

  const yieldAmount = Number(input.yieldAmount);
  if (!Number.isFinite(yieldAmount) || yieldAmount <= 0) {
    errors.yieldAmount = 'Milk yield must be greater than 0 liters.';
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
  options?: { todayIso?: string }
): ValidationResult<UpdateProductRecordInput> {
  const errors: ValidationErrors<UpdateProductRecordInput> = {};
  const sanitized: UpdateProductRecordInput = {};

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
    } else {
      const today = options?.todayIso ?? new Date().toISOString().slice(0, 10);
      if (date > today) {
        errors.date = 'Production date cannot be in the future.';
      } else {
        sanitized.date = date;
      }
    }
  }

  if (input.yieldAmount !== undefined) {
    const yieldAmount = Number(input.yieldAmount);
    if (!Number.isFinite(yieldAmount) || yieldAmount <= 0) {
      errors.yieldAmount = 'Milk yield must be greater than 0 liters.';
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
  input: NewFinancialLogInput
): ValidationResult<Required<NewFinancialLogInput>> {
  const errors: ValidationErrors<NewFinancialLogInput> = {};

  const transactionType = input.transactionType as TransactionType;
  if (!TRANSACTION_TYPES.includes(transactionType)) {
    errors.transactionType = 'Transaction type must be income or expense.';
  }

  const category = input.category as FinancialCategory;
  if (!FINANCIAL_CATEGORIES.includes(category)) {
    errors.category = 'Invalid financial category.';
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Amount must be greater than 0.';
  }

  const date = (input.date ?? '').trim();
  if (!isValidIsoDate(date)) {
    errors.date = 'Date must use YYYY-MM-DD format.';
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
  input: UpdateFinancialLogInput
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

  if (input.category !== undefined) {
    if (!FINANCIAL_CATEGORIES.includes(input.category)) {
      errors.category = 'Invalid financial category.';
    } else {
      sanitized.category = input.category;
    }
  }

  if (input.amount !== undefined) {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.amount = 'Amount must be greater than 0.';
    } else {
      sanitized.amount = roundToTwo(amount);
    }
  }

  if (input.date !== undefined) {
    const date = input.date.trim();
    if (!isValidIsoDate(date)) {
      errors.date = 'Date must use YYYY-MM-DD format.';
    } else {
      sanitized.date = date;
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
  input: FarmSettings
): ValidationResult<FarmSettings> {
  const errors: ValidationErrors<FarmSettings> = {};

  const rate = Number(input.defaultMilkRatePerLiter);
  if (!Number.isFinite(rate) || rate < 0) {
    errors.defaultMilkRatePerLiter = 'Milk rate cannot be negative.';
  }

  const currencySymbol = (input.currencySymbol ?? '').trim();
  if (!currencySymbol || currencySymbol.length > 6) {
    errors.currencySymbol = 'Currency symbol must be 1 to 6 characters.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: {},
    data: {
      defaultMilkRatePerLiter: roundToTwo(rate),
      currencySymbol,
    },
  };
}

export function validateNewMedicalRecord(
  input: NewMedicalRecordInput,
  options?: { todayIso?: string }
): ValidationResult<Required<NewMedicalRecordInput>> {
  const errors: ValidationErrors<NewMedicalRecordInput> = {};

  const livestockId = (input.livestockId ?? '').trim();
  if (!livestockId) {
    errors.livestockId = 'Please select an animal.';
  }

  const date = (input.date ?? '').trim();
  if (!isValidIsoDate(date)) {
    errors.date = 'Date must use YYYY-MM-DD format.';
  } else {
    const today = options?.todayIso ?? new Date().toISOString().slice(0, 10);
    if (date > today) {
      errors.date = 'Medical record date cannot be in the future.';
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
  options?: { todayIso?: string }
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
    } else {
      const today = options?.todayIso ?? new Date().toISOString().slice(0, 10);
      if (date > today) {
        errors.date = 'Medical record date cannot be in the future.';
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
