import {
  formatSexLabel,
  isFemaleMilkProducingAnimal,
  LIVESTOCK_SEXES,
  LIVESTOCK_STATUSES,
  SPECIES_LIST,
  type AnimalOwnership,
  type FarmSettings,
  type FinancialCategory,
  type FinancialLog,
  type Livestock,
  type LivestockSex,
  type LivestockStatus,
  type MedicalRecord,
  type ProductRecord,
  type Species,
} from './types';
import { formatSpeciesLabel, formatStatusLabel } from './utils';

export interface DailyYieldPoint {
  date: string;
  label: string;
  totalLiters: number;
  recordCount: number;
}

export interface MonthlyProfitLossPoint {
  month: string;
  label: string;
  income: number;
  expense: number;
  netProfit: number;
  marginPercent: number;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  profitMarginPercent: number;
  milkSaleIncome: number;
  feedExpense: number;
  medicalExpense: number;
}

export interface AnimalProductionStat {
  livestockId: string;
  tagNumber: string;
  name: string | null;
  totalLiters: number;
  recordCount: number;
  averageYield: number;
  latestDate: string | null;
}

export interface SpeciesAnalyticsPoint {
  species: Species;
  label: string;
  totalCount: number;
  activeCount: number;
  soldCount: number;
  deceasedCount: number;
  milkLiters: number;
  milkRecordCount: number;
  medicalEventCount: number;
  totalMedicalCost: number;
  incomeAmount: number;
  expenseAmount: number;
  netAmount: number;
  sharePercent: number;
}

export interface AgeCohortPoint {
  cohort: string;
  label: string;
  count: number;
  sharePercent: number;
}

export interface ConditionStatPoint {
  condition: string;
  label: string;
  eventCount: number;
  totalCost: number;
  sharePercent: number;
}

export interface BreedStatPoint {
  breed: string;
  species: Species | 'mixed';
  count: number;
  sharePercent: number;
}

export interface LivestockStatusStatPoint {
  status: LivestockStatus;
  label: string;
  count: number;
  sharePercent: number;
}

export interface SexAnalyticsPoint {
  sex: LivestockSex;
  label: string;
  count: number;
  activeCount: number;
  sharePercent: number;
  milkLiters: number;
}

export interface LivestockStatisticsInput {
  livestock: readonly Livestock[];
  productRecords: readonly ProductRecord[];
  medicalRecords: readonly MedicalRecord[];
  financialLogs: readonly FinancialLog[];
  ownerships?: readonly AnimalOwnership[];
  speciesFilter?: Species | 'all';
  sexFilter?: LivestockSex | 'all';
  trendDays?: number;
  timeframe?: StatisticsTimeframe;
  todayIso?: string;
}

export type StatisticsTimeframe =
  | '7d'
  | '14d'
  | '30d'
  | 'weeks'
  | 'months'
  | 'years';

export type AnalyticsTimeBucket = 'day' | 'week' | 'month' | 'year';

export type RecordDateFilter = 'all' | '7d' | '30d' | '12w' | '12m' | 'year';

export type DateSortDirection = 'desc' | 'asc';

export type LivestockSortOption =
  | 'updated'
  | 'created_desc'
  | 'created_asc'
  | 'dob_desc'
  | 'dob_asc'
  | 'tag'
  | 'name';

export interface StatisticsTimeframeOption {
  value: StatisticsTimeframe;
  shortLabel: string;
  label: string;
  chartTitlePrefix: string;
  bucket: AnalyticsTimeBucket;
}

export const STATISTICS_TIMEFRAME_OPTIONS: readonly StatisticsTimeframeOption[] = [
  { value: '7d', shortLabel: '7D', label: 'Last 7 Days', chartTitlePrefix: '7-Day', bucket: 'day' },
  { value: '14d', shortLabel: '14D', label: 'Last 14 Days', chartTitlePrefix: '14-Day', bucket: 'day' },
  { value: '30d', shortLabel: '30D', label: 'Last 30 Days', chartTitlePrefix: '30-Day', bucket: 'day' },
  { value: 'weeks', shortLabel: 'Weeks', label: 'Last 12 Weeks', chartTitlePrefix: '12-Week', bucket: 'week' },
  { value: 'months', shortLabel: 'Months', label: 'Last 12 Months', chartTitlePrefix: '12-Month', bucket: 'month' },
  { value: 'years', shortLabel: 'Years', label: 'All Years', chartTitlePrefix: 'Yearly', bucket: 'year' },
] as const;

export const RECORD_DATE_FILTER_OPTIONS: readonly {
  value: RecordDateFilter;
  label: string;
  shortLabel: string;
}[] = [
  { value: 'all', label: 'All Dates', shortLabel: 'All' },
  { value: '7d', label: 'Last 7 Days', shortLabel: '7D' },
  { value: '30d', label: 'Last 30 Days', shortLabel: '30D' },
  { value: '12w', label: 'Last 12 Weeks', shortLabel: 'Weeks' },
  { value: '12m', label: 'Last 12 Months', shortLabel: 'Months' },
  { value: 'year', label: 'This Year', shortLabel: 'Year' },
] as const;

