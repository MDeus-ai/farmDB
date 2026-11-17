import { describe, expect, it } from 'vitest';
import {
  buildStandardUserPermissions,
  canAccountDeleteInModule,
  canAccountEditModule,
  canAccountViewModule,
  computeOwnershipSummary,
  decodeFarmNetworkJoinKey,
  DEFAULT_ADMIN_ACCOUNT,
  DEFAULT_FARM_SETTINGS,
  encodeFarmNetworkJoinKey,
  generateShortJoinCode,
  generateSupabaseSetupSql,
  getDefaultPermissionsForRole,
  isAdminAccount,
  mergeFarmSnapshots,
  normalizeSupabaseBaseUrl,
  validateFarmSettings,
  validateNewAnimalOwnership,
  validateNewFarmAccount,
  type AnimalOwnership,
  type FarmAccount,
  type FarmDbSnapshot,
} from '../src/index';

describe('@farmdb/core ownerships, farm network & cloud sync', () => {
  it('validates animal ownerships and computes ownership summary', () => {
    const valid = validateNewAnimalOwnership({
      livestockId: 'l1',
      ownerName: '  Isaac Mugisha  ',
      ownershipCategory: 'external_boarded',
      sharePercentage: 100,
      purpose: 'Pasture boarding & breeding supervision',
      startDate: '2026-11-01',
      expectedEndDate: '2026-12-15',
      boardingFee: 120.5,
    });
    expect(valid.ok).toBe(true);
    expect(valid.data?.ownerName).toBe('Isaac Mugisha');
    expect(valid.data?.boardingFee).toBe(120.5);

    const invalid = validateNewAnimalOwnership({
      livestockId: '',
      ownerName: '',
      sharePercentage: 150,
      boardingFee: -10,
      startDate: 'bad-date',
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.errors.livestockId).toBeDefined();
    expect(invalid.errors.ownerName).toBeDefined();
    expect(invalid.errors.sharePercentage).toBeDefined();
    expect(invalid.errors.boardingFee).toBeDefined();
    expect(invalid.errors.startDate).toBeDefined();

    const rows: AnimalOwnership[] = [
      {
        id: 'o1',
        livestockId: 'l1',
        ownerName: 'Isaac Mugisha',
        ownerContact: '+256 700 111222',
        accountId: 'acc-1',
        ownershipCategory: 'external_boarded',
        sharePercentage: 100,
        purpose: 'Dairy boarding',
        startDate: '2026-11-01',
        expectedEndDate: null,
        boardingFee: 150,
        status: 'active',
        notes: null,
        createdAt: 100,
        updatedAt: 100,
      },
      {
        id: 'o2',
        livestockId: 'l2',
        ownerName: 'Sarah Kato',
        ownerContact: null,
        accountId: null,
        ownershipCategory: 'sold_retained',
        sharePercentage: 100,
        purpose: 'Sold pending truck pickup',
        startDate: '2026-11-10',
        expectedEndDate: '2026-11-25',
        boardingFee: 45,
        status: 'active',
        notes: null,
        createdAt: 200,
        updatedAt: 200,
      },
    ];

    const summary = computeOwnershipSummary(rows);
    expect(summary.activeRecords).toBe(2);
    expect(summary.externalBoardedCount).toBe(1);
    expect(summary.soldRetainedCount).toBe(1);
    expect(summary.activeNonFarmOwnedCount).toBe(2);
    expect(summary.activeBoardingFeeTotal).toBe(195);
    expect(summary.distinctOwnerCount).toBe(2);
  });

  it('enforces role privileges for Farm Network accounts and validates Supabase settings', () => {
    expect(canAccountViewModule(DEFAULT_ADMIN_ACCOUNT, 'financial')).toBe(true);
    expect(canAccountDeleteInModule(DEFAULT_ADMIN_ACCOUNT, 'settings')).toBe(true);

    const validatedAcc = validateNewFarmAccount({
      displayName: 'Grace Family',
      email: 'grace@homestead.farm',
      role: 'family_member',
      relationship: 'Sister',
    });
    expect(validatedAcc.ok).toBe(true);
    const familyAccount: FarmAccount = {
      id: 'acc-fam',
      displayName: validatedAcc.data!.displayName,
      email: validatedAcc.data!.email,
      phone: null,
      role: 'family_member',
      relationship: 'Sister',
      avatarKey: 'farmerFemale',
      accessCode: null,
      isPrimaryAdmin: false,
      canManageNetwork: false,
      canSyncCloud: true,
      permissions: getDefaultPermissionsForRole('family_member'),
      status: 'active',
      lastSyncedAt: null,
      createdAt: 1,
      updatedAt: 1,
    };

    expect(isAdminAccount(DEFAULT_ADMIN_ACCOUNT)).toBe(true);
    expect(canAccountViewModule(DEFAULT_ADMIN_ACCOUNT, 'network')).toBe(true);
    expect(canAccountViewModule(DEFAULT_ADMIN_ACCOUNT, 'backup')).toBe(true);
    expect(canAccountEditModule(familyAccount, 'livestock')).toBe(true);
    expect(canAccountViewModule(familyAccount, 'financial')).toBe(true);
    expect(canAccountEditModule(familyAccount, 'financial')).toBe(false);
    expect(isAdminAccount(familyAccount)).toBe(false);
    expect(canAccountViewModule(familyAccount, 'network')).toBe(false);
    expect(canAccountViewModule(familyAccount, 'backup')).toBe(true);
    expect(canAccountViewModule(familyAccount, 'settings')).toBe(true);

    const standardUserPerms = buildStandardUserPermissions();
    const standaloneUser: FarmAccount = {
      ...familyAccount,
      id: 'acc-std-user',
      canSyncCloud: false,
      permissions: standardUserPerms,
    };
    expect(canAccountViewModule(standaloneUser, 'network')).toBe(false);
    expect(canAccountViewModule(standaloneUser, 'backup')).toBe(true);
    expect(canAccountEditModule(standaloneUser, 'backup')).toBe(true);
    expect(canAccountEditModule(standaloneUser, 'financial')).toBe(true);
    expect(canAccountEditModule(standaloneUser, 'settings')).toBe(true);

    // Pending account cannot view or edit any farm data modules until approved by Admin
    const pendingAccount: FarmAccount = { ...familyAccount, status: 'pending' };
    expect(canAccountViewModule(pendingAccount, 'livestock')).toBe(false);
    expect(canAccountViewModule(pendingAccount, 'network')).toBe(false);
    expect(canAccountEditModule(pendingAccount, 'livestock')).toBe(false);

    // Join key generation, encoding & decoding
    const code = generateShortJoinCode();
    expect(code).toMatch(/^FARM-[A-Z0-9]{4}$/);
    const fullKey = encodeFarmNetworkJoinKey({
      joinCode: code,
      workspaceId: 'oak-ridge-dairy',
      farmName: 'Oak Ridge Homestead',
      supabaseUrl: 'https://demo.supabase.co/rest/v1',
      supabaseAnonKey: 'sb_publishable_demo_key_123',
    });
    expect(fullKey.startsWith('FDB1:')).toBe(true);
    const decodedFull = decodeFarmNetworkJoinKey(fullKey);
    expect(decodedFull).toEqual({
      kind: 'full',
      joinCode: code,
      workspaceId: 'oak-ridge-dairy',
      farmName: 'Oak Ridge Homestead',
      supabaseUrl: 'https://demo.supabase.co',
      supabaseAnonKey: 'sb_publishable_demo_key_123',
    });
    expect(decodeFarmNetworkJoinKey('farm-7842')).toEqual({
      kind: 'short',
      joinCode: 'FARM-7842',
    });

    const badSettings = validateFarmSettings({
      supabaseUrl: 'not-a-url',
      cloudSyncIntervalSeconds: 5,
    });
    expect(badSettings.ok).toBe(false);
    expect(badSettings.errors.supabaseUrl).toBeDefined();
    expect(badSettings.errors.cloudSyncIntervalSeconds).toBeDefined();

    const goodSettings = validateFarmSettings({
      cloudSyncEnabled: true,
      supabaseUrl: 'https://demo.supabase.co/rest/v1/',
      supabaseAnonKey: 'sb_publishable_demo_key_123',
      cloudWorkspaceId: 'oak-ridge-dairy',
    });
    expect(goodSettings.ok).toBe(true);
    expect(goodSettings.data?.supabaseUrl).toBe('https://demo.supabase.co');
    expect(
      normalizeSupabaseBaseUrl('https://kugzynvgeyjzwqzcyjgg.supabase.co/rest/v1')
    ).toBe('https://kugzynvgeyjzwqzcyjgg.supabase.co');
    expect(generateSupabaseSetupSql()).toContain('farmdb_cloud_snapshots');
  });

  it('merges local and remote snapshots cleanly using last_write_wins', () => {
    const baseLocal: FarmDbSnapshot = {
      version: 1,
      app: 'farmDB',
      exportedAt: '2026-11-17T00:00:00Z',
      settings: { ...DEFAULT_FARM_SETTINGS, farmName: 'Local Homestead' },
      livestock: [
        {
          id: 'c1',
          species: 'cow',
          tagNumber: 'COW-1',
          name: 'Local Older',
          breed: null,
          dob: null,
          imageUri: null,
          sireId: null,
          damId: null,
          status: 'active',
          createdAt: 10,
          updatedAt: 100,
        },
      ],
      productRecords: [],
      medicalRecords: [],
      financialLogs: [],
      alerts: [],
      animalOwnerships: [],
      farmAccounts: [DEFAULT_ADMIN_ACCOUNT],
    };

    const remote: FarmDbSnapshot = {
      ...baseLocal,
      livestock: [
        {
          ...baseLocal.livestock[0]!,
          name: 'Cloud Newer',
          updatedAt: 500,
        },
        {
          id: 'd2',
          species: 'duck',
          tagNumber: 'DUCK-9',
          name: 'Puddles',
          breed: 'Pekin',
          dob: null,
          imageUri: null,
          sireId: null,
          damId: null,
          status: 'active',
          createdAt: 400,
          updatedAt: 400,
        },
      ],
    };

    const merged = mergeFarmSnapshots(baseLocal, remote, 'last_write_wins');
    expect(merged.recordsPulled).toBe(2);
    expect(merged.merged.livestock).toHaveLength(2);
    expect(
      merged.merged.livestock.find((a) => a.id === 'c1')?.name
    ).toBe('Cloud Newer');
  });
});
