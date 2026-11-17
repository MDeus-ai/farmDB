import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import {
  buildMonthlyProfitLossSeries,
  computeFinancialSummary,
  formatCategoryLabel,
  formatCurrency,
  type FinancialLog,
  type TransactionType,
} from '@farmdb/core';
import {
  useDeleteFinancialLog,
  useFarmSettings,
  useFinancialLogList,
  useLivestockList,
  useUpdateFarmSettings,
} from '@farmdb/db';
import { FinancialFormModal } from './FinancialFormModal';

export function FinancialView() {
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(260, width - 64);

  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<FinancialLog | null>(null);

  const livestockQuery = useLivestockList({});
  const settingsQuery = useFarmSettings();
  const updateSettingsMutation = useUpdateFarmSettings();
  const allLogsQuery = useFinancialLogList({});
  const filteredLogsQuery = useFinancialLogList({
    transactionType: typeFilter,
    search: search || undefined,
  });
  const deleteMutation = useDeleteFinancialLog();

  const [rateInput, setRateInput] = useState('');
  const [currencyInput, setCurrencyInput] = useState('$');
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  useEffect(() => {
    if (settingsQuery.data) {
      setRateInput(settingsQuery.data.defaultMilkRatePerLiter.toFixed(2));
      setCurrencyInput(settingsQuery.data.currencySymbol);
    }
  }, [settingsQuery.data]);

  const animals = livestockQuery.data ?? [];
  const animalsById = useMemo(
    () => new Map(animals.map((a) => [a.id, a])),
    [animals]
  );

  const allLogs = allLogsQuery.data ?? [];
  const visibleLogs = filteredLogsQuery.data ?? [];
  const currency = settingsQuery.data?.currencySymbol ?? '$';

  const summary = useMemo(() => computeFinancialSummary(allLogs), [allLogs]);
  const monthlySeries = useMemo(
    () => buildMonthlyProfitLossSeries(allLogs, 4),
    [allLogs]
  );

  async function handleSaveSettings() {
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topActions}>
        <View style={styles.summaryGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Income</Text>
            <Text style={[styles.statValue, { color: '#1b6b3a' }]}>
              {formatCurrency(summary.totalIncome, currency)}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Expenses</Text>
            <Text style={[styles.statValue, { color: '#b42318' }]}>
              {formatCurrency(summary.totalExpense, currency)}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Net Profit</Text>
            <Text
              style={[
                styles.statValue,
                { color: summary.netProfit >= 0 ? '#1b6b3a' : '#b42318' },
              ]}
            >
              {formatCurrency(summary.netProfit, currency)}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Margin</Text>
            <Text style={styles.statValue}>
              {summary.profitMarginPercent.toFixed(1)}%
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.addBtn}
          onPress={() => {
            setEditing(null);
            setModalVisible(true);
          }}
        >
          <Text style={styles.addBtnText}>+ Record Income / Expense</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profit & Loss Snapshot</Text>
        {allLogs.length === 0 ? (
          <Text style={styles.mutedText}>
            Record milk sales or expenses to view profit & loss charts.
          </Text>
        ) : (
          <BarChart
            data={{
              labels:
                monthlySeries.length > 1
                  ? monthlySeries.map((m) => m.label.slice(2))
                  : ['Income', 'Expenses', 'Net'],
              datasets: [
                {
                  data:
                    monthlySeries.length > 1
                      ? monthlySeries.map((m) => Math.max(0, m.netProfit))
                      : [
                          summary.totalIncome,
                          summary.totalExpense,
                          Math.max(0, summary.netProfit),
                        ],
                },
              ],
            }}
            width={chartWidth}
            height={195}
            fromZero
            yAxisLabel={currency}
            yAxisSuffix=""
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#f5f3ee',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(45, 106, 79, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(28, 36, 30, ${opacity})`,
            }}
            style={styles.chart}
          />
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Standard Milk Sale Rate</Text>
        <View style={styles.settingsRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={rateInput}
            onChangeText={setRateInput}
            keyboardType="decimal-pad"
            placeholder="0.65"
          />
          <TextInput
            style={[styles.input, { width: 70 }]}
            value={currencyInput}
            onChangeText={setCurrencyInput}
            maxLength={6}
            placeholder="$"
          />
          <Pressable
            style={styles.saveSmallBtn}
            onPress={() => void handleSaveSettings()}
          >
            <Text style={styles.saveSmallBtnText}>Save</Text>
          </Pressable>
        </View>
        {settingsMsg ? (
          <Text style={styles.settingsMsg}>{settingsMsg}</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Transactions ({visibleLogs.length})
        </Text>
        <TextInput
          style={[styles.input, { marginBottom: 10 }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search category or notes..."
        />

        <View style={styles.filterRow}>
          {(['all', 'income', 'expense'] as const).map((t) => (
            <Pressable
              key={t}
              style={[
                styles.filterChip,
                typeFilter === t && styles.filterChipActive,
              ]}
              onPress={() => setTypeFilter(t)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  typeFilter === t && styles.filterChipTextActive,
                ]}
              >
                {t === 'all'
                  ? 'All'
                  : t === 'income'
                    ? 'Income'
                    : 'Expenses'}
              </Text>
            </Pressable>
          ))}
        </View>

        {visibleLogs.length === 0 ? (
          <Text style={styles.mutedText}>No matching transactions.</Text>
        ) : (
          visibleLogs.map((log) => {
            const animal = log.livestockId
              ? animalsById.get(log.livestockId)
              : null;
            return (
              <View key={log.id} style={styles.logRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.logTitle}>
                    {formatCategoryLabel(log.category)}
                    {log.productRecordId ? ' (Auto)' : ''} ·{' '}
                    <Text
                      style={{
                        color:
                          log.transactionType === 'income'
                            ? '#1b6b3a'
                            : '#b42318',
                      }}
                    >
                      {log.transactionType === 'income' ? '+' : '-'}
                      {formatCurrency(log.amount, currency)}
                    </Text>
                  </Text>
                  <Text style={styles.logMeta}>
                    {log.date}
                    {animal ? ` · ${animal.tagNumber}` : ' · General Farm'}
                    {log.notes ? ` · ${log.notes}` : ''}
                  </Text>
                </View>

                <View style={styles.rowBtns}>
                  <Pressable
                    style={styles.editBtn}
                    onPress={() => {
                      setEditing(log);
                      setModalVisible(true);
                    }}
                  >
                    <Text style={styles.editBtnText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={styles.deleteBtn}
                    onPress={() => void deleteMutation.mutateAsync(log.id)}
                  >
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </Pressable>
                </View>
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
    </ScrollView>
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
    width: '48%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 10,
    padding: 10,
  },
  statLabel: {
    fontSize: 11,
    color: '#5d675f',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
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
    fontWeight: '700',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 12,
    padding: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1c241e',
    marginBottom: 10,
  },
  chart: {
    borderRadius: 10,
  },
  mutedText: {
    fontSize: 13,
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
    fontWeight: '700',
    fontSize: 13,
  },
  settingsMsg: {
    fontSize: 12,
    color: '#1b6b3a',
    fontWeight: '600',
    marginTop: 6,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ddd6c8',
    backgroundColor: '#ffffff',
  },
  filterChipActive: {
    backgroundColor: '#17271d',
    borderColor: '#17271d',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1c241e',
  },
  filterChipTextActive: {
    color: '#ffffff',
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
    fontWeight: '700',
    color: '#1c241e',
  },
  logMeta: {
    fontSize: 12,
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
    fontWeight: '600',
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
    fontWeight: '600',
    color: '#b42318',
  },
});
