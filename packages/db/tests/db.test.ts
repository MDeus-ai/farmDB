import { describe, expect, it } from 'vitest';
import {
  buildStandardUserPermissions,
  encodeFarmNetworkJoinKey,
  getDefaultPermissionsForRole,
} from '@farmdb/core';
import {
  convertQuestionPlaceholdersToDollar,
  createFarmDbSession,
  extractDatabaseErrorCause,
  extractProjectedColumns,
  formatFriendlyDatabaseError,
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
      '0007_livestock_sex',
      '0008_admin_cloud_credentials',
      '0009_account_onboarding',
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
    expect(cow.sex).toBe('female');

    const bull = await session.livestock.create({
      tagNumber: 'BULL-500',
      name: 'Titan',
      sex: 'male',
    });
    expect(bull.sex).toBe('male');

    await expect(
      session.production.create({
        livestockId: bull.id,
        date: '2026-11-16',
        yieldAmount: 12,
      })
    ).rejects.toThrow(/male/i);

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
    expect((await session.network.getActiveAccount())?.id).toBe(joinRes.account.id);

    // Pending account cannot self-approve or manage network accounts
    await expect(
      session.network.acceptPendingAccount(joinRes.account.id, { role: 'manager' })
    ).rejects.toThrow(/permission/i);

    await session.network.switchActiveAccount('owner-admin');
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

    // View-only & edit-only RBAC guards enforced at session repository layer
    await expect(
      session.ownerships.create({
        livestockId: bull.id,
        ownerName: partnerAccount.displayName,
        ownershipCategory: 'breeding_loan_in',
      })
    ).rejects.toThrow(/permission/i);
    await expect(session.livestock.remove(bull.id)).rejects.toThrow(/permission/i);

    // Edit-only permission on medical allows create/update, but blocks delete
    const partnerMed = await session.medical.create({
      livestockId: bull.id,
      date: '2026-11-10',
      condition: 'Routine Checkup',
      treatment: 'Routine Vitamin B Boost',
    });
    expect(partnerMed.record.treatment).toBe('Routine Vitamin B Boost');
    await expect(session.medical.remove(partnerMed.record.id)).rejects.toThrow(/permission/i);

    // Tightened RBAC checks: family_tree vs livestock isolation + settings/network protections
    await session.network.switchActiveAccount('owner-admin');
    const damCow = await session.livestock.create({
      species: 'cow',
      sex: 'female',
      tagNumber: 'COW-DAM-1',
      name: 'Willow',
    });
    const calfCow = await session.livestock.create({
      species: 'cow',
      sex: 'female',
      tagNumber: 'COW-CALF-1',
      name: 'Clover',
    });

    const registryEditorAccount = await session.network.createAccount({
      displayName: 'Grace (Registry Editor)',
      role: 'staff_viewer',
      accessCode: '5678',
      permissions: {
        livestock: 'full',
        family_tree: 'view',
        settings: 'view',
        backup: 'view',
      },
    });
    const lineageEditorAccount = await session.network.createAccount({
      displayName: 'Peter (Lineage Archivist)',
      role: 'staff_viewer',
      accessCode: '6789',
      permissions: {
        livestock: 'view',
        family_tree: 'edit',
      },
    });

    // Account with livestock=full, family_tree=view CAN edit animal fields, CANNOT edit lineage or escalate privileges
    await session.network.switchActiveAccount(registryEditorAccount.id, '5678');
    const renamedCalf = await session.livestock.update(calfCow.id, { name: 'Clover II' });
    expect(renamedCalf.name).toBe('Clover II');
    await expect(
      session.livestock.update(calfCow.id, { sireId: bull.id })
    ).rejects.toThrow(/family_tree/i);
    await expect(
      session.livestock.create({
        species: 'cow',
        sex: 'female',
        tagNumber: 'COW-CALF-2',
        damId: damCow.id,
      })
    ).rejects.toThrow(/family_tree/i);
    await expect(
      session.settings.update({ farmName: 'Hijacked Farm' })
    ).rejects.toThrow(/permission/i);
    await expect(
      session.network.createAccount({ displayName: 'Rogue Admin', role: 'admin' })
    ).rejects.toThrow(/administrator permission/i);
    await expect(
      session.network.updateAccount(registryEditorAccount.id, { role: 'admin' })
    ).rejects.toThrow(/privileges/i);
    // Self-service password / profile change still permitted (including first-time onboarding completion)
    expect(registryEditorAccount.onboardingCompleted).toBe(false);
    const selfUpdated = await session.network.updateAccount(registryEditorAccount.id, {
      accessCode: '9999',
      onboardingCompleted: true,
    });
    expect(selfUpdated.accessCode).toBe('9999');
    expect(selfUpdated.onboardingCompleted).toBe(true);

    // Account with livestock=view, family_tree=edit CAN link lineage via Family Tree, CANNOT alter Herd Registry fields
    await session.network.switchActiveAccount(lineageEditorAccount.id, '6789');
    const linkedCalf = await session.livestock.update(calfCow.id, {
      sireId: bull.id,
      damId: damCow.id,
    });
    expect(linkedCalf.sireId).toBe(bull.id);
    expect(linkedCalf.damId).toBe(damCow.id);
    await expect(
      session.livestock.update(calfCow.id, { name: 'Forbidden Rename' })
    ).rejects.toThrow(/livestock/i);

    // Switch back to primary Admin for full-access creation and cascade delete
    await session.network.switchActiveAccount('owner-admin');

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
    expect(remoteSnapshot.settingsUpdatedAt).toBeGreaterThan(0);
    remoteSnapshot.settings = {
      ...remoteSnapshot.settings,
      farmName: 'Cloud Synced Farm',
      currencySymbol: 'KES',
    };
    remoteSnapshot.settingsUpdatedAt = Date.now() + 60000;
    remoteSnapshot.cloudSyncLogs = [
      ...(remoteSnapshot.cloudSyncLogs ?? []),
      {
        id: 'log-cloud-1',
        direction: 'push',
        status: 'success',
        recordsPulled: 0,
        recordsPushed: 4,
        summary: 'Synced from cloud snapshot',
        createdAt: 9000,
      },
    ];
    remoteSnapshot.livestock.push({
      id: 'duck-remote-1',
      species: 'duck',
      sex: 'female',
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
      await session.network.switchActiveAccount(partnerAccount.id, '4321');
      const blockedSync = await session.network.syncWithSupabase('bidirectional');
      expect(blockedSync.ok).toBe(false);
      expect(blockedSync.message).toMatch(/Join Key/i);

      // Admin Account syncs normally & pulls shared settings + sync logs while keeping local session & URL
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
      const syncedSettings = await session.settings.get();
      expect(syncedSettings.farmName).toBe('Cloud Synced Farm');
      expect(syncedSettings.currencySymbol).toBe('KES');
      expect(syncedSettings.supabaseUrl).toBe('https://farmdb-test.supabase.co');
      expect((await session.network.getActiveAccount())?.id).toBe('owner-admin');
      const logs = await session.network.listSyncLogs(10);
      expect(logs[0]?.status).toBe('success');
      expect(logs.some((l) => l.id === 'log-cloud-1')).toBe(true);

      // Admin account stores Supabase credentials & a fresh second device can sign in + pull cloud DB via recoverAdminFromCloud
      const adminAfterPush = await session.network.getAccountById('owner-admin');
      expect(adminAfterPush?.supabaseUrl).toBe('https://farmdb-test.supabase.co');
      expect(adminAfterPush?.supabaseAnonKey).toBe('sb_publishable_test_key');
      expect(adminAfterPush?.cloudWorkspaceId).toBe('ws-test-1');

      // Set Admin PIN on remote snapshot to verify PIN check during second-device recovery
      const cloudSnapForDeviceB = await session.backup.exportSnapshot();
      cloudSnapForDeviceB.farmAccounts = (cloudSnapForDeviceB.farmAccounts ?? []).map(
        (acc) =>
          acc.id === 'owner-admin'
            ? { ...acc, accessCode: '2468', email: 'owner@farm.ug' }
            : acc
      );

      const { driver: driverB, raw: rawB } = createNodeSqliteDriver(':memory:');
      await runMigrations(driverB);
      const sessionB = createFarmDbSession(driverB);
      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify([
            {
              workspace_id: 'ws-test-1',
              farm_name: 'Cloud Synced Farm',
              snapshot: cloudSnapForDeviceB,
              updated_at: '2026-11-18T12:00:00Z',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )) as typeof fetch;

      await expect(
        sessionB.network.recoverAdminFromCloud({
          supabaseUrl: 'https://farmdb-test.supabase.co',
          supabaseAnonKey: 'sb_publishable_test_key',
          cloudWorkspaceId: 'ws-test-1',
          email: 'owner@farm.ug',
          accessCode: '0000',
        })
      ).rejects.toThrow(/Incorrect Admin password/i);

      const recovered = await sessionB.network.recoverAdminFromCloud({
        supabaseUrl: 'https://farmdb-test.supabase.co',
        supabaseAnonKey: 'sb_publishable_test_key',
        cloudWorkspaceId: 'ws-test-1',
        email: 'owner@farm.ug',
        accessCode: '2468',
      });
      expect(recovered.account.id).toBe('owner-admin');
      expect(recovered.account.supabaseUrl).toBe('https://farmdb-test.supabase.co');
      expect(recovered.account.supabaseAnonKey).toBe('sb_publishable_test_key');
      expect((await sessionB.livestock.getByTagNumber('DUCK-01'))?.name).toBe('Mallory');
      expect((await sessionB.settings.get()).supabaseUrl).toBe('https://farmdb-test.supabase.co');
      rawB.close();
    } finally {
      globalThis.fetch = originalFetch;
    }

    raw.close();
  });

  it('does not auto-seed default admin on Mobile (autoSeedDefaultAdmin: false) and supports self sign-up', async () => {
    const { driver, raw } = createNodeSqliteDriver(':memory:');
    await runMigrations(driver);
    const session = createFarmDbSession(driver, { autoSeedDefaultAdmin: false });

    // Fresh DB has zero accounts and no active account
    expect(await session.network.listAccounts()).toEqual([]);
    expect(await session.network.getActiveAccount()).toBeNull();

    // User creates a standalone User Account -> no owner-admin appears
    const userOne = await session.network.signUpAccount({
      displayName: 'Sarah Namono',
      role: 'family_member',
      accessCode: '1234',
      avatarKey: 'farmerFemale',
      isPrimaryAdmin: false,
      canManageNetwork: false,
      canSyncCloud: false,
      status: 'active',
      permissions: buildStandardUserPermissions(),
    });
    await session.network.switchActiveAccount(userOne.id, '1234');

    const afterUserList = await session.network.listAccounts();
    expect(afterUserList.map((a) => a.id)).toEqual([userOne.id]);
    expect(afterUserList.some((a) => a.id === 'owner-admin')).toBe(false);
    expect((await session.network.getActiveAccount())?.id).toBe(userOne.id);

    // Self sign-up of another User Account or Admin Account works even while a non-admin User is active
    const userTwo = await session.network.signUpAccount({
      displayName: 'Grace Helper',
      role: 'staff_viewer',
      accessCode: '2345',
      avatarKey: 'farmer',
      isPrimaryAdmin: false,
      canManageNetwork: false,
      canSyncCloud: false,
      status: 'active',
      permissions: buildStandardUserPermissions(),
    });
    expect(
      (await session.network.listAccounts()).some((a) => a.id === 'owner-admin')
    ).toBe(false);

    const adminOne = await session.network.signUpAccount({
      displayName: 'Deus Owner',
      role: 'admin',
      accessCode: '9999',
      avatarKey: 'farmer',
      isPrimaryAdmin: true,
      canManageNetwork: true,
      canSyncCloud: true,
      status: 'active',
      permissions: getDefaultPermissionsForRole('admin'),
    });
    await session.network.switchActiveAccount(adminOne.id, '9999');
    expect((await session.network.getActiveAccount())?.id).toBe(adminOne.id);

    // Deleting a non-primary user account does not fabricate 'owner-admin'
    await session.network.removeAccount(userTwo.id);
    const remainingIds = (await session.network.listAccounts()).map((a) => a.id);
    expect(remainingIds).not.toContain('owner-admin');
    expect(remainingIds).toEqual(expect.arrayContaining([userOne.id, adminOne.id]));

    // Removing the only removable account when no primary admin exists falls back to active null without seeding owner-admin
    const { driver: driverOnlyUser, raw: rawOnlyUser } = createNodeSqliteDriver(':memory:');
    await runMigrations(driverOnlyUser);
    const sessionOnlyUser = createFarmDbSession(driverOnlyUser, {
      autoSeedDefaultAdmin: false,
    });
    const soleDelegate = await sessionOnlyUser.network.signUpAccount({
      displayName: 'Solo Delegate',
      role: 'family_member',
      accessCode: '4444',
      avatarKey: 'farmer',
      isPrimaryAdmin: false,
      canManageNetwork: true,
      canSyncCloud: false,
      status: 'active',
      permissions: buildStandardUserPermissions(),
    });
    await sessionOnlyUser.network.switchActiveAccount(soleDelegate.id, '4444');
    await sessionOnlyUser.network.removeAccount(soleDelegate.id);
    expect(await sessionOnlyUser.network.listAccounts()).toEqual([]);
    expect(await sessionOnlyUser.network.getActiveAccount()).toBeNull();
    rawOnlyUser.close();

    raw.close();
  });

  it('allows deleting both Admin and User accounts (including Primary Admin promotion, self-delete, and credentialed portal delete)', async () => {
    const { driver, raw } = createNodeSqliteDriver(':memory:');
    await runMigrations(driver);
    const session = createFarmDbSession(driver, { autoSeedDefaultAdmin: false });

    const primaryAdmin = await session.network.signUpAccount({
      displayName: 'Alpha Homestead',
      role: 'admin',
      accessCode: '1111',
      avatarKey: 'farmer',
      isPrimaryAdmin: true,
      canManageNetwork: true,
      canSyncCloud: true,
      status: 'active',
      permissions: getDefaultPermissionsForRole('admin'),
    });
    const secondaryAdmin = await session.network.signUpAccount({
      displayName: 'Beta Admin',
      role: 'admin',
      accessCode: '2222',
      avatarKey: 'farmerFemale',
      isPrimaryAdmin: false,
      canManageNetwork: true,
      canSyncCloud: true,
      status: 'active',
      permissions: getDefaultPermissionsForRole('admin'),
    });
    const userOne = await session.network.signUpAccount({
      displayName: 'Martha Member',
      role: 'family_member',
      accessCode: '3333',
      avatarKey: 'farmerFemale',
      isPrimaryAdmin: false,
      canManageNetwork: false,
      canSyncCloud: false,
      status: 'active',
      permissions: buildStandardUserPermissions(),
    });
    const userTwo = await session.network.signUpAccount({
      displayName: 'Samuel Helper',
      role: 'staff_viewer',
      accessCode: '4444',
      avatarKey: 'farmer',
      isPrimaryAdmin: false,
      canManageNetwork: false,
      canSyncCloud: false,
      status: 'active',
      permissions: buildStandardUserPermissions(),
    });

    // Standard User cannot delete another member's account, but can delete their own account
    await session.network.switchActiveAccount(userOne.id, '3333');
    await expect(session.network.removeAccount(userTwo.id)).rejects.toThrow(
      /permission/i
    );
    await expect(session.network.removeAccount(userOne.id)).resolves.toBe(true);

    // Primary Admin can delete a regular User account
    await session.network.switchActiveAccount(primaryAdmin.id, '1111');
    await expect(session.network.removeAccount(userTwo.id)).resolves.toBe(true);

    // Deleting Primary Admin while another Admin remains promotes the remaining Admin
    await expect(session.network.removeAccount(primaryAdmin.id)).resolves.toBe(true);
    const promoted = await session.network.getAccountById(secondaryAdmin.id);
    expect(promoted?.isPrimaryAdmin).toBe(true);
    expect((await session.network.getActiveAccount())?.id).toBe(secondaryAdmin.id);

    // Credentialed delete from Auth Portal validates PIN before deleting the remaining Admin
    await expect(
      session.network.removeAccountWithCredentials(secondaryAdmin.id, '0000')
    ).rejects.toThrow(/PIN|passcode/i);
    await expect(
      session.network.removeAccountWithCredentials(secondaryAdmin.id, '2222')
    ).resolves.toBe(true);

    expect(await session.network.listAccounts()).toEqual([]);
    expect(await session.network.getActiveAccount()).toBeNull();

    // Deleting a PIN-less Admin via portal credentials also succeeds cleanly
    const pinlessAdmin = await session.network.signUpAccount({
      displayName: 'Open Homestead',
      role: 'admin',
      accessCode: null,
      avatarKey: 'farmer',
      isPrimaryAdmin: true,
      canManageNetwork: true,
      canSyncCloud: true,
      status: 'active',
      permissions: getDefaultPermissionsForRole('admin'),
    });
    await expect(
      session.network.removeAccountWithCredentials(pinlessAdmin.id)
    ).resolves.toBe(true);
    expect(await session.network.listAccounts()).toEqual([]);

    raw.close();
  });

  it('allows a signed-in non-admin User to join an Admin cloud network via Full Cloud Key without RBAC errors and rejects revoked keys before pulling data', async () => {
    const { driver: adminDriver, raw: adminRaw } = createNodeSqliteDriver(':memory:');
    await runMigrations(adminDriver);
    const adminSession = createFarmDbSession(adminDriver, {
      autoSeedDefaultAdmin: false,
    });
    const admin = await adminSession.network.signUpAccount({
      displayName: 'Homestead Farm',
      role: 'admin',
      accessCode: '9999',
      avatarKey: 'farmer',
      isPrimaryAdmin: true,
      canManageNetwork: true,
      canSyncCloud: true,
      status: 'active',
      permissions: getDefaultPermissionsForRole('admin'),
    });
    await adminSession.network.switchActiveAccount(admin.id, '9999');
    await adminSession.settings.update({
      farmName: 'Sunrise Dairy',
      networkJoinKey: 'FARM-9988',
      supabaseUrl: 'https://join-test.supabase.co',
      supabaseAnonKey: 'sb_publishable_join_test',
      cloudWorkspaceId: 'ws-sunrise-1',
    });
    await adminSession.livestock.create({
      species: 'cow',
      sex: 'female',
      tagNumber: 'ADMIN-COW-1',
      name: 'Buttercup',
    });
    const cloudSnapshot = await adminSession.backup.exportSnapshot();
    adminRaw.close();

    const { driver, raw } = createNodeSqliteDriver(':memory:');
    await runMigrations(driver);
    const session = createFarmDbSession(driver, { autoSeedDefaultAdmin: false });
    const megan = await session.network.signUpAccount({
      displayName: 'Megan',
      role: 'family_member',
      accessCode: '1234',
      avatarKey: 'farmerFemale',
      isPrimaryAdmin: false,
      canManageNetwork: false,
      canSyncCloud: false,
      status: 'active',
      permissions: buildStandardUserPermissions(),
    });
    await session.network.switchActiveAccount(megan.id, '1234');

    const pushedBodies: Array<{ snapshot?: { farmAccounts?: Array<{ id: string; status: string; displayName: string }> } }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: unknown, init?: { method?: string; body?: string }) => {
      if ((init?.method ?? 'GET') === 'POST' && init?.body) {
        const parsedBody = JSON.parse(init.body) as Array<{ snapshot?: { farmAccounts?: Array<{ id: string; status: string; displayName: string }> } }>;
        if (parsedBody[0]) {
          pushedBodies.push(parsedBody[0]);
        }
        return new Response('', { status: 201 });
      }
      return new Response(
        JSON.stringify([
          {
            workspace_id: 'ws-sunrise-1',
            farm_name: 'Sunrise Dairy',
            snapshot: cloudSnapshot,
            updated_at: '2026-11-19T12:00:00Z',
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    try {
      const revokedKey = encodeFarmNetworkJoinKey({
        joinCode: 'FARM-0000',
        workspaceId: 'ws-sunrise-1',
        farmName: 'Sunrise Dairy',
        supabaseUrl: 'https://join-test.supabase.co',
        supabaseAnonKey: 'sb_publishable_join_test',
      });
      await expect(
        session.network.joinNetworkWithKey({
          joinKey: revokedKey,
          accountId: megan.id,
        })
      ).rejects.toThrow(/rotated or revoked/i);
      expect(await session.livestock.list()).toEqual([]);

      const validFullKey = encodeFarmNetworkJoinKey({
        joinCode: 'FARM-9988',
        workspaceId: 'ws-sunrise-1',
        farmName: 'Sunrise Dairy',
        supabaseUrl: 'https://join-test.supabase.co',
        supabaseAnonKey: 'sb_publishable_join_test',
      });
      const joinRes = await session.network.joinNetworkWithKey({
        joinKey: validFullKey,
        accountId: megan.id,
      });

      expect(joinRes.syncedWithCloud).toBe(true);
      expect(joinRes.farmName).toBe('Sunrise Dairy');
      expect(joinRes.account.status).toBe('pending');
      expect(joinRes.account.canSyncCloud).toBe(true);
      expect(joinRes.account.canManageNetwork).toBe(false);
      expect(joinRes.account.permissions).toEqual(
        getDefaultPermissionsForRole('family_member')
      );
      expect(
        pushedBodies.some((payload) =>
          (payload.snapshot?.farmAccounts ?? []).some(
            (a) => a.id === megan.id && a.status === 'pending'
          )
        )
      ).toBe(true);

      // Device-local isolation: joined user's Sign-In Portal never exposes remote Admin accounts
      const localSignInAccounts = await session.network.listLocalSignInAccounts();
      expect(localSignInAccounts.map((a) => a.id)).toEqual([megan.id]);
      await expect(session.network.switchActiveAccount(admin.id)).rejects.toThrow(
        /another device/i
      );
      await expect(
        session.network.removeAccountWithCredentials(admin.id)
      ).rejects.toThrow(/created or recovered on this device/i);
      expect((await session.network.getActiveAccount())?.id).toBe(megan.id);

      // Member Leave Network removes member from Supabase without deleting Admin records
      // and restores standalone offline local mode cleanly.
      const leaveRes = await session.network.leaveNetwork(megan.id);
      expect(leaveRes).toEqual({
        leftFarmName: 'Sunrise Dairy',
        mode: 'disconnected_standalone',
        syncedWithCloud: true,
      });

      const lastPosted = pushedBodies[pushedBodies.length - 1];
      expect(
        lastPosted?.snapshot?.farmAccounts?.some((a) => a.id === admin.id)
      ).toBe(true);
      expect(
        lastPosted?.snapshot?.farmAccounts?.some((a) => a.id === megan.id)
      ).toBe(false);

      expect(await session.livestock.list()).toEqual([]);
      expect((await session.network.listAccountsRaw()).map((a) => a.id)).toEqual([
        megan.id,
      ]);
      const standaloneMegan = await session.network.getActiveAccount();
      expect(standaloneMegan?.id).toBe(megan.id);
      expect(standaloneMegan?.status).toBe('active');
      expect(standaloneMegan?.canSyncCloud).toBe(false);
      const afterLeaveSettings = await session.settings.get();
      expect(afterLeaveSettings.cloudSyncEnabled).toBe(false);
      expect(afterLeaveSettings.supabaseUrl).toBe('');
      expect(afterLeaveSettings.supabaseAnonKey).toBe('');
    } finally {
      globalThis.fetch = originalFetch;
    }

    raw.close();
  });

  it('allows renaming Primary Admin accounts and formats nested SQLite driver errors cleanly', async () => {
    const { driver, raw } = createNodeSqliteDriver(':memory:');
    await runMigrations(driver);
    const session = createFarmDbSession(driver, { autoSeedDefaultAdmin: false });

    const admin = await session.network.signUpAccount({
      displayName: 'Farm Owner (Administrator)',
      role: 'admin',
      accessCode: '1234',
      avatarKey: 'farmer',
      isPrimaryAdmin: true,
      canManageNetwork: true,
      canSyncCloud: true,
      status: 'active',
      permissions: getDefaultPermissionsForRole('admin'),
    });
    await session.network.switchActiveAccount(admin.id, '1234');

    const renamed = await session.network.updateAccount(admin.id, {
      displayName: 'Greenfields Owner',
    });
    expect(renamed.displayName).toBe('Greenfields Owner');
    expect(renamed.isPrimaryAdmin).toBe(true);
    expect(renamed.role).toBe('admin');

    const nestedErr = new Error('Failed query: insert into "livestock" ...', {
      cause: new Error(
        'error returned from database: (code: 8) attempt to write a readonly database'
      ),
    });
    expect(extractDatabaseErrorCause(nestedErr)).toContain(
      'attempt to write a readonly database'
    );
    const friendly = formatFriendlyDatabaseError(nestedErr);
    expect(friendly.message).toMatch(/read-only/i);
    expect(friendly.message).not.toContain('Failed query:');

    raw.close();
  });

  it('detects and prevents duplicate entries across all farm modules while allowing distinct records', async () => {
    const { driver, raw } = createNodeSqliteDriver(':memory:');
    await runMigrations(driver);
    const session = createFarmDbSession(driver);

    // 1. Livestock (same species + sex + name + dob even with a different tag number)
    const cow = await session.livestock.create({
      species: 'cow',
      sex: 'female',
      tagNumber: 'DUP-101',
      name: 'Nairobi',
      breed: 'Boran',
      dob: '2024-04-12',
    });
    await expect(
      session.livestock.create({
        species: 'cow',
        sex: 'female',
        tagNumber: 'DUP-102',
        name: ' nairobi ',
        breed: 'Boran',
        dob: '2024-04-12',
      })
    ).rejects.toThrow(/already exists/i);
    await expect(
      session.livestock.create({
        species: 'cow',
        sex: 'female',
        tagNumber: 'DUP-103',
        name: 'Kampala',
        breed: 'Boran',
        dob: '2024-04-12',
      })
    ).resolves.toMatchObject({ tagNumber: 'DUP-103' });

    // 2. Milk Production
    await session.production.create({
      livestockId: cow.id,
      date: '2026-11-18',
      yieldAmount: 14.5,
      qualityNotes: 'Morning milking',
    });
    await expect(
      session.production.create({
        livestockId: cow.id,
        date: '2026-11-18',
        yieldAmount: 14.5,
        qualityNotes: ' morning   milking ',
      })
    ).rejects.toThrow(/duplicate/i);
    await expect(
      session.production.create({
        livestockId: cow.id,
        date: '2026-11-18',
        yieldAmount: 11.2,
        qualityNotes: 'Evening milking',
      })
    ).resolves.toMatchObject({ record: { yieldAmount: 11.2 } });

    // 3. Medical History
    await session.medical.create({
      livestockId: cow.id,
      date: '2026-11-18',
      condition: 'Routine Deworming',
      treatment: 'Albendazole 10%',
      veterinarian: 'Dr. Okello',
      cost: 12,
    });
    await expect(
      session.medical.create({
        livestockId: cow.id,
        date: '2026-11-18',
        condition: 'routine deworming',
        treatment: 'albendazole  10%',
        veterinarian: 'Dr. Okello',
        cost: 12,
      })
    ).rejects.toThrow(/duplicate/i);
    await expect(
      session.medical.create({
        livestockId: cow.id,
        date: '2026-11-18',
        condition: 'Foot Trimming',
        treatment: 'Copper sulfate wash',
        cost: 8,
      })
    ).resolves.toMatchObject({ record: { condition: 'Foot Trimming' } });

    // 4. Financial Ledger
    await session.financial.create({
      transactionType: 'expense',
      category: 'feed',
      amount: 150,
      date: '2026-11-18',
      livestockId: cow.id,
      notes: 'Dairy meal bags',
    });
    await expect(
      session.financial.create({
        transactionType: 'expense',
        category: 'feed',
        amount: 150,
        date: '2026-11-18',
        livestockId: cow.id,
        notes: ' dairy meal   bags ',
      })
    ).rejects.toThrow(/duplicate/i);
    await expect(
      session.financial.create({
        transactionType: 'expense',
        category: 'feed',
        amount: 200,
        date: '2026-11-18',
        livestockId: cow.id,
        notes: 'Extra mineral lick',
      })
    ).resolves.toMatchObject({ amount: 200 });

    // 5. Alerts & Notes
    await session.alerts.create({
      entryKind: 'alert',
      title: 'Booster shot due',
      triggerDate: '2026-11-25',
      livestockId: cow.id,
    });
    await expect(
      session.alerts.create({
        entryKind: 'alert',
        title: '  booster shot due ',
        triggerDate: '2026-11-25',
        livestockId: cow.id,
      })
    ).rejects.toThrow(/duplicate/i);
    await expect(
      session.alerts.create({
        entryKind: 'note',
        title: 'Booster shot due',
        livestockId: cow.id,
      })
    ).resolves.toMatchObject({ entryKind: 'note' });

    // 6. HR Workers, Payments, and Tasks
    const worker = await session.hr.createWorker({
      name: 'Samuel Kiptoo',
      role: 'Lead Herdsman',
      phone: '+256 700 112233',
      salaryAmount: 350,
      payFrequency: 'monthly',
      nextPaymentDueDate: '2026-11-30',
    });
    await expect(
      session.hr.createWorker({
        name: ' samuel kiptoo ',
        role: 'lead herdsman',
        phone: '+256 700 112233',
        salaryAmount: 350,
        payFrequency: 'monthly',
        nextPaymentDueDate: '2026-11-30',
      })
    ).rejects.toThrow(/already exists/i);
    await expect(
      session.hr.createWorker({
        name: 'Miriam Nabirye',
        role: 'Milk Collector',
        salaryAmount: 280,
        payFrequency: 'monthly',
        nextPaymentDueDate: '2026-11-30',
      })
    ).resolves.toMatchObject({ name: 'Miriam Nabirye' });

    await session.hr.createPayment({
      workerId: worker.id,
      dueDate: '2026-11-30',
      amount: 350,
      periodLabel: 'Nov 2026 Payroll',
    });
    await expect(
      session.hr.createPayment({
        workerId: worker.id,
        dueDate: '2026-11-30',
        amount: 350,
        periodLabel: 'nov 2026 payroll',
      })
    ).rejects.toThrow(/duplicate/i);
    await expect(
      session.hr.createPayment({
        workerId: worker.id,
        dueDate: '2026-12-30',
        amount: 350,
        periodLabel: 'Dec 2026 Payroll',
      })
    ).resolves.toMatchObject({ payment: { dueDate: '2026-12-30' } });

    await session.hr.createTask({
      workerId: worker.id,
      title: 'Inspect paddock fencing',
      dueDate: '2026-11-22',
      priority: 'high',
    });
    await expect(
      session.hr.createTask({
        workerId: worker.id,
        title: ' inspect paddock  fencing ',
        dueDate: '2026-11-22',
        priority: 'medium',
      })
    ).rejects.toThrow(/duplicate/i);
    await expect(
      session.hr.createTask({
        workerId: worker.id,
        title: 'Clean calf shed',
        dueDate: '2026-11-22',
        priority: 'medium',
      })
    ).resolves.toMatchObject({ title: 'Clean calf shed' });

    // 7. Animal Ownerships
    await session.ownerships.create({
      livestockId: cow.id,
      ownerName: 'Martha Mukasa',
      ownershipCategory: 'co_owned',
      sharePercentage: 50,
      startDate: '2026-11-01',
    });
    await expect(
      session.ownerships.create({
        livestockId: cow.id,
        ownerName: ' martha mukasa ',
        ownershipCategory: 'co_owned',
        sharePercentage: 50,
        startDate: '2026-11-01',
      })
    ).rejects.toThrow(/duplicate/i);
    await expect(
      session.ownerships.create({
        livestockId: cow.id,
        ownerName: 'Daniel Mukasa',
        ownershipCategory: 'co_owned',
        sharePercentage: 50,
        startDate: '2026-11-01',
      })
    ).resolves.toMatchObject({ ownerName: 'Daniel Mukasa' });

    // 8. Farm Network Accounts (same name + role and duplicate email)
    await session.network.createAccount({
      displayName: 'Grace Helper',
      role: 'family_member',
      email: 'grace@greenfields.farm',
      accessCode: '4321',
    });
    await expect(
      session.network.createAccount({
        displayName: ' grace helper ',
        role: 'family_member',
        accessCode: '5678',
      })
    ).rejects.toThrow(/same role already exists/i);
    await expect(
      session.network.createAccount({
        displayName: 'Grace Two',
        role: 'staff_viewer',
        email: 'GRACE@greenfields.farm',
        accessCode: '5678',
      })
    ).rejects.toThrow(/already assigned/i);

    raw.close();
  });
});
