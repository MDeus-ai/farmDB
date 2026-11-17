import { useMemo, useState } from 'react';
import {
  canAccountDeleteInModule,
  canAccountEditModule,
  computeOwnershipSummary,
  DEFAULT_FARM_SETTINGS,
  formatCurrency,
  formatDisplayDate,
  formatOwnershipCategoryLabel,
  formatOwnershipStatusLabel,
  getTodayIsoDate,
  OWNERSHIP_CATEGORIES,
  OWNERSHIP_STATUSES,
  type AnimalOwnership,
  type FarmAccount,
  type Livestock,
  type OwnershipCategory,
  type OwnershipStatus,
} from '@farmdb/core';
import {
  useActiveFarmAccount,
  useCreateLivestock,
  useCreateOwnership,
  useDeleteOwnership,
  useFarmAccountList,
  useFarmSettings,
  useLivestockList,
  useOwnershipList,
  useUpdateOwnership,
} from '@farmdb/db';
import { APP_ICONS, getSpeciesPngIcon } from '../assets/icons';
import { buildAnimalSelectOption } from '../utils/animalOptions';
import { AnimalEyeButton } from './AnimalQuickPreviewModal';
import { FileTabs } from './FileTabs';
import { ModernDatePicker } from './ModernDatePicker';
import { ModernSelect, type ModernSelectOption } from './ModernSelect';
import { NumberStepper } from './NumberStepper';

type OwnershipTab = 'records' | 'owners';

interface OwnershipsViewProps {
  onOpenNetwork?: () => void;
}

