import { and, desc, eq, gte, lte, or, sql, type SQL } from 'drizzle-orm';
import {
  generateId,
  validateNewFinancialLog,
  validateUpdateFinancialLog,
  type FinancialCategory,
  type FinancialLog,
  type FinancialLogFilter,
  type NewFinancialLogInput,
  type TransactionType,
  type UpdateFinancialLogInput,
  type ValidationErrors,
} from '@farmdb/core';
import type { FarmDrizzleDb } from '../driver';
import type { DatabaseEventBus } from '../events';
import { financialLogs } from '../schema';

export class FinancialValidationError extends Error {
  readonly errors: ValidationErrors<NewFinancialLogInput & UpdateFinancialLogInput>;

  constructor(
    errors: ValidationErrors<NewFinancialLogInput & UpdateFinancialLogInput>,
    message = 'Financial entry validation failed.'
  ) {
    super(message);
    this.name = 'FinancialValidationError';
    this.errors = errors;
  }
}

export class FinancialLogNotFoundError extends Error {
  constructor(id: string) {
    super(`Financial log "${id}" was not found.`);
    this.name = 'FinancialLogNotFoundError';
  }
}

type FinancialRow = typeof financialLogs.$inferSelect;

function mapRowToDomain(row: FinancialRow): FinancialLog {
  return {
    id: row.id,
    livestockId: row.livestockId,
    productRecordId: row.productRecordId,
    transactionType: row.transactionType as TransactionType,
    amount: row.amount,
    date: row.date,
    category: row.category as FinancialCategory,
    notes: row.notes,
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

export interface FinancialRepository {
  list(filter?: FinancialLogFilter): Promise<FinancialLog[]>;
  getById(id: string): Promise<FinancialLog | null>;
  create(input: NewFinancialLogInput): Promise<FinancialLog>;
  update(id: string, input: UpdateFinancialLogInput): Promise<FinancialLog>;
  remove(id: string): Promise<boolean>;
}

export function createFinancialRepository(
  db: FarmDrizzleDb,
  events: DatabaseEventBus
): FinancialRepository {
  return {
    async list(filter?: FinancialLogFilter): Promise<FinancialLog[]> {
      const conditions: SQL[] = [];

      if (filter?.transactionType && filter.transactionType !== 'all') {
        conditions.push(eq(financialLogs.transactionType, filter.transactionType));
      }
      if (filter?.category && filter.category !== 'all') {
        conditions.push(eq(financialLogs.category, filter.category));
      }
      if (filter?.livestockId) {
        conditions.push(eq(financialLogs.livestockId, filter.livestockId));
      }
      if (filter?.fromDate) {
        conditions.push(gte(financialLogs.date, filter.fromDate));
      }
      if (filter?.toDate) {
        conditions.push(lte(financialLogs.date, filter.toDate));
      }

      const trimmedSearch = filter?.search?.trim();
      if (trimmedSearch) {
        const pattern = `%${escapeLikePattern(trimmedSearch.toLowerCase())}%`;
        const searchCond = or(
          sql`lower(${financialLogs.category}) like ${pattern} escape '\\'`,
          sql`lower(coalesce(${financialLogs.notes}, '')) like ${pattern} escape '\\'`
        );
        if (searchCond) {
          conditions.push(searchCond);
        }
      }

      const query =
        conditions.length > 0
          ? db
              .select()
              .from(financialLogs)
              .where(and(...conditions))
              .orderBy(desc(financialLogs.date), desc(financialLogs.createdAt))
          : db
              .select()
              .from(financialLogs)
              .orderBy(desc(financialLogs.date), desc(financialLogs.createdAt));

      const rows = await query;
      return rows.map(mapRowToDomain);
    },

    async getById(id: string): Promise<FinancialLog | null> {
      const row = await db
        .select()
        .from(financialLogs)
        .where(eq(financialLogs.id, id))
        .get();
      return row ? mapRowToDomain(row) : null;
    },

    async create(input: NewFinancialLogInput): Promise<FinancialLog> {
      const validation = validateNewFinancialLog(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid financial entry.';
        throw new FinancialValidationError(validation.errors, msg);
      }

      const matchingRows = await db
        .select()
        .from(financialLogs)
        .where(
          and(
            eq(financialLogs.date, validation.data.date),
            eq(financialLogs.transactionType, validation.data.transactionType),
            eq(financialLogs.category, validation.data.category)
          )
        );
      const targetCents = Math.round(validation.data.amount * 100);
      const targetLivestock = validation.data.livestockId ?? null;
      const targetNotes = normDupText(validation.data.notes);
      const targetProdId = validation.data.productRecordId ?? null;
      const duplicate = matchingRows.find(
        (r) =>
          (targetProdId !== null && r.productRecordId === targetProdId) ||
          (Math.round(Number(r.amount) * 100) === targetCents &&
            (r.livestockId ?? null) === targetLivestock &&
            normDupText(r.notes) === targetNotes)
      );
      if (duplicate) {
        const msg = `Duplicate financial entry detected: an identical ${validation.data.transactionType} record on ${validation.data.date} already exists.`;
        throw new FinancialValidationError({ amount: msg }, msg);
      }

      const now = Date.now();
      const record: typeof financialLogs.$inferInsert = {
        id: generateId(),
        livestockId: validation.data.livestockId,
        productRecordId: validation.data.productRecordId,
        transactionType: validation.data.transactionType,
        amount: validation.data.amount,
        date: validation.data.date,
        category: validation.data.category,
        notes: validation.data.notes,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(financialLogs).values(record).run();
      events.emit(['financial'], record.id);
      return mapRowToDomain(record as FinancialRow);
    },

    async update(
      id: string,
      input: UpdateFinancialLogInput
    ): Promise<FinancialLog> {
      const existing = await this.getById(id);
      if (!existing) {
        throw new FinancialLogNotFoundError(id);
      }

      const validation = validateUpdateFinancialLog(input, {
        currentTransactionType: existing.transactionType,
      });
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid financial entry update.';
        throw new FinancialValidationError(validation.errors, msg);
      }

      const nextDate = validation.data.date ?? existing.date;
      const nextType =
        validation.data.transactionType ?? existing.transactionType;
      const nextCategory = validation.data.category ?? existing.category;
      const nextAmount = validation.data.amount ?? existing.amount;
      const nextLivestock =
        validation.data.livestockId !== undefined
          ? validation.data.livestockId
          : existing.livestockId;
      const nextNotes =
        validation.data.notes !== undefined
          ? validation.data.notes
          : existing.notes;
      const matchingRows = await db
        .select()
        .from(financialLogs)
        .where(
          and(
            eq(financialLogs.date, nextDate),
            eq(financialLogs.transactionType, nextType),
            eq(financialLogs.category, nextCategory)
          )
        );
      const targetCents = Math.round(nextAmount * 100);
      const targetNotes = normDupText(nextNotes);
      const duplicate = matchingRows.find(
        (r) =>
          r.id !== id &&
          Math.round(Number(r.amount) * 100) === targetCents &&
          (r.livestockId ?? null) === (nextLivestock ?? null) &&
          normDupText(r.notes) === targetNotes
      );
      if (duplicate) {
        const msg = `Duplicate financial entry detected: an identical ${nextType} record on ${nextDate} already exists.`;
        throw new FinancialValidationError({ amount: msg }, msg);
      }

      const now = Date.now();
      await db
        .update(financialLogs)
        .set({ ...validation.data, updatedAt: now })
        .where(eq(financialLogs.id, id))
        .run();

      events.emit(['financial'], id);
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
      await db.delete(financialLogs).where(eq(financialLogs.id, id)).run();
      events.emit(['financial'], id);
      return true;
    },
  };
}
