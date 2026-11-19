import { and, count, desc, eq, or, sql, type SQL } from 'drizzle-orm';
import {
  generateId,
  inferDefaultLivestockSex,
  LIVESTOCK_SEXES,
  normalizeTagNumber,
  validateNewLivestock,
  validateUpdateLivestock,
  type Livestock,
  type LivestockFilter,
  type LivestockSex,
  type LivestockStatus,
  type NewLivestockInput,
  type Species,
  type UpdateLivestockInput,
  type ValidationErrors,
} from '@farmdb/core';
import {
  extractDatabaseErrorCause,
  formatFriendlyDatabaseError,
  type FarmDrizzleDb,
} from '../driver';
import type { DatabaseEventBus } from '../events';
import {
  alerts,
  financialLogs,
  livestock,
  medicalRecords,
  productRecords,
} from '../schema';

export class LivestockValidationError extends Error {
  readonly errors: ValidationErrors<NewLivestockInput & UpdateLivestockInput>;

  constructor(
    errors: ValidationErrors<NewLivestockInput & UpdateLivestockInput>,
    message = 'Livestock validation failed.'
  ) {
    super(message);
    this.name = 'LivestockValidationError';
    this.errors = errors;
  }
}

export class LivestockNotFoundError extends Error {
  constructor(id: string) {
    super(`Livestock record "${id}" was not found.`);
    this.name = 'LivestockNotFoundError';
  }
}

export interface FarmSummary {
  totalLivestock: number;
  activeLivestock: number;
  soldLivestock: number;
  deceasedLivestock: number;
  cowCount: number;
  productRecordCount: number;
  medicalRecordCount: number;
  financialLogCount: number;
  openAlertCount: number;
}

type LivestockRow = typeof livestock.$inferSelect;

