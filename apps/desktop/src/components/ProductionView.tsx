import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Search } from 'lucide-react';
import {
  buildTopProducers,
  buildYieldSeriesForTimeframe,
  convertDisplayVolumeToLiters,
  convertLitersToDisplayVolume,
  DEFAULT_FARM_SETTINGS,
  describeModuleAccessLevel,
  filterAndSortRecordsByDate,
  formatCompactAxisNumber,
  formatCurrency,
  formatDisplayDate,
  formatVolume,
  getTodayIsoDate,
  getVolumeUnitShortLabel,
  isFemaleMilkProducingAnimal,
  RECORD_DATE_FILTER_OPTIONS,
  roundAmount,
  validateNewProductRecord,
  type DateSortDirection,
  type NewProductRecordInput,
  type RecordDateFilter,
  type StatisticsTimeframe,
  type ValidationErrors,
} from '@farmdb/core';
import {
  ProductionValidationError,
  useCreateProductRecord,
  useDeleteProductRecord,
  useFarmSettings,
  useLivestockList,
  useModulePermissions,
  useProductRecordList,
} from '@farmdb/db';
import { APP_ICONS } from '../assets/icons';
import { buildAnimalSelectOption } from '../utils/animalOptions';
import { computeDesktopNumericYAxisWidth } from '../utils/chartAxis';
import { AnimalEyeButton } from './AnimalQuickPreviewModal';
import { ModernDatePicker } from './ModernDatePicker';
import { ModernSelect, type ModernSelectOption } from './ModernSelect';
import { NumberStepper } from './NumberStepper';

type ChartWindow = Extract<StatisticsTimeframe, '14d' | 'weeks' | 'months' | 'years'>;

