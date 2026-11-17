import { useMemo, useState } from 'react';
import {
  Camera,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  formatAnimalAge,
  formatIsoDate,
  formatSpeciesLabel,
  formatStatusLabel,
  LIVESTOCK_STATUSES,
  SPECIES_LIST,
  type Livestock,
  type LivestockFilter,
  type LivestockStatus,
  type Species,
} from '@farmdb/core';
import {
  useCreateLivestock,
  useDeleteLivestock,
  useFarmSummary,
  useLivestockList,
} from '@farmdb/db';
import {
  deleteManagedDesktopImage,
  resolveDesktopImageSrc,
} from '../services/imageStorage';
import { LivestockDetailModal } from './LivestockDetailModal';
import { LivestockFormModal } from './LivestockFormModal';

type SortOption = 'updated' | 'tag' | 'name';

const SAMPLE_HERD = [
  {
    species: 'cow' as const,
    tagNumber: 'COW-402',
    name: 'Bessie',
    breed: 'Holstein',
    dob: '2022-03-14',
    status: 'active' as const,
  },
  {
    species: 'cow' as const,
    tagNumber: 'COW-409',
    name: 'Daisy',
    breed: 'Jersey',
    dob: '2023-07-02',
    status: 'active' as const,
  },
  {
    species: 'cow' as const,
    tagNumber: 'COW-318',
    name: 'Willow',
    breed: 'Ayrshire',
    dob: '2021-11-20',
    status: 'active' as const,
  },
];

export function LivestockView() {
  const [search, setSearch] = useState('');
  const [species, setSpecies] = useState<Species | 'all'>('all');
  const [status, setStatus] = useState<LivestockStatus | 'all'>('active');
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Livestock | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filter: LivestockFilter = useMemo(
    () => ({ search, species, status }),
    [search, species, status]
  );

  const listQuery = useLivestockList(filter);
  const allForTagsQuery = useLivestockList({});
  const summaryQuery = useFarmSummary();
  const createMutation = useCreateLivestock();
  const deleteMutation = useDeleteLivestock();

  const existingTags = useMemo(
    () => (allForTagsQuery.data ?? []).map((item) => item.tagNumber),
    [allForTagsQuery.data]
  );

  const items = useMemo(() => {
    const raw = [...(listQuery.data ?? [])];
    if (sortBy === 'tag') {
      raw.sort((a, b) => a.tagNumber.localeCompare(b.tagNumber));
    } else if (sortBy === 'name') {
      raw.sort((a, b) => (a.name ?? a.tagNumber).localeCompare(b.name ?? b.tagNumber));
    }
    return raw;
  }, [listQuery.data, sortBy]);

  const summary = summaryQuery.data;

  async function handleSeedSample() {
    const existing = new Set(existingTags);
    for (const animal of SAMPLE_HERD) {
      if (!existing.has(animal.tagNumber)) {
        await createMutation.mutateAsync(animal);
      }
    }
  }

  async function handleDelete(item: Livestock) {
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
          <p className="page-subtitle">
            Active livestock dashboard with unique tag validation and local photo storage.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus size={17} />
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

          <select
            className="select"
            aria-label="Filter by species"
            value={species}
            onChange={(e) => setSpecies(e.target.value as Species | 'all')}
          >
            <option value="all">All Species</option>
            {SPECIES_LIST.map((sp) => (
              <option key={sp} value={sp}>
                {formatSpeciesLabel(sp)}
              </option>
            ))}
          </select>

          <select
            className="select"
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value as LivestockStatus | 'all')}
          >
            <option value="all">All Statuses</option>
            {LIVESTOCK_STATUSES.map((st) => (
              <option key={st} value={st}>
                {formatStatusLabel(st)}
              </option>
            ))}
          </select>

          <select
            className="select"
            aria-label="Sort livestock"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
          >
            <option value="updated">Recently Updated</option>
            <option value="tag">Tag # (A-Z)</option>
            <option value="name">Name (A-Z)</option>
          </select>

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
              No livestock records match the current filter.
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '0.88rem' }}>
              Add your first cow to local SQLite or load 3 sample cows to explore the herd registry.
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
                <Plus size={16} />
                Add First Cow
              </button>
              {(summary?.totalLivestock ?? 0) === 0 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleSeedSample}
                  disabled={createMutation.isPending}
                >
                  <Sparkles size={16} />
                  Load Sample Herd
                </button>
              )}
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="herd-grid">
            {items.map((item) => {
              const imageSrc = resolveDesktopImageSrc(item.imageUri);
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
                      <Camera size={28} color="#8a968c" />
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
                              {item.tagNumber.slice(0, 3)}
                            </div>
                          )}
                          <div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span className="tag-chip">{item.tagNumber}</span>
                              <strong>{item.name ?? 'Unnamed'}</strong>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{formatSpeciesLabel(item.species)}</td>
                      <td>{item.breed ?? '—'}</td>
                      <td>
                        {formatIsoDate(item.dob)}
                        {item.dob ? ` (${formatAnimalAge(item.dob)})` : ''}
                      </td>
                      <td>
                        <span className={`status-pill status-${item.status}`}>
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
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => void handleDelete(item)}
                            disabled={deleteMutation.isPending}
                            aria-label={`Delete ${item.tagNumber}`}
                          >
                            <Trash2 size={14} />
                          </button>
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
