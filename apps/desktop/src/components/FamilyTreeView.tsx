import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  analyzeBreedingPair,
  buildAnimalPedigree,
  buildHerdLineageOverview,
  DEFAULT_FARM_SETTINGS,
  describeModuleAccessLevel,
  formatAnimalAge,
  formatSexLabel,
  formatSpeciesLabel,
  formatStatusLabel,
  formatVolume,
  getEligibleParentCandidates,
  SPECIES_LIST,
  type FontScale,
  type LineageAnimalNode,
  type Livestock,
  type PedigreeTree,
  type Species,
} from '@farmdb/core';
import {
  useFarmSettings,
  useLivestockList,
  useModulePermissions,
  useProductRecordList,
  useUpdateLivestock,
} from '@farmdb/db';
import {
  APP_ICONS,
  getSexPngIcon,
  getSpeciesPngIcon,
  getStatusPngIcon,
} from '../assets/icons';
import { resolveDesktopImageSrc } from '../services/imageStorage';
import { buildAnimalSelectOption } from '../utils/animalOptions';
import { AnimalEyeButton } from './AnimalQuickPreviewModal';
import { FileTabs } from './FileTabs';
import { ModernSelect, type ModernSelectOption } from './ModernSelect';

type TreeSubView = 'pedigree' | 'dynasties' | 'kinship';
type PedigreeDisplayMode = 'pedigree' | 'graph';

interface GraphColumnHeader {
  key: string;
  genTag: string;
  title: string;
  x: number;
  width: number;
}

interface GraphNodeEntry {
  key: string;
  node: LineageAnimalNode;
  roleLabel: string;
  isFocal: boolean;
  x: number;
  y: number;
}

interface GraphEdgeEntry {
  key: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  tone: 'sire' | 'dam' | 'offspring';
}

function getFontScaleMultiplier(fontScale: FontScale): number {
  switch (fontScale) {
    case 'small':
      return 0.94;
    case 'large':
      return 1.14;
    case 'xlarge':
      return 1.26;
    default:
      return 1;
  }
}

function buildSimplifiedGraphLayout(
  pedigree: PedigreeTree,
  fontScale: FontScale = 'medium'
): {
  columns: GraphColumnHeader[];
  nodes: GraphNodeEntry[];
  edges: GraphEdgeEntry[];
  width: number;
  height: number;
  nodeW: number;
  nodeH: number;
} {
  const mult = getFontScaleMultiplier(fontScale);
  const nodeW = Math.round(238 * mult);
  const nodeH = Math.round(112 * mult);
  const colGap = Math.round(74 * mult);
  const rowGap = Math.round(26 * mult);
  const padX = 28;
  const headerH = Math.round(46 * mult);
  const padBottom = 28;

  type ColumnSpec = {
    key: string;
    genTag: string;
    title: string;
    items: Array<{ node: LineageAnimalNode; roleLabel: string; isFocal: boolean }>;
  };
  const rawColumns: ColumnSpec[] = [];

  const gpItems: ColumnSpec['items'] = [];
  if (pedigree.paternalGrandsire) gpItems.push({ node: pedigree.paternalGrandsire, roleLabel: 'Pat. Grandsire', isFocal: false });
  if (pedigree.paternalGranddam) gpItems.push({ node: pedigree.paternalGranddam, roleLabel: 'Pat. Granddam', isFocal: false });
  if (pedigree.maternalGrandsire) gpItems.push({ node: pedigree.maternalGrandsire, roleLabel: 'Mat. Grandsire', isFocal: false });
  if (pedigree.maternalGranddam) gpItems.push({ node: pedigree.maternalGranddam, roleLabel: 'Mat. Granddam', isFocal: false });
  if (gpItems.length > 0) {
    rawColumns.push({
      key: 'gen-2',
      genTag: 'Gen −2',
      title: 'Grandparents',
      items: gpItems,
    });
  }

  const parentItems: ColumnSpec['items'] = [];
  if (pedigree.sire) parentItems.push({ node: pedigree.sire, roleLabel: 'Sire (Father)', isFocal: false });
  if (pedigree.dam) parentItems.push({ node: pedigree.dam, roleLabel: 'Dam (Mother)', isFocal: false });
  if (parentItems.length > 0) {
    rawColumns.push({
      key: 'gen-1',
      genTag: 'Gen −1',
      title: 'Parents',
      items: parentItems,
    });
  }

  rawColumns.push({
    key: 'gen-0',
    genTag: 'Gen 0',
    title: 'Selected Animal',
    items: [{ node: pedigree.focal, roleLabel: 'Selected', isFocal: true }],
  });

  if (pedigree.directOffspring.length > 0) {
    rawColumns.push({
      key: 'gen+1',
      genTag: 'Gen +1',
      title: 'Direct Offspring',
      items: pedigree.directOffspring.map((child) => ({
        node: child,
        roleLabel: child.sireId === pedigree.focal.animal.id ? 'Offspring (Sire)' : 'Offspring (Dam)',
        isFocal: false,
      })),
    });
  }

  if (pedigree.grandOffspring.length > 0) {
    const seenGc = new Set<string>();
    const gcItems: ColumnSpec['items'] = [];
    for (const gc of pedigree.grandOffspring) {
      if (!seenGc.has(gc.animal.animal.id)) {
        seenGc.add(gc.animal.animal.id);
        gcItems.push({ node: gc.animal, roleLabel: 'Grand-Offspring', isFocal: false });
      }
    }
    if (gcItems.length > 0) {
      rawColumns.push({
        key: 'gen+2',
        genTag: 'Gen +2',
        title: 'Grand-Offspring',
        items: gcItems,
      });
    }
  }

  const maxRows = Math.max(1, ...rawColumns.map((col) => col.items.length));
  const width = Math.max(
    680,
    padX * 2 + rawColumns.length * nodeW + Math.max(0, rawColumns.length - 1) * colGap
  );
  const contentHeight = maxRows * nodeH + Math.max(0, maxRows - 1) * rowGap;
  const height = Math.max(290, headerH + contentHeight + padBottom);

  const columns: GraphColumnHeader[] = [];
  const nodes: GraphNodeEntry[] = [];
  const coordByAnimalId = new Map<string, GraphNodeEntry>();

  rawColumns.forEach((col, colIndex) => {
    const colHeight = col.items.length * nodeH + Math.max(0, col.items.length - 1) * rowGap;
    const availableHeight = height - headerH - padBottom;
    const startY = headerH + Math.max(0, Math.round((availableHeight - colHeight) / 2));
    const x = padX + colIndex * (nodeW + colGap);

    columns.push({
      key: col.key,
      genTag: col.genTag,
      title: col.title,
      x,
      width: nodeW,
    });

    col.items.forEach((item, rowIndex) => {
      const y = startY + rowIndex * (nodeH + rowGap);
      const entry: GraphNodeEntry = {
        key: `${colIndex}-${item.node.animal.id}-${rowIndex}`,
        node: item.node,
        roleLabel: item.roleLabel,
        isFocal: item.isFocal,
        x,
        y,
      };
      nodes.push(entry);
      if (!coordByAnimalId.has(item.node.animal.id)) {
        coordByAnimalId.set(item.node.animal.id, entry);
      }
    });
  });

  const edges: GraphEdgeEntry[] = [];
  const edgeKeys = new Set<string>();
  const addEdge = (
    parentId: string | null | undefined,
    childNode: GraphNodeEntry,
    tone: 'sire' | 'dam' | 'offspring'
  ) => {
    if (!parentId) return;
    const parentNode = coordByAnimalId.get(parentId);
    if (!parentNode || parentNode.x >= childNode.x) return;
    const k = `${parentNode.node.animal.id}->${childNode.node.animal.id}-${tone}`;
    if (edgeKeys.has(k)) return;
    edgeKeys.add(k);
    edges.push({
      key: k,
      fromX: parentNode.x + nodeW,
      fromY: parentNode.y + Math.round(nodeH / 2),
      toX: childNode.x,
      toY: childNode.y + Math.round(nodeH / 2),
      tone,
    });
  };

  for (const nodeEntry of nodes) {
    const { animal, sireId, damId } = nodeEntry.node;
    const isDescendant =
      animal.id !== pedigree.focal.animal.id &&
      (sireId === pedigree.focal.animal.id ||
        damId === pedigree.focal.animal.id ||
        pedigree.grandOffspring.some((g) => g.animal.animal.id === animal.id));
    addEdge(sireId, nodeEntry, isDescendant ? 'offspring' : 'sire');
    addEdge(damId, nodeEntry, isDescendant ? 'offspring' : 'dam');
  }

  return { columns, nodes, edges, width, height, nodeW, nodeH };
}

