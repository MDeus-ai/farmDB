import { describe, expect, it } from 'vitest';
import {
  buildDailyYieldSeries,
  buildMonthlyProfitLossSeries,
  buildPeriodProfitLossSeries,
  buildTopProducers,
  buildYieldSeriesForTimeframe,
  computeFinancialSummary,
  computeLivestockStatistics,
  filterAndSortRecordsByDate,
  formatCurrency,
  sortLivestockItems,
  validateNewFinancialLog,
  validateNewProductRecord,
  type FinancialLog,
  type Livestock,
  type MedicalRecord,
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
    expect(formatCurrency(125.5, '£')).toBe('£125.50');
    expect(formatCurrency(3500, 'UGX')).toBe('UGX 3,500');
    expect(formatCurrency(-15000, 'UGX')).toBe('-UGX 15,000');

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
          sireId: null,
          damId: null,
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

  it('computes holistic livestock statistics across species, health, age, and production', () => {
    const animals: Livestock[] = [
      {
        id: 'c1',
        species: 'cow',
        tagNumber: 'COW-101',
        name: 'Bessie',
        breed: 'Holstein',
        dob: '2023-05-10',
        imageUri: null,
        sireId: 'c-sire',
        damId: null,
        status: 'active',
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'g1',
        species: 'goat',
        tagNumber: 'GOAT-201',
        name: 'clover',
        breed: 'Saanen',
        dob: '2026-08-01',
        imageUri: null,
        sireId: null,
        damId: null,
        status: 'active',
        createdAt: 2,
        updatedAt: 2,
      },
      {
        id: 'c2',
        species: 'cow',
        tagNumber: 'COW-102',
        name: 'Daisy',
        breed: 'Holstein',
        dob: null,
        imageUri: null,
        sireId: null,
        damId: null,
        status: 'sold',
        createdAt: 3,
        updatedAt: 3,
      },
    ];

    const records: ProductRecord[] = [
      {
        id: 'p1',
        livestockId: 'c1',
        date: '2026-11-16',
        yieldAmount: 22,
        qualityNotes: null,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'p2',
        livestockId: 'g1',
        date: '2026-11-17',
        yieldAmount: 4.5,
        qualityNotes: null,
        createdAt: 2,
        updatedAt: 2,
      },
    ];

    const medical: MedicalRecord[] = [
      {
        id: 'm1',
        livestockId: 'c1',
        date: '2026-11-10',
        condition: 'Annual Vaccine',
        treatment: 'FMD Booster',
        cost: 35,
        veterinarian: 'Dr. Kim',
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'm2',
        livestockId: 'g1',
        date: '2026-11-12',
        condition: 'Hoof Trim',
        treatment: 'Routine trim',
        cost: 15,
        veterinarian: null,
        createdAt: 2,
        updatedAt: 2,
      },
    ];

    const financial: FinancialLog[] = [
      {
        id: 'f1',
        livestockId: 'c1',
        productRecordId: 'p1',
        transactionType: 'income',
        amount: 60,
        date: '2026-11-16',
        category: 'milk_sale',
        notes: null,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'f2',
        livestockId: 'c1',
        productRecordId: null,
        transactionType: 'expense',
        amount: 20,
        date: '2026-11-16',
        category: 'feed',
        notes: null,
        createdAt: 2,
        updatedAt: 2,
      },
    ];

    const stats = computeLivestockStatistics({
      livestock: animals,
      productRecords: records,
      medicalRecords: medical,
      financialLogs: financial,
      trendDays: 7,
      todayIso: '2026-11-17',
    });

    expect(stats.totalAnimals).toBe(3);
    expect(stats.activeAnimals).toBe(2);
    expect(stats.soldAnimals).toBe(1);
    expect(stats.totalMilkLiters).toBe(26.5);
    expect(stats.totalMedicalEvents).toBe(2);
    expect(stats.totalMedicalCost).toBe(50);
    expect(stats.vaccinatedAnimalsCount).toBe(1);
    expect(stats.lineageLinkedAnimals).toBe(1);
    expect(stats.knownAgeAnimals).toBe(2);
    expect(stats.speciesBreakdown[0]).toMatchObject({
      species: 'cow',
      totalCount: 2,
      milkLiters: 22,
      incomeAmount: 60,
      expenseAmount: 20,
      netAmount: 40,
    });
    expect(stats.topBreeds[0]).toMatchObject({
      breed: 'Holstein',
      species: 'cow',
      count: 2,
    });
    expect(stats.dailyMilkSeries).toHaveLength(7);

    const goatOnly = computeLivestockStatistics({
      livestock: animals,
      productRecords: records,
      medicalRecords: medical,
      financialLogs: financial,
      speciesFilter: 'goat',
      todayIso: '2026-11-17',
    });
    expect(goatOnly.totalAnimals).toBe(1);
    expect(goatOnly.totalMilkLiters).toBe(4.5);
    expect(goatOnly.totalMedicalCost).toBe(15);
  });

  it('aggregates yield and financial logs by weeks, months, and years and sorts dates cleanly', () => {
    const animals: Livestock[] = [
      {
        id: 'c1',
        species: 'cow',
        tagNumber: 'COW-101',
        name: 'Bessie',
        breed: 'Holstein',
        dob: '2021-02-10',
        imageUri: null,
        sireId: null,
        damId: null,
        status: 'active',
        createdAt: 100,
        updatedAt: 200,
      },
      {
        id: 'c2',
        species: 'cow',
        tagNumber: 'COW-102',
        name: 'Clover',
        breed: 'Jersey',
        dob: '2024-08-15',
        imageUri: null,
        sireId: null,
        damId: null,
        status: 'active',
        createdAt: 300,
        updatedAt: 150,
      },
    ];

    const records: ProductRecord[] = [
      { id: 'r1', livestockId: 'c1', date: '2024-05-12', yieldAmount: 10, qualityNotes: null, createdAt: 1, updatedAt: 1 },
      { id: 'r2', livestockId: 'c1', date: '2025-11-20', yieldAmount: 15, qualityNotes: null, createdAt: 2, updatedAt: 2 },
      { id: 'r3', livestockId: 'c2', date: '2026-11-10', yieldAmount: 12, qualityNotes: null, createdAt: 3, updatedAt: 3 },
      { id: 'r4', livestockId: 'c2', date: '2026-11-16', yieldAmount: 8, qualityNotes: null, createdAt: 4, updatedAt: 4 },
    ];

    const financial: FinancialLog[] = [
      { id: 'f1', livestockId: 'c1', productRecordId: null, transactionType: 'income', amount: 100, date: '2024-05-12', category: 'milk_sale', notes: null, createdAt: 1, updatedAt: 1 },
      { id: 'f2', livestockId: 'c1', productRecordId: null, transactionType: 'expense', amount: 40, date: '2026-11-16', category: 'feed', notes: null, createdAt: 2, updatedAt: 2 },
    ];

    const weeksSeries = buildYieldSeriesForTimeframe(records, 'weeks', '2026-11-17');
    expect(weeksSeries).toHaveLength(12);
    expect(weeksSeries[weeksSeries.length - 1]?.totalLiters).toBe(8);
    expect(weeksSeries[weeksSeries.length - 2]?.totalLiters).toBe(12);

    const monthsSeries = buildYieldSeriesForTimeframe(records, 'months', '2026-11-17');
    expect(monthsSeries).toHaveLength(12);
    expect(monthsSeries[monthsSeries.length - 1]?.totalLiters).toBe(20);

    const yearsSeries = buildYieldSeriesForTimeframe(records, 'years', '2026-11-17');
    expect(yearsSeries.map((y) => y.label)).toEqual(['2024', '2025', '2026']);
    expect(yearsSeries.map((y) => y.totalLiters)).toEqual([10, 15, 20]);

    const weeklyReport = computeLivestockStatistics({
      livestock: animals,
      productRecords: records,
      medicalRecords: [],
      financialLogs: financial,
      timeframe: 'weeks',
      todayIso: '2026-11-17',
    });
    expect(weeklyReport.totalMilkLiters).toBe(20);
    expect(weeklyReport.chartTitlePrefix).toBe('12-Week');

    const yearlyReport = computeLivestockStatistics({
      livestock: animals,
      productRecords: records,
      medicalRecords: [],
      financialLogs: financial,
      timeframe: 'years',
      todayIso: '2026-11-17',
    });
    expect(yearlyReport.totalMilkLiters).toBe(45);
    expect(yearlyReport.financialSummary.netProfit).toBe(60);

    const yearPl = buildPeriodProfitLossSeries(financial, 'year', 12);
    expect(yearPl.map((p) => p.label)).toEqual(['2024', '2026']);

    const sortedRecords = filterAndSortRecordsByDate(records, {
      filter: '12w',
      sort: 'asc',
      todayIso: '2026-11-17',
    });
    expect(sortedRecords.map((r) => r.id)).toEqual(['r3', 'r4']);

    expect(sortLivestockItems(animals, 'dob_desc').map((a) => a.id)).toEqual(['c2', 'c1']);
    expect(sortLivestockItems(animals, 'dob_asc').map((a) => a.id)).toEqual(['c1', 'c2']);
    expect(sortLivestockItems(animals, 'created_desc').map((a) => a.id)).toEqual(['c2', 'c1']);
  });
});
