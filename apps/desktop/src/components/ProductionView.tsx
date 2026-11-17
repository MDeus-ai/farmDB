import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Droplets, Plus, Search, Trash2 } from 'lucide-react';
import {
  buildDailyYieldSeries,
  buildTopProducers,
  formatCurrency,
  getTodayIsoDate,
  roundAmount,
  validateNewProductRecord,
  type NewProductRecordInput,
  type ValidationErrors,
} from '@farmdb/core';
import {
  ProductionValidationError,
  useCreateProductRecord,
  useDeleteProductRecord,
  useFarmSettings,
  useLivestockList,
  useProductRecordList,
} from '@farmdb/db';

export function ProductionView() {
  const livestockQuery = useLivestockList({});
  const settingsQuery = useFarmSettings();
  const [filterLivestockId, setFilterLivestockId] = useState<string>('');
  const [search, setSearch] = useState('');

  const allProductionQuery = useProductRecordList({});
  const filteredProductionQuery = useProductRecordList({
    livestockId: filterLivestockId || undefined,
    search: search || undefined,
  });

  const createMutation = useCreateProductRecord();
  const deleteMutation = useDeleteProductRecord();

  const animals = livestockQuery.data ?? [];
  const activeAnimals = useMemo(
    () => animals.filter((a) => a.status === 'active'),
    [animals]
  );

  const animalsById = useMemo(
    () => new Map(animals.map((a) => [a.id, a])),
    [animals]
  );

  const settings = settingsQuery.data;
  const currency = settings?.currencySymbol ?? '$';
  const defaultRate = settings?.defaultMilkRatePerLiter ?? 0.65;

  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [date, setDate] = useState(() => getTodayIsoDate());
  const [yieldText, setYieldText] = useState('');
  const [qualityNotes, setQualityNotes] = useState('');
  const [autoRecordSale, setAutoRecordSale] = useState(true);
  const [rateText, setRateText] = useState('');
  const [errors, setErrors] = useState<ValidationErrors<NewProductRecordInput>>(
    {}
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAnimalId && activeAnimals[0]) {
      setSelectedAnimalId(activeAnimals[0].id);
    }
  }, [activeAnimals, selectedAnimalId]);

  useEffect(() => {
    if (settings && rateText === '') {
      setRateText(settings.defaultMilkRatePerLiter.toFixed(2));
    }
  }, [settings, rateText]);

  const allRecords = allProductionQuery.data ?? [];
  const visibleRecords = filteredProductionQuery.data ?? [];

  const dailySeries = useMemo(
    () => buildDailyYieldSeries(allRecords, 14),
    [allRecords]
  );

  const topProducers = useMemo(
    () => buildTopProducers(allRecords, animalsById),
    [allRecords, animalsById]
  );

  const todayIso = getTodayIsoDate();
  const todayTotal = useMemo(
    () =>
      roundAmount(
        allRecords
          .filter((r) => r.date === todayIso)
          .reduce((sum, r) => sum + r.yieldAmount, 0)
      ),
    [allRecords, todayIso]
  );

  const fourteenDayTotal = useMemo(
    () =>
      roundAmount(dailySeries.reduce((sum, pt) => sum + pt.totalLiters, 0)),
    [dailySeries]
  );

  const averagePerEntry = useMemo(() => {
    if (allRecords.length === 0) return 0;
    const sum = allRecords.reduce((acc, r) => acc + r.yieldAmount, 0);
    return roundAmount(sum / allRecords.length);
  }, [allRecords]);

  const parsedYield = Number(yieldText);
  const parsedRate = Number(rateText);
  const estimatedSale =
    autoRecordSale &&
    Number.isFinite(parsedYield) &&
    parsedYield > 0 &&
    Number.isFinite(parsedRate) &&
    parsedRate > 0
      ? roundAmount(parsedYield * parsedRate)
      : 0;

  async function handleLogSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);

    const check = validateNewProductRecord({
      livestockId: selectedAnimalId,
      date,
      yieldAmount: parsedYield,
      qualityNotes,
    });

    if (!check.ok || !check.data) {
      setErrors(check.errors);
      return;
    }

    setErrors({});
    try {
      const result = await createMutation.mutateAsync({
        input: check.data,
        options: {
          autoRecordSale,
          ratePerLiter:
            Number.isFinite(parsedRate) && parsedRate >= 0
              ? parsedRate
              : defaultRate,
        },
      });
      setYieldText('');
      setQualityNotes('');
      setFeedback(
        result.generatedIncomeLog
          ? `Logged ${result.record.yieldAmount.toFixed(2)} L and recorded ${formatCurrency(result.generatedIncomeLog.amount, currency)} milk sale income.`
          : `Logged ${result.record.yieldAmount.toFixed(2)} L milk yield.`
      );
    } catch (err) {
      if (err instanceof ProductionValidationError) {
        setErrors(err.errors);
      } else {
        setFeedback(
          err instanceof Error ? err.message : 'Failed to log milk yield.'
        );
      }
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Milk Production</h1>
          <p className="page-subtitle">
            Log daily milk yields per animal and automatically record milk sales at your standard rate.
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-label">Today&apos;s Yield</p>
          <p className="stat-value">{todayTotal.toFixed(1)} L</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">14-Day Total</p>
          <p className="stat-value">{fourteenDayTotal.toFixed(1)} L</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Avg per Log</p>
          <p className="stat-value">{averagePerEntry.toFixed(1)} L</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Top Producer</p>
          <p className="stat-value" style={{ fontSize: '1.15rem' }}>
            {topProducers[0]
              ? `${topProducers[0].tagNumber} (${topProducers[0].totalLiters.toFixed(1)} L)`
              : '—'}
          </p>
        </div>
      </div>

      <div className="split-grid">
        <div className="card">
          <h2 className="card-section-title">Daily Yield Entry</h2>
          {activeAnimals.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
              Add at least one active animal in <strong>Herd Registry</strong>{' '}
              before logging milk production.
            </p>
          ) : (
            <form onSubmit={handleLogSubmit}>
              <div className="form-grid">
                <div className="form-field full">
                  <label className="form-label" htmlFor="prod-animal">
                    Animal *
                  </label>
                  <select
                    id="prod-animal"
                    className="select"
                    value={selectedAnimalId}
                    onChange={(e) => setSelectedAnimalId(e.target.value)}
                  >
                    {activeAnimals.map((animal) => (
                      <option key={animal.id} value={animal.id}>
                        {animal.tagNumber}
                        {animal.name ? ` — ${animal.name}` : ''}
                      </option>
                    ))}
                  </select>
                  {errors.livestockId && (
                    <span className="field-error">{errors.livestockId}</span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="prod-date">
                    Date *
                  </label>
                  <input
                    id="prod-date"
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
                  <label className="form-label" htmlFor="prod-yield">
                    Yield (Liters) *
                  </label>
                  <input
                    id="prod-yield"
                    type="number"
                    step="0.1"
                    min="0.1"
                    className="input"
                    placeholder="e.g. 18.5"
                    value={yieldText}
                    onChange={(e) => setYieldText(e.target.value)}
                  />
                  {errors.yieldAmount && (
                    <span className="field-error">{errors.yieldAmount}</span>
                  )}
                </div>

                <div className="form-field full">
                  <label className="form-label" htmlFor="prod-notes">
                    Quality / Milking Notes
                  </label>
                  <input
                    id="prod-notes"
                    className="input"
                    placeholder="e.g. Morning + evening, clean sample"
                    value={qualityNotes}
                    onChange={(e) => setQualityNotes(e.target.value)}
                  />
                </div>

                <div className="form-field full">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={autoRecordSale}
                      onChange={(e) => setAutoRecordSale(e.target.checked)}
                    />
                    <span>
                      Auto-record <strong>Milk Sale</strong> income entry
                    </span>
                  </label>
                </div>

                {autoRecordSale && (
                  <div className="form-field full">
                    <label className="form-label" htmlFor="prod-rate">
                      Rate ({currency} / Liter)
                    </label>
                    <div className="inline-rate-row">
                      <input
                        id="prod-rate"
                        type="number"
                        step="0.01"
                        min="0"
                        className="input"
                        value={rateText}
                        onChange={(e) => setRateText(e.target.value)}
                      />
                      <span className="rate-preview">
                        Est. Income: <strong>{formatCurrency(estimatedSale, currency)}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {feedback && (
                <p className="success-hint" style={{ marginTop: 12, marginBottom: 0 }}>
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
                  {createMutation.isPending ? 'Saving...' : 'Log Milk Yield'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="card">
          <div className="chart-header">
            <div>
              <h2 className="card-section-title" style={{ marginBottom: 2 }}>
                14-Day Milk Production Trend
              </h2>
              <p className="page-subtitle" style={{ fontSize: '0.82rem' }}>
                Daily total liters across all animals
              </p>
            </div>
            <Droplets size={18} color="#2d6a4f" />
          </div>

          <div style={{ width: '100%', height: 245 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={dailySeries}
                margin={{ top: 10, right: 12, left: -12, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="milkYieldFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2d6a4f" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2d6a4f" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ebe6dc" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5d675f' }} />
                <YAxis tick={{ fontSize: 11, fill: '#5d675f' }} unit=" L" />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(1)} L`, 'Yield']}
                  labelFormatter={(label) => `Date: ${String(label)}`}
                />
                <Area
                  type="monotone"
                  dataKey="totalLiters"
                  stroke="#2d6a4f"
                  strokeWidth={2.5}
                  fill="url(#milkYieldFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="search-wrap">
            <Search size={16} className="search-icon" />
            <input
              className="input"
              placeholder="Search notes or date (YYYY-MM-DD)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="select"
            aria-label="Filter by animal"
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
            No milk production records logged yet.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Animal</th>
                  <th>Yield (L)</th>
                  <th>Quality Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((rec) => {
                  const animal = animalsById.get(rec.livestockId);
                  return (
                    <tr key={rec.id}>
                      <td>{rec.date}</td>
                      <td>
                        <span className="tag-chip">
                          {animal?.tagNumber ?? 'UNKNOWN'}
                        </span>{' '}
                        {animal?.name ?? ''}
                      </td>
                      <td>
                        <strong>{rec.yieldAmount.toFixed(2)} L</strong>
                      </td>
                      <td>{rec.qualityNotes ?? '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => void deleteMutation.mutateAsync(rec.id)}
                          disabled={deleteMutation.isPending}
                          aria-label="Delete milk record"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