const PRODUCTION_CHART_WINDOWS: readonly { value: ChartWindow; label: string }[] = [
  { value: '14d', label: '14D' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
  { value: 'years', label: 'Years' },
];

export function ProductionView() {
  const livestockQuery = useLivestockList({});
  const settingsQuery = useFarmSettings();
  const [filterLivestockId, setFilterLivestockId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [chartWindow, setChartWindow] = useState<ChartWindow>('14d');
  const [dateFilter, setDateFilter] = useState<RecordDateFilter>('all');
  const [dateSort, setDateSort] = useState<DateSortDirection>('desc');

  const allProductionQuery = useProductRecordList({});
  const filteredProductionQuery = useProductRecordList({
    livestockId: filterLivestockId || undefined,
    search: search || undefined,
  });

  const createMutation = useCreateProductRecord();
  const deleteMutation = useDeleteProductRecord();

  const animals = livestockQuery.data ?? [];
  const activeAnimals = useMemo(
    () =>
      animals.filter(
        (a) => a.status === 'active' && isFemaleMilkProducingAnimal(a)
      ),
    [animals]
  );

  const animalsById = useMemo(
    () => new Map(animals.map((a) => [a.id, a])),
    [animals]
  );

  const settings = settingsQuery.data ?? DEFAULT_FARM_SETTINGS;
  const { canEdit, canDelete, accessLevel } = useModulePermissions('production');

  const activeAnimalOptions = useMemo<ModernSelectOption<string>[]>(
    () =>
      activeAnimals.map((animal) =>
        buildAnimalSelectOption(animal, {
          dateFormat: settings.dateFormat,
          label: `${animal.tagNumber}${animal.name ? ` — ${animal.name}` : ''}`,
        })
      ),
    [activeAnimals, settings.dateFormat]
  );

  const filterAnimalOptions = useMemo<ModernSelectOption<string>[]>(
    () => [
      { value: '', label: 'All Animals', iconSrc: APP_ICONS.group },
      ...animals
        .filter((animal) => isFemaleMilkProducingAnimal(animal))
        .map((animal) =>
          buildAnimalSelectOption(animal, {
            dateFormat: settings.dateFormat,
            label: `${animal.tagNumber}${animal.name ? ` — ${animal.name}` : ''}`,
          })
        ),
    ],
    [animals, settings.dateFormat]
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
  const defaultRate = settings.defaultMilkRatePerLiter;
  const volumeUnit = settings.volumeUnit;
  const volumeShort = getVolumeUnitShortLabel(volumeUnit);

  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [date, setDate] = useState(() => getTodayIsoDate());
  const [yieldText, setYieldText] = useState('');
  const [qualityNotes, setQualityNotes] = useState('');
  const [autoRecordSale, setAutoRecordSale] = useState(
    settings.autoRecordMilkSaleByDefault
  );
  const initializedAutoRef = useRef(false);
  const [rateText, setRateText] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [errors, setErrors] = useState<ValidationErrors<NewProductRecordInput>>(
    {}
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (
      activeAnimals.length > 0 &&
      (!selectedAnimalId || !activeAnimals.some((a) => a.id === selectedAnimalId))
    ) {
      setSelectedAnimalId(activeAnimals[0]!.id);
    } else if (activeAnimals.length === 0 && selectedAnimalId !== '') {
      setSelectedAnimalId('');
    }
  }, [activeAnimals, selectedAnimalId]);

  useEffect(() => {
    if (settingsQuery.data) {
      if (rateText === '') {
        setRateText(settingsQuery.data.defaultMilkRatePerLiter.toFixed(2));
      }
      if (!initializedAutoRef.current) {
        setAutoRecordSale(settingsQuery.data.autoRecordMilkSaleByDefault);
        initializedAutoRef.current = true;
      }
    }
  }, [settingsQuery.data, rateText]);

  const allRecords = allProductionQuery.data ?? [];
  const visibleRecords = useMemo(
    () =>
      filterAndSortRecordsByDate(filteredProductionQuery.data ?? [], {
        filter: dateFilter,
        sort: dateSort,
      }),
    [filteredProductionQuery.data, dateFilter, dateSort]
  );

  const dailySeries = useMemo(
    () =>
      buildYieldSeriesForTimeframe(allRecords, chartWindow).map((pt) => ({
        ...pt,
        displayTotal: convertLitersToDisplayVolume(pt.totalLiters, volumeUnit),
      })),
    [allRecords, chartWindow, volumeUnit]
  );

  const milkDecimals = useMemo(
    () =>
      dailySeries.some((d) => d.displayTotal > 0 && d.displayTotal < 100)
        ? 1
        : 0,
    [dailySeries]
  );

  const milkYAxisWidth = useMemo(
    () =>
      computeDesktopNumericYAxisWidth(
        dailySeries.map((d) => d.displayTotal),
        (v) => `${formatCompactAxisNumber(v, milkDecimals)} ${volumeShort}`,
        { minWidth: 46, maxWidth: 92 }
      ),
    [dailySeries, milkDecimals, volumeShort]
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
  const normalizedLiters =
    Number.isFinite(parsedYield) && parsedYield > 0
      ? convertDisplayVolumeToLiters(parsedYield, volumeUnit)
      : NaN;
  const parsedRate = Number(rateText);
  const estimatedSale =
    autoRecordSale &&
      Number.isFinite(normalizedLiters) &&
      normalizedLiters > 0 &&
      Number.isFinite(parsedRate) &&
      parsedRate > 0
      ? roundAmount(normalizedLiters * parsedRate)
      : 0;

  async function handleLogSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);

    const check = validateNewProductRecord(
      {
        livestockId: selectedAnimalId,
        date,
        yieldAmount: normalizedLiters,
        qualityNotes,
      },
      { animal: animalsById.get(selectedAnimalId) }
    );

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
          ? `Logged ${formatVolume(result.record.yieldAmount, volumeUnit)} and recorded ${formatCurrency(result.generatedIncomeLog.amount, currency)} milk sale income.`
          : `Logged ${formatVolume(result.record.yieldAmount, volumeUnit)} milk yield.`
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

  async function handleDeleteRecord(id: string) {
    if (settings.confirmBeforeDelete && confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setConfirmDeleteId(null);
    await deleteMutation.mutateAsync(id);
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Milk Production</h1>
        </div>
        {(!canEdit || !canDelete) && (
          <span className="status-pill status-sold">
            {describeModuleAccessLevel(accessLevel)}
          </span>
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-label">Today&apos;s Yield</p>
          <p className="stat-value">{formatVolume(todayTotal, volumeUnit)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">14-Day Total</p>
          <p className="stat-value">{formatVolume(fourteenDayTotal, volumeUnit)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Avg per Log</p>
          <p className="stat-value">{formatVolume(averagePerEntry, volumeUnit)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Top Producer</p>
          <p className="stat-value" style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {topProducers[0] ? (
              <>
                <span>
                  {topProducers[0].tagNumber} ({formatVolume(topProducers[0].totalLiters, volumeUnit)})
                </span>
                <AnimalEyeButton livestockId={topProducers[0].livestockId} />
              </>
            ) : (
              '—'
            )}
          </p>
        </div>
      </div>

      <div className="split-grid">
        <div className="card">
          <h2 className="card-section-title">Daily Yield Entry</h2>
          {!canEdit ? (
            <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
              View-Only Access: Your account can review production logs and charts, but cannot record new yields.
            </p>
          ) : activeAnimals.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
              No active female milk-producing animals (cow, goat, or sheep) yet.
            </p>
          ) : (
            <form onSubmit={handleLogSubmit}>
              <div className="form-grid">
                <div className="form-field full">
                  <label className="form-label" htmlFor="prod-animal">
                    Animal *
                  </label>
                  <ModernSelect
                    id="prod-animal"
                    fullWidth
                    searchable
                    ariaLabel="Select animal"
                    value={selectedAnimalId}
                    options={activeAnimalOptions}
                    onChange={setSelectedAnimalId}
                  />
                  {errors.livestockId && (
                    <span className="field-error">{errors.livestockId}</span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="prod-date">
                    Date *
                  </label>
                  <ModernDatePicker
                    id="prod-date"
                    ariaLabel="Milking date"
                    value={date}
                    onChange={setDate}
                  />
                  {errors.date && (
                    <span className="field-error">{errors.date}</span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="prod-yield">
                    Yield ({volumeShort}) *
                  </label>
                  <NumberStepper
                    id="prod-yield"
                    ariaLabel={`Yield in ${volumeShort}`}
                    min={0.1}
                    step={0.5}
                    decimals={1}
                    placeholder="e.g. 18.5"
                    value={yieldText}
                    onChange={setYieldText}
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
                      <NumberStepper
                        id="prod-rate"
                        ariaLabel="Milk Rate per Liter"
                        compact
                        min={0}
                        step={currency === 'UGX' ? 100 : 0.05}
                        decimals={currency === 'UGX' ? 0 : 2}
                        value={rateText}
                        onChange={setRateText}
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
                  <img src={APP_ICONS.plus} alt="" className="app-icon-sm" />
                  {createMutation.isPending ? 'Saving...' : 'Log Milk Yield'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="card chart-card">
          <div className="chart-header">
            <div>
              <h2 className="card-section-title" style={{ marginBottom: 0 }}>
                {chartWindow === '14d'
                  ? '14-Day'
                  : chartWindow === 'weeks'
                    ? '12-Week'
                    : chartWindow === 'months'
                      ? '12-Month'
                      : 'Yearly'}{' '}
                Milk Production Trend ({volumeShort})
              </h2>
            </div>
            <div className="segmented-group" role="group" aria-label="Production trend window">
              {PRODUCTION_CHART_WINDOWS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`segmented-btn ${chartWindow === opt.value ? 'active' : ''}`}
                  onClick={() => setChartWindow(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="chart-fill-wrap">
            <div className="chart-fill-inner">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={dailySeries}
                  margin={{ top: 6, right: 12, left: 4, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="milkYieldFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2d6a4f" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#2d6a4f" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ebe6dc" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5d675f' }} />
                  <YAxis
                    width={milkYAxisWidth}
                    tick={{ fontSize: 11, fill: '#5d675f' }}
                    tickFormatter={(v) =>
                      `${formatCompactAxisNumber(v, milkDecimals)} ${volumeShort}`
                    }
                  />
                  <Tooltip
                    formatter={(value) => [`${Number(value).toFixed(1)} ${volumeShort}`, 'Yield']}
                    labelFormatter={(label) => `Date: ${String(label)}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="displayTotal"
                    stroke="#2d6a4f"
                    strokeWidth={2.5}
                    fill="url(#milkYieldFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
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

          <ModernSelect
            ariaLabel="Filter by animal"
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
            ariaLabel="Sort milk logs by date"
            value={dateSort}
            options={dateSortOptions}
            onChange={setDateSort}
          />
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
                  <th>Yield ({volumeShort})</th>
                  <th>Quality Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((rec) => {
                  const animal = animalsById.get(rec.livestockId);
                  return (
                    <tr key={rec.id}>
                      <td>{formatDisplayDate(rec.date, settings.dateFormat)}</td>
                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span className="tag-chip">
                            {animal?.tagNumber ?? 'UNKNOWN'}
                          </span>
                          {animal?.name ?? ''}
                          <AnimalEyeButton livestockId={rec.livestockId} />
                        </div>
                      </td>
                      <td>
                        <strong>{formatVolume(rec.yieldAmount, volumeUnit)}</strong>
                      </td>
                      <td>{rec.qualityNotes ?? '—'}</td>
                      <td>
                        {canDelete ? (
                          <div className="row-actions">
                            {confirmDeleteId === rec.id ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => void handleDeleteRecord(rec.id)}
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
                                onClick={() => void handleDeleteRecord(rec.id)}
                                disabled={deleteMutation.isPending}
                                aria-label="Delete milk record"
                              >
                                <img src={APP_ICONS.delete} alt="" className="app-icon-sm" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            Protected
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
    </>
  );
}
