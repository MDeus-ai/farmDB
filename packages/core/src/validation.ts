import {
  LIVESTOCK_STATUSES,
  SPECIES_LIST,
  type LivestockStatus,
  type NewLivestockInput,
  type Species,
  type UpdateLivestockInput,
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
