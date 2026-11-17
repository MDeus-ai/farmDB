import { roundAmount } from './analytics';
import type { Livestock, ProductRecord, Species } from './types';

export interface LineageAnimalNode {
  animal: Livestock;
  totalMilkLiters: number;
  averageMilkLiters: number;
  recordCount: number;
  offspringCount: number;
  sireId: string | null;
  damId: string | null;
  generationLabel: string;
}

export interface GreatGrandparentEntry {
  role: string;
  animal: LineageAnimalNode;
}

export interface GrandOffspringEntry {
  parent: LineageAnimalNode;
  animal: LineageAnimalNode;
}

export interface HalfSiblingEntry {
  sharedParentRole: 'Sire' | 'Dam';
  sharedParent: LineageAnimalNode;
  animal: LineageAnimalNode;
}

export interface CoParentEntry {
  partner: LineageAnimalNode;
  sharedOffspring: LineageAnimalNode[];
}

export interface PedigreeTree {
  focal: LineageAnimalNode;
  sire: LineageAnimalNode | null;
  dam: LineageAnimalNode | null;
  paternalGrandsire: LineageAnimalNode | null;
  paternalGranddam: LineageAnimalNode | null;
  maternalGrandsire: LineageAnimalNode | null;
  maternalGranddam: LineageAnimalNode | null;
  greatGrandparents: GreatGrandparentEntry[];
  directOffspring: LineageAnimalNode[];
  grandOffspring: GrandOffspringEntry[];
  fullSiblings: LineageAnimalNode[];
  halfSiblings: HalfSiblingEntry[];
  coParents: CoParentEntry[];
  ancestorGenerationDepth: number;
  descendantGenerationDepth: number;
  totalAncestorsCount: number;
  totalDescendantsCount: number;
}

export interface DynastyGenerationLayer {
  depth: number;
  label: string;
  members: LineageAnimalNode[];
}

export interface DynastyEdge {
  parentId: string;
  childId: string;
  role: 'sire' | 'dam';
}

export interface HerdDynastyCluster {
  id: string;
  name: string;
  species: Species | 'mixed';
  founderAnimals: LineageAnimalNode[];
  members: LineageAnimalNode[];
  generations: DynastyGenerationLayer[];
  generationSpan: number;
  activeCount: number;
  totalMilkLiters: number;
  parentChildEdges: DynastyEdge[];
}

export interface HerdLineageOverview {
  linkedAnimalsCount: number;
  parentChildBondsCount: number;
  dynastyCount: number;
  maxGenerationDepth: number;
  topFoundationParent: LineageAnimalNode | null;
  dynasties: HerdDynastyCluster[];
}

export type BreedingRiskLevel = 'safe' | 'caution' | 'high';

export interface BreedingCompatibilityReport {
  animalA: LineageAnimalNode;
  animalB: LineageAnimalNode;
  relationshipLabel: string;
  riskLevel: BreedingRiskLevel;
  sharedAncestors: LineageAnimalNode[];
  relationshipCoefficient: number;
  relationshipPercent: number;
  summary: string;
}

interface AnimalIndexData {
  byId: Map<string, Livestock>;
  childrenByParentId: Map<string, Livestock[]>;
  milkStatsByAnimalId: Map<string, { total: number; count: number; avg: number }>;
}

function compareAnimalOrder(a: Livestock, b: Livestock): number {
  const dobA = a.dob ?? '9999-99-99';
  const dobB = b.dob ?? '9999-99-99';
  if (dobA !== dobB) {
    return dobA.localeCompare(dobB);
  }
  return a.tagNumber.localeCompare(b.tagNumber);
}

