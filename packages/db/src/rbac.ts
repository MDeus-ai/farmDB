import {
  canAccountDeleteInModule,
  canAccountEditModule,
  isAdminAccount,
  type AppSectionId,
  type FarmAccount,
  type NewLivestockInput,
  type UpdateFarmAccountInput,
  type UpdateLivestockInput,
} from '@farmdb/core';
import type { FarmDbContextValue } from './react';

const NON_LINEAGE_LIVESTOCK_KEYS: readonly (keyof UpdateLivestockInput)[] = [
  'species',
  'sex',
  'tagNumber',
  'name',
  'breed',
  'dob',
  'imageUri',
  'status',
];

const PRIVILEGED_ACCOUNT_FIELDS: readonly (keyof UpdateFarmAccountInput)[] = [
  'role',
  'permissions',
  'canManageNetwork',
  'canSyncCloud',
  'status',
];

function isNetworkManager(account: FarmAccount | null): boolean {
  if (!account) return true;
  return isAdminAccount(account) || Boolean(account.canManageNetwork);
}

/**
 * Wraps a raw FarmDB session with server/repository-level RBAC enforcement so UI
 * bypasses, stale screens, or indirect updates (such as editing parent lineage from
 * Herd Registry) cannot elevate or circumvent account module privileges.
 */
