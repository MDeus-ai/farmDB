import type {
  FinancialCategory,
  FinancialLog,
  Livestock,
  ProductRecord,
} from './types';

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

export const DEFAULT_FARM_SETTINGS = {
  defaultMilkRatePerLiter: 0.65,
  currencySymbol: '$',
} as const;

export function roundAmount(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(amount: number, currencySymbol = '$'): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(roundAmount(amount)).toFixed(2);
  return `${sign}${currencySymbol}${abs}`;
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

function addDaysIso(isoDate: string, deltaDays: number): string {
  const [yStr, mStr, dStr] = isoDate.split('-');
  const dt = new Date(Date.UTC(Number(yStr), Number(mStr) - 1, Number(dStr)));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

function shortDateLabel(isoDate: string): string {
  return isoDate.slice(5);
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
