import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import {
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
import { LivestockFormModal } from './LivestockFormModal';

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
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Livestock | null>(null);

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

  const items = listQuery.data ?? [];
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
    await deleteMutation.mutateAsync(item.id);
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Herd Registry</h1>
          <p className="page-subtitle">
            Unified offline-first livestock table (cows by default; ready for goats and sheep).
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
        </div>

        {listQuery.isLoading ? (
          <div className="empty-state">Loading local SQLite records...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <p style={{ margin: 0, fontWeight: 600 }}>
              No livestock records match the current filter.
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '0.88rem' }}>
              Add your first cow to local SQLite or load 3 sample cows to verify reactive updates.
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
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tag #</th>
                  <th>Name</th>
                  <th>Species</th>
                  <th>Breed</th>
                  <th>Date of Birth</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="tag-chip">{item.tagNumber}</span>
                    </td>
                    <td>{item.name ?? '—'}</td>
                    <td>{formatSpeciesLabel(item.species)}</td>
                    <td>{item.breed ?? '—'}</td>
                    <td>{formatIsoDate(item.dob)}</td>
                    <td>
                      <span className={`status-pill status-${item.status}`}>
                        {formatStatusLabel(item.status)}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
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
                          className="btn btn-danger"
                          onClick={() => handleDelete(item)}
                          disabled={deleteMutation.isPending}
                          aria-label={`Delete ${item.tagNumber}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <LivestockFormModal
        open={modalOpen}
        editing={editing}
        existingTags={existingTags}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
