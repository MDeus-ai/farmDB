import { eq } from 'drizzle-orm';
import {
  DEFAULT_FARM_SETTINGS,
  validateFarmSettings,
  type FarmDbSnapshot,
  type FarmSettings,
} from '@farmdb/core';
import type { FarmDrizzleDb } from '../driver';
import type { DatabaseEventBus } from '../events';
import {
  alerts,
  animalOwnerships,
  farmAccounts,
  farmSettings,
  financialLogs,
  livestock,
  medicalRecords,
  productRecords,
  workerPayments,
  workers,
  workerTasks,
} from '../schema';
import type { AlertsRepository } from './alertsRepository';
import type { FinancialRepository } from './financialRepository';
import type { HrRepository } from './hrRepository';
import type { LivestockRepository } from './livestockRepository';
import type { MedicalRepository } from './medicalRepository';
import type { NetworkRepository } from './networkRepository';
import type { OwnershipRepository } from './ownershipRepository';
import type { ProductionRepository } from './productionRepository';
import type { SettingsRepository } from './settingsRepository';

export interface RestoreSnapshotResult {
  livestockCount: number;
  productCount: number;
  medicalCount: number;
  financialCount: number;
  alertCount: number;
  workerCount?: number;
  workerPaymentCount?: number;
  workerTaskCount?: number;
  ownershipCount?: number;
  accountCount?: number;
}

export interface BackupRepository {
  exportSnapshot(): Promise<FarmDbSnapshot>;
  restoreSnapshot(snapshot: FarmDbSnapshot): Promise<RestoreSnapshotResult>;
}

