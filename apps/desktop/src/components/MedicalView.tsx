import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Stethoscope, Trash2 } from 'lucide-react';
import {
  formatCurrency,
  getTodayIsoDate,
  roundAmount,
  validateNewMedicalRecord,
  type NewMedicalRecordInput,
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

export function MedicalView() {
  const livestockQuery = useLivestockList({});
  const settingsQuery = useFarmSettings();
  const [filterLivestockId, setFilterLivestockId] = useState('');
  const [search, setSearch] = useState('');

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

  const currency = settingsQuery.data?.currencySymbol ?? '$';

  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [date, setDate] = useState(() => getTodayIsoDate());
  const [condition, setCondition] = useState('');
  const [treatment, setTreatment] = useState('');
  const [costText, setCostText] = useState('0');
  const [veterinarian, setVeterinarian] = useState('');
  const [autoRecordExpense, setAutoRecordExpense] = useState(true);
  const [errors, setErrors] = useState<ValidationErrors<NewMedicalRecordInput>>(
    {}
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAnimalId && animals[0]) {
      setSelectedAnimalId(animals[0].id);
    }
  }, [animals, selectedAnimalId]);

  const allRecords = allMedicalQuery.data ?? [];
  const visibleRecords = filteredMedicalQuery.data ?? [];

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
          <p className="page-subtitle">
            Track vaccinations, diagnoses, treatments, and veterinary visits across your herd.
          </p>
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
                  <select
                    id="med-animal"
                    className="select"
                    value={selectedAnimalId}
                    onChange={(e) => setSelectedAnimalId(e.target.value)}
                  >
                    {animals.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.tagNumber}
                        {a.name ? ` — ${a.name}` : ''}
                      </option>
                    ))}
                  </select>
                  {errors.livestockId && (
                    <span className="field-error">{errors.livestockId}</span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="med-date">
                    Date *
                  </label>
                  <input
                    id="med-date"
                    type="date"
                    className="input"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                  {errors.date && (
                    <span className="field-error">{errors.date}</span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="med-cost">
                    Cost ({currency})
                  </label>
                  <input
                    id="med-cost"
                    type="number"
                    step="0.01"
                    min="0"
                    className="input"
                    value={costText}
                    onChange={(e) => setCostText(e.target.value)}
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
                  <Plus size={16} />
                  {createMutation.isPending ? 'Saving...' : 'Save Medical Record'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="card">
          <div className="chart-header">
            <div>
              <h2 className="card-section-title" style={{ marginBottom: 2 }}>
                Medical Timeline
              </h2>
              <p className="page-subtitle" style={{ fontSize: '0.82rem' }}>
                Filter by animal or search treatments & veterinarians
              </p>
            </div>
            <Stethoscope size={18} color="#2d6a4f" />
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

            <select
              className="select"
              aria-label="Filter medical timeline by animal"
              value={filterLivestockId}
              onChange={(e) => setFilterLivestockId(e.target.value)}
            >
              <option value="">All Animals</option>
              {animals.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.tagNumber}
                  {a.name ? ` — ${a.name}` : ''}
                </option>
              ))}
            </select>
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
                          <strong>{rec.condition}</strong>
                        </div>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {rec.date}
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
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => void deleteMutation.mutateAsync(rec.id)}
                          disabled={deleteMutation.isPending}
                          aria-label="Delete medical record"
                        >
                          <Trash2 size={13} />
                        </button>
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
