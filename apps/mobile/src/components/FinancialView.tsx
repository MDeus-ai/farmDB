import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import {
  CURRENCY_OPTIONS,
  buildPeriodProfitLossSeries,
  computeFinancialSummary,
  filterAndSortRecordsByDate,
  FINANCIAL_PERIOD_BUCKETS,
  formatCategoryLabel,
  formatCompactAxisNumber,
  formatCurrency,
  formatDisplayDate,
  RECORD_DATE_FILTER_OPTIONS,
  type DateSortDirection,
  type FinancialLog,
  describeModuleAccessLevel,
  type RecordDateFilter,
  type TransactionType,
} from '@farmdb/core';
import {
  useDeleteFinancialLog,
  useFinancialLogList,
  useLivestockList,
  useModulePermissions,
  useUpdateFarmSettings,
} from '@farmdb/db';
import {
  getCurrencyFlagSource,
  getCurrencyOptionFlagSource,
  MOBILE_APP_ICONS,
} from '../assets/icons';
import {
  FARMDB_COLORS,
  FARMDB_FONTS,
  useUiScale,
} from '../theme/uiScale';
import { computeMobileYAxisGutter } from '../utils/chartAxis';
import { AnimalEyeButton } from './AnimalQuickPreviewModal';
import { AppIcon } from './FarmIcons';
import { FarmScrollView } from './FarmScrollView';
import { MobileNumberStepper } from './MobileNumberStepper';
import { FinancialFormModal } from './FinancialFormModal';
import {
  ModernDropdown,
  type ModernDropdownOption,
} from './ModernDropdown';

