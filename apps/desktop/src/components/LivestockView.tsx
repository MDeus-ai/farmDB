import { useMemo, useState } from 'react';
import { LayoutGrid, List, Search } from 'lucide-react';
import {
  DEFAULT_FARM_SETTINGS,
  formatAnimalAge,
  formatDisplayDate,
  formatOwnershipCategoryLabel,
  formatSpeciesLabel,
  formatStatusLabel,
  getPrimaryOwnershipByLivestockMap,
  LIVESTOCK_STATUSES,
  sortLivestockItems,
  SPECIES_LIST,
  type Livestock,
  type LivestockFilter,
  type LivestockSortOption,
  type LivestockStatus,
  type Species,
} from '@farmdb/core';
import {
  useCreateLivestock,
  useDeleteLivestock,
  useFarmSettings,
  useFarmSummary,
  useLivestockList,
  useOwnershipList,
} from '@farmdb/db';
import {
  APP_ICONS,
  getSpeciesPngIcon,
  getStatusPngIcon,
} from '../assets/icons';
import {
  deleteManagedDesktopImage,
  resolveDesktopImageSrc,
} from '../services/imageStorage';
import { LivestockDetailModal } from './LivestockDetailModal';
import { LivestockFormModal } from './LivestockFormModal';
import { ModernSelect, type ModernSelectOption } from './ModernSelect';

interface LivestockViewProps {
  onOpenFamilyTree?: (animalId: string) => void;
}

