import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  computeLivestockStatistics,
  convertLitersToDisplayVolume,
  DEFAULT_FARM_SETTINGS,
  formatCompactAxisNumber,
  formatCurrency,
  formatSexLabel,
  formatSpeciesLabel,
  getVolumeUnitShortLabel,
  LIVESTOCK_SEXES,
  SPECIES_LIST,
  STATISTICS_TIMEFRAME_OPTIONS,
  type LivestockSex,
  type Species,
  type StatisticsTimeframe,
} from '@farmdb/core';
import {
  useFarmSettings,
  useFinancialLogList,
  useLivestockList,
  useMedicalRecordList,
  useOwnershipList,
  useProductRecordList,
} from '@farmdb/db';
import { APP_ICONS, getSexPngIcon, getSpeciesPngIcon } from '../assets/icons';
import {
  computeDesktopCategoryYAxis,
  computeDesktopNumericYAxisWidth,
} from '../utils/chartAxis';
import { ModernSelect, type ModernSelectOption } from './ModernSelect';

const COHORT_COLORS = [
  '#1b4332',
  '#2d6a4f',
  '#40916c',
  '#74c69d',
  '#b07219',
  '#8d9991',
];

function formatAgeMonthsSummary(avgMonths: number | null): string {
  if (avgMonths === null) {
    return 'No DOBs logged';
  }
  const rounded = Math.round(avgMonths);
  if (rounded < 12) {
    return `${rounded} mo${rounded === 1 ? '' : 's'}`;
  }
  const years = Math.floor(rounded / 12);
  const rem = rounded % 12;
  return rem === 0 ? `${years} yr${years === 1 ? '' : 's'}` : `${years}y ${rem}m`;
}

type StatsSpeciesFilter =
  | 'all'
  | 'cow'
  | 'bull'
  | 'cattle'
  | Exclude<Species, 'cow'>;