export function wrapSessionWithRbac(
  raw: FarmDbContextValue
): FarmDbContextValue {
  async function getActiveActor(): Promise<FarmAccount | null> {
    const accounts = await raw.network.listAccountsRaw();
    if (accounts.length === 0) {
      return null;
    }
    return raw.network.getActiveAccount();
  }

  async function assertAccess(
    section: AppSectionId,
    mode: 'edit' | 'delete'
  ): Promise<void> {
    const activeAccount = await getActiveActor();
    if (!activeAccount) {
      return;
    }
    if (mode === 'edit' && !canAccountEditModule(activeAccount, section)) {
      throw new Error(
        `Permission denied: ${activeAccount.displayName} does not have Edit access to "${section}".`
      );
    }
    if (mode === 'delete' && !canAccountDeleteInModule(activeAccount, section)) {
      throw new Error(
        `Permission denied: ${activeAccount.displayName} requires Full Access to delete records in "${section}".`
      );
    }
  }

  async function assertNetworkAdmin(actionLabel: string): Promise<void> {
    const activeAccount = await getActiveActor();
    if (!activeAccount || isNetworkManager(activeAccount)) {
      return;
    }
    throw new Error(
      `Permission denied: ${activeAccount.displayName} does not have administrator permission to ${actionLabel}.`
    );
  }

  function guardMethod<
    T extends object,
    K extends keyof T & string,
  >(
    target: T,
    key: K,
    section: AppSectionId,
    mode: 'edit' | 'delete'
  ): T[K] {
    const original = target[key] as unknown as (
      ...args: unknown[]
    ) => Promise<unknown>;
    return (async (...args: unknown[]) => {
      await assertAccess(section, mode);
      return original.apply(target, args);
    }) as unknown as T[K];
  }

  const livestock: FarmDbContextValue['livestock'] = {
    ...raw.livestock,
    async create(input: NewLivestockInput) {
      await assertAccess('livestock', 'edit');
      if (input.sireId?.trim() || input.damId?.trim()) {
        await assertAccess('family_tree', 'edit');
      }
      return raw.livestock.create(input);
    },
    async update(id: string, input: UpdateLivestockInput) {
      const existing = await raw.livestock.getById(id);
      const sireChanged =
        input.sireId !== undefined &&
        (input.sireId || null) !== (existing?.sireId || null);
      const damChanged =
        input.damId !== undefined &&
        (input.damId || null) !== (existing?.damId || null);
      const lineageChanged = sireChanged || damChanged;

      const touchesNonLineage = NON_LINEAGE_LIVESTOCK_KEYS.some((key) => {
        if (!(key in input) || input[key] === undefined) {
          return false;
        }
        if (!existing) {
          return true;
        }
        return (input[key] ?? null) !== (existing[key] ?? null);
      });

      if (lineageChanged) {
        await assertAccess('family_tree', 'edit');
      }

      if (touchesNonLineage) {
        await assertAccess('livestock', 'edit');
      } else if (!lineageChanged) {
        const actor = await getActiveActor();
        const mentionsLineage = 'sireId' in input || 'damId' in input;
        if (mentionsLineage && actor && canAccountEditModule(actor, 'family_tree')) {
          // Pure lineage no-op save from Family Tree Editor is allowed for family_tree editors
        } else {
          await assertAccess('livestock', 'edit');
        }
      }

      return raw.livestock.update(id, input);
    },
    remove: guardMethod(raw.livestock, 'remove', 'livestock', 'delete'),
  };

  const ownerships: FarmDbContextValue['ownerships'] = {
    ...raw.ownerships,
    create: guardMethod(raw.ownerships, 'create', 'ownerships', 'edit'),
    update: guardMethod(raw.ownerships, 'update', 'ownerships', 'edit'),
    remove: guardMethod(raw.ownerships, 'remove', 'ownerships', 'delete'),
  };

  const production: FarmDbContextValue['production'] = {
    ...raw.production,
    create: guardMethod(raw.production, 'create', 'production', 'edit'),
    update: guardMethod(raw.production, 'update', 'production', 'edit'),
    remove: guardMethod(raw.production, 'remove', 'production', 'delete'),
  };

  const medical: FarmDbContextValue['medical'] = {
    ...raw.medical,
    create: guardMethod(raw.medical, 'create', 'medical', 'edit'),
    update: guardMethod(raw.medical, 'update', 'medical', 'edit'),
    remove: guardMethod(raw.medical, 'remove', 'medical', 'delete'),
  };

  const financial: FarmDbContextValue['financial'] = {
    ...raw.financial,
    create: guardMethod(raw.financial, 'create', 'financial', 'edit'),
    update: guardMethod(raw.financial, 'update', 'financial', 'edit'),
    remove: guardMethod(raw.financial, 'remove', 'financial', 'delete'),
  };

  const alerts: FarmDbContextValue['alerts'] = {
    ...raw.alerts,
    create: guardMethod(raw.alerts, 'create', 'alerts', 'edit'),
    update: guardMethod(raw.alerts, 'update', 'alerts', 'edit'),
    toggleResolved: guardMethod(
      raw.alerts,
      'toggleResolved',
      'alerts',
      'edit'
    ),
    remove: guardMethod(raw.alerts, 'remove', 'alerts', 'delete'),
  };

  const hr: FarmDbContextValue['hr'] = {
    ...raw.hr,
    createWorker: guardMethod(raw.hr, 'createWorker', 'hr', 'edit'),
    updateWorker: guardMethod(raw.hr, 'updateWorker', 'hr', 'edit'),
    removeWorker: guardMethod(raw.hr, 'removeWorker', 'hr', 'delete'),
    createPayment: guardMethod(raw.hr, 'createPayment', 'hr', 'edit'),
    updatePayment: guardMethod(raw.hr, 'updatePayment', 'hr', 'edit'),
    markPaymentPaid: guardMethod(raw.hr, 'markPaymentPaid', 'hr', 'edit'),
    removePayment: guardMethod(raw.hr, 'removePayment', 'hr', 'delete'),
    createTask: guardMethod(raw.hr, 'createTask', 'hr', 'edit'),
    updateTask: guardMethod(raw.hr, 'updateTask', 'hr', 'edit'),
    removeTask: guardMethod(raw.hr, 'removeTask', 'hr', 'delete'),
  };

  const settings: FarmDbContextValue['settings'] = {
    ...raw.settings,
    update: guardMethod(raw.settings, 'update', 'settings', 'edit'),
    restoreSettings: guardMethod(
      raw.settings,
      'restoreSettings',
      'settings',
      'delete'
    ),
    reset: guardMethod(raw.settings, 'reset', 'settings', 'delete'),
  };

  const backup: FarmDbContextValue['backup'] = {
    ...raw.backup,
    restoreSnapshot: guardMethod(
      raw.backup,
      'restoreSnapshot',
      'backup',
      'delete'
    ),
  };

  const network: FarmDbContextValue['network'] = {
    ...raw.network,
    async createAccount(input) {
      await assertNetworkAdmin('create farm accounts');
      return raw.network.createAccount(input);
    },
    signUpAccount: raw.network.signUpAccount,
    async updateAccount(id, input) {
      const actor = await getActiveActor();
      if (actor && !isNetworkManager(actor)) {
        if (id !== actor.id) {
          throw new Error(
            `Permission denied: ${actor.displayName} cannot modify another member's account.`
          );
        }
        const attemptsPrivilegeChange = PRIVILEGED_ACCOUNT_FIELDS.some(
          (field) => field in input && input[field] !== undefined
        );
        if (attemptsPrivilegeChange) {
          throw new Error(
            `Permission denied: ${actor.displayName} cannot change account roles, permissions, or network privileges.`
          );
        }
      }
      return raw.network.updateAccount(id, input);
    },
    async removeAccount(id) {
      const actor = await getActiveActor();
      if (actor && !isNetworkManager(actor) && actor.id !== id) {
        throw new Error(
          `Permission denied: ${actor.displayName} does not have administrator permission to delete another member's account.`
        );
      }
      return raw.network.removeAccount(id);
    },
    removeAccountWithCredentials: raw.network.removeAccountWithCredentials,
    async rotateNetworkJoinKey() {
      await assertNetworkAdmin('rotate Farm Network join keys');
      return raw.network.rotateNetworkJoinKey();
    },
    async acceptPendingAccount(accountId, options) {
      await assertNetworkAdmin('approve pending farm accounts');
      return raw.network.acceptPendingAccount(accountId, options);
    },
    async clearSyncLogs() {
      const actor = await getActiveActor();
      if (actor && !isNetworkManager(actor) && !actor.canSyncCloud) {
        throw new Error(
          `Permission denied: ${actor.displayName} does not have permission to clear cloud sync logs.`
        );
      }
      return raw.network.clearSyncLogs();
    },
  };

  return {
    ...raw,
    livestock,
    ownerships,
    production,
    medical,
    financial,
    alerts,
    hr,
    settings,
    backup,
    network,
  };
}
