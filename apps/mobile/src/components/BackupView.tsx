import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
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

interface BackupViewProps {
  sqlController: ExpoSqlController;
}

const EXPORT_TABLES: Array<{ key: ExportTableKey; label: string }> = [
  { key: 'livestock', label: 'Livestock CSV' },
  { key: 'product_records', label: 'Milk Yields CSV' },
  { key: 'medical_records', label: 'Medical CSV' },
  { key: 'financial_logs', label: 'Financial CSV' },
  { key: 'alerts', label: 'Alerts & Notes CSV' },
];

export function BackupView({ sqlController }: BackupViewProps) {
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Animals</Text>
          <Text style={styles.statValue}>{summary?.totalLivestock ?? 0}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Yields</Text>
          <Text style={styles.statValue}>{summary?.productRecordCount ?? 0}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Medical</Text>
          <Text style={styles.statValue}>{summary?.medicalRecordCount ?? 0}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Finance</Text>
          <Text style={styles.statValue}>{summary?.financialLogCount ?? 0}</Text>
        </View>
      </View>

      {statusMessage ? (
        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      ) : null}

      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Portable CSV &amp; JSON Export</Text>
        <Text style={styles.cardSub}>
          Export records to spreadsheets or restore a JSON snapshot across mobile and desktop.
        </Text>

        <Pressable
          style={[styles.primaryBtn, busy && styles.disabledBtn]}
          disabled={busy}
          onPress={() =>
            void runAction(async () => {
              const snap = await backup.exportSnapshot();
              const out = await exportJsonMobile(snap);
              setStatusMessage(`Exported JSON snapshot (${out}).`);
            })
          }
        >
          <Text style={styles.primaryBtnText}>Export Full JSON Backup</Text>
        </Pressable>

        <Pressable
          style={[styles.secondaryBtn, busy && styles.disabledBtn]}
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
          <Text style={styles.secondaryBtnText}>Restore from JSON File</Text>
        </Pressable>

        <View style={styles.csvGrid}>
          {EXPORT_TABLES.map((tbl) => (
            <Pressable
              key={tbl.key}
              style={[styles.csvChip, busy && styles.disabledBtn]}
              disabled={busy}
              onPress={() =>
                void runAction(async () => {
                  const snap = await backup.exportSnapshot();
                  const out = await exportCsvMobile(snap, tbl.key);
                  setStatusMessage(`Exported ${tbl.label} (${out}).`);
                })
              }
            >
              <Text style={styles.csvChipText}>{tbl.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>SQLite Database File (.db)</Text>
        <Text style={styles.cardSub}>
          Save or restore the raw SQLite file ({sqlController.getDatabasePath()}).
        </Text>

        <Pressable
          style={[styles.primaryBtn, busy && styles.disabledBtn]}
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
          <Text style={styles.primaryBtnText}>Save .db Backup File</Text>
        </Pressable>

        {Platform.OS !== 'web' ? (
          <Pressable
            style={[styles.dangerBtn, busy && styles.disabledBtn]}
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
            <Text style={styles.dangerBtnText}>Restore from .db File</Text>
          </Pressable>
        ) : (
          <Text style={styles.webHint}>
            Raw .db restore replaces the native SQLite file on iOS/Android; on web preview use JSON restore above.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 28 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statBox: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 10,
    padding: 10,
  },
  statLabel: { fontSize: 11, color: '#5d675f' },
  statValue: { fontSize: 17, fontWeight: '700', color: '#1c241e', marginTop: 2 },
  statusBanner: {
    backgroundColor: '#e6f2ec',
    borderRadius: 10,
    padding: 11,
  },
  statusText: { fontSize: 13, fontWeight: '600', color: '#173e2b' },
  errorBanner: {
    backgroundColor: '#fdeceb',
    borderRadius: 10,
    padding: 11,
  },
  errorText: { fontSize: 13, fontWeight: '600', color: '#b42318' },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 12,
    padding: 14,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1c241e' },
  cardSub: { fontSize: 12, color: '#5d675f', marginTop: 4, marginBottom: 12 },
  primaryBtn: {
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  secondaryBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryBtnText: { color: '#1c241e', fontWeight: '700', fontSize: 13 },
  dangerBtn: {
    backgroundColor: '#fdeceb',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  dangerBtnText: { color: '#b42318', fontWeight: '700', fontSize: 13 },
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
  csvChipText: { fontSize: 12, fontWeight: '600', color: '#1c241e' },
  webHint: { fontSize: 12, color: '#5d675f', marginTop: 4 },
});