function buildAnimalIndex(
  livestock: readonly Livestock[],
  productRecords: readonly ProductRecord[]
): AnimalIndexData {
  const byId = new Map<string, Livestock>();
  for (const item of livestock) {
    byId.set(item.id, item);
  }

  const childrenMap = new Map<string, Map<string, Livestock>>();
  for (const item of livestock) {
    if (item.sireId && byId.has(item.sireId) && item.sireId !== item.id) {
      let bucket = childrenMap.get(item.sireId);
      if (!bucket) {
        bucket = new Map();
        childrenMap.set(item.sireId, bucket);
      }
      bucket.set(item.id, item);
    }
    if (
      item.damId &&
      byId.has(item.damId) &&
      item.damId !== item.id &&
      item.damId !== item.sireId
    ) {
      let bucket = childrenMap.get(item.damId);
      if (!bucket) {
        bucket = new Map();
        childrenMap.set(item.damId, bucket);
      }
      bucket.set(item.id, item);
    }
  }

  const childrenByParentId = new Map<string, Livestock[]>();
  for (const [parentId, childBucket] of childrenMap.entries()) {
    childrenByParentId.set(
      parentId,
      Array.from(childBucket.values()).sort(compareAnimalOrder)
    );
  }

  const rawMilk = new Map<string, { total: number; count: number }>();
  for (const rec of productRecords) {
    const prev = rawMilk.get(rec.livestockId) ?? { total: 0, count: 0 };
    prev.total += rec.yieldAmount;
    prev.count += 1;
    rawMilk.set(rec.livestockId, prev);
  }

  const milkStatsByAnimalId = new Map<
    string,
    { total: number; count: number; avg: number }
  >();
  for (const [animalId, stats] of rawMilk.entries()) {
    milkStatsByAnimalId.set(animalId, {
      total: roundAmount(stats.total),
      count: stats.count,
      avg: stats.count > 0 ? roundAmount(stats.total / stats.count) : 0,
    });
  }

  return { byId, childrenByParentId, milkStatsByAnimalId };
}

function getValidParent(
  child: Livestock,
  role: 'sire' | 'dam',
  byId: Map<string, Livestock>
): Livestock | null {
  const parentId = role === 'sire' ? child.sireId : child.damId;
  if (!parentId || parentId === child.id) {
    return null;
  }
  return byId.get(parentId) ?? null;
}

function computeAncestorDepth(
  animalId: string,
  byId: Map<string, Livestock>,
  visiting: Set<string> = new Set()
): number {
  if (visiting.has(animalId)) return 0;
  const animal = byId.get(animalId);
  if (!animal) return 0;

  const sire = getValidParent(animal, 'sire', byId);
  const dam = getValidParent(animal, 'dam', byId);
  if (!sire && !dam) return 0;

  visiting.add(animalId);
  const sireDepth = sire ? 1 + computeAncestorDepth(sire.id, byId, visiting) : 0;
  const damDepth = dam ? 1 + computeAncestorDepth(dam.id, byId, visiting) : 0;
  visiting.delete(animalId);

  return Math.max(sireDepth, damDepth);
}

function computeDescendantDepth(
  animalId: string,
  childrenByParentId: Map<string, Livestock[]>,
  visiting: Set<string> = new Set()
): number {
  if (visiting.has(animalId)) return 0;
  const children = childrenByParentId.get(animalId) ?? [];
  if (children.length === 0) return 0;

  visiting.add(animalId);
  let maxDepth = 0;
  for (const child of children) {
    const childDepth = 1 + computeDescendantDepth(child.id, childrenByParentId, visiting);
    if (childDepth > maxDepth) {
      maxDepth = childDepth;
    }
  }
  visiting.delete(animalId);
  return maxDepth;
}

function makeNode(
  animal: Livestock,
  index: AnimalIndexData,
  generationLabel?: string
): LineageAnimalNode {
  const milk = index.milkStatsByAnimalId.get(animal.id) ?? {
    total: 0,
    count: 0,
    avg: 0,
  };
  const offspringCount = (index.childrenByParentId.get(animal.id) ?? []).length;
  const computedDepth = computeAncestorDepth(animal.id, index.byId) + 1;
  return {
    animal,
    totalMilkLiters: milk.total,
    averageMilkLiters: milk.avg,
    recordCount: milk.count,
    offspringCount,
    sireId:
      animal.sireId && index.byId.has(animal.sireId) && animal.sireId !== animal.id
        ? animal.sireId
        : null,
    damId:
      animal.damId && index.byId.has(animal.damId) && animal.damId !== animal.id
        ? animal.damId
        : null,
    generationLabel: generationLabel ?? `Gen ${computedDepth}`,
  };
}

