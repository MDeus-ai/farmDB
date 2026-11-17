import type { FarmDbSnapshot } from '@farmdb/core';
import type { FarmDrizzleDb } from '../driver';
import type { DatabaseEventBus } from '../events';
import {
  alerts,
  farmSettings,
  financialLogs,
  livestock,
  medicalRecords,
  productRecords,
} from '../schema';
import type { AlertsRepository } from './alertsRepository';
import type { FinancialRepository } from './financialRepository';
import type { LivestockRepository } from './livestockRepository';
import type { MedicalRepository } from './medicalRepository';
import type { ProductionRepository } from './productionRepository';
import type { SettingsRepository } from './settingsRepository';

export interface RestoreSnapshotResult {
  livestockCount: number;
  productCount: number;
  medicalCount: number;
  financialCount: number;
  alertCount: number;
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
      ] = await Promise.all([
        repos.settings.get(),
        repos.livestock.list({}),
        repos.production.list({}),
        repos.medical.list({}),
        repos.financial.list({}),
        repos.alerts.list({}),
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
      };
    },

    async restoreSnapshot(
      snapshot: FarmDbSnapshot
    ): Promise<RestoreSnapshotResult> {
      // Delete child tables before parent livestock to satisfy foreign keys
      await db.delete(financialLogs).run();
      await db.delete(alerts).run();
      await db.delete(medicalRecords).run();
      await db.delete(productRecords).run();
      await db.delete(livestock).run();
      await db.delete(farmSettings).run();

      const now = Date.now();
      await db
        .insert(farmSettings)
        .values([
          {
            key: 'defaultMilkRatePerLiter',
            value: String(snapshot.settings.defaultMilkRatePerLiter),
            updatedAt: now,
          },
          {
            key: 'currencySymbol',
            value: snapshot.settings.currencySymbol,
            updatedAt: now,
          },
        ])
        .run();

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
            status: row.status,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          })
          .run();
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

      events.emit(['*']);

      return {
        livestockCount: snapshot.livestock.length,
        productCount: snapshot.productRecords.length,
        medicalCount: snapshot.medicalRecords.length,
        financialCount: snapshot.financialLogs.length,
        alertCount: snapshot.alerts.length,
      };
    },
  };
}
