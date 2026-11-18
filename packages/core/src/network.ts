import { DEFAULT_FARM_SETTINGS } from './analytics';
import type { FarmDbSnapshot } from './export';
import type { AppSectionId } from './navigation';
import {
  FARM_PERMISSION_MODULES,
  inferDefaultLivestockSex,
  LIVESTOCK_SEXES,
  type CloudSyncLog,
  type FarmAccount,
  type FarmAccountPermissions,
  type FarmAccountRole,
  type FarmAccountStatus,
  type FarmModuleAccessLevel,
  type FarmPermissionModule,
  type FarmSettings,
  type LivestockSex,
  type SyncConflictStrategy,
} from './types';

export function buildAllModulePermissions(
  level: FarmModuleAccessLevel
): FarmAccountPermissions {
  return {
    livestock: level,
    ownerships: level,
    family_tree: level,
    production: level,
    medical: level,
    financial: level,
    alerts: level,
    hr: level,
    statistics: level,
    backup: level,
    settings: level,
  };
}

export function isAdminAccount(
  account: FarmAccount | null | undefined
): boolean {
  if (!account) return true;
  return Boolean(account.isPrimaryAdmin || account.role === 'admin');
}

export function formatAccountTierLabel(
  account: FarmAccount | null | undefined
): string {
  return isAdminAccount(account) ? 'Admin Account' : 'User Account';
}

export function buildStandardUserPermissions(): FarmAccountPermissions {
  return {
    livestock: 'full',
    ownerships: 'full',
    family_tree: 'full',
    production: 'full',
    medical: 'full',
    financial: 'full',
    alerts: 'full',
    hr: 'full',
    statistics: 'full',
    backup: 'full',
    settings: 'edit',
  };
}

export function getDefaultPermissionsForRole(
  role: FarmAccountRole
): FarmAccountPermissions {
  switch (role) {
    case 'admin':
      return buildAllModulePermissions('full');
    case 'manager':
      return {
        livestock: 'full',
        ownerships: 'full',
        family_tree: 'full',
        production: 'full',
        medical: 'full',
        financial: 'edit',
        alerts: 'full',
        hr: 'edit',
        statistics: 'full',
        backup: 'edit',
        settings: 'edit',
      };
    case 'family_member':
      return {
        livestock: 'edit',
        ownerships: 'view',
        family_tree: 'view',
        production: 'edit',
        medical: 'view',
        financial: 'view',
        alerts: 'edit',
        hr: 'view',
        statistics: 'view',
        backup: 'edit',
        settings: 'view',
      };
    case 'external_owner':
      return {
        livestock: 'view',
        ownerships: 'view',
        family_tree: 'view',
        production: 'view',
        medical: 'view',
        financial: 'none',
        alerts: 'view',
        hr: 'none',
        statistics: 'view',
        backup: 'view',
        settings: 'view',
      };
    case 'veterinarian':
      return {
        livestock: 'view',
        ownerships: 'view',
        family_tree: 'view',
        production: 'view',
        medical: 'full',
        financial: 'none',
        alerts: 'edit',
        hr: 'none',
        statistics: 'view',
        backup: 'view',
        settings: 'view',
      };
    case 'staff_viewer':
      return {
        livestock: 'view',
        ownerships: 'view',
        family_tree: 'view',
        production: 'edit',
        medical: 'view',
        financial: 'none',
        alerts: 'view',
        hr: 'view',
        statistics: 'view',
        backup: 'view',
        settings: 'view',
      };
  }
}

export function normalizeAccountPermissions(
  partial: Partial<FarmAccountPermissions> | undefined,
  role: FarmAccountRole
): FarmAccountPermissions {
  const base = getDefaultPermissionsForRole(role);
  const next: FarmAccountPermissions = { ...base };
  if (partial && typeof partial === 'object') {
    for (const mod of FARM_PERMISSION_MODULES) {
      const candidate = partial[mod];
      if (
        candidate === 'none' ||
        candidate === 'view' ||
        candidate === 'edit' ||
        candidate === 'full'
      ) {
        next[mod] = candidate;
      }
    }
  }
  return next;
}