function collectAllAncestors(
  rootId: string,
  byId: Map<string, Livestock>
): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [];
  const root = byId.get(rootId);
  if (!root) return visited;

  const sire = getValidParent(root, 'sire', byId);
  const dam = getValidParent(root, 'dam', byId);
  if (sire) queue.push(sire.id);
  if (dam) queue.push(dam.id);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (currentId === rootId || visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);
    const current = byId.get(currentId);
    if (!current) continue;
    const nextSire = getValidParent(current, 'sire', byId);
    const nextDam = getValidParent(current, 'dam', byId);
    if (nextSire && !visited.has(nextSire.id)) queue.push(nextSire.id);
    if (nextDam && !visited.has(nextDam.id)) queue.push(nextDam.id);
  }
  return visited;
}

function collectAllDescendants(
  rootId: string,
  childrenByParentId: Map<string, Livestock[]>
): Set<string> {
  const visited = new Set<string>();
  const queue: Livestock[] = [...(childrenByParentId.get(rootId) ?? [])];

  while (queue.length > 0) {
    const child = queue.shift()!;
    if (child.id === rootId || visited.has(child.id)) {
      continue;
    }
    visited.add(child.id);
    const nextChildren = childrenByParentId.get(child.id) ?? [];
    for (const next of nextChildren) {
      if (!visited.has(next.id)) {
        queue.push(next);
      }
    }
  }
  return visited;
}

/**
 * Returns valid candidate parents for an animal, excluding itself, any of its
 * descendants (to prevent cycles), and sorting same-species active animals first.
 */
export function getEligibleParentCandidates(
  focalId: string | null,
  candidateRole: 'sire' | 'dam',
  livestock: readonly Livestock[],
  excludedOtherParentId?: string | null
): Livestock[] {
  const index = buildAnimalIndex(livestock, []);
  const focal = focalId ? index.byId.get(focalId) ?? null : null;
  const descendants = focalId
    ? collectAllDescendants(focalId, index.childrenByParentId)
    : new Set<string>();

  const candidates = livestock.filter((candidate) => {
    if (focalId && candidate.id === focalId) {
      return false;
    }
    if (descendants.has(candidate.id)) {
      return false;
    }
    if (excludedOtherParentId && candidate.id === excludedOtherParentId) {
      return false;
    }
    // Keep same species when focal has a known species, unless candidate matches role naturally
    if (focal && candidate.species !== focal.species) {
      return false;
    }
    return true;
  });

  return candidates.sort((a, b) => {
    // Active first, then earlier birthdates (more likely to be parents)
    const aActive = a.status === 'active' ? 0 : 1;
    const bActive = b.status === 'active' ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    // Slight preference if candidate already acts as that role
    const aRoleCount = livestock.filter((item) =>
      candidateRole === 'sire' ? item.sireId === a.id : item.damId === a.id
    ).length;
    const bRoleCount = livestock.filter((item) =>
      candidateRole === 'sire' ? item.sireId === b.id : item.damId === b.id
    ).length;
    if (aRoleCount !== bRoleCount) return bRoleCount - aRoleCount;
    return compareAnimalOrder(a, b);
  });
}

