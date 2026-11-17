import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import {
  buildDailyYieldSeries,
  buildTopProducers,
  formatCurrency,
  getTodayIsoDate,
  roundAmount,
  validateNewProductRecord,
  type NewProductRecordInput,
  type ValidationErrors,
} from '@farmdb/core';
import {
  ProductionValidationError,
  useCreateProductRecord,
  useDeleteProductRecord,
  useFarmSettings,
  useLivestockList,
  useProductRecordList,
} from '@farmdb/db';

export function ProductionView() {
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(260, width - 64);

  const livestockQuery = useLivestockList({});
  const settingsQuery = useFarmSettings();
  const productionQuery = useProductRecordList({});
  const createMutation = useCreateProductRecord();
  const deleteMutation = useDeleteProductRecord();

  const animals = livestockQuery.data ?? [];
  const activeAnimals = useMemo(
    () => animals.filter((a) => a.status === 'active'),
    [animals]
  );
  const animalsById = useMemo(
    () => new Map(animals.map((a) => [a.id, a])),
    [animals]
  );

  const settings = settingsQuery.data;
  const currency = settings?.currencySymbol ?? '$';
  const defaultRate = settings?.defaultMilkRatePerLiter ?? 0.65;

  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [date, setDate] = useState(() => getTodayIsoDate());
  const [yieldText, setYieldText] = useState('');
  const [qualityNotes, setQualityNotes] = useState('');
  const [autoRecordSale, setAutoRecordSale] = useState(true);
  const [rateText, setRateText] = useState('');
  const [errors, setErrors] = useState<ValidationErrors<NewProductRecordInput>>(
    {}
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAnimalId && activeAnimals[0]) {
      setSelectedAnimalId(activeAnimals[0].id);
    }
  }, [activeAnimals, selectedAnimalId]);

  useEffect(() => {
    if (settings && rateText === '') {
      setRateText(settings.defaultMilkRatePerLiter.toFixed(2));
    }
  }, [settings, rateText]);

  const records = productionQuery.data ?? [];
  const dailySeries = useMemo(
    () => buildDailyYieldSeries(records, 7),
    [records]
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
    () => roundAmount(dailySeries.reduce((sum, d) => sum + d.totalLiters, 0)),
    [dailySeries]
  );

  const parsedYield = Number(yieldText);
  const parsedRate = Number(rateText);
  const estimatedSale =
    autoRecordSale &&
    Number.isFinite(parsedYield) &&
    parsedYield > 0 &&
    Number.isFinite(parsedRate) &&
    parsedRate > 0
      ? roundAmount(parsedYield * parsedRate)
      : 0;

  async function handleSubmit() {
    setFeedback(null);
    const check = validateNewProductRecord({
      livestockId: selectedAnimalId,
      date,
      yieldAmount: parsedYield,
      qualityNotes,
    });

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
      setFeedback(
        result.generatedIncomeLog
          ? `Saved ${result.record.yieldAmount.toFixed(1)} L + ${formatCurrency(result.generatedIncomeLog.amount, currency)} milk sale.`
          : `Saved ${result.record.yieldAmount.toFixed(1)} L milk yield.`
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Today</Text>
          <Text style={styles.statValue}>{todayTotal.toFixed(1)} L</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>7-Day Total</Text>
          <Text style={styles.statValue}>{sevenDayTotal.toFixed(1)} L</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Top Cow</Text>
          <Text style={styles.statValue} numberOfLines={1}>
            {topProducers[0] ? topProducers[0].tagNumber : '—'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Log Daily Milk Yield</Text>
        {activeAnimals.length === 0 ? (
          <Text style={styles.mutedText}>
            Add at least one active animal in Herd before logging milk yields.
          </Text>
        ) : (
          <>
            <Text style={styles.label}>Select Animal *</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {activeAnimals.map((animal) => (
                <Pressable
                  key={animal.id}
                  style={[
                    styles.chip,
                    selectedAnimalId === animal.id && styles.chipActive,
                  ]}
                  onPress={() => setSelectedAnimalId(animal.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedAnimalId === animal.id && styles.chipTextActive,
                    ]}
                  >
                    {animal.tagNumber}
                    {animal.name ? ` · ${animal.name}` : ''}
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
                <Text style={styles.label}>Yield (Liters) *</Text>
                <TextInput
                  style={styles.input}
                  value={yieldText}
                  onChangeText={setYieldText}
                  placeholder="e.g. 16.5"
                  keyboardType="decimal-pad"
                />
                {errors.yieldAmount ? (
                  <Text style={styles.errorText}>{errors.yieldAmount}</Text>
                ) : null}
              </View>
            </View>

            <Text style={styles.label}>Quality Notes</Text>
            <TextInput
              style={styles.input}
              value={qualityNotes}
              onChangeText={setQualityNotes}
              placeholder="Morning milking, clean sample"
            />

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>
                  Auto-record Milk Sale Income
                </Text>
                <Text style={styles.switchHint}>
                  Est. {formatCurrency(estimatedSale, currency)} at{' '}
                  {currency}
                  {rateText || defaultRate.toFixed(2)}/L
                </Text>
              </View>
              <Switch
                value={autoRecordSale}
                onValueChange={setAutoRecordSale}
                trackColor={{ false: '#ccc', true: '#2d6a4f' }}
              />
            </View>

            {autoRecordSale ? (
              <View>
                <Text style={styles.label}>Rate ({currency} / Liter)</Text>
                <TextInput
                  style={styles.input}
                  value={rateText}
                  onChangeText={setRateText}
                  keyboardType="decimal-pad"
                />
              </View>
            ) : null}

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
                {createMutation.isPending ? 'Saving...' : 'Save Milk Yield'}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>7-Day Production Trend (Liters)</Text>
        <LineChart
          data={{
            labels: dailySeries.map((pt) => pt.label),
            datasets: [
              {
                data: dailySeries.map((pt) => pt.totalLiters),
              },
            ],
          }}
          width={chartWidth}
          height={200}
          fromZero
          yAxisSuffix="L"
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#f5f3ee',
            decimalPlaces: 1,
            color: (opacity = 1) => `rgba(45, 106, 79, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(28, 36, 30, ${opacity})`,
            propsForDots: {
              r: '4',
              strokeWidth: '2',
              stroke: '#17271d',
            },
          }}
          bezier
          style={styles.chart}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Milk Logs ({records.length})</Text>
        {records.length === 0 ? (
          <Text style={styles.mutedText}>No milk production entries yet.</Text>
        ) : (
          records.map((rec) => {
            const animal = animalsById.get(rec.livestockId);
            return (
              <View key={rec.id} style={styles.logRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.logTitle}>
                    {animal?.tagNumber ?? 'UNKNOWN'}
                    {animal?.name ? ` · ${animal.name}` : ''} —{' '}
                    {rec.yieldAmount.toFixed(2)} L
                  </Text>
                  <Text style={styles.logMeta}>
                    {rec.date}
                    {rec.qualityNotes ? ` · ${rec.qualityNotes}` : ''}
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
    color: '#5d675f',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1c241e',
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
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
    color: '#1c241e',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ddd6c8',
    backgroundColor: '#ffffff',
  },
  chipActive: {
    backgroundColor: '#2d6a4f',
    borderColor: '#2d6a4f',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1c241e',
  },
  chipTextActive: {
    color: '#ffffff',
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
    fontWeight: '600',
    color: '#1c241e',
  },
  switchHint: {
    fontSize: 12,
    color: '#5d675f',
    marginTop: 2,
  },
  errorText: {
    fontSize: 12,
    color: '#b42318',
    marginTop: 4,
  },
  feedbackText: {
    fontSize: 13,
    color: '#1b6b3a',
    fontWeight: '600',
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
    fontWeight: '700',
    fontSize: 14,
  },
  chart: {
    borderRadius: 10,
    marginTop: 4,
  },
  mutedText: {
    fontSize: 13,
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
    fontWeight: '700',
    color: '#1c241e',
  },
  logMeta: {
    fontSize: 12,
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
    fontWeight: '600',
    color: '#b42318',
  },
});