export function createBackupRepository(
  db: FarmDrizzleDb,
  events: DatabaseEventBus,
  repos: {
    livestock: LivestockRepository;
    production: ProductionRepository;
    medical: MedicalRepository;
    financial: FinancialRepository;
    alerts: AlertsRepository;
    hr: HrRepository;
    ownerships?: OwnershipRepository;
    network?: NetworkRepository;
    settings: SettingsRepository;
  }
): BackupRepository {
  return {
    async exportSnapshot(): Promise<FarmDbSnapshot> {
      const [
        currentSettings,
        allLivestock,
        allProduction,
        allMedical,
        allFinancial,
        allAlerts,
        allWorkers,
        allWorkerPayments,
        allWorkerTasks,
        allOwnerships,
        allAccounts,
      ] = await Promise.all([
        repos.settings.get(),
        repos.livestock.list({}),
        repos.production.list({}),
        repos.medical.list({}),
        repos.financial.list({}),
        repos.alerts.list({}),
        repos.hr.listWorkers({}),
        repos.hr.listPayments({}),
        repos.hr.listTasks({}),
        repos.ownerships ? repos.ownerships.list({}) : Promise.resolve([]),
        repos.network ? repos.network.listAccountsRaw() : Promise.resolve([]),
      ]);

      return {
        version: 1,
        app: 'farmDB',
        exportedAt: new Date().toISOString(),
        settings: currentSettings,
        livestock: allLivestock,
        productRecords: allProduction,
        medicalRecords: allMedical,
        financialLogs: allFinancial,
        alerts: allAlerts,
        workers: allWorkers,
        workerPayments: allWorkerPayments,
        workerTasks: allWorkerTasks,
        animalOwnerships: allOwnerships,
        farmAccounts: allAccounts,
      };
    },

    async restoreSnapshot(
      snapshot: FarmDbSnapshot
    ): Promise<RestoreSnapshotResult> {
      // Delete child tables before parent tables to satisfy foreign keys
      await db.delete(workerTasks).run();
      await db.delete(workerPayments).run();
      await db.delete(workers).run();
      await db.delete(animalOwnerships).run();
      await db.delete(financialLogs).run();
      await db.delete(alerts).run();
      await db.delete(medicalRecords).run();
      await db.delete(productRecords).run();
      await db.delete(livestock).run();
      await db.delete(farmAccounts).run();
      await db.delete(farmSettings).run();

      const now = Date.now();
      const validated = validateFarmSettings({
        ...DEFAULT_FARM_SETTINGS,
        ...(snapshot.settings ?? {}),
      });
      const settingsToRestore: FarmSettings =
        validated.ok && validated.data
          ? validated.data
          : { ...DEFAULT_FARM_SETTINGS };
      const settingKeys = Object.keys(settingsToRestore) as Array<
        keyof FarmSettings
      >;

      await db
        .insert(farmSettings)
        .values(
          settingKeys.map((key) => ({
            key,
            value: String(settingsToRestore[key]),
            updatedAt: now,
          }))
        )
        .run();

      const restoredLivestockIds = new Set(snapshot.livestock.map((r) => r.id));

      for (const row of snapshot.livestock) {
        await db
          .insert(livestock)
          .values({
            id: row.id,
            species: row.species,
            tagNumber: row.tagNumber,
            name: row.name,
            breed: row.breed,
            dob: row.dob,
            imageUri: row.imageUri,
            sireId: null,
            damId: null,
            status: row.status,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          })
          .run();
      }

      for (const row of snapshot.livestock) {
        const validSireId =
          row.sireId && row.sireId !== row.id && restoredLivestockIds.has(row.sireId)
            ? row.sireId
            : null;
        const validDamId =
          row.damId &&
          row.damId !== row.id &&
          row.damId !== validSireId &&
          restoredLivestockIds.has(row.damId)
            ? row.damId
            : null;

        if (validSireId || validDamId) {
          await db
            .update(livestock)
            .set({ sireId: validSireId, damId: validDamId })
            .where(eq(livestock.id, row.id))
            .run();
        }
      }

      for (const row of snapshot.productRecords) {
        await db
          .insert(productRecords)
          .values({
            id: row.id,
            livestockId: row.livestockId,
            date: row.date,
            yieldAmount: row.yieldAmount,
            qualityNotes: row.qualityNotes,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          })
          .run();
      }

      for (const row of snapshot.medicalRecords) {
        await db
          .insert(medicalRecords)
          .values({
            id: row.id,
            livestockId: row.livestockId,
            date: row.date,
            condition: row.condition,
            treatment: row.treatment,
            cost: row.cost,
            veterinarian: row.veterinarian,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          })
          .run();
      }

      for (const row of snapshot.financialLogs) {
        await db
          .insert(financialLogs)
          .values({
            id: row.id,
            livestockId: row.livestockId,
            productRecordId: row.productRecordId,
            transactionType: row.transactionType,
            amount: row.amount,
            date: row.date,
            category: row.category,
            notes: row.notes,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          })
          .run();
      }

      for (const row of snapshot.alerts) {
        await db
          .insert(alerts)
          .values({
            id: row.id,
            livestockId: row.livestockId,
            entryKind: row.entryKind,
            title: row.title,
            description: row.description,
            triggerDate: row.triggerDate,
            isResolved: row.isResolved,
            notifiedAt: row.notifiedAt,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          })
          .run();
      }

      const workersList = snapshot.workers ?? [];
      for (const row of workersList) {
        await db
          .insert(workers)
          .values({
            id: row.id,
            name: row.name,
            role: row.role,
            phone: row.phone,
            responsibilities: row.responsibilities,
            salaryAmount: row.salaryAmount,
            payFrequency: row.payFrequency,
            nextPaymentDueDate: row.nextPaymentDueDate,
            status: row.status,
            hireDate: row.hireDate,
            paymentNotifiedForDueDate: row.paymentNotifiedForDueDate ?? null,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          })
          .run();
      }

      const workerPaymentsList = snapshot.workerPayments ?? [];
      for (const row of workerPaymentsList) {
        await db
          .insert(workerPayments)
          .values({
            id: row.id,
            workerId: row.workerId,
            financialLogId: row.financialLogId,
            amount: row.amount,
            dueDate: row.dueDate,
            paidDate: row.paidDate,
            status: row.status,
            periodLabel: row.periodLabel,
            notes: row.notes,
            notifiedAt: row.notifiedAt ?? null,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          })
          .run();
      }

      const workerTasksList = snapshot.workerTasks ?? [];
      for (const row of workerTasksList) {
        await db
          .insert(workerTasks)
          .values({
            id: row.id,
            workerId: row.workerId,
            livestockId: row.livestockId,
            title: row.title,
            description: row.description,
            priority: row.priority,
            status: row.status,
            dueDate: row.dueDate,
            completedAt: row.completedAt ?? null,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          })
          .run();
      }

      const ownershipsList = snapshot.animalOwnerships ?? [];
      for (const row of ownershipsList) {
        if (!restoredLivestockIds.has(row.livestockId)) {
          continue;
        }
        await db
          .insert(animalOwnerships)
          .values({
            id: row.id,
            livestockId: row.livestockId,
            ownerName: row.ownerName,
            ownerContact: row.ownerContact ?? null,
            accountId: row.accountId ?? null,
            ownershipCategory: row.ownershipCategory,
            sharePercentage: row.sharePercentage,
            purpose: row.purpose ?? null,
            startDate: row.startDate,
            expectedEndDate: row.expectedEndDate ?? null,
            boardingFee: row.boardingFee ?? 0,
            status: row.status,
            notes: row.notes ?? null,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          })
          .run();
      }

      const accountsList = snapshot.farmAccounts ?? [];
      for (const row of accountsList) {
        await db
          .insert(farmAccounts)
          .values({
            id: row.id,
            displayName: row.displayName,
            email: row.email ?? null,
            phone: row.phone ?? null,
            role: row.role,
            relationship: row.relationship ?? null,
            avatarKey: row.avatarKey ?? 'farmer',
            accessCode: row.accessCode ?? null,
            isPrimaryAdmin: Boolean(row.isPrimaryAdmin),
            canManageNetwork: Boolean(row.canManageNetwork),
            canSyncCloud: Boolean(row.canSyncCloud),
            permissionsJson: JSON.stringify(row.permissions),
            status: row.status ?? 'active',
            lastSyncedAt: row.lastSyncedAt ?? null,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          })
          .run();
      }

      events.emit(['*']);

      const extraCounts = {
        ...(workersList.length > 0 ||
        workerPaymentsList.length > 0 ||
        workerTasksList.length > 0
          ? {
              workerCount: workersList.length,
              workerPaymentCount: workerPaymentsList.length,
              workerTaskCount: workerTasksList.length,
            }
          : {}),
        ...(ownershipsList.length > 0
          ? { ownershipCount: ownershipsList.length }
          : {}),
        ...(accountsList.length > 0
          ? { accountCount: accountsList.length }
          : {}),
      };

      return {
        livestockCount: snapshot.livestock.length,
        productCount: snapshot.productRecords.length,
        medicalCount: snapshot.medicalRecords.length,
        financialCount: snapshot.financialLogs.length,
        alertCount: snapshot.alerts.length,
        ...extraCounts,
      };
    },
  };
}
