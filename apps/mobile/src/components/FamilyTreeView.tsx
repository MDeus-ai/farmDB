import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  analyzeBreedingPair,
  buildAnimalPedigree,
  buildHerdLineageOverview,
  formatAnimalAge,
  formatSpeciesLabel,
  formatStatusLabel,
  formatVolume,
  getEligibleParentCandidates,
  SPECIES_LIST,
  type LineageAnimalNode,
  type Livestock,
  type Species,
} from '@farmdb/core';
import {
  useCreateLivestock,
  useLivestockList,
  useProductRecordList,
  useUpdateLivestock,
} from '@farmdb/db';
import { getSpeciesPngSource, MOBILE_APP_ICONS } from '../assets/icons';
import { FARMDB_COLORS, FARMDB_FONTS, useUiScale } from '../theme/uiScale';
import { buildAnimalDropdownOption } from '../utils/animalOptions';
import { AnimalEyeButton } from './AnimalQuickPreviewModal';
import { AppIcon, SpeciesIcon, StatusIcon } from './FarmIcons';
import { FarmScrollView } from './FarmScrollView';
import { MobileFileTabs } from './MobileFileTabs';
import {
  ModernDropdown,
  type ModernDropdownOption,
} from './ModernDropdown';

type MobileTreeTab = 'pedigree' | 'dynasties' | 'kinship';

interface FamilyTreeViewProps {
  initialAnimalId?: string | null;
}

function getAnimalTitle(animal: Livestock): string {
  return animal.name?.trim() || animal.tagNumber;
}

