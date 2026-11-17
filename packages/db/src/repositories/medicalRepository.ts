import { and, desc, eq, or, sql, type SQL } from 'drizzle-orm';
import {
  generateId,
  validateNewMedicalRecord,
  validateUpdateMedicalRecord,
  type FinancialLog,
  type MedicalRecord,
  type MedicalRecordFilter,
  type NewMedicalRecordInput,
  type UpdateMedicalRecordInput,
  type ValidationErrors,
} from '@farmdb/core';
import type { FarmDrizzleDb } from '../driver';
import type { DatabaseEventBus } from '../events';
import { livestock, medicalRecords } from '../schema';
import type { FinancialRepository } from './financialRepository';

export class MedicalValidationError extends Error {
  readonly errors: ValidationErrors<
    NewMedicalRecordInput & UpdateMedicalRecordInput
  >;

  constructor(
    errors: ValidationErrors<NewMedicalRecordInput & UpdateMedicalRecordInput>,
    message = 'Medical record validation failed.'
  ) {
    super(message);
    this.name = 'MedicalValidationError';
    this.errors = errors;
  }
}

export class MedicalRecordNotFoundError extends Error {
  constructor(id: string) {
    super(`Medical record "${id}" was not found.`);
    this.name = 'MedicalRecordNotFoundError';
  }
}

export interface CreateMedicalRecordOptions {
  autoRecordExpense?: boolean;
}

export interface CreateMedicalRecordResult {
  record: MedicalRecord;
  generatedExpenseLog: FinancialLog | null;
}

type MedicalRow = typeof medicalRecords.$inferSelect;

function mapRowToDomain(row: MedicalRow): MedicalRecord {
  return {
    id: row.id,
    livestockId: row.livestockId,
    date: row.date,
    condition: row.condition,
    treatment: row.treatment,
    cost: row.cost,
    veterinarian: row.veterinarian,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function escapeLikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export interface MedicalRepository {
  list(filter?: MedicalRecordFilter): Promise<MedicalRecord[]>;
  getById(id: string): Promise<MedicalRecord | null>;
  create(
    input: NewMedicalRecordInput,
    options?: CreateMedicalRecordOptions
  ): Promise<CreateMedicalRecordResult>;
  update(id: string, input: UpdateMedicalRecordInput): Promise<MedicalRecord>;
  remove(id: string): Promise<boolean>;
}

export function createMedicalRepository(
  db: FarmDrizzleDb,
  events: DatabaseEventBus,
  financialRepo: FinancialRepository
): MedicalRepository {
  return {
    async list(filter?: MedicalRecordFilter): Promise<MedicalRecord[]> {
      const conditions: SQL[] = [];

      if (filter?.livestockId) {
        conditions.push(eq(medicalRecords.livestockId, filter.livestockId));
      }

      const trimmedSearch = filter?.search?.trim();
      if (trimmedSearch) {
        const pattern = `%${escapeLikePattern(trimmedSearch.toLowerCase())}%`;
        const cond = or(
          sql`lower(${medicalRecords.condition}) like ${pattern} escape '\\'`,
          sql`lower(${medicalRecords.treatment}) like ${pattern} escape '\\'`,
          sql`lower(coalesce(${medicalRecords.veterinarian}, '')) like ${pattern} escape '\\'`
        );
        if (cond) {
          conditions.push(cond);
        }
      }

      const query =
        conditions.length > 0
          ? db
              .select()
              .from(medicalRecords)
              .where(and(...conditions))
              .orderBy(desc(medicalRecords.date), desc(medicalRecords.createdAt))
          : db
              .select()
              .from(medicalRecords)
              .orderBy(desc(medicalRecords.date), desc(medicalRecords.createdAt));

      const rows = await query;
      return rows.map(mapRowToDomain);
    },

    async getById(id: string): Promise<MedicalRecord | null> {
      const row = await db
        .select()
        .from(medicalRecords)
        .where(eq(medicalRecords.id, id))
        .get();
      return row ? mapRowToDomain(row) : null;
    },

    async create(
      input: NewMedicalRecordInput,
      options?: CreateMedicalRecordOptions
    ): Promise<CreateMedicalRecordResult> {
      const validation = validateNewMedicalRecord(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid medical record.';
        throw new MedicalValidationError(validation.errors, msg);
      }

      const animal = await db
        .select({ id: livestock.id, tagNumber: livestock.tagNumber })
        .from(livestock)
        .where(eq(livestock.id, validation.data.livestockId))
        .get();

      if (!animal) {
        throw new MedicalValidationError(
          { livestockId: 'Selected animal does not exist.' },
          'Selected animal does not exist.'
        );
      }

      const now = Date.now();
      const row: typeof medicalRecords.$inferInsert = {
        id: generateId(),
        livestockId: validation.data.livestockId,
        date: validation.data.date,
        condition: validation.data.condition,
        treatment: validation.data.treatment,
        cost: validation.data.cost,
        veterinarian: validation.data.veterinarian,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(medicalRecords).values(row).run();
      const created = mapRowToDomain(row as MedicalRow);

      let generatedExpenseLog: FinancialLog | null = null;
      if (options?.autoRecordExpense && created.cost > 0) {
        generatedExpenseLog = await financialRepo.create({
          livestockId: created.livestockId,
          transactionType: 'expense',
          category: created.veterinarian ? 'veterinary' : 'meds',
          amount: created.cost,
          date: created.date,
          notes: `${animal.tagNumber}: ${created.condition} (${created.treatment})`,
        });
      }

      events.emit(
        generatedExpenseLog ? ['medical', 'financial'] : ['medical'],
        created.id
      );

      return { record: created, generatedExpenseLog };
    },

    async update(
      id: string,
      input: UpdateMedicalRecordInput
    ): Promise<MedicalRecord> {
      const existing = await this.getById(id);
      if (!existing) {
        throw new MedicalRecordNotFoundError(id);
      }

      const validation = validateUpdateMedicalRecord(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid medical record update.';
        throw new MedicalValidationError(validation.errors, msg);
      }

      const now = Date.now();
      await db
        .update(medicalRecords)
        .set({ ...validation.data, updatedAt: now })
        .where(eq(medicalRecords.id, id))
        .run();

      events.emit(['medical'], id);
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
      await db.delete(medicalRecords).where(eq(medicalRecords.id, id)).run();
      events.emit(['medical'], id);
      return true;
    },
  };
}