export const DEFAULT_ADMIN_ACCOUNT: FarmAccount = {
  id: 'owner-admin',
  displayName: 'Farm Owner (Administrator)',
  email: null,
  phone: null,
  role: 'admin',
  relationship: 'Primary Farm Owner',
  avatarKey: 'farmer',
  accessCode: null,
  supabaseUrl: null,
  supabaseAnonKey: null,
  cloudWorkspaceId: null,
  isPrimaryAdmin: true,
  canManageNetwork: true,
  canSyncCloud: true,
  permissions: getDefaultPermissionsForRole('admin'),
  status: 'active',
  lastSyncedAt: null,
  createdAt: 1,
  updatedAt: 1,
};

export function formatAccountRoleLabel(role: FarmAccountRole): string {
  switch (role) {
    case 'admin':
      return 'Farm Owner (Admin)';
    case 'manager':
      return 'Farm Manager';
    case 'family_member':
      return 'Family Member';
    case 'external_owner':
      return 'Animal Owner / Partner';
    case 'veterinarian':
      return 'Veterinarian';
    case 'staff_viewer':
      return 'Staff Member';
  }
}

export function formatAccountStatusLabel(status: FarmAccountStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'pending':
      return 'Pending Approval';
    case 'invited':
      return 'Invited';
    case 'suspended':
      return 'Suspended';
  }
}

export function formatAccessLevelLabel(level: FarmModuleAccessLevel): string {
  switch (level) {
    case 'none':
      return 'Hidden';
    case 'view':
      return 'View Only';
    case 'edit':
      return 'View & Edit';
    case 'full':
      return 'Full Admin';
  }
}

export function describeModuleAccessLevel(level: FarmModuleAccessLevel): string {
  switch (level) {
    case 'none':
      return 'Hidden';
    case 'view':
      return 'View Only (Read-Only)';
    case 'edit':
      return 'View & Edit (Create & Update)';
    case 'full':
      return 'Full Access (Create, Edit & Delete)';
  }
}

export function formatPermissionModuleLabel(
  mod: FarmPermissionModule
): string {
  switch (mod) {
    case 'livestock':
      return 'Herd Registry';
    case 'ownerships':
      return 'Ownerships';
    case 'family_tree':
      return 'Family Tree';
    case 'production':
      return 'Milk Production';
    case 'medical':
      return 'Medical History';
    case 'financial':
      return 'Financial Ledger';
    case 'alerts':
      return 'Alerts & Notes';
    case 'hr':
      return 'Human Resources';
    case 'statistics':
      return 'Farm Statistics';
    case 'backup':
      return 'Export & Backup';
    case 'settings':
      return 'Settings';
  }
}

export function getAccountModuleAccess(
  account: FarmAccount | null | undefined,
  section: AppSectionId
): FarmModuleAccessLevel {
  if (!account) return 'full';
  if (
    (account.status === 'suspended' || account.status === 'pending') &&
    !account.isPrimaryAdmin
  ) {
    return 'none';
  }
  if (account.isPrimaryAdmin) {
    return 'full';
  }
  if (section === 'network') {
    return isAdminAccount(account) || account.canManageNetwork
      ? 'full'
      : 'edit';
  }
  return (
    account.permissions?.[section] ??
    (isAdminAccount(account) ? 'full' : 'none')
  );
}

export function canAccountViewModule(
  account: FarmAccount | null | undefined,
  section: AppSectionId
): boolean {
  return getAccountModuleAccess(account, section) !== 'none';
}

export function canAccountEditModule(
  account: FarmAccount | null | undefined,
  section: AppSectionId
): boolean {
  const access = getAccountModuleAccess(account, section);
  return access === 'edit' || access === 'full';
}