export const FINANCIAL_PERIOD_BUCKETS: readonly {
  value: 'week' | 'month' | 'year';
  label: string;
}[] = [
  { value: 'week', label: 'Weeks' },
  { value: 'month', label: 'Months' },
  { value: 'year', label: 'Years' },
] as const;

export interface LivestockStatisticsReport {
  timeframe: StatisticsTimeframe;
  timeframeLabel: string;
  chartTitlePrefix: string;
  bucketUnit: AnalyticsTimeBucket;
  totalAnimals: number;
  activeAnimals: number;
  soldAnimals: number;
  deceasedAnimals: number;
  activeSharePercent: number;
  femaleCount: number;
  maleCount: number;
  femaleSharePercent: number;
  maleSharePercent: number;
  cowsCount: number;
  bullsCount: number;
  milkingEligibleCount: number;
  totalMilkLiters: number;
  avgMilkPerRecord: number;
  avgMilkPerAnimal: number;
  avgMilkPerMilkingFemale: number;
  totalMedicalEvents: number;
  totalMedicalCost: number;
  treatedAnimalsCount: number;
  vaccinatedAnimalsCount: number;
  vaccinationCoveragePercent: number;
  averageAgeMonths: number | null;
  knownAgeAnimals: number;
  externalOwnedAnimals: number;
  lineageLinkedAnimals: number;
  speciesBreakdown: SpeciesAnalyticsPoint[];
  sexBreakdown: SexAnalyticsPoint[];
  statusBreakdown: LivestockStatusStatPoint[];
  ageCohorts: AgeCohortPoint[];
  topBreeds: BreedStatPoint[];
  topConditions: ConditionStatPoint[];
  financialSummary: FinancialSummary;
  monthlyFinancialSeries: MonthlyProfitLossPoint[];
  topProducers: AnimalProductionStat[];
  dailyMilkSeries: DailyYieldPoint[];
}

export const DEFAULT_FARM_SETTINGS: FarmSettings = {
  farmName: 'farmDB Homestead',
  defaultMilkRatePerLiter: 0.65,
  currencySymbol: '$',
  fontScale: 'medium',
  uiDensity: 'comfortable',
  dateFormat: 'iso',
  volumeUnit: 'liters',
  defaultSpecies: 'cow',
  autoRecordMilkSaleByDefault: true,
  autoRecordMedicalExpenseByDefault: true,
  autoRecordPayrollExpenseByDefault: true,
  paymentAlertLeadDays: 3,
  alertCheckIntervalSeconds: 60,
  enableNotifications: true,
  confirmBeforeDelete: true,
  mobileIconMode: true,
  activeAccountId: 'owner-admin',
  cloudSyncEnabled: false,
  supabaseUrl: '',
  supabaseAnonKey: '',
  cloudWorkspaceId: 'farmdb-homestead-main',
  autoSyncOnInternet: true,
  cloudSyncIntervalSeconds: 120,
  syncConflictStrategy: 'last_write_wins',
  syncIncludeFinancials: true,
  syncIncludeHr: true,
  networkJoinKey: 'FARM-7842',
};

export function roundAmount(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(amount: number, currencySymbol = '$'): string {
  const sym = (currencySymbol || '$').trim() || '$';
  const sign = amount < 0 ? '-' : '';
  const rounded = Math.abs(roundAmount(amount));
  const isCodePrefix = /^[A-Za-z]{2,}$/.test(sym);
  if (isCodePrefix) {
    const hasFraction = Math.abs(rounded - Math.round(rounded)) > 0.001;
    const formatted = rounded.toLocaleString('en-US', {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: hasFraction ? 2 : 0,
    });
    return `${sign}${sym} ${formatted}`;
  }
  const abs = rounded.toFixed(2);
  return `${sign}${sym}${abs}`;
}

export function formatCategoryLabel(category: FinancialCategory | string): string {
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getTodayIsoDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysIso(isoDate: string, deltaDays: number): string {
  const [yStr, mStr, dStr] = isoDate.split('-');
  const dt = new Date(Date.UTC(Number(yStr), Number(mStr) - 1, Number(dStr)));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

function shortDateLabel(isoDate: string): string {
  return isoDate.slice(5);
}

const SHORT_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * Returns the Monday (`YYYY-MM-DD`) of the week containing `isoDate`.
 */
export function getIsoWeekStart(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) {
    return isoDate;
  }
  const dt = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
  const utcDay = dt.getUTCDay() || 7; // Sunday = 7
  dt.setUTCDate(dt.getUTCDate() - (utcDay - 1));
  return dt.toISOString().slice(0, 10);
}

function shiftCalendarMonth(monthKey: string, deltaMonths: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!match) {
    return monthKey;
  }
  const dt = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1 + deltaMonths, 1)
  );
  return dt.toISOString().slice(0, 7);
}

function formatMonthBucketLabel(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) {
    return monthKey;
  }
  const year = match[1]!;
  const monthIdx = Number(match[2]) - 1;
  const name = SHORT_MONTH_NAMES[monthIdx] ?? monthKey;
  return monthIdx === 0 ? `${name} '${year.slice(2)}` : name;
}

export function getTimeframeMeta(
  timeframe: StatisticsTimeframe
): StatisticsTimeframeOption {
  return (
    STATISTICS_TIMEFRAME_OPTIONS.find((opt) => opt.value === timeframe) ??
    STATISTICS_TIMEFRAME_OPTIONS[1]!
  );
}