export function buildAnimalPedigree(
  focalId: string,
  livestock: readonly Livestock[],
  productRecords: readonly ProductRecord[]
): PedigreeTree | null {
  const index = buildAnimalIndex(livestock, productRecords);
  const focalRaw = index.byId.get(focalId);
  if (!focalRaw) {
    return null;
  }

  const focal = makeNode(focalRaw, index, 'Focal Animal');

  const sireRaw = getValidParent(focalRaw, 'sire', index.byId);
  const damRaw = getValidParent(focalRaw, 'dam', index.byId);
  const sire = sireRaw ? makeNode(sireRaw, index, 'Sire (Father)') : null;
  const dam = damRaw ? makeNode(damRaw, index, 'Dam (Mother)') : null;

  const patGsRaw =
    sireRaw && sireRaw.id !== focalRaw.id
      ? getValidParent(sireRaw, 'sire', index.byId)
      : null;
  const patGdRaw =
    sireRaw && sireRaw.id !== focalRaw.id
      ? getValidParent(sireRaw, 'dam', index.byId)
      : null;
  const matGsRaw =
    damRaw && damRaw.id !== focalRaw.id
      ? getValidParent(damRaw, 'sire', index.byId)
      : null;
  const matGdRaw =
    damRaw && damRaw.id !== focalRaw.id
      ? getValidParent(damRaw, 'dam', index.byId)
      : null;

  const paternalGrandsire =
    patGsRaw && patGsRaw.id !== focalRaw.id
      ? makeNode(patGsRaw, index, 'Paternal Grandsire')
      : null;
  const paternalGranddam =
    patGdRaw && patGdRaw.id !== focalRaw.id
      ? makeNode(patGdRaw, index, 'Paternal Granddam')
      : null;
  const maternalGrandsire =
    matGsRaw && matGsRaw.id !== focalRaw.id
      ? makeNode(matGsRaw, index, 'Maternal Grandsire')
      : null;
  const maternalGranddam =
    matGdRaw && matGdRaw.id !== focalRaw.id
      ? makeNode(matGdRaw, index, 'Maternal Granddam')
      : null;

  const greatGrandparents: GreatGrandparentEntry[] = [];
  const gpPairs: Array<{ label: string; gp: Livestock | null }> = [
    { label: "Sire's Paternal", gp: patGsRaw },
    { label: "Sire's Maternal", gp: patGdRaw },
    { label: "Dam's Paternal", gp: matGsRaw },
    { label: "Dam's Maternal", gp: matGdRaw },
  ];
  const seenGgpIds = new Set<string>([focalRaw.id]);
  for (const { label, gp } of gpPairs) {
    if (!gp) continue;
    const ggSire = getValidParent(gp, 'sire', index.byId);
    const ggDam = getValidParent(gp, 'dam', index.byId);
    if (ggSire && !seenGgpIds.has(ggSire.id)) {
      seenGgpIds.add(ggSire.id);
      greatGrandparents.push({
        role: `${label} Grandsire`,
        animal: makeNode(ggSire, index, 'Great-Grandsire'),
      });
    }
    if (ggDam && !seenGgpIds.has(ggDam.id)) {
      seenGgpIds.add(ggDam.id);
      greatGrandparents.push({
        role: `${label} Granddam`,
        animal: makeNode(ggDam, index, 'Great-Granddam'),
      });
    }
  }

  const directChildrenRaw = index.childrenByParentId.get(focalRaw.id) ?? [];
  const directOffspring = directChildrenRaw.map((child) =>
    makeNode(child, index, 'Offspring (Gen +1)')
  );

  const grandOffspring: GrandOffspringEntry[] = [];
  const seenGrandChild = new Set<string>([focalRaw.id]);
  for (const childNode of directOffspring) {
    const grandchildrenRaw = index.childrenByParentId.get(childNode.animal.id) ?? [];
    for (const gc of grandchildrenRaw) {
      if (seenGrandChild.has(gc.id)) continue;
      seenGrandChild.add(gc.id);
      grandOffspring.push({
        parent: childNode,
        animal: makeNode(gc, index, 'Grand-Offspring (Gen +2)'),
      });
    }
  }

  // Full & half siblings
  const fullSiblings: LineageAnimalNode[] = [];
  const halfSiblings: HalfSiblingEntry[] = [];
  const focalSireId = focal.sireId;
  const focalDamId = focal.damId;

  if (focalSireId || focalDamId) {
    const sortedAll = [...livestock].sort(compareAnimalOrder);
    for (const candidate of sortedAll) {
      if (candidate.id === focalRaw.id) continue;
      const candSireId =
        candidate.sireId && index.byId.has(candidate.sireId)
          ? candidate.sireId
          : null;
      const candDamId =
        candidate.damId && index.byId.has(candidate.damId)
          ? candidate.damId
          : null;

      const sharesSire = Boolean(focalSireId && candSireId === focalSireId);
      const sharesDam = Boolean(focalDamId && candDamId === focalDamId);

      if (sharesSire && sharesDam) {
        fullSiblings.push(makeNode(candidate, index, 'Full Sibling'));
      } else if (sharesSire && sire) {
        halfSiblings.push({
          sharedParentRole: 'Sire',
          sharedParent: sire,
          animal: makeNode(candidate, index, 'Half-Sibling (Paternal)'),
        });
      } else if (sharesDam && dam) {
        halfSiblings.push({
          sharedParentRole: 'Dam',
          sharedParent: dam,
          animal: makeNode(candidate, index, 'Half-Sibling (Maternal)'),
        });
      }
    }
  }

  // Co-parents (mates who share at least one offspring with focal)
  const coParentBuckets = new Map<string, LineageAnimalNode[]>();
  for (const childNode of directOffspring) {
    const otherParentId =
      childNode.sireId === focalRaw.id
        ? childNode.damId
        : childNode.damId === focalRaw.id
          ? childNode.sireId
          : null;
    if (otherParentId && otherParentId !== focalRaw.id && index.byId.has(otherParentId)) {
      const bucket = coParentBuckets.get(otherParentId) ?? [];
      bucket.push(childNode);
      coParentBuckets.set(otherParentId, bucket);
    }
  }
  const coParents: CoParentEntry[] = [];
  for (const [partnerId, sharedOffspring] of coParentBuckets.entries()) {
    const partnerRaw = index.byId.get(partnerId);
    if (partnerRaw) {
      coParents.push({
        partner: makeNode(partnerRaw, index, 'Co-Parent / Mate'),
        sharedOffspring,
      });
    }
  }
  coParents.sort((a, b) => compareAnimalOrder(a.partner.animal, b.partner.animal));

  const allAncestors = collectAllAncestors(focalRaw.id, index.byId);
  const allDescendants = collectAllDescendants(
    focalRaw.id,
    index.childrenByParentId
  );

  return {
    focal,
    sire,
    dam,
    paternalGrandsire,
    paternalGranddam,
    maternalGrandsire,
    maternalGranddam,
    greatGrandparents,
    directOffspring,
    grandOffspring,
    fullSiblings,
    halfSiblings,
    coParents,
    ancestorGenerationDepth: computeAncestorDepth(focalRaw.id, index.byId),
    descendantGenerationDepth: computeDescendantDepth(
      focalRaw.id,
      index.childrenByParentId
    ),
    totalAncestorsCount: allAncestors.size,
    totalDescendantsCount: allDescendants.size,
  };
}