function mapRowToDomain(row: LivestockRow): Livestock {
  const sex = (LIVESTOCK_SEXES as readonly string[]).includes(row.sex)
    ? (row.sex as LivestockSex)
    : inferDefaultLivestockSex(row.tagNumber);
  return {
    id: row.id,
    species: row.species as Species,
    sex,
    tagNumber: row.tagNumber,
    name: row.name,
    breed: row.breed,
    dob: row.dob,
    imageUri: row.imageUri,
    sireId: row.sireId ?? null,
    damId: row.damId ?? null,
    status: row.status as LivestockStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function escapeLikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export interface LivestockRepository {
  list(filter?: LivestockFilter): Promise<Livestock[]>;
  getById(id: string): Promise<Livestock | null>;
  getByTagNumber(tagNumber: string): Promise<Livestock | null>;
  create(input: NewLivestockInput): Promise<Livestock>;
  update(id: string, input: UpdateLivestockInput): Promise<Livestock>;
  remove(id: string): Promise<boolean>;
  getSummary(): Promise<FarmSummary>;
}

export function createLivestockRepository(
  db: FarmDrizzleDb,
  events: DatabaseEventBus
): LivestockRepository {
  return {
    async list(filter?: LivestockFilter): Promise<Livestock[]> {
      const conditions: SQL[] = [];

      if (filter?.species && filter.species !== 'all') {
        conditions.push(eq(livestock.species, filter.species));
      }

      if (filter?.sex && filter.sex !== 'all') {
        conditions.push(eq(livestock.sex, filter.sex));
      }

      if (filter?.status && filter.status !== 'all') {
        conditions.push(eq(livestock.status, filter.status));
      }

      const trimmedSearch = filter?.search?.trim();
      if (trimmedSearch) {
        const pattern = `%${escapeLikePattern(trimmedSearch.toLowerCase())}%`;
        const searchCond = or(
          sql`lower(${livestock.tagNumber}) like ${pattern} escape '\\'`,
          sql`lower(coalesce(${livestock.name}, '')) like ${pattern} escape '\\'`,
          sql`lower(coalesce(${livestock.breed}, '')) like ${pattern} escape '\\'`
        );
        if (searchCond) {
          conditions.push(searchCond);
        }
      }

      const query =
        conditions.length > 0
          ? db
              .select()
              .from(livestock)
              .where(and(...conditions))
              .orderBy(desc(livestock.updatedAt))
          : db.select().from(livestock).orderBy(desc(livestock.updatedAt));

      const rows = await query;
      return rows.map(mapRowToDomain);
    },

    async getById(id: string): Promise<Livestock | null> {
      const row = await db
        .select()
        .from(livestock)
        .where(eq(livestock.id, id))
        .get();
      return row ? mapRowToDomain(row) : null;
    },

    async getByTagNumber(tagNumber: string): Promise<Livestock | null> {
      const normalized = normalizeTagNumber(tagNumber);
      const row = await db
        .select()
        .from(livestock)
        .where(eq(livestock.tagNumber, normalized))
        .get();
      return row ? mapRowToDomain(row) : null;
    },

    async create(input: NewLivestockInput): Promise<Livestock> {
      const allLivestock = await this.list({});
      const validation = validateNewLivestock(input, {
        existingTags: allLivestock.map((item) => item.tagNumber),
        allLivestock,
      });
      if (!validation.ok || !validation.data) {
        const firstError =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid livestock data.';
        throw new LivestockValidationError(validation.errors, firstError);
      }

      const now = Date.now();
      const record: typeof livestock.$inferInsert = {
        id: generateId(),
        species: validation.data.species,
        sex: validation.data.sex,
        tagNumber: validation.data.tagNumber,
        name: validation.data.name,
        breed: validation.data.breed,
        dob: validation.data.dob,
        imageUri: validation.data.imageUri,
        sireId: validation.data.sireId,
        damId: validation.data.damId,
        status: validation.data.status,
        createdAt: now,
        updatedAt: now,
      };

      try {
        await db.insert(livestock).values(record).run();
      } catch (err) {
        const msg = extractDatabaseErrorCause(err);
        const lower = msg.toLowerCase();
        if (lower.includes('unique')) {
          throw new LivestockValidationError(
            {
              tagNumber: `Tag "${validation.data.tagNumber}" is already assigned to another animal.`,
            },
            `Tag "${validation.data.tagNumber}" is already assigned to another animal.`
          );
        }
        if (lower.includes('foreign key')) {
          throw new LivestockValidationError(
            {
              damId: 'Selected Sire or Dam parent record no longer exists in the database.',
            },
            'Selected Sire or Dam parent record no longer exists. Refresh Herd Registry and try again.'
          );
        }
        if (/readonly|read-only|code:\s*(?:8|1032)\b/i.test(msg)) {
          throw new Error(
            'Unable to save animal because the local database file is locked read-only. Click Refresh or restart farmDB and try again.'
          );
        }
        throw formatFriendlyDatabaseError(err);
      }

      events.emit(['livestock'], record.id);
      return mapRowToDomain(record as LivestockRow);
    },

    async update(id: string, input: UpdateLivestockInput): Promise<Livestock> {
      const existing = await this.getById(id);
      if (!existing) {
        throw new LivestockNotFoundError(id);
      }

      const allLivestock = await this.list({});
      const validation = validateUpdateLivestock(input, {
        existingTags: allLivestock.map((item) => item.tagNumber),
        currentTag: existing.tagNumber,
        currentId: id,
        currentSpecies: existing.species,
        currentDob: existing.dob,
        allLivestock,
      });

      if (!validation.ok || !validation.data) {
        const firstError =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid livestock update.';
        throw new LivestockValidationError(validation.errors, firstError);
      }

      const nextSireId =
        validation.data.sireId !== undefined
          ? validation.data.sireId
          : existing.sireId;
      const nextDamId =
        validation.data.damId !== undefined
          ? validation.data.damId
          : existing.damId;
      if (nextSireId && nextDamId && nextSireId === nextDamId) {
        const msg = 'Sire and Dam must be two different animals.';
        throw new LivestockValidationError({ damId: msg }, msg);
      }

      const now = Date.now();
      const updatedFields = {
        ...validation.data,
        updatedAt: now,
      };

      try {
        await db
          .update(livestock)
          .set(updatedFields)
          .where(eq(livestock.id, id))
          .run();
      } catch (err) {
        const msg = extractDatabaseErrorCause(err);
        const lower = msg.toLowerCase();
        if (lower.includes('unique')) {
          throw new LivestockValidationError(
            {
              tagNumber: `Tag "${updatedFields.tagNumber ?? existing.tagNumber}" is already assigned to another animal.`,
            },
            `Tag "${updatedFields.tagNumber ?? existing.tagNumber}" is already assigned to another animal.`
          );
        }
        if (lower.includes('foreign key')) {
          throw new LivestockValidationError(
            {
              damId: 'Selected Sire or Dam parent record no longer exists in the database.',
            },
            'Selected Sire or Dam parent record no longer exists. Refresh Herd Registry and try again.'
          );
        }
        if (/readonly|read-only|code:\s*(?:8|1032)\b/i.test(msg)) {
          throw new Error(
            'Unable to update animal because the local database file is locked read-only. Click Refresh or restart farmDB and try again.'
          );
        }
        throw formatFriendlyDatabaseError(err);
      }

      events.emit(['livestock'], id);

      return {
        ...existing,
        ...validation.data,
        updatedAt: now,
      };
    },

    async remove(id: string): Promise<boolean> {
      const existing = await this.getById(id);
      if (!existing) {
        return false;
      }

      // Clear lineage pointers explicitly so descendants unlink cleanly even if FK pragmas vary
      await db
        .update(livestock)
        .set({ sireId: null })
        .where(eq(livestock.sireId, id))
        .run();
      await db
        .update(livestock)
        .set({ damId: null })
        .where(eq(livestock.damId, id))
        .run();
      await db.delete(livestock).where(eq(livestock.id, id)).run();
      events.emit(['livestock', 'production', 'medical', 'financial', 'alerts'], id);
      return true;
    },

    async getSummary(): Promise<FarmSummary> {
      const [
        allLivestock,
        prodCountRows,
        medCountRows,
        finCountRows,
        openAlertRows,
      ] = await Promise.all([
        db
          .select({
            species: livestock.species,
            status: livestock.status,
          })
          .from(livestock),
        db.select({ value: count() }).from(productRecords),
        db.select({ value: count() }).from(medicalRecords),
        db.select({ value: count() }).from(financialLogs),
        db
          .select({ value: count() })
          .from(alerts)
          .where(and(eq(alerts.isResolved, false), eq(alerts.entryKind, 'alert'))),
      ]);

      let activeLivestock = 0;
      let soldLivestock = 0;
      let deceasedLivestock = 0;
      let cowCount = 0;

      for (const row of allLivestock) {
        if (row.species === 'cow') cowCount += 1;
        if (row.status === 'active') activeLivestock += 1;
        else if (row.status === 'sold') soldLivestock += 1;
        else if (row.status === 'deceased') deceasedLivestock += 1;
      }

      return {
        totalLivestock: allLivestock.length,
        activeLivestock,
        soldLivestock,
        deceasedLivestock,
        cowCount,
        productRecordCount: Number(prodCountRows[0]?.value ?? 0),
        medicalRecordCount: Number(medCountRows[0]?.value ?? 0),
        financialLogCount: Number(finCountRows[0]?.value ?? 0),
        openAlertCount: Number(openAlertRows[0]?.value ?? 0),
      };
    },
  };
}
