import { describe, expect, it } from 'vitest';
import {
  findCanonicalBreed,
  formatAvatarLabel,
  formatAvatarSlugFromFilename,
  formatBreedHint,
  getBreedsForSpecies,
  isValidBreedForSpecies,
  isValidFarmAccountAvatar,
  SPECIES_LIST,
  validateNewLivestock,
  validateUpdateLivestock,
} from '../src/index';

describe('@farmdb/core breed dictionary & avatar helpers', () => {
  it('provides species-specific breeds across all 5 species with African breeds sorted first', () => {
    for (const species of SPECIES_LIST) {
      const list = getBreedsForSpecies(species);
      expect(list.length).toBeGreaterThan(0);

      // Every African entry should appear before any non-African entry
      const firstNonAfricanIdx = list.findIndex((b) => !b.isAfrican);
      if (firstNonAfricanIdx !== -1) {
        const trailingAfrican = list.slice(firstNonAfricanIdx).some((b) => Boolean(b.isAfrican));
        expect(trailingAfrican).toBe(false);
      }
    }

    const cowNames = getBreedsForSpecies('cow').map((b) => b.name);
    expect(cowNames).toContain('Ankole-Watusi (Ankole Longhorn)');
    expect(cowNames).toContain('Boran');
    expect(cowNames).toContain('Small East African Zebu');

    const goatNames = getBreedsForSpecies('goat').map((b) => b.name);
    expect(goatNames).toContain('Mubende');
    expect(goatNames).toContain('Boer');
    expect(goatNames).toContain('Small East African Goat');

    const sheepNames = getBreedsForSpecies('sheep').map((b) => b.name);
    expect(sheepNames).toContain('Dorper');
    expect(sheepNames).toContain('Red Maasai');

    const duckNames = getBreedsForSpecies('duck').map((b) => b.name);
    expect(duckNames).toContain('Muscovy');
    expect(duckNames).toContain('African Indigenous / Local Duck');

    const otherNames = getBreedsForSpecies('other').map((b) => b.name);
    expect(otherNames).toContain('Kuroiler');
    expect(otherNames).toContain('Kienyeji (Indigenous Village Chicken)');
  });

  it('canonicalizes breed aliases and formats African vs global breed hints', () => {
    expect(findCanonicalBreed('cow', 'Ankole')?.name).toBe('Ankole-Watusi (Ankole Longhorn)');
    expect(findCanonicalBreed('cow', 'SEAZ')?.name).toBe('Small East African Zebu');
    expect(findCanonicalBreed('cow', 'Holstein Friesian')?.name).toBe('Holstein');
    expect(findCanonicalBreed('other', 'Kienyeji')?.name).toBe(
      'Kienyeji (Indigenous Village Chicken)'
    );

    const boran = findCanonicalBreed('cow', 'Boran');
    expect(boran).not.toBeNull();
    expect(formatBreedHint(boran!)).toContain('African');

    const holstein = findCanonicalBreed('cow', 'Holstein');
    expect(holstein).not.toBeNull();
    expect(formatBreedHint(holstein!)).toContain(holstein!.origin);
    expect(formatBreedHint(holstein!)).toContain(holstein!.category);
  });

  it('enforces breed dictionary validation in livestock validation with legacy update tolerance', () => {
    expect(isValidBreedForSpecies('cow', 'Totally Fake Breed')).toBe(false);
    expect(isValidBreedForSpecies('cow', 'Boer')).toBe(false);
    expect(isValidBreedForSpecies('goat', 'Boer')).toBe(true);

    const validAliasCreate = validateNewLivestock({
      species: 'cow',
      sex: 'female',
      tagNumber: 'COW-701',
      name: 'Nairobi',
      breed: 'ankole',
    });
    expect(validAliasCreate.ok).toBe(true);
    expect(validAliasCreate.data?.breed).toBe('Ankole-Watusi (Ankole Longhorn)');

    const invalidCreate = validateNewLivestock({
      species: 'cow',
      sex: 'female',
      tagNumber: 'COW-702',
      name: 'Mystery',
      breed: 'Totally Fake Breed',
    });
    expect(invalidCreate.ok).toBe(false);
    expect(invalidCreate.errors.breed).toBeDefined();

    const wrongSpeciesCreate = validateNewLivestock({
      species: 'cow',
      sex: 'male',
      tagNumber: 'COW-703',
      name: 'Cross Check',
      breed: 'Boer',
    });
    expect(wrongSpeciesCreate.ok).toBe(false);
    expect(wrongSpeciesCreate.errors.breed).toBeDefined();

    // Legacy record retains its existing custom breed on unrelated edits when currentBreed is supplied
    const legacyUpdate = validateUpdateLivestock(
      { breed: 'Legacy Farm Mix', name: 'Updated Name' },
      { currentSpecies: 'cow', currentBreed: 'Legacy Farm Mix' }
    );
    expect(legacyUpdate.ok).toBe(true);
    expect(legacyUpdate.data?.breed).toBe('Legacy Farm Mix');

    // Switching to a different unrecognized breed is still rejected
    const badBreedChange = validateUpdateLivestock(
      { breed: 'Still Fake' },
      { currentSpecies: 'cow', currentBreed: 'Legacy Farm Mix' }
    );
    expect(badBreedChange.ok).toBe(false);
    expect(badBreedChange.errors.breed).toBeDefined();
  });

  it('builds and validates built-in and folder-synced avator slugs cleanly', () => {
    expect(formatAvatarSlugFromFilename('Woman Farmer.png')).toBe('avator_woman_farmer');
    expect(formatAvatarSlugFromFilename('boy-1.PNG')).toBe('avator_boy_1');
    expect(formatAvatarLabel('farmerFemale')).toBe('Farmer Female');
    expect(formatAvatarLabel('avator_woman_farmer')).toBe('Woman Farmer');

    expect(isValidFarmAccountAvatar('farmer')).toBe(true);
    expect(isValidFarmAccountAvatar('avator_woman_farmer')).toBe(true);
    expect(isValidFarmAccountAvatar('avator_boy_1')).toBe(true);
    expect(isValidFarmAccountAvatar('woman-farmer')).toBe(false);
    expect(isValidFarmAccountAvatar('')).toBe(false);
    expect(isValidFarmAccountAvatar('   ')).toBe(false);
    expect(isValidFarmAccountAvatar('bad avatar!')).toBe(false);
  });
});