export function canAccountDeleteInModule(
  account: FarmAccount | null | undefined,
  section: AppSectionId
): boolean {
  return getAccountModuleAccess(account, section) === 'full';
}

interface TimestampedEntity {
  id: string;
  updatedAt?: number;
}

function mergeTableRows<T extends TimestampedEntity>(
  localRows: readonly T[],
  remoteRows: readonly T[],
  strategy: SyncConflictStrategy
): { merged: T[]; pulledCount: number; pushedCount: number } {
  const localMap = new Map(localRows.map((row) => [row.id, row]));
  const remoteMap = new Map(remoteRows.map((row) => [row.id, row]));
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

  const merged: T[] = [];
  let pulledCount = 0;
  let pushedCount = 0;

  for (const id of allIds) {
    const local = localMap.get(id);
    const remote = remoteMap.get(id);

    if (local && !remote) {
      merged.push(local);
      pushedCount += 1;
    } else if (!local && remote) {
      merged.push(remote);
      pulledCount += 1;
    } else if (local && remote) {
      if (strategy === 'local_priority') {
        merged.push(local);
      } else if (strategy === 'cloud_priority') {
        merged.push(remote);
        if ((remote.updatedAt ?? 0) !== (local.updatedAt ?? 0)) {
          pulledCount += 1;
        }
      } else {
        const localTs = local.updatedAt ?? 0;
        const remoteTs = remote.updatedAt ?? 0;
        if (remoteTs > localTs) {
          merged.push(remote);
          pulledCount += 1;
        } else {
          merged.push(local);
          if (localTs > remoteTs) pushedCount += 1;
        }
      }
    }
  }

  return { merged, pulledCount, pushedCount };
}

const LOCAL_ONLY_SETTINGS_KEYS = new Set<keyof FarmSettings>([
  'supabaseUrl',
  'supabaseAnonKey',
  'cloudWorkspaceId',
  'cloudSyncEnabled',
  'activeAccountId',
]);

function extractSharedSettings(settings: FarmSettings): Record<string, unknown> {
  const shared: Record<string, unknown> = {};
  const keys = (Object.keys(settings) as Array<keyof FarmSettings>).sort();
  for (const key of keys) {
    if (!LOCAL_ONLY_SETTINGS_KEYS.has(key)) {
      shared[key] = settings[key];
    }
  }
  return shared;
}

function mergeCloudSyncLogs(
  localLogs: readonly CloudSyncLog[],
  remoteLogs: readonly CloudSyncLog[]
): CloudSyncLog[] {
  const byId = new Map<string, CloudSyncLog>();
  for (const log of remoteLogs) {
    const existing = byId.get(log.id);
    if (!existing || log.createdAt > existing.createdAt) {
      byId.set(log.id, log);
    }
  }
  for (const log of localLogs) {
    const existing = byId.get(log.id);
    if (!existing || log.createdAt >= existing.createdAt) {
      byId.set(log.id, log);
    }
  }
  return Array.from(byId.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 150);
}

export interface MergeSnapshotsResult {
  merged: FarmDbSnapshot;
  recordsPulled: number;
  recordsPushed: number;
}

