import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  canAccountDeleteInModule,
  canAccountEditModule,
  canAccountViewModule,
  formatAlertNotificationContent,
  formatPaymentAlertNotification,
  getAccountModuleAccess,
  isAdminAccount,
  type AlertFilter,
  type AlertItem,
  type AnimalOwnership,
  type AnimalOwnershipFilter,
  type AppSectionId,
  type CloudSyncDirection,
  type CloudSyncLog,
  type FarmAccount,
  type FarmAccountFilter,
  type FarmModuleAccessLevel,
  type FarmSettings,
  type FarmWorker,
  type FarmWorkerFilter,
  type FinancialLog,
  type FinancialLogFilter,
  type HrDuePaymentAlertItem,
  type Livestock,
  type LivestockFilter,
  type MedicalRecord,
  type MedicalRecordFilter,
  type NewAlertInput,
  type NewAnimalOwnershipInput,
  type NewFarmAccountInput,
  type NewFarmWorkerInput,
  type NewFinancialLogInput,
  type NewLivestockInput,
  type NewMedicalRecordInput,
  type NewProductRecordInput,
  type NewWorkerPaymentInput,
  type NewWorkerTaskInput,
  type ProductRecord,
  type ProductRecordFilter,
  type UpdateAlertInput,
  type UpdateAnimalOwnershipInput,
  type UpdateFarmAccountInput,
  type UpdateFarmWorkerInput,
  type UpdateFinancialLogInput,
  type UpdateLivestockInput,
  type UpdateMedicalRecordInput,
  type UpdateProductRecordInput,
  type UpdateWorkerPaymentInput,
  type UpdateWorkerTaskInput,
  type WorkerPayment,
  type WorkerPaymentFilter,
  type WorkerTask,
  type WorkerTaskFilter,
} from '@farmdb/core';
import {
  createDrizzleClient,
  type FarmDrizzleDb,
  type SqlDriver,
  type SqlDriverKind,
} from './driver';
import {
  attachQueryInvalidation,
  DatabaseEventBus,
  FARMDB_QUERY_KEYS,
} from './events';
import { wrapSessionWithRbac } from './rbac';
import {
  createAlertsRepository,
  type AlertsRepository,
} from './repositories/alertsRepository';
import {
  createBackupRepository,
  type BackupRepository,
} from './repositories/backupRepository';
import {
  createFinancialRepository,
  type FinancialRepository,
} from './repositories/financialRepository';
import {
  createHrRepository,
  type CreateWorkerPaymentOptions,
  type CreateWorkerPaymentResult,
  type HrRepository,
  type MarkWorkerPaymentPaidOptions,
} from './repositories/hrRepository';
import {
  createLivestockRepository,
  type FarmSummary,
  type LivestockRepository,
} from './repositories/livestockRepository';
import {
  createMedicalRepository,
  type CreateMedicalRecordOptions,
  type CreateMedicalRecordResult,
  type MedicalRepository,
} from './repositories/medicalRepository';
import {
  createNetworkRepository,
  type AcceptPendingAccountOptions,
  type CloudSyncResult,
  type JoinFarmNetworkInput,
  type JoinFarmNetworkResult,
  type LeaveFarmNetworkResult,
  type NetworkRepository,
  type RecoverAdminCloudInput,
  type RecoverAdminCloudResult,
} from './repositories/networkRepository';
import {
  createOwnershipRepository,
  type OwnershipRepository,
} from './repositories/ownershipRepository';
import {
  createProductionRepository,
  type CreateProductRecordResult,
  type LogMilkYieldOptions,
  type ProductionRepository,
} from './repositories/productionRepository';
import {
  createSettingsRepository,
  type SettingsRepository,
} from './repositories/settingsRepository';

export interface FarmDbContextValue {
  driverKind: SqlDriverKind;
  db?: FarmDrizzleDb;
  driver?: SqlDriver;
  events: DatabaseEventBus;
  livestock: LivestockRepository;
  ownerships: OwnershipRepository;
  production: ProductionRepository;
  medical: MedicalRepository;
  financial: FinancialRepository;
  alerts: AlertsRepository;
  hr: HrRepository;
  network: NetworkRepository;
  settings: SettingsRepository;
  backup: BackupRepository;
}

