import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  filterAndSortRecordsByDate,
  formatCurrency,
  formatDisplayDate,
  getTodayIsoDate,
  RECORD_DATE_FILTER_OPTIONS,
  roundAmount,
  validateNewMedicalRecord,
  type DateSortDirection,
  type NewMedicalRecordInput,
  describeModuleAccessLevel,
  type RecordDateFilter,
  type ValidationErrors,
} from '@farmdb/core';
import {
  MedicalValidationError,
  useCreateMedicalRecord,
  useDeleteMedicalRecord,
  useLivestockList,
  useMedicalRecordList,
  useModulePermissions,
} from '@farmdb/db';
import {
  MOBILE_APP_ICONS,
} from '../assets/icons';
import {
  FARMDB_COLORS,
  FARMDB_FONTS,
  useUiScale,
} from '../theme/uiScale';
import { buildAnimalDropdownOption } from '../utils/animalOptions';
import { AnimalEyeButton } from './AnimalQuickPreviewModal';
import { AppIcon } from './FarmIcons';
import { FarmScrollView } from './FarmScrollView';
import { MobileNumberStepper } from './MobileNumberStepper';
import { ModernDatePicker } from './ModernDatePicker';
import {
  ModernDropdown,
  type ModernDropdownOption,
} from './ModernDropdown';