export function mergeFarmSnapshots(
  localSnapshot: FarmDbSnapshot,
  remoteSnapshot: FarmDbSnapshot,
  strategy: SyncConflictStrategy,
  options?: {
    includeFinancials?: boolean;
    includeHr?: boolean;
  }
): MergeSnapshotsResult {
  const includeFinancials = options?.includeFinancials ?? true;
  const includeHr = options?.includeHr ?? true;

  const livestockRes = mergeTableRows(
    localSnapshot.livestock,
    remoteSnapshot.livestock,
    strategy
  );
  const prodRes = mergeTableRows(
    localSnapshot.productRecords,
    remoteSnapshot.productRecords,
    strategy
  );
  const medRes = mergeTableRows(
    localSnapshot.medicalRecords,
    remoteSnapshot.medicalRecords,
    strategy
  );
  const alertsRes = mergeTableRows(
    localSnapshot.alerts,
    remoteSnapshot.alerts,
    strategy
  );
  const finRes = includeFinancials
    ? mergeTableRows(
        localSnapshot.financialLogs,
        remoteSnapshot.financialLogs,
        strategy
      )
    : { merged: localSnapshot.financialLogs, pulledCount: 0, pushedCount: 0 };

  const workersRes = includeHr
    ? mergeTableRows(
        localSnapshot.workers ?? [],
        remoteSnapshot.workers ?? [],
        strategy
      )
    : { merged: localSnapshot.workers ?? [], pulledCount: 0, pushedCount: 0 };
  const paymentsRes = includeHr
    ? mergeTableRows(
        localSnapshot.workerPayments ?? [],
        remoteSnapshot.workerPayments ?? [],
        strategy
      )
    : {
        merged: localSnapshot.workerPayments ?? [],
        pulledCount: 0,
        pushedCount: 0,
      };
  const tasksRes = includeHr
    ? mergeTableRows(
        localSnapshot.workerTasks ?? [],
        remoteSnapshot.workerTasks ?? [],
        strategy
      )
    : { merged: localSnapshot.workerTasks ?? [], pulledCount: 0, pushedCount: 0 };

  const ownershipsRes = mergeTableRows(
    localSnapshot.animalOwnerships ?? [],
    remoteSnapshot.animalOwnerships ?? [],
    strategy
  );
  const accountsRes = mergeTableRows(
    localSnapshot.farmAccounts ?? [],
    remoteSnapshot.farmAccounts ?? [],
    strategy
  );

  const localSettingsTs = localSnapshot.settingsUpdatedAt ?? 0;
  const remoteSettingsTs = remoteSnapshot.settingsUpdatedAt ?? 0;
  const useRemoteSettings =
    strategy === 'cloud_priority' ||
    (strategy === 'last_write_wins' &&
      remoteSettingsTs >= localSettingsTs &&
      remoteSettingsTs > 0);

  const sharedSettingsDiffer =
    JSON.stringify(extractSharedSettings(localSnapshot.settings)) !==
    JSON.stringify(extractSharedSettings(remoteSnapshot.settings));

  const settingsPulledCount = sharedSettingsDiffer && useRemoteSettings ? 1 : 0;
  const settingsPushedCount = sharedSettingsDiffer && !useRemoteSettings ? 1 : 0;

  // Preserve device-local Supabase credentials/session while letting shared farm settings sync cleanly.
  const mergedSettings: FarmSettings = {
    ...DEFAULT_FARM_SETTINGS,
    ...(useRemoteSettings ? remoteSnapshot.settings : localSnapshot.settings),
    supabaseUrl:
      localSnapshot.settings.supabaseUrl || remoteSnapshot.settings.supabaseUrl,
    supabaseAnonKey:
      localSnapshot.settings.supabaseAnonKey ||
      remoteSnapshot.settings.supabaseAnonKey,
    cloudWorkspaceId:
      localSnapshot.settings.cloudWorkspaceId ||
      remoteSnapshot.settings.cloudWorkspaceId,
    cloudSyncEnabled: localSnapshot.settings.cloudSyncEnabled,
    activeAccountId: localSnapshot.settings.activeAccountId,
  };

  const mergedLogs = mergeCloudSyncLogs(
    localSnapshot.cloudSyncLogs ?? [],
    remoteSnapshot.cloudSyncLogs ?? []
  );

  const localLivestockMap = new Map(
    localSnapshot.livestock.map((row) => [row.id, row])
  );
  const remoteLivestockMap = new Map(
    remoteSnapshot.livestock.map((row) => [row.id, row])
  );

  const localAccountsMap = new Map(
    (localSnapshot.farmAccounts ?? []).map((acc) => [acc.id, acc])
  );
  const remoteAccountsMap = new Map(
    (remoteSnapshot.farmAccounts ?? []).map((acc) => [acc.id, acc])
  );
  const mergedAccounts = accountsRes.merged.map((acc) => {
    const localAcc = localAccountsMap.get(acc.id);
    const remoteAcc = remoteAccountsMap.get(acc.id);
    const resolvedAccessCode =
      acc.accessCode && acc.accessCode.trim().length > 0
        ? acc.accessCode
        : (remoteAcc?.accessCode && remoteAcc.accessCode.trim().length > 0
            ? remoteAcc.accessCode
            : localAcc?.accessCode ?? null);
    const isAdmin = Boolean(acc.isPrimaryAdmin || acc.role === 'admin');
    const pickCred = (
      a?: string | null,
      b?: string | null,
      c?: string | null,
      fallback?: string
    ): string | null => {
      for (const candidate of [a, b, c]) {
        if (candidate && candidate.trim().length > 0) return candidate.trim();
      }
      if (isAdmin && fallback && fallback.trim().length > 0) {
        return fallback.trim();
      }
      return null;
    };
    return {
      ...acc,
      accessCode: resolvedAccessCode,
      supabaseUrl: isAdmin
        ? pickCred(
            acc.supabaseUrl,
            remoteAcc?.supabaseUrl,
            localAcc?.supabaseUrl,
            mergedSettings.supabaseUrl
          )
        : null,
      supabaseAnonKey: isAdmin
        ? pickCred(
            acc.supabaseAnonKey,
            remoteAcc?.supabaseAnonKey,
            localAcc?.supabaseAnonKey,
            mergedSettings.supabaseAnonKey
          )
        : null,
      cloudWorkspaceId: isAdmin
        ? pickCred(
            acc.cloudWorkspaceId,
            remoteAcc?.cloudWorkspaceId,
            localAcc?.cloudWorkspaceId,
            mergedSettings.cloudWorkspaceId
          )
        : null,
      permissions: normalizeAccountPermissions(acc.permissions, acc.role),
    };
  });

  const mergedLivestock = livestockRes.merged.map((animal) => {
    const normalizedSex = (LIVESTOCK_SEXES as readonly string[]).includes(animal.sex)
      ? (animal.sex as LivestockSex)
      : inferDefaultLivestockSex(animal.tagNumber);
    const uri = animal.imageUri ?? '';
    if (uri.startsWith('data:image/')) {
      return { ...animal, sex: normalizedSex };
    }
    const localUri = localLivestockMap.get(animal.id)?.imageUri ?? '';
    const remoteUri = remoteLivestockMap.get(animal.id)?.imageUri ?? '';
    if (remoteUri.startsWith('data:image/')) {
      return { ...animal, sex: normalizedSex, imageUri: remoteUri };
    }
    if (localUri.startsWith('data:image/')) {
      return { ...animal, sex: normalizedSex, imageUri: localUri };
    }
    return { ...animal, sex: normalizedSex };
  });

  const merged: FarmDbSnapshot = {
    version: 1,
    app: 'farmDB',
    exportedAt: new Date().toISOString(),
    settings: mergedSettings,
    settingsUpdatedAt: Math.max(localSettingsTs, remoteSettingsTs, Date.now()),
    livestock: mergedLivestock,
    productRecords: prodRes.merged,
    medicalRecords: medRes.merged,
    financialLogs: finRes.merged,
    alerts: alertsRes.merged,
    workers: workersRes.merged,
    workerPayments: paymentsRes.merged,
    workerTasks: tasksRes.merged,
    animalOwnerships: ownershipsRes.merged,
    farmAccounts: mergedAccounts,
    cloudSyncLogs: mergedLogs,
  };

  const recordsPulled =
    livestockRes.pulledCount +
    prodRes.pulledCount +
    medRes.pulledCount +
    alertsRes.pulledCount +
    finRes.pulledCount +
    workersRes.pulledCount +
    paymentsRes.pulledCount +
    tasksRes.pulledCount +
    ownershipsRes.pulledCount +
    accountsRes.pulledCount +
    settingsPulledCount;

  const recordsPushed =
    livestockRes.pushedCount +
    prodRes.pushedCount +
    medRes.pushedCount +
    alertsRes.pushedCount +
    finRes.pushedCount +
    workersRes.pushedCount +
    paymentsRes.pushedCount +
    tasksRes.pushedCount +
    ownershipsRes.pushedCount +
    accountsRes.pushedCount +
    settingsPushedCount;

  return { merged, recordsPulled, recordsPushed };
}