export function FarmStatisticsView() {
  const [speciesFilter, setSpeciesFilter] = useState<StatsSpeciesFilter>('all');
  const [sexFilter, setSexFilter] = useState<LivestockSex | 'all'>('all');
  const [timeframe, setTimeframe] = useState<StatisticsTimeframe>('14d');

  const querySpecies: Species | 'all' =
    speciesFilter === 'bull' || speciesFilter === 'cattle' || speciesFilter === 'cow'
      ? 'cow'
      : speciesFilter;

  const settingsQuery = useFarmSettings();
  const livestockQuery = useLivestockList({});
  const productQuery = useProductRecordList({});
  const medicalQuery = useMedicalRecordList({});
  const financialQuery = useFinancialLogList({});
  const ownershipQuery = useOwnershipList({});

  const settings = settingsQuery.data ?? DEFAULT_FARM_SETTINGS;
  const currency = settings.currencySymbol;
  const volumeUnit = settings.volumeUnit;
  const volumeShort = getVolumeUnitShortLabel(volumeUnit);

  const report = useMemo(
    () =>
      computeLivestockStatistics({
        livestock: livestockQuery.data ?? [],
        productRecords: productQuery.data ?? [],
        medicalRecords: medicalQuery.data ?? [],
        financialLogs: financialQuery.data ?? [],
        ownerships: ownershipQuery.data ?? [],
        speciesFilter: querySpecies,
        sexFilter,
        timeframe,
      }),
    [
      livestockQuery.data,
      productQuery.data,
      medicalQuery.data,
      financialQuery.data,
      ownershipQuery.data,
      querySpecies,
      sexFilter,
      timeframe,
    ]
  );

  const dailyYieldData = useMemo(
    () =>
      report.dailyMilkSeries.map((pt) => ({
        ...pt,
        displayLiters: convertLitersToDisplayVolume(pt.totalLiters, volumeUnit),
      })),
    [report.dailyMilkSeries, volumeUnit]
  );

  const topProducerChartData = useMemo(
    () =>
      report.topProducers.slice(0, 6).map((item) => ({
        label: item.name ? `${item.name} (${item.tagNumber})` : item.tagNumber,
        displayTotal: convertLitersToDisplayVolume(item.totalLiters, volumeUnit),
        avgYield: convertLitersToDisplayVolume(item.averageYield, volumeUnit),
        recordCount: item.recordCount,
      })),
    [report.topProducers, volumeUnit]
  );

  const milkDecimals = useMemo(
    () =>
      dailyYieldData.some((d) => d.displayLiters > 0 && d.displayLiters < 100)
        ? 1
        : 0,
    [dailyYieldData]
  );

  const topProducerDecimals = useMemo(
    () =>
      topProducerChartData.some(
        (d) => d.displayTotal > 0 && d.displayTotal < 100
      )
        ? 1
        : 0,
    [topProducerChartData]
  );

  const milkYAxisWidth = useMemo(
    () =>
      computeDesktopNumericYAxisWidth(
        dailyYieldData.map((d) => d.displayLiters),
        (v) => `${formatCompactAxisNumber(v, milkDecimals)} ${volumeShort}`,
        { minWidth: 46, maxWidth: 92 }
      ),
    [dailyYieldData, milkDecimals, volumeShort]
  );

  const speciesYAxisWidth = useMemo(
    () =>
      computeDesktopNumericYAxisWidth(
        report.speciesBreakdown.map((s) => s.totalCount),
        (v) => formatCompactAxisNumber(v, 0),
        { minWidth: 34, maxWidth: 74 }
      ),
    [report.speciesBreakdown]
  );

  const topProducerYAxis = useMemo(
    () =>
      computeDesktopCategoryYAxis(
        topProducerChartData.map((d) => d.label),
        { fontSize: 11, minWidth: 104, maxWidth: 210 }
      ),
    [topProducerChartData]
  );

  const conditionsYAxisWidth = useMemo(
    () =>
      computeDesktopNumericYAxisWidth(
        report.topConditions.map((c) => c.eventCount),
        (v) => formatCompactAxisNumber(v, 0),
        { minWidth: 34, maxWidth: 74 }
      ),
    [report.topConditions]
  );

  const breedsYAxisWidth = useMemo(
    () =>
      computeDesktopNumericYAxisWidth(
        report.topBreeds.map((b) => b.count),
        (v) => formatCompactAxisNumber(v, 0),
        { minWidth: 34, maxWidth: 74 }
      ),
    [report.topBreeds]
  );

  const activeCohorts = useMemo(
    () => report.ageCohorts.filter((c) => c.count > 0),
    [report.ageCohorts]
  );

  const speciesFilterOptions = useMemo<ModernSelectOption<StatsSpeciesFilter>[]>(
    () => [
      { value: 'all', label: 'All Species', iconSrc: APP_ICONS.group },
      { value: 'cow', label: 'Cow', iconSrc: getSpeciesPngIcon('cow', 'female') },
      { value: 'bull', label: 'Bull', iconSrc: getSpeciesPngIcon('cow', 'male') },
      { value: 'cattle', label: 'Cattle (All)', iconSrc: APP_ICONS.herd },
      ...SPECIES_LIST.filter((sp) => sp !== 'cow').map((sp) => ({
        value: sp as StatsSpeciesFilter,
        label: formatSpeciesLabel(sp),
        iconSrc: getSpeciesPngIcon(sp),
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

  const avgMilkPerAnimalDisplay = convertLitersToDisplayVolume(
    report.avgMilkPerAnimal,
    volumeUnit
  );
  const avgMilkPerMilkingFemaleDisplay = convertLitersToDisplayVolume(
    report.avgMilkPerMilkingFemale,
    volumeUnit
  );
  const totalMilkDisplay = convertLitersToDisplayVolume(
    report.totalMilkLiters,
    volumeUnit
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Farm Statistics</h1>
        </div>

        <div className="row-actions" style={{ flexWrap: 'wrap' }}>
          <ModernSelect
            ariaLabel="Filter statistics by species"
            value={speciesFilter}
            options={speciesFilterOptions}
            onChange={(next) => {
              setSpeciesFilter(next);
              if (next === 'cow') {
                setSexFilter('female');
              } else if (next === 'bull') {
                setSexFilter('male');
              } else {
                setSexFilter('all');
              }
            }}
          />
          <ModernSelect
            ariaLabel="Filter statistics by sex"
            value={sexFilter}
            options={sexFilterOptions}
            onChange={(nextSex) => {
              setSexFilter(nextSex);
              if (speciesFilter === 'cow' || speciesFilter === 'bull' || speciesFilter === 'cattle') {
                setSpeciesFilter(
                  nextSex === 'male' ? 'bull' : nextSex === 'female' ? 'cow' : 'cattle'
                );
              }
            }}
          />
          <div className="segmented-group" role="group" aria-label="Trend window">
            {STATISTICS_TIMEFRAME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`segmented-btn ${timeframe === opt.value ? 'active' : ''}`}
                title={opt.label}
                onClick={() => setTimeframe(opt.value)}
              >
                {opt.shortLabel}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-label">Active Herd</p>
          <p className="stat-value">
            {report.activeAnimals} / {report.totalAnimals}
          </p>
          <p className="page-subtitle" style={{ fontSize: '0.78rem' }}>
            {report.activeSharePercent}% active · {report.externalOwnedAnimals} external/shared
          </p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Gender &amp; Cattle Split</p>
          <p
            className="stat-value"
            style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <img src={APP_ICONS.female} alt="Female" style={{ width: 17, height: 17, objectFit: 'contain' }} />
              {report.femaleCount}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>/</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <img src={APP_ICONS.male} alt="Male" style={{ width: 17, height: 17, objectFit: 'contain' }} />
              {report.maleCount}
            </span>
          </p>
          <p
            className="page-subtitle"
            style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <img src={APP_ICONS.cow} alt="" style={{ width: 13, height: 13, objectFit: 'contain' }} />
              {report.cowsCount} Cow{report.cowsCount === 1 ? '' : 's'}
            </span>
            <span>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <img src={APP_ICONS.bull} alt="" style={{ width: 13, height: 13, objectFit: 'contain' }} />
              {report.bullsCount} Bull{report.bullsCount === 1 ? '' : 's'}
            </span>
          </p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Cumulative Milk Output</p>
          <p className="stat-value">
            {totalMilkDisplay.toFixed(1)} {volumeShort}
          </p>
          <p className="page-subtitle" style={{ fontSize: '0.78rem' }}>
            {report.milkingEligibleCount > 0
              ? `Avg ${avgMilkPerMilkingFemaleDisplay.toFixed(1)} ${volumeShort} / milking female (${report.milkingEligibleCount} active)`
              : `Avg ${avgMilkPerAnimalDisplay.toFixed(1)} ${volumeShort} / milking animal`}
          </p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Preventive Care Coverage</p>
          <p className="stat-value">{report.vaccinationCoveragePercent}%</p>
          <p className="page-subtitle" style={{ fontSize: '0.78rem' }}>
            {report.vaccinatedAnimalsCount} covered · {report.totalMedicalEvents} medical logs
          </p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Medical Spend</p>
          <p className="stat-value">
            {formatCurrency(report.totalMedicalCost, currency)}
          </p>
          <p className="page-subtitle" style={{ fontSize: '0.78rem' }}>
            Across {report.treatedAnimalsCount} treated animals
          </p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Average Herd Age</p>
          <p className="stat-value">
            {formatAgeMonthsSummary(report.averageAgeMonths)}
          </p>
          <p className="page-subtitle" style={{ fontSize: '0.78rem' }}>
            {report.lineageLinkedAnimals} animals linked to lineage
          </p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Net Livestock Profit</p>
          <p
            className="stat-value"
            style={{
              color:
                report.financialSummary.netProfit >= 0
                  ? 'var(--accent)'
                  : 'var(--danger)',
            }}
          >
            {formatCurrency(report.financialSummary.netProfit, currency)}
          </p>
          <p className="page-subtitle" style={{ fontSize: '0.78rem' }}>
            {report.financialSummary.profitMarginPercent}% margin
          </p>
        </div>
      </div>

      {/* Row 1: Production Trend & Herd by Species */}
      <div className="split-grid">
        <div className="card chart-card">
          <div className="chart-header">
            <div>
              <h2 className="card-section-title" style={{ marginBottom: 0 }}>
                {report.chartTitlePrefix} Milk Yield ({volumeShort})
              </h2>
            </div>
            <img src={APP_ICONS.milkBottle} alt="" className="app-icon-md" />
          </div>

          <div className="chart-fill-wrap">
            <div className="chart-fill-inner">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={dailyYieldData}
                  margin={{ top: 6, right: 12, left: 4, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="statsMilkAreaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2d6a4f" stopOpacity={0.38} />
                      <stop offset="95%" stopColor="#2d6a4f" stopOpacity={0.03} />
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
                    formatter={(value) => [
                      `${Number(value).toFixed(1)} ${volumeShort}`,
                      'Daily Yield',
                    ]}
                    labelFormatter={(label) => `Date: ${String(label)}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="displayLiters"
                    stroke="#2d6a4f"
                    strokeWidth={2.5}
                    fill="url(#statsMilkAreaFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card chart-card">
          <div className="chart-header">
            <div>
              <h2 className="card-section-title" style={{ marginBottom: 0 }}>
                Herd Status by Species
              </h2>
            </div>
            <img src={APP_ICONS.livestockGroup} alt="" className="app-icon-md" />
          </div>

          {report.speciesBreakdown.length === 0 ? (
            <div className="empty-state" style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
              No livestock yet.
            </div>
          ) : (
            <div className="chart-fill-wrap">
              <div className="chart-fill-inner">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={report.speciesBreakdown}
                    margin={{ top: 6, right: 12, left: 4, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ebe6dc" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5d675f' }} />
                    <YAxis
                      width={speciesYAxisWidth}
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#5d675f' }}
                      tickFormatter={(v) => formatCompactAxisNumber(v, 0)}
                    />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="activeCount"
                      name="Active"
                      stackId="herd"
                      fill="#2d6a4f"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="soldCount"
                      name="Sold"
                      stackId="herd"
                      fill="#b07219"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="deceasedCount"
                      name="Deceased"
                      stackId="herd"
                      fill="#c44536"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Top Producers & Age Cohort Distribution */}
      <div className="split-grid">
        <div className="card chart-card">
          <div className="chart-header">
            <div>
              <h2 className="card-section-title" style={{ marginBottom: 0 }}>
                Top Producers ({volumeShort})
              </h2>
            </div>
            <img src={APP_ICONS.cow} alt="" className="app-icon-md" />
          </div>

          {topProducerChartData.length === 0 ? (
            <div className="empty-state" style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
              No yield logs yet.
            </div>
          ) : (
            <div className="chart-fill-wrap">
              <div className="chart-fill-inner">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topProducerChartData}
                    layout="vertical"
                    margin={{ top: 4, right: 20, left: 6, bottom: 2 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ebe6dc" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: '#5d675f' }}
                      tickFormatter={(v) =>
                        `${formatCompactAxisNumber(v, topProducerDecimals)} ${volumeShort}`
                      }
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={topProducerYAxis.width}
                      tick={{ fontSize: 11, fill: '#1c241e' }}
                      tickFormatter={(v) => topProducerYAxis.formatTick(String(v))}
                    />
                    <Tooltip
                      labelFormatter={(label, payload) =>
                        String(payload?.[0]?.payload?.label ?? label)
                      }
                      formatter={(value) => [
                        `${Number(value).toFixed(1)} ${volumeShort}`,
                        'Cumulative Yield',
                      ]}
                    />
                    <Bar
                      dataKey="displayTotal"
                      name="Total Yield"
                      fill="#40916c"
                      radius={[0, 6, 6, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        <div className="card chart-card">
          <div className="chart-header">
            <div>
              <h2 className="card-section-title" style={{ marginBottom: 0 }}>
                Age Demographics
              </h2>
            </div>
            <img src={APP_ICONS.calendar} alt="" className="app-icon-md" />
          </div>

          {activeCohorts.length === 0 ? (
            <div className="empty-state" style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
              No birth dates logged.
            </div>
          ) : (
            <div className="chart-fill-wrap">
              <div className="chart-fill-inner">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={activeCohorts}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="46%"
                      innerRadius="54%"
                      outerRadius="88%"
                      paddingAngle={3}
                    >
                      {activeCohorts.map((entry, idx) => (
                        <Cell
                          key={entry.cohort}
                          fill={COHORT_COLORS[idx % COHORT_COLORS.length]!}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [
                        `${Number(value)} animal(s)`,
                        String(name),
                      ]}
                    />
                    <Legend verticalAlign="bottom" height={28} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Medical Conditions & Breed Composition */}
      <div className="split-grid">
        <div className="card chart-card">
          <div className="chart-header">
            <div>
              <h2 className="card-section-title" style={{ marginBottom: 0 }}>
                Health Conditions
              </h2>
            </div>
            <img src={APP_ICONS.syringe} alt="" className="app-icon-md" />
          </div>

          {report.topConditions.length === 0 ? (
            <div className="empty-state" style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
              No medical logs yet.
            </div>
          ) : (
            <div className="chart-fill-wrap">
              <div className="chart-fill-inner">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={report.topConditions}
                    margin={{ top: 6, right: 12, left: 4, bottom: 2 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ebe6dc" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5d675f' }} />
                    <YAxis
                      width={conditionsYAxisWidth}
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#5d675f' }}
                      tickFormatter={(v) => formatCompactAxisNumber(v, 0)}
                    />
                    <Tooltip
                      formatter={(value, name) =>
                        name === 'Spend'
                          ? [formatCurrency(Number(value), currency), 'Medical Spend']
                          : [`${Number(value)} event(s)`, 'Events']
                      }
                    />
                    <Legend />
                    <Bar
                      dataKey="eventCount"
                      name="Events"
                      fill="#1b4332"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        <div className="card chart-card">
          <div className="chart-header">
            <div>
              <h2 className="card-section-title" style={{ marginBottom: 0 }}>
                Breed Distribution
              </h2>
            </div>
            <img src={APP_ICONS.tree} alt="" className="app-icon-md" />
          </div>

          {report.topBreeds.length === 0 ? (
            <div className="empty-state" style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
              No animals yet.
            </div>
          ) : (
            <div className="chart-fill-wrap">
              <div className="chart-fill-inner">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={report.topBreeds}
                    margin={{ top: 6, right: 12, left: 4, bottom: 2 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ebe6dc" />
                    <XAxis dataKey="breed" tick={{ fontSize: 11, fill: '#5d675f' }} />
                    <YAxis
                      width={breedsYAxisWidth}
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#5d675f' }}
                      tickFormatter={(v) => formatCompactAxisNumber(v, 0)}
                    />
                    <Tooltip
                      formatter={(value) => [`${Number(value)} animal(s)`, 'Headcount']}
                    />
                    <Bar
                      dataKey="count"
                      name="Animals"
                      fill="#2d6a4f"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Herd Gender & Cattle Composition */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="chart-header">
          <div>
            <h2 className="card-section-title" style={{ marginBottom: 0 }}>
              Gender &amp; Dairy-Eligibility Mix
            </h2>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <img src={APP_ICONS.female} alt="" className="app-icon-sm" />
            <img src={APP_ICONS.male} alt="" className="app-icon-sm" />
          </div>
        </div>

        <div className="split-grid" style={{ gap: 14 }}>
          {report.sexBreakdown.map((sx) => {
            const isFemale = sx.sex === 'female';
            const fillColor = isFemale ? '#b83b72' : '#1e5f8a';
            const milkDisp = convertLitersToDisplayVolume(sx.milkLiters, volumeUnit);
            return (
              <div
                key={sx.sex}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  background: isFemale ? 'rgba(184, 59, 114, 0.04)' : 'rgba(30, 95, 138, 0.04)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                    <img
                      src={getSexPngIcon(sx.sex)}
                      alt={sx.label}
                      style={{ width: 18, height: 18, objectFit: 'contain' }}
                    />
                    {sx.label}
                  </span>
                  <span style={{ fontWeight: 700, color: fillColor }}>
                    {sx.count} ({sx.sharePercent}%)
                  </span>
                </div>
                <div
                  style={{
                    height: 8,
                    borderRadius: 999,
                    background: 'var(--border)',
                    overflow: 'hidden',
                    margin: '10px 0 8px',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, sx.sharePercent)}%`,
                      background: fillColor,
                      borderRadius: 999,
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: 6 }}>
                  <span>{sx.activeCount} active in herd</span>
                  <span>
                    {isFemale
                      ? `${milkDisp.toFixed(1)} ${volumeShort} logged (${report.milkingEligibleCount} milking females)`
                      : 'Non-milking cohort'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Row 5: Species Matrix */}
      <div className="card">
        <div className="chart-header">
          <div>
            <h2 className="card-section-title" style={{ marginBottom: 0 }}>
              Species Performance
            </h2>
          </div>
          <img src={APP_ICONS.budget} alt="" className="app-icon-md" />
        </div>

        {report.speciesBreakdown.length === 0 ? (
          <div className="empty-state">No data yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Species</th>
                  <th>Headcount</th>
                  <th>Active</th>
                  <th>Herd Share</th>
                  <th>Milk Output</th>
                  <th>Medical Logs</th>
                  <th>Medical Spend</th>
                  <th>Linked Net P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {report.speciesBreakdown.map((row) => (
                  <tr key={row.species}>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                        <img
                          src={getSpeciesPngIcon(
                            row.species,
                            sexFilter === 'male' ? 'male' : 'female'
                          )}
                          alt=""
                          className="app-icon-sm"
                        />
                        {row.species === 'cow' && sexFilter === 'male'
                          ? 'Bull'
                          : row.species === 'cow' && sexFilter === 'all'
                            ? `Cattle (${report.cowsCount} Cow · ${report.bullsCount} Bull)`
                            : row.label}
                      </span>
                    </td>
                    <td>{row.totalCount}</td>
                    <td>{row.activeCount}</td>
                    <td>{row.sharePercent}%</td>
                    <td>
                      {convertLitersToDisplayVolume(row.milkLiters, volumeUnit).toFixed(1)}{' '}
                      {volumeShort}
                    </td>
                    <td>{row.medicalEventCount}</td>
                    <td>{formatCurrency(row.totalMedicalCost, currency)}</td>
                    <td
                      style={{
                        fontWeight: 600,
                        color: row.netAmount >= 0 ? 'var(--accent)' : 'var(--danger)',
                      }}
                    >
                      {formatCurrency(row.netAmount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