/**
 * Resolves the inclusive start ISO date for a timeframe (`null` means unbounded / all years).
 */
export function getTimeframeStartDateIso(
  timeframe: StatisticsTimeframe | RecordDateFilter,
  anchorIso: string
): string | null {
  if (timeframe === 'all' || timeframe === 'years') {
    return null;
  }
  if (timeframe === '7d') {
    return addDaysIso(anchorIso, -6);
  }
  if (timeframe === '14d') {
    return addDaysIso(anchorIso, -13);
  }
  if (timeframe === '30d') {
    return addDaysIso(anchorIso, -29);
  }
  if (timeframe === 'weeks' || timeframe === '12w') {
    return addDaysIso(getIsoWeekStart(anchorIso), -7 * 11);
  }
  if (timeframe === 'months' || timeframe === '12m') {
    const startMonth = shiftCalendarMonth(anchorIso.slice(0, 7), -11);
    return `${startMonth}-01`;
  }
  if (timeframe === 'year') {
    return `${anchorIso.slice(0, 4)}-01-01`;
  }
  return null;
}

/**
 * Filters date-stamped records against a timeframe/date-filter and optionally sorts by date.
 */
export function filterAndSortRecordsByDate<
  T extends { date: string; createdAt?: number }
>(
  items: readonly T[],
  options?: {
    filter?: RecordDateFilter | StatisticsTimeframe;
    sort?: DateSortDirection;
    todayIso?: string;
  }
): T[] {
  const filter = options?.filter ?? 'all';
  const sort = options?.sort ?? 'desc';
  const anchor = options?.todayIso ?? getTodayIsoDate();
  const startIso = getTimeframeStartDateIso(filter, anchor);

  const filtered = startIso
    ? items.filter((item) => item.date >= startIso)
    : [...items];

  filtered.sort((a, b) => {
    const cmp = a.date.localeCompare(b.date);
    if (cmp !== 0) {
      return sort === 'asc' ? cmp : -cmp;
    }
    const createdA = a.createdAt ?? 0;
    const createdB = b.createdAt ?? 0;
    return sort === 'asc' ? createdA - createdB : createdB - createdA;
  });

  return filtered;
}

/**
 * Sorts livestock by updated timestamp, created date (newest/oldest), birth date (age), tag, or name.
 */
export function sortLivestockItems(
  animals: readonly Livestock[],
  sortBy: LivestockSortOption
): Livestock[] {
  const list = [...animals];
  if (sortBy === 'updated') {
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    return list;
  }
  if (sortBy === 'created_desc') {
    list.sort((a, b) => b.createdAt - a.createdAt);
    return list;
  }
  if (sortBy === 'created_asc') {
    list.sort((a, b) => a.createdAt - b.createdAt);
    return list;
  }
  if (sortBy === 'dob_desc') {
    // Youngest (newest DOB) first; unknown DOBs last
    list.sort((a, b) => {
      if (!a.dob && !b.dob) return a.tagNumber.localeCompare(b.tagNumber);
      if (!a.dob) return 1;
      if (!b.dob) return -1;
      return b.dob.localeCompare(a.dob) || a.tagNumber.localeCompare(b.tagNumber);
    });
    return list;
  }
  if (sortBy === 'dob_asc') {
    // Oldest (earliest DOB) first; unknown DOBs last
    list.sort((a, b) => {
      if (!a.dob && !b.dob) return a.tagNumber.localeCompare(b.tagNumber);
      if (!a.dob) return 1;
      if (!b.dob) return -1;
      return a.dob.localeCompare(b.dob) || a.tagNumber.localeCompare(b.tagNumber);
    });
    return list;
  }
  if (sortBy === 'tag') {
    list.sort((a, b) => a.tagNumber.localeCompare(b.tagNumber));
    return list;
  }
  if (sortBy === 'name') {
    list.sort((a, b) =>
      (a.name ?? a.tagNumber).localeCompare(b.name ?? b.tagNumber)
    );
    return list;
  }
  return list;
}

/**
 * Builds a contiguous daily milk yield series across the trailing `days` window
 * ending on `endDateIso` (defaults to today or the latest record date if newer).
 */
export function buildDailyYieldSeries(
  records: readonly ProductRecord[],
  days = 14,
  endDateIso?: string
): DailyYieldPoint[] {
  if (days <= 0) {
    return [];
  }

  let anchor = endDateIso ?? getTodayIsoDate();
  if (!endDateIso && records.length > 0) {
    for (const r of records) {
      if (r.date > anchor) {
        anchor = r.date;
      }
    }
  }

  const buckets = new Map<string, { totalLiters: number; recordCount: number }>();
  const startDate = addDaysIso(anchor, -(days - 1));

  for (let i = 0; i < days; i += 1) {
    const dateKey = addDaysIso(startDate, i);
    buckets.set(dateKey, { totalLiters: 0, recordCount: 0 });
  }

  for (const record of records) {
    const existing = buckets.get(record.date);
    if (existing) {
      existing.totalLiters = roundAmount(existing.totalLiters + record.yieldAmount);
      existing.recordCount += 1;
    }
  }

  return Array.from(buckets.entries()).map(([date, stats]) => ({
    date,
    label: shortDateLabel(date),
    totalLiters: stats.totalLiters,
    recordCount: stats.recordCount,
  }));
}