export function LivestockView({ onOpenFamilyTree }: LivestockViewProps) {
  const [search, setSearch] = useState('');
  const [species, setSpecies] = useState<Species | 'all'>('all');
  const [status, setStatus] = useState<LivestockStatus | 'all'>('active');
  const [sortBy, setSortBy] = useState<LivestockSortOption>('updated');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Livestock | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const settingsQuery = useFarmSettings();
  const settings = settingsQuery.data ?? DEFAULT_FARM_SETTINGS;

  const filter: LivestockFilter = useMemo(
    () => ({ search, species, status }),
    [search, species, status]
  );

  const listQuery = useLivestockList(filter);
  const allForTagsQuery = useLivestockList({});
  const ownershipsQuery = useOwnershipList({ status: 'active' });
  const summaryQuery = useFarmSummary();
  const createMutation = useCreateLivestock();
  const deleteMutation = useDeleteLivestock();

  const ownershipByAnimal = useMemo(
    () => getPrimaryOwnershipByLivestockMap(ownershipsQuery.data ?? []),
    [ownershipsQuery.data]
  );

  const existingTags = useMemo(
    () => (allForTagsQuery.data ?? []).map((item) => item.tagNumber),
    [allForTagsQuery.data]
  );

  const items = useMemo(
    () => sortLivestockItems(listQuery.data ?? [], sortBy),
    [listQuery.data, sortBy]
  );

  const summary = summaryQuery.data;

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

  const statusOptions = useMemo<ModernSelectOption<LivestockStatus | 'all'>[]>(
    () => [
      { value: 'all', label: 'All Statuses', iconSrc: APP_ICONS.barnAlt },
      ...LIVESTOCK_STATUSES.map((st) => ({
        value: st,
        label: formatStatusLabel(st),
        iconSrc: getStatusPngIcon(st),
      })),
    ],
    []
  );

  const sortOptions = useMemo<ModernSelectOption<LivestockSortOption>[]>(
    () => [
      { value: 'updated', label: 'Recently Updated', iconSrc: APP_ICONS.sync },
      { value: 'created_desc', label: 'Added (Newest)', iconSrc: APP_ICONS.calendar },
      { value: 'created_asc', label: 'Added (Oldest)', iconSrc: APP_ICONS.hourglass },
      { value: 'dob_desc', label: 'Birth Date (Youngest)', iconSrc: APP_ICONS.sprout },
      { value: 'dob_asc', label: 'Birth Date (Oldest)', iconSrc: APP_ICONS.calendar },
      { value: 'tag', label: 'Tag # (A–Z)', iconSrc: APP_ICONS.pin },
      { value: 'name', label: 'Name (A–Z)', iconSrc: APP_ICONS.copyWriting },
    ],
    []
  );

  async function handleSeedSample() {
    const existingByTag = new Map(
      (allForTagsQuery.data ?? []).map((item) => [item.tagNumber, item.id])
    );

    async function ensureSampleAnimal(input: {
      tagNumber: string;
      name: string;
      breed: string;
      dob: string;
      sireTag?: string;
      damTag?: string;
    }) {
      const alreadyId = existingByTag.get(input.tagNumber);
      if (alreadyId) return alreadyId;
      const created = await createMutation.mutateAsync({
        species: 'cow',
        tagNumber: input.tagNumber,
        name: input.name,
        breed: input.breed,
        dob: input.dob,
        status: 'active',
        sireId: input.sireTag ? (existingByTag.get(input.sireTag) ?? null) : null,
        damId: input.damTag ? (existingByTag.get(input.damTag) ?? null) : null,
      });
      existingByTag.set(created.tagNumber, created.id);
      return created.id;
    }

    await ensureSampleAnimal({
      tagNumber: 'BULL-101',
      name: 'Titan',
      breed: 'Holstein',
      dob: '2019-04-10',
    });
    await ensureSampleAnimal({
      tagNumber: 'COW-318',
      name: 'Willow',
      breed: 'Ayrshire',
      dob: '2020-03-18',
    });
    await ensureSampleAnimal({
      tagNumber: 'BULL-108',
      name: 'Orion',
      breed: 'Jersey',
      dob: '2020-07-12',
    });
    await ensureSampleAnimal({
      tagNumber: 'COW-402',
      name: 'Bessie',
      breed: 'Holstein',
      dob: '2022-03-14',
      sireTag: 'BULL-101',
      damTag: 'COW-318',
    });
    await ensureSampleAnimal({
      tagNumber: 'COW-409',
      name: 'Daisy',
      breed: 'Jersey',
      dob: '2022-09-02',
      sireTag: 'BULL-108',
      damTag: 'COW-318',
    });
    await ensureSampleAnimal({
      tagNumber: 'COW-512',
      name: 'Clover',
      breed: 'Holstein',
      dob: '2024-06-21',
      sireTag: 'BULL-108',
      damTag: 'COW-402',
    });
  }

  async function handleDelete(item: Livestock) {
    if (settings.confirmBeforeDelete && confirmDeleteId !== item.id) {
      setConfirmDeleteId(item.id);
      return;
    }
    setConfirmDeleteId(null);
    const removed = await deleteMutation.mutateAsync(item.id);
    if (removed) {
      await deleteManagedDesktopImage(item.imageUri);
      if (selectedId === item.id) {
        setSelectedId(null);
      }
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Herd Registry</h1>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <img src={APP_ICONS.plus} alt="" className="app-icon-sm" />
          Add Livestock
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-label">Active Animals</p>
          <p className="stat-value">{summary?.activeLivestock ?? 0}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Registered Cows</p>
          <p className="stat-value">{summary?.cowCount ?? 0}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Total Herd Records</p>
          <p className="stat-value">{summary?.totalLivestock ?? 0}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Sold / Deceased</p>
          <p className="stat-value">
            {(summary?.soldLivestock ?? 0) + (summary?.deceasedLivestock ?? 0)}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="search-wrap">
            <Search size={16} className="search-icon" />
            <input
              className="input"
              placeholder="Search tag number, name, or breed..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <ModernSelect
            ariaLabel="Filter by species"
            value={species}
            options={speciesOptions}
            onChange={setSpecies}
          />

          <ModernSelect
            ariaLabel="Filter by status"
            value={status}
            options={statusOptions}
            onChange={setStatus}
          />

          <ModernSelect
            ariaLabel="Sort livestock"
            value={sortBy}
            options={sortOptions}
            onChange={setSortBy}
          />

          <div className="view-toggle" role="group" aria-label="View layout">
            <button
              type="button"
              className={viewMode === 'table' ? 'active' : ''}
              onClick={() => setViewMode('table')}
              aria-label="Table view"
            >
              <List size={16} />
            </button>
            <button
              type="button"
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
              aria-label="Card grid view"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>

        {listQuery.isLoading ? (
          <div className="empty-state">Loading local SQLite records...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <p style={{ margin: 0, fontWeight: 600 }}>
              No livestock found.
            </p>
            <div className="empty-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setEditing(null);
                  setModalOpen(true);
                }}
              >
                <img src={APP_ICONS.plus} alt="" className="app-icon-sm" />
                Add First Animal
              </button>
              {(summary?.totalLivestock ?? 0) === 0 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleSeedSample}
                  disabled={createMutation.isPending}
                >
                  <img src={APP_ICONS.farmer} alt="" className="app-icon-sm" />
                  Load Sample Herd
                </button>
              )}
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="herd-grid">
            {items.map((item) => {
              const imageSrc = resolveDesktopImageSrc(item.imageUri);
              const spIcon = getSpeciesPngIcon(item.species);
              const own = ownershipByAnimal.get(item.id);
              const showOwnershipTag = own && own.ownershipCategory !== 'farm_owned';
              return (
                <div
                  key={item.id}
                  className="herd-card"
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="herd-card-media">
                    {imageSrc ? (
                      <img src={imageSrc} alt={item.name ?? item.tagNumber} />
                    ) : (
                      <img
                        src={spIcon}
                        alt={item.species}
                        style={{ width: 54, height: 54, objectFit: 'contain' }}
                      />
                    )}
                  </div>
                  <div className="herd-card-body">
                    <div className="herd-card-top">
                      <span className="tag-chip">{item.tagNumber}</span>
                      <span className={`status-pill status-${item.status}`}>
                        {formatStatusLabel(item.status)}
                      </span>
                    </div>
                    <strong style={{ fontSize: '1.02rem' }}>
                      {item.name ?? 'Unnamed Animal'}
                    </strong>
                    <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                      {formatSpeciesLabel(item.species)}
                      {item.breed ? ` · ${item.breed}` : ''} · Age: {formatAnimalAge(item.dob)}
                    </span>
                    {showOwnershipTag && (
                      <span className="ownership-category-pill" style={{ marginTop: 4 }}>
                        {formatOwnershipCategoryLabel(own.ownershipCategory)} · {own.ownerName}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Animal</th>
                  <th>Species</th>
                  <th>Breed</th>
                  <th>DOB / Age</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const thumbSrc = resolveDesktopImageSrc(item.imageUri);
                  const own = ownershipByAnimal.get(item.id);
                  const showOwnershipTag = own && own.ownershipCategory !== 'farm_owned';
                  return (
                    <tr
                      key={item.id}
                      className="table-row-clickable"
                      onClick={() => setSelectedId(item.id)}
                    >
                      <td>
                        <div className="animal-cell">
                          {thumbSrc ? (
                            <img
                              src={thumbSrc}
                              alt={item.name ?? item.tagNumber}
                              className="animal-thumb"
                            />
                          ) : (
                            <div className="animal-thumb-placeholder">
                              <img
                                src={getSpeciesPngIcon(item.species)}
                                alt=""
                                style={{ width: 22, height: 22, objectFit: 'contain' }}
                              />
                            </div>
                          )}
                          <div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span className="tag-chip">{item.tagNumber}</span>
                              <strong>{item.name ?? 'Unnamed'}</strong>
                              {showOwnershipTag && (
                                <span className="ownership-category-pill">
                                  {own.ownerName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <img
                            src={getSpeciesPngIcon(item.species)}
                            alt=""
                            className="app-icon-sm"
                          />
                          {formatSpeciesLabel(item.species)}
                        </span>
                      </td>
                      <td>{item.breed ?? '—'}</td>
                      <td>
                        {formatDisplayDate(item.dob, settings.dateFormat)}
                        {item.dob ? ` (${formatAnimalAge(item.dob)})` : ''}
                      </td>
                      <td>
                        <span className={`status-pill status-${item.status}`} style={{ gap: 5 }}>
                          <img
                            src={getStatusPngIcon(item.status)}
                            alt=""
                            style={{ width: 13, height: 13, objectFit: 'contain' }}
                          />
                          {formatStatusLabel(item.status)}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setEditing(item);
                              setModalOpen(true);
                            }}
                            aria-label={`Edit ${item.tagNumber}`}
                          >
                            <img src={APP_ICONS.pencil} alt="" className="app-icon-sm" />
                          </button>
                          {confirmDeleteId === item.id ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => void handleDelete(item)}
                                disabled={deleteMutation.isPending}
                              >
                                <img src={APP_ICONS.checkmark} alt="" className="app-icon-sm" />
                                Confirm
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => void handleDelete(item)}
                              disabled={deleteMutation.isPending}
                              aria-label={`Delete ${item.tagNumber}`}
                            >
                              <img src={APP_ICONS.delete} alt="" className="app-icon-sm" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <LivestockDetailModal
        livestockId={selectedId}
        onClose={() => setSelectedId(null)}
        onSelectAnimal={(id) => setSelectedId(id)}
        onOpenFamilyTree={onOpenFamilyTree}
        onEdit={(animal) => {
          setSelectedId(null);
          setEditing(animal);
          setModalOpen(true);
        }}
      />

      <LivestockFormModal
        open={modalOpen}
        editing={editing}
        existingTags={existingTags}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
