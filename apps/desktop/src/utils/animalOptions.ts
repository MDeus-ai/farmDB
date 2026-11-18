import {
  formatAnimalAge,
  formatDisplayDate,
  formatSexLabel,
  formatSpeciesLabel,
  formatStatusLabel,
  type DateFormatPreference,
  type Livestock,
} from '@farmdb/core';
import { getSpeciesPngIcon } from '../assets/icons';
import type { ModernSelectOption } from '../components/ModernSelect';
import { resolveDesktopImageSrc } from '../services/imageStorage';

interface BuildAnimalOptionParams {
  value?: string;
  label?: string;
  hint?: string;
  dateFormat?: DateFormatPreference;
}

/**
 * Builds a rich `ModernSelectOption` for any livestock picker so dropdown menus
 * show animal thumbnails and live quick-preview cards.
 */
export function buildAnimalSelectOption(
  animal: Livestock,
  params?: BuildAnimalOptionParams
): ModernSelectOption<string> {
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
  const imageSrc = resolveDesktopImageSrc(animal.imageUri);
  const fallbackIconSrc = getSpeciesPngIcon(animal.species, animal.sex);

  return {
    value: params?.value ?? animal.id,
    label,
    iconSrc: fallbackIconSrc,
    hint: params?.hint ?? `${speciesBreed} · ${ageText}`,
    preview: {
      animalId: animal.id,
      title: displayName,
      tagNumber: animal.tagNumber,
      subtitle: speciesBreed,
      status: animal.status,
      statusLabel: formatStatusLabel(animal.status),
      ageText,
      dobText,
      imageSrc,
      fallbackIconSrc,
    },
  };
}