/**
 * Aggregates financial logs by calendar month (`YYYY-MM`) chronologically,
 * returning up to the most recent `maxMonths` active periods.
 */
export function buildMonthlyProfitLossSeries(
  logs: readonly FinancialLog[],
  maxMonths = 6
): MonthlyProfitLossPoint[] {
  const byMonth = new Map<string, { income: number; expense: number }>();

  for (const log of logs) {
    const month = log.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const entry = byMonth.get(month) ?? { income: 0, expense: 0 };
    if (log.transactionType === 'income') {
      entry.income = roundAmount(entry.income + log.amount);
    } else {
      entry.expense = roundAmount(entry.expense + log.amount);
    }
    byMonth.set(month, entry);
  }

  const sortedMonths = Array.from(byMonth.keys()).sort();
  const sliced =
    maxMonths > 0 && sortedMonths.length > maxMonths
      ? sortedMonths.slice(sortedMonths.length - maxMonths)
      : sortedMonths;

  return sliced.map((month) => {
    const entry = byMonth.get(month) ?? { income: 0, expense: 0 };
    const netProfit = roundAmount(entry.income - entry.expense);
    const marginPercent =
      entry.income > 0 ? roundAmount((netProfit / entry.income) * 100) : 0;

    return {
      month,
      label: month,
      income: entry.income,
      expense: entry.expense,
      netProfit,
      marginPercent,
    };
  });
}

/**
 * Builds yield series points aggregated by day, week (`12W`), month (`12M`), or year.
 */
export function buildYieldSeriesForTimeframe(
  records: readonly ProductRecord[],
  timeframe: StatisticsTimeframe = '14d',
  endDateIso?: string
): DailyYieldPoint[] {
  if (timeframe === '7d') {
    return buildDailyYieldSeries(records, 7, endDateIso);
  }
  if (timeframe === '14d') {
    return buildDailyYieldSeries(records, 14, endDateIso);
  }
  if (timeframe === '30d') {
    return buildDailyYieldSeries(records, 30, endDateIso);
  }

  let anchor = endDateIso ?? getTodayIsoDate();
  if (!endDateIso) {
    for (const r of records) {
      if (r.date > anchor) {
        anchor = r.date;
      }
    }
  }

  if (timeframe === 'weeks') {
    const currentWeekStart = getIsoWeekStart(anchor);
    const buckets = new Map<string, { totalLiters: number; recordCount: number }>();
    for (let i = 11; i >= 0; i -= 1) {
      const weekKey = addDaysIso(currentWeekStart, -(i * 7));
      buckets.set(weekKey, { totalLiters: 0, recordCount: 0 });
    }
    for (const rec of records) {
      const weekKey = getIsoWeekStart(rec.date);
      const bucket = buckets.get(weekKey);
      if (bucket) {
        bucket.totalLiters = roundAmount(bucket.totalLiters + rec.yieldAmount);
        bucket.recordCount += 1;
      }
    }
    return Array.from(buckets.entries()).map(([weekStart, stats]) => ({
      date: weekStart,
      label: shortDateLabel(weekStart),
      totalLiters: stats.totalLiters,
      recordCount: stats.recordCount,
    }));
  }

  if (timeframe === 'months') {
    const anchorMonth = anchor.slice(0, 7);
    const buckets = new Map<string, { totalLiters: number; recordCount: number }>();
    for (let i = 11; i >= 0; i -= 1) {
      const monthKey = shiftCalendarMonth(anchorMonth, -i);
      buckets.set(monthKey, { totalLiters: 0, recordCount: 0 });
    }
    for (const rec of records) {
      const monthKey = rec.date.slice(0, 7);
      const bucket = buckets.get(monthKey);
      if (bucket) {
        bucket.totalLiters = roundAmount(bucket.totalLiters + rec.yieldAmount);
        bucket.recordCount += 1;
      }
    }
    return Array.from(buckets.entries()).map(([monthKey, stats]) => ({
      date: `${monthKey}-01`,
      label: formatMonthBucketLabel(monthKey),
      totalLiters: stats.totalLiters,
      recordCount: stats.recordCount,
    }));
  }

  // 'years' -> aggregate across every calendar year present (minimum 3-year span up to anchorYear)
  const anchorYear = Number(anchor.slice(0, 4)) || new Date().getUTCFullYear();
  let minYear = anchorYear - 2;
  let maxYear = anchorYear;
  const yearlySums = new Map<number, { totalLiters: number; recordCount: number }>();

  for (const rec of records) {
    const yr = Number(rec.date.slice(0, 4));
    if (!Number.isFinite(yr) || yr < 1970 || yr > 2200) continue;
    if (yr < minYear) minYear = yr;
    if (yr > maxYear) maxYear = yr;
    const entry = yearlySums.get(yr) ?? { totalLiters: 0, recordCount: 0 };
    entry.totalLiters = roundAmount(entry.totalLiters + rec.yieldAmount);
    entry.recordCount += 1;
    yearlySums.set(yr, entry);
  }

  const points: DailyYieldPoint[] = [];
  for (let yr = minYear; yr <= maxYear; yr += 1) {
    const entry = yearlySums.get(yr) ?? { totalLiters: 0, recordCount: 0 };
    points.push({
      date: `${yr}-01-01`,
      label: String(yr),
      totalLiters: entry.totalLiters,
      recordCount: entry.recordCount,
    });
  }
  return points;
}