const FarmDbContext = createContext<FarmDbContextValue | null>(null);

export function createOfflineQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: 'always',
        staleTime: Infinity,
        gcTime: 1000 * 60 * 10,
        retry: false,
      },
      mutations: {
        networkMode: 'always',
        retry: false,
      },
    },
  });
}

export interface FarmDbSessionOptions {
  autoSeedDefaultAdmin?: boolean;
}

export function createFarmDbSession(
  driver: SqlDriver,
  options?: FarmDbSessionOptions
): FarmDbContextValue {
  const db = createDrizzleClient(driver);
  const events = new DatabaseEventBus();
  const livestock = createLivestockRepository(db, events);
  const ownerships = createOwnershipRepository(db, events);
  const settings = createSettingsRepository(db, events);
  const financial = createFinancialRepository(db, events);
  const production = createProductionRepository(
    db,
    events,
    financial,
    settings
  );
  const medical = createMedicalRepository(db, events, financial);
  const alerts = createAlertsRepository(db, events);
  const hr = createHrRepository(db, events, financial);
  let backup!: BackupRepository;
  const network = createNetworkRepository(
    db,
    events,
    settings,
    () => backup,
    undefined,
    { autoSeedDefaultAdmin: options?.autoSeedDefaultAdmin }
  );
  backup = createBackupRepository(db, events, {
    livestock,
    production,
    medical,
    financial,
    alerts,
    hr,
    ownerships,
    network,
    settings,
  });

  return wrapSessionWithRbac({
    driverKind: driver.kind,
    db,
    driver,
    events,
    livestock,
    ownerships,
    production,
    medical,
    financial,
    alerts,
    hr,
    network,
    settings,
    backup,
  });
}

export interface FarmDbProviderProps {
  driver?: SqlDriver;
  session?: FarmDbContextValue;
  queryClient?: QueryClient;
  autoSeedDefaultAdmin?: boolean;
  children: React.ReactNode;
}