export function FamilyTreeView({ initialAnimalId }: FamilyTreeViewProps) {
  const ui = useUiScale();
  const livestockQuery = useLivestockList({});
  const productQuery = useProductRecordList({});
  const createMutation = useCreateLivestock();
  const updateMutation = useUpdateLivestock();

  const allLivestock = livestockQuery.data ?? [];
  const allProducts = productQuery.data ?? [];

  const [speciesFilter, setSpeciesFilter] = useState<Species | 'all'>('all');
  const [subTab, setSubTab] = useState<MobileTreeTab>('pedigree');
  const [focalId, setFocalId] = useState<string>('');
  const [trailIds, setTrailIds] = useState<string[]>([]);
  const [showLinkEditor, setShowLinkEditor] = useState(false);

  const [draftSireId, setDraftSireId] = useState<string>('');
  const [draftDamId, setDraftDamId] = useState<string>('');
  const [linkStatusMsg, setLinkStatusMsg] = useState<string | null>(null);
  const [linkErrorMsg, setLinkErrorMsg] = useState<string | null>(null);

  const [pairAId, setPairAId] = useState<string>('');
  const [pairBId, setPairBId] = useState<string>('');

  const overview = useMemo(
    () => buildHerdLineageOverview(allLivestock, allProducts),
    [allLivestock, allProducts]
  );

  const filteredLivestock = useMemo(
    () =>
      speciesFilter === 'all'
        ? allLivestock
        : allLivestock.filter((a) => a.species === speciesFilter),
    [allLivestock, speciesFilter]
  );

  useEffect(() => {
    if (initialAnimalId && allLivestock.some((a) => a.id === initialAnimalId)) {
      setFocalId(initialAnimalId);
      setSubTab('pedigree');
    }
  }, [initialAnimalId]);

  useEffect(() => {
    if (focalId && filteredLivestock.some((a) => a.id === focalId)) {
      return;
    }
    const withParents = filteredLivestock.find((a) => a.sireId && a.damId);
    const withAnyLink = filteredLivestock.find(
      (a) =>
        a.sireId ||
        a.damId ||
        filteredLivestock.some((c) => c.sireId === a.id || c.damId === a.id)
    );
    const next = withParents ?? withAnyLink ?? filteredLivestock[0] ?? null;
    setFocalId(next ? next.id : '');
  }, [filteredLivestock, focalId]);

  useEffect(() => {
    if (allLivestock.length === 0) {
      setPairAId('');
      setPairBId('');
      return;
    }
    if (!pairAId || !allLivestock.some((a) => a.id === pairAId)) {
      setPairAId(focalId || allLivestock[0]!.id);
    }
    if (!pairBId || !allLivestock.some((a) => a.id === pairBId)) {
      const other =
        allLivestock.find((a) => a.id !== (focalId || allLivestock[0]!.id)) ??
        allLivestock[0]!;
      setPairBId(other.id);
    }
  }, [allLivestock, focalId, pairAId, pairBId]);

  const pedigree = useMemo(
    () =>
      focalId ? buildAnimalPedigree(focalId, allLivestock, allProducts) : null,
    [focalId, allLivestock, allProducts]
  );

  useEffect(() => {
    if (!pedigree) {
      setDraftSireId('');
      setDraftDamId('');
      return;
    }
    setDraftSireId(pedigree.focal.sireId ?? '');
    setDraftDamId(pedigree.focal.damId ?? '');
    setLinkErrorMsg(null);
  }, [pedigree?.focal.animal.id, pedigree?.focal.sireId, pedigree?.focal.damId]);

  function focusAnimal(nextId: string) {
    if (!nextId) return;
    setTrailIds((prev) => {
      const cleaned = prev.filter((id) => id !== nextId);
      if (focalId && focalId !== nextId && !cleaned.includes(focalId)) {
        cleaned.push(focalId);
      }
      return cleaned.slice(-4);
    });
    setFocalId(nextId);
    setSubTab('pedigree');
    setLinkStatusMsg(null);
    setLinkErrorMsg(null);
  }

  const speciesOptions = useMemo<ModernDropdownOption<Species | 'all'>[]>(
    () => [
      {
        value: 'all',
        label: 'All Species',
        iconSource: MOBILE_APP_ICONS.group,
      },
      ...SPECIES_LIST.map((sp) => ({
        value: sp,
        label: formatSpeciesLabel(sp),
        iconSource: getSpeciesPngSource(sp),
      })),
    ],
    []
  );

  const focalOptions = useMemo<ModernDropdownOption<string>[]>(
    () =>
      filteredLivestock.map((item) =>
        buildAnimalDropdownOption(item, {
          label: `${item.tagNumber}${item.name ? ` · ${item.name}` : ''}`,
        })
      ),
    [filteredLivestock]
  );

  const allAnimalOptions = useMemo<ModernDropdownOption<string>[]>(
    () =>
      allLivestock.map((item) =>
        buildAnimalDropdownOption(item, {
          label: `${item.tagNumber}${item.name ? ` · ${item.name}` : ''}`,
        })
      ),
    [allLivestock]
  );

  const sireOptions = useMemo<ModernDropdownOption<string>[]>(() => {
    if (!pedigree) return [];
    const list = getEligibleParentCandidates(
      pedigree.focal.animal.id,
      'sire',
      allLivestock,
      draftDamId || null
    );
    return [
      { value: '', label: 'Unknown / Founder', iconSource: MOBILE_APP_ICONS.tree },
      ...list.map((item) =>
        buildAnimalDropdownOption(item, {
          label: `${item.tagNumber}${item.name ? ` · ${item.name}` : ''}`,
        })
      ),
    ];
  }, [pedigree, allLivestock, draftDamId]);

  const damOptions = useMemo<ModernDropdownOption<string>[]>(() => {
    if (!pedigree) return [];
    const list = getEligibleParentCandidates(
      pedigree.focal.animal.id,
      'dam',
      allLivestock,
      draftSireId || null
    );
    return [
      { value: '', label: 'Unknown / Founder', iconSource: MOBILE_APP_ICONS.tree },
      ...list.map((item) =>
        buildAnimalDropdownOption(item, {
          label: `${item.tagNumber}${item.name ? ` · ${item.name}` : ''}`,
        })
      ),
    ];
  }, [pedigree, allLivestock, draftSireId]);

  const kinshipReport = useMemo(
    () =>
      pairAId && pairBId
        ? analyzeBreedingPair(pairAId, pairBId, allLivestock, allProducts)
        : null,
    [pairAId, pairBId, allLivestock, allProducts]
  );

  async function handleSaveParents() {
    if (!pedigree) return;
    setLinkErrorMsg(null);
    setLinkStatusMsg(null);
    try {
      await updateMutation.mutateAsync({
        id: pedigree.focal.animal.id,
        input: {
          sireId: draftSireId || null,
          damId: draftDamId || null,
        },
      });
      setLinkStatusMsg('Parent lineage saved to SQLite.');
    } catch (err) {
      setLinkErrorMsg(
        err instanceof Error ? err.message : 'Unable to save parent links.'
      );
    }
  }

  async function handleSeedSampleLineage() {
    setLinkErrorMsg(null);
    setLinkStatusMsg(null);
    const existingByTag = new Map(allLivestock.map((a) => [a.tagNumber, a]));

    async function ensureAnimal(spec: {
      tagNumber: string;
      name: string;
      breed: string;
      dob: string;
      sireTag?: string;
      damTag?: string;
    }): Promise<Livestock> {
      const existing = existingByTag.get(spec.tagNumber);
      const targetSireId = spec.sireTag
        ? (existingByTag.get(spec.sireTag)?.id ?? null)
        : null;
      const targetDamId = spec.damTag
        ? (existingByTag.get(spec.damTag)?.id ?? null)
        : null;

      if (existing) {
        if ((!existing.sireId && targetSireId) || (!existing.damId && targetDamId)) {
          const updated = await updateMutation.mutateAsync({
            id: existing.id,
            input: {
              sireId: existing.sireId ?? targetSireId,
              damId: existing.damId ?? targetDamId,
            },
          });
          existingByTag.set(updated.tagNumber, updated);
          return updated;
        }
        return existing;
      }

      const created = await createMutation.mutateAsync({
        species: 'cow',
        tagNumber: spec.tagNumber,
        name: spec.name,
        breed: spec.breed,
        dob: spec.dob,
        status: 'active',
        sireId: targetSireId,
        damId: targetDamId,
      });
      existingByTag.set(created.tagNumber, created);
      return created;
    }

    await ensureAnimal({
      tagNumber: 'BULL-101',
      name: 'Titan',
      breed: 'Holstein',
      dob: '2019-04-10',
    });
    await ensureAnimal({
      tagNumber: 'COW-318',
      name: 'Willow',
      breed: 'Ayrshire',
      dob: '2020-03-18',
    });
    await ensureAnimal({
      tagNumber: 'BULL-108',
      name: 'Orion',
      breed: 'Jersey',
      dob: '2020-07-12',
    });
    const bessie = await ensureAnimal({
      tagNumber: 'COW-402',
      name: 'Bessie',
      breed: 'Holstein',
      dob: '2022-03-14',
      sireTag: 'BULL-101',
      damTag: 'COW-318',
    });
    await ensureAnimal({
      tagNumber: 'COW-409',
      name: 'Daisy',
      breed: 'Jersey',
      dob: '2022-09-02',
      sireTag: 'BULL-108',
      damTag: 'COW-318',
    });
    await ensureAnimal({
      tagNumber: 'COW-512',
      name: 'Clover',
      breed: 'Holstein',
      dob: '2024-06-21',
      sireTag: 'BULL-108',
      damTag: 'COW-402',
    });

    setFocalId(bessie.id);
    setSubTab('pedigree');
    setLinkStatusMsg('Linked 3-generation sample family tree.');
  }

  function renderCompactNodeCard(
    node: LineageAnimalNode | null,
    roleTitle: string,
    compact = false,
    extraNote?: string
  ) {
    if (!node) {
      return (
        <View
          style={[
            styles.nodeCard,
            styles.nodeCardEmpty,
            { padding: ui.space(compact ? 8 : 10), borderRadius: Math.max(10, ui.radius - 2) },
          ]}
        >
          <Text style={[styles.roleLabel, { fontSize: ui.font(9) }]} numberOfLines={1}>
            {roleTitle}
          </Text>
          <Text style={[styles.emptyNodeText, { fontSize: ui.font(11) }]}>
            Unknown founder
          </Text>
        </View>
      );
    }

    return (
      <Pressable
        style={[
          styles.nodeCard,
          { padding: ui.space(compact ? 8 : 10), borderRadius: Math.max(10, ui.radius - 2) },
        ]}
        onPress={() => focusAnimal(node.animal.id)}
      >
        <View style={[styles.nodeRoleHeader, { flexWrap: 'wrap' }]}>
          <Text style={[styles.roleLabel, { fontSize: ui.font(9) }]} numberOfLines={2}>
            {roleTitle}
          </Text>
          <StatusIcon status={node.animal.status} size={ui.font(12)} />
        </View>

        <View style={[styles.nodeIdentityRow, { flexWrap: compact && ui.isCramped ? 'wrap' : 'nowrap' }]}>
          {!(compact && ui.isCramped) ? (
            node.animal.imageUri ? (
              <Image
                source={{ uri: node.animal.imageUri }}
                style={[
                  styles.nodeAvatar,
                  { width: compact ? 26 : 34, height: compact ? 26 : 34 },
                ]}
              />
            ) : (
              <View
                style={[
                  styles.nodeAvatarEmpty,
                  { width: compact ? 26 : 34, height: compact ? 26 : 34 },
                ]}
              >
                <SpeciesIcon species={node.animal.species} size={compact ? 15 : 20} />
              </View>
            )
          ) : null}

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, flexWrap: 'wrap' }}>
              <Text style={[styles.nodeTag, { fontSize: ui.font(10), flexShrink: 1 }]} numberOfLines={2}>
                {node.animal.tagNumber}
              </Text>
              <AnimalEyeButton livestockId={node.animal.id} size={ui.font(compact ? 11 : 12)} />
            </View>
            <Text style={[styles.nodeName, { fontSize: ui.font(compact ? 12 : 13) }]} numberOfLines={2}>
              {getAnimalTitle(node.animal)}
            </Text>
          </View>
        </View>

        {!compact ? (
          <Text style={[styles.nodeSub, { fontSize: ui.font(10) }]} numberOfLines={2}>
            {node.animal.breed ?? formatSpeciesLabel(node.animal.species)} ·{' '}
            {formatAnimalAge(node.animal.dob)}
          </Text>
        ) : null}

        {extraNote ? (
          <Text style={[styles.nodeExtraNote, { fontSize: ui.font(10) }]} numberOfLines={2}>
            {extraNote}
          </Text>
        ) : null}
      </Pressable>
    );
  }

  return (
    <FarmScrollView
      dockAware
      style={styles.container}
      contentContainerStyle={{
        padding: ui.contentPadding,
        paddingBottom: ui.bottomDockReserve,
        gap: ui.space(12),
      }}
    >
      {/* Hero Banner */}
      <View
        style={[
          styles.heroCard,
          { padding: ui.space(12), borderRadius: ui.radius },
        ]}
      >
        <View style={[styles.heroTopRow, { flexWrap: 'wrap' }]}>
          <View style={styles.heroIconWrap}>
            <AppIcon name="tree" size={ui.font(26)} />
          </View>
          <View style={{ flex: 1, minWidth: 132 }}>
            <Text style={[styles.heroTitle, { fontSize: ui.font(17) }]}>
              Herd Family Tree
            </Text>
          </View>
          {pedigree ? (
            <Pressable
              style={[
                styles.heroEditBtn,
                showLinkEditor && styles.heroEditBtnActive,
                { minHeight: ui.chipHeight, paddingVertical: ui.space(4) },
              ]}
              onPress={() => setShowLinkEditor((prev) => !prev)}
            >
              <AppIcon name="edit" size={ui.font(14)} />
              <Text
                style={[
                  styles.heroEditBtnText,
                  { fontSize: ui.font(11) },
                ]}
              >
                {showLinkEditor ? 'Done' : 'Link'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.kpiGrid, { gap: ui.space(8), marginTop: ui.space(10) }]}>
          <View
            style={[
              styles.kpiBox,
              {
                minWidth: ui.isCramped ? 124 : 74,
                flexBasis: ui.isCramped ? '45%' : undefined,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { fontSize: ui.font(10) }]}>
              In Family Lines
            </Text>
            <Text style={[styles.kpiValue, { fontSize: ui.font(15) }]}>
              {overview.linkedAnimalsCount}/{allLivestock.length}
            </Text>
          </View>
          <View
            style={[
              styles.kpiBox,
              {
                minWidth: ui.isCramped ? 124 : 74,
                flexBasis: ui.isCramped ? '45%' : undefined,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { fontSize: ui.font(10) }]}>
              Parent Bonds
            </Text>
            <Text style={[styles.kpiValue, { fontSize: ui.font(15) }]}>
              {overview.parentChildBondsCount}
            </Text>
          </View>
          <View
            style={[
              styles.kpiBox,
              {
                minWidth: ui.isCramped ? 124 : 74,
                flexBasis: ui.isCramped ? '45%' : undefined,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { fontSize: ui.font(10) }]}>
              Depth
            </Text>
            <Text style={[styles.kpiValue, { fontSize: ui.font(15) }]}>
              {overview.maxGenerationDepth > 0 ? `Gen ${overview.maxGenerationDepth}` : '—'}
            </Text>
          </View>
          <View
            style={[
              styles.kpiBox,
              {
                minWidth: ui.isCramped ? 124 : 74,
                flexBasis: ui.isCramped ? '45%' : undefined,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { fontSize: ui.font(10) }]}>
              Dynasties
            </Text>
            <Text style={[styles.kpiValue, { fontSize: ui.font(15) }]}>
              {overview.dynastyCount}
            </Text>
          </View>
        </View>

        {overview.parentChildBondsCount === 0 ? (
          <Pressable
            style={[
              styles.sampleBannerBtn,
              { minHeight: ui.chipHeight, marginTop: ui.space(10), paddingVertical: ui.space(6) },
            ]}
            onPress={() => void handleSeedSampleLineage()}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            <AppIcon name="tree" size={ui.font(15)} />
            <Text style={[styles.sampleBannerBtnText, { fontSize: ui.font(12), flexShrink: 1, textAlign: 'center' }]}>
              {allLivestock.length === 0
                ? 'Load 3-Generation Sample Herd'
                : 'Link Sample 3-Generation Family Tree'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Filter & Sub-view Tabs */}
      <View style={{ gap: ui.space(8) }}>
        <View style={[styles.dropdownPairRow, { gap: ui.space(8), flexWrap: 'wrap' }]}>
          <View style={{ flex: 0.9, minWidth: ui.isCramped ? 132 : 110 }}>
            <ModernDropdown
              compact
              value={speciesFilter}
              options={speciesOptions}
              title="Filter by Species"
              accessibilityLabel="Filter by Species"
              onChange={setSpeciesFilter}
            />
          </View>
          <View style={{ flex: 1.5, minWidth: ui.isCramped ? 168 : 140 }}>
            <ModernDropdown
              compact
              searchable
              value={focalId}
              options={focalOptions}
              title="Select Focal Animal"
              placeholder="Choose animal..."
              accessibilityLabel="Select Focal Animal"
              onChange={(next) => focusAnimal(next)}
            />
          </View>
        </View>

        <MobileFileTabs
          surfaceTone="page"
          activeId={subTab}
          onChange={setSubTab}
          tabs={[
            { id: 'pedigree', label: 'Pedigree Tree' },
            { id: 'dynasties', label: `Dynasties (${overview.dynastyCount})` },
            { id: 'kinship', label: 'Kinship Check' },
          ]}
        />
      </View>

      {allLivestock.length === 0 ? (
        <View style={[styles.emptyCard, { padding: ui.space(22), borderRadius: ui.radius }]}>
          <AppIcon name="tree" size={ui.font(40)} />
          <Text style={[styles.emptyTitle, { fontSize: ui.font(16) }]}>
            No animals yet
          </Text>
        </View>
      ) : subTab === 'pedigree' ? (
        !pedigree ? (
          <View style={[styles.emptyCard, { padding: ui.space(20), borderRadius: ui.radius }]}>
            <Text style={[styles.emptySub, { fontSize: ui.font(13) }]}>
              No animals match this species filter.
            </Text>
          </View>
        ) : (
          <View style={{ gap: ui.space(12) }}>
            {trailIds.length > 0 ? (
              <FarmScrollView horizontal fillParent={false}>
                <View style={styles.trailRow}>
                  <Text style={[styles.trailLabel, { fontSize: ui.font(11) }]}>
                    History:
                  </Text>
                  {trailIds
                    .map((id) => allLivestock.find((a) => a.id === id))
                    .filter((a): a is Livestock => Boolean(a))
                    .map((item) => (
                      <Pressable
                        key={item.id}
                        style={styles.trailChip}
                        onPress={() => setFocalId(item.id)}
                      >
                        <Text style={[styles.trailChipText, { fontSize: ui.font(11) }]}>
                          {item.tagNumber}
                          {item.name ? ` · ${item.name}` : ''}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              </FarmScrollView>
            ) : null}

            {showLinkEditor ? (
              <View
                style={[
                  styles.editorCard,
                  { padding: ui.space(12), borderRadius: ui.radius, gap: ui.space(8) },
                ]}
              >
                <Text style={[styles.sectionTitle, { fontSize: ui.font(13) }]}>
                  Edit Parents for {pedigree.focal.animal.tagNumber}
                </Text>

                <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>
                  Sire (Father)
                </Text>
                <ModernDropdown
                  searchable
                  value={draftSireId}
                  options={sireOptions}
                  title="Assign Sire"
                  accessibilityLabel="Assign Sire"
                  onChange={setDraftSireId}
                />

                <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>
                  Dam (Mother)
                </Text>
                <ModernDropdown
                  searchable
                  value={draftDamId}
                  options={damOptions}
                  title="Assign Dam"
                  accessibilityLabel="Assign Dam"
                  onChange={setDraftDamId}
                />

                {linkErrorMsg ? (
                  <Text style={[styles.errorText, { fontSize: ui.font(12) }]}>
                    {linkErrorMsg}
                  </Text>
                ) : null}
                {linkStatusMsg ? (
                  <Text style={[styles.successText, { fontSize: ui.font(12) }]}>
                    {linkStatusMsg}
                  </Text>
                ) : null}

                <Pressable
                  style={[
                    styles.saveParentsBtn,
                    { minHeight: ui.controlHeight },
                  ]}
                  onPress={() => void handleSaveParents()}
                  disabled={updateMutation.isPending}
                >
                  <Text style={[styles.saveParentsBtnText, { fontSize: ui.font(13) }]}>
                    {updateMutation.isPending ? 'Saving...' : 'Save Parent Links'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* Visual Vertical Branching Tree Canvas */}
            <View
              style={[
                styles.treeCanvas,
                { padding: ui.space(12), borderRadius: ui.radius },
              ]}
            >
              {/* Gen -2: Grandparents */}
              <Text style={[styles.genHeading, { fontSize: ui.font(10) }]}>
                GEN −2 · GRANDPARENTS
              </Text>
              <View style={[styles.twoColRow, { gap: ui.space(8) }]}>
                <View style={[styles.gpColumn, { gap: ui.space(6) }]}>
                  {renderCompactNodeCard(pedigree.paternalGrandsire, 'Pat. Grandsire', true)}
                  {renderCompactNodeCard(pedigree.paternalGranddam, 'Pat. Granddam', true)}
                </View>
                <View style={[styles.gpColumn, { gap: ui.space(6) }]}>
                  {renderCompactNodeCard(pedigree.maternalGrandsire, 'Mat. Grandsire', true)}
                  {renderCompactNodeCard(pedigree.maternalGranddam, 'Mat. Granddam', true)}
                </View>
              </View>

              {/* Connector Stems Gen -2 -> Gen -1 */}
              <View style={styles.dualStemRow}>
                <View style={styles.singleVerticalStem} />
                <View style={styles.singleVerticalStem} />
              </View>

              {/* Gen -1: Parents */}
              <Text style={[styles.genHeading, { fontSize: ui.font(10) }]}>
                GEN −1 · PARENTS
              </Text>
              <View style={[styles.twoColRow, { gap: ui.space(8) }]}>
                <View style={{ flex: 1 }}>
                  {renderCompactNodeCard(pedigree.sire, 'Sire (Father)')}
                </View>
                <View style={{ flex: 1 }}>
                  {renderCompactNodeCard(pedigree.dam, 'Dam (Mother)')}
                </View>
              </View>

              {/* Merge Bracket Gen -1 -> Gen 0 */}
              <View style={styles.mergeBracketWrap}>
                <View style={styles.mergeU} />
                <View style={styles.mergeDownStem} />
              </View>

              {/* Gen 0: Focal Animal Centerpiece */}
              <View
                style={[
                  styles.focalCard,
                  { padding: ui.space(13), borderRadius: Math.max(12, ui.radius) },
                ]}
              >
                <View style={[styles.focalTopRow, { flexWrap: 'wrap', gap: 6 }]}>
                  <View style={styles.focalGenBadge}>
                    <Text style={[styles.focalGenBadgeText, { fontSize: ui.font(10) }]}>
                      GEN 0 · FOCAL ANIMAL
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <StatusIcon status={pedigree.focal.animal.status} size={ui.font(13)} />
                    <Text style={[styles.focalStatusText, { fontSize: ui.font(11) }]}>
                      {formatStatusLabel(pedigree.focal.animal.status)}
                    </Text>
                  </View>
                </View>

                <View style={[styles.focalIdentityRow, { marginTop: ui.space(8), gap: ui.space(10) }]}>
                  {pedigree.focal.animal.imageUri ? (
                    <Image
                      source={{ uri: pedigree.focal.animal.imageUri }}
                      style={styles.focalAvatar}
                    />
                  ) : (
                    <View style={styles.focalAvatarEmpty}>
                      <SpeciesIcon
                        species={pedigree.focal.animal.species}
                        size={ui.font(28)}
                      />
                    </View>
                  )}

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={[styles.focalTag, { fontSize: ui.font(11) }]}>
                        {pedigree.focal.animal.tagNumber}
                      </Text>
                      <AnimalEyeButton livestockId={pedigree.focal.animal.id} size={ui.font(14)} />
                    </View>
                    <Text
                      style={[styles.focalName, { fontSize: ui.font(17) }]}
                      numberOfLines={2}
                    >
                      {getAnimalTitle(pedigree.focal.animal)}
                    </Text>
                    <Text style={[styles.focalMeta, { fontSize: ui.font(12) }]} numberOfLines={2}>
                      {formatSpeciesLabel(pedigree.focal.animal.species)}
                      {pedigree.focal.animal.breed ? ` · ${pedigree.focal.animal.breed}` : ''} ·{' '}
                      {formatAnimalAge(pedigree.focal.animal.dob)}
                    </Text>
                  </View>
                </View>

                <View style={[styles.focalStatsRow, { marginTop: ui.space(10), gap: ui.space(8) }]}>
                  <View style={styles.focalStatPill}>
                    <Text style={[styles.focalStatText, { fontSize: ui.font(11) }]}>
                      {pedigree.totalAncestorsCount} Ancestor(s)
                    </Text>
                  </View>
                  <View style={styles.focalStatPill}>
                    <Text style={[styles.focalStatText, { fontSize: ui.font(11) }]}>
                      {pedigree.totalDescendantsCount} Descendant(s)
                    </Text>
                  </View>
                  <View style={styles.focalStatPill}>
                    <Text style={[styles.focalStatText, { fontSize: ui.font(11) }]}>
                      {formatVolume(pedigree.focal.totalMilkLiters, ui.settings.volumeUnit)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Downward Progeny Connector */}
              <View style={styles.singleCenterStem} />

              {/* Gen +1 / +2: Offspring */}
              <Text style={[styles.genHeading, { fontSize: ui.font(10) }]}>
                GEN +1 / +2 · PROGENY ({pedigree.directOffspring.length})
              </Text>
              {pedigree.directOffspring.length === 0 ? (
                <View style={[styles.nodeCard, styles.nodeCardEmpty, { padding: ui.space(10) }]}>
                  <Text style={[styles.emptyNodeText, { fontSize: ui.font(12) }]}>
                    No registered offspring yet. Edit any calf&apos;s Sire or Dam to link generations.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: ui.space(8) }}>
                  {pedigree.directOffspring.map((child) => {
                    const otherParentId =
                      child.sireId === pedigree.focal.animal.id
                        ? child.damId
                        : child.sireId;
                    const otherParent = otherParentId
                      ? allLivestock.find((a) => a.id === otherParentId)
                      : null;
                    const grandchildren = pedigree.grandOffspring.filter(
                      (g) => g.parent.animal.id === child.animal.id
                    );

                    return (
                      <View key={child.animal.id} style={{ gap: ui.space(4) }}>
                        {renderCompactNodeCard(
                          child,
                          child.sireId === pedigree.focal.animal.id
                            ? 'Offspring (By Sire)'
                            : 'Offspring (By Dam)',
                          false,
                          otherParent
                            ? `Co-parent: ${otherParent.tagNumber}${otherParent.name ? ` · ${otherParent.name}` : ''}`
                            : undefined
                        )}
                        {grandchildren.map((gc) => (
                          <Pressable
                            key={gc.animal.animal.id}
                            style={[styles.grandchildChip, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }]}
                            onPress={() => focusAnimal(gc.animal.animal.id)}
                          >
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={[styles.grandchildLabel, { fontSize: ui.font(10) }]}>
                                GEN +2 GRAND-OFFSPRING
                              </Text>
                              <Text style={[styles.grandchildName, { fontSize: ui.font(12) }]}>
                                {gc.animal.animal.tagNumber}{' '}
                                {gc.animal.animal.name ? `· ${gc.animal.animal.name}` : ''}
                              </Text>
                            </View>
                            <AnimalEyeButton livestockId={gc.animal.animal.id} size={ui.font(13)} />
                          </Pressable>
                        ))}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Siblings & Co-Parents */}
            <View
              style={[
                styles.card,
                { padding: ui.space(12), borderRadius: ui.radius, gap: ui.space(8) },
              ]}
            >
              <Text style={[styles.sectionTitle, { fontSize: ui.font(14) }]}>
                Siblings &amp; Co-Parents
              </Text>

              {pedigree.fullSiblings.length === 0 &&
                pedigree.halfSiblings.length === 0 &&
                pedigree.coParents.length === 0 ? (
                <Text style={[styles.emptyNodeText, { fontSize: ui.font(12) }]}>
                  No siblings or paired mates recorded for this animal yet.
                </Text>
              ) : (
                <View style={{ gap: ui.space(6) }}>
                  {pedigree.fullSiblings.map((sib) => (
                    <Pressable
                      key={sib.animal.id}
                      style={styles.relativeRow}
                      onPress={() => focusAnimal(sib.animal.id)}
                    >
                      <SpeciesIcon species={sib.animal.species} size={ui.font(18)} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.relativeName, { fontSize: ui.font(13) }]} numberOfLines={2}>
                          {sib.animal.tagNumber} · {getAnimalTitle(sib.animal)}
                        </Text>
                        <Text style={[styles.relativeSub, { fontSize: ui.font(11) }]}>
                          Full Sibling (Same Sire &amp; Dam)
                        </Text>
                      </View>
                      <AnimalEyeButton livestockId={sib.animal.id} size={ui.font(14)} />
                    </Pressable>
                  ))}

                  {pedigree.halfSiblings.map((entry) => (
                    <Pressable
                      key={`${entry.sharedParentRole}-${entry.animal.animal.id}`}
                      style={styles.relativeRow}
                      onPress={() => focusAnimal(entry.animal.animal.id)}
                    >
                      <SpeciesIcon species={entry.animal.animal.species} size={ui.font(18)} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.relativeName, { fontSize: ui.font(13) }]} numberOfLines={2}>
                          {entry.animal.animal.tagNumber} · {getAnimalTitle(entry.animal.animal)}
                        </Text>
                        <Text style={[styles.relativeSub, { fontSize: ui.font(11) }]}>
                          Half-Sibling · Shared {entry.sharedParentRole}:{' '}
                          {getAnimalTitle(entry.sharedParent.animal)}
                        </Text>
                      </View>
                      <AnimalEyeButton livestockId={entry.animal.animal.id} size={ui.font(14)} />
                    </Pressable>
                  ))}

                  {pedigree.coParents.map((cp) => (
                    <Pressable
                      key={cp.partner.animal.id}
                      style={styles.relativeRow}
                      onPress={() => focusAnimal(cp.partner.animal.id)}
                    >
                      <SpeciesIcon species={cp.partner.animal.species} size={ui.font(18)} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.relativeName, { fontSize: ui.font(13) }]} numberOfLines={2}>
                          {cp.partner.animal.tagNumber} · {getAnimalTitle(cp.partner.animal)}
                        </Text>
                        <Text style={[styles.relativeSub, { fontSize: ui.font(11) }]}>
                          Co-Parent · {cp.sharedOffspring.map((c) => c.animal.tagNumber).join(', ')}
                        </Text>
                      </View>
                      <AnimalEyeButton livestockId={cp.partner.animal.id} size={ui.font(14)} />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>
        )
      ) : subTab === 'dynasties' ? (
        overview.dynasties.length === 0 ? (
          <View style={[styles.emptyCard, { padding: ui.space(22), borderRadius: ui.radius }]}>
            <Text style={[styles.emptyTitle, { fontSize: ui.font(15) }]}>
              No connected herd bloodlines yet
            </Text>
          </View>
        ) : (
          <View style={{ gap: ui.space(12) }}>
            {overview.dynasties.map((dynasty) => (
              <View
                key={dynasty.id}
                style={[
                  styles.card,
                  { padding: ui.space(13), borderRadius: ui.radius, gap: ui.space(10) },
                ]}
              >
                <View style={[styles.dynastyHeaderRow, { flexWrap: 'wrap', gap: 8 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    {dynasty.species === 'mixed' ? (
                      <AppIcon name="livestock" size={ui.font(22)} />
                    ) : (
                      <SpeciesIcon species={dynasty.species} size={ui.font(22)} />
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.dynastyTitle, { fontSize: ui.font(15) }]} numberOfLines={2}>
                        {dynasty.name}
                      </Text>
                      <Text style={[styles.dynastyMeta, { fontSize: ui.font(11) }]}>
                        {dynasty.members.length} members · {dynasty.generationSpan} gen ·{' '}
                        {formatVolume(dynasty.totalMilkLiters, ui.settings.volumeUnit)}
                      </Text>
                    </View>
                  </View>
                </View>

                {dynasty.generations.map((layer, idx) => (
                  <View key={layer.depth} style={{ gap: ui.space(6) }}>
                    {idx > 0 ? (
                      <Text style={[styles.dynastyArrow, { fontSize: ui.font(11) }]}>
                        ↓ descends to
                      </Text>
                    ) : null}
                    <Text style={[styles.genHeading, { fontSize: ui.font(10) }]}>
                      {layer.label.toUpperCase()}
                    </Text>
                    <View style={styles.dynastyChipWrap}>
                      {layer.members.map((member) => {
                        const active = member.animal.id === focalId;
                        return (
                          <Pressable
                            key={member.animal.id}
                            style={[styles.dynastyChip, active && styles.dynastyChipActive]}
                            onPress={() => focusAnimal(member.animal.id)}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                              <Text style={[styles.nodeTag, { fontSize: ui.font(10) }]}>
                                {member.animal.tagNumber}
                              </Text>
                              <AnimalEyeButton livestockId={member.animal.id} size={ui.font(12)} />
                            </View>
                            <Text style={[styles.dynastyChipName, { fontSize: ui.font(12) }]}>
                              {getAnimalTitle(member.animal)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )
      ) : (
        <View
          style={[
            styles.card,
            { padding: ui.space(13), borderRadius: ui.radius, gap: ui.space(10) },
          ]}
        >
          <Text style={[styles.sectionTitle, { fontSize: ui.font(15) }]}>
            Breeding &amp; Kinship Checker
          </Text>

          <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>
            Partner A
          </Text>
          <ModernDropdown
            searchable
            value={pairAId}
            options={allAnimalOptions}
            title="Select Partner A"
            accessibilityLabel="Partner A"
            onChange={setPairAId}
          />

          <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>
            Partner B
          </Text>
          <ModernDropdown
            searchable
            value={pairBId}
            options={allAnimalOptions}
            title="Select Partner B"
            accessibilityLabel="Partner B"
            onChange={setPairBId}
          />

          {kinshipReport ? (
            <View
              style={[
                styles.kinshipResult,
                kinshipReport.riskLevel === 'safe'
                  ? styles.kinshipSafe
                  : kinshipReport.riskLevel === 'caution'
                    ? styles.kinshipCaution
                    : styles.kinshipHigh,
                { padding: ui.space(12), borderRadius: Math.max(10, ui.radius - 2) },
              ]}
            >
              <View style={styles.kinshipTopRow}>
                <View
                  style={[
                    styles.riskBadge,
                    kinshipReport.riskLevel === 'safe'
                      ? styles.riskBadgeSafe
                      : kinshipReport.riskLevel === 'caution'
                        ? styles.riskBadgeCaution
                        : styles.riskBadgeHigh,
                  ]}
                >
                  <Text style={[styles.riskBadgeText, { fontSize: ui.font(10) }]}>
                    {kinshipReport.riskLevel === 'safe'
                      ? 'SAFE OUTCROSS'
                      : kinshipReport.riskLevel === 'caution'
                        ? 'CAUTION'
                        : 'HIGH INBREEDING RISK'}
                  </Text>
                </View>

                <Text style={[styles.coefText, { fontSize: ui.font(13) }]}>
                  R = {kinshipReport.relationshipPercent}%
                </Text>
              </View>

              <Text style={[styles.kinshipTitle, { fontSize: ui.font(15) }]}>
                {kinshipReport.relationshipLabel}
              </Text>
              <Text
                style={[
                  styles.kinshipSummary,
                  { fontSize: ui.font(12), lineHeight: ui.lineHeight(12, 1.45) },
                ]}
              >
                {kinshipReport.summary}
              </Text>

              {kinshipReport.sharedAncestors.length > 0 ? (
                <View style={{ marginTop: ui.space(8), gap: ui.space(6) }}>
                  <Text style={[styles.genHeading, { fontSize: ui.font(10) }]}>
                    SHARED ANCESTORS
                  </Text>
                  <View style={styles.dynastyChipWrap}>
                    {kinshipReport.sharedAncestors.map((anc) => (
                      <Pressable
                        key={anc.animal.id}
                        style={styles.dynastyChip}
                        onPress={() => focusAnimal(anc.animal.id)}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                          <Text style={[styles.nodeTag, { fontSize: ui.font(10) }]}>
                            {anc.animal.tagNumber}
                          </Text>
                          <AnimalEyeButton livestockId={anc.animal.id} size={ui.font(12)} />
                        </View>
                        <Text style={[styles.dynastyChipName, { fontSize: ui.font(12) }]}>
                          {getAnimalTitle(anc.animal)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      )}
    </FarmScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FARMDB_COLORS.bg,
  },
  heroCard: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1,
    borderColor: '#cce3d6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: FARMDB_FONTS.extrabold,
    color: FARMDB_COLORS.darkHeader,
  },
  heroSub: {
    fontFamily: FARMDB_FONTS.regular,
    color: FARMDB_COLORS.textMuted,
    marginTop: 1,
  },
  heroEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    backgroundColor: FARMDB_COLORS.cardAlt,
  },
  heroEditBtnActive: {
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderColor: FARMDB_COLORS.accent,
  },
  heroEditBtnText: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.text,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  kpiBox: {
    flex: 1,
    minWidth: 68,
    backgroundColor: FARMDB_COLORS.cardAlt,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.surfaceMuted,
    borderRadius: 9,
    padding: 8,
  },
  kpiLabel: {
    fontFamily: FARMDB_FONTS.medium,
    color: FARMDB_COLORS.textMuted,
  },
  kpiValue: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.darkHeader,
    marginTop: 2,
  },
  sampleBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1,
    borderColor: '#b7dfc6',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  sampleBannerBtnText: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.accentHover,
  },
  dropdownPairRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trailLabel: {
    fontFamily: FARMDB_FONTS.semibold,
    color: FARMDB_COLORS.textMuted,
  },
  trailChip: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  trailChipText: {
    fontFamily: FARMDB_FONTS.semibold,
    color: FARMDB_COLORS.text,
  },
  editorCard: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: '#cce3d6',
  },
  sectionTitle: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.darkHeader,
  },
  fieldLabel: {
    fontFamily: FARMDB_FONTS.semibold,
    color: FARMDB_COLORS.text,
  },
  errorText: {
    fontFamily: FARMDB_FONTS.medium,
    color: FARMDB_COLORS.danger,
  },
  successText: {
    fontFamily: FARMDB_FONTS.semibold,
    color: FARMDB_COLORS.success,
  },
  saveParentsBtn: {
    marginTop: 4,
    backgroundColor: FARMDB_COLORS.accent,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveParentsBtnText: {
    fontFamily: FARMDB_FONTS.bold,
    color: '#ffffff',
  },
  treeCanvas: {
    backgroundColor: FARMDB_COLORS.cardAlt,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
  },
  genHeading: {
    fontFamily: FARMDB_FONTS.extrabold,
    color: FARMDB_COLORS.textMuted,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  twoColRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  gpColumn: {
    flex: 1,
  },
  nodeCard: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    gap: 4,
  },
  nodeCardEmpty: {
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },
  nodeRoleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  roleLabel: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.accent,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  emptyNodeText: {
    fontFamily: FARMDB_FONTS.regular,
    color: FARMDB_COLORS.textMuted,
  },
  nodeIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  nodeAvatar: {
    borderRadius: 7,
    backgroundColor: FARMDB_COLORS.surfaceMuted,
  },
  nodeAvatarEmpty: {
    borderRadius: 7,
    backgroundColor: FARMDB_COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeTag: {
    fontFamily: FARMDB_FONTS.monoBold,
    color: FARMDB_COLORS.textMuted,
  },
  nodeName: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.text,
  },
  nodeSub: {
    fontFamily: FARMDB_FONTS.regular,
    color: FARMDB_COLORS.textMuted,
  },
  nodeExtraNote: {
    fontFamily: FARMDB_FONTS.semibold,
    color: FARMDB_COLORS.accentHover,
    backgroundColor: FARMDB_COLORS.accentSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    marginTop: 2,
  },
  dualStemRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    height: 14,
  },
  singleVerticalStem: {
    width: 2,
    height: '100%',
    backgroundColor: '#c5bcae',
  },
  mergeBracketWrap: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  mergeU: {
    width: '52%',
    height: 12,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: FARMDB_COLORS.accent,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  mergeDownStem: {
    width: 2,
    height: 12,
    backgroundColor: FARMDB_COLORS.accent,
  },
  singleCenterStem: {
    width: 2,
    height: 18,
    backgroundColor: FARMDB_COLORS.accent,
    alignSelf: 'center',
    marginVertical: 4,
  },
  focalCard: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 2,
    borderColor: FARMDB_COLORS.accent,
    shadowColor: FARMDB_COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  focalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  focalGenBadge: {
    backgroundColor: FARMDB_COLORS.accent,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  focalGenBadgeText: {
    fontFamily: FARMDB_FONTS.bold,
    color: '#ffffff',
  },
  focalStatusText: {
    fontFamily: FARMDB_FONTS.semibold,
    color: FARMDB_COLORS.textMuted,
  },
  focalIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  focalAvatar: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: FARMDB_COLORS.surfaceMuted,
  },
  focalAvatarEmpty: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1,
    borderColor: '#cce3d6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focalTag: {
    fontFamily: FARMDB_FONTS.monoBold,
    color: FARMDB_COLORS.accentHover,
  },
  focalName: {
    fontFamily: FARMDB_FONTS.extrabold,
    color: FARMDB_COLORS.darkHeader,
  },
  focalMeta: {
    fontFamily: FARMDB_FONTS.regular,
    color: FARMDB_COLORS.textMuted,
    marginTop: 1,
  },
  focalStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  focalStatPill: {
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  focalStatText: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.accentHover,
  },
  grandchildChip: {
    marginLeft: 18,
    paddingLeft: 10,
    paddingVertical: 6,
    paddingRight: 10,
    borderLeftWidth: 2,
    borderLeftColor: FARMDB_COLORS.accent,
    backgroundColor: FARMDB_COLORS.surface,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
  },
  grandchildLabel: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.accent,
  },
  grandchildName: {
    fontFamily: FARMDB_FONTS.semibold,
    color: FARMDB_COLORS.text,
  },
  card: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
  },
  relativeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: FARMDB_COLORS.cardAlt,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 9,
    padding: 9,
  },
  relativeName: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.text,
  },
  relativeSub: {
    fontFamily: FARMDB_FONTS.regular,
    color: FARMDB_COLORS.textMuted,
    marginTop: 1,
  },
  dynastyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dynastyTitle: {
    fontFamily: FARMDB_FONTS.extrabold,
    color: FARMDB_COLORS.darkHeader,
  },
  dynastyMeta: {
    fontFamily: FARMDB_FONTS.medium,
    color: FARMDB_COLORS.textMuted,
  },
  dynastyArrow: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.accent,
    paddingLeft: 4,
  },
  dynastyChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  dynastyChip: {
    minWidth: 112,
    maxWidth: '100%',
    backgroundColor: FARMDB_COLORS.cardAlt,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dynastyChipActive: {
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderColor: FARMDB_COLORS.accent,
  },
  dynastyChipName: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.text,
  },
  kinshipResult: {
    borderWidth: 1,
    gap: 6,
  },
  kinshipSafe: {
    backgroundColor: FARMDB_COLORS.successSoft,
    borderColor: '#b7dfc6',
  },
  kinshipCaution: {
    backgroundColor: FARMDB_COLORS.warnBg,
    borderColor: FARMDB_COLORS.warnBorder,
  },
  kinshipHigh: {
    backgroundColor: FARMDB_COLORS.dangerSoft,
    borderColor: '#f4c7c3',
  },
  kinshipTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  riskBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  riskBadgeSafe: {
    backgroundColor: FARMDB_COLORS.accent,
  },
  riskBadgeCaution: {
    backgroundColor: FARMDB_COLORS.warnText,
  },
  riskBadgeHigh: {
    backgroundColor: FARMDB_COLORS.danger,
  },
  riskBadgeText: {
    fontFamily: FARMDB_FONTS.bold,
    color: '#ffffff',
  },
  coefText: {
    fontFamily: FARMDB_FONTS.monoBold,
    color: FARMDB_COLORS.text,
  },
  kinshipTitle: {
    fontFamily: FARMDB_FONTS.extrabold,
    color: FARMDB_COLORS.darkHeader,
  },
  kinshipSummary: {
    fontFamily: FARMDB_FONTS.regular,
    color: FARMDB_COLORS.text,
  },
  emptyCard: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.darkHeader,
  },
  emptySub: {
    fontFamily: FARMDB_FONTS.regular,
    color: FARMDB_COLORS.textMuted,
    textAlign: 'center',
  },
});
