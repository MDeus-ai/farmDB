import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  getAlertUrgency,
  getTodayIsoDate,
  validateNewAlert,
  type AlertEntryKind,
  type NewAlertInput,
  type ValidationErrors,
} from '@farmdb/core';
import {
  AlertValidationError,
  useAlertList,
  useCreateAlert,
  useDeleteAlert,
  useLivestockList,
  useToggleAlertResolved,
} from '@farmdb/db';

interface AlertsViewProps {
  onCheckDueNow: () => Promise<number>;
}

export function AlertsView({ onCheckDueNow }: AlertsViewProps) {
  const livestockQuery = useLivestockList({});
  const allAlertsQuery = useAlertList({});

  const [kindFilter, setKindFilter] = useState<AlertEntryKind | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'open' | 'resolved' | 'all'>(
    'open'
  );
  const [search, setSearch] = useState('');

  const filteredAlertsQuery = useAlertList({
    entryKind: kindFilter,
    status: statusFilter,
    search: search || undefined,
  });

  const createMutation = useCreateAlert();
  const toggleMutation = useToggleAlertResolved();
  const deleteMutation = useDeleteAlert();

  const animals = livestockQuery.data ?? [];
  const animalsById = useMemo(
    () => new Map(animals.map((a) => [a.id, a])),
    [animals]
  );

  const [entryKind, setEntryKind] = useState<AlertEntryKind>('alert');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [livestockId, setLivestockId] = useState('');
  const [triggerDate, setTriggerDate] = useState(() => getTodayIsoDate());
  const [errors, setErrors] = useState<ValidationErrors<NewAlertInput>>({});
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const todayIso = getTodayIsoDate();
  const allItems = allAlertsQuery.data ?? [];
  const visibleItems = filteredAlertsQuery.data ?? [];

  const dueCount = useMemo(
    () =>
      allItems.filter(
        (a) => a.entryKind === 'alert' && !a.isResolved && a.triggerDate <= todayIso
      ).length,
    [allItems, todayIso]
  );

  async function handleSubmit() {
    setStatusMsg(null);
    const check = validateNewAlert({
      entryKind,
      title,
      description,
      livestockId: livestockId || null,
      triggerDate: entryKind === 'note' ? getTodayIsoDate() : triggerDate,
    });

    if (!check.ok || !check.data) {
      setErrors(check.errors);
      return;
    }

    setErrors({});
    try {
      const created = await createMutation.mutateAsync(check.data);
      setTitle('');
      setDescription('');
      setStatusMsg(
        created.entryKind === 'alert'
          ? `Alert scheduled for ${created.triggerDate}.`
          : 'Note saved.'
      );
      if (created.entryKind === 'alert' && created.triggerDate <= todayIso) {
        await onCheckDueNow();
      }
    } catch (err) {
      if (err instanceof AlertValidationError) {
        setErrors(err.errors);
      } else {
        setStatusMsg(
          err instanceof Error ? err.message : 'Failed to save entry.'
        );
      }
    }
  }

  async function handleCheckNow() {
    setChecking(true);
    setStatusMsg(null);
    try {
      const count = await onCheckDueNow();
      setStatusMsg(
        count > 0
          ? `Triggered ${count} due alert notification(s).`
          : 'No unnotified due alerts.'
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Due / Overdue</Text>
          <Text
            style={[
              styles.statValue,
              { color: dueCount > 0 ? '#b42318' : '#1c241e' },
            ]}
          >
            {dueCount}
          </Text>
        </View>
        <Pressable
          style={styles.checkBtn}
          onPress={() => void handleCheckNow()}
          disabled={checking}
        >
          <Text style={styles.checkBtnText}>
            {checking ? 'Checking...' : 'Check Due Alerts'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>New Alert or Note</Text>

        <View style={styles.chipRow}>
          {(['alert', 'note'] as const).map((kind) => (
            <Pressable
              key={kind}
              style={[styles.chip, entryKind === kind && styles.chipActive]}
              onPress={() => setEntryKind(kind)}
            >
              <Text
                style={[
                  styles.chipText,
                  entryKind === kind && styles.chipTextActive,
                ]}
              >
                {kind === 'alert' ? 'Scheduled Alert' : 'Farm / Animal Note'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder={
            entryKind === 'alert'
              ? 'e.g. Cow #402 is due for vaccination'
              : 'e.g. Check water trough valve'
          }
        />
        {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}

        {entryKind === 'alert' ? (
          <>
            <Text style={styles.label}>Trigger Date (YYYY-MM-DD) *</Text>
            <TextInput
              style={styles.input}
              value={triggerDate}
              onChangeText={setTriggerDate}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
            {errors.triggerDate ? (
              <Text style={styles.errorText}>{errors.triggerDate}</Text>
            ) : null}
          </>
        ) : null}

        <Text style={styles.label}>Linked Animal (Optional)</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Pressable
            style={[styles.chip, livestockId === '' && styles.chipActive]}
            onPress={() => setLivestockId('')}
          >
            <Text
              style={[
                styles.chipText,
                livestockId === '' && styles.chipTextActive,
              ]}
            >
              General Farm
            </Text>
          </Pressable>
          {animals.map((a) => (
            <Pressable
              key={a.id}
              style={[styles.chip, livestockId === a.id && styles.chipActive]}
              onPress={() => setLivestockId(a.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  livestockId === a.id && styles.chipTextActive,
                ]}
              >
                {a.tagNumber}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>Details</Text>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder="Optional details..."
        />

        {statusMsg ? <Text style={styles.feedbackText}>{statusMsg}</Text> : null}

        <Pressable
          style={[
            styles.primaryBtn,
            createMutation.isPending && styles.disabledBtn,
          ]}
          onPress={() => void handleSubmit()}
          disabled={createMutation.isPending}
        >
          <Text style={styles.primaryBtnText}>
            {createMutation.isPending
              ? 'Saving...'
              : entryKind === 'alert'
                ? 'Schedule Alert'
                : 'Save Note'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Alerts &amp; Notes ({visibleItems.length})
        </Text>
        <TextInput
          style={[styles.input, { marginBottom: 10 }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search titles or details..."
        />

        <View style={[styles.chipRow, { marginBottom: 8 }]}>
          {(['all', 'alert', 'note'] as const).map((k) => (
            <Pressable
              key={`k-${k}`}
              style={[styles.chip, kindFilter === k && styles.chipDark]}
              onPress={() => setKindFilter(k)}
            >
              <Text
                style={[
                  styles.chipText,
                  kindFilter === k && styles.chipTextActive,
                ]}
              >
                {k === 'all' ? 'All' : k === 'alert' ? 'Alerts' : 'Notes'}
              </Text>
            </Pressable>
          ))}
          {(['open', 'resolved', 'all'] as const).map((st) => (
            <Pressable
              key={`s-${st}`}
              style={[styles.chip, statusFilter === st && styles.chipActive]}
              onPress={() => setStatusFilter(st)}
            >
              <Text
                style={[
                  styles.chipText,
                  statusFilter === st && styles.chipTextActive,
                ]}
              >
                {st === 'open' ? 'Open' : st === 'resolved' ? 'Resolved' : 'All'}
              </Text>
            </Pressable>
          ))}
        </View>

        {visibleItems.length === 0 ? (
          <Text style={styles.mutedText}>No matching alerts or notes.</Text>
        ) : (
          visibleItems.map((item) => {
            const animal = item.livestockId
              ? animalsById.get(item.livestockId)
              : null;
            const urgency = getAlertUrgency(item, todayIso);
            return (
              <View key={item.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>
                    [{urgency.replace('_', ' ').toUpperCase()}]{' '}
                    {animal ? `${animal.tagNumber} · ` : ''}
                    {item.title}
                  </Text>
                  {item.description ? (
                    <Text style={styles.itemDesc}>{item.description}</Text>
                  ) : null}
                  <Text style={styles.itemMeta}>
                    {item.entryKind === 'alert'
                      ? `Trigger: ${item.triggerDate}${item.notifiedAt ? ' · Notified' : ''}`
                      : `Logged: ${item.triggerDate}`}
                  </Text>
                </View>

                <View style={styles.itemBtns}>
                  <Pressable
                    style={styles.resolveBtn}
                    onPress={() =>
                      void toggleMutation.mutateAsync({
                        id: item.id,
                        isResolved: !item.isResolved,
                      })
                    }
                  >
                    <Text style={styles.resolveBtnText}>
                      {item.isResolved ? 'Reopen' : 'Done'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.deleteBtn}
                    onPress={() => void deleteMutation.mutateAsync(item.id)}
                  >
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 28 },
  topRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  statBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 10,
    padding: 10,
  },
  statLabel: { fontSize: 11, color: '#5d675f' },
  statValue: { fontSize: 17, fontWeight: '700', marginTop: 2 },
  checkBtn: {
    backgroundColor: '#17271d',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  checkBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 12,
    padding: 14,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1c241e', marginBottom: 10 },
  label: { fontSize: 12, fontWeight: '600', color: '#1c241e', marginTop: 10, marginBottom: 5 },
  input: {
    backgroundColor: '#faf8f4',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 14,
    color: '#1c241e',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ddd6c8',
    backgroundColor: '#ffffff',
  },
  chipActive: { backgroundColor: '#2d6a4f', borderColor: '#2d6a4f' },
  chipDark: { backgroundColor: '#17271d', borderColor: '#17271d' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#1c241e' },
  chipTextActive: { color: '#ffffff' },
  errorText: { fontSize: 12, color: '#b42318', marginTop: 4 },
  feedbackText: { fontSize: 13, color: '#1b6b3a', fontWeight: '600', marginTop: 10 },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  disabledBtn: { opacity: 0.6 },
  primaryBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  mutedText: { fontSize: 13, color: '#5d675f' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0ece3',
  },
  itemTitle: { fontSize: 14, fontWeight: '700', color: '#1c241e' },
  itemDesc: { fontSize: 13, color: '#5d675f', marginTop: 2 },
  itemMeta: { fontSize: 11, color: '#5d675f', marginTop: 3 },
  itemBtns: { gap: 6 },
  resolveBtn: {
    backgroundColor: '#e6f2ec',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  resolveBtnText: { fontSize: 12, fontWeight: '700', color: '#2d6a4f' },
  deleteBtn: {
    backgroundColor: '#fdeceb',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteBtnText: { fontSize: 12, fontWeight: '600', color: '#b42318' },
});