export function MedicalView() {
  const ui = useUiScale();
  const { settings } = ui;
  const { canEdit, canDelete, accessLevel } = useModulePermissions('medical');
  const iconMode = settings.mobileIconMode;

  const livestockQuery = useLivestockList({});
  const [filterLivestockId, setFilterLivestockId] = useState('');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<RecordDateFilter>('all');
  const [dateSort, setDateSort] = useState<DateSortDirection>('desc');

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
  const animalOptions = useMemo<ModernDropdownOption<string>[]>(
    () =>
      animals.map((a) =>
        buildAnimalDropdownOption(a, { dateFormat: settings.dateFormat })
      ),
    [animals, settings.dateFormat]
  );
  const filterAnimalOptions = useMemo<ModernDropdownOption<string>[]>(
    () => [
      {
        value: '',
        label: 'All Animals',
        iconSource: MOBILE_APP_ICONS.group,
      },
      ...animalOptions,
    ],
    [animalOptions]
  );
  const dateFilterOptions = useMemo<ModernDropdownOption<RecordDateFilter>[]>(
    () =>
      RECORD_DATE_FILTER_OPTIONS.map((opt) => ({
        value: opt.value,
        label: opt.shortLabel,
        hint: opt.label,
        iconSource: MOBILE_APP_ICONS.calendar,
      })),
    []
  );
  const dateSortOptions = useMemo<ModernDropdownOption<DateSortDirection>[]>(
    () => [
      { value: 'desc', label: 'Newest', iconSource: MOBILE_APP_ICONS.hourglass },
      { value: 'asc', label: 'Oldest', iconSource: MOBILE_APP_ICONS.hourglass },
    ],
    []
  );
  const currency = settings.currencySymbol;

  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [date, setDate] = useState(() => getTodayIsoDate());
  const [condition, setCondition] = useState('');
  const [treatment, setTreatment] = useState('');
  const [costText, setCostText] = useState('0');
  const [veterinarian, setVeterinarian] = useState('');
  const [autoRecordExpense, setAutoRecordExpense] = useState(
    settings.autoRecordMedicalExpenseByDefault
  );
  const initializedAutoRef = useRef(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors<NewMedicalRecordInput>>(
    {}
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAnimalId && animals[0]) {
      setSelectedAnimalId(animals[0].id);
    }
  }, [animals, selectedAnimalId]);

  useEffect(() => {
    if (!initializedAutoRef.current) {
      setAutoRecordExpense(settings.autoRecordMedicalExpenseByDefault);
      initializedAutoRef.current = true;
    }
  }, [settings.autoRecordMedicalExpenseByDefault]);

  const allRecords = allMedicalQuery.data ?? [];
  const visibleRecords = useMemo(
    () =>
      filterAndSortRecordsByDate(filteredMedicalQuery.data ?? [], {
        filter: dateFilter,
        sort: dateSort,
      }),
    [filteredMedicalQuery.data, dateFilter, dateSort]
  );
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
      setShowForm(false);
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

  async function handleDeleteRecord(id: string) {
    if (!canDelete) return;
    if (settings.confirmBeforeDelete && confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setConfirmDeleteId(null);
    await deleteMutation.mutateAsync(id);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.statsRow, { gap: ui.space(10), flexWrap: 'wrap' }]}>
          <View style={[styles.statBox, { padding: ui.space(10), borderRadius: Math.max(10, ui.radius - 2), minWidth: 132 }]}>
            <Text style={[styles.statLabel, { fontSize: ui.font(11) }]}>
              Medical Entries
            </Text>
            <Text style={[styles.statValue, { fontSize: ui.font(17) }]}>
              {allRecords.length}
            </Text>
          </View>
          <View style={[styles.statBox, { padding: ui.space(10), borderRadius: Math.max(10, ui.radius - 2), minWidth: 132 }]}>
            <Text style={[styles.statLabel, { fontSize: ui.font(11) }]}>
              Total Spend
            </Text>
            <Text style={[styles.statValue, { fontSize: ui.font(17) }]}>
              {formatCurrency(totalSpend, currency)}
            </Text>
          </View>
        </View>

        {canEdit ? (
          <Pressable
            style={[
              showForm ? styles.toggleCloseBtn : styles.toggleAddBtn,
              { minHeight: ui.controlHeight },
            ]}
            onPress={() => setShowForm((prev) => !prev)}
          >
            <AppIcon
              name={showForm ? 'close' : 'plus'}
              size={ui.font(17)}
              color={showForm ? FARMDB_COLORS.text : '#ffffff'}
            />
            <Text
              style={[
                showForm ? styles.toggleCloseBtnText : styles.toggleAddBtnText,
                { fontSize: ui.font(14) },
              ]}
            >
              {showForm ? 'Close Medical Form' : 'Log Medical Treatment'}
            </Text>
          </Pressable>
        ) : (
          <View
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: ui.space(10),
              paddingVertical: ui.space(6),
              borderRadius: 999,
              backgroundColor: '#f3efe4',
              borderWidth: 1,
              borderColor: FARMDB_COLORS.border,
            }}
          >
            <Text style={{ fontFamily: FARMDB_FONTS.bold, fontSize: ui.font(11), color: FARMDB_COLORS.textMuted }}>
              {describeModuleAccessLevel(accessLevel)}
            </Text>
          </View>
        )}

        {feedback && !showForm ? (
          <View style={[styles.feedbackBanner, { padding: ui.space(10), borderRadius: ui.radius }]}>
            <Text style={[styles.feedbackText, { marginTop: 0, fontSize: ui.font(13) }]}>
              {feedback}
            </Text>
          </View>
        ) : null}

        {showForm ? (
        <View style={[styles.card, { padding: ui.space(14), borderRadius: ui.radius }]}>
          <View style={styles.sectionTitleRow}>
            <AppIcon name="medical" size={ui.font(18)} />
            <Text style={[styles.cardTitle, { fontSize: ui.font(16), marginBottom: 0 }]}>
              Log Medical Treatment
            </Text>
          </View>
          {animals.length === 0 ? (
            <Text style={[styles.mutedText, { fontSize: ui.font(13) }]}>
              Add at least one animal in Herd first.
            </Text>
          ) : (
            <>
              <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                Select Animal *
              </Text>
              <ModernDropdown
                value={selectedAnimalId}
                options={animalOptions}
                title="Select Animal for Treatment"
                placeholder="Choose animal..."
                searchable={animals.length > 5}
                accessibilityLabel="Select Animal"
                onChange={setSelectedAnimalId}
              />
              {errors.livestockId ? (
                <Text style={[styles.errorText, { fontSize: ui.font(12) }]}>
                  {errors.livestockId}
                </Text>
              ) : null}

              <View style={[styles.twoCol, { flexDirection: ui.isCramped ? 'column' : 'row', gap: ui.space(10) }]}>
                <View style={styles.col}>
                  <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                    Date *
                  </Text>
                  <ModernDatePicker
                    title="Treatment Date"
                    accessibilityLabel="Treatment Date"
                    value={date}
                    onChange={setDate}
                  />
                  {errors.date ? (
                    <Text style={[styles.errorText, { fontSize: ui.font(12) }]}>
                      {errors.date}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.col}>
                  <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                    Cost ({currency})
                  </Text>
                  <MobileNumberStepper
                    accessibilityLabel="Treatment Cost"
                    min={0}
                    step={currency === 'UGX' ? 500 : 1}
                    decimals={currency === 'UGX' ? 0 : 2}
                    value={costText}
                    onChangeText={setCostText}
                  />
                  {errors.cost ? (
                    <Text style={[styles.errorText, { fontSize: ui.font(12) }]}>
                      {errors.cost}
                    </Text>
                  ) : null}
                </View>
              </View>

              <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                Condition / Checkup *
              </Text>
              <TextInput
                style={[styles.input, { minHeight: ui.controlHeight, fontSize: ui.font(14) }]}
                value={condition}
                onChangeText={setCondition}
                placeholder="e.g. Vaccination, Mastitis"
              />
              {errors.condition ? (
                <Text style={[styles.errorText, { fontSize: ui.font(12) }]}>
                  {errors.condition}
                </Text>
              ) : null}

              <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                Treatment / Medication *
              </Text>
              <TextInput
                style={[styles.input, { minHeight: ui.controlHeight, fontSize: ui.font(14) }]}
                value={treatment}
                onChangeText={setTreatment}
                placeholder="e.g. FMD Booster 2ml"
              />
              {errors.treatment ? (
                <Text style={[styles.errorText, { fontSize: ui.font(12) }]}>
                  {errors.treatment}
                </Text>
              ) : null}

              <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                Veterinarian (Optional)
              </Text>
              <TextInput
                style={[styles.input, { minHeight: ui.controlHeight, fontSize: ui.font(14) }]}
                value={veterinarian}
                onChangeText={setVeterinarian}
                placeholder="e.g. Dr. Patel"
              />

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.switchLabel, { fontSize: ui.font(13) }]}>
                    Auto-record Expense
                  </Text>
                </View>
                <Switch
                  value={autoRecordExpense}
                  onValueChange={setAutoRecordExpense}
                  trackColor={{
                    false: FARMDB_COLORS.border,
                    true: FARMDB_COLORS.accent,
                  }}
                />
              </View>

              {feedback ? (
                <Text style={[styles.feedbackText, { fontSize: ui.font(13) }]}>
                  {feedback}
                </Text>
              ) : null}

              <Pressable
                style={[
                  styles.primaryBtn,
                  createMutation.isPending && styles.disabledBtn,
                  { minHeight: ui.controlHeight, justifyContent: 'center' },
                ]}
                onPress={() => void handleSubmit()}
                disabled={createMutation.isPending}
              >
                <Text style={[styles.primaryBtnText, { fontSize: ui.font(14) }]}>
                  {createMutation.isPending ? 'Saving...' : 'Save Medical Record'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
        ) : null}

        <View style={[styles.card, { padding: ui.space(14), borderRadius: ui.radius }]}>
          <Text style={[styles.cardTitle, { fontSize: ui.font(16) }]}>
            Medical Timeline ({visibleRecords.length})
          </Text>
          <View
            style={[
              styles.searchWrap,
              {
                marginBottom: 10,
                minHeight: ui.controlHeight,
                paddingHorizontal: ui.space(11),
              },
            ]}
          >
            <AppIcon
              name="search"
              size={ui.font(15)}
              color={FARMDB_COLORS.textMuted}
            />
            <TextInput
              style={[styles.searchInputInner, { fontSize: ui.font(14) }]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search condition, treatment, or vet..."
              placeholderTextColor={FARMDB_COLORS.textMuted}
            />
            {search.length > 0 ? (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <AppIcon
                  name="close"
                  size={ui.font(15)}
                  color={FARMDB_COLORS.textMuted}
                />
              </Pressable>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', gap: ui.space(8), marginBottom: ui.space(10), flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: ui.isCramped ? 148 : 136 }}>
              <ModernDropdown
                compact
                value={filterLivestockId}
                options={filterAnimalOptions}
                title="Filter by Animal"
                searchable={animals.length > 5}
                accessibilityLabel="Filter by animal"
                onChange={setFilterLivestockId}
              />
            </View>
            <View style={{ minWidth: ui.isCramped ? 124 : 96, flex: 1 }}>
              <ModernDropdown
                compact
                value={dateFilter}
                options={dateFilterOptions}
                title="Timeframe"
                accessibilityLabel="Filter by timeframe"
                onChange={setDateFilter}
              />
            </View>
            <View style={{ minWidth: ui.isCramped ? 116 : 92, flex: 1 }}>
              <ModernDropdown
                compact
                value={dateSort}
                options={dateSortOptions}
                title="Sort Order"
                accessibilityLabel="Sort medical logs by date"
                onChange={setDateSort}
              />
            </View>
          </View>

          {visibleRecords.length === 0 ? (
            <Text style={[styles.mutedText, { fontSize: ui.font(13) }]}>
              No medical records logged yet.
            </Text>
          ) : (
            visibleRecords.map((rec) => {
              const animal = animalsById.get(rec.livestockId);
              return (
                <View key={rec.id} style={[styles.timelineRow, { paddingVertical: ui.space(10), flexWrap: 'wrap' }]}>
                  <View style={styles.timelineDot} />
                  <View style={{ flex: 1, minWidth: 168 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={[styles.timelineTitle, { fontSize: ui.font(14), flexShrink: 1 }]}>
                        {animal?.tagNumber ?? 'UNKNOWN'} · {rec.condition}
                      </Text>
                      <AnimalEyeButton livestockId={rec.livestockId} />
                    </View>
                    <Text style={[styles.timelineTreatment, { fontSize: ui.font(13) }]}>
                      {rec.treatment}
                    </Text>
                    <Text style={[styles.timelineMeta, { fontSize: ui.font(12) }]}>
                      {formatDisplayDate(rec.date, settings.dateFormat)}
                      {rec.veterinarian ? ` · ${rec.veterinarian}` : ''} ·{' '}
                      {formatCurrency(rec.cost, currency)}
                    </Text>
                  </View>
                  {canDelete ? (
                    confirmDeleteId === rec.id ? (
                      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                        <Pressable
                          accessibilityLabel="Confirm delete"
                          style={[
                            styles.deleteBtn,
                            {
                              minHeight: ui.chipHeight - 2,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 4,
                            },
                          ]}
                          onPress={() => void handleDeleteRecord(rec.id)}
                        >
                          <AppIcon
                            name="check"
                            size={ui.font(14)}
                            color={FARMDB_COLORS.danger}
                          />
                          {!iconMode ? (
                            <Text style={[styles.deleteBtnText, { fontSize: ui.font(11) }]}>
                              Confirm
                            </Text>
                          ) : null}
                        </Pressable>
                        <Pressable
                          accessibilityLabel="Keep record"
                          style={[
                            styles.keepBtn,
                            {
                              minHeight: ui.chipHeight - 2,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 4,
                            },
                          ]}
                          onPress={() => setConfirmDeleteId(null)}
                        >
                          <AppIcon
                            name="close"
                            size={ui.font(14)}
                            color={FARMDB_COLORS.text}
                          />
                          {!iconMode ? (
                            <Text style={[styles.keepBtnText, { fontSize: ui.font(11) }]}>
                              Keep
                            </Text>
                          ) : null}
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        accessibilityLabel="Delete medical record"
                        style={[
                          styles.deleteBtn,
                          {
                            minHeight: ui.chipHeight - 2,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                          },
                        ]}
                        onPress={() => void handleDeleteRecord(rec.id)}
                      >
                        <AppIcon
                          name="trash"
                          size={ui.font(14)}
                          color={FARMDB_COLORS.danger}
                        />
                        {!iconMode ? (
                          <Text style={[styles.deleteBtnText, { fontSize: ui.font(11) }]}>
                            Delete
                          </Text>
                        ) : null}
                      </Pressable>
                    )
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </FarmScrollView>
    </KeyboardAvoidingView>
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
  statLabel: { fontSize: 11, fontFamily: FARMDB_FONTS.medium, color: '#5d675f' },
  statValue: { fontSize: 17, fontFamily: FARMDB_FONTS.bold, color: '#1c241e', marginTop: 2 },
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
    marginBottom: 6,
  },
  cardTitle: { fontSize: 16, fontFamily: FARMDB_FONTS.bold, color: '#1c241e', marginBottom: 10 },
  label: { fontSize: 12, fontFamily: FARMDB_FONTS.semibold, color: '#1c241e', marginTop: 10, marginBottom: 5 },
  input: {
    backgroundColor: '#faf8f4',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 14,
    fontFamily: FARMDB_FONTS.regular,
    color: '#1c241e',
  },
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
  switchLabel: { fontSize: 13, fontFamily: FARMDB_FONTS.semibold, color: '#1c241e' },
  switchHint: { fontSize: 12, fontFamily: FARMDB_FONTS.regular, color: '#5d675f', marginTop: 2 },
  errorText: { fontSize: 12, fontFamily: FARMDB_FONTS.medium, color: '#b42318', marginTop: 4 },
  feedbackText: { fontSize: 13, color: '#1b6b3a', fontFamily: FARMDB_FONTS.semibold, marginTop: 10 },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  disabledBtn: { opacity: 0.6 },
  primaryBtnText: { color: '#ffffff', fontFamily: FARMDB_FONTS.bold, fontSize: 14 },
  toggleAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: FARMDB_COLORS.accent,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  toggleAddBtnText: { color: '#ffffff', fontFamily: FARMDB_FONTS.bold },
  toggleCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  toggleCloseBtnText: { color: FARMDB_COLORS.text, fontFamily: FARMDB_FONTS.bold },
  feedbackBanner: {
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1,
    borderColor: '#cce3d6',
  },
  mutedText: { fontSize: 13, fontFamily: FARMDB_FONTS.regular, color: '#5d675f' },
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
  timelineTitle: { fontSize: 14, fontFamily: FARMDB_FONTS.bold, color: '#1c241e' },
  timelineTreatment: { fontSize: 13, fontFamily: FARMDB_FONTS.regular, color: '#1c241e', marginTop: 2 },
  timelineMeta: { fontSize: 12, fontFamily: FARMDB_FONTS.regular, color: '#5d675f', marginTop: 2 },
  deleteBtn: {
    backgroundColor: '#fdeceb',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deleteBtnText: { fontSize: 12, fontFamily: FARMDB_FONTS.semibold, color: '#b42318' },
  keepBtn: {
    backgroundColor: '#f0ece3',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  keepBtnText: { fontSize: 12, fontFamily: FARMDB_FONTS.semibold, color: '#1c241e' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#faf8f4',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 10,
  },
  searchInputInner: {
    flex: 1,
    fontFamily: FARMDB_FONTS.regular,
    color: '#1c241e',
    paddingVertical: 8,
  },
});
