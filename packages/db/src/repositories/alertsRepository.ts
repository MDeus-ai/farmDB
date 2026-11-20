import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import {
  generateId,
  getTodayIsoDate,
  validateNewAlert,
  validateUpdateAlert,
  type AlertEntryKind,
  type AlertFilter,
  type AlertItem,
  type NewAlertInput,
  type UpdateAlertInput,
  type ValidationErrors,
} from '@farmdb/core';
import type { FarmDrizzleDb } from '../driver';
import type { DatabaseEventBus } from '../events';
import { alerts } from '../schema';

export class AlertValidationError extends Error {
  readonly errors: ValidationErrors<NewAlertInput & UpdateAlertInput>;

  constructor(
    errors: ValidationErrors<NewAlertInput & UpdateAlertInput>,
    message = 'Alert or note validation failed.'
  ) {
    super(message);
    this.name = 'AlertValidationError';
    this.errors = errors;
  }
}

export class AlertNotFoundError extends Error {
  constructor(id: string) {
    super(`Alert or note "${id}" was not found.`);
    this.name = 'AlertNotFoundError';
  }
}

type AlertRow = typeof alerts.$inferSelect;

function mapRowToDomain(row: AlertRow): AlertItem {
  return {
    id: row.id,
    livestockId: row.livestockId,
    entryKind: (row.entryKind === 'note' ? 'note' : 'alert') as AlertEntryKind,
    title: row.title,
    description: row.description,
    triggerDate: row.triggerDate,
    isResolved: Boolean(row.isResolved),
    notifiedAt: row.notifiedAt ?? null,
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

export interface AlertsRepository {
  list(filter?: AlertFilter): Promise<AlertItem[]>;
  getById(id: string): Promise<AlertItem | null>;
  create(input: NewAlertInput): Promise<AlertItem>;
  update(id: string, input: UpdateAlertInput): Promise<AlertItem>;
  toggleResolved(id: string, isResolved: boolean): Promise<AlertItem>;
  listDueForNotification(todayIso?: string): Promise<AlertItem[]>;
  markNotified(ids: readonly string[], notifiedAt?: number): Promise<void>;
  remove(id: string): Promise<boolean>;
}

export function createAlertsRepository(
  db: FarmDrizzleDb,
  events: DatabaseEventBus
): AlertsRepository {
  return {
    async list(filter?: AlertFilter): Promise<AlertItem[]> {
      const conditions: SQL[] = [];

      if (filter?.entryKind && filter.entryKind !== 'all') {
        conditions.push(eq(alerts.entryKind, filter.entryKind));
      }

      if (filter?.status === 'open') {
        conditions.push(eq(alerts.isResolved, false));
      } else if (filter?.status === 'resolved') {
        conditions.push(eq(alerts.isResolved, true));
      }

      if (filter?.livestockId) {
        conditions.push(eq(alerts.livestockId, filter.livestockId));
      }

      const trimmedSearch = filter?.search?.trim();
      if (trimmedSearch) {
        const pattern = `%${escapeLikePattern(trimmedSearch.toLowerCase())}%`;
        const cond = or(
          sql`lower(${alerts.title}) like ${pattern} escape '\\'`,
          sql`lower(coalesce(${alerts.description}, '')) like ${pattern} escape '\\'`
        );
        if (cond) {
          conditions.push(cond);
        }
      }

      const query =
        conditions.length > 0
          ? db
              .select()
              .from(alerts)
              .where(and(...conditions))
              .orderBy(
                asc(alerts.isResolved),
                asc(alerts.triggerDate),
                desc(alerts.createdAt)
              )
          : db
              .select()
              .from(alerts)
              .orderBy(
                asc(alerts.isResolved),
                asc(alerts.triggerDate),
                desc(alerts.createdAt)
              );

      const rows = await query;
      return rows.map(mapRowToDomain);
    },

    async getById(id: string): Promise<AlertItem | null> {
      const row = await db
        .select()
        .from(alerts)
        .where(eq(alerts.id, id))
        .get();
      return row ? mapRowToDomain(row) : null;
    },

    async create(input: NewAlertInput): Promise<AlertItem> {
      const validation = validateNewAlert(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid alert or note.';
        throw new AlertValidationError(validation.errors, msg);
      }

      const matchingRows = await db
        .select()
        .from(alerts)
        .where(
          and(
            eq(alerts.entryKind, validation.data.entryKind),
            eq(alerts.triggerDate, validation.data.triggerDate)
          )
        );
      const targetTitle = normDupText(validation.data.title);
      const targetLivestock = validation.data.livestockId ?? null;
      const targetResolved = Boolean(validation.data.isResolved);
      const duplicate = matchingRows.find(
        (r) =>
          Boolean(r.isResolved) === targetResolved &&
          (r.livestockId ?? null) === targetLivestock &&
          normDupText(r.title) === targetTitle
      );
      if (duplicate) {
        const kindWord =
          validation.data.entryKind === 'note' ? 'farm note' : 'alert';
        const msg = `Duplicate ${kindWord} detected with the same title and date.`;
        throw new AlertValidationError({ title: msg }, msg);
      }

      const now = Date.now();
      const row: typeof alerts.$inferInsert = {
        id: generateId(),
        livestockId: validation.data.livestockId,
        entryKind: validation.data.entryKind,
        title: validation.data.title,
        description: validation.data.description,
        triggerDate: validation.data.triggerDate,
        isResolved: validation.data.isResolved,
        notifiedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(alerts).values(row).run();
      events.emit(['alerts'], row.id);
      return mapRowToDomain(row as AlertRow);
    },

    async update(id: string, input: UpdateAlertInput): Promise<AlertItem> {
      const existing = await this.getById(id);
      if (!existing) {
        throw new AlertNotFoundError(id);
      }

      const validation = validateUpdateAlert(input);
      if (!validation.ok || !validation.data) {
        const msg =
          Object.values(validation.errors).find(Boolean) ??
          'Invalid alert update.';
        throw new AlertValidationError(validation.errors, msg);
      }

      const nextKind = validation.data.entryKind ?? existing.entryKind;
      const nextDate = validation.data.triggerDate ?? existing.triggerDate;
      const nextTitle = validation.data.title ?? existing.title;
      const nextLivestock =
        validation.data.livestockId !== undefined
          ? validation.data.livestockId
          : existing.livestockId;
      const nextResolved =
        validation.data.isResolved !== undefined
          ? Boolean(validation.data.isResolved)
          : Boolean(existing.isResolved);
      const matchingRows = await db
        .select()
        .from(alerts)
        .where(
          and(
            eq(alerts.entryKind, nextKind),
            eq(alerts.triggerDate, nextDate)
          )
        );
      const targetTitle = normDupText(nextTitle);
      const duplicate = matchingRows.find(
        (r) =>
          r.id !== id &&
          Boolean(r.isResolved) === nextResolved &&
          (r.livestockId ?? null) === (nextLivestock ?? null) &&
          normDupText(r.title) === targetTitle
      );
      if (duplicate) {
        const kindWord = nextKind === 'note' ? 'farm note' : 'alert';
        const msg = `Duplicate ${kindWord} detected with the same title and date.`;
        throw new AlertValidationError({ title: msg }, msg);
      }

      const now = Date.now();
      const resetNotification =
        validation.data.triggerDate !== undefined &&
        validation.data.triggerDate !== existing.triggerDate;

      const patch: Partial<typeof alerts.$inferInsert> = {
        ...validation.data,
        ...(resetNotification ? { notifiedAt: null } : {}),
        updatedAt: now,
      };

      await db.update(alerts).set(patch).where(eq(alerts.id, id)).run();
      events.emit(['alerts'], id);

      return {
        ...existing,
        ...validation.data,
        notifiedAt: resetNotification ? null : existing.notifiedAt,
        updatedAt: now,
      };
    },

    async toggleResolved(id: string, isResolved: boolean): Promise<AlertItem> {
      return this.update(id, { isResolved });
    },

    async listDueForNotification(
      todayIso: string = getTodayIsoDate()
    ): Promise<AlertItem[]> {
      const rows = await db
        .select()
        .from(alerts)
        .where(
          and(
            eq(alerts.entryKind, 'alert'),
            eq(alerts.isResolved, false),
            isNull(alerts.notifiedAt),
            lte(alerts.triggerDate, todayIso)
          )
        )
        .orderBy(asc(alerts.triggerDate));

      return rows.map(mapRowToDomain);
    },

    async markNotified(
      ids: readonly string[],
      notifiedAt: number = Date.now()
    ): Promise<void> {
      if (ids.length === 0) {
        return;
      }
      await db
        .update(alerts)
        .set({ notifiedAt, updatedAt: notifiedAt })
        .where(inArray(alerts.id, [...ids]))
        .run();

      events.emit(['alerts']);
    },

    async remove(id: string): Promise<boolean> {
      const existing = await this.getById(id);
      if (!existing) {
        return false;
      }
      await db.delete(alerts).where(eq(alerts.id, id)).run();
      events.emit(['alerts'], id);
      return true;
    },
  };
}