function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export function OwnershipsView({ onOpenNetwork }: OwnershipsViewProps) {
  const settingsQuery = useFarmSettings();
  const settings = settingsQuery.data ?? DEFAULT_FARM_SETTINGS;
  const currency = settings.currencySymbol;
  const todayIso = getTodayIsoDate();

  const activeAccountQuery = useActiveFarmAccount();
  const activeAccount = activeAccountQuery.data;
  const canEdit = canAccountEditModule(activeAccount, 'ownerships');
  const canDelete = canAccountDeleteInModule(activeAccount, 'ownerships');

  const ownershipsQuery = useOwnershipList({});
  const livestockQuery = useLivestockList({});
  const accountsQuery = useFarmAccountList({});

  const createMut = useCreateOwnership();
  const updateMut = useUpdateOwnership();
  const deleteMut = useDeleteOwnership();
  const createLivestockMut = useCreateLivestock();

  const allOwnerships = ownershipsQuery.data ?? [];
  const allLivestock = livestockQuery.data ?? [];
  const allAccounts = accountsQuery.data ?? [];

  const [tab, setTab] = useState<OwnershipTab>('records');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<OwnershipCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<OwnershipStatus | 'all'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AnimalOwnership | null>(null);
  const [fLivestockId, setFLivestockId] = useState('');
  const [fOwnerName, setFOwnerName] = useState('');
  const [fOwnerContact, setFOwnerContact] = useState('');
  const [fAccountId, setFAccountId] = useState('');
  const [fCategory, setFCategory] = useState<OwnershipCategory>('external_boarded');
  const [fSharePct, setFSharePct] = useState('100');
  const [fPurpose, setFPurpose] = useState('');
  const [fStartDate, setFStartDate] = useState(todayIso);
  const [fExpectedEndDate, setFExpectedEndDate] = useState('');
  const [fBoardingFee, setFBoardingFee] = useState('0');
  const [fStatus, setFStatus] = useState<OwnershipStatus>('active');
  const [fNotes, setFNotes] = useState('');
  const [fError, setFError] = useState<string | null>(null);

  const livestockById = useMemo(
    () => new Map(allLivestock.map((a) => [a.id, a])),
    [allLivestock]
  );
  const accountsById = useMemo(
    () => new Map(allAccounts.map((acc) => [acc.id, acc])),
    [allAccounts]
  );

  const summary = useMemo(
    () => computeOwnershipSummary(allOwnerships),
    [allOwnerships]
  );

  const filteredOwnerships = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allOwnerships.filter((row) => {
      if (categoryFilter !== 'all' && row.ownershipCategory !== categoryFilter) {
        return false;
      }
      if (statusFilter !== 'all' && row.status !== statusFilter) {
        return false;
      }
      if (q) {
        const animal = livestockById.get(row.livestockId);
        const hay = `${row.ownerName} ${row.purpose ?? ''} ${row.notes ?? ''} ${animal?.tagNumber ?? ''} ${animal?.name ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allOwnerships, categoryFilter, statusFilter, search, livestockById]);

  const ownerDirectory = useMemo(() => {
    const grouped = new Map<
      string,
      {
        key: string;
        ownerName: string;
        ownerContact: string | null;
        linkedAccount: FarmAccount | null;
        records: AnimalOwnership[];
        activeCount: number;
        totalFee: number;
      }
    >();

    for (const row of allOwnerships) {
      const key = row.ownerName.trim().toLowerCase();
      const existing = grouped.get(key) ?? {
        key,
        ownerName: row.ownerName,
        ownerContact: row.ownerContact,
        linkedAccount: row.accountId ? accountsById.get(row.accountId) ?? null : null,
        records: [],
        activeCount: 0,
        totalFee: 0,
      };
      existing.records.push(row);
      if (row.status === 'active') {
        existing.activeCount += 1;
        existing.totalFee += row.boardingFee || 0;
      }
      if (!existing.ownerContact && row.ownerContact) {
        existing.ownerContact = row.ownerContact;
      }
      if (!existing.linkedAccount && row.accountId) {
        existing.linkedAccount = accountsById.get(row.accountId) ?? null;
      }
      grouped.set(key, existing);
    }

    return Array.from(grouped.values()).sort(
      (a, b) => b.activeCount - a.activeCount || a.ownerName.localeCompare(b.ownerName)
    );
  }, [allOwnerships, accountsById]);

  const livestockOptions = useMemo<ModernSelectOption<string>[]>(
    () =>
      allLivestock.map((animal: Livestock) =>
        buildAnimalSelectOption(animal, {
          label: `${animal.tagNumber}${animal.name ? ` · ${animal.name}` : ''}`,
          hint: `${animal.breed ?? animal.species} (${animal.status})`,
        })
      ),
    [allLivestock]
  );

  const accountOptions = useMemo<ModernSelectOption<string>[]>(
    () => [
      { value: '', label: 'Not Linked to Network Account', iconSrc: APP_ICONS.peasant },
      ...allAccounts.map((acc) => ({
        value: acc.id,
        label: acc.displayName,
        hint: acc.relationship ?? acc.role,
        iconSrc: APP_ICONS.networking,
      })),
    ],
    [allAccounts]
  );

  function openAddModal(preselectAnimalId?: string) {
    setEditing(null);
    setFLivestockId(preselectAnimalId ?? allLivestock[0]?.id ?? '');
    setFOwnerName('');
    setFOwnerContact('');
    setFAccountId('');
    setFCategory('external_boarded');
    setFSharePct('100');
    setFPurpose('');
    setFStartDate(todayIso);
    setFExpectedEndDate('');
    setFBoardingFee('0');
    setFStatus('active');
    setFNotes('');
    setFError(null);
    setModalOpen(true);
  }

  function openEditModal(row: AnimalOwnership) {
    setEditing(row);
    setFLivestockId(row.livestockId);
    setFOwnerName(row.ownerName);
    setFOwnerContact(row.ownerContact ?? '');
    setFAccountId(row.accountId ?? '');
    setFCategory(row.ownershipCategory);
    setFSharePct(String(row.sharePercentage));
    setFPurpose(row.purpose ?? '');
    setFStartDate(row.startDate);
    setFExpectedEndDate(row.expectedEndDate ?? '');
    setFBoardingFee(String(row.boardingFee));
    setFStatus(row.status);
    setFNotes(row.notes ?? '');
    setFError(null);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFError(null);
    try {
      const payload = {
        livestockId: fLivestockId,
        ownerName: fOwnerName,
        ownerContact: fOwnerContact || null,
        accountId: fAccountId || null,
        ownershipCategory: fCategory,
        sharePercentage: Number(fSharePct),
        purpose: fPurpose || null,
        startDate: fStartDate,
        expectedEndDate: fExpectedEndDate || null,
        boardingFee: Number(fBoardingFee),
        status: fStatus,
        notes: fNotes || null,
      };
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, input: payload });
        setStatusNotice(`Updated ownership record for ${fOwnerName}.`);
      } else {
        await createMut.mutateAsync(payload);
        setStatusNotice(`Saved ownership / custody record for ${fOwnerName}.`);
      }
      setModalOpen(false);
    } catch (err) {
      setFError(
        err instanceof Error ? err.message : 'Unable to save ownership record.'
      );
    }
  }

  async function handleDelete(row: AnimalOwnership) {
    if (settings.confirmBeforeDelete && confirmDeleteId !== row.id) {
      setConfirmDeleteId(row.id);
      return;
    }
    setConfirmDeleteId(null);
    await deleteMut.mutateAsync(row.id);
    setStatusNotice(`Deleted ownership record for ${row.ownerName}.`);
  }

  async function handleSeedSampleOwnerships() {
    if (isSeeding) return;
    setIsSeeding(true);
    setErrorNotice(null);
    setStatusNotice(null);

    try {
      const animalsByTag = new Map(
        allLivestock.map((a) => [a.tagNumber.toUpperCase(), a])
      );

      async function ensureAnimal(input: {
        species: 'cow' | 'goat' | 'sheep' | 'duck' | 'other';
        tagNumber: string;
        name: string;
        breed: string;
        status?: 'active' | 'sold';
      }): Promise<Livestock> {
        const found = animalsByTag.get(input.tagNumber.toUpperCase());
        if (found) return found;
        const created = await createLivestockMut.mutateAsync({
          species: input.species,
          tagNumber: input.tagNumber,
          name: input.name,
          breed: input.breed,
          status: input.status ?? 'active',
        });
        animalsByTag.set(created.tagNumber.toUpperCase(), created);
        return created;
      }

      const studBull = await ensureAnimal({
        species: 'cow',
        tagNumber: 'EXT-BULL-12',
        name: 'Kiboko',
        breed: 'Fresian Stud',
      });
      const soldCow = await ensureAnimal({
        species: 'cow',
        tagNumber: 'SLD-COW-88',
        name: 'Marigold',
        breed: 'Guernsey',
        status: 'sold',
      });
      const boardedDuck = await ensureAnimal({
        species: 'duck',
        tagNumber: 'EXT-DUCK-04',
        name: 'Quackers',
        breed: 'Muscovy',
      });

      const existingKeys = new Set(
        allOwnerships.map(
          (o) => `${o.livestockId}:${o.ownerName.trim().toLowerCase()}`
        )
      );

      if (
        !existingKeys.has(
          `${studBull.id}:neighbouring greenvalley ranch (mr. kato)`
        )
      ) {
        await createMut.mutateAsync({
          livestockId: studBull.id,
          ownerName: 'Neighbouring GreenValley Ranch (Mr. Kato)',
          ownerContact: '+256 772 310440',
          ownershipCategory: 'breeding_loan_in',
          sharePercentage: 100,
          purpose: 'Brought in for seasonal bull breeding service across 12 cows',
          startDate: addDays(todayIso, -20),
          expectedEndDate: addDays(todayIso, 40),
          boardingFee: currency === 'UGX' ? 180000 : 95,
          status: 'active',
          notes: 'Paddock B isolated overnight; return arranged with trailer.',
        });
      }

      if (!existingKeys.has(`${soldCow.id}:sarah namono (buyer)`)) {
        await createMut.mutateAsync({
          livestockId: soldCow.id,
          ownerName: 'Sarah Namono (Buyer)',
          ownerContact: '+256 701 662801',
          ownershipCategory: 'sold_retained',
          sharePercentage: 100,
          purpose: 'Sold last week — remaining on farm until buyer transport arrives',
          startDate: addDays(todayIso, -5),
          expectedEndDate: addDays(todayIso, 7),
          boardingFee: currency === 'UGX' ? 40000 : 25,
          status: 'active',
          notes: 'Exclude from farm-owned asset valuation.',
        });
      }

      if (!existingKeys.has(`${boardedDuck.id}:uncle joseph ssemakula`)) {
        await createMut.mutateAsync({
          livestockId: boardedDuck.id,
          ownerName: 'Uncle Joseph Ssemakula',
          ownerContact: '+256 782 119044',
          ownershipCategory: 'co_owned',
          sharePercentage: 50,
          purpose: '50/50 family flock share & temporary pond care',
          startDate: addDays(todayIso, -45),
          boardingFee: 0,
          status: 'active',
          notes: 'Family shared custody agreement.',
        });
      }

      setStatusNotice(
        'Loaded sample animal ownerships, breeding loans, and sold-retained records.'
      );
    } catch (err) {
      setErrorNotice(
        err instanceof Error
          ? err.message
          : 'Failed to load sample ownership records.'
      );
    } finally {
      setIsSeeding(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="family-hero-icon">
            <img src={APP_ICONS.peasant} alt="" className="app-icon-lg" />
          </div>
          <div>
            <h1 className="page-title">Ownerships &amp; Custody</h1>
          </div>
        </div>

        <div className="row-actions">
          {canEdit && allOwnerships.length < 3 && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isSeeding}
              onClick={() => void handleSeedSampleOwnerships()}
            >
              <img src={APP_ICONS.livestockGroup} alt="" className="app-icon-sm" />
              {isSeeding ? 'Loading Sample...' : 'Load Sample Ownerships'}
            </button>
          )}
          {onOpenNetwork && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onOpenNetwork}
            >
              <img src={APP_ICONS.networking} alt="" className="app-icon-sm" />
              Farm Network Accounts
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={allLivestock.length === 0}
              onClick={() => openAddModal()}
            >
              <img src={APP_ICONS.plus} alt="" className="app-icon-sm" />
              Add Ownership Record
            </button>
          )}
        </div>
      </div>

      {!canEdit && (
        <div className="notice-banner" role="status">
          <span>
            Signed in as <strong>{activeAccount?.displayName}</strong> with{' '}
            <strong>View Only</strong> permission for Ownerships.
          </span>
        </div>
      )}

      {errorNotice && (
        <div className="notice-banner" role="alert">
          <span>{errorNotice}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setErrorNotice(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {statusNotice && (
        <div className="alert-toast-banner" role="status">
          <span>{statusNotice}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setStatusNotice(null)}
          >
            <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
            Dismiss
          </button>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-label">Active Non-Farm Animals</p>
          <p className="stat-value">{summary.activeNonFarmOwnedCount}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Sold · Retained on Farm</p>
          <p className="stat-value">{summary.soldRetainedCount}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Breeding / Care Loans</p>
          <p className="stat-value">
            {summary.breedingLoanCount + summary.careQuarantineCount}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Owners / Agreed Care Fees</p>
          <p className="stat-value">
            {summary.distinctOwnerCount} ·{' '}
            {formatCurrency(summary.activeBoardingFeeTotal, currency)}
          </p>
        </div>
      </div>

      <div className="card">
        <FileTabs
          ariaLabel="Ownership tabs"
          surface="card"
          activeId={tab}
          onChange={setTab}
          tabs={[
            {
              id: 'records',
              label: `Tracked Animals & Custody (${allOwnerships.length})`,
              iconSrc: APP_ICONS.peasant,
            },
            {
              id: 'owners',
              label: `Owners & Partners (${ownerDirectory.length})`,
              iconSrc: APP_ICONS.livestockGroup,
            },
          ]}
        />

        {allOwnerships.length === 0 ? (
          <div className="empty-state">
            <img
              src={APP_ICONS.peasant}
              alt=""
              style={{ width: 52, height: 52, marginBottom: 8 }}
            />
            <p style={{ margin: 0, fontWeight: 700, fontSize: '1.04rem' }}>
              No ownership records yet
            </p>
            {canEdit && (
              <div className="empty-actions">
                {allLivestock.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => openAddModal()}
                  >
                    <img src={APP_ICONS.plus} alt="" className="app-icon-sm" />
                    Record Animal Ownership
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSeeding}
                  onClick={() => void handleSeedSampleOwnerships()}
                >
                  <img src={APP_ICONS.livestockGroup} alt="" className="app-icon-sm" />
                  {isSeeding ? 'Loading Sample...' : 'Load Sample Ownerships'}
                </button>
              </div>
            )}
          </div>
        ) : tab === 'records' ? (
          <>
            <div className="toolbar">
              <div className="search-wrap">
                <input
                  className="input"
                  style={{ paddingLeft: 12 }}
                  placeholder="Search owner name, animal tag, or purpose..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <ModernSelect
                ariaLabel="Filter by ownership category"
                value={categoryFilter}
                options={[
                  { value: 'all', label: 'All Ownership Types', iconSrc: APP_ICONS.peasant },
                  ...OWNERSHIP_CATEGORIES.map((cat) => ({
                    value: cat,
                    label: formatOwnershipCategoryLabel(cat),
                    iconSrc: APP_ICONS.livestockGroup,
                  })),
                ]}
                onChange={setCategoryFilter}
              />
              <ModernSelect
                ariaLabel="Filter by custody status"
                value={statusFilter}
                options={[
                  { value: 'all', label: 'All Custody Statuses', iconSrc: APP_ICONS.checkmark },
                  ...OWNERSHIP_STATUSES.map((st) => ({
                    value: st,
                    label: formatOwnershipStatusLabel(st),
                    iconSrc: st === 'active' ? APP_ICONS.sprout : APP_ICONS.checkmark,
                  })),
                ]}
                onChange={setStatusFilter}
              />
            </div>

            {filteredOwnerships.length === 0 ? (
              <div className="empty-state">No ownership records match the current filter.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Animal</th>
                      <th>Owner &amp; Account</th>
                      <th>Ownership Type</th>
                      <th>Purpose &amp; Stay Dates</th>
                      <th>Care Fee</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOwnerships.map((row) => {
                      const animal = livestockById.get(row.livestockId);
                      const account = row.accountId
                        ? accountsById.get(row.accountId)
                        : null;
                      return (
                        <tr key={row.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <img
                                src={
                                  animal
                                    ? getSpeciesPngIcon(animal.species)
                                    : APP_ICONS.livestockGroup
                                }
                                alt=""
                                className="app-icon-md"
                              />
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <span className="tag-chip">
                                    {animal?.tagNumber ?? 'Unknown'}
                                  </span>
                                  <AnimalEyeButton livestockId={row.livestockId} />
                                </div>
                                <div style={{ fontWeight: 600, marginTop: 2 }}>
                                  {animal?.name ?? 'Unnamed Animal'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <strong>{row.ownerName}</strong>
                            {row.ownerContact && (
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {row.ownerContact}
                              </div>
                            )}
                            {account && (
                              <span className="auto-tag" style={{ marginTop: 4 }}>
                                Account: {account.displayName}
                              </span>
                            )}
                          </td>
                          <td>
                            <span className="ownership-category-pill">
                              {formatOwnershipCategoryLabel(row.ownershipCategory)}
                            </span>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}>
                              Owner share: {row.sharePercentage}%
                            </div>
                          </td>
                          <td>
                            <div style={{ maxWidth: 260 }}>
                              {row.purpose ?? 'No purpose note'}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 3 }}>
                              Since {formatDisplayDate(row.startDate, settings.dateFormat)}
                              {row.expectedEndDate
                                ? ` · Expected out ${formatDisplayDate(row.expectedEndDate, settings.dateFormat)}`
                                : ''}
                            </div>
                          </td>
                          <td>
                            <strong>{formatCurrency(row.boardingFee, currency)}</strong>
                          </td>
                          <td>
                            <span
                              className={`status-pill ${
                                row.status === 'active' ? 'status-sold' : 'status-active'
                              }`}
                            >
                              {formatOwnershipStatusLabel(row.status)}
                            </span>
                          </td>
                          <td>
                            <div className="row-actions">
                              {canEdit && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => openEditModal(row)}
                                  aria-label={`Edit ownership for ${row.ownerName}`}
                                >
                                  <img src={APP_ICONS.pencil} alt="" className="app-icon-sm" />
                                </button>
                              )}
                              {canDelete &&
                                (confirmDeleteId === row.id ? (
                                  <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    onClick={() => void handleDelete(row)}
                                  >
                                    Confirm
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    onClick={() => void handleDelete(row)}
                                    aria-label={`Delete ownership for ${row.ownerName}`}
                                  >
                                    <img src={APP_ICONS.delete} alt="" className="app-icon-sm" />
                                  </button>
                                ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="hr-worker-grid">
            {ownerDirectory.map((owner) => (
              <div key={owner.key} className="hr-worker-card">
                <div className="hr-worker-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="hr-avatar">
                      <img src={APP_ICONS.peasant} alt="" className="app-icon-md" />
                    </div>
                    <div>
                      <strong style={{ display: 'block', fontSize: '1rem' }}>
                        {owner.ownerName}
                      </strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {owner.ownerContact ?? 'No phone/email saved'}
                      </span>
                    </div>
                  </div>
                  <span className="status-pill status-active">
                    {owner.activeCount} on farm
                  </span>
                </div>

                {owner.linkedAccount && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600 }}>
                    Linked Network Account: {owner.linkedAccount.displayName}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {owner.records.map((rec) => {
                    const animal = livestockById.get(rec.livestockId);
                    return (
                      <div
                        key={rec.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 8px',
                          background: '#faf8f4',
                          borderRadius: 8,
                          border: '1px solid var(--surface-muted)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <img
                            src={
                              animal
                                ? getSpeciesPngIcon(animal.species)
                                : APP_ICONS.livestockGroup
                            }
                            alt=""
                            className="app-icon-sm"
                          />
                          <span className="tag-chip">
                            {animal?.tagNumber ?? 'Animal'}
                          </span>
                          <AnimalEyeButton livestockId={rec.livestockId} />
                          <span style={{ fontSize: '0.82rem' }}>
                            {formatOwnershipCategoryLabel(rec.ownershipCategory)}
                          </span>
                        </div>
                        <strong style={{ fontSize: '0.82rem' }}>
                          {rec.sharePercentage}%
                        </strong>
                      </div>
                    );
                  })}
                </div>

                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Agreed care fees (active):{' '}
                  <strong>{formatCurrency(owner.totalFee, currency)}</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Ownership Modal */}
      {modalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-header">
              <h2 className="modal-title">
                {editing ? 'Edit Ownership Record' : 'Add Animal Ownership Record'}
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setModalOpen(false)}
              >
                <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-grid">
                <div className="form-field full">
                  <label className="form-label">Animal *</label>
                  <ModernSelect
                    searchable
                    fullWidth
                    value={fLivestockId}
                    options={livestockOptions}
                    onChange={setFLivestockId}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Owner / Buyer / Partner Name *</label>
                  <input
                    className="input"
                    value={fOwnerName}
                    onChange={(e) => setFOwnerName(e.target.value)}
                    placeholder="e.g. Mr. Kato / Sarah Namono"
                    autoFocus
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Owner Phone / Contact</label>
                  <input
                    className="input"
                    value={fOwnerContact}
                    onChange={(e) => setFOwnerContact(e.target.value)}
                    placeholder="Optional phone or email"
                  />
                </div>
                <div className="form-field full">
                  <label className="form-label">
                    Link to Connected Farm Network Account (Optional)
                  </label>
                  <ModernSelect
                    searchable
                    fullWidth
                    value={fAccountId}
                    options={accountOptions}
                    onChange={(nextId) => {
                      setFAccountId(nextId);
                      const acc = accountsById.get(nextId);
                      if (acc && !fOwnerName.trim()) {
                        setFOwnerName(acc.displayName);
                        if (acc.phone || acc.email) {
                          setFOwnerContact(acc.phone ?? acc.email ?? '');
                        }
                      }
                    }}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Ownership Category *</label>
                  <ModernSelect
                    fullWidth
                    value={fCategory}
                    options={OWNERSHIP_CATEGORIES.map((cat) => ({
                      value: cat,
                      label: formatOwnershipCategoryLabel(cat),
                      iconSrc: APP_ICONS.peasant,
                    }))}
                    onChange={setFCategory}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Custody Status</label>
                  <ModernSelect
                    fullWidth
                    value={fStatus}
                    options={OWNERSHIP_STATUSES.map((st) => ({
                      value: st,
                      label: formatOwnershipStatusLabel(st),
                      iconSrc: APP_ICONS.checkmark,
                    }))}
                    onChange={setFStatus}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Owner Share (%)</label>
                  <NumberStepper
                    min={1}
                    max={100}
                    step={5}
                    decimals={0}
                    value={fSharePct}
                    onChange={setFSharePct}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Boarding / Care Fee ({currency})</label>
                  <NumberStepper
                    min={0}
                    step={currency === 'UGX' ? 5000 : 10}
                    decimals={currency === 'UGX' ? 0 : 2}
                    value={fBoardingFee}
                    onChange={setFBoardingFee}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">On-Farm Start Date *</label>
                  <ModernDatePicker value={fStartDate} onChange={setFStartDate} />
                </div>
                <div className="form-field">
                  <label className="form-label">Expected Return / Pickup Date</label>
                  <ModernDatePicker
                    allowClear
                    value={fExpectedEndDate}
                    onChange={setFExpectedEndDate}
                    placeholder="Optional date"
                  />
                </div>
                <div className="form-field full">
                  <label className="form-label">Purpose / Arrangement</label>
                  <input
                    className="input"
                    value={fPurpose}
                    onChange={(e) => setFPurpose(e.target.value)}
                    placeholder="e.g. Bull brought in for breeding service, or sold awaiting pickup"
                  />
                </div>
                <div className="form-field full">
                  <label className="form-label">Detailed Notes</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={fNotes}
                    onChange={(e) => setFNotes(e.target.value)}
                    placeholder="Feeding rules, transport agreement, health clearance..."
                  />
                </div>
              </div>

              {fError && <p className="field-error" style={{ marginTop: 10 }}>{fError}</p>}

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createMut.isPending || updateMut.isPending}
                >
                  Save Ownership Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
