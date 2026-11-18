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
import { LineChart } from 'react-native-chart-kit';
import {
  buildTopProducers,
  buildYieldSeriesForTimeframe,
  convertDisplayVolumeToLiters,
  convertLitersToDisplayVolume,
  filterAndSortRecordsByDate,
  formatCompactAxisNumber,
  formatCurrency,
  formatDisplayDate,
  formatVolume,
  getTodayIsoDate,
  getVolumeUnitShortLabel,
  isFemaleMilkProducingAnimal,
  RECORD_DATE_FILTER_OPTIONS,
  roundAmount,
  validateNewProductRecord,
  type DateSortDirection,
  type NewProductRecordInput,
  type RecordDateFilter,
  describeModuleAccessLevel,
  type StatisticsTimeframe,
  type ValidationErrors,
} from '@farmdb/core';
import {
  ProductionValidationError,
  useCreateProductRecord,
  useDeleteProductRecord,
  useLivestockList,
  useModulePermissions,
  useProductRecordList,
} from '@farmdb/db';
import { MOBILE_APP_ICONS } from '../assets/icons';
import {
  FARMDB_COLORS,
  FARMDB_FONTS,
  useUiScale,
} from '../theme/uiScale';
import { buildAnimalDropdownOption } from '../utils/animalOptions';
import { computeMobileYAxisGutter } from '../utils/chartAxis';
import { AnimalEyeButton } from './AnimalQuickPreviewModal';
import { AppIcon } from './FarmIcons';
import { FarmScrollView } from './FarmScrollView';
import { MobileNumberStepper } from './MobileNumberStepper';
import { ModernDatePicker } from './ModernDatePicker';
import {
  ModernDropdown,
  type ModernDropdownOption,
} from './ModernDropdown';

