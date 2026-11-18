import {
  formatAnimalAge,
  formatDisplayDate,
  formatSexLabel,
  formatSpeciesLabel,
  formatStatusLabel,
  type DateFormatPreference,
  type Livestock,
} from '@farmdb/core';
import { getSpeciesPngSource } from '../assets/icons';
import type { ModernDropdownOption } from '../components/ModernDropdown';

interface BuildMobileAnimalOptionParams {
  value?: string;
  label?: string;
  hint?: string;
  dateFormat?: DateFormatPreference;
}

/**
 * Builds a rich `ModernDropdownOption` for livestock selectors so mobile users
 * can quick-preview photos, age, breed, and status before selecting.
 */
export function buildAnimalDropdownOption(
  animal: Livestock,
  params?: BuildMobileAnimalOptionParams
): ModernDropdownOption<string> {
  const displayName = animal.name?.trim() || animal.tagNumber;
  const label =
    params?.label ??
    (animal.name ? `${animal.tagNumber} · ${animal.name}` : animal.tagNumber);
  const speciesBreed = `${formatSpeciesLabel(animal.species, animal.sex)} · ${formatSexLabel(animal.sex)}${
    animal.breed ? ` · ${animal.breed}` : ''
  }`;
  const ageText = formatAnimalAge(animal.dob);
  const dobText = animal.dob
    ? formatDisplayDate(animal.dob, params?.dateFormat ?? 'iso')
    : 'Unknown DOB';
  const fallbackIconSource = getSpeciesPngSource(animal.species, animal.sex);

  return {
    value: params?.value ?? animal.id,
    label,
    iconSource: fallbackIconSource,
    hint: params?.hint ?? `${speciesBreed} · ${ageText}`,
    preview: {
      title: displayName,
      tagNumber: animal.tagNumber,
      subtitle: speciesBreed,
      species: animal.species,
      status: animal.status,
      statusLabel: formatStatusLabel(animal.status),
      ageText,
      dobText,
      imageUri: animal.imageUri ?? null,
      fallbackIconSource,
    },
  };
}
