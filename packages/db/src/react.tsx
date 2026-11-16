import React, { createContext, useContext, useEffect, useMemo } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from '@tanstack/react-query';
import type {
  Livestock,
  LivestockFilter,
  NewLivestockInput,
  UpdateLivestockInput,
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
  createLivestockRepository,
  type FarmSummary,
  type LivestockRepository,
} from './repositories/livestockRepository';

export interface FarmDbContextValue {
  driverKind: SqlDriverKind;
  db?: FarmDrizzleDb;
  events: DatabaseEventBus;
  livestock: LivestockRepository;
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

  return {
    driverKind: driver.kind,
    db,
    events,
    livestock,
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
