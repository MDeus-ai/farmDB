import type { DateFormatPreference, LivestockSex, VolumeUnit } from './types';

const LITERS_PER_US_GALLON = 3.785411784;

/**
 * Generates a UUID v4 string without requiring Node-only modules,
 * supporting both modern Web Crypto and React Native environments.
 */
export function generateId(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

export function formatIsoDate(isoDate?: string | null): string {
  if (!isoDate) {
    return '—';
  }
  return isoDate;
}

export function formatDisplayDate(
  isoDate?: string | null,
  format: DateFormatPreference = 'iso'
): string {
  if (!isoDate) {
    return '—';
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) {
    return isoDate;
  }
  const [, year, month, day] = match;
  if (format === 'mdy') {
    return `${month}/${day}/${year}`;
  }
  if (format === 'dmy') {
    return `${day}/${month}/${year}`;
  }
  return `${year}-${month}-${day}`;
}

export function getVolumeUnitShortLabel(unit: VolumeUnit = 'liters'): string {
  return unit === 'gallons' ? 'gal' : 'L';
}

export function convertLitersToDisplayVolume(
  liters: number,
  unit: VolumeUnit = 'liters'
): number {
  if (!Number.isFinite(liters)) {
    return 0;
  }
  if (unit === 'gallons') {
    return Math.round((liters / LITERS_PER_US_GALLON) * 100) / 100;
  }
  return Math.round(liters * 100) / 100;
}

export function convertDisplayVolumeToLiters(
  value: number,
  unit: VolumeUnit = 'liters'
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (unit === 'gallons') {
    return Math.round(value * LITERS_PER_US_GALLON * 100) / 100;
  }
  return Math.round(value * 100) / 100;
}

export function formatVolume(
  liters: number,
  unit: VolumeUnit = 'liters'
): string {
  const value = convertLitersToDisplayVolume(liters, unit);
  return `${value.toFixed(1)} ${getVolumeUnitShortLabel(unit)}`;
}

export function formatSpeciesLabel(
  species: string,
  sex?: LivestockSex | null
): string {
  if (species === 'cow' && sex === 'male') {
    return 'Bull';
  }
  return species.charAt(0).toUpperCase() + species.slice(1);
}

export function formatStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Formats an animal's age from an ISO `YYYY-MM-DD` date of birth.
 */
export function formatAnimalAge(
  dob?: string | null,
  referenceDate: Date = new Date()
): string {
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    return 'Unknown';
  }

  const [yStr, mStr, dStr] = dob.split('-');
  const birthYear = Number(yStr);
  const birthMonth = Number(mStr);
  const birthDay = Number(dStr);

  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth() + 1;
  const refDay = referenceDate.getUTCDate();

  let totalMonths = (refYear - birthYear) * 12 + (refMonth - birthMonth);
  if (refDay < birthDay) {
    totalMonths -= 1;
  }

  if (totalMonths < 0) {
    return '0 days';
  }

  if (totalMonths === 0) {
    const birthMs = Date.UTC(birthYear, birthMonth - 1, birthDay);
    const refMs = Date.UTC(refYear, refMonth - 1, refDay);
    const days = Math.max(0, Math.floor((refMs - birthMs) / 86_400_000));
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  }

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  if (years === 0) {
    return `${months} ${months === 1 ? 'mo' : 'mos'}`;
  }
  if (months === 0) {
    return `${years} ${years === 1 ? 'yr' : 'yrs'}`;
  }
  return `${years} ${years === 1 ? 'yr' : 'yrs'} ${months} ${months === 1 ? 'mo' : 'mos'}`;
}

const ALLOWED_IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'bmp',
  'heic',
]);

export function extractSafeImageExtension(
  pathOrFilename?: string | null,
  fallback = 'jpg'
): string {
  if (!pathOrFilename) {
    return fallback;
  }
  const clean = pathOrFilename.split('?')[0]?.split('#')[0] ?? '';
  const dotIdx = clean.lastIndexOf('.');
  if (dotIdx === -1) {
    return fallback;
  }
  const ext = clean.slice(dotIdx + 1).toLowerCase();
  return ALLOWED_IMAGE_EXTENSIONS.has(ext) ? ext : fallback;
}

export function buildLivestockImageStem(tagNumber: string, uniqueId: string): string {
  const safeTag = tagNumber
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const prefix = safeTag || 'animal';
  const suffix = uniqueId.replace(/[^a-z0-9]/gi, '').slice(0, 12) || 'img';
  return `${prefix}-${suffix}`;
}
