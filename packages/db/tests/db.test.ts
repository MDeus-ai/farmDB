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
      '0004_livestock_lineage',
      '0005_human_resources',
      '0006_ownerships_network_cloud',
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
        'animal_ownerships',
        'cloud_sync_logs',
        'farm_accounts',
        'farm_settings',
        'financial_logs',
        'livestock',
        'medical_records',
        'product_records',
        'schema_migrations',
        'worker_payments',
        'worker_tasks',
        'workers',
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
    expect(cow.sireId).toBeNull();
    expect(cow.damId).toBeNull();
    expect(cow.imageUri).toBe('file:///local/farmdb-images/cow-402.jpg');
    expect(emittedEvents).toEqual([['livestock']]);

    const calf = await session.livestock.create({
      species: 'cow',
      tagNumber: 'COW-502',
      name: 'Clover Calf',
      damId: cow.id,
    });
    expect(calf.damId).toBe(cow.id);

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
      totalLivestock: 3,
      activeLivestock: 2,
      soldLivestock: 1,
      deceasedLivestock: 0,
      cowCount: 2,
      productRecordCount: 0,
      medicalRecordCount: 0,
      financialLogCount: 0,
      openAlertCount: 0,
    });

    const deleted = await session.livestock.remove(cow.id);
    expect(deleted).toBe(true);
    expect(await session.livestock.getById(cow.id)).toBeNull();
    const unlinkedCalf = await session.livestock.getById(calf.id);
    expect(unlinkedCalf?.damId).toBeNull();

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
    expect(settings).toMatchObject({
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

    const sire = await sourceSession.livestock.create({
      tagNumber: 'BULL-101',
      name: 'Titan',
      breed: 'Jersey',
    });
    const cow = await sourceSession.livestock.create({
      tagNumber: 'COW-901',
      name: 'Buttercup',
      breed: 'Jersey',
      sireId: sire.id,
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
    expect(snapshot.livestock).toHaveLength(2);
    expect(snapshot.productRecords).toHaveLength(1);
    expect(snapshot.medicalRecords).toHaveLength(1);
    expect(snapshot.financialLogs).toHaveLength(1);
    expect(snapshot.alerts).toHaveLength(1);

    const target = createNodeSqliteDriver(':memory:');
    await runMigrations(target.driver);
    const targetSession = createFarmDbSession(target.driver);

    const restoredCounts = await targetSession.backup.restoreSnapshot(snapshot);
    expect(restoredCounts).toEqual({
      livestockCount: 2,
      productCount: 1,
      medicalCount: 1,
      financialCount: 1,
      alertCount: 1,
    });

    const restoredCow = await targetSession.livestock.getByTagNumber('COW-901');
    expect(restoredCow?.name).toBe('Buttercup');
    expect(restoredCow?.sireId).toBe(sire.id);
    expect(await targetSession.production.list()).toHaveLength(1);
    expect(await targetSession.medical.list()).toHaveLength(1);
    expect(await targetSession.financial.list()).toHaveLength(1);
    expect(await targetSession.alerts.list()).toHaveLength(1);

    // Extended farm settings persist cleanly and reset back to defaults
    const updatedSettings = await targetSession.settings.update({
      farmName: 'Highland Dairy',
      fontScale: 'large',
      uiDensity: 'spacious',
      dateFormat: 'dmy',
      volumeUnit: 'gallons',
      defaultSpecies: 'goat',
      autoRecordMilkSaleByDefault: false,
      autoRecordMedicalExpenseByDefault: false,
      alertCheckIntervalSeconds: 180,
      enableNotifications: false,
      confirmBeforeDelete: false,
    });
    expect(updatedSettings.farmName).toBe('Highland Dairy');
    expect(updatedSettings.fontScale).toBe('large');
    expect(updatedSettings.uiDensity).toBe('spacious');
    expect(updatedSettings.alertCheckIntervalSeconds).toBe(180);

    const reloadedSettings = await targetSession.settings.get();
    expect(reloadedSettings).toEqual(updatedSettings);

    const resetSettings = await targetSession.settings.reset();
    expect(resetSettings.fontScale).toBe('medium');
    expect(resetSettings.uiDensity).toBe('comfortable');
    expect(resetSettings.farmName).toBe('farmDB Homestead');

    source.raw.close();
    target.raw.close();
  });

  it('manages farm workers, salaries, pending payments with financial links, allocated tasks, and payment-due lead alerts', async () => {
    const { driver, raw } = createNodeSqliteDriver(':memory:');
    await runMigrations(driver);
    const session = createFarmDbSession(driver);

    await session.settings.update({ paymentAlertLeadDays: 4 });

    const worker = await session.hr.createWorker({
      name: 'David Okello',
      role: 'Senior Herdsman',
      phone: '+256 772 555111',
      responsibilities: 'Morning milking, silage distribution, calving watch',
      salaryAmount: 320,
      payFrequency: 'monthly',
      nextPaymentDueDate: '2026-11-20',
    });

    const cow = await session.livestock.create({
      tagNumber: 'COW-777',
      name: 'Ruby',
    });

    const task = await session.hr.createTask({
      workerId: worker.id,
      livestockId: cow.id,
      title: 'Assist calving pen setup',
      priority: 'high',
      dueDate: '2026-11-18',
    });
    expect(task.status).toBe('pending');
    expect(task.livestockId).toBe(cow.id);

    const updatedTask = await session.hr.updateTask(task.id, {
      status: 'completed',
    });
    expect(updatedTask.completedAt).not.toBeNull();

    // Almost-due check: 2026-11-17 is 3 days before 2026-11-20 <= leadDays(4)
    const dueNotifs = await session.hr.listDuePaymentNotifications('2026-11-17', 4);
    expect(dueNotifs).toHaveLength(1);
    expect(dueNotifs[0]?.urgency).toBe('almost_due');

    await session.hr.markPaymentNotificationsDelivered(dueNotifs, 999000);
    expect(await session.hr.listDuePaymentNotifications('2026-11-17', 4)).toEqual([]);

    // Create pending payment and mark it paid -> logs payroll expense & advances worker due date
    const pendingRes = await session.hr.createPayment({
      workerId: worker.id,
      amount: 320,
      dueDate: '2026-11-20',
      status: 'pending',
      periodLabel: 'Nov 2026 Salary',
    });
    expect(pendingRes.payment.status).toBe('pending');

    const paidRes = await session.hr.markPaymentPaid(pendingRes.payment.id, {
      paidDate: '2026-11-18',
      autoRecordExpense: true,
      advanceWorkerDueDate: true,
    });
    expect(paidRes.payment.status).toBe('paid');
    expect(paidRes.generatedExpenseLog?.category).toBe('payroll');
    expect(paidRes.generatedExpenseLog?.amount).toBe(320);

    const refreshedWorker = await session.hr.getWorkerById(worker.id);
    expect(refreshedWorker?.nextPaymentDueDate).toBe('2026-12-20');
    expect(refreshedWorker?.paymentNotifiedForDueDate).toBeNull();

    raw.close();
  });

  it('tracks animal ownerships, RBAC Farm Network accounts, and Supabase bidirectional cloud sync', async () => {
    const { driver, raw } = createNodeSqliteDriver(':memory:');
    await runMigrations(driver);
    const session = createFarmDbSession(driver);

    const bull = await session.livestock.create({
      tagNumber: 'BULL-801',
      name: 'Samson',
      breed: 'Friesian',
    });

    const partnerAccount = await session.network.createAccount({
      displayName: 'Samuel Kato (Partner)',
      email: 'samuel@partner.ug',
      role: 'external_owner',
      relationship: 'Neighboring Farm Stud Owner',
      accessCode: '4321',
      permissions: {
        livestock: 'view',
        ownerships: 'view',
        medical: 'edit',
        financial: 'none',
      },
    });
    expect(partnerAccount.permissions.financial).toBe('none');
    expect(partnerAccount.permissions.medical).toBe('edit');

    // Join key rotation + sign-up -> pending -> admin approval workflow
    const rotatedCode = await session.network.rotateNetworkJoinKey();
    expect(rotatedCode).toMatch(/^FARM-[A-Z0-9]{4}$/);

    await expect(
      session.network.joinNetworkWithKey({
        joinKey: 'FARM-0000',
        newAccount: { displayName: 'Invalid User' },
      })
    ).rejects.toThrow(/Join Key/i);

    const joinRes = await session.network.joinNetworkWithKey({
      joinKey: rotatedCode,
      newAccount: {
        displayName: 'New Family Member',
        email: 'family@farm.ug',
        role: 'family_member',
      },
    });
    expect(joinRes.account.status).toBe('pending');
    expect((await session.network.getActiveAccount()).id).toBe(joinRes.account.id);

    const approved = await session.network.acceptPendingAccount(joinRes.account.id, {
      role: 'manager',
      permissions: { livestock: 'full', financial: 'view' },
    });
    expect(approved.status).toBe('active');
    expect(approved.role).toBe('manager');
    expect(approved.permissions.livestock).toBe('full');

    // Wrong PIN should be rejected
    await expect(
      session.network.switchActiveAccount(partnerAccount.id, '0000')
    ).rejects.toThrow(/PIN/i);

    const switched = await session.network.switchActiveAccount(
      partnerAccount.id,
      '4321'
    );
    expect(switched.id).toBe(partnerAccount.id);

    const ownership = await session.ownerships.create({
      livestockId: bull.id,
      ownerName: partnerAccount.displayName,
      ownerContact: '+256 770 900100',
      accountId: partnerAccount.id,
      ownershipCategory: 'breeding_loan_in',
      sharePercentage: 100,
      purpose: 'Seasonal AI & natural service breeding bull',
      startDate: '2026-11-01',
      expectedEndDate: '2027-02-01',
      boardingFee: 85,
      status: 'active',
    });
    expect(ownership.ownershipCategory).toBe('breeding_loan_in');
    expect(await session.ownerships.list({ category: 'breeding_loan_in' })).toHaveLength(1);

    // Deleting animal cascades to ownership records
    await session.livestock.remove(bull.id);
    expect(await session.ownerships.list()).toHaveLength(0);

    // Mock globalThis.fetch for Supabase sync test (including /rest/v1 suffix and sb_publishable_ key)
    await session.settings.update({
      cloudSyncEnabled: true,
      supabaseUrl: 'https://farmdb-test.supabase.co/rest/v1/',
      supabaseAnonKey: 'sb_publishable_test_key',
      cloudWorkspaceId: 'ws-test-1',
    });

    const remoteSnapshot = await session.backup.exportSnapshot();
    remoteSnapshot.livestock.push({
      id: 'duck-remote-1',
      species: 'duck',
      tagNumber: 'DUCK-01',
      name: 'Mallory',
      breed: 'Pekin',
      dob: null,
      imageUri: null,
      sireId: null,
      damId: null,
      status: 'active',
      createdAt: 5000,
      updatedAt: 5000,
    });

    const seenUrls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (
      url: unknown,
      init?: { method?: string }
    ) => {
      seenUrls.push(String(url));
      if ((init?.method ?? 'GET') === 'GET') {
        return new Response(
          JSON.stringify([
            {
              workspace_id: 'ws-test-1',
              farm_name: 'farmDB Homestead',
              snapshot: remoteSnapshot,
              updated_at: '2026-11-17T12:00:00Z',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('', { status: 201 });
    }) as typeof fetch;

    try {
      // Standalone non-network User Account cannot access cloud sync
      const blockedSync = await session.network.syncWithSupabase('bidirectional');
      expect(blockedSync.ok).toBe(false);
      expect(blockedSync.message).toMatch(/Join Key/i);

      // Admin Account syncs normally
      await session.network.switchActiveAccount('owner-admin');
      const syncRes = await session.network.syncWithSupabase('bidirectional');
      expect(syncRes.ok).toBe(true);
      expect(
        seenUrls.every(
          (u) =>
            u.startsWith('https://farmdb-test.supabase.co/rest/v1/') &&
            !u.includes('/rest/v1/rest/v1')
        )
      ).toBe(true);
      expect(syncRes.recordsPulled).toBeGreaterThanOrEqual(1);
      const pulledDuck = await session.livestock.getByTagNumber('DUCK-01');
      expect(pulledDuck?.species).toBe('duck');
      const logs = await session.network.listSyncLogs(10);
      expect(logs[0]?.status).toBe('success');
    } finally {
      globalThis.fetch = originalFetch;
    }

    raw.close();
  });
});
