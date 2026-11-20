import { and, desc, eq, or, sql, type SQL } from 'drizzle-orm';
import {
  advancePayDueDate,
  computeHrSummary,
  generateId,
  getTodayIsoDate,
  validateNewFarmWorker,
  validateNewWorkerPayment,
  validateNewWorkerTask,
  validateUpdateFarmWorker,
  validateUpdateWorkerPayment,
  validateUpdateWorkerTask,
  type FarmWorker,
  type FarmWorkerFilter,
  type FinancialLog,
  type HrDuePaymentAlertItem,
  type NewFarmWorkerInput,
  type NewWorkerPaymentInput,
  type NewWorkerTaskInput,
  type UpdateFarmWorkerInput,
  type UpdateWorkerPaymentInput,
  type UpdateWorkerTaskInput,
  type ValidationErrors,
  type WorkerPayFrequency,
  type WorkerPayment,
  type WorkerPaymentFilter,
  type WorkerPaymentStatus,
  type WorkerStatus,
  type WorkerTask,
  type WorkerTaskFilter,
  type WorkerTaskPriority,
  type WorkerTaskStatus,
} from '@farmdb/core';
import type { FarmDrizzleDb } from '../driver';
import type { DatabaseEventBus } from '../events';
import { workerPayments, workers, workerTasks } from '../schema';
import type { FinancialRepository } from './financialRepository';

export class HrValidationError extends Error {
  readonly errors: ValidationErrors<Record<string, unknown>>;

  constructor(
    errors: ValidationErrors<Record<string, unknown>>,
    message = 'Human Resources validation failed.'
  ) {
    super(message);
    this.name = 'HrValidationError';
    this.errors = errors;
  }
}

export class WorkerNotFoundError extends Error {
  constructor(id: string) {
    super(`Worker "${id}" was not found.`);
    this.name = 'WorkerNotFoundError';
  }
}

export class WorkerPaymentNotFoundError extends Error {
  constructor(id: string) {
    super(`Worker payment "${id}" was not found.`);
    this.name = 'WorkerPaymentNotFoundError';
  }
}

export class WorkerTaskNotFoundError extends Error {
  constructor(id: string) {
    super(`Worker task "${id}" was not found.`);
    this.name = 'WorkerTaskNotFoundError';
  }
}

export interface CreateWorkerPaymentOptions {
  autoRecordExpense?: boolean;
  advanceWorkerDueDate?: boolean;
}

export interface CreateWorkerPaymentResult {
  payment: WorkerPayment;
  generatedExpenseLog: FinancialLog | null;
}

export interface MarkWorkerPaymentPaidOptions {
  paidDate?: string;
  autoRecordExpense?: boolean;
  advanceWorkerDueDate?: boolean;
}

type WorkerRow = typeof workers.$inferSelect;
type WorkerPaymentRow = typeof workerPayments.$inferSelect;
type WorkerTaskRow = typeof workerTasks.$inferSelect;