export function buildHerdLineageOverview(
  livestock: readonly Livestock[],
  productRecords: readonly ProductRecord[]
): HerdLineageOverview {
  const index = buildAnimalIndex(livestock, productRecords);

  // Undirected adjacency between connected parents and children
  const neighbors = new Map<string, Set<string>>();
  for (const animal of livestock) {
    neighbors.set(animal.id, new Set());
  }

  let parentChildBondsCount = 0;
  for (const animal of livestock) {
    const sire = getValidParent(animal, 'sire', index.byId);
    const dam = getValidParent(animal, 'dam', index.byId);
    if (sire) {
      parentChildBondsCount += 1;
      neighbors.get(animal.id)?.add(sire.id);
      neighbors.get(sire.id)?.add(animal.id);
    }
    if (dam && dam.id !== sire?.id) {
      parentChildBondsCount += 1;
      neighbors.get(animal.id)?.add(dam.id);
      neighbors.get(dam.id)?.add(animal.id);
    }
  }

  const visited = new Set<string>();
  const dynasties: HerdDynastyCluster[] = [];
  const linkedAnimalIds = new Set<string>();
  let maxGenerationDepth = livestock.length > 0 ? 1 : 0;

  for (const animal of livestock) {
    if (visited.has(animal.id)) continue;

    // BFS connected component
    const component: Livestock[] = [];
    const queue: Livestock[] = [animal];
    visited.add(animal.id);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      component.push(curr);
      for (const nextId of neighbors.get(curr.id) ?? []) {
        if (!visited.has(nextId)) {
          visited.add(nextId);
          const nextAnimal = index.byId.get(nextId);
          if (nextAnimal) {
            queue.push(nextAnimal);
          }
        }
      }
    }

    // Only treat connected groups of >= 2 animals as a family dynasty cluster
    if (component.length < 2) {
      continue;
    }

    for (const member of component) {
      linkedAnimalIds.add(member.id);
    }

    const componentIdSet = new Set(component.map((m) => m.id));
    const depthById = new Map<string, number>();

    // Calculate relative generation depth within the component starting from founders
    const founderRaws = component
      .filter((m) => {
        const hasSire = Boolean(m.sireId && componentIdSet.has(m.sireId));
        const hasDam = Boolean(m.damId && componentIdSet.has(m.damId));
        return !hasSire && !hasDam;
      })
      .sort(compareAnimalOrder);

    for (const founder of founderRaws) {
      depthById.set(founder.id, 1);
    }

    // Iteratively assign max(parent depth) + 1 bounded by component size
    for (let pass = 0; pass < component.length; pass += 1) {
      let changed = false;
      for (const m of component) {
        const sireDepth =
          m.sireId && componentIdSet.has(m.sireId)
            ? depthById.get(m.sireId) ?? 1
            : 0;
        const damDepth =
          m.damId && componentIdSet.has(m.damId)
            ? depthById.get(m.damId) ?? 1
            : 0;
        const nextDepth =
          sireDepth === 0 && damDepth === 0 ? 1 : Math.max(sireDepth, damDepth) + 1;
        if (depthById.get(m.id) !== nextDepth) {
          depthById.set(m.id, nextDepth);
          changed = true;
        }
      }
      if (!changed) break;
    }

    let maxCompDepth = 1;
    const layersMap = new Map<number, LineageAnimalNode[]>();
    const edges: DynastyEdge[] = [];
    let totalMilkLiters = 0;
    let activeCount = 0;

    const sortedComponent = [...component].sort((a, b) => {
      const da = depthById.get(a.id) ?? 1;
      const db = depthById.get(b.id) ?? 1;
      if (da !== db) return da - db;
      return compareAnimalOrder(a, b);
    });

    const memberNodes: LineageAnimalNode[] = [];
    for (const m of sortedComponent) {
      const genDepth = depthById.get(m.id) ?? 1;
      if (genDepth > maxCompDepth) maxCompDepth = genDepth;
      if (genDepth > maxGenerationDepth) maxGenerationDepth = genDepth;

      const node = makeNode(
        m,
        index,
        genDepth === 1 ? 'Foundation (Gen 1)' : `Gen ${genDepth}`
      );
      memberNodes.push(node);
      totalMilkLiters += node.totalMilkLiters;
      if (m.status === 'active') activeCount += 1;

      const bucket = layersMap.get(genDepth) ?? [];
      bucket.push(node);
      layersMap.set(genDepth, bucket);

      if (m.sireId && componentIdSet.has(m.sireId)) {
        edges.push({ parentId: m.sireId, childId: m.id, role: 'sire' });
      }
      if (m.damId && componentIdSet.has(m.damId) && m.damId !== m.sireId) {
        edges.push({ parentId: m.damId, childId: m.id, role: 'dam' });
      }
    }

    const generations: DynastyGenerationLayer[] = Array.from(layersMap.entries())
      .sort(([d1], [d2]) => d1 - d2)
      .map(([depth, members]) => ({
        depth,
        label: depth === 1 ? 'Generation 1 (Founders)' : `Generation ${depth}`,
        members,
      }));

    const founderNodes = founderRaws.map((f) =>
      makeNode(f, index, 'Foundation (Gen 1)')
    );
    const primaryFounder = founderNodes[0] ?? memberNodes[0]!;
    const speciesSet = new Set(component.map((m) => m.species));
    const species = speciesSet.size === 1 ? component[0]!.species : 'mixed';

    const lineTitle =
      primaryFounder.animal.name?.trim() || primaryFounder.animal.tagNumber;

    dynasties.push({
      id: `dynasty-${primaryFounder.animal.id}`,
      name: `${lineTitle} Bloodline`,
      species,
      founderAnimals: founderNodes.length > 0 ? founderNodes : [memberNodes[0]!],
      members: memberNodes,
      generations,
      generationSpan: maxCompDepth,
      activeCount,
      totalMilkLiters: roundAmount(totalMilkLiters),
      parentChildEdges: edges,
    });
  }

  dynasties.sort(
    (a, b) =>
      b.members.length - a.members.length ||
      b.generationSpan - a.generationSpan ||
      a.name.localeCompare(b.name)
  );

  // Top parent across entire herd by direct offspring count (then total milk)
  let topFoundationParent: LineageAnimalNode | null = null;
  let bestOffspring = 0;
  for (const animal of livestock) {
    const childCount = (index.childrenByParentId.get(animal.id) ?? []).length;
    if (childCount === 0) continue;
    if (childCount > bestOffspring) {
      bestOffspring = childCount;
      topFoundationParent = makeNode(animal, index);
    } else if (childCount === bestOffspring && topFoundationParent) {
      const candidateNode = makeNode(animal, index);
      if (candidateNode.totalMilkLiters > topFoundationParent.totalMilkLiters) {
        topFoundationParent = candidateNode;
      }
    }
  }

  return {
    linkedAnimalsCount: linkedAnimalIds.size,
    parentChildBondsCount,
    dynastyCount: dynasties.length,
    maxGenerationDepth: dynasties.length > 0 ? maxGenerationDepth : 0,
    topFoundationParent,
    dynasties,
  };
}