export function normalizeSupabaseBaseUrl(rawUrl: string): string {
  return rawUrl
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1(?:\/farmdb_cloud_snapshots)?$/i, '')
    .replace(/\/+$/, '');
}

const B64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function encodeUtf8Bytes(str: string): number[] {
  const utf8: number[] = [];
  for (let i = 0; i < str.length; i += 1) {
    let charCode = str.charCodeAt(i);
    if (charCode < 0x80) {
      utf8.push(charCode);
    } else if (charCode < 0x800) {
      utf8.push(0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f));
    } else if (charCode < 0xd800 || charCode >= 0xe000) {
      utf8.push(
        0xe0 | (charCode >> 12),
        0x80 | ((charCode >> 6) & 0x3f),
        0x80 | (charCode & 0x3f)
      );
    } else {
      i += 1;
      charCode =
        0x10000 + (((charCode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      utf8.push(
        0xf0 | (charCode >> 18),
        0x80 | ((charCode >> 12) & 0x3f),
        0x80 | ((charCode >> 6) & 0x3f),
        0x80 | (charCode & 0x3f)
      );
    }
  }
  return utf8;
}

function decodeUtf8Bytes(bytes: readonly number[]): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++] ?? 0;
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
    } else if ((b0 & 0xe0) === 0xc0) {
      const b1 = bytes[i++] ?? 0;
      out += String.fromCharCode(((b0 & 0x1f) << 6) | (b1 & 0x3f));
    } else if ((b0 & 0xf0) === 0xe0) {
      const b1 = bytes[i++] ?? 0;
      const b2 = bytes[i++] ?? 0;
      out += String.fromCharCode(
        ((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f)
      );
    } else {
      const b1 = bytes[i++] ?? 0;
      const b2 = bytes[i++] ?? 0;
      const b3 = bytes[i++] ?? 0;
      const cp =
        ((b0 & 0x07) << 18) |
        ((b1 & 0x3f) << 12) |
        ((b2 & 0x3f) << 6) |
        (b3 & 0x3f);
      const offset = cp - 0x10000;
      out += String.fromCharCode(
        0xd800 + (offset >> 10),
        0xdc00 + (offset & 0x3ff)
      );
    }
  }
  return out;
}