export function FinancialView() {
  const ui = useUiScale();
  const { settings } = ui;
  const { canEdit, canDelete, accessLevel } = useModulePermissions('financial');
  const iconMode = settings.mobileIconMode;

  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [periodBucket, setPeriodBucket] = useState<'week' | 'month' | 'year'>('month');
  const [dateFilter, setDateFilter] = useState<RecordDateFilter>('all');
  const [dateSort, setDateSort] = useState<DateSortDirection>('desc');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<FinancialLog | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  const livestockQuery = useLivestockList({});
  const updateSettingsMutation = useUpdateFarmSettings();
  const allLogsQuery = useFinancialLogList({});
  const filteredLogsQuery = useFinancialLogList({
    transactionType: typeFilter,
    search: search || undefined,
  });
  const deleteMutation = useDeleteFinancialLog();

  const [rateInput, setRateInput] = useState(
    settings.defaultMilkRatePerLiter.toFixed(2)
  );
  const [currencyInput, setCurrencyInput] = useState(settings.currencySymbol);
  const [customCurrency, setCustomCurrency] = useState(
    !CURRENCY_OPTIONS.some((c) => c.symbol === settings.currencySymbol)
  );
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  useEffect(() => {
    setRateInput(settings.defaultMilkRatePerLiter.toFixed(2));
    setCurrencyInput(settings.currencySymbol);
    setCustomCurrency(
      !CURRENCY_OPTIONS.some((c) => c.symbol === settings.currencySymbol)
    );
  }, [settings.defaultMilkRatePerLiter, settings.currencySymbol]);

  const typeFilterOptions = useMemo<
    ModernDropdownOption<TransactionType | 'all'>[]
  >(
    () => [
      {
        value: 'all',
        label: 'All Transactions',
        customIcon: (
          <AppIcon name="all" size={16} color={FARMDB_COLORS.accent} />
        ),
      },
      {
        value: 'income',
        label: 'Income Only',
        iconSource: MOBILE_APP_ICONS.money,
      },
      {
        value: 'expense',
        label: 'Expenses Only',
        iconSource: MOBILE_APP_ICONS.budget,
      },
    ],
    []
  );

  const currencyQuickOptions = useMemo<ModernDropdownOption<string>[]>(
    () => [
      ...CURRENCY_OPTIONS.map((opt) => ({
        value: opt.symbol,
        label: `${opt.code} (${opt.symbol})`,
        iconSource: getCurrencyOptionFlagSource(opt),
      })),
      {
        value: '__custom__',
        label: 'Custom',
        iconSource: getCurrencyFlagSource(currencyInput),
      },
    ],
    [currencyInput]
  );

  const selectedQuickCurrency =
    !customCurrency && CURRENCY_OPTIONS.some((c) => c.symbol === currencyInput)
      ? currencyInput
      : '__custom__';

  const animals = livestockQuery.data ?? [];
  const animalsById = useMemo(
    () => new Map(animals.map((a) => [a.id, a])),
    [animals]
  );

  const allLogs = allLogsQuery.data ?? [];
  const visibleLogs = useMemo(
    () =>
      filterAndSortRecordsByDate(filteredLogsQuery.data ?? [], {
        filter: dateFilter,
        sort: dateSort,
      }),
    [filteredLogsQuery.data, dateFilter, dateSort]
  );
  const currency = settings.currencySymbol;

  const summary = useMemo(() => computeFinancialSummary(allLogs), [allLogs]);
  const monthlySeries = useMemo(
    () =>
      buildPeriodProfitLossSeries(
        allLogs,
        periodBucket,
        periodBucket === 'year' ? 8 : periodBucket === 'month' ? 6 : 6
      ),
    [allLogs, periodBucket]
  );

  async function handleSaveSettings() {
    if (!canEdit) return;
    setSettingsMsg(null);
    try {
      await updateSettingsMutation.mutateAsync({
        defaultMilkRatePerLiter: Number(rateInput),
        currencySymbol: currencyInput,
      });
      setSettingsMsg('Milk rate saved.');
    } catch (err) {
      setSettingsMsg(err instanceof Error ? err.message : 'Invalid settings.');
    }
  }

  async function handleDeleteLog(id: string) {
    if (!canDelete) return;
    if (settings.confirmBeforeDelete && confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setConfirmDeleteId(null);
    await deleteMutation.mutateAsync(id);
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
      minWidth: 132,
    },
  ];

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
        <View style={[styles.topActions, { gap: ui.space(10) }]}>
          <View style={[styles.summaryGrid, { gap: ui.space(8) }]}>
            <View style={statCardStyle}>
              <Text style={[styles.statLabel, { fontSize: ui.font(11) }]}>
                Income
              </Text>
              <Text
                style={[
                  styles.statValue,
                  { color: FARMDB_COLORS.success, fontSize: ui.font(15) },
                ]}
              >
                {formatCurrency(summary.totalIncome, currency)}
              </Text>
            </View>
            <View style={statCardStyle}>
              <Text style={[styles.statLabel, { fontSize: ui.font(11) }]}>
                Expenses
              </Text>
              <Text
                style={[
                  styles.statValue,
                  { color: FARMDB_COLORS.danger, fontSize: ui.font(15) },
                ]}
              >
                {formatCurrency(summary.totalExpense, currency)}
              </Text>
            </View>
            <View style={statCardStyle}>
              <Text style={[styles.statLabel, { fontSize: ui.font(11) }]}>
                Net Profit
              </Text>
              <Text
                style={[
                  styles.statValue,
                  {
                    color:
                      summary.netProfit >= 0
                        ? FARMDB_COLORS.success
                        : FARMDB_COLORS.danger,
                    fontSize: ui.font(15),
                  },
                ]}
              >
                {formatCurrency(summary.netProfit, currency)}
              </Text>
            </View>
            <View style={statCardStyle}>
              <Text style={[styles.statLabel, { fontSize: ui.font(11) }]}>
                Margin
              </Text>
              <Text style={[styles.statValue, { fontSize: ui.font(15) }]}>
                {summary.profitMarginPercent.toFixed(1)}%
              </Text>
            </View>
          </View>

          {canEdit ? (
            <Pressable
              accessibilityLabel="Record income or expense"
              style={[
                styles.addBtn,
                {
                  minHeight: ui.controlHeight,
                  paddingHorizontal: ui.space(12),
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                },
              ]}
              onPress={() => {
                setEditing(null);
                setModalVisible(true);
              }}
            >
              <AppIcon name="plus" size={ui.font(18)} color="#ffffff" />
              <Text style={[styles.addBtnText, { fontSize: ui.font(14) }]}>
                {iconMode ? 'Add Entry' : 'Record Income / Expense'}
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
        </View>

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
            <View style={{ flex: 1, minWidth: 120 }}>
              <Text style={[styles.cardTitle, { fontSize: ui.font(16), marginBottom: 0 }]}>
                {periodBucket === 'week'
                  ? 'Weekly'
                  : periodBucket === 'year'
                    ? 'Yearly'
                    : 'Monthly'}{' '}
                P&amp;L ({currency})
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {FINANCIAL_PERIOD_BUCKETS.map((opt) => {
                const active = periodBucket === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setPeriodBucket(opt.value)}
                    style={{
                      paddingHorizontal: 9,
                      paddingVertical: 4,
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
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {allLogs.length === 0 ? (
            <Text style={[styles.mutedText, { fontSize: ui.font(13), paddingHorizontal: ui.space(8), paddingBottom: ui.space(6) }]}>
              No financial entries yet.
            </Text>
          ) : (
            (() => {
              const recentSeries = monthlySeries.slice(-6);
              const barLabels =
                recentSeries.length > 1
                  ? recentSeries.map((m) => m.label)
                  : ['Income', 'Expenses', 'Net'];
              const barValues =
                recentSeries.length > 1
                  ? recentSeries.map((m) => Math.max(0, m.netProfit))
                  : [
                    summary.totalIncome,
                    summary.totalExpense,
                    Math.max(0, summary.netProfit),
                  ];

              const finYAxisGutter = computeMobileYAxisGutter(
                barValues,
                (v) => formatCompactAxisNumber(v, 0),
                {
                  fontSize: 10.5,
                  yLabelsOffset: 6,
                  minGutter: 40,
                  maxGutter: 84,
                }
              );

              return (
                <BarChart
                  data={{
                    labels: barLabels,
                    datasets: [{ data: barValues }],
                  }}
                  width={ui.chartWidth}
                  height={240}
                  fromZero
                  yAxisLabel=""
                  yAxisSuffix=""
                  yLabelsOffset={6}
                  xLabelsOffset={-4}
                  showValuesOnTopOfBars
                  withInnerLines
                  chartConfig={{
                    backgroundColor: FARMDB_COLORS.surface,
                    backgroundGradientFrom: FARMDB_COLORS.surface,
                    backgroundGradientTo: FARMDB_COLORS.bg,
                    decimalPlaces: 0,
                    barPercentage: barLabels.length > 4 ? 0.58 : 0.72,
                    color: (opacity = 1) => `rgba(45, 106, 79, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(28, 36, 30, ${opacity})`,
                    formatYLabel: (val) => formatCompactAxisNumber(val, 0),
                    propsForBackgroundLines: {
                      strokeDasharray: '4 4',
                      stroke: '#e6dfd1',
                    },
                    propsForLabels: {
                      fontSize: 10.5,
                    },
                  }}
                  style={{
                    borderRadius: 12,
                    marginTop: 2,
                    paddingRight: finYAxisGutter,
                    paddingTop: 14,
                    paddingBottom: 0,
                  }}
                />
              );
            })()
          )}
        </View>

        <View
          style={[styles.card, { padding: ui.space(14), borderRadius: ui.radius }]}
        >
          <View style={styles.sectionTitleRow}>
            <AppIcon name="financial" size={ui.font(18)} />
            <Text style={[styles.cardTitle, { fontSize: ui.font(16), marginBottom: 0, flexShrink: 1 }]}>
              Standard Milk Sale Rate &amp; Currency
            </Text>
          </View>
          <View style={[styles.settingsRow, { gap: ui.space(8), flexWrap: 'wrap' }]}>
            <View style={{ flex: 1, minWidth: 132 }}>
              <MobileNumberStepper
                accessibilityLabel="Standard Milk Rate"
                compact
                min={0}
                step={currencyInput === 'UGX' ? 100 : 0.05}
                decimals={currencyInput === 'UGX' ? 0 : 2}
                value={rateInput}
                onChangeText={setRateInput}
                placeholder="0.65"
              />
            </View>
            <View style={{ minWidth: 136, flexGrow: 1 }}>
              <ModernDropdown
                value={selectedQuickCurrency}
                options={currencyQuickOptions}
                title="Currency"
                accessibilityLabel="Currency"
                onChange={(val) => {
                  if (val === '__custom__') {
                    setCustomCurrency(true);
                  } else {
                    setCustomCurrency(false);
                    setCurrencyInput(val);
                  }
                }}
              />
            </View>
            {selectedQuickCurrency === '__custom__' ? (
              <TextInput
                style={[
                  styles.input,
                  { minWidth: 84, flexGrow: 0.4, minHeight: ui.controlHeight, fontSize: ui.font(14) },
                ]}
                value={currencyInput}
                onChangeText={setCurrencyInput}
                maxLength={6}
                placeholder="KES"
              />
            ) : null}
            {canEdit ? (
              <Pressable
                style={[
                  styles.saveSmallBtn,
                  { minHeight: ui.controlHeight, minWidth: 74, justifyContent: 'center', alignItems: 'center' },
                ]}
                onPress={() => void handleSaveSettings()}
              >
                <Text style={[styles.saveSmallBtnText, { fontSize: ui.font(13) }]}>
                  Save
                </Text>
              </Pressable>
            ) : null}
          </View>
          {settingsMsg ? (
            <Text style={[styles.settingsMsg, { fontSize: ui.font(12) }]}>
              {settingsMsg}
            </Text>
          ) : null}
        </View>

        <View
          style={[styles.card, { padding: ui.space(14), borderRadius: ui.radius }]}
        >
          <Text style={[styles.cardTitle, { fontSize: ui.font(16) }]}>
            Transactions ({visibleLogs.length})
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
              placeholder="Search category or notes..."
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
            <View style={{ flex: 1, minWidth: ui.isCramped ? 140 : 120 }}>
              <ModernDropdown
                compact
                value={typeFilter}
                options={typeFilterOptions}
                title="Filter Transactions"
                accessibilityLabel="Filter transaction type"
                onChange={setTypeFilter}
              />
            </View>
            <View style={{ flex: 1, minWidth: ui.isCramped ? 124 : 96 }}>
              <ModernDropdown
                compact
                value={dateFilter}
                options={dateFilterOptions}
                title="Timeframe"
                accessibilityLabel="Filter by timeframe"
                onChange={setDateFilter}
              />
            </View>
            <View style={{ flex: 1, minWidth: ui.isCramped ? 116 : 92 }}>
              <ModernDropdown
                compact
                value={dateSort}
                options={dateSortOptions}
                title="Sort Order"
                accessibilityLabel="Sort transactions by date"
                onChange={setDateSort}
              />
            </View>
          </View>

          {visibleLogs.length === 0 ? (
            <Text style={[styles.mutedText, { fontSize: ui.font(13) }]}>
              No matching transactions.
            </Text>
          ) : (
            visibleLogs.map((log) => {
              const animal = log.livestockId
                ? animalsById.get(log.livestockId)
                : null;
              return (
                <View key={log.id} style={[styles.logRow, { paddingVertical: ui.space(10), flexWrap: 'wrap' }]}>
                  <View style={{ flex: 1, minWidth: 168 }}>
                    <Text style={[styles.logTitle, { fontSize: ui.font(14) }]}>
                      {formatCategoryLabel(log.category)}
                      {log.productRecordId ? ' (Auto)' : ''} ·{' '}
                      <Text
                        style={{
                          color:
                            log.transactionType === 'income'
                              ? FARMDB_COLORS.success
                              : FARMDB_COLORS.danger,
                        }}
                      >
                        {log.transactionType === 'income' ? '+' : '-'}
                        {formatCurrency(log.amount, currency)}
                      </Text>
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={[styles.logMeta, { fontSize: ui.font(12), flexShrink: 1 }]}>
                        {formatDisplayDate(log.date, settings.dateFormat)}
                        {animal ? ` · ${animal.tagNumber}` : ' · General Farm'}
                        {log.notes ? ` · ${log.notes}` : ''}
                      </Text>
                      {animal ? <AnimalEyeButton livestockId={animal.id} /> : null}
                    </View>
                  </View>

                  {canEdit || canDelete ? (
                    <View style={[styles.rowBtns, { flexWrap: 'wrap' }]}>
                      {canDelete && confirmDeleteId === log.id ? (
                        <>
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
                            onPress={() => void handleDeleteLog(log.id)}
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
                            accessibilityLabel="Keep entry"
                            style={[
                              styles.editBtn,
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
                              <Text style={[styles.editBtnText, { fontSize: ui.font(11) }]}>
                                Keep
                              </Text>
                            ) : null}
                          </Pressable>
                        </>
                      ) : (
                        <>
                          {canEdit ? (
                            <Pressable
                              accessibilityLabel="Edit financial entry"
                              style={[
                                styles.editBtn,
                                {
                                  minHeight: ui.chipHeight - 2,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 4,
                                },
                              ]}
                              onPress={() => {
                                setEditing(log);
                                setModalVisible(true);
                              }}
                            >
                              <AppIcon
                                name="edit"
                                size={ui.font(14)}
                                color={FARMDB_COLORS.text}
                              />
                              {!iconMode ? (
                                <Text style={[styles.editBtnText, { fontSize: ui.font(11) }]}>
                                  Edit
                                </Text>
                              ) : null}
                            </Pressable>
                          ) : null}
                          {canDelete ? (
                            <Pressable
                              accessibilityLabel="Delete financial entry"
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
                              onPress={() => void handleDeleteLog(log.id)}
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
                          ) : null}
                        </>
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        <FinancialFormModal
          visible={modalVisible}
          editing={editing}
          animals={animals}
          currencySymbol={currency}
          onClose={() => setModalVisible(false)}
        />
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
  topActions: {
    gap: 10,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
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
  addBtn: {
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addBtnText: {
    color: '#ffffff',
    fontFamily: FARMDB_FONTS.bold,
    fontSize: 14,
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
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: FARMDB_FONTS.bold,
    color: '#1c241e',
    marginBottom: 10,
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
  settingsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
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
  saveSmallBtn: {
    backgroundColor: '#17271d',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 9,
  },
  saveSmallBtnText: {
    color: '#ffffff',
    fontFamily: FARMDB_FONTS.bold,
    fontSize: 13,
  },
  settingsMsg: {
    fontSize: 12,
    color: '#1b6b3a',
    fontFamily: FARMDB_FONTS.semibold,
    marginTop: 6,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  rowBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  editBtn: {
    borderWidth: 1,
    borderColor: '#ddd6c8',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editBtnText: {
    fontSize: 12,
    fontFamily: FARMDB_FONTS.semibold,
    color: '#1c241e',
  },
  deleteBtn: {
    backgroundColor: '#fdeceb',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deleteBtnText: {
    fontSize: 12,
    fontFamily: FARMDB_FONTS.semibold,
    color: '#b42318',
  },
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