interface FamilyTreeViewProps {
  initialAnimalId?: string | null;
}

function getAnimalDisplayName(animal: Livestock): string {
  return animal.name?.trim() || animal.tagNumber;
}

export function FamilyTreeView({ initialAnimalId }: FamilyTreeViewProps) {
  const livestockQuery = useLivestockList({});
  const productQuery = useProductRecordList({});
  const settingsQuery = useFarmSettings();
  const updateMutation = useUpdateLivestock();
  const { canEdit, accessLevel } = useModulePermissions('family_tree');

  const settings = settingsQuery.data ?? DEFAULT_FARM_SETTINGS;
  const allLivestock = livestockQuery.data ?? [];
  const allProducts = productQuery.data ?? [];

  const [speciesFilter, setSpeciesFilter] = useState<Species | 'all'>('all');
  const [subView, setSubView] = useState<TreeSubView>('pedigree');
  const [treeDisplayMode, setTreeDisplayMode] = useState<PedigreeDisplayMode>('pedigree');
  const [focalId, setFocalId] = useState<string>('');
  const [trailIds, setTrailIds] = useState<string[]>([]);
  const [showLinkPanel, setShowLinkPanel] = useState(false);

  const treeCanvasRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({
    active: false,
    moved: false,
    suppressNextClick: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);

  function handleCanvasMouseDown(e: MouseEvent<HTMLDivElement>) {
    if (e.button !== 0 || !treeCanvasRef.current) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('input, select, textarea, a, .animal-eye-btn, .pedigree-display-toggle')) {
      return;
    }
    dragStateRef.current = {
      active: true,
      moved: false,
      suppressNextClick: false,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: treeCanvasRef.current.scrollLeft,
      scrollTop: treeCanvasRef.current.scrollTop,
    };
    setIsDraggingCanvas(true);
  }

  function handleCanvasMouseMove(e: MouseEvent<HTMLDivElement>) {
    const state = dragStateRef.current;
    if (!state.active || !treeCanvasRef.current) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      state.moved = true;
    }
    treeCanvasRef.current.scrollLeft = state.scrollLeft - dx;
    treeCanvasRef.current.scrollTop = state.scrollTop - dy;
  }

  function endCanvasDrag() {
    const state = dragStateRef.current;
    if (!state.active) return;
    if (state.moved) {
      state.suppressNextClick = true;
    }
    state.active = false;
    state.moved = false;
    setIsDraggingCanvas(false);
  }

  function handleCanvasClickCapture(e: MouseEvent<HTMLDivElement>) {
    if (dragStateRef.current.suppressNextClick) {
      dragStateRef.current.suppressNextClick = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }

  const [draftSireId, setDraftSireId] = useState<string>('');
  const [draftDamId, setDraftDamId] = useState<string>('');
  const [draftChildId, setDraftChildId] = useState<string>('');
  const [draftChildRole, setDraftChildRole] = useState<'dam' | 'sire'>('dam');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);

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
      setSubView('pedigree');
    }
  }, [initialAnimalId]);

  // Choose smart default focal animal when list or filter changes without overwriting valid selection
  useEffect(() => {
    if (focalId && filteredLivestock.some((a) => a.id === focalId)) {
      return;
    }

    const withBothParents = filteredLivestock.find((a) => a.sireId && a.damId);
    const withAnyLink = filteredLivestock.find(
      (a) =>
        a.sireId ||
        a.damId ||
        filteredLivestock.some((c) => c.sireId === a.id || c.damId === a.id)
    );
    const nextFocal =
      withBothParents ?? withAnyLink ?? filteredLivestock[0] ?? null;
    if (nextFocal) {
      setFocalId(nextFocal.id);
    } else {
      setFocalId('');
    }
  }, [filteredLivestock, focalId]);

  // Default animals for Breeding & Kinship Checker
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
      const candidateB =
        allLivestock.find((a) => a.id !== (focalId || allLivestock[0]!.id)) ??
        allLivestock[0]!;
      setPairBId(candidateB.id);
    }
  }, [allLivestock, focalId, pairAId, pairBId]);

  const pedigree = useMemo(
    () =>
      focalId ? buildAnimalPedigree(focalId, allLivestock, allProducts) : null,
    [focalId, allLivestock, allProducts]
  );

  const simplifiedGraph = useMemo(
    () =>
      pedigree
        ? buildSimplifiedGraphLayout(pedigree, settings.fontScale)
        : null,
    [pedigree, settings.fontScale]
  );

  useEffect(() => {
    if (!pedigree) {
      setDraftSireId('');
      setDraftDamId('');
      setDraftChildId('');
      return;
    }
    setDraftSireId(pedigree.focal.sireId ?? '');
    setDraftDamId(pedigree.focal.damId ?? '');
    setDraftChildId('');
    setLinkError(null);
  }, [pedigree?.focal.animal.id, pedigree?.focal.sireId, pedigree?.focal.damId]);

  function focusAnimal(nextId: string) {
    if (!nextId) return;
    setTrailIds((prev) => {
      const deduped = prev.filter((id) => id !== nextId);
      if (focalId && focalId !== nextId && !deduped.includes(focalId)) {
        deduped.push(focalId);
      }
      return deduped.slice(-5);
    });
    setFocalId(nextId);
    setSubView('pedigree');
    setLinkSuccess(null);
    setLinkError(null);
  }

  const speciesOptions = useMemo<ModernSelectOption<Species | 'all'>[]>(
    () => [
      { value: 'all', label: 'All Species', iconSrc: APP_ICONS.group },
      ...SPECIES_LIST.map((sp) => ({
        value: sp,
        label: formatSpeciesLabel(sp),
        iconSrc: getSpeciesPngIcon(sp),
      })),
    ],
    []
  );

  const focalOptions = useMemo<ModernSelectOption<string>[]>(
    () =>
      filteredLivestock.map((item) => {
        const hasParents = Boolean(item.sireId || item.damId);
        return buildAnimalSelectOption(item, {
          label: `${item.tagNumber}${item.name ? ` · ${item.name}` : ''}`,
          hint: `${item.breed ?? formatSpeciesLabel(item.species)}${hasParents ? ' · Linked pedigree' : ''}`,
        });
      }),
    [filteredLivestock]
  );

  const allAnimalSelectOptions = useMemo<ModernSelectOption<string>[]>(
    () =>
      allLivestock.map((item) =>
        buildAnimalSelectOption(item, {
          label: `${item.tagNumber}${item.name ? ` · ${item.name}` : ''}`,
        })
      ),
    [allLivestock]
  );

  const sireCandidateOptions = useMemo<ModernSelectOption<string>[]>(() => {
    if (!pedigree) return [];
    const list = getEligibleParentCandidates(
      pedigree.focal.animal.id,
      'sire',
      allLivestock,
      draftDamId || null
    );
    return [
      { value: '', label: 'Unknown / Founder', iconSrc: APP_ICONS.tree },
      ...list.map((item) =>
        buildAnimalSelectOption(item, {
          label: `${item.tagNumber}${item.name ? ` · ${item.name}` : ''}`,
        })
      ),
    ];
  }, [pedigree, allLivestock, draftDamId]);

  const damCandidateOptions = useMemo<ModernSelectOption<string>[]>(() => {
    if (!pedigree) return [];
    const list = getEligibleParentCandidates(
      pedigree.focal.animal.id,
      'dam',
      allLivestock,
      draftSireId || null
    );
    return [
      { value: '', label: 'Unknown / Founder', iconSrc: APP_ICONS.tree },
      ...list.map((item) =>
        buildAnimalSelectOption(item, {
          label: `${item.tagNumber}${item.name ? ` · ${item.name}` : ''}`,
        })
      ),
    ];
  }, [pedigree, allLivestock, draftSireId]);

  const childCandidateOptions = useMemo<ModernSelectOption<string>[]>(() => {
    if (!pedigree) return [];
    const focal = pedigree.focal.animal;
    const directIds = new Set(pedigree.directOffspring.map((o) => o.animal.id));
    // Exclude focal itself, its ancestors, and existing offspring
    const candidates = allLivestock.filter((candidate) => {
      if (candidate.id === focal.id || directIds.has(candidate.id)) return false;
      if (candidate.species !== focal.species) return false;
      if (candidate.id === focal.sireId || candidate.id === focal.damId) return false;
      return true;
    });
    return [
      { value: '', label: 'Select existing animal to attach as offspring...', iconSrc: APP_ICONS.plus },
      ...candidates.map((item) =>
        buildAnimalSelectOption(item, {
          label: `${item.tagNumber}${item.name ? ` · ${item.name}` : ''}`,
          hint: `Born ${item.dob ?? 'Unknown'}`,
        })
      ),
    ];
  }, [pedigree, allLivestock]);

  const kinshipReport = useMemo(
    () =>
      pairAId && pairBId
        ? analyzeBreedingPair(pairAId, pairBId, allLivestock, allProducts)
        : null,
    [pairAId, pairBId, allLivestock, allProducts]
  );

  async function handleSaveParentLinks() {
    if (!pedigree || !canEdit) return;
    setLinkError(null);
    setLinkSuccess(null);
    try {
      await updateMutation.mutateAsync({
        id: pedigree.focal.animal.id,
        input: {
          sireId: draftSireId || null,
          damId: draftDamId || null,
        },
      });
      setLinkSuccess('Parent lineage saved to local SQLite.');
    } catch (err) {
      setLinkError(
        err instanceof Error ? err.message : 'Unable to save parent links.'
      );
    }
  }

  async function handleAttachChild() {
    if (!pedigree || !draftChildId || !canEdit) return;
    setLinkError(null);
    setLinkSuccess(null);
    try {
      await updateMutation.mutateAsync({
        id: draftChildId,
        input:
          draftChildRole === 'sire'
            ? { sireId: pedigree.focal.animal.id }
            : { damId: pedigree.focal.animal.id },
      });
      setDraftChildId('');
      setLinkSuccess('Attached offspring to this family line.');
    } catch (err) {
      setLinkError(
        err instanceof Error ? err.message : 'Unable to attach offspring.'
      );
    }
  }

  function renderPedigreeCard(
    node: LineageAnimalNode | null,
    roleTitle: string,
    variant: 'grandparent' | 'parent' | 'focal' | 'offspring',
    extraSubtitle?: string
  ) {
    if (!node) {
      return (
        <div className={`pedigree-node-card is-empty variant-${variant}`}>
          <div className="pedigree-role-row">
            <span className="pedigree-role-badge">{roleTitle}</span>
          </div>
          <p className="pedigree-empty-label">Unknown / Founder Line</p>
          {variant === 'parent' && pedigree && canEdit && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ marginTop: 6, width: '100%' }}
              onClick={() => setShowLinkPanel(true)}
            >
              + Assign {roleTitle.split(' ')[0]}
            </button>
          )}
        </div>
      );
    }

    const photoSrc = resolveDesktopImageSrc(node.animal.imageUri);
    const isFocal = variant === 'focal';

    return (
      <div
        role={isFocal ? undefined : 'button'}
        tabIndex={isFocal ? undefined : 0}
        className={`pedigree-node-card variant-${variant} ${isFocal ? 'is-focal' : 'is-clickable'}`}
        onClick={isFocal ? undefined : () => focusAnimal(node.animal.id)}
        onKeyDown={
          isFocal
            ? undefined
            : (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  focusAnimal(node.animal.id);
                }
              }
        }
      >
        <div className="pedigree-role-row">
          <span className={`pedigree-role-badge ${isFocal ? 'is-focal' : ''}`}>
            {roleTitle}
          </span>
          <span className={`status-pill status-${node.animal.status}`} style={{ gap: 4 }}>
            <img
              src={getStatusPngIcon(node.animal.status)}
              alt=""
              style={{ width: 11, height: 11, objectFit: 'contain' }}
            />
            {formatStatusLabel(node.animal.status)}
          </span>
        </div>

        <div className="pedigree-node-identity">
          {photoSrc ? (
            <img
              src={photoSrc}
              alt={getAnimalDisplayName(node.animal)}
              className={`pedigree-avatar ${isFocal ? 'is-focal' : ''}`}
            />
          ) : (
            <div className={`pedigree-avatar-empty ${isFocal ? 'is-focal' : ''}`}>
              <img
                src={getSpeciesPngIcon(node.animal.species, node.animal.sex)}
                alt={formatSpeciesLabel(node.animal.species, node.animal.sex)}
                style={{ width: isFocal ? 30 : 22, height: isFocal ? 30 : 22, objectFit: 'contain' }}
              />
            </div>
          )}

          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="pedigree-name-row" style={{ justifyContent: 'space-between' }}>
              <span className="tag-chip">{node.animal.tagNumber}</span>
              <span className={`sex-pill is-compact sex-${node.animal.sex}`} style={{ gap: 4 }}>
                <img
                  src={getSexPngIcon(node.animal.sex)}
                  alt=""
                  style={{ width: 11, height: 11, objectFit: 'contain' }}
                />
                {formatSexLabel(node.animal.sex)}
              </span>
              <AnimalEyeButton livestockId={node.animal.id} />
            </div>
            <strong className="pedigree-animal-name">
              {getAnimalDisplayName(node.animal)}
            </strong>
            <div className="pedigree-animal-meta">
              {node.animal.breed ?? formatSpeciesLabel(node.animal.species, node.animal.sex)} ·{' '}
              {formatAnimalAge(node.animal.dob)}
            </div>
          </div>
        </div>

        {extraSubtitle && (
          <div className="pedigree-extra-hint">{extraSubtitle}</div>
        )}

        <div className="pedigree-node-metrics">
          <span>
            {node.totalMilkLiters > 0
              ? formatVolume(node.totalMilkLiters, settings.volumeUnit)
              : '0 milk logged'}
          </span>
          <span>
            {node.offspringCount}{' '}
            {node.offspringCount === 1 ? 'offspring' : 'offspring'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="family-hero-icon">
            <img src={APP_ICONS.tree} alt="" className="app-icon-lg" />
          </div>
          <div>
            <h1 className="page-title">Herd Family Tree</h1>
          </div>
        </div>

        <div className="row-actions">
          {!canEdit && (
            <span className="permission-badge is-readonly">
              {describeModuleAccessLevel(accessLevel)}
            </span>
          )}
          {pedigree && canEdit && (
            <button
              type="button"
              className={`btn btn-sm ${showLinkPanel ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowLinkPanel((prev) => !prev)}
            >
              <img src={APP_ICONS.pencil} alt="" className="app-icon-sm" />
              {showLinkPanel ? 'Hide Link Editor' : 'Link Parents & Calves'}
            </button>
          )}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-label">Animals in Family Lines</p>
          <p className="stat-value">
            {overview.linkedAnimalsCount} / {allLivestock.length}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Parent–Offspring Bonds</p>
          <p className="stat-value">{overview.parentChildBondsCount}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Deepest Lineage</p>
          <p className="stat-value">
            {overview.maxGenerationDepth > 0
              ? `Gen ${overview.maxGenerationDepth}`
              : '—'}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Herd Dynasties</p>
          <p className="stat-value">
            {overview.dynastyCount}
            {overview.topFoundationParent
              ? ` · Top: ${getAnimalDisplayName(overview.topFoundationParent.animal)}`
              : ''}
          </p>
        </div>
      </div>

      <div className="card">
        <FileTabs
          ariaLabel="Family tree mode"
          surface="card"
          activeId={subView}
          onChange={setSubView}
          tabs={[
            { id: 'pedigree', label: 'Pedigree Tree', iconSrc: APP_ICONS.tree },
            {
              id: 'dynasties',
              label: `Herd Dynasties (${overview.dynastyCount})`,
              iconSrc: APP_ICONS.herd,
            },
            {
              id: 'kinship',
              label: 'Kinship & Breeding',
              iconSrc: APP_ICONS.sync,
            },
          ]}
        />

        <div className="toolbar" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', flex: '1 1 320px' }}>
            <ModernSelect
              ariaLabel="Filter tree by species"
              value={speciesFilter}
              options={speciesOptions}
              onChange={setSpeciesFilter}
            />

            <div style={{ minWidth: 250, flex: '1 1 250px', maxWidth: 380 }}>
              <ModernSelect
                searchable
                fullWidth
                ariaLabel="Select focal animal"
                placeholder="Choose an animal..."
                value={focalId}
                options={focalOptions}
                onChange={(next) => focusAnimal(next)}
                disabled={focalOptions.length === 0}
              />
            </div>
          </div>
        </div>

        {trailIds.length > 0 && subView === 'pedigree' && (
          <div className="lineage-trail-bar">
            <span className="form-label" style={{ marginRight: 4 }}>
              Recently viewed:
            </span>
            {trailIds
              .map((id) => allLivestock.find((a) => a.id === id))
              .filter((a): a is Livestock => Boolean(a))
              .map((item) => (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  className={`lineage-trail-chip ${item.id === focalId ? 'active' : ''}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                  onClick={() => setFocalId(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setFocalId(item.id);
                    }
                  }}
                >
                  <span>
                    {item.tagNumber}
                    {item.name ? ` · ${item.name}` : ''}
                  </span>
                  <AnimalEyeButton livestockId={item.id} size={12} />
                </div>
              ))}
          </div>
        )}

        {allLivestock.length === 0 ? (
          <div className="empty-state">
            <img src={APP_ICONS.tree} alt="" style={{ width: 52, height: 52, marginBottom: 10 }} />
            <p style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem' }}>
              No livestock records yet
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Add animals in Herd Registry to map pedigrees, dynasties, and breeding kinship.
            </p>
          </div>
        ) : subView === 'pedigree' ? (
          !pedigree ? (
            <div className="empty-state">
              No animals match the selected species filter. Switch species above to inspect another herd group.
            </div>
          ) : (
            <div className="family-tree-workspace">
              {showLinkPanel && canEdit && (
                <div className="lineage-editor-panel">
                  <div className="lineage-editor-head">
                    <div>
                      <strong>
                        Edit Lineage for {pedigree.focal.animal.tagNumber}{' '}
                        {pedigree.focal.animal.name ? `(${pedigree.focal.animal.name})` : ''}
                      </strong>
                      <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Assign biological Sire &amp; Dam or attach an existing animal in your herd as offspring.
                      </p>
                    </div>
                  </div>

                  <div className="lineage-editor-grid">
                    <div className="form-field">
                      <label className="form-label">Sire (Father)</label>
                      <ModernSelect
                        searchable
                        fullWidth
                        ariaLabel="Assign Sire"
                        value={draftSireId}
                        options={sireCandidateOptions}
                        onChange={setDraftSireId}
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-label">Dam (Mother)</label>
                      <ModernSelect
                        searchable
                        fullWidth
                        ariaLabel="Assign Dam"
                        value={draftDamId}
                        options={damCandidateOptions}
                        onChange={setDraftDamId}
                      />
                    </div>

                    <div className="lineage-editor-save-col">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={updateMutation.isPending}
                        onClick={() => void handleSaveParentLinks()}
                      >
                        <img src={APP_ICONS.checkmark} alt="" className="app-icon-sm" />
                        Save Parents
                      </button>
                    </div>
                  </div>

                  <div className="lineage-editor-divider" />

                  <div className="lineage-editor-grid">
                    <div className="form-field" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">
                        Attach Existing Herd Animal as Offspring ({getAnimalDisplayName(pedigree.focal.animal)} acts as):
                      </label>
                      <div className="lineage-attach-row">
                        <div className="segmented-group" style={{ flex: '0 0 auto' }}>
                          <button
                            type="button"
                            className={`segmented-btn ${draftChildRole === 'dam' ? 'active' : ''}`}
                            onClick={() => setDraftChildRole('dam')}
                          >
                            Dam
                          </button>
                          <button
                            type="button"
                            className={`segmented-btn ${draftChildRole === 'sire' ? 'active' : ''}`}
                            onClick={() => setDraftChildRole('sire')}
                          >
                            Sire
                          </button>
                        </div>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <ModernSelect
                            searchable
                            fullWidth
                            ariaLabel="Select offspring to link"
                            value={draftChildId}
                            options={childCandidateOptions}
                            onChange={setDraftChildId}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="lineage-editor-save-col">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={!draftChildId || updateMutation.isPending}
                        onClick={() => void handleAttachChild()}
                      >
                        <img src={APP_ICONS.plus} alt="" className="app-icon-sm" />
                        Attach Offspring
                      </button>
                    </div>
                  </div>

                  {linkError && <p className="field-error" style={{ marginTop: 8 }}>{linkError}</p>}
                  {linkSuccess && (
                    <p className="success-hint" style={{ marginTop: 8, marginBottom: 0 }}>
                      {linkSuccess}
                    </p>
                  )}
                </div>
              )}

              {/* Visual Pedigree & Progeny Tree Diagram (Drag with Left-Click to Pan) */}
              <div
                ref={treeCanvasRef}
                className={`family-tree-canvas is-pannable ${isDraggingCanvas ? 'is-dragging' : ''}`}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={endCanvasDrag}
                onMouseLeave={endCanvasDrag}
                onClickCapture={handleCanvasClickCapture}
              >
                <div className="pedigree-summary-ribbon" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                    <span>
                      <strong>{pedigree.totalAncestorsCount}</strong> tracked ancestor(s) ({pedigree.ancestorGenerationDepth} gen back)
                    </span>
                    <span>·</span>
                    <span>
                      <strong>{pedigree.totalDescendantsCount}</strong> tracked descendant(s) ({pedigree.descendantGenerationDepth} gen forward)
                    </span>
                    <span>·</span>
                    <span>
                      <strong>{pedigree.fullSiblings.length + pedigree.halfSiblings.length}</strong> sibling(s)
                    </span>
                  </div>

                  <div
                    className="segmented-group pedigree-display-toggle"
                    role="group"
                    aria-label="Pedigree view mode"
                    style={{ padding: 3 }}
                  >
                    <button
                      type="button"
                      className={`segmented-btn ${treeDisplayMode === 'pedigree' ? 'active' : ''}`}
                      style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                      onClick={() => setTreeDisplayMode('pedigree')}
                    >
                      Pedigree Tree
                    </button>
                    <button
                      type="button"
                      className={`segmented-btn ${treeDisplayMode === 'graph' ? 'active' : ''}`}
                      style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                      onClick={() => setTreeDisplayMode('graph')}
                    >
                      Simplified Graph
                    </button>
                  </div>
                </div>

                {treeDisplayMode === 'graph' && simplifiedGraph ? (
                  <div className="pedigree-graph-wrap">
                    <div className="pedigree-graph-legend">
                      <span className="pedigree-graph-legend-item">
                        <span className="pedigree-graph-legend-dot is-sire" />
                        Paternal (Sire) Line
                      </span>
                      <span className="pedigree-graph-legend-item">
                        <span className="pedigree-graph-legend-dot is-dam" />
                        Maternal (Dam) Line
                      </span>
                      <span className="pedigree-graph-legend-item">
                        <span className="pedigree-graph-legend-dot is-offspring" />
                        Descendant Line
                      </span>
                      <span className="pedigree-graph-legend-hint">
                        Drag canvas to pan · Click any animal card to focus
                      </span>
                    </div>

                    <div
                      className="pedigree-graph-stage"
                      style={{
                        width: simplifiedGraph.width,
                        height: simplifiedGraph.height,
                      }}
                    >
                      <svg
                        width={simplifiedGraph.width}
                        height={simplifiedGraph.height}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          pointerEvents: 'none',
                        }}
                      >
                        {simplifiedGraph.edges.map((edge) => {
                          const midX = Math.round((edge.fromX + edge.toX) / 2);
                          const d = `M ${edge.fromX} ${edge.fromY} C ${midX} ${edge.fromY}, ${midX} ${edge.toY}, ${edge.toX} ${edge.toY}`;
                          const strokeColor =
                            edge.tone === 'offspring'
                              ? '#1b4332'
                              : edge.tone === 'sire'
                                ? '#2d6a4f'
                                : '#9c6644';
                          return (
                            <g key={edge.key}>
                              <path
                                d={d}
                                fill="none"
                                stroke={strokeColor}
                                strokeWidth={2.4}
                                strokeLinecap="round"
                                opacity={0.86}
                              />
                              <circle
                                cx={edge.fromX}
                                cy={edge.fromY}
                                r={3}
                                fill="#ffffff"
                                stroke={strokeColor}
                                strokeWidth={1.8}
                              />
                              <circle
                                cx={edge.toX}
                                cy={edge.toY}
                                r={3.8}
                                fill={strokeColor}
                              />
                            </g>
                          );
                        })}
                      </svg>

                      {simplifiedGraph.columns.map((col) => (
                        <div
                          key={col.key}
                          className={`pedigree-graph-col-header ${col.key === 'gen-0' ? 'is-focal' : ''}`}
                          style={{ left: col.x, width: col.width }}
                        >
                          <span className="pedigree-graph-col-gen">{col.genTag}</span>
                          <span className="pedigree-graph-col-title">{col.title}</span>
                        </div>
                      ))}

                      {simplifiedGraph.nodes.map((entry) => {
                        const thumb = resolveDesktopImageSrc(entry.node.animal.imageUri);
                        return (
                          <div
                            key={entry.key}
                            role="button"
                            tabIndex={0}
                            className={`pedigree-graph-node ${entry.isFocal ? 'is-focal' : ''}`}
                            style={{
                              left: entry.x,
                              top: entry.y,
                              width: simplifiedGraph.nodeW,
                              minHeight: simplifiedGraph.nodeH,
                            }}
                            onClick={() => focusAnimal(entry.node.animal.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                focusAnimal(entry.node.animal.id);
                              }
                            }}
                          >
                            <div className="pedigree-graph-node-top">
                              <span className="pedigree-graph-role">{entry.roleLabel}</span>
                              <div className="pedigree-graph-top-right">
                                <span
                                  className={`sex-pill is-compact sex-${entry.node.animal.sex}`}
                                  title={formatSexLabel(entry.node.animal.sex)}
                                >
                                  <img
                                    src={getSexPngIcon(entry.node.animal.sex)}
                                    alt={formatSexLabel(entry.node.animal.sex)}
                                    style={{ width: 12, height: 12, objectFit: 'contain' }}
                                  />
                                </span>
                                <AnimalEyeButton livestockId={entry.node.animal.id} size={13} />
                              </div>
                            </div>
                            <div className="pedigree-graph-node-mid">
                              <img
                                src={thumb ?? getSpeciesPngIcon(entry.node.animal.species, entry.node.animal.sex)}
                                alt=""
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: thumb ? 8 : 0,
                                  objectFit: thumb ? 'cover' : 'contain',
                                  flexShrink: 0,
                                }}
                              />
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div className="pedigree-graph-node-name">
                                  {getAnimalDisplayName(entry.node.animal)}
                                </div>
                                <div className="pedigree-graph-node-sub">
                                  <span className="pedigree-graph-tag-inline">
                                    {entry.node.animal.tagNumber}
                                  </span>
                                  <span>·</span>
                                  <span>{formatStatusLabel(entry.node.animal.status)}</span>
                                </div>
                                {entry.node.animal.breed ? (
                                  <div className="pedigree-graph-node-breed">
                                    {entry.node.animal.breed}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                <div className="pedigree-columns">
                  {/* Column 1: Grandparents (Gen -2) */}
                  <div className="pedigree-stage">
                    <div className="pedigree-stage-header">
                      <span className="pedigree-gen-tag">Gen −2</span>
                      <span>Grandparents</span>
                    </div>

                    <div className="pedigree-gp-cluster">
                      <span className="pedigree-cluster-caption">Paternal Line</span>
                      {renderPedigreeCard(pedigree.paternalGrandsire, 'Paternal Grandsire', 'grandparent')}
                      {renderPedigreeCard(pedigree.paternalGranddam, 'Paternal Granddam', 'grandparent')}
                    </div>

                    <div className="pedigree-gp-cluster">
                      <span className="pedigree-cluster-caption">Maternal Line</span>
                      {renderPedigreeCard(pedigree.maternalGrandsire, 'Maternal Grandsire', 'grandparent')}
                      {renderPedigreeCard(pedigree.maternalGranddam, 'Maternal Granddam', 'grandparent')}
                    </div>
                  </div>

                  <div className="pedigree-branch-connector" aria-hidden="true">
                    <div className="branch-arm top" />
                    <div className="branch-arm bottom" />
                    <div className="branch-stem" />
                  </div>

                  {/* Column 2: Parents (Gen -1) */}
                  <div className="pedigree-stage">
                    <div className="pedigree-stage-header">
                      <span className="pedigree-gen-tag">Gen −1</span>
                      <span>Parents</span>
                    </div>

                    <div className="pedigree-parents-stack">
                      {renderPedigreeCard(pedigree.sire, 'Sire (Father)', 'parent')}
                      {renderPedigreeCard(pedigree.dam, 'Dam (Mother)', 'parent')}
                    </div>
                  </div>

                  <div className="pedigree-merge-connector" aria-hidden="true">
                    <div className="merge-bracket" />
                    <div className="merge-stem" />
                  </div>

                  {/* Column 3: Focal Animal (Gen 0) */}
                  <div className="pedigree-stage is-focal-stage">
                    <div className="pedigree-stage-header">
                      <span className="pedigree-gen-tag is-focal">Gen 0</span>
                      <span>Selected Animal</span>
                    </div>

                    {renderPedigreeCard(pedigree.focal, 'Selected Animal', 'focal')}

                    {pedigree.greatGrandparents.length > 0 && (
                      <div className="ggp-strip">
                        <span className="pedigree-cluster-caption">
                          Gen −3 Great-Grandparents
                        </span>
                        <div className="ggp-chip-list">
                          {pedigree.greatGrandparents.map((entry) => (
                            <button
                              key={`${entry.role}-${entry.animal.animal.id}`}
                              type="button"
                              className="ggp-chip"
                              onClick={() => focusAnimal(entry.animal.animal.id)}
                            >
                              <span>{entry.role}:</span>
                              <strong>
                                {entry.animal.animal.tagNumber}
                                {entry.animal.animal.name
                                  ? ` (${entry.animal.animal.name})`
                                  : ''}
                              </strong>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pedigree-branch-connector is-progeny" aria-hidden="true">
                    <div className="branch-stem" />
                    <div className="branch-arm top" />
                    <div className="branch-arm bottom" />
                  </div>

                  {/* Column 4: Direct Offspring & Grand-Offspring (Gen +1 / +2) */}
                  <div className="pedigree-stage">
                    <div className="pedigree-stage-header">
                      <span className="pedigree-gen-tag">Gen +1 / +2</span>
                      <span>Progeny ({pedigree.directOffspring.length})</span>
                    </div>

                    {pedigree.directOffspring.length === 0 ? (
                      <div className="pedigree-node-card is-empty variant-offspring">
                        <div className="pedigree-role-row">
                          <span className="pedigree-role-badge">Offspring</span>
                        </div>
                        <p className="pedigree-empty-label">
                          No registered calves, kids, or lambs recorded under this parent yet.
                        </p>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ marginTop: 6, width: '100%' }}
                          onClick={() => setShowLinkPanel(true)}
                        >
                          + Link Existing Offspring
                        </button>
                      </div>
                    ) : (
                      <div className="pedigree-offspring-stack">
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
                            <div key={child.animal.id} className="pedigree-offspring-branch">
                              {renderPedigreeCard(
                                child,
                                child.sireId === pedigree.focal.animal.id
                                  ? 'Offspring (By Sire)'
                                  : 'Offspring (By Dam)',
                                'offspring',
                                otherParent
                                  ? `Co-parent: ${otherParent.tagNumber}${otherParent.name ? ` · ${otherParent.name}` : ''}`
                                  : undefined
                              )}
                              {grandchildren.length > 0 && (
                                <div className="grandchild-chip-row">
                                  <span className="grandchild-connector-dot" />
                                  {grandchildren.map((gc) => (
                                    <div
                                      key={gc.animal.animal.id}
                                      role="button"
                                      tabIndex={0}
                                      className="grandchild-pill"
                                      onClick={() => focusAnimal(gc.animal.animal.id)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          focusAnimal(gc.animal.animal.id);
                                        }
                                      }}
                                    >
                                      <span>Gen +2:</span>
                                      <strong>
                                        {gc.animal.animal.tagNumber}
                                        {gc.animal.animal.name
                                          ? ` (${gc.animal.animal.name})`
                                          : ''}
                                      </strong>
                                      <AnimalEyeButton livestockId={gc.animal.animal.id} size={12} />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                )}
              </div>

              {/* Extended Family Relationships below diagram */}
              <div className="split-grid">
                <div className="card" style={{ padding: 14, background: '#faf8f4' }}>
                  <h3 className="card-section-title">
                    Siblings ({pedigree.fullSiblings.length + pedigree.halfSiblings.length})
                  </h3>
                  {pedigree.fullSiblings.length === 0 && pedigree.halfSiblings.length === 0 ? (
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      No siblings found sharing Sire or Dam.
                    </p>
                  ) : (
                    <div className="relatives-list">
                      {pedigree.fullSiblings.map((sib) => (
                        <div
                          key={sib.animal.id}
                          role="button"
                          tabIndex={0}
                          className="relative-row-btn"
                          onClick={() => focusAnimal(sib.animal.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              focusAnimal(sib.animal.id);
                            }
                          }}
                        >
                          <img
                            src={getSpeciesPngIcon(sib.animal.species, sib.animal.sex)}
                            alt=""
                            className="app-icon-md"
                          />
                          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span className="tag-chip">{sib.animal.tagNumber}</span>
                              <AnimalEyeButton livestockId={sib.animal.id} />
                              <strong>{getAnimalDisplayName(sib.animal)}</strong>
                              <span className="auto-tag">Full Sibling</span>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              Shares both Sire &amp; Dam · {formatAnimalAge(sib.animal.dob)}
                            </div>
                          </div>
                        </div>
                      ))}

                      {pedigree.halfSiblings.map((entry) => (
                        <div
                          key={`${entry.sharedParentRole}-${entry.animal.animal.id}`}
                          role="button"
                          tabIndex={0}
                          className="relative-row-btn"
                          onClick={() => focusAnimal(entry.animal.animal.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              focusAnimal(entry.animal.animal.id);
                            }
                          }}
                        >
                          <img
                            src={getSpeciesPngIcon(entry.animal.animal.species, entry.animal.animal.sex)}
                            alt=""
                            className="app-icon-md"
                          />
                          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span className="tag-chip">{entry.animal.animal.tagNumber}</span>
                              <AnimalEyeButton livestockId={entry.animal.animal.id} />
                              <strong>{getAnimalDisplayName(entry.animal.animal)}</strong>
                              <span className="relative-pill-muted">
                                Half-Sibling ({entry.sharedParentRole})
                              </span>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              Shared {entry.sharedParentRole}:{' '}
                              {getAnimalDisplayName(entry.sharedParent.animal)} (
                              {entry.sharedParent.animal.tagNumber})
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card" style={{ padding: 14, background: '#faf8f4' }}>
                  <h3 className="card-section-title">
                    Breeding Partners &amp; Co-Parents ({pedigree.coParents.length})
                  </h3>
                  {pedigree.coParents.length === 0 ? (
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      No paired co-parents linked via shared offspring yet.
                    </p>
                  ) : (
                    <div className="relatives-list">
                      {pedigree.coParents.map((cp) => (
                        <div
                          key={cp.partner.animal.id}
                          role="button"
                          tabIndex={0}
                          className="relative-row-btn"
                          onClick={() => focusAnimal(cp.partner.animal.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              focusAnimal(cp.partner.animal.id);
                            }
                          }}
                        >
                          <img
                            src={getSpeciesPngIcon(cp.partner.animal.species, cp.partner.animal.sex)}
                            alt=""
                            className="app-icon-md"
                          />
                          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span className="tag-chip">{cp.partner.animal.tagNumber}</span>
                              <AnimalEyeButton livestockId={cp.partner.animal.id} />
                              <strong>{getAnimalDisplayName(cp.partner.animal)}</strong>
                              <span className="auto-tag">
                                {cp.sharedOffspring.length} shared{' '}
                                {cp.sharedOffspring.length === 1 ? 'calf' : 'offspring'}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              Offspring:{' '}
                              {cp.sharedOffspring
                                .map((c) => `${c.animal.tagNumber}${c.animal.name ? ` (${c.animal.name})` : ''}`)
                                .join(', ')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        ) : subView === 'dynasties' ? (
          overview.dynasties.length === 0 ? (
            <div className="empty-state">
              <p style={{ margin: 0, fontWeight: 700 }}>
                No connected herd bloodlines yet
              </p>
            </div>
          ) : (
            <div className="dynasty-grid">
              {overview.dynasties.map((dynasty) => {
                const parentLookup = new Map(
                  dynasty.members.map((m) => [m.animal.id, m.animal])
                );
                return (
                  <div key={dynasty.id} className="dynasty-card">
                    <div className="dynasty-card-head">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <img
                          src={
                            dynasty.species === 'mixed'
                              ? APP_ICONS.herd
                              : getSpeciesPngIcon(dynasty.species)
                          }
                          alt=""
                          className="app-icon-lg"
                        />
                        <div>
                          <h3 style={{ margin: 0, fontSize: '1.08rem' }}>{dynasty.name}</h3>
                          <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {dynasty.members.length} animal(s) · {dynasty.generationSpan}{' '}
                            {dynasty.generationSpan === 1 ? 'generation' : 'generations'} ·{' '}
                            {dynasty.activeCount} active
                          </p>
                        </div>
                      </div>

                      <div className="dynasty-milk-pill">
                        <span>Bloodline Milk</span>
                        <strong>{formatVolume(dynasty.totalMilkLiters, settings.volumeUnit)}</strong>
                      </div>
                    </div>

                    <div className="dynasty-layers">
                      {dynasty.generations.map((layer, idx) => (
                        <div key={layer.depth} className="dynasty-layer">
                          {idx > 0 && (
                            <div className="dynasty-layer-arrow" aria-hidden="true">
                              ↓ descends to
                            </div>
                          )}
                          <div className="dynasty-layer-label">{layer.label}</div>
                          <div className="dynasty-member-row">
                            {layer.members.map((member) => {
                              const sire = member.sireId
                                ? parentLookup.get(member.sireId)
                                : null;
                              const dam = member.damId
                                ? parentLookup.get(member.damId)
                                : null;
                              const isSelectedFocal = member.animal.id === focalId;

                              return (
                                <div
                                  key={member.animal.id}
                                  role="button"
                                  tabIndex={0}
                                  className={`dynasty-member-chip ${isSelectedFocal ? 'active' : ''}`}
                                  onClick={() => focusAnimal(member.animal.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      focusAnimal(member.animal.id);
                                    }
                                  }}
                                >
                                  <div className="dynasty-chip-top">
                                    <span className="tag-chip">{member.animal.tagNumber}</span>
                                    <AnimalEyeButton livestockId={member.animal.id} size={13} />
                                    <strong>{getAnimalDisplayName(member.animal)}</strong>
                                  </div>
                                  <div className="dynasty-chip-sub">
                                    {sire || dam
                                      ? `Parents: ${sire?.tagNumber ?? '?'} × ${dam?.tagNumber ?? '?'}`
                                      : 'Founder (Gen 1)'}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="kinship-checker-card">
            <div className="kinship-selector-row">
              <div className="form-field" style={{ flex: '1 1 220px' }}>
                <label className="form-label">Animal A</label>
                <ModernSelect
                  searchable
                  fullWidth
                  ariaLabel="Select first animal for kinship check"
                  value={pairAId}
                  options={allAnimalSelectOptions}
                  onChange={setPairAId}
                />
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ alignSelf: 'flex-end', marginBottom: 2 }}
                onClick={() => {
                  const prevA = pairAId;
                  setPairAId(pairBId);
                  setPairBId(prevA);
                }}
              >
                <img src={APP_ICONS.sync} alt="" className="app-icon-sm" />
                Swap
              </button>

              <div className="form-field" style={{ flex: '1 1 220px' }}>
                <label className="form-label">Animal B</label>
                <ModernSelect
                  searchable
                  fullWidth
                  ariaLabel="Select second animal for kinship check"
                  value={pairBId}
                  options={allAnimalSelectOptions}
                  onChange={setPairBId}
                />
              </div>
            </div>

            {kinshipReport && (
              <div className={`kinship-result-box risk-${kinshipReport.riskLevel}`}>
                <div className="kinship-result-head">
                  <div>
                    <span className={`kinship-risk-badge risk-${kinshipReport.riskLevel}`}>
                      {kinshipReport.riskLevel === 'safe'
                        ? 'Safe Outcross Match'
                        : kinshipReport.riskLevel === 'caution'
                          ? 'Caution · Shared Ancestry'
                          : 'High Inbreeding Risk'}
                    </span>
                    <h3 style={{ margin: '8px 0 4px', fontSize: '1.15rem' }}>
                      {kinshipReport.relationshipLabel}
                    </h3>
                  </div>

                  <div className="kinship-coef-box">
                    <span>Estimated Kinship (R)</span>
                    <strong>{kinshipReport.relationshipPercent}%</strong>
                  </div>
                </div>

                <p style={{ margin: '6px 0 12px', fontSize: '0.92rem' }}>
                  {kinshipReport.summary}
                </p>

                {kinshipReport.animalA.animal.species !==
                  kinshipReport.animalB.animal.species && (
                  <p className="field-error" style={{ margin: '0 0 10px' }}>
                    Note: {kinshipReport.animalA.animal.tagNumber} and{' '}
                    {kinshipReport.animalB.animal.tagNumber} belong to different species (
                    {formatSpeciesLabel(kinshipReport.animalA.animal.species)} vs{' '}
                    {formatSpeciesLabel(kinshipReport.animalB.animal.species)}).
                  </p>
                )}

                {kinshipReport.sharedAncestors.length > 0 && (
                  <div>
                    <span className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                      Common Ancestors in Pedigree:
                    </span>
                    <div className="lineage-pill-row">
                      {kinshipReport.sharedAncestors.map((anc) => (
                        <div
                          key={anc.animal.id}
                          role="button"
                          tabIndex={0}
                          className="lineage-rel-pill"
                          onClick={() => focusAnimal(anc.animal.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              focusAnimal(anc.animal.id);
                            }
                          }}
                        >
                          <img
                            src={getSpeciesPngIcon(anc.animal.species, anc.animal.sex)}
                            alt=""
                            className="app-icon-sm"
                          />
                          <strong>{getAnimalDisplayName(anc.animal)}</strong>
                          <span className="tag-chip">{anc.animal.tagNumber}</span>
                          <AnimalEyeButton livestockId={anc.animal.id} size={13} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
