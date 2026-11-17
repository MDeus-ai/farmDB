import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from '@tanstack/react-query';
import {
  formatAlertNotificationContent,
  type AlertFilter,
  type AlertItem,
  type FarmSettings,
  type FinancialLog,
  type FinancialLogFilter,
  type Livestock,
  type LivestockFilter,
  type MedicalRecord,
  type MedicalRecordFilter,
  type NewAlertInput,
  type NewFinancialLogInput,
  type NewLivestockInput,
  type NewMedicalRecordInput,
  type NewProductRecordInput,
  type ProductRecord,
  type ProductRecordFilter,
  type UpdateAlertInput,
  type UpdateFinancialLogInput,
  type UpdateLivestockInput,
  type UpdateMedicalRecordInput,
  type UpdateProductRecordInput,
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
  production: ProductionRepository;
  medical: MedicalRepository;
  financial: FinancialRepository;
  alerts: AlertsRepository;
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

export function createFarmDbSession(driver: SqlDriver): FarmDbContextValue {
  const db = createDrizzleClient(driver);
  const events = new DatabaseEventBus();
  const livestock = createLivestockRepository(db, events);
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
  const backup = createBackupRepository(db, events, {
    livestock,
    production,
    medical,
    financial,
    alerts,
    settings,
  });

  return {
    driverKind: driver.kind,
    db,
    driver,
    events,
    livestock,
    production,
    medical,
    financial,
    alerts,
    settings,
    backup,
  };
}

export interface FarmDbProviderProps {
  driver?: SqlDriver;
  session?: FarmDbContextValue;
  queryClient?: QueryClient;
  children: React.ReactNode;
}

export function FarmDbProvider({
  driver,
  session: externalSession,
  queryClient: externalQueryClient,
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
    return createFarmDbSession(driver);
  }, [driver, externalSession]);

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

export interface AlertNotificationPayload {
  alert: AlertItem;
  title: string;
  body: string;
}

export interface AlertNotificationDispatcher {
  deliver(payload: AlertNotificationPayload): Promise<boolean>;
}

/**
 * Checks SQLite for due, unresolved, unnotified alerts, dispatches local
 * notifications through the platform adapter, and marks delivered rows.
 */
export async function runDueAlertCheck(
  session: FarmDbContextValue,
  dispatcher: AlertNotificationDispatcher,
  todayIso?: string
): Promise<AlertNotificationPayload[]> {
  const dueAlerts = await session.alerts.listDueForNotification(todayIso);
  if (dueAlerts.length === 0) {
    return [];
  }

  const animals = await session.livestock.list({});
  const animalsById = new Map(animals.map((a) => [a.id, a]));
  const delivered: AlertNotificationPayload[] = [];
  const deliveredIds: string[] = [];

  for (const alert of dueAlerts) {
    const animal = alert.livestockId
      ? animalsById.get(alert.livestockId) ?? null
      : null;
    const { title, body } = formatAlertNotificationContent(alert, animal);
    const payload: AlertNotificationPayload = { alert, title, body };

    const ok = await dispatcher.deliver(payload);
    if (ok) {
      delivered.push(payload);
      deliveredIds.push(alert.id);
    }
  }

  if (deliveredIds.length > 0) {
    await session.alerts.markNotified(deliveredIds);
  }

  return delivered;
}

export function useAlertBackgroundWorker(
  dispatcher: AlertNotificationDispatcher,
  options?: { intervalMs?: number; onDelivered?: (items: AlertNotificationPayload[]) => void }
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

  const intervalMs = options?.intervalMs ?? 60_000;

  useEffect(() => {
    void checkNow();
    const timer = setInterval(() => {
      void checkNow();
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [checkNow, intervalMs]);

  return { checkNow };
}