function mapWorkerRow(row: WorkerRow): FarmWorker {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    phone: row.phone,
    responsibilities: row.responsibilities,
    salaryAmount: Number(row.salaryAmount),
    payFrequency: row.payFrequency as WorkerPayFrequency,
    nextPaymentDueDate: row.nextPaymentDueDate,
    status: row.status as WorkerStatus,
    hireDate: row.hireDate,
    paymentNotifiedForDueDate: row.paymentNotifiedForDueDate ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapPaymentRow(row: WorkerPaymentRow): WorkerPayment {
  return {
    id: row.id,
    workerId: row.workerId,
    financialLogId: row.financialLogId ?? null,
    amount: Number(row.amount),
    dueDate: row.dueDate,
    paidDate: row.paidDate ?? null,
    status: row.status as WorkerPaymentStatus,
    periodLabel: row.periodLabel ?? null,
    notes: row.notes ?? null,
    notifiedAt: row.notifiedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapTaskRow(row: WorkerTaskRow): WorkerTask {
  return {
    id: row.id,
    workerId: row.workerId,
    livestockId: row.livestockId ?? null,
    title: row.title,
    description: row.description ?? null,
    priority: row.priority as WorkerTaskPriority,
    status: row.status as WorkerTaskStatus,
    dueDate: row.dueDate ?? null,
    completedAt: row.completedAt ?? null,
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

function normPhoneDigits(raw?: string | null): string {
  return (raw ?? '').replace(/\D+/g, '');
}

export interface HrRepository {
  listWorkers(filter?: FarmWorkerFilter): Promise<FarmWorker[]>;
  getWorkerById(id: string): Promise<FarmWorker | null>;
  createWorker(input: NewFarmWorkerInput): Promise<FarmWorker>;
  updateWorker(id: string, input: UpdateFarmWorkerInput): Promise<FarmWorker>;
  removeWorker(id: string): Promise<boolean>;

  listPayments(filter?: WorkerPaymentFilter): Promise<WorkerPayment[]>;
  getPaymentById(id: string): Promise<WorkerPayment | null>;
  createPayment(
    input: NewWorkerPaymentInput,
    options?: CreateWorkerPaymentOptions
  ): Promise<CreateWorkerPaymentResult>;
  updatePayment(
    id: string,
    input: UpdateWorkerPaymentInput
  ): Promise<WorkerPayment>;
  markPaymentPaid(
    id: string,
    options?: MarkWorkerPaymentPaidOptions
  ): Promise<CreateWorkerPaymentResult>;
  removePayment(id: string): Promise<boolean>;

  listTasks(filter?: WorkerTaskFilter): Promise<WorkerTask[]>;
  getTaskById(id: string): Promise<WorkerTask | null>;
  createTask(input: NewWorkerTaskInput): Promise<WorkerTask>;
  updateTask(id: string, input: UpdateWorkerTaskInput): Promise<WorkerTask>;
  removeTask(id: string): Promise<boolean>;

  listDuePaymentNotifications(
    todayIso?: string,
    leadDays?: number
  ): Promise<HrDuePaymentAlertItem[]>;
  markPaymentNotificationsDelivered(
    items: readonly HrDuePaymentAlertItem[],
    notifiedAt?: number
  ): Promise<void>;
}

export function createHrRepository(
  db: FarmDrizzleDb,
  events: DatabaseEventBus,
  financialRepo: FinancialRepository
): HrRepository {
  return {
    async listWorkers(filter?: FarmWorkerFilter): Promise<FarmWorker[]> {
      const conditions: SQL[] = [];

      if (filter?.status && filter.status !== 'all') {
        conditions.push(eq(workers.status, filter.status));
      }

      const trimmedSearch = filter?.search?.trim();
      if (trimmedSearch) {
        const pattern = `%${escapeLikePattern(trimmedSearch.toLowerCase())}%`;
        const searchCond = or(
          sql`lower(${workers.name}) like ${pattern} escape '\\'`,
          sql`lower(${workers.role}) like ${pattern} escape '\\'`,
          sql`lower(coalesce(${workers.responsibilities}, '')) like ${pattern} escape '\\'`
        );
        if (searchCond) {
          conditions.push(searchCond);
        }
      }

      const query =
        conditions.length > 0
          ? db
              .select()
              .from(workers)
              .where(and(...conditions))
              .orderBy(workers.nextPaymentDueDate, workers.name)
          : db
              .select()
              .from(workers)
              .orderBy(workers.nextPaymentDueDate, workers.name);

      const rows = await query;
      return rows.map(mapWorkerRow);
    },

    async getWorkerById(id: string): Promise<FarmWorker | null> {
      const row = await db
        .select()
        .from(workers)
        .where(eq(workers.id, id))
        .get();
      return row ? mapWorkerRow(row) : null;
    },

    async createWorker(input: NewFarmWorkerInput): Promise<FarmWorker> {
      const validation = validateNewFarmWorker(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ?? 'Invalid worker data.';
        throw new HrValidationError(
          validation.errors as ValidationErrors<Record<string, unknown>>,
          msg
        );
      }

      const existingWorkers = await db.select().from(workers);
      const targetName = normDupText(validation.data.name);
      const targetRole = normDupText(validation.data.role);
      const targetPhone = normPhoneDigits(validation.data.phone);
      const dupWorker = existingWorkers.find((w) => {
        if (normDupText(w.name) !== targetName) return false;
        const rowPhone = normPhoneDigits(w.phone);
        if (targetPhone && rowPhone && targetPhone === rowPhone) return true;
        return normDupText(w.role) === targetRole;
      });
      if (dupWorker) {
        const msg = `A worker named "${validation.data.name}" with the same phone or role already exists.`;
        throw new HrValidationError({ name: msg }, msg);
      }

      const now = Date.now();
      const record: typeof workers.$inferInsert = {
        id: generateId(),
        name: validation.data.name,
        role: validation.data.role,
        phone: validation.data.phone,
        responsibilities: validation.data.responsibilities,
        salaryAmount: validation.data.salaryAmount,
        payFrequency: validation.data.payFrequency,
        nextPaymentDueDate: validation.data.nextPaymentDueDate,
        status: validation.data.status,
        hireDate: validation.data.hireDate,
        paymentNotifiedForDueDate: null,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(workers).values(record).run();
      events.emit(['hr'], record.id);
      return mapWorkerRow(record as WorkerRow);
    },

    async updateWorker(
      id: string,
      input: UpdateFarmWorkerInput
    ): Promise<FarmWorker> {
      const existing = await this.getWorkerById(id);
      if (!existing) {
        throw new WorkerNotFoundError(id);
      }

      const validation = validateUpdateFarmWorker(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid worker update.';
        throw new HrValidationError(
          validation.errors as ValidationErrors<Record<string, unknown>>,
          msg
        );
      }

      const existingWorkers = await db.select().from(workers);
      const nextName = validation.data.name ?? existing.name;
      const nextRole = validation.data.role ?? existing.role;
      const nextPhone =
        validation.data.phone !== undefined ? validation.data.phone : existing.phone;
      const targetName = normDupText(nextName);
      const targetRole = normDupText(nextRole);
      const targetPhone = normPhoneDigits(nextPhone);
      const dupWorker = existingWorkers.find((w) => {
        if (w.id === id) return false;
        if (normDupText(w.name) !== targetName) return false;
        const rowPhone = normPhoneDigits(w.phone);
        if (targetPhone && rowPhone && targetPhone === rowPhone) return true;
        return normDupText(w.role) === targetRole;
      });
      if (dupWorker) {
        const msg = `A worker named "${nextName}" with the same phone or role already exists.`;
        throw new HrValidationError({ name: msg }, msg);
      }

      const dueChanged =
        validation.data.nextPaymentDueDate !== undefined &&
        validation.data.nextPaymentDueDate !== existing.nextPaymentDueDate;

      const now = Date.now();
      const nextNotifiedFor = dueChanged
        ? null
        : existing.paymentNotifiedForDueDate;

      await db
        .update(workers)
        .set({
          ...validation.data,
          paymentNotifiedForDueDate: nextNotifiedFor,
          updatedAt: now,
        })
        .where(eq(workers.id, id))
        .run();

      events.emit(['hr'], id);

      return {
        ...existing,
        ...validation.data,
        paymentNotifiedForDueDate: nextNotifiedFor,
        updatedAt: now,
      };
    },

    async removeWorker(id: string): Promise<boolean> {
      const existing = await this.getWorkerById(id);
      if (!existing) return false;
      await db.delete(workers).where(eq(workers.id, id)).run();
      events.emit(['hr'], id);
      return true;
    },

    async listPayments(
      filter?: WorkerPaymentFilter
    ): Promise<WorkerPayment[]> {
      const conditions: SQL[] = [];

      if (filter?.workerId) {
        conditions.push(eq(workerPayments.workerId, filter.workerId));
      }
      if (filter?.status && filter.status !== 'all') {
        conditions.push(eq(workerPayments.status, filter.status));
      }
      const trimmedSearch = filter?.search?.trim();
      if (trimmedSearch) {
        const pattern = `%${escapeLikePattern(trimmedSearch.toLowerCase())}%`;
        const searchCond = or(
          sql`lower(coalesce(${workerPayments.periodLabel}, '')) like ${pattern} escape '\\'`,
          sql`lower(coalesce(${workerPayments.notes}, '')) like ${pattern} escape '\\'`
        );
        if (searchCond) {
          conditions.push(searchCond);
        }
      }

      const query =
        conditions.length > 0
          ? db
              .select()
              .from(workerPayments)
              .where(and(...conditions))
              .orderBy(
                workerPayments.status,
                desc(workerPayments.dueDate),
                desc(workerPayments.createdAt)
              )
          : db
              .select()
              .from(workerPayments)
              .orderBy(
                workerPayments.status,
                desc(workerPayments.dueDate),
                desc(workerPayments.createdAt)
              );

      const rows = await query;
      return rows.map(mapPaymentRow);
    },

    async getPaymentById(id: string): Promise<WorkerPayment | null> {
      const row = await db
        .select()
        .from(workerPayments)
        .where(eq(workerPayments.id, id))
        .get();
      return row ? mapPaymentRow(row) : null;
    },

    async createPayment(
      input: NewWorkerPaymentInput,
      options?: CreateWorkerPaymentOptions
    ): Promise<CreateWorkerPaymentResult> {
      const validation = validateNewWorkerPayment(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid payment data.';
        throw new HrValidationError(
          validation.errors as ValidationErrors<Record<string, unknown>>,
          msg
        );
      }

      const worker = await this.getWorkerById(validation.data.workerId);
      if (!worker) {
        throw new HrValidationError(
          { workerId: 'Selected worker does not exist.' },
          'Selected worker does not exist.'
        );
      }

      const existingPays = await db
        .select()
        .from(workerPayments)
        .where(
          and(
            eq(workerPayments.workerId, validation.data.workerId),
            eq(workerPayments.dueDate, validation.data.dueDate)
          )
        );
      const targetPayCents = Math.round(validation.data.amount * 100);
      const targetPeriod = normDupText(validation.data.periodLabel);
      if (
        existingPays.some(
          (p) =>
            Math.round(Number(p.amount) * 100) === targetPayCents &&
            normDupText(p.periodLabel) === targetPeriod
        )
      ) {
        const msg = `Duplicate payroll payment detected for this worker on ${validation.data.dueDate}.`;
        throw new HrValidationError({ dueDate: msg }, msg);
      }

      let generatedExpenseLog: FinancialLog | null = null;
      if (validation.data.status === 'paid' && options?.autoRecordExpense) {
        const effectiveDate = validation.data.paidDate ?? getTodayIsoDate();
        generatedExpenseLog = await financialRepo.create({
          transactionType: 'expense',
          category: 'payroll',
          amount: validation.data.amount,
          date: effectiveDate,
          notes: `Payroll (${worker.name} · ${worker.role})${
            validation.data.periodLabel
              ? ` — ${validation.data.periodLabel}`
              : ''
          }`,
        });
      }

      const now = Date.now();
      const record: typeof workerPayments.$inferInsert = {
        id: generateId(),
        workerId: validation.data.workerId,
        financialLogId: generatedExpenseLog?.id ?? null,
        amount: validation.data.amount,
        dueDate: validation.data.dueDate,
        paidDate: validation.data.paidDate,
        status: validation.data.status,
        periodLabel: validation.data.periodLabel,
        notes: validation.data.notes,
        notifiedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(workerPayments).values(record).run();

      if (
        validation.data.status === 'paid' &&
        options?.advanceWorkerDueDate &&
        validation.data.dueDate >= worker.nextPaymentDueDate
      ) {
        const nextDue = advancePayDueDate(
          worker.nextPaymentDueDate,
          worker.payFrequency
        );
        await db
          .update(workers)
          .set({
            nextPaymentDueDate: nextDue,
            paymentNotifiedForDueDate: null,
            updatedAt: now,
          })
          .where(eq(workers.id, worker.id))
          .run();
      }

      events.emit(
        generatedExpenseLog ? ['hr', 'financial'] : ['hr'],
        record.id
      );

      return {
        payment: mapPaymentRow(record as WorkerPaymentRow),
        generatedExpenseLog,
      };
    },

    async updatePayment(
      id: string,
      input: UpdateWorkerPaymentInput
    ): Promise<WorkerPayment> {
      const existing = await this.getPaymentById(id);
      if (!existing) {
        throw new WorkerPaymentNotFoundError(id);
      }

      const validation = validateUpdateWorkerPayment(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid payment update.';
        throw new HrValidationError(
          validation.errors as ValidationErrors<Record<string, unknown>>,
          msg
        );
      }

      const nextWorkerId = validation.data.workerId ?? existing.workerId;
      const nextDueDate = validation.data.dueDate ?? existing.dueDate;
      const nextAmount = validation.data.amount ?? existing.amount;
      const nextPeriod =
        validation.data.periodLabel !== undefined
          ? validation.data.periodLabel
          : existing.periodLabel;
      const existingPays = await db
        .select()
        .from(workerPayments)
        .where(
          and(
            eq(workerPayments.workerId, nextWorkerId),
            eq(workerPayments.dueDate, nextDueDate)
          )
        );
      const targetPayCents = Math.round(nextAmount * 100);
      const targetPeriod = normDupText(nextPeriod);
      if (
        existingPays.some(
          (p) =>
            p.id !== id &&
            Math.round(Number(p.amount) * 100) === targetPayCents &&
            normDupText(p.periodLabel) === targetPeriod
        )
      ) {
        const msg = `Duplicate payroll payment detected for this worker on ${nextDueDate}.`;
        throw new HrValidationError({ dueDate: msg }, msg);
      }

      const nextStatus = validation.data.status ?? existing.status;
      let nextPaidDate =
        validation.data.paidDate !== undefined
          ? validation.data.paidDate
          : existing.paidDate;
      if (nextStatus === 'paid' && !nextPaidDate) {
        nextPaidDate = getTodayIsoDate();
      } else if (nextStatus === 'pending') {
        nextPaidDate = null;
      }

      const resetNotified =
        validation.data.dueDate !== undefined &&
        validation.data.dueDate !== existing.dueDate;
      const nextNotifiedAt = resetNotified ? null : existing.notifiedAt;

      const now = Date.now();
      await db
        .update(workerPayments)
        .set({
          ...validation.data,
          paidDate: nextPaidDate,
          notifiedAt: nextNotifiedAt,
          updatedAt: now,
        })
        .where(eq(workerPayments.id, id))
        .run();

      events.emit(['hr'], id);

      return {
        ...existing,
        ...validation.data,
        paidDate: nextPaidDate,
        notifiedAt: nextNotifiedAt,
        updatedAt: now,
      };
    },

    async markPaymentPaid(
      id: string,
      options?: MarkWorkerPaymentPaidOptions
    ): Promise<CreateWorkerPaymentResult> {
      const existing = await this.getPaymentById(id);
      if (!existing) {
        throw new WorkerPaymentNotFoundError(id);
      }
      const worker = await this.getWorkerById(existing.workerId);
      const effectivePaidDate = options?.paidDate ?? getTodayIsoDate();

      let generatedExpenseLog: FinancialLog | null = null;
      let nextFinancialLogId = existing.financialLogId;

      if (
        options?.autoRecordExpense &&
        !existing.financialLogId &&
        worker
      ) {
        generatedExpenseLog = await financialRepo.create({
          transactionType: 'expense',
          category: 'payroll',
          amount: existing.amount,
          date: effectivePaidDate,
          notes: `Payroll (${worker.name} · ${worker.role})${
            existing.periodLabel ? ` — ${existing.periodLabel}` : ''
          }`,
        });
        nextFinancialLogId = generatedExpenseLog.id;
      }

      const now = Date.now();
      await db
        .update(workerPayments)
        .set({
          status: 'paid',
          paidDate: effectivePaidDate,
          financialLogId: nextFinancialLogId,
          updatedAt: now,
        })
        .where(eq(workerPayments.id, id))
        .run();

      if (
        worker &&
        options?.advanceWorkerDueDate &&
        existing.dueDate >= worker.nextPaymentDueDate
      ) {
        const nextDue = advancePayDueDate(
          worker.nextPaymentDueDate,
          worker.payFrequency
        );
        await db
          .update(workers)
          .set({
            nextPaymentDueDate: nextDue,
            paymentNotifiedForDueDate: null,
            updatedAt: now,
          })
          .where(eq(workers.id, worker.id))
          .run();
      }

      events.emit(generatedExpenseLog ? ['hr', 'financial'] : ['hr'], id);

      return {
        payment: {
          ...existing,
          status: 'paid',
          paidDate: effectivePaidDate,
          financialLogId: nextFinancialLogId,
          updatedAt: now,
        },
        generatedExpenseLog,
      };
    },

    async removePayment(id: string): Promise<boolean> {
      const existing = await this.getPaymentById(id);
      if (!existing) return false;
      await db.delete(workerPayments).where(eq(workerPayments.id, id)).run();
      events.emit(['hr'], id);
      return true;
    },

    async listTasks(filter?: WorkerTaskFilter): Promise<WorkerTask[]> {
      const conditions: SQL[] = [];

      if (filter?.workerId) {
        conditions.push(eq(workerTasks.workerId, filter.workerId));
      }
      if (filter?.status && filter.status !== 'all') {
        conditions.push(eq(workerTasks.status, filter.status));
      }
      if (filter?.priority && filter.priority !== 'all') {
        conditions.push(eq(workerTasks.priority, filter.priority));
      }
      const trimmedSearch = filter?.search?.trim();
      if (trimmedSearch) {
        const pattern = `%${escapeLikePattern(trimmedSearch.toLowerCase())}%`;
        const searchCond = or(
          sql`lower(${workerTasks.title}) like ${pattern} escape '\\'`,
          sql`lower(coalesce(${workerTasks.description}, '')) like ${pattern} escape '\\'`
        );
        if (searchCond) {
          conditions.push(searchCond);
        }
      }

      const query =
        conditions.length > 0
          ? db
              .select()
              .from(workerTasks)
              .where(and(...conditions))
              .orderBy(workerTasks.status, workerTasks.dueDate, desc(workerTasks.createdAt))
          : db
              .select()
              .from(workerTasks)
              .orderBy(workerTasks.status, workerTasks.dueDate, desc(workerTasks.createdAt));

      const rows = await query;
      return rows.map(mapTaskRow);
    },

    async getTaskById(id: string): Promise<WorkerTask | null> {
      const row = await db
        .select()
        .from(workerTasks)
        .where(eq(workerTasks.id, id))
        .get();
      return row ? mapTaskRow(row) : null;
    },

    async createTask(input: NewWorkerTaskInput): Promise<WorkerTask> {
      const validation = validateNewWorkerTask(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ?? 'Invalid task data.';
        throw new HrValidationError(
          validation.errors as ValidationErrors<Record<string, unknown>>,
          msg
        );
      }

      const worker = await this.getWorkerById(validation.data.workerId);
      if (!worker) {
        throw new HrValidationError(
          { workerId: 'Assigned worker does not exist.' },
          'Assigned worker does not exist.'
        );
      }

      const existingTasks = await db
        .select()
        .from(workerTasks)
        .where(eq(workerTasks.workerId, validation.data.workerId));
      const targetTaskTitle = normDupText(validation.data.title);
      const targetTaskDue = validation.data.dueDate ?? null;
      const targetTaskLivestock = validation.data.livestockId ?? null;
      if (
        existingTasks.some(
          (t) =>
            normDupText(t.title) === targetTaskTitle &&
            (t.dueDate ?? null) === targetTaskDue &&
            (t.livestockId ?? null) === targetTaskLivestock
        )
      ) {
        const msg =
          'Duplicate task detected for this worker with the same title and due date.';
        throw new HrValidationError({ title: msg }, msg);
      }

      const now = Date.now();
      const record: typeof workerTasks.$inferInsert = {
        id: generateId(),
        workerId: validation.data.workerId,
        livestockId: validation.data.livestockId,
        title: validation.data.title,
        description: validation.data.description,
        priority: validation.data.priority,
        status: validation.data.status,
        dueDate: validation.data.dueDate,
        completedAt: validation.data.status === 'completed' ? now : null,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(workerTasks).values(record).run();
      events.emit(['hr'], record.id);
      return mapTaskRow(record as WorkerTaskRow);
    },

    async updateTask(
      id: string,
      input: UpdateWorkerTaskInput
    ): Promise<WorkerTask> {
      const existing = await this.getTaskById(id);
      if (!existing) {
        throw new WorkerTaskNotFoundError(id);
      }

      const validation = validateUpdateWorkerTask(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ?? 'Invalid task update.';
        throw new HrValidationError(
          validation.errors as ValidationErrors<Record<string, unknown>>,
          msg
        );
      }

      const nextWorkerId = validation.data.workerId ?? existing.workerId;
      const nextTitle = validation.data.title ?? existing.title;
      const nextDueDate =
        validation.data.dueDate !== undefined
          ? validation.data.dueDate
          : existing.dueDate;
      const nextLivestockId =
        validation.data.livestockId !== undefined
          ? validation.data.livestockId
          : existing.livestockId;
      const existingTasks = await db
        .select()
        .from(workerTasks)
        .where(eq(workerTasks.workerId, nextWorkerId));
      const targetTaskTitle = normDupText(nextTitle);
      if (
        existingTasks.some(
          (t) =>
            t.id !== id &&
            normDupText(t.title) === targetTaskTitle &&
            (t.dueDate ?? null) === (nextDueDate ?? null) &&
            (t.livestockId ?? null) === (nextLivestockId ?? null)
        )
      ) {
        const msg =
          'Duplicate task detected for this worker with the same title and due date.';
        throw new HrValidationError({ title: msg }, msg);
      }

      const now = Date.now();
      const nextStatus = validation.data.status ?? existing.status;
      let nextCompletedAt = existing.completedAt;
      if (nextStatus === 'completed' && existing.status !== 'completed') {
        nextCompletedAt = now;
      } else if (nextStatus !== 'completed') {
        nextCompletedAt = null;
      }

      await db
        .update(workerTasks)
        .set({
          ...validation.data,
          completedAt: nextCompletedAt,
          updatedAt: now,
        })
        .where(eq(workerTasks.id, id))
        .run();

      events.emit(['hr'], id);

      return {
        ...existing,
        ...validation.data,
        completedAt: nextCompletedAt,
        updatedAt: now,
      };
    },

    async removeTask(id: string): Promise<boolean> {
      const existing = await this.getTaskById(id);
      if (!existing) return false;
      await db.delete(workerTasks).where(eq(workerTasks.id, id)).run();
      events.emit(['hr'], id);
      return true;
    },

    async listDuePaymentNotifications(
      todayIso: string = getTodayIsoDate(),
      leadDays = 3
    ): Promise<HrDuePaymentAlertItem[]> {
      const [allWorkers, allPayments] = await Promise.all([
        this.listWorkers({}),
        this.listPayments({ status: 'pending' }),
      ]);
      const summary = computeHrSummary(
        allWorkers,
        allPayments,
        [],
        todayIso,
        leadDays
      );

      return summary.duePaymentAlerts.filter((item) => {
        if (item.kind === 'pending_payment' && item.payment) {
          return item.payment.notifiedAt === null;
        }
        return item.worker.paymentNotifiedForDueDate !== item.dueDate;
      });
    },

    async markPaymentNotificationsDelivered(
      items: readonly HrDuePaymentAlertItem[],
      notifiedAt: number = Date.now()
    ): Promise<void> {
      if (items.length === 0) return;

      for (const item of items) {
        if (item.kind === 'pending_payment' && item.payment) {
          await db
            .update(workerPayments)
            .set({ notifiedAt, updatedAt: notifiedAt })
            .where(eq(workerPayments.id, item.payment.id))
            .run();
        } else {
          await db
            .update(workers)
            .set({
              paymentNotifiedForDueDate: item.dueDate,
              updatedAt: notifiedAt,
            })
            .where(eq(workers.id, item.worker.id))
            .run();
        }
      }

      events.emit(['hr']);
    },
  };
}
