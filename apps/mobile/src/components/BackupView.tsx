import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ExportTableKey } from '@farmdb/core';
import { useFarmDb, useFarmSummary } from '@farmdb/db';
import type { ExpoSqlController } from '../db/mobileDriver';
import {
  exportCsvMobile,
  exportJsonMobile,
  exportSqliteBytesMobile,
  pickBinaryDbBackupMobile,
  pickJsonSnapshotMobile,
} from '../services/exportBackup';
import { FARMDB_COLORS, FARMDB_FONTS, useUiScale } from '../theme/uiScale';
import { AppIcon } from './FarmIcons';
import { FarmScrollView } from './FarmScrollView';

interface BackupViewProps {
  sqlController: ExpoSqlController;
}

const EXPORT_TABLES: Array<{ key: ExportTableKey; label: string }> = [
  { key: 'livestock', label: 'Livestock CSV' },
  { key: 'product_records', label: 'Milk Yields CSV' },
  { key: 'medical_records', label: 'Medical CSV' },
  { key: 'financial_logs', label: 'Financial CSV' },
  { key: 'alerts', label: 'Alerts & Notes CSV' },
  { key: 'workers', label: 'Workers CSV' },
  { key: 'worker_payments', label: 'Payments CSV' },
  { key: 'worker_tasks', label: 'Tasks CSV' },
  { key: 'animal_ownerships', label: 'Ownerships CSV' },
  { key: 'farm_accounts', label: 'Network Accounts CSV' },
];