function collectAncestorPaths(
  startId: string,
  byId: Map<string, Livestock>,
  maxDepth = 4
): Map<string, string[][]> {
  const result = new Map<string, string[][]>();

  function dfs(currentId: string, path: string[]) {
    const prev = result.get(currentId) ?? [];
    prev.push(path);
    result.set(currentId, prev);

    if (path.length - 1 >= maxDepth) {
      return;
    }

    const current = byId.get(currentId);
    if (!current) return;

    const sire = getValidParent(current, 'sire', byId);
    const dam = getValidParent(current, 'dam', byId);
    if (sire && !path.includes(sire.id)) {
      dfs(sire.id, [...path, sire.id]);
    }
    if (dam && dam.id !== sire?.id && !path.includes(dam.id)) {
      dfs(dam.id, [...path, dam.id]);
    }
  }

  if (byId.has(startId)) {
    dfs(startId, [startId]);
  }
  return result;
}

function pathsIntersectOnlyAtTerminal(
  pathA: readonly string[],
  pathB: readonly string[],
  commonId: string
): boolean {
  const internalA = new Set(pathA.slice(0, -1));
  const internalB = new Set(pathB.slice(0, -1));
  if (internalA.has(commonId) || internalB.has(commonId)) {
    return false;
  }
  for (const id of internalA) {
    if (internalB.has(id)) {
      return false;
    }
  }
  return true;
}

