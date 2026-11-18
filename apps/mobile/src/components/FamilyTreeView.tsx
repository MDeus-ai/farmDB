import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  analyzeBreedingPair,
  buildAnimalPedigree,
  buildHerdLineageOverview,
  describeModuleAccessLevel,
  formatAnimalAge,
  formatSexLabel,
  formatSpeciesLabel,
  formatStatusLabel,
  formatVolume,
  getEligibleParentCandidates,
  SPECIES_LIST,
  type LineageAnimalNode,
  type Livestock,
  type PedigreeTree,
  type Species,
} from '@farmdb/core';
import {
  useLivestockList,
  useModulePermissions,
  useProductRecordList,
  useUpdateLivestock,
} from '@farmdb/db';
import { getSpeciesPngSource, MOBILE_APP_ICONS } from '../assets/icons';
import { FARMDB_COLORS, FARMDB_FONTS, useUiScale } from '../theme/uiScale';
import { buildAnimalDropdownOption } from '../utils/animalOptions';
import { AnimalEyeButton } from './AnimalQuickPreviewModal';
import { AppIcon, SexIcon, SpeciesIcon, StatusIcon } from './FarmIcons';
import { FarmScrollView } from './FarmScrollView';
import { MobileFileTabs } from './MobileFileTabs';
import {
  ModernDropdown,
  type ModernDropdownOption,
} from './ModernDropdown';

type MobileTreeTab = 'pedigree' | 'dynasties' | 'kinship';
type MobilePedigreeMode = 'pedigree' | 'graph';