function utf8ToBase64(str: string): string {
  const bytes = encodeUtf8Bytes(str);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    const enc1 = b0 >> 2;
    const enc2 = ((b0 & 3) << 4) | ((b1 ?? 0) >> 4);
    const enc3 = b1 === undefined ? 64 : ((b1 & 15) << 2) | ((b2 ?? 0) >> 6);
    const enc4 = b2 === undefined ? 64 : b2 & 63;
    out +=
      (B64_CHARS[enc1] ?? '') +
      (B64_CHARS[enc2] ?? '') +
      (B64_CHARS[enc3] ?? '') +
      (B64_CHARS[enc4] ?? '');
  }
  return out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64ToUtf8(raw: string): string {
  const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const bytes: number[] = [];
  for (let i = 0; i < padded.length; i += 4) {
    const enc1 = B64_CHARS.indexOf(padded[i] ?? '=');
    const enc2 = B64_CHARS.indexOf(padded[i + 1] ?? '=');
    const enc3 = B64_CHARS.indexOf(padded[i + 2] ?? '=');
    const enc4 = B64_CHARS.indexOf(padded[i + 3] ?? '=');
    const b0 = (enc1 << 2) | (enc2 >> 4);
    bytes.push(b0);
    if (enc3 !== 64 && enc3 !== -1) {
      bytes.push(((enc2 & 15) << 4) | (enc3 >> 2));
    }
    if (enc4 !== 64 && enc4 !== -1) {
      bytes.push(((enc3 & 3) << 6) | enc4);
    }
  }
  return decodeUtf8Bytes(bytes);
}