export function ProductionView() {
  const ui = useUiScale();
  const { settings } = ui;
  const { canEdit, canDelete, accessLevel } = useModulePermissions('production');
  const iconMode = settings.mobileIconMode;

  const livestockQuery = useLivestockList({});
  const productionQuery = useProductRecordList({});
  const createMutation = useCreateProductRecord();
  const deleteMutation = useDeleteProductRecord();

  const animals = livestockQuery.data ?? [];
  const activeAnimals = useMemo(
    () =>
      animals.filter(
        (a) => a.status === 'active' && isFemaleMilkProducingAnimal(a)
      ),
    [animals]
  );
  const animalsById = useMemo(
    () => new Map(animals.map((a) => [a.id, a])),
    [animals]
  );
  const animalOptions = useMemo<ModernDropdownOption<string>[]>(
    () =>
      activeAnimals.map((a) =>
        buildAnimalDropdownOption(a, { dateFormat: settings.dateFormat })
      ),
    [activeAnimals, settings.dateFormat]
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
  const defaultRate = settings.defaultMilkRatePerLiter;
  const volumeUnit = settings.volumeUnit;
  const volumeShort = getVolumeUnitShortLabel(volumeUnit);

  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [chartWindow, setChartWindow] = useState<
    Extract<StatisticsTimeframe, '7d' | 'weeks' | 'months' | 'years'>
  >('7d');
  const [dateFilter, setDateFilter] = useState<RecordDateFilter>('all');
  const [dateSort, setDateSort] = useState<DateSortDirection>('desc');
  const [date, setDate] = useState(() => getTodayIsoDate());
  const [yieldText, setYieldText] = useState('');
  const [qualityNotes, setQualityNotes] = useState('');
  const [autoRecordSale, setAutoRecordSale] = useState(
    settings.autoRecordMilkSaleByDefault
  );
  const initializedAutoRef = useRef(false);
  const [rateText, setRateText] = useState(defaultRate.toFixed(2));
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors<NewProductRecordInput>>(
    {}
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (
      activeAnimals.length > 0 &&
      (!selectedAnimalId || !activeAnimals.some((a) => a.id === selectedAnimalId))
    ) {
      setSelectedAnimalId(activeAnimals[0]!.id);
    } else if (activeAnimals.length === 0 && selectedAnimalId !== '') {
      setSelectedAnimalId('');
    }
  }, [activeAnimals, selectedAnimalId]);

  useEffect(() => {
    setRateText(settings.defaultMilkRatePerLiter.toFixed(2));
    if (!initializedAutoRef.current) {
      setAutoRecordSale(settings.autoRecordMilkSaleByDefault);
      initializedAutoRef.current = true;
    }
  }, [settings.defaultMilkRatePerLiter, settings.autoRecordMilkSaleByDefault]);

  const records = productionQuery.data ?? [];
  const displayedRecords = useMemo(
    () =>
      filterAndSortRecordsByDate(records, {
        filter: dateFilter,
        sort: dateSort,
      }),
    [records, dateFilter, dateSort]
  );
  const sevenDaySeries = useMemo(
    () => buildYieldSeriesForTimeframe(records, '7d'),
    [records]
  );
  const dailySeries = useMemo(
    () => buildYieldSeriesForTimeframe(records, chartWindow),
    [records, chartWindow]
  );
  const topProducers = useMemo(
    () => buildTopProducers(records, animalsById),
    [records, animalsById]
  );

  const todayIso = getTodayIsoDate();
  const todayTotal = useMemo(
    () =>
      roundAmount(
        records
          .filter((r) => r.date === todayIso)
          .reduce((sum, r) => sum + r.yieldAmount, 0)
      ),
    [records, todayIso]
  );
  const sevenDayTotal = useMemo(
    () => roundAmount(sevenDaySeries.reduce((sum, d) => sum + d.totalLiters, 0)),
    [sevenDaySeries]
  );

  const parsedYield = Number(yieldText);
  const normalizedLiters =
    Number.isFinite(parsedYield) && parsedYield > 0
      ? convertDisplayVolumeToLiters(parsedYield, volumeUnit)
      : NaN;
  const parsedRate = Number(rateText);
  const estimatedSale =
    autoRecordSale &&
      Number.isFinite(normalizedLiters) &&
      normalizedLiters > 0 &&
      Number.isFinite(parsedRate) &&
      parsedRate > 0
      ? roundAmount(normalizedLiters * parsedRate)
      : 0;

  async function handleSubmit() {
    setFeedback(null);
    const check = validateNewProductRecord(
      {
        livestockId: selectedAnimalId,
        date,
        yieldAmount: normalizedLiters,
        qualityNotes,
      },
      { animal: animalsById.get(selectedAnimalId) }
    );

    if (!check.ok || !check.data) {
      setErrors(check.errors);
      return;
    }

    setErrors({});
    try {
      const result = await createMutation.mutateAsync({
        input: check.data,
        options: {
          autoRecordSale,
          ratePerLiter:
            Number.isFinite(parsedRate) && parsedRate >= 0
              ? parsedRate
              : defaultRate,
        },
      });
      setYieldText('');
      setQualityNotes('');
      setShowForm(false);
      setFeedback(
        result.generatedIncomeLog
          ? `Saved ${formatVolume(result.record.yieldAmount, volumeUnit)} + ${formatCurrency(result.generatedIncomeLog.amount, currency)} milk sale.`
          : `Saved ${formatVolume(result.record.yieldAmount, volumeUnit)} milk yield.`
      );
    } catch (err) {
      if (err instanceof ProductionValidationError) {
        setErrors(err.errors);
      } else {
        setFeedback(
          err instanceof Error ? err.message : 'Failed to log milk yield.'
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
        <View style={[styles.statsRow, { gap: ui.space(8), flexWrap: 'wrap' }]}>
          <View
            style={[
              styles.statBox,
              {
                padding: ui.space(10),
                borderRadius: Math.max(10, ui.radius - 2),
                flexBasis: ui.isCramped ? '45%' : undefined,
                minWidth: 100,
              },
            ]}
          >
            <Text style={[styles.statLabel, { fontSize: ui.font(11) }]}>Today</Text>
            <Text style={[styles.statValue, { fontSize: ui.font(16) }]}>
              {formatVolume(todayTotal, volumeUnit)}
            </Text>
          </View>
          <View
            style={[
              styles.statBox,
              {
                padding: ui.space(10),
                borderRadius: Math.max(10, ui.radius - 2),
                flexBasis: ui.isCramped ? '45%' : undefined,
                minWidth: 100,
              },
            ]}
          >
            <Text style={[styles.statLabel, { fontSize: ui.font(11) }]}>7-Day Total</Text>
            <Text style={[styles.statValue, { fontSize: ui.font(16) }]}>
              {formatVolume(sevenDayTotal, volumeUnit)}
            </Text>
          </View>
          <View
            style={[
              styles.statBox,
              {
                padding: ui.space(10),
                borderRadius: Math.max(10, ui.radius - 2),
                flexBasis: ui.isCramped ? '100%' : undefined,
                minWidth: 120,
              },
            ]}
          >
            <Text style={[styles.statLabel, { fontSize: ui.font(11) }]}>Top Producer</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={[styles.statValue, { fontSize: ui.font(15), flexShrink: 1 }]}>
                {topProducers[0] ? topProducers[0].tagNumber : '—'}
              </Text>
              <AnimalEyeButton livestockId={topProducers[0]?.livestockId} />
            </View>
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
              {showForm ? 'Close Yield Form' : 'Log Daily Milk Yield'}
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
          <View style={[styles.card, { padding: ui.space(14), borderRadius: ui.radius, gap: ui.space(8) }]}>
            <View style={styles.sectionTitleRow}>
              <AppIcon
                name={volumeUnit === 'liters' ? 'liter' : 'gallon'}
                size={ui.font(18)}
              />
              <Text style={[styles.cardTitle, { fontSize: ui.font(16), marginBottom: 0 }]}>
                Log Daily Milk Yield
              </Text>
            </View>
            {activeAnimals.length === 0 ? (
              <Text style={[styles.mutedText, { fontSize: ui.font(13) }]}>
                Add at least one active female milk-producing animal (Cow, Goat, or Sheep) in Herd before logging milk yields.
              </Text>
            ) : (
              <>
                <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                  Select Animal *
                </Text>
                <ModernDropdown
                  value={selectedAnimalId}
                  options={animalOptions}
                  title="Select Producing Animal"
                  placeholder="Choose animal..."
                  searchable={activeAnimals.length > 5}
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
                      title="Milking Date"
                      accessibilityLabel="Milking Date"
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
                      Yield ({volumeShort}) *
                    </Text>
                    <MobileNumberStepper
                      accessibilityLabel={`Yield in ${volumeShort}`}
                      min={0.1}
                      step={0.5}
                      decimals={1}
                      value={yieldText}
                      onChangeText={setYieldText}
                      placeholder="e.g. 16.5"
                    />
                    {errors.yieldAmount ? (
                      <Text style={[styles.errorText, { fontSize: ui.font(12) }]}>
                        {errors.yieldAmount}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                  Quality Notes
                </Text>
                <TextInput
                  style={[styles.input, { minHeight: ui.controlHeight, fontSize: ui.font(14) }]}
                  value={qualityNotes}
                  onChangeText={setQualityNotes}
                  placeholder="Morning milking, clean sample"
                />

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.switchLabel, { fontSize: ui.font(13) }]}>
                      Auto-record Milk Sale Income
                    </Text>
                    <Text style={[styles.switchHint, { fontSize: ui.font(12) }]}>
                      Est. {formatCurrency(estimatedSale, currency)} at{' '}
                      {formatCurrency(
                        Number.isFinite(parsedRate) && parsedRate >= 0
                          ? parsedRate
                          : defaultRate,
                        currency
                      )}
                      /L
                    </Text>
                  </View>
                  <Switch
                    value={autoRecordSale}
                    onValueChange={setAutoRecordSale}
                    trackColor={{
                      false: FARMDB_COLORS.border,
                      true: FARMDB_COLORS.accent,
                    }}
                  />
                </View>

                {autoRecordSale ? (
                  <View>
                    <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                      Rate ({currency} / Liter)
                    </Text>
                    <MobileNumberStepper
                      accessibilityLabel="Rate per Liter"
                      compact
                      min={0}
                      step={currency === 'UGX' ? 100 : 0.05}
                      decimals={currency === 'UGX' ? 0 : 2}
                      value={rateText}
                      onChangeText={setRateText}
                    />
                  </View>
                ) : null}

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
                    {createMutation.isPending ? 'Saving...' : 'Save Milk Yield'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}

        <View
          style={[
            styles.card,
            {
              paddingHorizontal: ui.space(6),
              paddingTop: ui.space(12),
              paddingBottom: ui.space(6),
              borderRadius: ui.radius,
              gap: ui.space(6),
            },
          ]}
        >
          <View style={[styles.chartHeaderRow, { paddingHorizontal: ui.space(8), flexWrap: 'wrap', gap: 6 }]}>
            <View style={{ flex: 1, minWidth: 130 }}>
              <Text style={[styles.cardTitle, { fontSize: ui.font(16), marginBottom: 0 }]}>
                {chartWindow === '7d'
                  ? '7-Day'
                  : chartWindow === 'weeks'
                    ? '12-Week'
                    : chartWindow === 'months'
                      ? '12-Month'
                      : 'Yearly'}{' '}
                Yield ({volumeShort})
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
              {(
                [
                  ['7d', '7D'],
                  ['weeks', 'Weeks'],
                  ['months', 'Months'],
                  ['years', 'Years'],
                ] as const
              ).map(([val, lbl]) => {
                const active = chartWindow === val;
                return (
                  <Pressable
                    key={val}
                    onPress={() => setChartWindow(val)}
                    style={{
                      paddingHorizontal: ui.space(9),
                      paddingVertical: ui.space(4),
                      minHeight: Math.max(28, ui.chipHeight - 6),
                      justifyContent: 'center',
                      borderRadius: 999,
                      backgroundColor: active
                        ? FARMDB_COLORS.accent
                        : FARMDB_COLORS.cardAlt,
                      borderWidth: 1,
                      borderColor: active
                        ? FARMDB_COLORS.accent
                        : FARMDB_COLORS.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: ui.font(11),
                        fontFamily: FARMDB_FONTS.semibold,
                        color: active ? '#ffffff' : FARMDB_COLORS.textMuted,
                      }}
                    >
                      {lbl}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {(() => {
            const milkValues = dailySeries.map((pt) =>
              convertLitersToDisplayVolume(pt.totalLiters, volumeUnit)
            );
            const milkDecimals = milkValues.some((v) => v > 0 && v < 100)
              ? 1
              : 0;
            const yLabelFontSize = ui.isCompactPhone ? 10 : 11;
            const yAxisGutter = computeMobileYAxisGutter(
              milkValues,
              (v) => `${formatCompactAxisNumber(v, milkDecimals)} ${volumeShort}`,
              {
                fontSize: yLabelFontSize,
                yLabelsOffset: 8,
                minGutter: 46,
                maxGutter: 86,
              }
            );
            const hideIndices =
              dailySeries.length <= 7
                ? ui.isCompactPhone
                  ? [1, 3, 5]
                  : []
                : dailySeries
                    .map((_, idx) => idx)
                    .filter((idx) => {
                      if (idx === 0 || idx === dailySeries.length - 1) return false;
                      if (dailySeries.length - 1 - idx < 2) return true;
                      return idx % 3 !== 0;
                    });

            return (
              <LineChart
                data={{
                  labels: dailySeries.map((pt) => pt.label),
                  datasets: [{ data: milkValues }],
                }}
                width={ui.chartWidth}
                height={244}
                fromZero
                yAxisSuffix={` ${volumeShort}`}
                yLabelsOffset={8}
                xLabelsOffset={-4}
                hidePointsAtIndex={hideIndices}
                withVerticalLines={false}
                segments={4}
                chartConfig={{
                  backgroundColor: FARMDB_COLORS.surface,
                  backgroundGradientFrom: FARMDB_COLORS.surface,
                  backgroundGradientTo: FARMDB_COLORS.bg,
                  decimalPlaces: milkDecimals,
                  formatYLabel: (raw) =>
                    formatCompactAxisNumber(raw, milkDecimals),
                  color: (opacity = 1) => `rgba(45, 106, 79, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(28, 36, 30, ${opacity})`,
                  propsForBackgroundLines: {
                    strokeDasharray: '4 4',
                    stroke: '#e6dfd1',
                  },
                  propsForLabels: {
                    fontSize: yLabelFontSize,
                  },
                  propsForDots: {
                    r: '4',
                    strokeWidth: '2',
                    stroke: FARMDB_COLORS.darkHeader,
                  },
                }}
                bezier
                style={{
                  borderRadius: 12,
                  marginTop: 2,
                  paddingRight: yAxisGutter,
                  paddingTop: 10,
                  paddingBottom: 0,
                }}
              />
            );
          })()}
        </View>

        <View style={[styles.card, { padding: ui.space(14), borderRadius: ui.radius, gap: ui.space(8) }]}>
          <Text style={[styles.cardTitle, { fontSize: ui.font(16) }]}>
            Recent Milk Logs ({displayedRecords.length})
          </Text>
          <View style={{ flexDirection: 'row', gap: ui.space(8), flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: ui.isCramped ? 128 : 110 }}>
              <ModernDropdown
                compact
                value={dateFilter}
                options={dateFilterOptions}
                title="Timeframe"
                accessibilityLabel="Filter by timeframe"
                onChange={setDateFilter}
              />
            </View>
            <View style={{ flex: 1, minWidth: ui.isCramped ? 128 : 110 }}>
              <ModernDropdown
                compact
                value={dateSort}
                options={dateSortOptions}
                title="Sort Order"
                accessibilityLabel="Sort milk logs by date"
                onChange={setDateSort}
              />
            </View>
          </View>
          {displayedRecords.length === 0 ? (
            <Text style={[styles.mutedText, { fontSize: ui.font(13) }]}>
              No milk production entries yet.
            </Text>
          ) : (
            displayedRecords.map((rec) => {
              const animal = animalsById.get(rec.livestockId);
              return (
                <View key={rec.id} style={[styles.logRow, { paddingVertical: ui.space(8), flexWrap: 'wrap' }]}>
                  <View style={{ flex: 1, minWidth: 165 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={[styles.logTitle, { fontSize: ui.font(14), flexShrink: 1 }]}>
                        {animal?.tagNumber ?? 'UNKNOWN'}
                        {animal?.name ? ` · ${animal.name}` : ''} —{' '}
                        {formatVolume(rec.yieldAmount, volumeUnit)}
                      </Text>
                      <AnimalEyeButton livestockId={rec.livestockId} />
                    </View>
                    <Text style={[styles.logMeta, { fontSize: ui.font(12) }]}>
                      {formatDisplayDate(rec.date, settings.dateFormat)}
                      {rec.qualityNotes ? ` · ${rec.qualityNotes}` : ''}
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
                        accessibilityLabel="Delete milk log"
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
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 28,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 10,
    padding: 10,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: FARMDB_FONTS.medium,
    color: '#5d675f',
  },
  statValue: {
    fontSize: 16,
    fontFamily: FARMDB_FONTS.bold,
    color: '#1c241e',
    marginTop: 2,
  },
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
  cardTitle: {
    fontSize: 16,
    fontFamily: FARMDB_FONTS.bold,
    color: '#1c241e',
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontFamily: FARMDB_FONTS.semibold,
    color: '#1c241e',
    marginTop: 10,
    marginBottom: 5,
  },
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
  twoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0ece3',
  },
  switchLabel: {
    fontSize: 13,
    fontFamily: FARMDB_FONTS.semibold,
    color: '#1c241e',
  },
  switchHint: {
    fontSize: 12,
    fontFamily: FARMDB_FONTS.regular,
    color: '#5d675f',
    marginTop: 2,
  },
  errorText: {
    fontSize: 12,
    fontFamily: FARMDB_FONTS.medium,
    color: '#b42318',
    marginTop: 4,
  },
  feedbackText: {
    fontSize: 13,
    color: '#1b6b3a',
    fontFamily: FARMDB_FONTS.semibold,
    marginTop: 10,
  },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontFamily: FARMDB_FONTS.bold,
    fontSize: 14,
  },
  toggleAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: FARMDB_COLORS.accent,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  toggleAddBtnText: {
    color: '#ffffff',
    fontFamily: FARMDB_FONTS.bold,
  },
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
  toggleCloseBtnText: {
    color: FARMDB_COLORS.text,
    fontFamily: FARMDB_FONTS.bold,
  },
  feedbackBanner: {
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1,
    borderColor: '#cce3d6',
  },
  chart: {
    borderRadius: 12,
    marginTop: 2,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mutedText: {
    fontSize: 13,
    fontFamily: FARMDB_FONTS.regular,
    color: '#5d675f',
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0ece3',
  },
  logTitle: {
    fontSize: 14,
    fontFamily: FARMDB_FONTS.bold,
    color: '#1c241e',
  },
  logMeta: {
    fontSize: 12,
    fontFamily: FARMDB_FONTS.regular,
    color: '#5d675f',
    marginTop: 2,
  },
  deleteBtn: {
    backgroundColor: '#fdeceb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deleteBtnText: {
    fontSize: 12,
    fontFamily: FARMDB_FONTS.semibold,
    color: '#b42318',
  },
  keepBtn: {
    backgroundColor: '#f0ece3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  keepBtnText: {
    fontSize: 12,
    fontFamily: FARMDB_FONTS.semibold,
    color: '#1c241e',
  },
});
