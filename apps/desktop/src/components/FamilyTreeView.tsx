import { useEffect, useMemo, useState } from 'react';
import {
  analyzeBreedingPair,
  buildAnimalPedigree,
  buildHerdLineageOverview,
  DEFAULT_FARM_SETTINGS,
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
  useFarmSettings,
  useLivestockList,
  useProductRecordList,
  useUpdateLivestock,
} from '@farmdb/db';
import {
  APP_ICONS,
  getSpeciesPngIcon,
  getStatusPngIcon,
} from '../assets/icons';
import { resolveDesktopImageSrc } from '../services/imageStorage';
import { buildAnimalSelectOption } from '../utils/animalOptions';
import { AnimalEyeButton } from './AnimalQuickPreviewModal';
import { FileTabs } from './FileTabs';
import { ModernSelect, type ModernSelectOption } from './ModernSelect';

type TreeSubView = 'pedigree' | 'dynasties' | 'kinship';

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
  const createMutation = useCreateLivestock();
  const updateMutation = useUpdateLivestock();

  const settings = settingsQuery.data ?? DEFAULT_FARM_SETTINGS;
  const allLivestock = livestockQuery.data ?? [];
  const allProducts = productQuery.data ?? [];

  const [speciesFilter, setSpeciesFilter] = useState<Species | 'all'>('all');
  const [subView, setSubView] = useState<TreeSubView>('pedigree');
  const [focalId, setFocalId] = useState<string>('');
  const [trailIds, setTrailIds] = useState<string[]>([]);
  const [showLinkPanel, setShowLinkPanel] = useState(false);

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
    if (!pedigree) return;
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
    if (!pedigree || !draftChildId) return;
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

  async function handleSeedSampleLineage() {
    setLinkError(null);
    setLinkSuccess(null);

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
        const needsUpdate =
          (!existing.sireId && targetSireId) || (!existing.damId && targetDamId);
        if (needsUpdate) {
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

    const bullTitan = await ensureAnimal({
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

    setFocalId(bessie.id || bullTitan.id);
    setSubView('pedigree');
    setLinkSuccess('Sample 3-generation family tree linked in local SQLite.');
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
          {variant === 'parent' && pedigree && (
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
                src={getSpeciesPngIcon(node.animal.species)}
                alt={node.animal.species}
                style={{ width: isFocal ? 30 : 22, height: isFocal ? 30 : 22, objectFit: 'contain' }}
              />
            </div>
          )}

          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="pedigree-name-row" style={{ justifyContent: 'space-between' }}>
              <span className="tag-chip">{node.animal.tagNumber}</span>
              <AnimalEyeButton livestockId={node.animal.id} />
            </div>
            <strong className="pedigree-animal-name">
              {getAnimalDisplayName(node.animal)}
            </strong>
            <div className="pedigree-animal-meta">
              {node.animal.breed ?? formatSpeciesLabel(node.animal.species)} ·{' '}
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
          {pedigree && (
            <button
              type="button"
              className={`btn btn-sm ${showLinkPanel ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowLinkPanel((prev) => !prev)}
            >
              <img src={APP_ICONS.pencil} alt="" className="app-icon-sm" />
              {showLinkPanel ? 'Hide Link Editor' : 'Link Parents & Calves'}
            </button>
          )}
          {overview.parentChildBondsCount === 0 && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void handleSeedSampleLineage()}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              <img src={APP_ICONS.tree} alt="" className="app-icon-sm" />
              {allLivestock.length === 0
                ? 'Load Sample Family Tree'
                : 'Link Sample Family Tree'}
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
            <div className="empty-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleSeedSampleLineage()}
                disabled={createMutation.isPending}
              >
                <img src={APP_ICONS.tree} alt="" className="app-icon-sm" />
                Load 3-Generation Sample Herd
              </button>
            </div>
          </div>
        ) : subView === 'pedigree' ? (
          !pedigree ? (
            <div className="empty-state">
              No animals match the selected species filter. Switch species above to inspect another herd group.
            </div>
          ) : (
            <div className="family-tree-workspace">
              {showLinkPanel && (
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

              {/* Visual Pedigree & Progeny Tree Diagram */}
              <div className="family-tree-canvas">
                <div className="pedigree-summary-ribbon">
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
                            src={getSpeciesPngIcon(sib.animal.species)}
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
                            src={getSpeciesPngIcon(entry.animal.animal.species)}
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
                            src={getSpeciesPngIcon(cp.partner.animal.species)}
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
              <div className="empty-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => void handleSeedSampleLineage()}
                >
                  <img src={APP_ICONS.tree} alt="" className="app-icon-sm" />
                  Link Sample Family Tree
                </button>
              </div>
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
                            src={getSpeciesPngIcon(anc.animal.species)}
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
