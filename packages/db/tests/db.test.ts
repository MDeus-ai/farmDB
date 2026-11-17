import { describe, expect, it } from 'vitest';
import {
  convertQuestionPlaceholdersToDollar,
  createFarmDbSession,
  extractProjectedColumns,
  LivestockValidationError,
  mapRowObjectToValues,
  runMigrations,
} from '../src/index';
import { createNodeSqliteDriver } from './nodeSqliteDriver';

describe('@farmdb/db SQL helpers', () => {
  it('converts positional ? placeholders to $n outside quoted literals', () => {
    const converted = convertQuestionPlaceholdersToDollar(
      `SELECT * FROM livestock WHERE tag_number = ? AND notes != 'why?' AND "col?" = ?`
    );
    expect(converted).toBe(
      `SELECT * FROM livestock WHERE tag_number = $1 AND notes != 'why?' AND "col?" = $2`
    );
  });

  it('extracts projected column names and maps row objects regardless of key order', () => {
    const sql = `select "id", "species", "tag_number", "name" from "livestock" where "id" = ?`;
    const cols = extractProjectedColumns(sql);
    expect(cols).toEqual(['id', 'species', 'tag_number', 'name']);

    const alphabeticallyOrderedRow = {
      id: '1',
      name: 'Bessie',
      species: 'cow',
      tag_number: 'COW-402',
    };

    expect(mapRowObjectToValues(alphabeticallyOrderedRow, cols)).toEqual([
      '1',
      'cow',
      'COW-402',
      'Bessie',
    ]);
  });
});

