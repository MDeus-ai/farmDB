import { describe, expect, it } from 'vitest';
import {
  analyzeBreedingPair,
  buildAnimalPedigree,
  buildHerdLineageOverview,
  getEligibleParentCandidates,
  validateNewLivestock,
  validateUpdateLivestock,
  type Livestock,
  type ProductRecord,
} from '../src/index';

function makeAnimal(
  partial: Partial<Livestock> & Pick<Livestock, 'id' | 'tagNumber'>
): Livestock {
  return {
    species: 'cow',
    name: null,
    breed: 'Holstein',
    dob: '2022-01-01',
    imageUri: null,
    sireId: null,
    damId: null,
    status: 'active',
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  };
}

describe('@farmdb/core lineage & herd family tree', () => {
  const ggSire = makeAnimal({
    id: 'a-ggs',
    tagNumber: 'BULL-001',
    name: 'Atlas',
    dob: '2018-01-10',
  });
  const pGrandsire = makeAnimal({
    id: 'a-pgs',
    tagNumber: 'BULL-010',
    name: 'Titan',
    dob: '2020-02-01',
    sireId: 'a-ggs',
  });
  const pGranddam = makeAnimal({
    id: 'a-pgd',
    tagNumber: 'COW-011',
    name: 'Marigold',
    dob: '2020-03-01',
  });
  const mGrandsire = makeAnimal({
    id: 'a-mgs',
    tagNumber: 'BULL-012',
    name: 'Orion',
    dob: '2020-01-15',
  });
  const mGranddam = makeAnimal({
    id: 'a-mgd',
    tagNumber: 'COW-318',
    name: 'Willow',
    dob: '2020-05-12',
  });
  const sire = makeAnimal({
    id: 'a-sire',
    tagNumber: 'BULL-101',
    name: 'Duke',
    dob: '2021-06-01',
    sireId: 'a-pgs',
    damId: 'a-pgd',
  });
  const dam = makeAnimal({
    id: 'a-dam',
    tagNumber: 'COW-402',
    name: 'Bessie',
    dob: '2021-08-20',
    sireId: 'a-mgs',
    damId: 'a-mgd',
  });
  const focal = makeAnimal({
    id: 'a-focal',
    tagNumber: 'COW-501',
    name: 'Buttercup',
    dob: '2023-09-01',
    sireId: 'a-sire',
    damId: 'a-dam',
  });
  const fullSib = makeAnimal({
    id: 'a-full-sib',
    tagNumber: 'COW-502',
    name: 'Clover',
    dob: '2024-09-05',
    sireId: 'a-sire',
    damId: 'a-dam',
  });
  const halfSib = makeAnimal({
    id: 'a-half-sib',
    tagNumber: 'COW-503',
    name: 'Daisy',
    dob: '2024-10-10',
    sireId: 'a-sire',
    damId: 'a-outcross',
  });
  const mate = makeAnimal({
    id: 'a-mate',
    tagNumber: 'BULL-202',
    name: 'Ranger',
    dob: '2022-04-04',
  });
  const outcross = makeAnimal({
    id: 'a-outcross',
    tagNumber: 'COW-409',
    name: 'Hazel',
    dob: '2021-11-11',
  });
  const calf = makeAnimal({
    id: 'a-calf',
    tagNumber: 'COW-601',
    name: 'Sunny',
    dob: '2025-10-01',
    sireId: 'a-mate',
    damId: 'a-focal',
  });
  const grandCalf = makeAnimal({
    id: 'a-grandcalf',
    tagNumber: 'COW-701',
    name: 'Pippin',
    dob: '2026-10-15',
    damId: 'a-calf',
  });
  const goat = makeAnimal({
    id: 'g-1',
    species: 'goat',
    tagNumber: 'GT-101',
    name: 'Nanny',
    dob: '2023-01-01',
  });

  const herd: Livestock[] = [
    ggSire,
    pGrandsire,
    pGranddam,
    mGrandsire,
    mGranddam,
    sire,
    dam,
    focal,
    fullSib,
    halfSib,
    mate,
    outcross,
    calf,
    grandCalf,
    goat,
  ];

  const records: ProductRecord[] = [
    {
      id: 'pr-1',
      livestockId: 'a-focal',
      date: '2026-11-10',
      yieldAmount: 22,
      qualityNotes: null,
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: 'pr-2',
      livestockId: 'a-dam',
      date: '2026-11-10',
      yieldAmount: 18,
      qualityNotes: null,
      createdAt: 1,
      updatedAt: 1,
    },
  ];

  it('builds multi-generation pedigree, siblings, co-parents, and progeny', () => {
    const tree = buildAnimalPedigree('a-focal', herd, records);
    expect(tree).not.toBeNull();
    expect(tree?.sire?.animal.id).toBe('a-sire');
    expect(tree?.dam?.animal.id).toBe('a-dam');
    expect(tree?.paternalGrandsire?.animal.id).toBe('a-pgs');
    expect(tree?.paternalGranddam?.animal.id).toBe('a-pgd');
    expect(tree?.maternalGrandsire?.animal.id).toBe('a-mgs');
    expect(tree?.maternalGranddam?.animal.id).toBe('a-mgd');
    expect(tree?.greatGrandparents.map((g) => g.animal.animal.id)).toEqual([
      'a-ggs',
    ]);
    expect(tree?.fullSiblings.map((n) => n.animal.id)).toEqual(['a-full-sib']);
    expect(tree?.halfSiblings).toHaveLength(1);
    expect(tree?.halfSiblings[0]?.sharedParentRole).toBe('Sire');
    expect(tree?.halfSiblings[0]?.animal.animal.id).toBe('a-half-sib');
    expect(tree?.directOffspring.map((n) => n.animal.id)).toEqual(['a-calf']);
    expect(tree?.grandOffspring.map((g) => g.animal.animal.id)).toEqual([
      'a-grandcalf',
    ]);
    expect(tree?.coParents[0]?.partner.animal.id).toBe('a-mate');
    expect(tree?.ancestorGenerationDepth).toBe(3);
    expect(tree?.descendantGenerationDepth).toBe(2);
    expect(tree?.totalAncestorsCount).toBe(7);
    expect(tree?.totalDescendantsCount).toBe(2);
    expect(tree?.focal.totalMilkLiters).toBe(22);
  });

  it('prevents lineage cycles and cross-species/self-parenting errors', () => {
    const badCreate = validateNewLivestock({
      tagNumber: 'COW-999',
      sireId: 'a-sire',
      damId: 'a-sire',
    });
    expect(badCreate.ok).toBe(false);
    expect(badCreate.errors.damId).toBeDefined();

    const selfUpdate = validateUpdateLivestock(
      { sireId: 'a-focal' },
      { currentId: 'a-focal' }
    );
    expect(selfUpdate.ok).toBe(false);
    expect(selfUpdate.errors.sireId).toContain('own sire');

    const candidates = getEligibleParentCandidates('a-focal', 'sire', herd);
    const candidateIds = candidates.map((c) => c.id);
    // Excludes self, direct offspring, grand-offspring, and other species (goat)
    expect(candidateIds).not.toContain('a-focal');
    expect(candidateIds).not.toContain('a-calf');
    expect(candidateIds).not.toContain('a-grandcalf');
    expect(candidateIds).not.toContain('g-1');
    expect(candidateIds).toContain('a-sire');
  });

  it('computes connected herd dynasties and breeding compatibility kinship', () => {
    const overview = buildHerdLineageOverview(herd, records);
    expect(overview.linkedAnimalsCount).toBe(14);
    expect(overview.parentChildBondsCount).toBe(14);
    expect(overview.dynastyCount).toBe(1);
    expect(overview.maxGenerationDepth).toBe(6);
    expect(overview.dynasties[0]?.totalMilkLiters).toBe(40);
    expect(overview.topFoundationParent?.animal.id).toBe('a-sire');

    const siblingsReport = analyzeBreedingPair('a-focal', 'a-full-sib', herd, records);
    expect(siblingsReport?.riskLevel).toBe('high');
    expect(siblingsReport?.relationshipLabel).toBe('Full Siblings');
    expect(siblingsReport?.relationshipPercent).toBe(50);

    const safeOutcrossReport = analyzeBreedingPair('a-focal', 'a-mate', herd, records);
    expect(safeOutcrossReport?.riskLevel).toBe('safe');
    expect(safeOutcrossReport?.relationshipPercent).toBe(0);
  });
});
