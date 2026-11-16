import {
  generateId,
  normalizeTagNumber,
  validateNewLivestock,
  validateUpdateLivestock,
  type Livestock,
  type LivestockFilter,
  type NewLivestockInput,
  type UpdateLivestockInput,
} from '@farmdb/core';
import {
  DatabaseEventBus,
  LivestockNotFoundError,
  LivestockValidationError,
  type FarmDbContextValue,
  type FarmSummary,
  type LivestockRepository,
} from '@farmdb/db';

const STORAGE_KEY = 'farmdb_browser_preview_livestock_v1';

function readStoredRows(): Livestock[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Livestock[]) : [];
  } catch {
    return [];
  }
}

function writeStoredRows(rows: Livestock[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    // Ignore quota failures in non-persistent preview mode.
  }
}

/**
 * Browser-only fallback repository used when Vite is opened outside the Tauri
 * desktop shell so UI development works without failing on Tauri IPC.
 */
export function createBrowserPreviewSession(): FarmDbContextValue {
  const events = new DatabaseEventBus();

  const livestock: LivestockRepository = {
    async list(filter?: LivestockFilter): Promise<Livestock[]> {
      const search = filter?.search?.trim().toLowerCase() ?? '';
      return readStoredRows()
        .filter((row) => {
          if (filter?.species && filter.species !== 'all' && row.species !== filter.species) {
            return false;
          }
          if (filter?.status && filter.status !== 'all' && row.status !== filter.status) {
            return false;
          }
          if (search) {
            const haystack = [row.tagNumber, row.name ?? '', row.breed ?? '']
              .join(' ')
              .toLowerCase();
            if (!haystack.includes(search)) {
              return false;
            }
          }
          return true;
        })
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },

    async getById(id: string): Promise<Livestock | null> {
      return readStoredRows().find((row) => row.id === id) ?? null;
    },

    async getByTagNumber(tagNumber: string): Promise<Livestock | null> {
      const normalized = normalizeTagNumber(tagNumber);
      return readStoredRows().find((row) => row.tagNumber === normalized) ?? null;
    },

    async create(input: NewLivestockInput): Promise<Livestock> {
      const rows = readStoredRows();
      const validation = validateNewLivestock(input, {
        existingTags: rows.map((r) => r.tagNumber),
      });
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ?? 'Invalid livestock data.';
        throw new LivestockValidationError(validation.errors, msg);
      }

      const now = Date.now();
      const created: Livestock = {
        id: generateId(),
        species: validation.data.species,
        tagNumber: validation.data.tagNumber,
        name: validation.data.name,
        breed: validation.data.breed,
        dob: validation.data.dob,
        imageUri: validation.data.imageUri,
        status: validation.data.status,
        createdAt: now,
        updatedAt: now,
      };
      writeStoredRows([created, ...rows]);
      events.emit(['livestock'], created.id);
      return created;
    },

    async update(id: string, input: UpdateLivestockInput): Promise<Livestock> {
      const rows = readStoredRows();
      const index = rows.findIndex((r) => r.id === id);
      if (index === -1 || !rows[index]) {
        throw new LivestockNotFoundError(id);
      }
      const existing = rows[index];
      const validation = validateUpdateLivestock(input, {
        existingTags: rows.map((r) => r.tagNumber),
        currentTag: existing.tagNumber,
      });
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ?? 'Invalid livestock update.';
        throw new LivestockValidationError(validation.errors, msg);
      }

      const updated: Livestock = {
        ...existing,
        ...validation.data,
        updatedAt: Date.now(),
      };
      rows[index] = updated;
      writeStoredRows(rows);
      events.emit(['livestock'], id);
      return updated;
    },

    async remove(id: string): Promise<boolean> {
      const rows = readStoredRows();
      const next = rows.filter((r) => r.id !== id);
      if (next.length === rows.length) {
        return false;
      }
      writeStoredRows(next);
      events.emit(['livestock'], id);
      return true;
    },

    async getSummary(): Promise<FarmSummary> {
      const rows = readStoredRows();
      return {
        totalLivestock: rows.length,
        activeLivestock: rows.filter((r) => r.status === 'active').length,
        soldLivestock: rows.filter((r) => r.status === 'sold').length,
        deceasedLivestock: rows.filter((r) => r.status === 'deceased').length,
        cowCount: rows.filter((r) => r.species === 'cow').length,
        productRecordCount: 0,
        medicalRecordCount: 0,
        financialLogCount: 0,
        openAlertCount: 0,
      };
    },
  };

  return {
    driverKind: 'memory-fallback',
    events,
    livestock,
  };
}