describe('@farmdb/db migrations and repositories', () => {
  it('applies migrations idempotently and enforces foreign keys', async () => {
    const { driver, raw } = createNodeSqliteDriver(':memory:');

    const first = await runMigrations(driver);
    expect(first).toEqual([
      '0001_initial_schema',
      '0002_production_financial_links',
      '0003_alerts_notification_tracking',
    ]);

    const second = await runMigrations(driver);
    expect(second).toEqual([]);

    const tables = raw
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`
      )
      .all() as Array<{ name: string }>;

    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        'alerts',
        'farm_settings',
        'financial_logs',
        'livestock',
        'medical_records',
        'product_records',
        'schema_migrations',
      ])
    );

    raw.close();
  });

  it('creates, lists, filters, updates, and deletes livestock with reactive events', async () => {
    const { driver, raw } = createNodeSqliteDriver(':memory:');
    await runMigrations(driver);
    const session = createFarmDbSession(driver);

    const emittedEvents: string[][] = [];
    session.events.subscribe((ev) => {
      emittedEvents.push([...ev.scopes]);
    });

    const cow = await session.livestock.create({
      tagNumber: 'cow 402',
      name: 'Bessie',
      breed: 'Holstein',
      dob: '2022-05-10',
      imageUri: 'file:///local/farmdb-images/cow-402.jpg',
    });

    expect(cow.species).toBe('cow');
    expect(cow.tagNumber).toBe('COW-402');
    expect(cow.status).toBe('active');
    expect(cow.imageUri).toBe('file:///local/farmdb-images/cow-402.jpg');
    expect(emittedEvents).toEqual([['livestock']]);

    await session.livestock.create({
      species: 'goat',
      tagNumber: 'GT-101',
      name: 'Clover',
      breed: 'Alpine',
    });

    await expect(
      session.livestock.create({ tagNumber: 'cow-402', name: 'Duplicate' })
    ).rejects.toBeInstanceOf(LivestockValidationError);

    const filteredCows = await session.livestock.list({
      species: 'cow',
      search: 'bess',
    });
    expect(filteredCows).toHaveLength(1);
    expect(filteredCows[0]?.id).toBe(cow.id);

    const updated = await session.livestock.update(cow.id, {
      status: 'sold',
      name: 'Bessie II',
      imageUri: null,
    });
    expect(updated.status).toBe('sold');
    expect(updated.name).toBe('Bessie II');
    expect(updated.imageUri).toBeNull();

    const summary = await session.livestock.getSummary();
    expect(summary).toEqual({
      totalLivestock: 2,
      activeLivestock: 1,
      soldLivestock: 1,
      deceasedLivestock: 0,
      cowCount: 1,
      productRecordCount: 0,
      medicalRecordCount: 0,
      financialLogCount: 0,
      openAlertCount: 0,
    });

    const deleted = await session.livestock.remove(cow.id);
    expect(deleted).toBe(true);
    expect(await session.livestock.getById(cow.id)).toBeNull();

    raw.close();
  });

  it('logs milk yields, automates milk sale income, and manages financial entries', async () => {
    const { driver, raw } = createNodeSqliteDriver(':memory:');
    await runMigrations(driver);
    const session = createFarmDbSession(driver);

    const cow = await session.livestock.create({
      tagNumber: 'COW-500',
      name: 'Meadow',
    });

    const settings = await session.settings.update({
      defaultMilkRatePerLiter: 0.8,
      currencySymbol: '$',
    });
    expect(settings).toEqual({
      defaultMilkRatePerLiter: 0.8,
      currencySymbol: '$',
    });

    const prodResult = await session.production.create(
      {
        livestockId: cow.id,
        date: '2026-11-16',
        yieldAmount: 20,
        qualityNotes: 'Morning + evening milking',
      },
      { autoRecordSale: true }
    );

    expect(prodResult.record.yieldAmount).toBe(20);
    expect(prodResult.generatedIncomeLog).not.toBeNull();
    expect(prodResult.generatedIncomeLog?.amount).toBe(16);
    expect(prodResult.generatedIncomeLog?.category).toBe('milk_sale');
    expect(prodResult.generatedIncomeLog?.productRecordId).toBe(
      prodResult.record.id
    );

    const expense = await session.financial.create({
      transactionType: 'expense',
      category: 'feed',
      amount: 45.5,
      date: '2026-11-16',
      notes: 'Silage bales',
    });

    expect(expense.transactionType).toBe('expense');
    expect(expense.livestockId).toBeNull();

    const logs = await session.financial.list();
    expect(logs).toHaveLength(2);

    const summary = await session.livestock.getSummary();
    expect(summary.productRecordCount).toBe(1);
    expect(summary.financialLogCount).toBe(2);

    await session.production.remove(prodResult.record.id);
    const remainingLogs = await session.financial.list();
    expect(remainingLogs).toHaveLength(2);
    const linkedLog = remainingLogs.find((l) => l.id === prodResult.generatedIncomeLog?.id);
    expect(linkedLog?.productRecordId).toBeNull();

    raw.close();
  });

  it('tracks medical history with optional expense logging and due-alert notification state', async () => {
    const { driver, raw } = createNodeSqliteDriver(':memory:');
    await runMigrations(driver);
    const session = createFarmDbSession(driver);

    const cow = await session.livestock.create({
      tagNumber: 'COW-402',
      name: 'Bessie',
    });

    const medRes = await session.medical.create(
      {
        livestockId: cow.id,
        date: '2026-11-16',
        condition: 'Routine checkup',
        treatment: 'FMD Vaccine',
        cost: 35,
        veterinarian: 'Dr. Patel',
      },
      { autoRecordExpense: true }
    );

    expect(medRes.record.condition).toBe('Routine checkup');
    expect(medRes.generatedExpenseLog?.category).toBe('veterinary');
    expect(medRes.generatedExpenseLog?.amount).toBe(35);

    const medHistory = await session.medical.list({ livestockId: cow.id });
    expect(medHistory).toHaveLength(1);

    const dueAlert = await session.alerts.create({
      livestockId: cow.id,
      entryKind: 'alert',
      title: 'Cow #402 is due for vaccination',
      triggerDate: '2026-11-17',
    });
    const futureAlert = await session.alerts.create({
      livestockId: cow.id,
      entryKind: 'alert',
      title: 'Booster shot',
      triggerDate: '2026-11-25',
    });
    await session.alerts.create({
      entryKind: 'note',
      title: 'Order bedding straw',
      triggerDate: '2026-11-16',
    });

    const dueList = await session.alerts.listDueForNotification('2026-11-17');
    expect(dueList.map((a) => a.id)).toEqual([dueAlert.id]);

    await session.alerts.markNotified([dueAlert.id], 123456);
    expect(await session.alerts.listDueForNotification('2026-11-17')).toEqual([]);

    // Rescheduling triggerDate clears notifiedAt so it fires again when due
    const rescheduled = await session.alerts.update(dueAlert.id, {
      triggerDate: '2026-11-18',
    });
    expect(rescheduled.notifiedAt).toBeNull();
    expect(
      (await session.alerts.listDueForNotification('2026-11-18')).map(
        (a) => a.id
      )
    ).toEqual([dueAlert.id]);

    await session.alerts.toggleResolved(dueAlert.id, true);
    const summary = await session.livestock.getSummary();
    expect(summary.medicalRecordCount).toBe(1);
    expect(summary.openAlertCount).toBe(1); // Only futureAlert remains an open alert

    expect(futureAlert.entryKind).toBe('alert');
    raw.close();
  });

  it('exports full snapshot and restores cleanly into an empty or replaced database', async () => {
    const source = createNodeSqliteDriver(':memory:');
    await runMigrations(source.driver);
    const sourceSession = createFarmDbSession(source.driver);

    const cow = await sourceSession.livestock.create({
      tagNumber: 'COW-901',
      name: 'Buttercup',
      breed: 'Jersey',
    });
    await sourceSession.production.create(
      { livestockId: cow.id, date: '2026-11-16', yieldAmount: 14.5 },
      { autoRecordSale: true }
    );
    await sourceSession.medical.create({
      livestockId: cow.id,
      date: '2026-11-16',
      condition: 'Checkup',
      treatment: 'Vitamins',
      cost: 12,
    });
    await sourceSession.alerts.create({
      livestockId: cow.id,
      entryKind: 'note',
      title: 'High butterfat',
      triggerDate: '2026-11-16',
    });

    const snapshot = await sourceSession.backup.exportSnapshot();
    expect(snapshot.livestock).toHaveLength(1);
    expect(snapshot.productRecords).toHaveLength(1);
    expect(snapshot.medicalRecords).toHaveLength(1);
    expect(snapshot.financialLogs).toHaveLength(1);
    expect(snapshot.alerts).toHaveLength(1);

    const target = createNodeSqliteDriver(':memory:');
    await runMigrations(target.driver);
    const targetSession = createFarmDbSession(target.driver);

    const restoredCounts = await targetSession.backup.restoreSnapshot(snapshot);
    expect(restoredCounts).toEqual({
      livestockCount: 1,
      productCount: 1,
      medicalCount: 1,
      financialCount: 1,
      alertCount: 1,
    });

    const restoredCow = await targetSession.livestock.getByTagNumber('COW-901');
    expect(restoredCow?.name).toBe('Buttercup');
    expect(await targetSession.production.list()).toHaveLength(1);
    expect(await targetSession.medical.list()).toHaveLength(1);
    expect(await targetSession.financial.list()).toHaveLength(1);
    expect(await targetSession.alerts.list()).toHaveLength(1);

    source.raw.close();
    target.raw.close();
  });
});