/**
 * Aggregates financial income vs expenses by week, month, or year.
 */
export function buildPeriodProfitLossSeries(
  logs: readonly FinancialLog[],
  bucket: 'week' | 'month' | 'year' = 'month',
  maxPeriods = 12
): MonthlyProfitLossPoint[] {
  const map = new Map<string, { income: number; expense: number }>();

  for (const log of logs) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(log.date)) continue;
    const key =
      bucket === 'year'
        ? log.date.slice(0, 4)
        : bucket === 'week'
          ? getIsoWeekStart(log.date)
          : log.date.slice(0, 7);

    const entry = map.get(key) ?? { income: 0, expense: 0 };
    if (log.transactionType === 'income') {
      entry.income = roundAmount(entry.income + log.amount);
    } else {
      entry.expense = roundAmount(entry.expense + log.amount);
    }
    map.set(key, entry);
  }

  const sortedKeys = Array.from(map.keys()).sort();
  const sliced =
    maxPeriods > 0 && sortedKeys.length > maxPeriods
      ? sortedKeys.slice(sortedKeys.length - maxPeriods)
      : sortedKeys;

  return sliced.map((key) => {
    const entry = map.get(key) ?? { income: 0, expense: 0 };
    const netProfit = roundAmount(entry.income - entry.expense);
    const marginPercent =
      entry.income > 0 ? roundAmount((netProfit / entry.income) * 100) : 0;
    const label =
      bucket === 'year'
        ? key
        : bucket === 'week'
          ? shortDateLabel(key)
          : formatMonthBucketLabel(key);

    return {
      month: key,
      label,
      income: entry.income,
      expense: entry.expense,
      netProfit,
      marginPercent,
    };
  });
}

export function computeFinancialSummary(
  logs: readonly FinancialLog[]
): FinancialSummary {
  let totalIncome = 0;
  let totalExpense = 0;
  let milkSaleIncome = 0;
  let feedExpense = 0;
  let medicalExpense = 0;

  for (const log of logs) {
    if (log.transactionType === 'income') {
      totalIncome += log.amount;
      if (log.category === 'milk_sale') {
        milkSaleIncome += log.amount;
      }
    } else {
      totalExpense += log.amount;
      if (log.category === 'feed') {
        feedExpense += log.amount;
      } else if (log.category === 'meds' || log.category === 'veterinary') {
        medicalExpense += log.amount;
      }
    }
  }

  const roundedIncome = roundAmount(totalIncome);
  const roundedExpense = roundAmount(totalExpense);
  const netProfit = roundAmount(roundedIncome - roundedExpense);
  const profitMarginPercent =
    roundedIncome > 0 ? roundAmount((netProfit / roundedIncome) * 100) : 0;

  return {
    totalIncome: roundedIncome,
    totalExpense: roundedExpense,
    netProfit,
    profitMarginPercent,
    milkSaleIncome: roundAmount(milkSaleIncome),
    feedExpense: roundAmount(feedExpense),
    medicalExpense: roundAmount(medicalExpense),
  };
}

export function buildTopProducers(
  records: readonly ProductRecord[],
  animalsById: ReadonlyMap<string, Livestock>
): AnimalProductionStat[] {
  const byAnimal = new Map<
    string,
    { totalLiters: number; recordCount: number; latestDate: string | null }
  >();

  for (const rec of records) {
    const knownAnimal = animalsById.get(rec.livestockId);
    if (knownAnimal && !isFemaleMilkProducingAnimal(knownAnimal)) {
      continue;
    }
    const current = byAnimal.get(rec.livestockId) ?? {
      totalLiters: 0,
      recordCount: 0,
      latestDate: null,
    };
    current.totalLiters = roundAmount(current.totalLiters + rec.yieldAmount);
    current.recordCount += 1;
    if (!current.latestDate || rec.date > current.latestDate) {
      current.latestDate = rec.date;
    }
    byAnimal.set(rec.livestockId, current);
  }

  const stats: AnimalProductionStat[] = [];
  for (const [livestockId, agg] of byAnimal.entries()) {
    const animal = animalsById.get(livestockId);
    if (animal && !isFemaleMilkProducingAnimal(animal)) {
      continue;
    }
    stats.push({
      livestockId,
      tagNumber: animal?.tagNumber ?? 'UNKNOWN',
      name: animal?.name ?? null,
      totalLiters: agg.totalLiters,
      recordCount: agg.recordCount,
      averageYield: roundAmount(agg.totalLiters / agg.recordCount),
      latestDate: agg.latestDate,
    });
  }

  stats.sort((a, b) => b.totalLiters - a.totalLiters);
  return stats;
}