export function FarmDbProvider({
  driver,
  session: externalSession,
  queryClient: externalQueryClient,
  autoSeedDefaultAdmin,
  children,
}: FarmDbProviderProps) {
  const queryClient = useMemo(
    () => externalQueryClient ?? createOfflineQueryClient(),
    [externalQueryClient]
  );

  const session = useMemo(() => {
    if (externalSession) {
      return externalSession;
    }
    if (!driver) {
      throw new Error('FarmDbProvider requires either `driver` or `session`.');
    }
    return createFarmDbSession(driver, { autoSeedDefaultAdmin });
  }, [driver, externalSession, autoSeedDefaultAdmin]);

  useEffect(() => {
    const detach = attachQueryInvalidation(session.events, queryClient);
    return detach;
  }, [session.events, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <FarmDbContext.Provider value={session}>
        {children}
      </FarmDbContext.Provider>
    </QueryClientProvider>
  );
}

export function useFarmDb(): FarmDbContextValue {
  const ctx = useContext(FarmDbContext);
  if (!ctx) {
    throw new Error('useFarmDb must be used inside <FarmDbProvider>.');
  }
  return ctx;
}

export function useLivestockList(filter?: LivestockFilter) {
  const { livestock } = useFarmDb();
  return useQuery<Livestock[]>({
    queryKey: FARMDB_QUERY_KEYS.livestockList(filter),
    queryFn: () => livestock.list(filter),
  });
}

export function useLivestockDetail(id: string | null) {
  const { livestock } = useFarmDb();
  return useQuery<Livestock | null>({
    queryKey: FARMDB_QUERY_KEYS.livestockDetail(id ?? '__none__'),
    queryFn: () => (id ? livestock.getById(id) : Promise.resolve(null)),
    enabled: Boolean(id),
  });
}

export function useFarmSummary() {
  const { livestock } = useFarmDb();
  return useQuery<FarmSummary>({
    queryKey: FARMDB_QUERY_KEYS.summary(),
    queryFn: () => livestock.getSummary(),
  });
}

export function useCreateLivestock() {
  const { livestock } = useFarmDb();
  return useMutation<Livestock, Error, NewLivestockInput>({
    mutationFn: (input) => livestock.create(input),
  });
}

export function useUpdateLivestock() {
  const { livestock } = useFarmDb();
  return useMutation<Livestock, Error, { id: string; input: UpdateLivestockInput }>({
    mutationFn: ({ id, input }) => livestock.update(id, input),
  });
}

export function useDeleteLivestock() {
  const { livestock } = useFarmDb();
  return useMutation<boolean, Error, string>({
    mutationFn: (id) => livestock.remove(id),
  });
}

export function useFarmSettings() {
  const { settings } = useFarmDb();
  return useQuery<FarmSettings>({
    queryKey: FARMDB_QUERY_KEYS.settings(),
    queryFn: () => settings.get(),
  });
}

export function useUpdateFarmSettings() {
  const { settings } = useFarmDb();
  return useMutation<FarmSettings, Error, Partial<FarmSettings>>({
    mutationFn: (input) => settings.update(input),
  });
}

export function useResetFarmSettings() {
  const { settings } = useFarmDb();
  return useMutation<FarmSettings, Error, void>({
    mutationFn: () => settings.reset(),
  });
}

export function useProductRecordList(filter?: ProductRecordFilter) {
  const { production } = useFarmDb();
  return useQuery<ProductRecord[]>({
    queryKey: FARMDB_QUERY_KEYS.productionList(filter),
    queryFn: () => production.list(filter),
  });
}

export function useCreateProductRecord() {
  const { production } = useFarmDb();
  return useMutation<
    CreateProductRecordResult,
    Error,
    { input: NewProductRecordInput; options?: LogMilkYieldOptions }
  >({
    mutationFn: ({ input, options }) => production.create(input, options),
  });
}

export function useUpdateProductRecord() {
  const { production } = useFarmDb();
  return useMutation<
    ProductRecord,
    Error,
    { id: string; input: UpdateProductRecordInput }
  >({
    mutationFn: ({ id, input }) => production.update(id, input),
  });
}

export function useDeleteProductRecord() {
  const { production } = useFarmDb();
  return useMutation<boolean, Error, string>({
    mutationFn: (id) => production.remove(id),
  });
}

export function useMedicalRecordList(filter?: MedicalRecordFilter) {
  const { medical } = useFarmDb();
  return useQuery<MedicalRecord[]>({
    queryKey: FARMDB_QUERY_KEYS.medicalList(filter),
    queryFn: () => medical.list(filter),
  });
}

export function useCreateMedicalRecord() {
  const { medical } = useFarmDb();
  return useMutation<
    CreateMedicalRecordResult,
    Error,
    { input: NewMedicalRecordInput; options?: CreateMedicalRecordOptions }
  >({
    mutationFn: ({ input, options }) => medical.create(input, options),
  });
}

export function useUpdateMedicalRecord() {
  const { medical } = useFarmDb();
  return useMutation<
    MedicalRecord,
    Error,
    { id: string; input: UpdateMedicalRecordInput }
  >({
    mutationFn: ({ id, input }) => medical.update(id, input),
  });
}

export function useDeleteMedicalRecord() {
  const { medical } = useFarmDb();
  return useMutation<boolean, Error, string>({
    mutationFn: (id) => medical.remove(id),
  });
}

export function useFinancialLogList(filter?: FinancialLogFilter) {
  const { financial } = useFarmDb();
  return useQuery<FinancialLog[]>({
    queryKey: FARMDB_QUERY_KEYS.financialList(filter),
    queryFn: () => financial.list(filter),
  });
}

export function useCreateFinancialLog() {
  const { financial } = useFarmDb();
  return useMutation<FinancialLog, Error, NewFinancialLogInput>({
    mutationFn: (input) => financial.create(input),
  });
}

export function useUpdateFinancialLog() {
  const { financial } = useFarmDb();
  return useMutation<
    FinancialLog,
    Error,
    { id: string; input: UpdateFinancialLogInput }
  >({
    mutationFn: ({ id, input }) => financial.update(id, input),
  });
}

export function useDeleteFinancialLog() {
  const { financial } = useFarmDb();
  return useMutation<boolean, Error, string>({
    mutationFn: (id) => financial.remove(id),
  });
}

export function useAlertList(filter?: AlertFilter) {
  const { alerts } = useFarmDb();
  return useQuery<AlertItem[]>({
    queryKey: FARMDB_QUERY_KEYS.alertsList(filter),
    queryFn: () => alerts.list(filter),
  });
}

export function useCreateAlert() {
  const { alerts } = useFarmDb();
  return useMutation<AlertItem, Error, NewAlertInput>({
    mutationFn: (input) => alerts.create(input),
  });
}

export function useUpdateAlert() {
  const { alerts } = useFarmDb();
  return useMutation<AlertItem, Error, { id: string; input: UpdateAlertInput }>({
    mutationFn: ({ id, input }) => alerts.update(id, input),
  });
}

export function useToggleAlertResolved() {
  const { alerts } = useFarmDb();
  return useMutation<AlertItem, Error, { id: string; isResolved: boolean }>({
    mutationFn: ({ id, isResolved }) => alerts.toggleResolved(id, isResolved),
  });
}

export function useDeleteAlert() {
  const { alerts } = useFarmDb();
  return useMutation<boolean, Error, string>({
    mutationFn: (id) => alerts.remove(id),
  });
}

export function useWorkerList(filter?: FarmWorkerFilter) {
  const { hr } = useFarmDb();
  return useQuery<FarmWorker[]>({
    queryKey: FARMDB_QUERY_KEYS.workersList(filter),
    queryFn: () => hr.listWorkers(filter),
  });
}

export function useCreateWorker() {
  const { hr } = useFarmDb();
  return useMutation<FarmWorker, Error, NewFarmWorkerInput>({
    mutationFn: (input) => hr.createWorker(input),
  });
}

export function useUpdateWorker() {
  const { hr } = useFarmDb();
  return useMutation<FarmWorker, Error, { id: string; input: UpdateFarmWorkerInput }>({
    mutationFn: ({ id, input }) => hr.updateWorker(id, input),
  });
}

export function useDeleteWorker() {
  const { hr } = useFarmDb();
  return useMutation<boolean, Error, string>({
    mutationFn: (id) => hr.removeWorker(id),
  });
}

export function useWorkerPaymentList(filter?: WorkerPaymentFilter) {
  const { hr } = useFarmDb();
  return useQuery<WorkerPayment[]>({
    queryKey: FARMDB_QUERY_KEYS.workerPaymentsList(filter),
    queryFn: () => hr.listPayments(filter),
  });
}

export function useCreateWorkerPayment() {
  const { hr } = useFarmDb();
  return useMutation<
    CreateWorkerPaymentResult,
    Error,
    { input: NewWorkerPaymentInput; options?: CreateWorkerPaymentOptions }
  >({
    mutationFn: ({ input, options }) => hr.createPayment(input, options),
  });
}

export function useUpdateWorkerPayment() {
  const { hr } = useFarmDb();
  return useMutation<
    WorkerPayment,
    Error,
    { id: string; input: UpdateWorkerPaymentInput }
  >({
    mutationFn: ({ id, input }) => hr.updatePayment(id, input),
  });
}

export function useMarkWorkerPaymentPaid() {
  const { hr } = useFarmDb();
  return useMutation<
    CreateWorkerPaymentResult,
    Error,
    { id: string; options?: MarkWorkerPaymentPaidOptions }
  >({
    mutationFn: ({ id, options }) => hr.markPaymentPaid(id, options),
  });
}

export function useDeleteWorkerPayment() {
  const { hr } = useFarmDb();
  return useMutation<boolean, Error, string>({
    mutationFn: (id) => hr.removePayment(id),
  });
}

export function useWorkerTaskList(filter?: WorkerTaskFilter) {
  const { hr } = useFarmDb();
  return useQuery<WorkerTask[]>({
    queryKey: FARMDB_QUERY_KEYS.workerTasksList(filter),
    queryFn: () => hr.listTasks(filter),
  });
}

export function useCreateWorkerTask() {
  const { hr } = useFarmDb();
  return useMutation<WorkerTask, Error, NewWorkerTaskInput>({
    mutationFn: (input) => hr.createTask(input),
  });
}

export function useUpdateWorkerTask() {
  const { hr } = useFarmDb();
  return useMutation<WorkerTask, Error, { id: string; input: UpdateWorkerTaskInput }>({
    mutationFn: ({ id, input }) => hr.updateTask(id, input),
  });
}

export function useDeleteWorkerTask() {
  const { hr } = useFarmDb();
  return useMutation<boolean, Error, string>({
    mutationFn: (id) => hr.removeTask(id),
  });
}

export interface AlertNotificationPayload {
  kind?: 'alert' | 'hr_payment';
  alert?: AlertItem;
  paymentAlert?: HrDuePaymentAlertItem;
  title: string;
  body: string;
}

export interface AlertNotificationDispatcher {
  deliver(payload: AlertNotificationPayload): Promise<boolean>;
}

/**
 * Checks SQLite for due livestock alerts AND due/almost-due worker salary
 * payments, dispatches local notifications, and marks delivered rows.
 */
export async function runDueAlertCheck(
  session: FarmDbContextValue,
  dispatcher: AlertNotificationDispatcher,
  todayIso?: string
): Promise<AlertNotificationPayload[]> {
  const currentSettings = await session.settings.get();
  const [dueAlerts, duePayments] = await Promise.all([
    session.alerts.listDueForNotification(todayIso),
    session.hr.listDuePaymentNotifications(
      todayIso,
      currentSettings.paymentAlertLeadDays
    ),
  ]);

  if (dueAlerts.length === 0 && duePayments.length === 0) {
    return [];
  }

  const animals = dueAlerts.length > 0 ? await session.livestock.list({}) : [];
  const animalsById = new Map(animals.map((a) => [a.id, a]));
  const delivered: AlertNotificationPayload[] = [];
  const deliveredAlertIds: string[] = [];
  const deliveredPayments: HrDuePaymentAlertItem[] = [];

  for (const alert of dueAlerts) {
    const animal = alert.livestockId
      ? animalsById.get(alert.livestockId) ?? null
      : null;
    const { title, body } = formatAlertNotificationContent(alert, animal);
    const payload: AlertNotificationPayload = {
      kind: 'alert',
      alert,
      title,
      body,
    };

    const ok = await dispatcher.deliver(payload);
    if (ok) {
      delivered.push(payload);
      deliveredAlertIds.push(alert.id);
    }
  }

  if (deliveredAlertIds.length > 0) {
    await session.alerts.markNotified(deliveredAlertIds);
  }

  for (const item of duePayments) {
    const { title, body } = formatPaymentAlertNotification(
      item,
      currentSettings.currencySymbol
    );
    const payload: AlertNotificationPayload = {
      kind: 'hr_payment',
      paymentAlert: item,
      title,
      body,
    };
    const ok = await dispatcher.deliver(payload);
    if (ok) {
      delivered.push(payload);
      deliveredPayments.push(item);
    }
  }

  if (deliveredPayments.length > 0) {
    await session.hr.markPaymentNotificationsDelivered(deliveredPayments);
  }

  return delivered;
}

export function useAlertBackgroundWorker(
  dispatcher: AlertNotificationDispatcher,
  options?: {
    enabled?: boolean;
    intervalMs?: number;
    onDelivered?: (items: AlertNotificationPayload[]) => void;
  }
) {
  const session = useFarmDb();
  const dispatcherRef = useRef(dispatcher);
  dispatcherRef.current = dispatcher;
  const onDeliveredRef = useRef(options?.onDelivered);
  onDeliveredRef.current = options?.onDelivered;
  const inFlightRef = useRef(false);

  const checkNow = useCallback(async (): Promise<AlertNotificationPayload[]> => {
    if (inFlightRef.current) {
      return [];
    }
    inFlightRef.current = true;
    try {
      const delivered = await runDueAlertCheck(session, dispatcherRef.current);
      if (delivered.length > 0) {
        onDeliveredRef.current?.(delivered);
      }
      return delivered;
    } finally {
      inFlightRef.current = false;
    }
  }, [session]);

  const enabled = options?.enabled ?? true;
  const intervalMs = Math.max(15_000, options?.intervalMs ?? 60_000);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void checkNow();
    const timer = setInterval(() => {
      void checkNow();
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [checkNow, enabled, intervalMs]);

  return { checkNow };
}

export function useOwnershipList(filter?: AnimalOwnershipFilter) {
  const { ownerships } = useFarmDb();
  return useQuery<AnimalOwnership[]>({
    queryKey: FARMDB_QUERY_KEYS.ownershipsList(filter),
    queryFn: () => ownerships.list(filter),
  });
}

export function useCreateOwnership() {
  const { ownerships } = useFarmDb();
  return useMutation<AnimalOwnership, Error, NewAnimalOwnershipInput>({
    mutationFn: (input) => ownerships.create(input),
  });
}

export function useUpdateOwnership() {
  const { ownerships } = useFarmDb();
  return useMutation<
    AnimalOwnership,
    Error,
    { id: string; input: UpdateAnimalOwnershipInput }
  >({
    mutationFn: ({ id, input }) => ownerships.update(id, input),
  });
}

export function useDeleteOwnership() {
  const { ownerships } = useFarmDb();
  return useMutation<boolean, Error, string>({
    mutationFn: (id) => ownerships.remove(id),
  });
}

export function useFarmAccountList(filter?: FarmAccountFilter) {
  const { network } = useFarmDb();
  return useQuery<FarmAccount[]>({
    queryKey: FARMDB_QUERY_KEYS.accountsList(filter),
    queryFn: () => network.listAccounts(filter),
  });
}

export function useLocalSignInAccounts() {
  const { network } = useFarmDb();
  return useQuery<FarmAccount[]>({
    queryKey: FARMDB_QUERY_KEYS.localSignInAccounts(),
    queryFn: () => network.listLocalSignInAccounts(),
  });
}

export function useActiveFarmAccount() {
  const { network } = useFarmDb();
  return useQuery<FarmAccount | null>({
    queryKey: FARMDB_QUERY_KEYS.activeAccount(),
    queryFn: () => network.getActiveAccount(),
  });
}

export interface ModulePermissionsState {
  accessLevel: FarmModuleAccessLevel;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isAdmin: boolean;
  activeAccount: FarmAccount | null | undefined;
}

export function useModulePermissions(
  section: AppSectionId
): ModulePermissionsState {
  const { data: activeAccount } = useActiveFarmAccount();
  const accessLevel = getAccountModuleAccess(activeAccount, section);
  return {
    accessLevel,
    canView: canAccountViewModule(activeAccount, section),
    canEdit: canAccountEditModule(activeAccount, section),
    canDelete: canAccountDeleteInModule(activeAccount, section),
    isAdmin: isAdminAccount(activeAccount),
    activeAccount,
  };
}

export function useSwitchFarmAccount() {
  const { network } = useFarmDb();
  return useMutation<
    FarmAccount,
    Error,
    { accountId: string; accessCode?: string }
  >({
    mutationFn: ({ accountId, accessCode }) =>
      network.switchActiveAccount(accountId, accessCode),
  });
}

export function useCreateFarmAccount() {
  const { network } = useFarmDb();
  return useMutation<FarmAccount, Error, NewFarmAccountInput>({
    mutationFn: (input) => network.createAccount(input),
  });
}

export function useSignUpFarmAccount() {
  const { network } = useFarmDb();
  return useMutation<FarmAccount, Error, NewFarmAccountInput>({
    mutationFn: (input) => network.signUpAccount(input),
  });
}

export function useUpdateFarmAccount() {
  const { network } = useFarmDb();
  return useMutation<
    FarmAccount,
    Error,
    { id: string; input: UpdateFarmAccountInput }
  >({
    mutationFn: ({ id, input }) => network.updateAccount(id, input),
  });
}

export function useDeleteFarmAccount() {
  const { network } = useFarmDb();
  return useMutation<boolean, Error, string>({
    mutationFn: (id) => network.removeAccount(id),
  });
}

export function useDeleteFarmAccountWithCredentials() {
  const { network } = useFarmDb();
  return useMutation<
    boolean,
    Error,
    { accountId: string; accessCode?: string }
  >({
    mutationFn: ({ accountId, accessCode }) =>
      network.removeAccountWithCredentials(accountId, accessCode),
  });
}

export function useRotateNetworkJoinKey() {
  const { network } = useFarmDb();
  return useMutation<string, Error, void>({
    mutationFn: () => network.rotateNetworkJoinKey(),
  });
}

export function useJoinFarmNetwork() {
  const { network } = useFarmDb();
  return useMutation<JoinFarmNetworkResult, Error, JoinFarmNetworkInput>({
    mutationFn: (input) => network.joinNetworkWithKey(input),
  });
}

export function useLeaveFarmNetwork() {
  const { network } = useFarmDb();
  return useMutation<LeaveFarmNetworkResult, Error, string>({
    mutationFn: (accountId) => network.leaveNetwork(accountId),
  });
}

export function useRefreshFarmDb() {
  const session = useFarmDb();
  const queryClient = useQueryClient();
  return useCallback(async () => {
    session.events.emit(['*']);
    await queryClient.invalidateQueries();
    await queryClient.refetchQueries({ type: 'all' });
  }, [session, queryClient]);
}

export function useRecoverAdminFromCloud() {
  const { network } = useFarmDb();
  return useMutation<RecoverAdminCloudResult, Error, RecoverAdminCloudInput>({
    mutationFn: (input) => network.recoverAdminFromCloud(input),
  });
}

export function useAcceptPendingAccount() {
  const { network } = useFarmDb();
  return useMutation<
    FarmAccount,
    Error,
    { accountId: string; options?: AcceptPendingAccountOptions }
  >({
    mutationFn: ({ accountId, options }) =>
      network.acceptPendingAccount(accountId, options),
  });
}

export function useCloudSyncLogs(limit = 25) {
  const { network } = useFarmDb();
  return useQuery<CloudSyncLog[]>({
    queryKey: FARMDB_QUERY_KEYS.cloudSyncLogs(limit),
    queryFn: () => network.listSyncLogs(limit),
  });
}

export function useClearCloudSyncLogs() {
  const { network } = useFarmDb();
  return useMutation<void, Error, void>({
    mutationFn: () => network.clearSyncLogs(),
  });
}

export function useTriggerCloudSync() {
  const { network } = useFarmDb();
  return useMutation<CloudSyncResult, Error, CloudSyncDirection>({
    mutationFn: (direction) => network.syncWithSupabase(direction),
  });
}

/**
 * Automatically syncs local SQLite with Supabase when cloud sync + auto-sync
 * are enabled and the device connects to the internet.
 */
export function useCloudAutoSyncWorker(
  settings: FarmSettings,
  options?: {
    canSyncAccount?: boolean;
    onSynced?: (result: CloudSyncResult) => void;
  }
) {
  const { network } = useFarmDb();
  const inFlightRef = useRef(false);
  const onSyncedRef = useRef(options?.onSynced);
  onSyncedRef.current = options?.onSynced;

  const canAutoSync = Boolean(
    options?.canSyncAccount !== false &&
      settings.cloudSyncEnabled &&
      settings.autoSyncOnInternet &&
      settings.supabaseUrl.trim().length > 0 &&
      settings.supabaseAnonKey.trim().length > 0
  );

  const syncNow = useCallback(async (): Promise<CloudSyncResult | null> => {
    if (!canAutoSync || inFlightRef.current) {
      return null;
    }
    if (
      typeof navigator !== 'undefined' &&
      (navigator as unknown as { onLine?: boolean }).onLine === false
    ) {
      return null;
    }
    inFlightRef.current = true;
    try {
      const result = await network.syncWithSupabase('bidirectional');
      onSyncedRef.current?.(result);
      return result;
    } finally {
      inFlightRef.current = false;
    }
  }, [canAutoSync, network]);

  useEffect(() => {
    if (!canAutoSync) {
      return;
    }

    const intervalMs = Math.max(
      30_000,
      (settings.cloudSyncIntervalSeconds || 120) * 1000
    );

    const handleOnline = () => {
      void syncNow();
    };

    const g = globalThis as unknown as {
      addEventListener?: (t: string, l: () => void) => void;
      removeEventListener?: (t: string, l: () => void) => void;
    };
    g.addEventListener?.('online', handleOnline);

    const initialTimer = setTimeout(() => {
      void syncNow().catch(() => {});
    }, 2500);

    const timer = setInterval(() => {
      void syncNow().catch(() => {});
    }, intervalMs);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(timer);
      g.removeEventListener?.('online', handleOnline);
    };
  }, [canAutoSync, settings.cloudSyncIntervalSeconds, syncNow]);

  return { syncNow };
}

