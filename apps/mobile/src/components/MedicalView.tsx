import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  formatCurrency,
  getTodayIsoDate,
  roundAmount,
  validateNewMedicalRecord,
  type NewMedicalRecordInput,
  type ValidationErrors,
} from '@farmdb/core';
import {
  MedicalValidationError,
  useCreateMedicalRecord,
  useDeleteMedicalRecord,
  useFarmSettings,
  useLivestockList,
  useMedicalRecordList,
} from '@farmdb/db';

export function MedicalView() {
  const livestockQuery = useLivestockList({});
  const settingsQuery = useFarmSettings();
  const [filterLivestockId, setFilterLivestockId] = useState('');
  const [search, setSearch] = useState('');

  const allMedicalQuery = useMedicalRecordList({});
  const filteredMedicalQuery = useMedicalRecordList({
    livestockId: filterLivestockId || undefined,
    search: search || undefined,
  });

  const createMutation = useCreateMedicalRecord();
  const deleteMutation = useDeleteMedicalRecord();

  const animals = livestockQuery.data ?? [];
  const animalsById = useMemo(
    () => new Map(animals.map((a) => [a.id, a])),
    [animals]
  );
  const currency = settingsQuery.data?.currencySymbol ?? '$';

  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [date, setDate] = useState(() => getTodayIsoDate());
  const [condition, setCondition] = useState('');
  const [treatment, setTreatment] = useState('');
  const [costText, setCostText] = useState('0');
  const [veterinarian, setVeterinarian] = useState('');
  const [autoRecordExpense, setAutoRecordExpense] = useState(true);
  const [errors, setErrors] = useState<ValidationErrors<NewMedicalRecordInput>>(
    {}
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAnimalId && animals[0]) {
      setSelectedAnimalId(animals[0].id);
    }
  }, [animals, selectedAnimalId]);

  const allRecords = allMedicalQuery.data ?? [];
  const visibleRecords = filteredMedicalQuery.data ?? [];
  const totalSpend = useMemo(
    () => roundAmount(allRecords.reduce((sum, r) => sum + r.cost, 0)),
    [allRecords]
  );

  async function handleSubmit() {
    setFeedback(null);
    const parsedCost = costText.trim() === '' ? 0 : Number(costText);
    const check = validateNewMedicalRecord({
      livestockId: selectedAnimalId,
      date,
      condition,
      treatment,
      cost: parsedCost,
      veterinarian,
    });

    if (!check.ok || !check.data) {
      setErrors(check.errors);
      return;
    }

    setErrors({});
    try {
      const result = await createMutation.mutateAsync({
        input: check.data,
        options: { autoRecordExpense },
      });
      setCondition('');
      setTreatment('');
      setCostText('0');
      setVeterinarian('');
      setFeedback(
        result.generatedExpenseLog
          ? `Saved record + ${formatCurrency(result.generatedExpenseLog.amount, currency)} expense.`
          : 'Saved medical record.'
      );
    } catch (err) {
      if (err instanceof MedicalValidationError) {
        setErrors(err.errors);
      } else {
        setFeedback(
          err instanceof Error ? err.message : 'Failed to save medical record.'
        );
      }
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Medical Entries</Text>
          <Text style={styles.statValue}>{allRecords.length}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Total Spend</Text>
          <Text style={styles.statValue}>
            {formatCurrency(totalSpend, currency)}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Log Medical Treatment</Text>
        {animals.length === 0 ? (
          <Text style={styles.mutedText}>
            Add at least one animal in Herd first.
          </Text>
        ) : (
          <>
            <Text style={styles.label}>Select Animal *</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {animals.map((a) => (
                <Pressable
                  key={a.id}
                  style={[
                    styles.chip,
                    selectedAnimalId === a.id && styles.chipActive,
                  ]}
                  onPress={() => setSelectedAnimalId(a.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedAnimalId === a.id && styles.chipTextActive,
                    ]}
                  >
                    {a.tagNumber}
                    {a.name ? ` · ${a.name}` : ''}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            {errors.livestockId ? (
              <Text style={styles.errorText}>{errors.livestockId}</Text>
            ) : null}

            <View style={styles.twoCol}>
              <View style={styles.col}>
                <Text style={styles.label}>Date *</Text>
                <TextInput
                  style={styles.input}
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                />
                {errors.date ? (
                  <Text style={styles.errorText}>{errors.date}</Text>
                ) : null}
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Cost ({currency})</Text>
                <TextInput
                  style={styles.input}
                  value={costText}
                  onChangeText={setCostText}
                  keyboardType="decimal-pad"
                />
                {errors.cost ? (
                  <Text style={styles.errorText}>{errors.cost}</Text>
                ) : null}
              </View>
            </View>

            <Text style={styles.label}>Condition / Checkup *</Text>
            <TextInput
              style={styles.input}
              value={condition}
              onChangeText={setCondition}
              placeholder="e.g. Vaccination, Mastitis"
            />
            {errors.condition ? (
              <Text style={styles.errorText}>{errors.condition}</Text>
            ) : null}

            <Text style={styles.label}>Treatment / Medication *</Text>
            <TextInput
              style={styles.input}
              value={treatment}
              onChangeText={setTreatment}
              placeholder="e.g. FMD Booster 2ml"
            />
            {errors.treatment ? (
              <Text style={styles.errorText}>{errors.treatment}</Text>
            ) : null}

            <Text style={styles.label}>Veterinarian (Optional)</Text>
            <TextInput
              style={styles.input}
              value={veterinarian}
              onChangeText={setVeterinarian}
              placeholder="e.g. Dr. Patel"
            />

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>
                  Auto-record Expense in Finance
                </Text>
                <Text style={styles.switchHint}>
                  Logs cost under Veterinary / Meds when &gt; 0
                </Text>
              </View>
              <Switch
                value={autoRecordExpense}
                onValueChange={setAutoRecordExpense}
                trackColor={{ false: '#ccc', true: '#2d6a4f' }}
              />
            </View>

            {feedback ? <Text style={styles.feedbackText}>{feedback}</Text> : null}

            <Pressable
              style={[
                styles.primaryBtn,
                createMutation.isPending && styles.disabledBtn,
              ]}
              onPress={() => void handleSubmit()}
              disabled={createMutation.isPending}
            >
              <Text style={styles.primaryBtnText}>
                {createMutation.isPending ? 'Saving...' : 'Save Medical Record'}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Medical Timeline ({visibleRecords.length})
        </Text>
        <TextInput
          style={[styles.input, { marginBottom: 10 }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search condition, treatment, or vet..."
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.chipRow, { marginBottom: 10 }]}
        >
          <Pressable
            style={[styles.chip, filterLivestockId === '' && styles.chipActive]}
            onPress={() => setFilterLivestockId('')}
          >
            <Text
              style={[
                styles.chipText,
                filterLivestockId === '' && styles.chipTextActive,
              ]}
            >
              All Animals
            </Text>
          </Pressable>
          {animals.map((a) => (
            <Pressable
              key={a.id}
              style={[
                styles.chip,
                filterLivestockId === a.id && styles.chipActive,
              ]}
              onPress={() => setFilterLivestockId(a.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  filterLivestockId === a.id && styles.chipTextActive,
                ]}
              >
                {a.tagNumber}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {visibleRecords.length === 0 ? (
          <Text style={styles.mutedText}>No medical records logged yet.</Text>
        ) : (
          visibleRecords.map((rec) => {
            const animal = animalsById.get(rec.livestockId);
            return (
              <View key={rec.id} style={styles.timelineRow}>
                <View style={styles.timelineDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineTitle}>
                    {animal?.tagNumber ?? 'UNKNOWN'} · {rec.condition}
                  </Text>
                  <Text style={styles.timelineTreatment}>{rec.treatment}</Text>
                  <Text style={styles.timelineMeta}>
                    {rec.date}
                    {rec.veterinarian ? ` · ${rec.veterinarian}` : ''} ·{' '}
                    {formatCurrency(rec.cost, currency)}
                  </Text>
                </View>
                <Pressable
                  style={styles.deleteBtn}
                  onPress={() => void deleteMutation.mutateAsync(rec.id)}
                >
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </Pressable>
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
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 10,
    padding: 10,
  },
  statLabel: { fontSize: 11, color: '#5d675f' },
  statValue: { fontSize: 17, fontWeight: '700', color: '#1c241e', marginTop: 2 },
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
  chipRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ddd6c8',
    backgroundColor: '#ffffff',
  },
  chipActive: { backgroundColor: '#2d6a4f', borderColor: '#2d6a4f' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#1c241e' },
  chipTextActive: { color: '#ffffff' },
  twoCol: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0ece3',
  },
  switchLabel: { fontSize: 13, fontWeight: '600', color: '#1c241e' },
  switchHint: { fontSize: 12, color: '#5d675f', marginTop: 2 },
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
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0ece3',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2d6a4f',
    marginTop: 5,
  },
  timelineTitle: { fontSize: 14, fontWeight: '700', color: '#1c241e' },
  timelineTreatment: { fontSize: 13, color: '#1c241e', marginTop: 2 },
  timelineMeta: { fontSize: 12, color: '#5d675f', marginTop: 2 },
  deleteBtn: {
    backgroundColor: '#fdeceb',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deleteBtnText: { fontSize: 12, fontWeight: '600', color: '#b42318' },
});