export function generateShortJoinCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)] ?? '7';
  }
  return `FARM-${suffix}`;
}

export interface DecodedFarmJoinKey {
  kind: 'full' | 'short';
  joinCode: string;
  workspaceId?: string;
  farmName?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export function encodeFarmNetworkJoinKey(input: {
  joinCode: string;
  workspaceId: string;
  farmName: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}): string {
  const joinCode = input.joinCode.trim().toUpperCase() || 'FARM-7842';
  const cleanUrl = normalizeSupabaseBaseUrl(input.supabaseUrl ?? '');
  const cleanKey = (input.supabaseAnonKey ?? '').trim();
  const cleanWorkspace = input.workspaceId.trim() || 'farmdb-homestead-main';

  if (cleanUrl && cleanKey) {
    const payload = JSON.stringify({
      c: joinCode,
      w: cleanWorkspace,
      f: input.farmName.trim() || 'farmDB Homestead',
      u: cleanUrl,
      k: cleanKey,
    });
    return `FDB1:${utf8ToBase64(payload)}`;
  }

  return joinCode;
}

export function decodeFarmNetworkJoinKey(
  rawKey: string
): DecodedFarmJoinKey | null {
  const trimmed = rawKey.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.toUpperCase().startsWith('FDB1:')) {
    try {
      const encoded = trimmed.slice(5).trim();
      const parsed = JSON.parse(base64ToUtf8(encoded)) as {
        c?: string;
        w?: string;
        f?: string;
        u?: string;
        k?: string;
      };
      if (!parsed || typeof parsed.c !== 'string' || !parsed.c.trim()) {
        return null;
      }
      return {
        kind: 'full',
        joinCode: parsed.c.trim().toUpperCase(),
        workspaceId: parsed.w?.trim(),
        farmName: parsed.f?.trim(),
        supabaseUrl: parsed.u ? normalizeSupabaseBaseUrl(parsed.u) : undefined,
        supabaseAnonKey: parsed.k?.trim(),
      };
    } catch {
      return null;
    }
  }

  if (trimmed.length < 4 || trimmed.length > 40) {
    return null;
  }

  return {
    kind: 'short',
    joinCode: trimmed.toUpperCase(),
  };
}

export function generateSupabaseSetupSql(): string {
  return `-- Run this SQL inside your Supabase SQL Editor to enable farmDB Cloud Sync:
create table if not exists public.farmdb_cloud_snapshots (
  workspace_id text primary key,
  farm_name text not null default 'farmDB Homestead',
  updated_by_account_id text,
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.farmdb_cloud_snapshots enable row level security;

grant usage on schema public to anon, authenticated;
grant all on table public.farmdb_cloud_snapshots to anon, authenticated;

-- Allows desktop & mobile farmDB clients using your Supabase Anon/Publishable Key to sync:
drop policy if exists "farmdb_workspace_sync" on public.farmdb_cloud_snapshots;
create policy "farmdb_workspace_sync"
  on public.farmdb_cloud_snapshots
  for all
  to anon, authenticated
  using (true)
  with check (true);

notify pgrst, 'reload schema';
`;
}
