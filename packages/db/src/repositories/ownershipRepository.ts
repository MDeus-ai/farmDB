import { and, desc, eq, or, sql, type SQL } from 'drizzle-orm';
import {
  generateId,
  validateNewAnimalOwnership,
  validateUpdateAnimalOwnership,
  type AnimalOwnership,
  type AnimalOwnershipFilter,
  type NewAnimalOwnershipInput,
  type OwnershipCategory,
  type OwnershipStatus,
  type UpdateAnimalOwnershipInput,
  type ValidationErrors,
} from '@farmdb/core';
import type { FarmDrizzleDb } from '../driver';
import type { DatabaseEventBus } from '../events';
import { animalOwnerships, livestock } from '../schema';

export class OwnershipValidationError extends Error {
  readonly errors: ValidationErrors<Record<string, unknown>>;

  constructor(
    errors: ValidationErrors<Record<string, unknown>>,
    message = 'Animal ownership validation failed.'
  ) {
    super(message);
    this.name = 'OwnershipValidationError';
    this.errors = errors;
  }
}

export class OwnershipNotFoundError extends Error {
  constructor(id: string) {
    super(`Ownership record "${id}" was not found.`);
    this.name = 'OwnershipNotFoundError';
  }
}

type OwnershipRow = typeof animalOwnerships.$inferSelect;

