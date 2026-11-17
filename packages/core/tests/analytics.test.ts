import { describe, expect, it } from 'vitest';
import {
  buildDailyYieldSeries,
  buildMonthlyProfitLossSeries,
  buildTopProducers,
  computeFinancialSummary,
  formatCurrency,
  validateNewFinancialLog,
  validateNewProductRecord,
  type FinancialLog,
  type Livestock,
  type ProductRecord,
} from '../src/index';

describe('@farmdb/core phase 3 validation & analytics', () => {
  it('validates milk yield entries and financial logs', () => {
    const validProd = validateNewProductRecord(
      {
        livestockId: 'cow-1',
        date: '2026-11-16',
        yieldAmount: 18.456,
        qualityNotes: '  Clean morning yield ',
      },
      { todayIso: '2026-11-17' }
    );
    expect(validProd.ok).toBe(true);
    expect(validProd.data?.yieldAmount).toBe(18.46);
    expect(validProd.data?.qualityNotes).toBe('Clean morning yield');

    const badProd = validateNewProductRecord(
      { livestockId: '', date: '2026-11-19', yieldAmount: 0 },
      { todayIso: '2026-11-17' }
    );
    expect(badProd.ok).toBe(false);
    expect(badProd.errors.livestockId).toBeDefined();
    expect(badProd.errors.date).toContain('future');
    expect(badProd.errors.yieldAmount).toBeDefined();

    const validFin = validateNewFinancialLog({
      transactionType: 'expense',
      category: 'feed',
      amount: 120.5,
      date: '2026-11-16',
      notes: 'Hay bales',
    });
    expect(validFin.ok).toBe(true);
    expect(validFin.data?.livestockId).toBeNull();
  });

  it('aggregates daily yield series, monthly P&L, financial summary, and top producers', () => {
    const records: ProductRecord[] = [
      {
        id: 'p1',
        livestockId: 'c1',
        date: '2026-11-15',
        yieldAmount: 15,
        qualityNotes: null,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'p2',
        livestockId: 'c2',
        date: '2026-11-15',
        yieldAmount: 10.5,
        qualityNotes: null,
        createdAt: 2,
        updatedAt: 2,
      },
      {
        id: 'p3',
        livestockId: 'c1',
        date: '2026-11-17',
        yieldAmount: 17,
        qualityNotes: null,
        createdAt: 3,
        updatedAt: 3,
      },
    ];

    const series = buildDailyYieldSeries(records, 3, '2026-11-17');
    expect(series).toEqual([
      { date: '2026-11-15', label: '11-15', totalLiters: 25.5, recordCount: 2 },
      { date: '2026-11-16', label: '11-16', totalLiters: 0, recordCount: 0 },
      { date: '2026-11-17', label: '11-17', totalLiters: 17, recordCount: 1 },
    ]);

    const logs: FinancialLog[] = [
      {
        id: 'f1',
        livestockId: 'c1',
        productRecordId: 'p1',
        transactionType: 'income',
        amount: 200,
        date: '2026-10-20',
        category: 'milk_sale',
        notes: null,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'f2',
        livestockId: null,
        productRecordId: null,
        transactionType: 'expense',
        amount: 80,
        date: '2026-10-25',
        category: 'feed',
        notes: null,
        createdAt: 2,
        updatedAt: 2,
      },
      {
        id: 'f3',
        livestockId: 'c1',
        productRecordId: null,
        transactionType: 'expense',
        amount: 50,
        date: '2026-11-05',
        category: 'meds',
        notes: null,
        createdAt: 3,
        updatedAt: 3,
      },
      {
        id: 'f4',
        livestockId: null,
        productRecordId: null,
        transactionType: 'income',
        amount: 300,
        date: '2026-11-12',
        category: 'milk_sale',
        notes: null,
        createdAt: 4,
        updatedAt: 4,
      },
    ];

    const monthly = buildMonthlyProfitLossSeries(logs, 6);
    expect(monthly).toEqual([
      {
        month: '2026-10',
        label: '2026-10',
        income: 200,
        expense: 80,
        netProfit: 120,
        marginPercent: 60,
      },
      {
        month: '2026-11',
        label: '2026-11',
        income: 300,
        expense: 50,
        netProfit: 250,
        marginPercent: 83.33,
      },
    ]);

    const summary = computeFinancialSummary(logs);
    expect(summary).toEqual({
      totalIncome: 500,
      totalExpense: 130,
      netProfit: 370,
      profitMarginPercent: 74,
      milkSaleIncome: 500,
      feedExpense: 80,
      medicalExpense: 50,
    });
    expect(formatCurrency(-370, '$')).toBe('-$370.00');

    const animals = new Map<string, Livestock>([
      [
        'c1',
        {
          id: 'c1',
          species: 'cow',
          tagNumber: 'COW-402',
          name: 'Bessie',
          breed: 'Holstein',
          dob: null,
          imageUri: null,
          status: 'active',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    ]);

    const top = buildTopProducers(records, animals);
    expect(top[0]).toEqual({
      livestockId: 'c1',
      tagNumber: 'COW-402',
      name: 'Bessie',
      totalLiters: 32,
      recordCount: 2,
      averageYield: 16,
      latestDate: '2026-11-17',
    });
  });
});
