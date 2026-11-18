import { and, desc, eq, or, sql, type SQL } from 'drizzle-orm';
import {
  decodeFarmNetworkJoinKey,
  DEFAULT_ADMIN_ACCOUNT,
  generateId,
  generateShortJoinCode,
  isAdminAccount,
  mergeFarmSnapshots,
  normalizeAccountPermissions,
  normalizeSupabaseBaseUrl,
  parseFarmSnapshotJson,
  validateNewFarmAccount,
  validateUpdateFarmAccount,
  type CloudSyncDirection,
  type CloudSyncLog,
  type CloudSyncStatus,
  type FarmAccount,
  type FarmAccountAvatar,
  type FarmAccountFilter,
  type FarmAccountPermissions,
  type FarmAccountRole,
  type FarmAccountStatus,
  type FarmDbSnapshot,
  type NewFarmAccountInput,
  type UpdateFarmAccountInput,
  type ValidationErrors,
} from '@farmdb/core';
import type { FarmDrizzleDb } from '../driver';
import type { DatabaseEventBus } from '../events';
import { cloudSyncLogs, farmAccounts } from '../schema';
import type {
  RestoreSnapshotOptions,
  RestoreSnapshotResult,
} from './backupRepository';
import type { SettingsRepository } from './settingsRepository';

export class NetworkValidationError extends Error {
  readonly errors: ValidationErrors<Record<string, unknown>>;

  constructor(
    errors: ValidationErrors<Record<string, unknown>>,
    message = 'Farm Network account validation failed.'
  ) {
    super(message);
    this.name = 'NetworkValidationError';
    this.errors = errors;
  }
}

export class FarmAccountNotFoundError extends Error {
  constructor(id: string) {
    super(`Farm account "${id}" was not found.`);
    this.name = 'FarmAccountNotFoundError';
  }
}

export interface CloudSyncResult {
  ok: boolean;
  direction: CloudSyncDirection;
  status: CloudSyncStatus;
  recordsPushed: number;
  recordsPulled: number;
  message: string;
  log: CloudSyncLog;
}

type FarmAccountRow = typeof farmAccounts.$inferSelect;
type CloudSyncLogRow = typeof cloudSyncLogs.$inferSelect;

function parsePermissionsJson(
  raw: string,
  role: FarmAccountRole
): FarmAccountPermissions {
  try {
    const parsed = JSON.parse(raw) as Partial<FarmAccountPermissions>;
    return normalizeAccountPermissions(parsed, role);
  } catch {
    return normalizeAccountPermissions(undefined, role);
  }
}

