import { and, desc, eq, gte, lte, or, sql, type SQL } from 'drizzle-orm';
import {
  generateId,
  roundAmount,
  validateNewProductRecord,
  validateUpdateProductRecord,
  type FinancialLog,
  type NewProductRecordInput,
  type ProductRecord,
  type ProductRecordFilter,
  type UpdateProductRecordInput,
  type ValidationErrors,
} from '@farmdb/core';
import type { FarmDrizzleDb } from '../driver';
import type { DatabaseEventBus } from '../events';
import { livestock, productRecords } from '../schema';
import type { FinancialRepository } from './financialRepository';
import type { SettingsRepository } from './settingsRepository';

export class ProductionValidationError extends Error {
  readonly errors: ValidationErrors<
    NewProductRecordInput & UpdateProductRecordInput
  >;

  constructor(
    errors: ValidationErrors<NewProductRecordInput & UpdateProductRecordInput>,
    message = 'Milk production record validation failed.'
  ) {
    super(message);
    this.name = 'ProductionValidationError';
    this.errors = errors;
  }
}

export class ProductRecordNotFoundError extends Error {
  constructor(id: string) {
    super(`Product record "${id}" was not found.`);
    this.name = 'ProductRecordNotFoundError';
  }
}

export interface LogMilkYieldOptions {
  autoRecordSale?: boolean;
  ratePerLiter?: number;
}

export interface CreateProductRecordResult {
  record: ProductRecord;
  generatedIncomeLog: FinancialLog | null;
}

type ProductRow = typeof productRecords.$inferSelect;

function mapRowToDomain(row: ProductRow): ProductRecord {
  return {
    id: row.id,
    livestockId: row.livestockId,
    date: row.date,
    yieldAmount: row.yieldAmount,
    qualityNotes: row.qualityNotes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function escapeLikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export interface ProductionRepository {
  list(filter?: ProductRecordFilter): Promise<ProductRecord[]>;
  getById(id: string): Promise<ProductRecord | null>;
  create(
    input: NewProductRecordInput,
    options?: LogMilkYieldOptions
  ): Promise<CreateProductRecordResult>;
  update(id: string, input: UpdateProductRecordInput): Promise<ProductRecord>;
  remove(id: string): Promise<boolean>;
}

export function createProductionRepository(
  db: FarmDrizzleDb,
  events: DatabaseEventBus,
  financialRepo: FinancialRepository,
  settingsRepo: SettingsRepository
): ProductionRepository {
  return {
    async list(filter?: ProductRecordFilter): Promise<ProductRecord[]> {
      const conditions: SQL[] = [];

      if (filter?.livestockId) {
        conditions.push(eq(productRecords.livestockId, filter.livestockId));
      }
      if (filter?.fromDate) {
        conditions.push(gte(productRecords.date, filter.fromDate));
      }
      if (filter?.toDate) {
        conditions.push(lte(productRecords.date, filter.toDate));
      }

      const trimmedSearch = filter?.search?.trim();
      if (trimmedSearch) {
        const pattern = `%${escapeLikePattern(trimmedSearch.toLowerCase())}%`;
        const cond = or(
          sql`lower(coalesce(${productRecords.qualityNotes}, '')) like ${pattern} escape '\\'`,
          sql`lower(${productRecords.date}) like ${pattern} escape '\\'`
        );
        if (cond) {
          conditions.push(cond);
        }
      }

      const query =
        conditions.length > 0
          ? db
              .select()
              .from(productRecords)
              .where(and(...conditions))
              .orderBy(desc(productRecords.date), desc(productRecords.createdAt))
          : db
              .select()
              .from(productRecords)
              .orderBy(desc(productRecords.date), desc(productRecords.createdAt));

      const rows = await query;
      return rows.map(mapRowToDomain);
    },

    async getById(id: string): Promise<ProductRecord | null> {
      const row = await db
        .select()
        .from(productRecords)
        .where(eq(productRecords.id, id))
        .get();
      return row ? mapRowToDomain(row) : null;
    },

    async create(
      input: NewProductRecordInput,
      options?: LogMilkYieldOptions
    ): Promise<CreateProductRecordResult> {
      const validation = validateNewProductRecord(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid production record.';
        throw new ProductionValidationError(validation.errors, msg);
      }

      const animal = await db
        .select({ id: livestock.id, tagNumber: livestock.tagNumber })
        .from(livestock)
        .where(eq(livestock.id, validation.data.livestockId))
        .get();

      if (!animal) {
        throw new ProductionValidationError(
          { livestockId: 'Selected animal does not exist.' },
          'Selected animal does not exist.'
        );
      }

      const now = Date.now();
      const row: typeof productRecords.$inferInsert = {
        id: generateId(),
        livestockId: validation.data.livestockId,
        date: validation.data.date,
        yieldAmount: validation.data.yieldAmount,
        qualityNotes: validation.data.qualityNotes,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(productRecords).values(row).run();
      const createdRecord = mapRowToDomain(row as ProductRow);

      let generatedIncomeLog: FinancialLog | null = null;
      if (options?.autoRecordSale) {
        const settings = await settingsRepo.get();
        const rate =
          options.ratePerLiter !== undefined
            ? options.ratePerLiter
            : settings.defaultMilkRatePerLiter;

        if (Number.isFinite(rate) && rate > 0) {
          const saleAmount = roundAmount(createdRecord.yieldAmount * rate);
          if (saleAmount > 0) {
            generatedIncomeLog = await financialRepo.create({
              livestockId: createdRecord.livestockId,
              productRecordId: createdRecord.id,
              transactionType: 'income',
              category: 'milk_sale',
              amount: saleAmount,
              date: createdRecord.date,
              notes: `Auto milk sale (${animal.tagNumber}): ${createdRecord.yieldAmount.toFixed(2)} L @ ${rate.toFixed(2)}/L`,
            });
          }
        }
      }

      events.emit(
        generatedIncomeLog ? ['production', 'financial'] : ['production'],
        createdRecord.id
      );

      return { record: createdRecord, generatedIncomeLog };
    },

    async update(
      id: string,
      input: UpdateProductRecordInput
    ): Promise<ProductRecord> {
      const existing = await this.getById(id);
      if (!existing) {
        throw new ProductRecordNotFoundError(id);
      }

      const validation = validateUpdateProductRecord(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid production record update.';
        throw new ProductionValidationError(validation.errors, msg);
      }

      const now = Date.now();
      await db
        .update(productRecords)
        .set({ ...validation.data, updatedAt: now })
        .where(eq(productRecords.id, id))
        .run();

      events.emit(['production'], id);
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
      await db.delete(productRecords).where(eq(productRecords.id, id)).run();
      events.emit(['production', 'financial'], id);
      return true;
    },
  };
}