function buildMobileSimplifiedGraph(pedigree: PedigreeTree, fontMult = 1) {
  const nodeW = Math.round(196 * fontMult);
  const nodeH = Math.round(96 * fontMult);
  const colGap = Math.round(48 * fontMult);
  const rowGap = Math.round(20 * fontMult);
  const padX = 18;
  const headerH = Math.round(38 * fontMult);
  const padBottom = 18;

  type ColItem = { node: LineageAnimalNode; roleLabel: string; isFocal: boolean };
  type ColSpec = { key: string; genTag: string; title: string; items: ColItem[] };
  const cols: ColSpec[] = [];

  const gp: ColItem[] = [];
  if (pedigree.paternalGrandsire) gp.push({ node: pedigree.paternalGrandsire, roleLabel: 'Pat. Grandsire', isFocal: false });
  if (pedigree.paternalGranddam) gp.push({ node: pedigree.paternalGranddam, roleLabel: 'Pat. Granddam', isFocal: false });
  if (pedigree.maternalGrandsire) gp.push({ node: pedigree.maternalGrandsire, roleLabel: 'Mat. Grandsire', isFocal: false });
  if (pedigree.maternalGranddam) gp.push({ node: pedigree.maternalGranddam, roleLabel: 'Mat. Granddam', isFocal: false });
  if (gp.length > 0) cols.push({ key: 'gen-2', genTag: 'Gen −2', title: 'Grandparents', items: gp });

  const parents: ColItem[] = [];
  if (pedigree.sire) parents.push({ node: pedigree.sire, roleLabel: 'Sire', isFocal: false });
  if (pedigree.dam) parents.push({ node: pedigree.dam, roleLabel: 'Dam', isFocal: false });
  if (parents.length > 0) cols.push({ key: 'gen-1', genTag: 'Gen −1', title: 'Parents', items: parents });

  cols.push({
    key: 'gen-0',
    genTag: 'Gen 0',
    title: 'Selected',
    items: [{ node: pedigree.focal, roleLabel: 'Selected', isFocal: true }],
  });

  if (pedigree.directOffspring.length > 0) {
    cols.push({
      key: 'gen+1',
      genTag: 'Gen +1',
      title: 'Offspring',
      items: pedigree.directOffspring.map((child) => ({
        node: child,
        roleLabel: child.sireId === pedigree.focal.animal.id ? 'Offspring (S)' : 'Offspring (D)',
        isFocal: false,
      })),
    });
  }

  if (pedigree.grandOffspring.length > 0) {
    const seen = new Set<string>();
    const gcList: ColItem[] = [];
    for (const gc of pedigree.grandOffspring) {
      if (!seen.has(gc.animal.animal.id)) {
        seen.add(gc.animal.animal.id);
        gcList.push({ node: gc.animal, roleLabel: 'Grand-Off.', isFocal: false });
      }
    }
    if (gcList.length > 0) {
      cols.push({ key: 'gen+2', genTag: 'Gen +2', title: 'Grand-Off.', items: gcList });
    }
  }

  const maxRows = Math.max(1, ...cols.map((c) => c.items.length));
  const width = Math.max(
    360,
    padX * 2 + cols.length * nodeW + Math.max(0, cols.length - 1) * colGap
  );
  const contentH = maxRows * nodeH + Math.max(0, maxRows - 1) * rowGap;
  const height = Math.max(240, headerH + contentH + padBottom);

  const columns: Array<{ key: string; genTag: string; title: string; x: number; width: number }> = [];
  const nodes: Array<ColItem & { key: string; x: number; y: number }> = [];
  const byId = new Map<string, { x: number; y: number }>();

  cols.forEach((col, colIdx) => {
    const colH = col.items.length * nodeH + Math.max(0, col.items.length - 1) * rowGap;
    const availH = height - headerH - padBottom;
    const startY = headerH + Math.max(0, Math.round((availH - colH) / 2));
    const x = padX + colIdx * (nodeW + colGap);
    columns.push({
      key: col.key,
      genTag: col.genTag,
      title: col.title,
      x,
      width: nodeW,
    });
    col.items.forEach((item, rowIdx) => {
      const y = startY + rowIdx * (nodeH + rowGap);
      nodes.push({ ...item, key: `${colIdx}-${item.node.animal.id}-${rowIdx}`, x, y });
      if (!byId.has(item.node.animal.id)) {
        byId.set(item.node.animal.id, { x, y });
      }
    });
  });

  const edges: Array<{ key: string; fromX: number; fromY: number; toX: number; toY: number; tone: 'sire' | 'dam' | 'offspring' }> = [];
  const seenEdges = new Set<string>();
  const addEdge = (parentId: string | null | undefined, child: typeof nodes[number], tone: 'sire' | 'dam' | 'offspring') => {
    if (!parentId) return;
    const p = byId.get(parentId);
    if (!p || p.x >= child.x) return;
    const k = `${parentId}->${child.node.animal.id}-${tone}`;
    if (seenEdges.has(k)) return;
    seenEdges.add(k);
    edges.push({
      key: k,
      fromX: p.x + nodeW,
      fromY: p.y + Math.round(nodeH / 2),
      toX: child.x,
      toY: child.y + Math.round(nodeH / 2),
      tone,
    });
  };

  for (const n of nodes) {
    const { animal, sireId, damId } = n.node;
    const isDesc =
      animal.id !== pedigree.focal.animal.id &&
      (sireId === pedigree.focal.animal.id || damId === pedigree.focal.animal.id);
    addEdge(sireId, n, isDesc ? 'offspring' : 'sire');
    addEdge(damId, n, isDesc ? 'offspring' : 'dam');
  }

  return { columns, nodes, edges, width, height, nodeW, nodeH };
}

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
  const updateMutation = useUpdateLivestock();
  const { canEdit, accessLevel } = useModulePermissions('family_tree');

  const allLivestock = livestockQuery.data ?? [];
  const allProducts = productQuery.data ?? [];

  const [speciesFilter, setSpeciesFilter] = useState<Species | 'all'>('all');
  const [subTab, setSubTab] = useState<MobileTreeTab>('pedigree');
  const [pedigreeDisplayMode, setPedigreeDisplayMode] = useState<MobilePedigreeMode>('pedigree');
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

  const mobileGraph = useMemo(
    () => (pedigree ? buildMobileSimplifiedGraph(pedigree, ui.fontMult) : null),
    [pedigree, ui.fontMult]
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
    if (!pedigree || !canEdit) return;
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
                <SpeciesIcon
                  species={node.animal.species}
                  sex={node.animal.sex}
                  size={compact ? 15 : 20}
                />
              </View>
            )
          ) : null}

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, flexWrap: 'wrap' }}>
              <Text style={[styles.nodeTag, { fontSize: ui.font(10), flexShrink: 1 }]} numberOfLines={2}>
                {node.animal.tagNumber}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <SexIcon sex={node.animal.sex} size={ui.font(compact ? 11 : 12)} />
                <AnimalEyeButton livestockId={node.animal.id} size={ui.font(compact ? 11 : 12)} />
              </View>
            </View>
            <Text style={[styles.nodeName, { fontSize: ui.font(compact ? 12 : 13) }]} numberOfLines={2}>
              {getAnimalTitle(node.animal)}
            </Text>
          </View>
        </View>

        {!compact ? (
          <Text style={[styles.nodeSub, { fontSize: ui.font(10) }]} numberOfLines={2}>
            {node.animal.breed ?? formatSpeciesLabel(node.animal.species, node.animal.sex)} ·{' '}
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
            {!canEdit ? (
              <Text
                style={{
                  fontFamily: FARMDB_FONTS.semibold,
                  color: FARMDB_COLORS.textMuted,
                  fontSize: ui.font(11),
                  marginTop: 2,
                }}
              >
                {describeModuleAccessLevel(accessLevel)}
              </Text>
            ) : null}
          </View>
          {pedigree && canEdit ? (
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

            {showLinkEditor && canEdit ? (
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

            {/* Pedigree Tree vs Simplified Graph Mode Toggle */}
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: FARMDB_COLORS.surfaceMuted,
                borderWidth: 1,
                borderColor: FARMDB_COLORS.border,
                borderRadius: 10,
                padding: 3,
                gap: 4,
              }}
            >
              {(
                [
                  { id: 'pedigree', label: 'Pedigree Tree' },
                  { id: 'graph', label: 'Simplified Graph' },
                ] as const
              ).map((opt) => {
                const active = pedigreeDisplayMode === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    style={{
                      flex: 1,
                      paddingVertical: 6,
                      borderRadius: 8,
                      alignItems: 'center',
                      backgroundColor: active ? FARMDB_COLORS.surface : 'transparent',
                      borderWidth: active ? 2 : 1,
                      borderColor: active ? FARMDB_COLORS.accent : 'transparent',
                    }}
                    onPress={() => setPedigreeDisplayMode(opt.id)}
                  >
                    <Text
                      style={{
                        fontFamily: active ? FARMDB_FONTS.bold : FARMDB_FONTS.semibold,
                        fontSize: ui.font(12),
                        color: active ? FARMDB_COLORS.accent : FARMDB_COLORS.textMuted,
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {pedigreeDisplayMode === 'graph' && mobileGraph ? (
              <View
                style={[
                  styles.treeCanvas,
                  { padding: ui.space(10), borderRadius: ui.radius, gap: ui.space(8) },
                ]}
              >
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 9, height: 9, borderRadius: 99, backgroundColor: '#2d6a4f' }} />
                    <Text style={{ fontFamily: FARMDB_FONTS.semibold, fontSize: ui.font(10.5), color: FARMDB_COLORS.text }}>
                      Paternal
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 9, height: 9, borderRadius: 99, backgroundColor: '#9c6644' }} />
                    <Text style={{ fontFamily: FARMDB_FONTS.semibold, fontSize: ui.font(10.5), color: FARMDB_COLORS.text }}>
                      Maternal
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 9, height: 9, borderRadius: 99, backgroundColor: '#1b4332' }} />
                    <Text style={{ fontFamily: FARMDB_FONTS.semibold, fontSize: ui.font(10.5), color: FARMDB_COLORS.text }}>
                      Offspring
                    </Text>
                  </View>
                </View>

                <FarmScrollView horizontal fillParent={false}>
                  <View
                    style={{
                      width: mobileGraph.width,
                      height: mobileGraph.height,
                      position: 'relative',
                    }}
                  >
                    <Svg
                      width={mobileGraph.width}
                      height={mobileGraph.height}
                      style={{ position: 'absolute', left: 0, top: 0 }}
                    >
                      {mobileGraph.edges.map((edge) => {
                        const midX = Math.round((edge.fromX + edge.toX) / 2);
                        const d = `M ${edge.fromX} ${edge.fromY} C ${midX} ${edge.fromY}, ${midX} ${edge.toY}, ${edge.toX} ${edge.toY}`;
                        const stroke =
                          edge.tone === 'offspring'
                            ? '#1b4332'
                            : edge.tone === 'sire'
                              ? '#2d6a4f'
                              : '#9c6644';
                        return (
                          <React.Fragment key={edge.key}>
                            <Path d={d} fill="none" stroke={stroke} strokeWidth={2.2} />
                            <Circle cx={edge.toX} cy={edge.toY} r={3.5} fill={stroke} />
                          </React.Fragment>
                        );
                      })}
                    </Svg>

                    {mobileGraph.columns.map((col) => (
                      <View
                        key={col.key}
                        style={{
                          position: 'absolute',
                          top: 2,
                          left: col.x,
                          width: col.width,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor: col.key === 'gen-0' ? '#e1efe7' : '#efece3',
                          borderWidth: 1,
                          borderColor: col.key === 'gen-0' ? 'rgba(45,106,79,0.45)' : FARMDB_COLORS.border,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: FARMDB_FONTS.bold,
                            fontSize: ui.font(9.5),
                            color: col.key === 'gen-0' ? FARMDB_COLORS.accent : FARMDB_COLORS.textMuted,
                            textTransform: 'uppercase',
                          }}
                        >
                          {col.genTag}
                        </Text>
                        <Text
                          style={{
                            fontFamily: FARMDB_FONTS.semibold,
                            fontSize: ui.font(9.5),
                            color: col.key === 'gen-0' ? FARMDB_COLORS.accent : FARMDB_COLORS.textMuted,
                            flexShrink: 1,
                          }}
                          numberOfLines={1}
                        >
                          {col.title}
                        </Text>
                      </View>
                    ))}

                    {mobileGraph.nodes.map((entry) => (
                      <Pressable
                        key={entry.key}
                        style={{
                          position: 'absolute',
                          left: entry.x,
                          top: entry.y,
                          width: mobileGraph.nodeW,
                          minHeight: mobileGraph.nodeH,
                          borderRadius: 11,
                          padding: ui.space(8),
                          justifyContent: 'space-between',
                          gap: 5,
                          backgroundColor: entry.isFocal ? '#eaf6ef' : FARMDB_COLORS.surface,
                          borderWidth: entry.isFocal ? 2.5 : 1.5,
                          borderColor: entry.isFocal ? FARMDB_COLORS.accent : FARMDB_COLORS.border,
                        }}
                        onPress={() => focusAnimal(entry.node.animal.id)}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                          <Text
                            style={{
                              fontFamily: FARMDB_FONTS.bold,
                              fontSize: ui.font(9.5),
                              color: FARMDB_COLORS.accent,
                              textTransform: 'uppercase',
                              flexShrink: 1,
                            }}
                            numberOfLines={1}
                          >
                            {entry.roleLabel}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <SexIcon sex={entry.node.animal.sex} size={ui.font(12)} />
                            <AnimalEyeButton livestockId={entry.node.animal.id} size={ui.font(12)} />
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                          <SpeciesIcon
                            species={entry.node.animal.species}
                            sex={entry.node.animal.sex}
                            size={ui.font(20)}
                          />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              style={{
                                fontFamily: FARMDB_FONTS.bold,
                                fontSize: ui.font(12),
                                color: FARMDB_COLORS.text,
                              }}
                              numberOfLines={1}
                            >
                              {getAnimalTitle(entry.node.animal)}
                            </Text>
                            <Text
                              style={{
                                fontFamily: FARMDB_FONTS.regular,
                                fontSize: ui.font(10),
                                color: FARMDB_COLORS.textMuted,
                              }}
                              numberOfLines={1}
                            >
                              {entry.node.animal.tagNumber} · {formatSexLabel(entry.node.animal.sex)}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </FarmScrollView>
              </View>
            ) : (
            /* Visual Vertical Branching Tree Canvas */
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
                        sex={pedigree.focal.animal.sex}
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
                      {formatSpeciesLabel(pedigree.focal.animal.species, pedigree.focal.animal.sex)}
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
            )}

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
                      <SpeciesIcon
                        species={sib.animal.species}
                        sex={sib.animal.sex}
                        size={ui.font(18)}
                      />
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
                      <SpeciesIcon
                        species={entry.animal.animal.species}
                        sex={entry.animal.animal.sex}
                        size={ui.font(18)}
                      />
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
                      <SpeciesIcon
                        species={cp.partner.animal.species}
                        sex={cp.partner.animal.sex}
                        size={ui.font(18)}
                      />
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
    borderWidth: 2.5,
    borderColor: FARMDB_COLORS.accent,
    shadowColor: FARMDB_COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
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