function mapAccountRow(row: FarmAccountRow): FarmAccount {
  const role = row.role as FarmAccountRole;
  return {
    id: row.id,
    displayName: row.displayName,
    email: row.email ?? null,
    phone: row.phone ?? null,
    role,
    relationship: row.relationship ?? null,
    avatarKey: row.avatarKey as FarmAccountAvatar,
    accessCode: row.accessCode ?? null,
    supabaseUrl: row.supabaseUrl ?? null,
    supabaseAnonKey: row.supabaseAnonKey ?? null,
    cloudWorkspaceId: row.cloudWorkspaceId ?? null,
    isPrimaryAdmin: Boolean(row.isPrimaryAdmin),
    canManageNetwork: Boolean(row.canManageNetwork),
    canSyncCloud: Boolean(row.canSyncCloud),
    permissions: parsePermissionsJson(row.permissionsJson, role),
    status: row.status as FarmAccountStatus,
    onboardingCompleted: Boolean(row.onboardingCompleted),
    lastSyncedAt: row.lastSyncedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapSyncLogRow(row: CloudSyncLogRow): CloudSyncLog {
  return {
    id: row.id,
    direction: row.direction as CloudSyncDirection,
    status: row.status as CloudSyncStatus,
    recordsPushed: Number(row.recordsPushed),
    recordsPulled: Number(row.recordsPulled),
    summary: row.summary,
    createdAt: row.createdAt,
  };
}

function escapeLikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export interface JoinFarmNetworkInput {
  joinKey: string;
  accountId?: string;
  newAccount?: NewFarmAccountInput;
}

export interface JoinFarmNetworkResult {
  account: FarmAccount;
  syncedWithCloud: boolean;
  farmName: string;
}

export interface AcceptPendingAccountOptions {
  role?: FarmAccountRole;
  permissions?: Partial<FarmAccountPermissions>;
  canManageNetwork?: boolean;
  canSyncCloud?: boolean;
}

export interface RecoverAdminCloudInput {
  cloudKey?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  cloudWorkspaceId?: string;
  email?: string;
  accessCode?: string;
}

export interface RecoverAdminCloudResult {
  account: FarmAccount;
  farmName: string;
  recordsPulled: number;
}

export interface NetworkRepository {
  listAccounts(filter?: FarmAccountFilter): Promise<FarmAccount[]>;
  listAccountsRaw(): Promise<FarmAccount[]>;
  getAccountById(id: string): Promise<FarmAccount | null>;
  ensureAdminAccount(): Promise<FarmAccount>;
  getActiveAccount(): Promise<FarmAccount>;
  switchActiveAccount(
    accountId: string,
    accessCode?: string
  ): Promise<FarmAccount>;
  createAccount(input: NewFarmAccountInput): Promise<FarmAccount>;
  updateAccount(id: string, input: UpdateFarmAccountInput): Promise<FarmAccount>;
  removeAccount(id: string): Promise<boolean>;

  rotateNetworkJoinKey(): Promise<string>;
  joinNetworkWithKey(input: JoinFarmNetworkInput): Promise<JoinFarmNetworkResult>;
  recoverAdminFromCloud(
    input: RecoverAdminCloudInput
  ): Promise<RecoverAdminCloudResult>;
  acceptPendingAccount(
    accountId: string,
    options?: AcceptPendingAccountOptions
  ): Promise<FarmAccount>;

  listSyncLogs(limit?: number): Promise<CloudSyncLog[]>;
  clearSyncLogs(): Promise<void>;
  syncWithSupabase(direction: CloudSyncDirection): Promise<CloudSyncResult>;
}

export interface NetworkBackupBridge {
  exportSnapshot(): Promise<FarmDbSnapshot>;
  restoreSnapshot(
    snapshot: FarmDbSnapshot,
    options?: RestoreSnapshotOptions
  ): Promise<RestoreSnapshotResult>;
}

export function createNetworkRepository(
  db: FarmDrizzleDb,
  events: DatabaseEventBus,
  settingsRepo: SettingsRepository,
  getBackupBridge: () => NetworkBackupBridge,
  customFetch?: typeof fetch
): NetworkRepository {
  const resolveFetch = (): typeof fetch => customFetch ?? globalThis.fetch;
  let bypassSyncAccountGate = false;

  const createSupabaseFetcher = (anonKey: string) => {
    const fetchImpl = resolveFetch();
    const isPublishableKey = anonKey.startsWith('sb_publishable_');
    const baseHeaders: Record<string, string> = {
      apikey: anonKey,
      'Content-Type': 'application/json',
      ...(isPublishableKey ? {} : { Authorization: `Bearer ${anonKey}` }),
    };

    return async (
      url: string,
      init: RequestInit & { extraHeaders?: Record<string, string> }
    ) => {
      const res = await fetchImpl(url, {
        ...init,
        headers: {
          ...baseHeaders,
          ...(init.extraHeaders ?? {}),
        },
      });
      if (res.status === 401 && isPublishableKey) {
        return fetchImpl(url, {
          ...init,
          headers: {
            ...baseHeaders,
            Authorization: `Bearer ${anonKey}`,
            ...(init.extraHeaders ?? {}),
          },
        });
      }
      return res;
    };
  };

  async function applyAdminCloudCredentialsIfEmpty(
    account: FarmAccount
  ): Promise<void> {
    if (!isAdminAccount(account)) {
      return;
    }
    const accUrl = account.supabaseUrl
      ? normalizeSupabaseBaseUrl(account.supabaseUrl)
      : '';
    const accKey = account.supabaseAnonKey?.trim() ?? '';
    if (!accUrl || !accKey) {
      return;
    }
    const currentSettings = await settingsRepo.get();
    if (
      !currentSettings.supabaseUrl.trim() ||
      !currentSettings.supabaseAnonKey.trim()
    ) {
      await settingsRepo.update({
        supabaseUrl: accUrl,
        supabaseAnonKey: accKey,
        cloudWorkspaceId:
          account.cloudWorkspaceId?.trim() ||
          currentSettings.cloudWorkspaceId ||
          'farmdb-homestead-main',
        cloudSyncEnabled: true,
      });
    }
  }

  async function appendSyncLog(input: {
    direction: CloudSyncDirection;
    status: CloudSyncStatus;
    recordsPushed: number;
    recordsPulled: number;
    summary: string;
  }): Promise<CloudSyncLog> {
    const now = Date.now();
    const entry: typeof cloudSyncLogs.$inferInsert = {
      id: generateId(),
      direction: input.direction,
      status: input.status,
      recordsPushed: input.recordsPushed,
      recordsPulled: input.recordsPulled,
      summary: input.summary,
      createdAt: now,
    };
    await db.insert(cloudSyncLogs).values(entry).run();
    events.emit(['network']);
    return mapSyncLogRow(entry as CloudSyncLogRow);
  }

  return {
    async listAccountsRaw(): Promise<FarmAccount[]> {
      const rows = await db
        .select()
        .from(farmAccounts)
        .orderBy(desc(farmAccounts.isPrimaryAdmin), farmAccounts.displayName);
      return rows.map(mapAccountRow);
    },

    async listAccounts(filter?: FarmAccountFilter): Promise<FarmAccount[]> {
      await this.ensureAdminAccount();

      const conditions: SQL[] = [];
      if (filter?.role && filter.role !== 'all') {
        conditions.push(eq(farmAccounts.role, filter.role));
      }
      if (filter?.status && filter.status !== 'all') {
        conditions.push(eq(farmAccounts.status, filter.status));
      }

      const trimmedSearch = filter?.search?.trim();
      if (trimmedSearch) {
        const pattern = `%${escapeLikePattern(trimmedSearch.toLowerCase())}%`;
        const searchCond = or(
          sql`lower(${farmAccounts.displayName}) like ${pattern} escape '\\'`,
          sql`lower(coalesce(${farmAccounts.email}, '')) like ${pattern} escape '\\'`,
          sql`lower(coalesce(${farmAccounts.relationship}, '')) like ${pattern} escape '\\'`
        );
        if (searchCond) {
          conditions.push(searchCond);
        }
      }

      const query =
        conditions.length > 0
          ? db
              .select()
              .from(farmAccounts)
              .where(and(...conditions))
              .orderBy(desc(farmAccounts.isPrimaryAdmin), farmAccounts.displayName)
          : db
              .select()
              .from(farmAccounts)
              .orderBy(desc(farmAccounts.isPrimaryAdmin), farmAccounts.displayName);

      const rows = await query;
      return rows.map(mapAccountRow);
    },

    async getAccountById(id: string): Promise<FarmAccount | null> {
      const row = await db
        .select()
        .from(farmAccounts)
        .where(eq(farmAccounts.id, id))
        .get();
      return row ? mapAccountRow(row) : null;
    },

    async ensureAdminAccount(): Promise<FarmAccount> {
      const existingById = await this.getAccountById(DEFAULT_ADMIN_ACCOUNT.id);
      if (existingById) {
        return existingById;
      }

      const all = await this.listAccountsRaw();
      const existingAdmin = all.find((acc) => acc.isPrimaryAdmin);
      if (existingAdmin) {
        return existingAdmin;
      }

      const adminRow: typeof farmAccounts.$inferInsert = {
        id: DEFAULT_ADMIN_ACCOUNT.id,
        displayName: DEFAULT_ADMIN_ACCOUNT.displayName,
        email: DEFAULT_ADMIN_ACCOUNT.email,
        phone: DEFAULT_ADMIN_ACCOUNT.phone,
        role: 'admin',
        relationship: DEFAULT_ADMIN_ACCOUNT.relationship,
        avatarKey: DEFAULT_ADMIN_ACCOUNT.avatarKey,
        accessCode: DEFAULT_ADMIN_ACCOUNT.accessCode,
        supabaseUrl: DEFAULT_ADMIN_ACCOUNT.supabaseUrl ?? null,
        supabaseAnonKey: DEFAULT_ADMIN_ACCOUNT.supabaseAnonKey ?? null,
        cloudWorkspaceId: DEFAULT_ADMIN_ACCOUNT.cloudWorkspaceId ?? null,
        isPrimaryAdmin: true,
        canManageNetwork: true,
        canSyncCloud: true,
        permissionsJson: JSON.stringify(DEFAULT_ADMIN_ACCOUNT.permissions),
        status: 'active',
        onboardingCompleted: Boolean(DEFAULT_ADMIN_ACCOUNT.onboardingCompleted),
        lastSyncedAt: null,
        createdAt: 1,
        updatedAt: 1,
      };
      await db.insert(farmAccounts).values(adminRow).run();
      events.emit(['network'], adminRow.id);
      return mapAccountRow(adminRow as FarmAccountRow);
    },

    async getActiveAccount(): Promise<FarmAccount> {
      const admin = await this.ensureAdminAccount();
      const currentSettings = await settingsRepo.get();
      if (currentSettings.activeAccountId === admin.id) {
        return admin;
      }
      const found = await this.getAccountById(currentSettings.activeAccountId);
      if (found && found.status !== 'suspended') {
        return found;
      }
      await settingsRepo.update({ activeAccountId: admin.id });
      return admin;
    },

    async switchActiveAccount(
      accountId: string,
      accessCode?: string
    ): Promise<FarmAccount> {
      await this.ensureAdminAccount();
      const account = await this.getAccountById(accountId);
      if (!account) {
        throw new FarmAccountNotFoundError(accountId);
      }
      if (account.status === 'suspended' && !account.isPrimaryAdmin) {
        throw new NetworkValidationError(
          { status: 'This account is currently suspended by the administrator.' },
          'This account is currently suspended by the administrator.'
        );
      }
      if (!account.isPrimaryAdmin) {
        if (!account.accessCode || account.accessCode.trim().length === 0) {
          throw new NetworkValidationError(
            {
              accessCode:
                'This user account requires login credentials before it can be accessed.',
            },
            'This user account requires login credentials before it can be accessed.'
          );
        }
        if ((accessCode ?? '').trim() !== account.accessCode.trim()) {
          throw new NetworkValidationError(
            { accessCode: 'Incorrect access PIN / passcode for this account.' },
            'Incorrect access PIN / passcode for this account.'
          );
        }
      } else if (
        account.accessCode &&
        account.accessCode.trim().length > 0 &&
        (accessCode ?? '').trim() !== account.accessCode.trim()
      ) {
        throw new NetworkValidationError(
          { accessCode: 'Incorrect access PIN / passcode for this account.' },
          'Incorrect access PIN / passcode for this account.'
        );
      }
      await settingsRepo.update({ activeAccountId: account.id });
      await applyAdminCloudCredentialsIfEmpty(account);
      events.emit(['network', 'settings'], account.id);
      return account;
    },

    async createAccount(input: NewFarmAccountInput): Promise<FarmAccount> {
      await this.ensureAdminAccount();
      const validation = validateNewFarmAccount(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid farm account data.';
        throw new NetworkValidationError(
          validation.errors as ValidationErrors<Record<string, unknown>>,
          msg
        );
      }

      const now = Date.now();
      const id = validation.data.id || generateId();
      const isAdminRole =
        validation.data.isPrimaryAdmin || validation.data.role === 'admin';
      const record: typeof farmAccounts.$inferInsert = {
        id,
        displayName: validation.data.displayName,
        email: validation.data.email,
        phone: validation.data.phone,
        role: validation.data.role,
        relationship: validation.data.relationship,
        avatarKey: validation.data.avatarKey,
        accessCode: validation.data.accessCode,
        supabaseUrl: isAdminRole ? validation.data.supabaseUrl : null,
        supabaseAnonKey: isAdminRole ? validation.data.supabaseAnonKey : null,
        cloudWorkspaceId: isAdminRole ? validation.data.cloudWorkspaceId : null,
        isPrimaryAdmin: validation.data.isPrimaryAdmin,
        canManageNetwork: validation.data.canManageNetwork,
        canSyncCloud: validation.data.canSyncCloud,
        permissionsJson: JSON.stringify(validation.data.permissions),
        status: validation.data.status,
        onboardingCompleted: Boolean(validation.data.onboardingCompleted ?? false),
        lastSyncedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(farmAccounts).values(record).run();
      const createdAccount = mapAccountRow(record as FarmAccountRow);
      const currentSettings = await settingsRepo.get();
      if (isAdminRole && currentSettings.activeAccountId === createdAccount.id) {
        await applyAdminCloudCredentialsIfEmpty(createdAccount);
      }
      events.emit(['network'], id);
      return createdAccount;
    },

    async updateAccount(
      id: string,
      input: UpdateFarmAccountInput
    ): Promise<FarmAccount> {
      const existing = await this.getAccountById(id);
      if (!existing) {
        throw new FarmAccountNotFoundError(id);
      }

      const validation = validateUpdateFarmAccount(input, existing.role);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid account update.';
        throw new NetworkValidationError(
          validation.errors as ValidationErrors<Record<string, unknown>>,
          msg
        );
      }

      const currentActive = await this.getActiveAccount();
      const preserveExistingAccessCode =
        currentActive.id !== existing.id &&
        Boolean(existing.accessCode && existing.accessCode.trim().length > 0);

      const nextRole: FarmAccountRole = existing.isPrimaryAdmin
        ? 'admin'
        : validation.data.role ?? existing.role;
      const nextPermissions = existing.isPrimaryAdmin
        ? normalizeAccountPermissions(undefined, 'admin')
        : validation.data.permissions
          ? normalizeAccountPermissions(validation.data.permissions, nextRole)
          : existing.permissions;

      const nextCanManageNetwork = existing.isPrimaryAdmin
        ? true
        : validation.data.canManageNetwork ?? existing.canManageNetwork;
      const nextCanSyncCloud = existing.isPrimaryAdmin
        ? true
        : validation.data.canSyncCloud ?? existing.canSyncCloud;
      const nextStatus: FarmAccountStatus = existing.isPrimaryAdmin
        ? 'active'
        : validation.data.status ?? existing.status;

      const now = Date.now();
      await db
        .update(farmAccounts)
        .set({
          displayName: validation.data.displayName ?? existing.displayName,
          email:
            validation.data.email !== undefined
              ? validation.data.email
              : existing.email,
          phone:
            validation.data.phone !== undefined
              ? validation.data.phone
              : existing.phone,
          role: nextRole,
          relationship:
            validation.data.relationship !== undefined
              ? validation.data.relationship
              : existing.relationship,
          avatarKey: validation.data.avatarKey ?? existing.avatarKey,
          accessCode: preserveExistingAccessCode
            ? existing.accessCode
            : validation.data.accessCode !== undefined
              ? validation.data.accessCode
              : existing.accessCode,
          supabaseUrl:
            existing.isPrimaryAdmin || nextRole === 'admin'
              ? validation.data.supabaseUrl !== undefined
                ? validation.data.supabaseUrl
                : existing.supabaseUrl
              : null,
          supabaseAnonKey:
            existing.isPrimaryAdmin || nextRole === 'admin'
              ? validation.data.supabaseAnonKey !== undefined
                ? validation.data.supabaseAnonKey
                : existing.supabaseAnonKey
              : null,
          cloudWorkspaceId:
            existing.isPrimaryAdmin || nextRole === 'admin'
              ? validation.data.cloudWorkspaceId !== undefined
                ? validation.data.cloudWorkspaceId
                : existing.cloudWorkspaceId
              : null,
          canManageNetwork: nextCanManageNetwork,
          canSyncCloud: nextCanSyncCloud,
          permissionsJson: JSON.stringify(nextPermissions),
          status: nextStatus,
          onboardingCompleted:
            validation.data.onboardingCompleted !== undefined
              ? validation.data.onboardingCompleted
              : existing.onboardingCompleted,
          lastSyncedAt:
            validation.data.lastSyncedAt !== undefined
              ? validation.data.lastSyncedAt
              : existing.lastSyncedAt,
          updatedAt: now,
        })
        .where(eq(farmAccounts.id, id))
        .run();

      events.emit(['network'], id);

      const updated = await this.getAccountById(id);
      if (!updated) {
        throw new FarmAccountNotFoundError(id);
      }
      if (currentActive.id === updated.id) {
        await applyAdminCloudCredentialsIfEmpty(updated);
      }
      return updated;
    },

    async removeAccount(id: string): Promise<boolean> {
      const existing = await this.getAccountById(id);
      if (!existing) return false;
      if (existing.isPrimaryAdmin) {
        throw new NetworkValidationError(
          { isPrimaryAdmin: 'Primary Farm Owner (Admin) account cannot be deleted.' },
          'Primary Farm Owner (Admin) account cannot be deleted.'
        );
      }

      const currentSettings = await settingsRepo.get();
      if (currentSettings.activeAccountId === id) {
        await settingsRepo.update({
          activeAccountId: DEFAULT_ADMIN_ACCOUNT.id,
        });
      }

      await db.delete(farmAccounts).where(eq(farmAccounts.id, id)).run();
      events.emit(['network'], id);
      return true;
    },

    async rotateNetworkJoinKey(): Promise<string> {
      const nextCode = generateShortJoinCode();
      const currentSettings = await settingsRepo.get();
      await settingsRepo.update({ networkJoinKey: nextCode });
      if (
        currentSettings.cloudSyncEnabled &&
        currentSettings.supabaseUrl &&
        currentSettings.supabaseAnonKey
      ) {
        try {
          await this.syncWithSupabase('push');
        } catch {
          // Local key rotation still succeeds when offline.
        }
      }
      events.emit(['network', 'settings']);
      return nextCode;
    },

    async joinNetworkWithKey(
      input: JoinFarmNetworkInput
    ): Promise<JoinFarmNetworkResult> {
      const decoded = decodeFarmNetworkJoinKey(input.joinKey);
      if (!decoded) {
        throw new NetworkValidationError(
          { joinKey: 'Enter a valid Farm Network Join Key (FARM-XXXX or FDB1:...).' },
          'Enter a valid Farm Network Join Key (FARM-XXXX or FDB1:...).'
        );
      }

      let syncedWithCloud = false;
      if (
        decoded.kind === 'full' &&
        decoded.supabaseUrl &&
        decoded.supabaseAnonKey
      ) {
        await settingsRepo.update({
          cloudSyncEnabled: true,
          supabaseUrl: decoded.supabaseUrl,
          supabaseAnonKey: decoded.supabaseAnonKey,
          cloudWorkspaceId:
            decoded.workspaceId || 'farmdb-homestead-main',
          networkJoinKey: decoded.joinCode,
        });

        let pullRes: CloudSyncResult;
        try {
          bypassSyncAccountGate = true;
          pullRes = await this.syncWithSupabase('pull');
        } finally {
          bypassSyncAccountGate = false;
        }
        if (!pullRes.ok) {
          throw new NetworkValidationError(
            { joinKey: `Unable to reach the Admin's Supabase cloud workspace: ${pullRes.message}` },
            `Unable to reach the Admin's Supabase cloud workspace: ${pullRes.message}`
          );
        }
        const postPullSettings = await settingsRepo.get();
        if (
          pullRes.recordsPulled > 0 &&
          postPullSettings.networkJoinKey.trim().toUpperCase() !==
            decoded.joinCode.toUpperCase()
        ) {
          throw new NetworkValidationError(
            { joinKey: 'This Farm Network Join Key was rotated or revoked by the Admin. Request a new key.' },
            'This Farm Network Join Key was rotated or revoked by the Admin. Request a new key.'
          );
        }
        syncedWithCloud = true;
      } else {
        const currentSettings = await settingsRepo.get();
        if (
          decoded.joinCode.toUpperCase() !==
          currentSettings.networkJoinKey.trim().toUpperCase()
        ) {
          throw new NetworkValidationError(
            { joinKey: 'Invalid Farm Join Key. Ask your Farm Admin for the active code or full FDB1 key.' },
            'Invalid Farm Join Key. Ask your Farm Admin for the active code or full FDB1 key.'
          );
        }
      }

      await this.ensureAdminAccount();

      let targetAccount: FarmAccount;
      if (input.accountId) {
        const existing = await this.getAccountById(input.accountId);
        if (!existing) {
          throw new FarmAccountNotFoundError(input.accountId);
        }
        const isAdminJoining = existing.isPrimaryAdmin || existing.role === 'admin';
        targetAccount = await this.updateAccount(existing.id, {
          status: isAdminJoining ? 'active' : 'pending',
          canManageNetwork: isAdminJoining,
          canSyncCloud: true,
        });
      } else if (input.newAccount) {
        targetAccount = await this.createAccount({
          ...input.newAccount,
          isPrimaryAdmin: false,
          canManageNetwork: false,
          canSyncCloud: true,
          status: 'pending',
        });
      } else {
        throw new NetworkValidationError(
          { displayName: 'Provide user account details to join the Farm Network.' },
          'Provide user account details to join the Farm Network.'
        );
      }

      const finalSettings = await settingsRepo.update({
        activeAccountId: targetAccount.id,
      });

      if (finalSettings.supabaseUrl && finalSettings.supabaseAnonKey) {
        try {
          bypassSyncAccountGate = true;
          const pushRes = await this.syncWithSupabase('bidirectional');
          if (pushRes.ok) {
            syncedWithCloud = true;
          }
        } catch {
          // Leave pending account saved locally if offline during push.
        } finally {
          bypassSyncAccountGate = false;
        }
      }

      events.emit(['network', 'settings'], targetAccount.id);
      return {
        account: targetAccount,
        syncedWithCloud,
        farmName: finalSettings.farmName,
      };
    },

    async recoverAdminFromCloud(
      input: RecoverAdminCloudInput
    ): Promise<RecoverAdminCloudResult> {
      let baseUrl = '';
      let anonKey = '';
      let workspaceId =
        input.cloudWorkspaceId?.trim() || 'farmdb-homestead-main';

      if (input.cloudKey && input.cloudKey.trim().length > 0) {
        const decoded = decodeFarmNetworkJoinKey(input.cloudKey);
        if (
          !decoded ||
          decoded.kind !== 'full' ||
          !decoded.supabaseUrl ||
          !decoded.supabaseAnonKey
        ) {
          throw new NetworkValidationError(
            {
              cloudKey:
                'Paste a valid full Farm Cloud Key (FDB1:...) or enter your Supabase URL and Key below.',
            },
            'Paste a valid full Farm Cloud Key (FDB1:...) or enter your Supabase URL and Key below.'
          );
        }
        baseUrl = decoded.supabaseUrl;
        anonKey = decoded.supabaseAnonKey;
        workspaceId = decoded.workspaceId || workspaceId;
      } else {
        baseUrl = normalizeSupabaseBaseUrl(input.supabaseUrl ?? '');
        anonKey = (input.supabaseAnonKey ?? '').trim();
        if (!baseUrl || !/^https?:\/\/.+/i.test(baseUrl) || !anonKey) {
          throw new NetworkValidationError(
            {
              supabaseUrl:
                'Enter your Cloud Key (FDB1:...) or valid Supabase Project URL and Anon Key.',
            },
            'Enter your Cloud Key (FDB1:...) or valid Supabase Project URL and Anon Key.'
          );
        }
      }

      const fetchSupabase = createSupabaseFetcher(anonKey);
      const restEndpoint = `${baseUrl}/rest/v1/farmdb_cloud_snapshots`;
      const res = await fetchSupabase(
        `${restEndpoint}?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=workspace_id,farm_name,snapshot,updated_at`,
        { method: 'GET' }
      );
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(
          `Unable to reach Supabase cloud (HTTP ${res.status}): ${errText.slice(0, 140)}`
        );
      }

      const rows = (await res.json()) as Array<{
        workspace_id: string;
        farm_name?: string;
        snapshot?: unknown;
      }>;
      if (!rows.length || !rows[0]?.snapshot) {
        throw new Error(
          `No synced cloud farm database was found for workspace "${workspaceId}".`
        );
      }

      const remoteSnapshot = parseFarmSnapshotJson(
        JSON.stringify(rows[0].snapshot)
      );
      const remoteAdmins = (remoteSnapshot.farmAccounts ?? []).filter((acc) =>
        isAdminAccount(acc)
      );
      const emailFilter = input.email?.trim().toLowerCase();
      let targetAdmin = emailFilter
        ? remoteAdmins.find(
            (acc) => (acc.email ?? '').trim().toLowerCase() === emailFilter
          )
        : undefined;

      if (emailFilter && !targetAdmin) {
        throw new NetworkValidationError(
          {
            email: `No Admin account matching "${input.email!.trim()}" was found in workspace "${workspaceId}".`,
          },
          `No Admin account matching "${input.email!.trim()}" was found in workspace "${workspaceId}".`
        );
      }

      targetAdmin =
        targetAdmin ??
        remoteAdmins.find((acc) => acc.isPrimaryAdmin) ??
        remoteAdmins[0];

      if (
        targetAdmin?.accessCode &&
        targetAdmin.accessCode.trim().length > 0 &&
        (input.accessCode ?? '').trim() !== targetAdmin.accessCode.trim()
      ) {
        throw new NetworkValidationError(
          {
            accessCode:
              'Incorrect Admin password / PIN for the cloud workspace.',
          },
          'Incorrect Admin password / PIN for the cloud workspace.'
        );
      }

      const targetAdminId = targetAdmin?.id ?? DEFAULT_ADMIN_ACCOUNT.id;
      await settingsRepo.update({
        supabaseUrl: baseUrl,
        supabaseAnonKey: anonKey,
        cloudWorkspaceId: workspaceId,
        cloudSyncEnabled: true,
        activeAccountId: targetAdminId,
      });

      const backupBridge = getBackupBridge();
      const restoredCounts = await backupBridge.restoreSnapshot(
        remoteSnapshot,
        { preserveLocalSession: true }
      );
      const ensuredAdmin =
        (await this.getAccountById(targetAdminId)) ??
        (await this.ensureAdminAccount());

      const now = Date.now();
      await db
        .update(farmAccounts)
        .set({
          supabaseUrl: baseUrl,
          supabaseAnonKey: anonKey,
          cloudWorkspaceId: workspaceId,
          lastSyncedAt: now,
          updatedAt: now,
        })
        .where(eq(farmAccounts.id, ensuredAdmin.id))
        .run();

      const recovered = (await this.getAccountById(ensuredAdmin.id)) ?? {
        ...ensuredAdmin,
        supabaseUrl: baseUrl,
        supabaseAnonKey: anonKey,
        cloudWorkspaceId: workspaceId,
        lastSyncedAt: now,
      };

      const totalPulled =
        restoredCounts.livestockCount +
        restoredCounts.productCount +
        restoredCounts.medicalCount +
        restoredCounts.financialCount +
        restoredCounts.alertCount +
        (restoredCounts.workerCount ?? 0) +
        (restoredCounts.workerPaymentCount ?? 0) +
        (restoredCounts.workerTaskCount ?? 0) +
        (restoredCounts.ownershipCount ?? 0) +
        (restoredCounts.accountCount ?? 0);

      await appendSyncLog({
        direction: 'pull',
        status: 'success',
        recordsPushed: 0,
        recordsPulled: totalPulled,
        summary: `Signed into Admin account "${recovered.displayName}" and downloaded ${totalPulled} records from Supabase workspace "${workspaceId}".`,
      });
      events.emit(['*']);

      return {
        account: recovered,
        farmName: remoteSnapshot.settings.farmName || rows[0]?.farm_name || 'farmDB Homestead',
        recordsPulled: totalPulled,
      };
    },

    async acceptPendingAccount(
      accountId: string,
      options?: AcceptPendingAccountOptions
    ): Promise<FarmAccount> {
      const existing = await this.getAccountById(accountId);
      if (!existing) {
        throw new FarmAccountNotFoundError(accountId);
      }

      const updated = await this.updateAccount(accountId, {
        status: 'active',
        canManageNetwork: existing.isPrimaryAdmin ? true : false,
        canSyncCloud: options?.canSyncCloud ?? true,
        ...(options?.role !== undefined ? { role: options.role } : {}),
        ...(options?.permissions !== undefined
          ? { permissions: options.permissions }
          : {}),
      });

      const currentSettings = await settingsRepo.get();
      if (
        currentSettings.cloudSyncEnabled &&
        currentSettings.supabaseUrl &&
        currentSettings.supabaseAnonKey
      ) {
        try {
          await this.syncWithSupabase('bidirectional');
        } catch {
          // Local approval already saved in SQLite.
        }
      }

      events.emit(['network'], updated.id);
      return updated;
    },

    async listSyncLogs(limit = 25): Promise<CloudSyncLog[]> {
      const rows = await db
        .select()
        .from(cloudSyncLogs)
        .orderBy(desc(cloudSyncLogs.createdAt))
        .limit(Math.max(1, limit));
      return rows.map(mapSyncLogRow);
    },

    async clearSyncLogs(): Promise<void> {
      await db.delete(cloudSyncLogs).run();
      events.emit(['network']);
    },

    async syncWithSupabase(
      direction: CloudSyncDirection
    ): Promise<CloudSyncResult> {
      if (!bypassSyncAccountGate) {
        const activeAccount = await this.getActiveAccount();
        if (!isAdminAccount(activeAccount) && !activeAccount.canSyncCloud) {
          const msg =
            'User accounts can only sync with a cloud database when connected with an Admin Join Key.';
          const log = await appendSyncLog({
            direction,
            status: 'error',
            recordsPushed: 0,
            recordsPulled: 0,
            summary: msg,
          });
          return {
            ok: false,
            direction,
            status: 'error',
            recordsPushed: 0,
            recordsPulled: 0,
            message: msg,
            log,
          };
        }
      }

      const currentSettings = await settingsRepo.get();
      const baseUrl = normalizeSupabaseBaseUrl(currentSettings.supabaseUrl);
      const anonKey = currentSettings.supabaseAnonKey.trim();
      const workspaceId = currentSettings.cloudWorkspaceId.trim();

      if (!baseUrl || !anonKey) {
        const msg =
          'Supabase URL and Anon/Publishable Key are required before cloud sync.';
        const log = await appendSyncLog({
          direction,
          status: 'error',
          recordsPushed: 0,
          recordsPulled: 0,
          summary: msg,
        });
        return {
          ok: false,
          direction,
          status: 'error',
          recordsPushed: 0,
          recordsPulled: 0,
          message: msg,
          log,
        };
      }

      if (
        typeof navigator !== 'undefined' &&
        (navigator as unknown as { onLine?: boolean }).onLine === false
      ) {
        const msg =
          'Device appears offline. Changes remain safely stored in local SQLite until reconnected.';
        const log = await appendSyncLog({
          direction,
          status: 'offline',
          recordsPushed: 0,
          recordsPulled: 0,
          summary: msg,
        });
        return {
          ok: false,
          direction,
          status: 'offline',
          recordsPushed: 0,
          recordsPulled: 0,
          message: msg,
          log,
        };
      }

      const fetchSupabase = createSupabaseFetcher(anonKey);
      const restEndpoint = `${baseUrl}/rest/v1/farmdb_cloud_snapshots`;

      try {
        if (direction === 'test') {
          const res = await fetchSupabase(
            `${restEndpoint}?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=workspace_id,farm_name,updated_at`,
            { method: 'GET' }
          );
          if (!res.ok) {
            const errText = await res.text();
            const isMissingTable =
              errText.includes('PGRST205') ||
              errText.includes('42P01') ||
              /does not exist|schema cache/i.test(errText);
            const hint = isMissingTable
              ? ' Table public.farmdb_cloud_snapshots is not exposed in Supabase schema cache yet — run the SQL Setup Script in Supabase SQL Editor.'
              : errText
                ? ` (${errText.slice(0, 160)})`
                : '';
            const msg = `Supabase returned HTTP ${res.status}.${hint}`;
            const log = await appendSyncLog({
              direction: 'test',
              status: 'error',
              recordsPushed: 0,
              recordsPulled: 0,
              summary: msg,
            });
            return {
              ok: false,
              direction: 'test',
              status: 'error',
              recordsPushed: 0,
              recordsPulled: 0,
              message: msg,
              log,
            };
          }

          const rows = (await res.json()) as Array<{
            workspace_id: string;
            farm_name?: string;
            updated_at?: string;
          }>;
          const msg =
            rows.length > 0
              ? `Connected to Supabase workspace "${workspaceId}" (cloud record found).`
              : `Connected to Supabase! Workspace "${workspaceId}" is ready for initial push.`;
          const log = await appendSyncLog({
            direction: 'test',
            status: 'success',
            recordsPushed: 0,
            recordsPulled: 0,
            summary: msg,
          });
          return {
            ok: true,
            direction: 'test',
            status: 'success',
            recordsPushed: 0,
            recordsPulled: 0,
            message: msg,
            log,
          };
        }

        const backupBridge = getBackupBridge();
        const ensuredAdmin = await this.ensureAdminAccount();
        const activeSyncAcc = await this.getActiveAccount();
        if (
          isAdminAccount(activeSyncAcc) &&
          baseUrl &&
          anonKey &&
          (activeSyncAcc.supabaseUrl !== baseUrl ||
            activeSyncAcc.supabaseAnonKey !== anonKey ||
            activeSyncAcc.cloudWorkspaceId !== workspaceId)
        ) {
          await db
            .update(farmAccounts)
            .set({
              supabaseUrl: baseUrl,
              supabaseAnonKey: anonKey,
              cloudWorkspaceId: workspaceId,
              updatedAt: Date.now(),
            })
            .where(eq(farmAccounts.id, activeSyncAcc.id))
            .run();
        } else if (
          ensuredAdmin &&
          baseUrl &&
          anonKey &&
          (!ensuredAdmin.supabaseUrl || !ensuredAdmin.supabaseAnonKey)
        ) {
          await db
            .update(farmAccounts)
            .set({
              supabaseUrl: baseUrl,
              supabaseAnonKey: anonKey,
              cloudWorkspaceId: workspaceId,
              updatedAt: Date.now(),
            })
            .where(eq(farmAccounts.id, ensuredAdmin.id))
            .run();
        }
        const localSnapshot = await backupBridge.exportSnapshot();

        const buildPushPayload = (snap: FarmDbSnapshot): FarmDbSnapshot => ({
          ...snap,
          financialLogs: currentSettings.syncIncludeFinancials
            ? snap.financialLogs
            : [],
          workers: currentSettings.syncIncludeHr ? snap.workers ?? [] : [],
          workerPayments: currentSettings.syncIncludeHr
            ? snap.workerPayments ?? []
            : [],
          workerTasks: currentSettings.syncIncludeHr
            ? snap.workerTasks ?? []
            : [],
        });

        let pulledSnapshot: FarmDbSnapshot | null = null;
        if (direction === 'pull' || direction === 'bidirectional') {
          const pullRes = await fetchSupabase(
            `${restEndpoint}?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=workspace_id,farm_name,snapshot,updated_at`,
            { method: 'GET' }
          );
          if (!pullRes.ok) {
            const errText = await pullRes.text();
            throw new Error(
              `Cloud pull failed (HTTP ${pullRes.status}): ${errText.slice(0, 140)}`
            );
          }
          const pullRows = (await pullRes.json()) as Array<{
            workspace_id: string;
            snapshot?: unknown;
          }>;
          if (pullRows.length > 0 && pullRows[0]?.snapshot) {
            pulledSnapshot = parseFarmSnapshotJson(
              JSON.stringify(pullRows[0].snapshot)
            );
          }
        }

        const countSnapshotRecords = (snap: FarmDbSnapshot): number =>
          snap.livestock.length +
          snap.productRecords.length +
          snap.medicalRecords.length +
          snap.financialLogs.length +
          snap.alerts.length +
          (snap.workers?.length ?? 0) +
          (snap.workerPayments?.length ?? 0) +
          (snap.workerTasks?.length ?? 0) +
          (snap.animalOwnerships?.length ?? 0) +
          (snap.farmAccounts?.length ?? 0);

        let finalSnapshotToPush = buildPushPayload(localSnapshot);
        let recordsPulled = 0;
        let recordsPushed = 0;

        if (direction === 'pull') {
          if (!pulledSnapshot) {
            const msg = `No cloud snapshot exists yet for workspace "${workspaceId}".`;
            const log = await appendSyncLog({
              direction: 'pull',
              status: 'success',
              recordsPushed: 0,
              recordsPulled: 0,
              summary: msg,
            });
            return {
              ok: true,
              direction: 'pull',
              status: 'success',
              recordsPushed: 0,
              recordsPulled: 0,
              message: msg,
              log,
            };
          }

          const mergeRes = mergeFarmSnapshots(
            localSnapshot,
            pulledSnapshot,
            'cloud_priority',
            {
              includeFinancials: currentSettings.syncIncludeFinancials,
              includeHr: currentSettings.syncIncludeHr,
            }
          );
          recordsPulled = countSnapshotRecords(mergeRes.merged);
          await backupBridge.restoreSnapshot(mergeRes.merged, {
            preserveLocalSession: true,
          });
          await this.ensureAdminAccount();
        } else if (direction === 'bidirectional') {
          if (pulledSnapshot) {
            const mergeRes = mergeFarmSnapshots(
              localSnapshot,
              pulledSnapshot,
              currentSettings.syncConflictStrategy,
              {
                includeFinancials: currentSettings.syncIncludeFinancials,
                includeHr: currentSettings.syncIncludeHr,
              }
            );
            recordsPulled = mergeRes.recordsPulled;
            recordsPushed = mergeRes.recordsPushed;
            finalSnapshotToPush = buildPushPayload(mergeRes.merged);
            await backupBridge.restoreSnapshot(mergeRes.merged, {
              preserveLocalSession: true,
            });
            await this.ensureAdminAccount();
          } else {
            recordsPushed = countSnapshotRecords(finalSnapshotToPush);
          }
        } else if (direction === 'push') {
          recordsPushed = countSnapshotRecords(finalSnapshotToPush);
        }

        if (direction === 'push' || direction === 'bidirectional') {
          const pushRes = await fetchSupabase(
            `${restEndpoint}?on_conflict=workspace_id`,
            {
              method: 'POST',
              extraHeaders: {
                Prefer: 'resolution=merge-duplicates,return=minimal',
              },
              body: JSON.stringify([
                {
                  workspace_id: workspaceId,
                  farm_name: currentSettings.farmName,
                  updated_by_account_id: currentSettings.activeAccountId,
                  snapshot: finalSnapshotToPush,
                  updated_at: new Date().toISOString(),
                },
              ]),
            }
          );

          if (!pushRes.ok) {
            const errText = await pushRes.text();
            throw new Error(
              `Cloud push failed (HTTP ${pushRes.status}): ${errText.slice(0, 140)}`
            );
          }
        }

        const now = Date.now();
        const activeAcc = await this.getAccountById(currentSettings.activeAccountId);
        if (activeAcc) {
          await db
            .update(farmAccounts)
            .set({ lastSyncedAt: now, updatedAt: now })
            .where(eq(farmAccounts.id, activeAcc.id))
            .run();
        }

        const summaryMsg =
          direction === 'push'
            ? `Pushed ${recordsPushed} records to Supabase workspace "${workspaceId}".`
            : direction === 'pull'
              ? `Pulled ${recordsPulled} records from Supabase workspace "${workspaceId}".`
              : `Two-way Supabase sync complete (${recordsPulled} pulled, ${recordsPushed} pushed).`;

        const log = await appendSyncLog({
          direction,
          status: 'success',
          recordsPushed,
          recordsPulled,
          summary: summaryMsg,
        });
        events.emit(['*']);

        return {
          ok: true,
          direction,
          status: 'success',
          recordsPushed,
          recordsPulled,
          message: summaryMsg,
          log,
        };
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Unable to reach Supabase cloud.';
        const isOfflineError =
          /failed to fetch|network|offline|timed out|enotfound|econnrefused/i.test(
            msg
          );
        const status: CloudSyncStatus = isOfflineError ? 'offline' : 'error';
        const log = await appendSyncLog({
          direction,
          status,
          recordsPushed: 0,
          recordsPulled: 0,
          summary: msg,
        });
        return {
          ok: false,
          direction,
          status,
          recordsPushed: 0,
          recordsPulled: 0,
          message: msg,
          log,
        };
      }
    },
  };
}
