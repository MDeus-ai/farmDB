import type { QueryClient } from '@tanstack/react-query';

export type DbChangeScope =
  | 'livestock'
  | 'production'
  | 'medical'
  | 'financial'
  | 'alerts'
  | 'settings'
  | '*';

export interface DbChangeEvent {
  scopes: readonly DbChangeScope[];
  entityId?: string;
  timestamp: number;
}

export type DbChangeListener = (event: DbChangeEvent) => void;

export const FARMDB_QUERY_KEYS = {
  all: ['farmdb'] as const,
  summary: () => ['farmdb', 'summary'] as const,
  livestockAll: () => ['farmdb', 'livestock'] as const,
  livestockList: (filter?: unknown) => ['farmdb', 'livestock', 'list', filter ?? {}] as const,
  livestockDetail: (id: string) => ['farmdb', 'livestock', 'detail', id] as const,
  productionAll: () => ['farmdb', 'production'] as const,
  productionList: (filter?: unknown) => ['farmdb', 'production', 'list', filter ?? {}] as const,
  medicalAll: () => ['farmdb', 'medical'] as const,
  medicalList: (filter?: unknown) => ['farmdb', 'medical', 'list', filter ?? {}] as const,
  financialAll: () => ['farmdb', 'financial'] as const,
  financialList: (filter?: unknown) => ['farmdb', 'financial', 'list', filter ?? {}] as const,
  alertsAll: () => ['farmdb', 'alerts'] as const,
  alertsList: (filter?: unknown) => ['farmdb', 'alerts', 'list', filter ?? {}] as const,
  alertsDue: () => ['farmdb', 'alerts', 'due'] as const,
  settings: () => ['farmdb', 'settings'] as const,
};

export class DatabaseEventBus {
  private listeners = new Set<DbChangeListener>();

  subscribe(listener: DbChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(scopes: readonly DbChangeScope[], entityId?: string): void {
    const event: DbChangeEvent = {
      scopes,
      entityId,
      timestamp: Date.now(),
    };
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

/**
 * Connects local SQLite write events to TanStack Query cache invalidation so
 * only React / React Native components displaying affected slices re-render.
 */
export function attachQueryInvalidation(
  bus: DatabaseEventBus,
  queryClient: QueryClient
): () => void {
  return bus.subscribe((event) => {
    void queryClient.invalidateQueries({ queryKey: FARMDB_QUERY_KEYS.summary() });

    if (event.scopes.includes('*')) {
      void queryClient.invalidateQueries({ queryKey: FARMDB_QUERY_KEYS.all });
      return;
    }

    for (const scope of event.scopes) {
      switch (scope) {
        case 'livestock':
          void queryClient.invalidateQueries({
            queryKey: FARMDB_QUERY_KEYS.livestockAll(),
          });
          break;
        case 'production':
          void queryClient.invalidateQueries({
            queryKey: FARMDB_QUERY_KEYS.productionAll(),
          });
          break;
        case 'medical':
          void queryClient.invalidateQueries({
            queryKey: FARMDB_QUERY_KEYS.medicalAll(),
          });
          break;
        case 'financial':
          void queryClient.invalidateQueries({
            queryKey: FARMDB_QUERY_KEYS.financialAll(),
          });
          break;
        case 'alerts':
          void queryClient.invalidateQueries({
            queryKey: FARMDB_QUERY_KEYS.alertsAll(),
          });
          break;
        case 'settings':
          void queryClient.invalidateQueries({
            queryKey: FARMDB_QUERY_KEYS.settings(),
          });
          break;
      }
    }
  });
}