function mapOwnershipRow(row: OwnershipRow): AnimalOwnership {
  return {
    id: row.id,
    livestockId: row.livestockId,
    ownerName: row.ownerName,
    ownerContact: row.ownerContact ?? null,
    accountId: row.accountId ?? null,
    ownershipCategory: row.ownershipCategory as OwnershipCategory,
    sharePercentage: Number(row.sharePercentage),
    purpose: row.purpose ?? null,
    startDate: row.startDate,
    expectedEndDate: row.expectedEndDate ?? null,
    boardingFee: Number(row.boardingFee),
    status: row.status as OwnershipStatus,
    notes: row.notes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function escapeLikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function normDupText(raw?: string | null): string {
  return (raw ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export interface OwnershipRepository {
  list(filter?: AnimalOwnershipFilter): Promise<AnimalOwnership[]>;
  getById(id: string): Promise<AnimalOwnership | null>;
  create(input: NewAnimalOwnershipInput): Promise<AnimalOwnership>;
  update(
    id: string,
    input: UpdateAnimalOwnershipInput
  ): Promise<AnimalOwnership>;
  remove(id: string): Promise<boolean>;
}

export function createOwnershipRepository(
  db: FarmDrizzleDb,
  events: DatabaseEventBus
): OwnershipRepository {
  return {
    async list(filter?: AnimalOwnershipFilter): Promise<AnimalOwnership[]> {
      const conditions: SQL[] = [];

      if (filter?.livestockId) {
        conditions.push(eq(animalOwnerships.livestockId, filter.livestockId));
      }
      if (filter?.accountId) {
        conditions.push(eq(animalOwnerships.accountId, filter.accountId));
      }
      if (filter?.category && filter.category !== 'all') {
        conditions.push(
          eq(animalOwnerships.ownershipCategory, filter.category)
        );
      }
      if (filter?.status && filter.status !== 'all') {
        conditions.push(eq(animalOwnerships.status, filter.status));
      }

      const trimmedSearch = filter?.search?.trim();
      if (trimmedSearch) {
        const pattern = `%${escapeLikePattern(trimmedSearch.toLowerCase())}%`;
        const searchCond = or(
          sql`lower(${animalOwnerships.ownerName}) like ${pattern} escape '\\'`,
          sql`lower(coalesce(${animalOwnerships.purpose}, '')) like ${pattern} escape '\\'`,
          sql`lower(coalesce(${animalOwnerships.notes}, '')) like ${pattern} escape '\\'`
        );
        if (searchCond) {
          conditions.push(searchCond);
        }
      }

      const query =
        conditions.length > 0
          ? db
              .select()
              .from(animalOwnerships)
              .where(and(...conditions))
              .orderBy(
                animalOwnerships.status,
                desc(animalOwnerships.updatedAt)
              )
          : db
              .select()
              .from(animalOwnerships)
              .orderBy(
                animalOwnerships.status,
                desc(animalOwnerships.updatedAt)
              );

      const rows = await query;
      return rows.map(mapOwnershipRow);
    },

    async getById(id: string): Promise<AnimalOwnership | null> {
      const row = await db
        .select()
        .from(animalOwnerships)
        .where(eq(animalOwnerships.id, id))
        .get();
      return row ? mapOwnershipRow(row) : null;
    },

    async create(input: NewAnimalOwnershipInput): Promise<AnimalOwnership> {
      const validation = validateNewAnimalOwnership(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid ownership data.';
        throw new OwnershipValidationError(
          validation.errors as ValidationErrors<Record<string, unknown>>,
          msg
        );
      }

      const animal = await db
        .select({ id: livestock.id })
        .from(livestock)
        .where(eq(livestock.id, validation.data.livestockId))
        .get();
      if (!animal) {
        throw new OwnershipValidationError(
          { livestockId: 'Selected animal does not exist.' },
          'Selected animal does not exist.'
        );
      }

      const matchingRows = await db
        .select()
        .from(animalOwnerships)
        .where(
          and(
            eq(animalOwnerships.livestockId, validation.data.livestockId),
            eq(
              animalOwnerships.ownershipCategory,
              validation.data.ownershipCategory
            ),
            eq(animalOwnerships.startDate, validation.data.startDate)
          )
        );
      const targetOwner = normDupText(validation.data.ownerName);
      if (matchingRows.some((r) => normDupText(r.ownerName) === targetOwner)) {
        const msg = `Duplicate ownership record detected for this animal and owner (${validation.data.ownerName}) starting ${validation.data.startDate}.`;
        throw new OwnershipValidationError({ ownerName: msg }, msg);
      }

      const now = Date.now();
      const record: typeof animalOwnerships.$inferInsert = {
        id: generateId(),
        livestockId: validation.data.livestockId,
        ownerName: validation.data.ownerName,
        ownerContact: validation.data.ownerContact,
        accountId: validation.data.accountId,
        ownershipCategory: validation.data.ownershipCategory,
        sharePercentage: validation.data.sharePercentage,
        purpose: validation.data.purpose,
        startDate: validation.data.startDate,
        expectedEndDate: validation.data.expectedEndDate,
        boardingFee: validation.data.boardingFee,
        status: validation.data.status,
        notes: validation.data.notes,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(animalOwnerships).values(record).run();
      events.emit(['ownerships'], record.id);
      return mapOwnershipRow(record as OwnershipRow);
    },

    async update(
      id: string,
      input: UpdateAnimalOwnershipInput
    ): Promise<AnimalOwnership> {
      const existing = await this.getById(id);
      if (!existing) {
        throw new OwnershipNotFoundError(id);
      }

      const validation = validateUpdateAnimalOwnership(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid ownership update.';
        throw new OwnershipValidationError(
          validation.errors as ValidationErrors<Record<string, unknown>>,
          msg
        );
      }

      if (validation.data.livestockId) {
        const animal = await db
          .select({ id: livestock.id })
          .from(livestock)
          .where(eq(livestock.id, validation.data.livestockId))
          .get();
        if (!animal) {
          throw new OwnershipValidationError(
            { livestockId: 'Selected animal does not exist.' },
            'Selected animal does not exist.'
          );
        }
      }

      const nextLivestockId = validation.data.livestockId ?? existing.livestockId;
      const nextCategory =
        validation.data.ownershipCategory ?? existing.ownershipCategory;
      const nextStartDate = validation.data.startDate ?? existing.startDate;
      const nextOwnerName = validation.data.ownerName ?? existing.ownerName;
      const matchingRows = await db
        .select()
        .from(animalOwnerships)
        .where(
          and(
            eq(animalOwnerships.livestockId, nextLivestockId),
            eq(animalOwnerships.ownershipCategory, nextCategory),
            eq(animalOwnerships.startDate, nextStartDate)
          )
        );
      const targetOwner = normDupText(nextOwnerName);
      if (
        matchingRows.some(
          (r) => r.id !== id && normDupText(r.ownerName) === targetOwner
        )
      ) {
        const msg = `Duplicate ownership record detected for this animal and owner (${nextOwnerName}) starting ${nextStartDate}.`;
        throw new OwnershipValidationError({ ownerName: msg }, msg);
      }

      const now = Date.now();
      await db
        .update(animalOwnerships)
        .set({
          ...validation.data,
          updatedAt: now,
        })
        .where(eq(animalOwnerships.id, id))
        .run();

      events.emit(['ownerships'], id);

      return {
        ...existing,
        ...validation.data,
        updatedAt: now,
      };
    },

    async remove(id: string): Promise<boolean> {
      const existing = await this.getById(id);
      if (!existing) return false;
      await db
        .delete(animalOwnerships)
        .where(eq(animalOwnerships.id, id))
        .run();
      events.emit(['ownerships'], id);
      return true;
    },
  };
}