function computeAgeInMonths(
  dob: string | null | undefined,
  todayIso: string
): number | null {
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob.trim())) {
    return null;
  }
  const refMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayIso.trim());
  const dobMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob.trim());
  if (!refMatch || !dobMatch) {
    return null;
  }
  const birthYear = Number(dobMatch[1]);
  const birthMonth = Number(dobMatch[2]);
  const birthDay = Number(dobMatch[3]);
  const refYear = Number(refMatch[1]);
  const refMonth = Number(refMatch[2]);
  const refDay = Number(refMatch[3]);

  let totalMonths = (refYear - birthYear) * 12 + (refMonth - birthMonth);
  if (refDay < birthDay) {
    totalMonths -= 1;
  }
  return totalMonths >= 0 ? totalMonths : null;
}

function sharePercent(part: number, total: number): number {
  if (total <= 0 || part <= 0) {
    return 0;
  }
  return roundAmount((part / total) * 100);
}

/**
 * Computes comprehensive herd, milk yield, health, breed, age, and financial analytics.
 */
export function computeLivestockStatistics(
  input: LivestockStatisticsInput
): LivestockStatisticsReport {
  const speciesFilter = input.speciesFilter ?? 'all';
  const sexFilter = input.sexFilter ?? 'all';
  const hasSubsetFilter = speciesFilter !== 'all' || sexFilter !== 'all';
  const todayIso = input.todayIso ?? getTodayIsoDate();
  const explicitTimeframe = input.timeframe;
  const effectiveTimeframe: StatisticsTimeframe =
    explicitTimeframe ??
    (input.trendDays === 7 ? '7d' : input.trendDays === 30 ? '30d' : '14d');
  const timeframeMeta = getTimeframeMeta(effectiveTimeframe);
  const trendDays = Math.max(3, Math.min(90, Math.round(input.trendDays ?? 14)));
  const windowStartIso = explicitTimeframe
    ? getTimeframeStartDateIso(explicitTimeframe, todayIso)
    : null;

  const animals = input.livestock.filter((animal) => {
    if (speciesFilter !== 'all' && animal.species !== speciesFilter) {
      return false;
    }
    const animalSex: LivestockSex = animal.sex === 'male' ? 'male' : 'female';
    if (sexFilter !== 'all' && animalSex !== sexFilter) {
      return false;
    }
    return true;
  });

  const animalsById = new Map<string, Livestock>();
  for (const animal of animals) {
    animalsById.set(animal.id, animal);
  }

  const productRecords = input.productRecords.filter((rec) => {
    if (hasSubsetFilter && !animalsById.has(rec.livestockId)) {
      return false;
    }
    if (windowStartIso && rec.date < windowStartIso) {
      return false;
    }
    return true;
  });

  const medicalRecords = input.medicalRecords.filter((rec) => {
    if (hasSubsetFilter && !animalsById.has(rec.livestockId)) {
      return false;
    }
    if (windowStartIso && rec.date < windowStartIso) {
      return false;
    }
    return true;
  });

  const financialLogs = input.financialLogs.filter((log) => {
    if (
      hasSubsetFilter &&
      (log.livestockId === null || !animalsById.has(log.livestockId))
    ) {
      return false;
    }
    if (windowStartIso && log.date < windowStartIso) {
      return false;
    }
    return true;
  });

  let activeAnimals = 0;
  let soldAnimals = 0;
  let deceasedAnimals = 0;
  let femaleCount = 0;
  let maleCount = 0;
  let cowsCount = 0;
  let bullsCount = 0;
  let milkingEligibleCount = 0;
  let lineageLinkedAnimals = 0;
  let totalAgeMonths = 0;
  let knownAgeAnimals = 0;

  const sexMap = new Map<LivestockSex, SexAnalyticsPoint>();
  for (const sx of LIVESTOCK_SEXES) {
    sexMap.set(sx, {
      sex: sx,
      label: formatSexLabel(sx),
      count: 0,
      activeCount: 0,
      sharePercent: 0,
      milkLiters: 0,
    });
  }

  const cohortCounts = {
    calf_kid: 0,
    juvenile: 0,
    young_adult: 0,
    mature: 0,
    senior: 0,
    unknown: 0,
  };

  const breedMap = new Map<
    string,
    { label: string; count: number; speciesSet: Set<Species> }
  >();

  const speciesMap = new Map<Species, SpeciesAnalyticsPoint>();
  for (const sp of SPECIES_LIST) {
    speciesMap.set(sp, {
      species: sp,
      label: formatSpeciesLabel(sp),
      totalCount: 0,
      activeCount: 0,
      soldCount: 0,
      deceasedCount: 0,
      milkLiters: 0,
      milkRecordCount: 0,
      medicalEventCount: 0,
      totalMedicalCost: 0,
      incomeAmount: 0,
      expenseAmount: 0,
      netAmount: 0,
      sharePercent: 0,
    });
  }

  for (const animal of animals) {
    const spBucket = speciesMap.get(animal.species);
    if (spBucket) {
      spBucket.totalCount += 1;
      if (animal.status === 'active') spBucket.activeCount += 1;
      else if (animal.status === 'sold') spBucket.soldCount += 1;
      else if (animal.status === 'deceased') spBucket.deceasedCount += 1;
    }

    if (animal.status === 'active') activeAnimals += 1;
    else if (animal.status === 'sold') soldAnimals += 1;
    else if (animal.status === 'deceased') deceasedAnimals += 1;

    const animalSex: LivestockSex = animal.sex === 'male' ? 'male' : 'female';
    if (animalSex === 'male') {
      maleCount += 1;
    } else {
      femaleCount += 1;
    }
    if (animal.species === 'cow') {
      if (animalSex === 'male') bullsCount += 1;
      else cowsCount += 1;
    }
    if (animal.status === 'active' && isFemaleMilkProducingAnimal(animal)) {
      milkingEligibleCount += 1;
    }
    const sxBucket = sexMap.get(animalSex);
    if (sxBucket) {
      sxBucket.count += 1;
      if (animal.status === 'active') sxBucket.activeCount += 1;
    }

    if (animal.sireId || animal.damId) {
      lineageLinkedAnimals += 1;
    }

    const ageMonths = computeAgeInMonths(animal.dob, todayIso);
    if (ageMonths === null) {
      cohortCounts.unknown += 1;
    } else {
      knownAgeAnimals += 1;
      totalAgeMonths += ageMonths;
      if (ageMonths < 6) cohortCounts.calf_kid += 1;
      else if (ageMonths < 12) cohortCounts.juvenile += 1;
      else if (ageMonths < 36) cohortCounts.young_adult += 1;
      else if (ageMonths < 72) cohortCounts.mature += 1;
      else cohortCounts.senior += 1;
    }

    const breedRaw = animal.breed?.trim() || 'Mixed / Unspecified';
    const breedKey = breedRaw.toLowerCase();
    const existingBreed = breedMap.get(breedKey) ?? {
      label: breedRaw,
      count: 0,
      speciesSet: new Set<Species>(),
    };
    existingBreed.count += 1;
    existingBreed.speciesSet.add(animal.species);
    breedMap.set(breedKey, existingBreed);
  }

  let totalMilkLiters = 0;
  for (const rec of productRecords) {
    totalMilkLiters = roundAmount(totalMilkLiters + rec.yieldAmount);
    const animal = animalsById.get(rec.livestockId);
    if (animal) {
      const spBucket = speciesMap.get(animal.species);
      if (spBucket) {
        spBucket.milkLiters = roundAmount(spBucket.milkLiters + rec.yieldAmount);
        spBucket.milkRecordCount += 1;
      }
      const animalSex: LivestockSex = animal.sex === 'male' ? 'male' : 'female';
      const sxBucket = sexMap.get(animalSex);
      if (sxBucket) {
        sxBucket.milkLiters = roundAmount(sxBucket.milkLiters + rec.yieldAmount);
      }
    }
  }

  let totalMedicalCost = 0;
  const treatedIds = new Set<string>();
  const vaccinatedIds = new Set<string>();
  const conditionMap = new Map<
    string,
    { label: string; eventCount: number; totalCost: number }
  >();

  for (const med of medicalRecords) {
    totalMedicalCost = roundAmount(totalMedicalCost + (med.cost || 0));
    if (animalsById.has(med.livestockId)) {
      treatedIds.add(med.livestockId);
      if (/vaccin|immuniz|booster|deworm|shot/i.test(`${med.condition} ${med.treatment}`)) {
        vaccinatedIds.add(med.livestockId);
      }
    }
    const animal = animalsById.get(med.livestockId);
    if (animal) {
      const spBucket = speciesMap.get(animal.species);
      if (spBucket) {
        spBucket.medicalEventCount += 1;
        spBucket.totalMedicalCost = roundAmount(spBucket.totalMedicalCost + (med.cost || 0));
      }
    }

    const condLabel = med.condition.trim() || 'General Care';
    const condKey = condLabel.toLowerCase();
    const condEntry = conditionMap.get(condKey) ?? {
      label: condLabel,
      eventCount: 0,
      totalCost: 0,
    };
    condEntry.eventCount += 1;
    condEntry.totalCost = roundAmount(condEntry.totalCost + (med.cost || 0));
    conditionMap.set(condKey, condEntry);
  }

  for (const log of financialLogs) {
    if (!log.livestockId) continue;
    const animal = animalsById.get(log.livestockId);
    if (!animal) continue;
    const spBucket = speciesMap.get(animal.species);
    if (!spBucket) continue;
    if (log.transactionType === 'income') {
      spBucket.incomeAmount = roundAmount(spBucket.incomeAmount + log.amount);
    } else {
      spBucket.expenseAmount = roundAmount(spBucket.expenseAmount + log.amount);
    }
  }

  const externalAnimalIds = new Set<string>();
  if (input.ownerships) {
    for (const own of input.ownerships) {
      if (
        own.status === 'active' &&
        own.ownershipCategory !== 'farm_owned' &&
        animalsById.has(own.livestockId)
      ) {
        externalAnimalIds.add(own.livestockId);
      }
    }
  }

  const totalAnimals = animals.length;
  const sexBreakdown: SexAnalyticsPoint[] = LIVESTOCK_SEXES.map((sx) => {
    const bucket = sexMap.get(sx)!;
    return {
      ...bucket,
      sharePercent: sharePercent(bucket.count, totalAnimals),
    };
  });
  const speciesBreakdown: SpeciesAnalyticsPoint[] = [];
  for (const spBucket of speciesMap.values()) {
    spBucket.netAmount = roundAmount(spBucket.incomeAmount - spBucket.expenseAmount);
    spBucket.sharePercent = sharePercent(spBucket.totalCount, totalAnimals);
    if (
      spBucket.totalCount > 0 ||
      spBucket.milkLiters > 0 ||
      spBucket.medicalEventCount > 0 ||
      spBucket.incomeAmount > 0 ||
      spBucket.expenseAmount > 0
    ) {
      speciesBreakdown.push(spBucket);
    }
  }
  speciesBreakdown.sort(
    (a, b) => b.totalCount - a.totalCount || b.milkLiters - a.milkLiters
  );

  const statusBreakdown: LivestockStatusStatPoint[] = LIVESTOCK_STATUSES.map(
    (status) => {
      const count =
        status === 'active'
          ? activeAnimals
          : status === 'sold'
            ? soldAnimals
            : deceasedAnimals;
      return {
        status,
        label: formatStatusLabel(status),
        count,
        sharePercent: sharePercent(count, totalAnimals),
      };
    }
  );

  const ageCohorts: AgeCohortPoint[] = (
    [
      ['calf_kid', '< 6 mos'],
      ['juvenile', '6–12 mos'],
      ['young_adult', '1–3 yrs'],
      ['mature', '3–6 yrs'],
      ['senior', '6+ yrs'],
      ['unknown', 'Unknown'],
    ] as const
  ).map(([cohort, label]) => ({
    cohort,
    label,
    count: cohortCounts[cohort] ?? 0,
    sharePercent: sharePercent(cohortCounts[cohort] ?? 0, totalAnimals),
  }));

  const topBreeds: BreedStatPoint[] = Array.from(breedMap.values())
    .map((entry): BreedStatPoint => {
      const species: Species | 'mixed' =
        entry.speciesSet.size === 1
          ? (Array.from(entry.speciesSet)[0] ?? 'mixed')
          : 'mixed';
      return {
        breed: entry.label,
        species,
        count: entry.count,
        sharePercent: sharePercent(entry.count, totalAnimals),
      };
    })
    .sort((a, b) => b.count - a.count || a.breed.localeCompare(b.breed))
    .slice(0, 8);

  const totalMedicalEvents = medicalRecords.length;
  const topConditions: ConditionStatPoint[] = Array.from(conditionMap.entries())
    .map(([condition, entry]) => ({
      condition,
      label: entry.label,
      eventCount: entry.eventCount,
      totalCost: entry.totalCost,
      sharePercent: sharePercent(entry.eventCount, totalMedicalEvents),
    }))
    .sort((a, b) => b.eventCount - a.eventCount || b.totalCost - a.totalCost)
    .slice(0, 8);

  const topProducers = buildTopProducers(productRecords, animalsById);
  const dailyMilkSeries = explicitTimeframe
    ? buildYieldSeriesForTimeframe(productRecords, explicitTimeframe, todayIso)
    : buildDailyYieldSeries(productRecords, trendDays, todayIso);
  const financialSummary = computeFinancialSummary(financialLogs);
  const monthlyFinancialSeries = explicitTimeframe
    ? buildPeriodProfitLossSeries(
        financialLogs,
        effectiveTimeframe === 'years'
          ? 'year'
          : effectiveTimeframe === 'weeks'
            ? 'week'
            : 'month',
        effectiveTimeframe === 'months' ? 12 : 12
      )
    : buildMonthlyProfitLossSeries(financialLogs, 6);

  return {
    timeframe: effectiveTimeframe,
    timeframeLabel: timeframeMeta.label,
    chartTitlePrefix: timeframeMeta.chartTitlePrefix,
    bucketUnit: timeframeMeta.bucket,
    totalAnimals,
    activeAnimals,
    soldAnimals,
    deceasedAnimals,
    activeSharePercent: sharePercent(activeAnimals, totalAnimals),
    femaleCount,
    maleCount,
    femaleSharePercent: sharePercent(femaleCount, totalAnimals),
    maleSharePercent: sharePercent(maleCount, totalAnimals),
    cowsCount,
    bullsCount,
    milkingEligibleCount,
    totalMilkLiters,
    avgMilkPerRecord:
      productRecords.length > 0
        ? roundAmount(totalMilkLiters / productRecords.length)
        : 0,
    avgMilkPerAnimal:
      topProducers.length > 0 ? roundAmount(totalMilkLiters / topProducers.length) : 0,
    avgMilkPerMilkingFemale:
      milkingEligibleCount > 0 ? roundAmount(totalMilkLiters / milkingEligibleCount) : 0,
    totalMedicalEvents,
    totalMedicalCost,
    treatedAnimalsCount: treatedIds.size,
    vaccinatedAnimalsCount: vaccinatedIds.size,
    vaccinationCoveragePercent: sharePercent(vaccinatedIds.size, totalAnimals),
    averageAgeMonths:
      knownAgeAnimals > 0 ? roundAmount(totalAgeMonths / knownAgeAnimals) : null,
    knownAgeAnimals,
    externalOwnedAnimals: externalAnimalIds.size,
    lineageLinkedAnimals,
    speciesBreakdown,
    sexBreakdown,
    statusBreakdown,
    ageCohorts,
    topBreeds,
    topConditions,
    financialSummary,
    monthlyFinancialSeries,
    topProducers,
    dailyMilkSeries,
  };
}