export function analyzeBreedingPair(
  animalAId: string,
  animalBId: string,
  livestock: readonly Livestock[],
  productRecords: readonly ProductRecord[]
): BreedingCompatibilityReport | null {
  const index = buildAnimalIndex(livestock, productRecords);
  const rawA = index.byId.get(animalAId);
  const rawB = index.byId.get(animalBId);
  if (!rawA || !rawB) {
    return null;
  }

  const nodeA = makeNode(rawA, index);
  const nodeB = makeNode(rawB, index);

  if (animalAId === animalBId) {
    return {
      animalA: nodeA,
      animalB: nodeB,
      relationshipLabel: 'Same Animal Selected',
      riskLevel: 'high',
      sharedAncestors: [nodeA],
      relationshipCoefficient: 1,
      relationshipPercent: 100,
      summary: 'Select two distinct animals to evaluate outcross compatibility.',
    };
  }

  const pathsA = collectAncestorPaths(animalAId, index.byId, 4);
  const pathsB = collectAncestorPaths(animalBId, index.byId, 4);

  const sharedIds: string[] = [];
  let relationshipCoefficient = 0;

  for (const [ancestorId, listA] of pathsA.entries()) {
    const listB = pathsB.get(ancestorId);
    if (!listB) continue;

    let contributed = false;
    for (const pA of listA) {
      for (const pB of listB) {
        if (pathsIntersectOnlyAtTerminal(pA, pB, ancestorId)) {
          const steps = pA.length - 1 + (pB.length - 1);
          relationshipCoefficient += Math.pow(0.5, steps);
          contributed = true;
        }
      }
    }
    if (contributed) {
      sharedIds.push(ancestorId);
    }
  }

  relationshipCoefficient = Math.min(1, roundAmount(relationshipCoefficient * 100) / 100);
  const relationshipPercent = roundAmount(relationshipCoefficient * 100);

  const sharedAncestors = sharedIds
    .filter((id) => id !== animalAId && id !== animalBId)
    .map((id) => index.byId.get(id))
    .filter((a): a is Livestock => Boolean(a))
    .sort(compareAnimalOrder)
    .map((a) => makeNode(a, index, 'Common Ancestor'));

  const isParentChild = rawA.sireId === rawB.id || rawA.damId === rawB.id ||
    rawB.sireId === rawA.id || rawB.damId === rawA.id;
  const shareSire = Boolean(nodeA.sireId && nodeA.sireId === nodeB.sireId);
  const shareDam = Boolean(nodeA.damId && nodeA.damId === nodeB.damId);

  let relationshipLabel = 'Unrelated (Safe Outcross)';
  let riskLevel: BreedingRiskLevel = 'safe';
  let summary =
    'No shared ancestors found within 4 generations. Suitable for outcrossing to diversify herd genetics.';

  if (isParentChild) {
    relationshipLabel = 'Direct Parent / Offspring';
    riskLevel = 'high';
    summary =
      'Direct parent-to-offspring match carries high inbreeding risk (50% shared genetics). Avoid pairing unless strictly planned.';
  } else if (shareSire && shareDam) {
    relationshipLabel = 'Full Siblings';
    riskLevel = 'high';
    summary =
      'Share both Sire and Dam (50% genetic overlap). Pairing full siblings is strongly discouraged.';
  } else if (pathsB.has(animalAId) || pathsA.has(animalBId)) {
    relationshipLabel = 'Direct Ancestor / Descendant';
    riskLevel = 'high';
    summary =
      'One animal is a direct grandparent or earlier ancestor of the other. High linebreeding concentration.';
  } else if (shareSire || shareDam) {
    relationshipLabel = shareSire ? 'Half-Siblings (Same Sire)' : 'Half-Siblings (Same Dam)';
    riskLevel = 'high';
    summary =
      'Share one common parent (25%+ kinship). Consider an unrelated partner to prevent recessive trait doubling.';
  } else if (relationshipPercent >= 12.5) {
    relationshipLabel = 'Close Relatives / First Cousins';
    riskLevel = 'caution';
    summary = `Estimated ${relationshipPercent}% kinship via ${sharedAncestors.length} shared ancestor(s). Review pedigree before pairing.`;
  } else if (sharedAncestors.length > 0 || relationshipPercent > 0) {
    relationshipLabel = 'Distant Shared Lineage';
    riskLevel = 'caution';
    summary = `Low kinship (${relationshipPercent}%), sharing ${sharedAncestors.length} ancestor(s) in older generations.`;
  }

  return {
    animalA: nodeA,
    animalB: nodeB,
    relationshipLabel,
    riskLevel,
    sharedAncestors,
    relationshipCoefficient,
    relationshipPercent,
    summary,
  };
}
