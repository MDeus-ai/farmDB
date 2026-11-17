import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import {
  DEFAULT_FARM_SETTINGS,
  filterAndSortRecordsByDate,
  formatCurrency,
  formatDisplayDate,
  getTodayIsoDate,
  RECORD_DATE_FILTER_OPTIONS,
  roundAmount,
  validateNewMedicalRecord,
  type DateSortDirection,
  type NewMedicalRecordInput,
  type RecordDateFilter,
  type ValidationErrors,
} from '@farmdb/core';
import {
  MedicalValidationError,
  useCreateMedicalRecord,
  useDeleteMedicalRecord,
  useFarmSettings,
  useLivestockList,
  useMedicalRecordList,
} from '@farmdb/db';
import { APP_ICONS } from '../assets/icons';
import { buildAnimalSelectOption } from '../utils/animalOptions';
import { AnimalEyeButton } from './AnimalQuickPreviewModal';
import { ModernDatePicker } from './ModernDatePicker';
import { ModernSelect, type ModernSelectOption } from './ModernSelect';
import { NumberStepper } from './NumberStepper';

export function MedicalView() {
  const livestockQuery = useLivestockList({});
  const settingsQuery = useFarmSettings();
  const [filterLivestockId, setFilterLivestockId] = useState('');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<RecordDateFilter>('all');
  const [dateSort, setDateSort] = useState<DateSortDirection>('desc');

  const allMedicalQuery = useMedicalRecordList({});
  const filteredMedicalQuery = useMedicalRecordList({
    livestockId: filterLivestockId || undefined,
    search: search || undefined,
  });

  const createMutation = useCreateMedicalRecord();
  const deleteMutation = useDeleteMedicalRecord();

  const animals = livestockQuery.data ?? [];
  const animalsById = useMemo(
    () => new Map(animals.map((a) => [a.id, a])),
    [animals]
  );

  const settings = settingsQuery.data ?? DEFAULT_FARM_SETTINGS;

  const animalOptions = useMemo<ModernSelectOption<string>[]>(
    () =>
      animals.map((a) =>
        buildAnimalSelectOption(a, {
          dateFormat: settings.dateFormat,
          label: `${a.tagNumber}${a.name ? ` — ${a.name}` : ''}`,
        })
      ),
    [animals, settings.dateFormat]
  );

  const filterAnimalOptions = useMemo<ModernSelectOption<string>[]>(
    () => [
      { value: '', label: 'All Animals', iconSrc: APP_ICONS.group },
      ...animalOptions,
    ],
    [animalOptions]
  );

  const dateFilterOptions = useMemo<ModernSelectOption<RecordDateFilter>[]>(
    () =>
      RECORD_DATE_FILTER_OPTIONS.map((opt) => ({
        value: opt.value,
        label: opt.label,
        iconSrc: APP_ICONS.calendar,
      })),
    []
  );

  const dateSortOptions = useMemo<ModernSelectOption<DateSortDirection>[]>(
    () => [
      { value: 'desc', label: 'Newest First', iconSrc: APP_ICONS.hourglass },
      { value: 'asc', label: 'Oldest First', iconSrc: APP_ICONS.hourglass },
    ],
    []
  );

  const currency = settings.currencySymbol;

  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [date, setDate] = useState(() => getTodayIsoDate());
  const [condition, setCondition] = useState('');
  const [treatment, setTreatment] = useState('');
  const [costText, setCostText] = useState('0');
  const [veterinarian, setVeterinarian] = useState('');
  const [autoRecordExpense, setAutoRecordExpense] = useState(
    settings.autoRecordMedicalExpenseByDefault
  );
  const initializedAutoRef = useRef(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [errors, setErrors] = useState<ValidationErrors<NewMedicalRecordInput>>(
    {}
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAnimalId && animals[0]) {
      setSelectedAnimalId(animals[0].id);
    }
  }, [animals, selectedAnimalId]);

  useEffect(() => {
    if (settingsQuery.data && !initializedAutoRef.current) {
      setAutoRecordExpense(settingsQuery.data.autoRecordMedicalExpenseByDefault);
      initializedAutoRef.current = true;
    }
  }, [settingsQuery.data]);

  const allRecords = allMedicalQuery.data ?? [];
  const visibleRecords = useMemo(
    () =>
      filterAndSortRecordsByDate(filteredMedicalQuery.data ?? [], {
        filter: dateFilter,
        sort: dateSort,
      }),
    [filteredMedicalQuery.data, dateFilter, dateSort]
  );

  const totalMedicalSpend = useMemo(
    () => roundAmount(allRecords.reduce((sum, r) => sum + r.cost, 0)),
    [allRecords]
  );
  const treatedAnimalCount = useMemo(
    () => new Set(allRecords.map((r) => r.livestockId)).size,
    [allRecords]
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);

    const parsedCost = costText.trim() === '' ? 0 : Number(costText);
    const check = validateNewMedicalRecord({
      livestockId: selectedAnimalId,
      date,
      condition,
      treatment,
      cost: parsedCost,
      veterinarian,
    });

    if (!check.ok || !check.data) {
      setErrors(check.errors);
      return;
    }

    setErrors({});
    try {
      const result = await createMutation.mutateAsync({
        input: check.data,
        options: { autoRecordExpense },
      });
      setCondition('');
      setTreatment('');
      setCostText('0');
      setVeterinarian('');
      setFeedback(
        result.generatedExpenseLog
          ? `Saved medical record and logged ${formatCurrency(result.generatedExpenseLog.amount, currency)} expense.`
          : 'Saved medical record to timeline.'
      );
    } catch (err) {
      if (err instanceof MedicalValidationError) {
        setErrors(err.errors);
      } else {
        setFeedback(
          err instanceof Error ? err.message : 'Failed to save medical record.'
        );
      }
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Medical History</h1>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-label">Medical Entries</p>
          <p className="stat-value">{allRecords.length}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Total Treatment Spend</p>
          <p className="stat-value">
            {formatCurrency(totalMedicalSpend, currency)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Animals Treated</p>
          <p className="stat-value">{treatedAnimalCount}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Latest Checkup</p>
          <p className="stat-value" style={{ fontSize: '1.15rem' }}>
            {allRecords[0]?.date ?? '—'}
          </p>
        </div>
      </div>

      <div className="split-grid">
        <div className="card">
          <h2 className="card-section-title">Log Medical Record</h2>
          {animals.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
              Register an animal in <strong>Herd Registry</strong> first to
              record treatments.
            </p>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-field full">
                  <label className="form-label" htmlFor="med-animal">
                    Animal *
                  </label>
                  <ModernSelect
                    id="med-animal"
                    fullWidth
                    searchable
                    ariaLabel="Select animal"
                    value={selectedAnimalId}
                    options={animalOptions}
                    onChange={setSelectedAnimalId}
                  />
                  {errors.livestockId && (
                    <span className="field-error">{errors.livestockId}</span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="med-date">
                    Date *
                  </label>
                  <ModernDatePicker
                    id="med-date"
                    ariaLabel="Treatment date"
                    value={date}
                    onChange={setDate}
                  />
                  {errors.date && (
                    <span className="field-error">{errors.date}</span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="med-cost">
                    Cost ({currency})
                  </label>
                  <NumberStepper
                    id="med-cost"
                    ariaLabel="Treatment Cost"
                    min={0}
                    step={currency === 'UGX' ? 500 : 1}
                    decimals={currency === 'UGX' ? 0 : 2}
                    value={costText}
                    onChange={setCostText}
                  />
                  {errors.cost && (
                    <span className="field-error">{errors.cost}</span>
                  )}
                </div>

                <div className="form-field full">
                  <label className="form-label" htmlFor="med-condition">
                    Condition / Checkup *
                  </label>
                  <input
                    id="med-condition"
                    className="input"
                    placeholder="e.g. Annual Vaccination, Mastitis"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                  />
                  {errors.condition && (
                    <span className="field-error">{errors.condition}</span>
                  )}
                </div>

                <div className="form-field full">
                  <label className="form-label" htmlFor="med-treatment">
                    Treatment / Medication *
                  </label>
                  <input
                    id="med-treatment"
                    className="input"
                    placeholder="e.g. FMD Booster 2ml"
                    value={treatment}
                    onChange={(e) => setTreatment(e.target.value)}
                  />
                  {errors.treatment && (
                    <span className="field-error">{errors.treatment}</span>
                  )}
                </div>

                <div className="form-field full">
                  <label className="form-label" htmlFor="med-vet">
                    Veterinarian (Optional)
                  </label>
                  <input
                    id="med-vet"
                    className="input"
                    placeholder="e.g. Dr. Patel"
                    value={veterinarian}
                    onChange={(e) => setVeterinarian(e.target.value)}
                  />
                </div>

                <div className="form-field full">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={autoRecordExpense}
                      onChange={(e) => setAutoRecordExpense(e.target.checked)}
                    />
                    <span>
                      Auto-record cost in <strong>Financial Ledger</strong>{' '}
                      (if &gt; 0)
                    </span>
                  </label>
                </div>
              </div>

              {feedback && (
                <p className="success-hint" style={{ marginTop: 10, marginBottom: 0 }}>
                  {feedback}
                </p>
              )}

              <div style={{ marginTop: 14 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createMutation.isPending}
                >
                  <img src={APP_ICONS.plus} alt="" className="app-icon-sm" />
                  {createMutation.isPending ? 'Saving...' : 'Save Medical Record'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="card">
          <div className="chart-header">
            <div>
              <h2 className="card-section-title" style={{ marginBottom: 0 }}>
                Medical Timeline
              </h2>
            </div>
            <img src={APP_ICONS.syringe} alt="" className="app-icon-md" />
          </div>

          <div className="toolbar">
            <div className="search-wrap">
              <Search size={16} className="search-icon" />
              <input
                className="input"
                placeholder="Search condition, treatment, or vet..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <ModernSelect
              ariaLabel="Filter medical timeline by animal"
              searchable
              value={filterLivestockId}
              options={filterAnimalOptions}
              onChange={setFilterLivestockId}
            />

            <ModernSelect
              ariaLabel="Filter by date timeframe"
              value={dateFilter}
              options={dateFilterOptions}
              onChange={setDateFilter}
            />

            <ModernSelect
              ariaLabel="Sort medical records by date"
              value={dateSort}
              options={dateSortOptions}
              onChange={setDateSort}
            />
          </div>

          {visibleRecords.length === 0 ? (
            <div className="empty-state">
              No medical records logged for the selected filter.
            </div>
          ) : (
            <div className="timeline">
              {visibleRecords.map((rec) => {
                const animal = animalsById.get(rec.livestockId);
                return (
                  <div key={rec.id} className="timeline-item">
                    <div className="timeline-dot" />
                    <div className="timeline-card">
                      <div className="timeline-top">
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className="tag-chip">
                            {animal?.tagNumber ?? 'UNKNOWN'}
                          </span>
                          <AnimalEyeButton livestockId={rec.livestockId} />
                          <strong>{rec.condition}</strong>
                        </div>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {formatDisplayDate(rec.date, settings.dateFormat)}
                        </span>
                      </div>

                      <p style={{ margin: '6px 0 4px', fontSize: '0.9rem' }}>
                        Treatment: <strong>{rec.treatment}</strong>
                      </p>

                      <div className="timeline-meta-row">
                        <span>
                          {rec.veterinarian
                            ? `Vet: ${rec.veterinarian}`
                            : 'On-farm care'}{' '}
                          · Cost: {formatCurrency(rec.cost, currency)}
                        </span>
                        <div className="row-actions">
                          {confirmDeleteId === rec.id ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => {
                                  setConfirmDeleteId(null);
                                  void deleteMutation.mutateAsync(rec.id);
                                }}
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
                              onClick={() => {
                                if (settings.confirmBeforeDelete) {
                                  setConfirmDeleteId(rec.id);
                                } else {
                                  void deleteMutation.mutateAsync(rec.id);
                                }
                              }}
                              disabled={deleteMutation.isPending}
                              aria-label="Delete medical record"
                            >
                              <img src={APP_ICONS.delete} alt="" className="app-icon-sm" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