export function BackupView({ sqlController }: BackupViewProps) {
  const ui = useUiScale();
  const { backup, events } = useFarmDb();
  const summaryQuery = useFarmSummary();
  const summary = summaryQuery.data;

  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function runAction(task: () => Promise<void>) {
    setBusy(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      await task();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Operation failed.');
    } finally {
      setBusy(false);
    }
  }

  const statCardStyle = [
    styles.statBox,
    {
      padding: ui.space(10),
      borderRadius: Math.max(10, ui.radius - 2),
      flexBasis: ui.isTablet
        ? ('23%' as const)
        : ui.isCompactPhone && (ui.isLargeText || ui.isLargeDensity)
          ? ('100%' as const)
          : ('45%' as const),
      minWidth: 120,
    },
  ];

  return (
    <FarmScrollView
      dockAware
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          padding: ui.contentPadding,
          gap: ui.space(12),
          paddingBottom: ui.bottomDockReserve,
        },
      ]}
    >
      <View style={[styles.statsGrid, { flexWrap: 'wrap', gap: ui.space(8) }]}>
        <View style={statCardStyle}>
          <Text style={[styles.statLabel, { fontSize: ui.font(11) }]}>Animals</Text>
          <Text style={[styles.statValue, { fontSize: ui.font(18) }]}>
            {summary?.totalLivestock ?? 0}
          </Text>
        </View>
        <View style={statCardStyle}>
          <Text style={[styles.statLabel, { fontSize: ui.font(11) }]}>Yields</Text>
          <Text style={[styles.statValue, { fontSize: ui.font(18) }]}>
            {summary?.productRecordCount ?? 0}
          </Text>
        </View>
        <View style={statCardStyle}>
          <Text style={[styles.statLabel, { fontSize: ui.font(11) }]}>Medical</Text>
          <Text style={[styles.statValue, { fontSize: ui.font(18) }]}>
            {summary?.medicalRecordCount ?? 0}
          </Text>
        </View>
        <View style={statCardStyle}>
          <Text style={[styles.statLabel, { fontSize: ui.font(11) }]}>Finance</Text>
          <Text style={[styles.statValue, { fontSize: ui.font(18) }]}>
            {summary?.financialLogCount ?? 0}
          </Text>
        </View>
      </View>

      {statusMessage ? (
        <View style={[styles.statusBanner, { padding: ui.space(12), borderRadius: ui.radius }]}>
          <Text style={[styles.statusText, { fontSize: ui.font(13) }]}>
            {statusMessage}
          </Text>
        </View>
      ) : null}

      {errorMessage ? (
        <View style={[styles.errorBanner, { padding: ui.space(12), borderRadius: ui.radius }]}>
          <Text style={[styles.errorText, { fontSize: ui.font(13) }]}>
            {errorMessage}
          </Text>
        </View>
      ) : null}

      <View style={[styles.card, { padding: ui.space(14), borderRadius: ui.radius, gap: ui.space(10) }]}>
        <View style={styles.sectionTitleRow}>
          <AppIcon name="cloud" size={ui.font(18)} />
          <Text style={[styles.cardTitle, { fontSize: ui.font(16), flexShrink: 1 }]}>
            CSV &amp; JSON Export
          </Text>
        </View>

        <Pressable
          style={[
            styles.primaryBtn,
            busy && styles.disabledBtn,
            {
              minHeight: ui.controlHeight,
              paddingHorizontal: ui.space(14),
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            },
          ]}
          disabled={busy}
          onPress={() =>
            void runAction(async () => {
              const snap = await backup.exportSnapshot();
              const out = await exportJsonMobile(snap);
              setStatusMessage(`Exported JSON snapshot (${out}).`);
            })
          }
        >
          <AppIcon name="cloud" size={ui.font(16)} />
          <Text style={[styles.primaryBtnText, { fontSize: ui.font(14), flexShrink: 1, textAlign: 'center' }]}>
            Export Full JSON Backup
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.secondaryBtn,
            busy && styles.disabledBtn,
            {
              minHeight: ui.controlHeight,
              paddingHorizontal: ui.space(14),
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            },
          ]}
          disabled={busy}
          onPress={() =>
            void runAction(async () => {
              const snap = await pickJsonSnapshotMobile();
              if (!snap) return;
              const counts = await backup.restoreSnapshot(snap);
              setStatusMessage(
                `Restored ${counts.livestockCount} animal(s), ${counts.productCount} yields, ${counts.medicalCount} medical, ${counts.financialCount} financial.`
              );
            })
          }
        >
          <AppIcon name="download" size={ui.font(16)} />
          <Text style={[styles.secondaryBtnText, { fontSize: ui.font(14), flexShrink: 1, textAlign: 'center' }]}>
            Restore from JSON File
          </Text>
        </Pressable>

        <View style={[styles.csvGrid, { gap: ui.space(8) }]}>
          {EXPORT_TABLES.map((tbl) => (
            <Pressable
              key={tbl.key}
              style={[
                styles.csvChip,
                busy && styles.disabledBtn,
                {
                  minHeight: ui.chipHeight,
                  minWidth: 118,
                  flexGrow: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                },
              ]}
              disabled={busy}
              onPress={() =>
                void runAction(async () => {
                  const snap = await backup.exportSnapshot();
                  const out = await exportCsvMobile(snap, tbl.key);
                  setStatusMessage(`Exported ${tbl.label} (${out}).`);
                })
              }
            >
              <Text style={[styles.csvChipText, { fontSize: ui.font(12), textAlign: 'center' }]}>
                {tbl.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[styles.card, { padding: ui.space(14), borderRadius: ui.radius }]}>
        <View style={styles.sectionTitleRow}>
          <AppIcon name="database" size={ui.font(18)} />
          <Text style={[styles.cardTitle, { fontSize: ui.font(16) }]}>
            SQLite Database File (.db)
          </Text>
        </View>

        <Pressable
          style={[
            styles.primaryBtn,
            busy && styles.disabledBtn,
            {
              minHeight: ui.controlHeight,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            },
          ]}
          disabled={busy}
          onPress={() =>
            void runAction(async () => {
              const bytes = await sqlController.serializeDatabaseBytes();
              const out = await exportSqliteBytesMobile(bytes);
              setStatusMessage(
                `Saved ${bytes.byteLength} bytes SQLite .db backup (${out}).`
              );
            })
          }
        >
          <AppIcon name="databaseCheck" size={ui.font(17)} />
          <Text style={[styles.primaryBtnText, { fontSize: ui.font(14) }]}>
            Save .db Backup File
          </Text>
        </Pressable>

        {Platform.OS !== 'web' ? (
          <Pressable
            style={[
              styles.dangerBtn,
              busy && styles.disabledBtn,
              {
                minHeight: ui.controlHeight,
                paddingHorizontal: ui.space(14),
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              },
            ]}
            disabled={busy}
            onPress={() =>
              void runAction(async () => {
                const bytes = await pickBinaryDbBackupMobile();
                if (!bytes) return;
                await sqlController.restoreDatabaseBytes(bytes);
                events.emit(['*']);
                setStatusMessage(
                  `Restored ${bytes.byteLength} bytes SQLite database and refreshed views.`
                );
              })
            }
          >
            <AppIcon name="download" size={ui.font(16)} />
            <Text
              style={[
                styles.dangerBtnText,
                { fontSize: ui.font(14), flexShrink: 1, textAlign: 'center' },
              ]}
            >
              Restore from .db File
            </Text>
          </Pressable>
        ) : (
          <Text style={[styles.webHint, { fontSize: ui.font(12) }]}>
            Native device build only.
          </Text>
        )}
      </View>
    </FarmScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 28 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statBox: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: '45%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 10,
    padding: 10,
  },
  statLabel: { fontSize: 11, fontFamily: FARMDB_FONTS.medium, color: '#5d675f' },
  statValue: { fontSize: 17, fontFamily: FARMDB_FONTS.bold, color: '#1c241e', marginTop: 2 },
  statusBanner: {
    backgroundColor: '#e6f2ec',
    borderRadius: 10,
    padding: 11,
  },
  statusText: { fontSize: 13, fontFamily: FARMDB_FONTS.semibold, color: '#173e2b' },
  errorBanner: {
    backgroundColor: '#fdeceb',
    borderRadius: 10,
    padding: 11,
  },
  errorText: { fontSize: 13, fontFamily: FARMDB_FONTS.semibold, color: '#b42318' },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 12,
    padding: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontFamily: FARMDB_FONTS.bold, color: '#1c241e' },
  cardSub: { fontSize: 12, fontFamily: FARMDB_FONTS.regular, color: '#5d675f', marginTop: 4, marginBottom: 12 },
  primaryBtn: {
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryBtnText: { color: '#ffffff', fontFamily: FARMDB_FONTS.bold, fontSize: 14, textAlign: 'center', flexShrink: 1 },
  secondaryBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryBtnText: { color: '#1c241e', fontFamily: FARMDB_FONTS.bold, fontSize: 13, textAlign: 'center', flexShrink: 1 },
  dangerBtn: {
    backgroundColor: FARMDB_COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: '#f4c7c3',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: 'center',
  },
  dangerBtnText: { color: FARMDB_COLORS.danger, fontFamily: FARMDB_FONTS.bold, fontSize: 13 },
  disabledBtn: { opacity: 0.6 },
  csvGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  csvChip: {
    backgroundColor: '#f5f3ee',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  csvChipText: { fontSize: 12, fontFamily: FARMDB_FONTS.semibold, color: '#1c241e' },
  webHint: { fontSize: 12, fontFamily: FARMDB_FONTS.regular, color: '#5d675f', marginTop: 4 },
});
