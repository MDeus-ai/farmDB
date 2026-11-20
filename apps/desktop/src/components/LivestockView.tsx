import { useMemo, useState } from 'react';
import { LayoutGrid, List, Search } from 'lucide-react';
import {
  DEFAULT_FARM_SETTINGS,
  describeModuleAccessLevel,
  formatAnimalAge,
  formatDisplayDate,
  formatOwnershipCategoryLabel,
  formatSexLabel,
  formatSpeciesLabel,
  formatStatusLabel,
  getPrimaryOwnershipByLivestockMap,
  LIVESTOCK_SEXES,
  LIVESTOCK_STATUSES,
  sortLivestockItems,
  SPECIES_LIST,
  type Livestock,
  type LivestockFilter,
  type LivestockSex,
  type LivestockSortOption,
  type LivestockStatus,
  type Species,
} from '@farmdb/core';
import {
  useDeleteLivestock,
  useFarmSettings,
  useLivestockList,
  useModulePermissions,
  useOwnershipList,
} from '@farmdb/db';
import {
  APP_ICONS,
  getSexPngIcon,
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
  type SpeciesFilterChoice = 'all' | 'cattle' | 'cow' | 'bull' | 'goat' | 'sheep' | 'duck' | 'other';
  const [search, setSearch] = useState('');
  const [speciesChoice, setSpeciesChoice] = useState<SpeciesFilterChoice>('all');
  const [sexFilter, setSexFilter] = useState<LivestockSex | 'all'>('all');
  const [status, setStatus] = useState<LivestockStatus | 'all'>('active');
  const [sortBy, setSortBy] = useState<LivestockSortOption>('updated');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Livestock | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const settingsQuery = useFarmSettings();
  const settings = settingsQuery.data ?? DEFAULT_FARM_SETTINGS;
  const { canEdit, canDelete, accessLevel } = useModulePermissions('livestock');

  const querySpecies: Species | 'all' =
    speciesChoice === 'cattle' || speciesChoice === 'bull' || speciesChoice === 'cow'
      ? 'cow'
      : speciesChoice;

  const filter: LivestockFilter = useMemo(
    () => ({ search, species: querySpecies, sex: sexFilter, status }),
    [search, querySpecies, sexFilter, status]
  );

  const listQuery = useLivestockList(filter);
  const allForTagsQuery = useLivestockList({});
  const ownershipsQuery = useOwnershipList({ status: 'active' });
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

  const speciesOptions = useMemo<ModernSelectOption<SpeciesFilterChoice>[]>(
    () => [
      { value: 'all', label: 'All Species', iconSrc: APP_ICONS.group },
      { value: 'cow', label: 'Cow', iconSrc: getSpeciesPngIcon('cow', 'female') },
      { value: 'bull', label: 'Bull', iconSrc: getSpeciesPngIcon('cow', 'male') },
      { value: 'cattle', label: 'Cattle (All)', iconSrc: APP_ICONS.herd },
      ...SPECIES_LIST.filter((sp) => sp !== 'cow').map((sp) => ({
        value: sp as SpeciesFilterChoice,
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

  const sexFilterOptions = useMemo<ModernSelectOption<LivestockSex | 'all'>[]>(
    () => [
      { value: 'all', label: 'All Sexes', iconSrc: APP_ICONS.group },
      ...LIVESTOCK_SEXES.map((sx) => ({
        value: sx,
        label: formatSexLabel(sx),
        iconSrc: getSexPngIcon(sx),
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

        <div className="row-actions">
          {(!canEdit || !canDelete) && (
            <span className="status-pill status-sold">
              {describeModuleAccessLevel(accessLevel)}
            </span>
          )}
          {canEdit && (
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
          )}
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
            value={speciesChoice}
            options={speciesOptions}
            onChange={(nextChoice) => {
              setSpeciesChoice(nextChoice);
              if (nextChoice === 'cow') {
                setSexFilter('female');
              } else if (nextChoice === 'bull') {
                setSexFilter('male');
              } else if (nextChoice === 'cattle' || nextChoice === 'all') {
                setSexFilter('all');
              }
            }}
          />

          <ModernSelect
            ariaLabel="Filter by sex"
            value={sexFilter}
            options={sexFilterOptions}
            onChange={(nextSex) => {
              setSexFilter(nextSex);
              if (
                speciesChoice === 'cow' ||
                speciesChoice === 'bull' ||
                speciesChoice === 'cattle'
              ) {
                setSpeciesChoice(
                  nextSex === 'male'
                    ? 'bull'
                    : nextSex === 'female'
                      ? 'cow'
                      : 'cattle'
                );
              }
            }}
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
            {canEdit && (
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
              </div>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="herd-grid">
            {items.map((item) => {
              const imageSrc = resolveDesktopImageSrc(item.imageUri);
              const spIcon = getSpeciesPngIcon(item.species, item.sex);
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
                        alt={formatSpeciesLabel(item.species, item.sex)}
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
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                      {formatSpeciesLabel(item.species, item.sex)} ·
                      <img
                        src={getSexPngIcon(item.sex)}
                        alt=""
                        style={{ width: 13, height: 13, objectFit: 'contain' }}
                      />
                      {formatSexLabel(item.sex)}
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
                      <th>Species / Sex</th>
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
                                src={getSpeciesPngIcon(item.species, item.sex)}
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
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <img
                              src={getSpeciesPngIcon(item.species, item.sex)}
                              alt=""
                              className="app-icon-sm"
                            />
                            {formatSpeciesLabel(item.species, item.sex)}
                          </span>
                          <span className={`sex-pill sex-${item.sex}`} style={{ gap: 5 }}>
                            <img
                              src={getSexPngIcon(item.sex)}
                              alt=""
                              style={{ width: 13, height: 13, objectFit: 'contain' }}
                            />
                            {formatSexLabel(item.sex)}
                          </span>
                        </div>
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
                        {(canEdit || canDelete) ? (
                          <div className="row-actions">
                            {canEdit && (
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
                            )}
                            {canDelete &&
                              (confirmDeleteId === item.id ? (
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
                              ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            View only
                          </span>
                        )}
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
