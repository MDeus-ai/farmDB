import React, { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import {
  computeLivestockStatistics,
  convertLitersToDisplayVolume,
  formatCategoryAxisLabel,
  formatCompactAxisNumber,
  formatCurrency,
  formatSexLabel,
  formatSpeciesLabel,
  getVolumeUnitShortLabel,
  LIVESTOCK_SEXES,
  SPECIES_LIST,
  STATISTICS_TIMEFRAME_OPTIONS,
  type LivestockSex,
  type Species,
  type StatisticsTimeframe,
} from '@farmdb/core';
import {
  useFinancialLogList,
  useLivestockList,
  useMedicalRecordList,
  useOwnershipList,
  useProductRecordList,
} from '@farmdb/db';
import {
  getSexPngSource,
  getSpeciesPngSource,
  MOBILE_APP_ICONS,
} from '../assets/icons';
import {
  FARMDB_COLORS,
  FARMDB_FONTS,
  useUiScale,
} from '../theme/uiScale';
import { computeMobileYAxisGutter } from '../utils/chartAxis';
import { AnimalEyeButton } from './AnimalQuickPreviewModal';
import { AppIcon, SexIcon, SpeciesIcon } from './FarmIcons';
import { FarmScrollView } from './FarmScrollView';
import { ModernDropdown, type ModernDropdownOption } from './ModernDropdown';

const COHORT_COLORS = [
  '#1b4332',
  '#2d6a4f',
  '#40916c',
  '#74c69d',
  '#b07219',
  '#8d9991',
];

function formatAgeMonthsSummary(avgMonths: number | null): string {
  if (avgMonths === null) {
    return 'No DOBs';
  }
  const rounded = Math.round(avgMonths);
  if (rounded < 12) {
    return `${rounded} mo${rounded === 1 ? '' : 's'}`;
  }
  const years = Math.floor(rounded / 12);
  const rem = rounded % 12;
  return rem === 0 ? `${years} yr${years === 1 ? '' : 's'}` : `${years}y ${rem}m`;
}

type MobileStatsSpeciesFilter =
  | 'all'
  | 'cow'
  | 'bull'
  | 'cattle'
  | Exclude<Species, 'cow'>;

export function FarmStatisticsView() {
  const [speciesFilter, setSpeciesFilter] = useState<MobileStatsSpeciesFilter>('all');
  const [sexFilter, setSexFilter] = useState<LivestockSex | 'all'>('all');
  const [timeframe, setTimeframe] = useState<StatisticsTimeframe>('14d');

  const querySpecies: Species | 'all' =
    speciesFilter === 'bull' || speciesFilter === 'cattle' || speciesFilter === 'cow'
      ? 'cow'
      : speciesFilter;

  const ui = useUiScale();
  const livestockQuery = useLivestockList({});
  const productQuery = useProductRecordList({});
  const medicalQuery = useMedicalRecordList({});
  const financialQuery = useFinancialLogList({});
  const ownershipQuery = useOwnershipList({});

  const settings = ui.settings;
  const currency = settings.currencySymbol;
  const volumeUnit = settings.volumeUnit;
  const volumeShort = getVolumeUnitShortLabel(volumeUnit);

  const animalsById = useMemo(() => {
    const map = new Map<string, NonNullable<typeof livestockQuery.data>[number]>();
    for (const animal of livestockQuery.data ?? []) {
      map.set(animal.id, animal);
    }
    return map;
  }, [livestockQuery.data]);

  const report = useMemo(
    () =>
      computeLivestockStatistics({
        livestock: livestockQuery.data ?? [],
        productRecords: productQuery.data ?? [],
        medicalRecords: medicalQuery.data ?? [],
        financialLogs: financialQuery.data ?? [],
        ownerships: ownershipQuery.data ?? [],
        speciesFilter: querySpecies,
        sexFilter,
        timeframe,
      }),
    [
      livestockQuery.data,
      productQuery.data,
      medicalQuery.data,
      financialQuery.data,
      ownershipQuery.data,
      querySpecies,
      sexFilter,
      timeframe,
    ]
  );

  const speciesOptions = useMemo<ModernDropdownOption<MobileStatsSpeciesFilter>[]>(
    () => [
      { value: 'all', label: 'All Species', iconSource: MOBILE_APP_ICONS.group },
      { value: 'cow', label: 'Cow', iconSource: getSpeciesPngSource('cow', 'female') },
      { value: 'bull', label: 'Bull', iconSource: getSpeciesPngSource('cow', 'male') },
      { value: 'cattle', label: 'Cattle (All)', iconSource: MOBILE_APP_ICONS.herd },
      ...SPECIES_LIST.filter((sp) => sp !== 'cow').map((sp) => ({
        value: sp as MobileStatsSpeciesFilter,
        label: formatSpeciesLabel(sp),
        iconSource: getSpeciesPngSource(sp),
      })),
    ],
    []
  );

  const sexOptions = useMemo<ModernDropdownOption<LivestockSex | 'all'>[]>(
    () => [
      { value: 'all', label: 'All Sexes', iconSource: MOBILE_APP_ICONS.group },
      ...LIVESTOCK_SEXES.map((sx) => ({
        value: sx,
        label: formatSexLabel(sx),
        iconSource: getSexPngSource(sx),
      })),
    ],
    []
  );

  const activeCohorts = useMemo(
    () => report.ageCohorts.filter((c) => c.count > 0),
    [report.ageCohorts]
  );

  const cardStyle = [
    styles.card,
    {
      padding: ui.space(16),
      borderRadius: ui.radius,
      gap: ui.space(10),
    },
  ];

  const totalMilkDisplay = convertLitersToDisplayVolume(
    report.totalMilkLiters,
    volumeUnit
  );
  const avgMilkAnimalDisplay = convertLitersToDisplayVolume(
    report.avgMilkPerAnimal,
    volumeUnit
  );
  const avgMilkFemaleDisplay = convertLitersToDisplayVolume(
    report.avgMilkPerMilkingFemale,
    volumeUnit
  );

  const milkSeriesLength = report.dailyMilkSeries.length;
  const hiddenMilkLabelIndices = useMemo(() => {
    if (milkSeriesLength <= 7 && !ui.isCompactPhone) return [];
    const step = milkSeriesLength <= 7 ? 2 : milkSeriesLength <= 14 ? 3 : 6;
    return report.dailyMilkSeries
      .map((_, idx) => idx)
      .filter((idx) => {
        if (idx === 0 || idx === milkSeriesLength - 1) return false;
        if (milkSeriesLength - 1 - idx < Math.max(2, Math.floor(step / 2))) {
          return true;
        }
        return idx % step !== 0;
      });
  }, [report.dailyMilkSeries, milkSeriesLength, ui.isCompactPhone]);

  return (
    <FarmScrollView
      contentContainerStyle={{
        padding: ui.contentPadding,
        gap: ui.space(14),
        paddingBottom: ui.bottomDockReserve + ui.space(24),
      }}
    >
      {/* Forest Green Header & Controls */}
      <View
        style={[
          styles.heroCard,
          {
            padding: ui.space(16),
            borderRadius: ui.radius + 4,
            gap: ui.space(12),
          },
        ]}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.heroIconWrap}>
            <AppIcon name="livestockGroup" size={ui.font(24)} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.heroTitle, { fontSize: ui.font(18) }]}>
              Farm Statistics
            </Text>
          </View>
        </View>

        <View style={{ gap: ui.space(8) }}>
          <ModernDropdown
            value={speciesFilter}
            options={speciesOptions}
            onChange={(next) => {
              setSpeciesFilter(next);
              if (next === 'cow') {
                setSexFilter('female');
              } else if (next === 'bull') {
                setSexFilter('male');
              } else {
                setSexFilter('all');
              }
            }}
          />

          <ModernDropdown
            value={sexFilter}
            options={sexOptions}
            onChange={(nextSex) => {
              setSexFilter(nextSex);
              if (speciesFilter === 'cow' || speciesFilter === 'bull' || speciesFilter === 'cattle') {
                setSpeciesFilter(
                  nextSex === 'male' ? 'bull' : nextSex === 'female' ? 'cow' : 'cattle'
                );
              }
            }}
          />

          <View style={styles.segmentRow}>
            {STATISTICS_TIMEFRAME_OPTIONS.map((opt) => {
              const active = timeframe === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.segmentBtn,
                    active && styles.segmentBtnActive,
                    {
                      minHeight: Math.max(34, ui.chipHeight - 2),
                      minWidth: ui.isCramped ? 82 : 68,
                      paddingHorizontal: ui.space(8),
                      paddingVertical: ui.space(5),
                    },
                  ]}
                  onPress={() => setTimeframe(opt.value)}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      active && styles.segmentTextActive,
                      { fontSize: ui.font(12), textAlign: 'center' },
                    ]}
                  >
                    {opt.shortLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* KPI Summary Grid */}
      <View style={[styles.summaryGrid, { gap: ui.space(10) }]}>
        <View
          style={[
            styles.statBox,
            {
              padding: ui.space(12),
              borderRadius: ui.radius,
              flexBasis: ui.isCompactPhone && (ui.isLargeText || ui.isLargeDensity) ? '100%' : '45%',
              minWidth: 134,
            },
          ]}
        >
          <Text style={[styles.statLabel, { fontSize: ui.font(11) }]}>Active Herd</Text>
          <Text style={[styles.statValue, { fontSize: ui.font(17) }]}>
            {report.activeAnimals} / {report.totalAnimals}
          </Text>
          <Text style={[styles.statHint, { fontSize: ui.font(11) }]}>
            {report.activeSharePercent}% active · {report.externalOwnedAnimals} external
          </Text>
        </View>

        <View
          style={[
            styles.statBox,
            {
              padding: ui.space(12),
              borderRadius: ui.radius,
              flexBasis: ui.isCompactPhone && (ui.isLargeText || ui.isLargeDensity) ? '100%' : '45%',
              minWidth: 134,
            },
          ]}
        >
          <Text style={[styles.statLabel, { fontSize: ui.font(11) }]}>Gender &amp; Cattle Split</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <SexIcon sex="female" size={ui.font(15)} />
              <Text style={[styles.statValue, { fontSize: ui.font(17) }]}>
                {report.femaleCount}
              </Text>
            </View>
            <Text style={[styles.mutedText, { fontSize: ui.font(14) }]}>/</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <SexIcon sex="male" size={ui.font(15)} />
              <Text style={[styles.statValue, { fontSize: ui.font(17) }]}>
                {report.maleCount}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <AppIcon name="cow" size={ui.font(12)} />
            <Text style={[styles.statHint, { fontSize: ui.font(11) }]}>
              {report.cowsCount} Cow
            </Text>
            <Text style={[styles.statHint, { fontSize: ui.font(11) }]}>·</Text>
            <AppIcon name="bull" size={ui.font(12)} />
            <Text style={[styles.statHint, { fontSize: ui.font(11) }]}>
              {report.bullsCount} Bull
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.statBox,
            {
              padding: ui.space(12),
              borderRadius: ui.radius,
              flexBasis: ui.isCompactPhone && (ui.isLargeText || ui.isLargeDensity) ? '100%' : '45%',
              minWidth: 134,
            },
          ]}
        >
          <Text style={[styles.statLabel, { fontSize: ui.font(11) }]}>Total Milk</Text>
          <Text style={[styles.statValue, { fontSize: ui.font(17) }]}>
            {totalMilkDisplay.toFixed(1)} {volumeShort}
          </Text>
          <Text style={[styles.statHint, { fontSize: ui.font(11) }]}>
            {report.milkingEligibleCount > 0
              ? `Avg ${avgMilkFemaleDisplay.toFixed(1)} ${volumeShort} / milking female`
              : `Avg ${avgMilkAnimalDisplay.toFixed(1)} ${volumeShort} / animal`}
          </Text>
        </View>

        <View
          style={[
            styles.statBox,
            {
              padding: ui.space(12),
              borderRadius: ui.radius,
              flexBasis: ui.isCompactPhone && (ui.isLargeText || ui.isLargeDensity) ? '100%' : '45%',
              minWidth: 134,
            },
          ]}
        >
          <Text style={[styles.statLabel, { fontSize: ui.font(11) }]}>Preventive Care</Text>
          <Text style={[styles.statValue, { fontSize: ui.font(17) }]}>
            {report.vaccinationCoveragePercent}%
          </Text>
          <Text style={[styles.statHint, { fontSize: ui.font(11) }]}>
            {report.vaccinatedAnimalsCount} covered · {report.totalMedicalEvents} visits
          </Text>
        </View>

        <View
          style={[
            styles.statBox,
            {
              padding: ui.space(12),
              borderRadius: ui.radius,
              flexBasis: ui.isCompactPhone && (ui.isLargeText || ui.isLargeDensity) ? '100%' : '45%',
              minWidth: 134,
            },
          ]}
        >
          <Text style={[styles.statLabel, { fontSize: ui.font(11) }]}>Medical Spend</Text>
          <Text style={[styles.statValue, { fontSize: ui.font(17) }]}>
            {formatCurrency(report.totalMedicalCost, currency)}
          </Text>
          <Text style={[styles.statHint, { fontSize: ui.font(11) }]}>
            {report.treatedAnimalsCount} treated animals
          </Text>
        </View>

        <View
          style={[
            styles.statBox,
            {
              padding: ui.space(12),
              borderRadius: ui.radius,
              flexBasis: ui.isCompactPhone && (ui.isLargeText || ui.isLargeDensity) ? '100%' : '45%',
              minWidth: 134,
            },
          ]}
        >
          <Text style={[styles.statLabel, { fontSize: ui.font(11) }]}>Average Age</Text>
          <Text style={[styles.statValue, { fontSize: ui.font(17) }]}>
            {formatAgeMonthsSummary(report.averageAgeMonths)}
          </Text>
          <Text style={[styles.statHint, { fontSize: ui.font(11) }]}>
            {report.lineageLinkedAnimals} lineage-linked
          </Text>
        </View>

        <View
          style={[
            styles.statBox,
            {
              padding: ui.space(12),
              borderRadius: ui.radius,
              flexBasis: ui.isCompactPhone && (ui.isLargeText || ui.isLargeDensity) ? '100%' : '45%',
              minWidth: 134,
            },
          ]}
        >
          <Text style={[styles.statLabel, { fontSize: ui.font(11) }]}>Net Profit</Text>
          <Text
            style={[
              styles.statValue,
              {
                fontSize: ui.font(17),
                color:
                  report.financialSummary.netProfit >= 0
                    ? FARMDB_COLORS.accent
                    : FARMDB_COLORS.danger,
              },
            ]}
          >
            {formatCurrency(report.financialSummary.netProfit, currency)}
          </Text>
          <Text style={[styles.statHint, { fontSize: ui.font(11) }]}>
            Margin {report.financialSummary.profitMarginPercent}%
          </Text>
        </View>
      </View>

      {/* Chart 1: Spacious Milk Production LineChart */}
      <View
        style={[
          cardStyle,
          {
            paddingHorizontal: ui.space(6),
            paddingTop: ui.space(12),
            paddingBottom: ui.space(6),
            gap: ui.space(6),
          },
        ]}
      >
        <View
          style={[
            styles.chartHeaderRow,
            { paddingHorizontal: ui.space(8) },
          ]}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.cardTitle, { fontSize: ui.font(16) }]}>
              {report.chartTitlePrefix} Milk Trend ({volumeShort})
            </Text>
          </View>
        </View>

        {(() => {
          const milkValues = report.dailyMilkSeries.map((pt) =>
            convertLitersToDisplayVolume(pt.totalLiters, volumeUnit)
          );
          const milkDecimals = milkValues.some((v) => v > 0 && v < 100)
            ? 1
            : 0;
          const labelFontSize = ui.isCompactPhone ? 10 : 10.5;
          const milkYAxisGutter = computeMobileYAxisGutter(
            milkValues,
            (v) => `${formatCompactAxisNumber(v, milkDecimals)} ${volumeShort}`,
            {
              fontSize: labelFontSize,
              yLabelsOffset: 8,
              minGutter: 46,
              maxGutter: 86,
            }
          );

          return (
            <LineChart
              data={{
                labels: report.dailyMilkSeries.map((pt) => pt.label),
                datasets: [{ data: milkValues }],
              }}
              width={ui.chartWidth}
              height={252}
              fromZero
              yAxisSuffix={` ${volumeShort}`}
              yLabelsOffset={8}
              xLabelsOffset={-4}
              hidePointsAtIndex={hiddenMilkLabelIndices}
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
                propsForLabels: { fontSize: labelFontSize },
                propsForDots: {
                  r: '3.5',
                  strokeWidth: '1.5',
                  stroke: FARMDB_COLORS.darkHeader,
                },
              }}
              bezier
              style={{
                borderRadius: 12,
                marginTop: 2,
                paddingRight: milkYAxisGutter,
                paddingTop: 10,
                paddingBottom: 0,
              }}
            />
          );
        })()}
      </View>

      {/* Chart 2: Herd Headcount by Species BarChart */}
      <View
        style={[
          cardStyle,
          {
            paddingHorizontal: ui.space(6),
            paddingTop: ui.space(12),
            paddingBottom: ui.space(6),
            gap: ui.space(6),
          },
        ]}
      >
        <View
          style={[
            styles.chartHeaderRow,
            { paddingHorizontal: ui.space(8) },
          ]}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.cardTitle, { fontSize: ui.font(16) }]}>
              Herd by Species
            </Text>
          </View>
        </View>

        {report.speciesBreakdown.length === 0 ? (
          <Text
            style={[
              styles.mutedText,
              { fontSize: ui.font(13), paddingHorizontal: ui.space(8) },
            ]}
          >
            No livestock yet.
          </Text>
        ) : (
          (() => {
            const speciesCounts = report.speciesBreakdown.map(
              (sp) => sp.totalCount
            );
            const labelFontSize = ui.isCompactPhone ? 10 : 10.5;
            const speciesYAxisGutter = computeMobileYAxisGutter(
              speciesCounts,
              (v) => formatCompactAxisNumber(v, 0),
              {
                fontSize: labelFontSize,
                yLabelsOffset: 6,
                minGutter: 36,
                maxGutter: 76,
              }
            );

            return (
              <BarChart
                data={{
                  labels: report.speciesBreakdown.map((sp) =>
                    formatCategoryAxisLabel(
                      sp.label,
                      report.speciesBreakdown.length > 4 ? 7 : 12
                    )
                  ),
                  datasets: [{ data: speciesCounts }],
                }}
                width={ui.chartWidth}
                height={242}
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
                  barPercentage: report.speciesBreakdown.length > 4 ? 0.56 : 0.7,
                  color: (opacity = 1) => `rgba(27, 67, 50, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(28, 36, 30, ${opacity})`,
                  formatYLabel: (raw) => formatCompactAxisNumber(raw, 0),
                  propsForBackgroundLines: {
                    strokeDasharray: '4 4',
                    stroke: '#e6dfd1',
                  },
                  propsForLabels: { fontSize: labelFontSize },
                }}
                style={{
                  borderRadius: 12,
                  marginTop: 2,
                  paddingRight: speciesYAxisGutter,
                  paddingTop: 14,
                  paddingBottom: 0,
                }}
              />
            );
          })()
        )}
      </View>

      {/* Chart 3: Age Cohorts PieChart + Clean Custom Legend */}
      <View
        style={[
          cardStyle,
          {
            paddingHorizontal: ui.space(6),
            paddingTop: ui.space(12),
            paddingBottom: ui.space(8),
            gap: ui.space(6),
          },
        ]}
      >
        <Text
          style={[
            styles.cardTitle,
            { fontSize: ui.font(16), paddingHorizontal: ui.space(8) },
          ]}
        >
          Age Demographics
        </Text>

        {activeCohorts.length === 0 ? (
          <Text
            style={[
              styles.mutedText,
              { fontSize: ui.font(13), paddingHorizontal: ui.space(8) },
            ]}
          >
            No birth dates logged.
          </Text>
        ) : (
          <>
            <View style={{ alignItems: 'center' }}>
              <PieChart
                data={activeCohorts.map((cohort, idx) => ({
                  name: cohort.label,
                  population: cohort.count,
                  color: COHORT_COLORS[idx % COHORT_COLORS.length]!,
                  legendFontColor: FARMDB_COLORS.text,
                  legendFontSize: 12,
                }))}
                width={ui.chartWidth}
                height={224}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft={String(Math.round(ui.chartWidth / 4))}
                hasLegend={false}
                chartConfig={{
                  color: (opacity = 1) => `rgba(45, 106, 79, ${opacity})`,
                }}
              />
            </View>

            <View style={{ gap: ui.space(8), paddingHorizontal: ui.space(8) }}>
              {activeCohorts.map((cohort, idx) => {
                const color = COHORT_COLORS[idx % COHORT_COLORS.length]!;
                return (
                  <View key={cohort.cohort} style={[styles.progressRow, { flexWrap: 'wrap', rowGap: 4 }]}>
                    <View style={[styles.legendDot, { backgroundColor: color }]} />
                    <Text style={[styles.progressLabel, { fontSize: ui.font(12), minWidth: 84, flexGrow: 1 }]}>
                      {cohort.label}
                    </Text>
                    <View style={[styles.progressTrack, { minWidth: 72 }]}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.max(6, Math.min(100, cohort.sharePercent))}%`,
                            backgroundColor: color,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.progressValue, { fontSize: ui.font(12) }]}>
                      {cohort.count} ({cohort.sharePercent}%)
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </View>

      {/* Card 4: Top Milk Producers */}
      <View style={cardStyle}>
        <Text style={[styles.cardTitle, { fontSize: ui.font(16) }]}>
          Top Producing Animals ({volumeShort})
        </Text>

        {report.topProducers.length === 0 ? (
          <Text style={[styles.mutedText, { fontSize: ui.font(13) }]}>
            No yield logs yet.
          </Text>
        ) : (
          <View style={{ gap: ui.space(10) }}>
            {(() => {
              const topSlice = report.topProducers.slice(0, 6);
              const maxYield = Math.max(0.1, topSlice[0]?.totalLiters ?? 0.1);
              return topSlice.map((item) => {
                const pct = Math.max(6, Math.round((item.totalLiters / maxYield) * 100));
                const totalDisp = convertLitersToDisplayVolume(item.totalLiters, volumeUnit);
                const knownAnimal = animalsById.get(item.livestockId);
                return (
                  <View key={item.livestockId} style={{ gap: 4 }}>
                    <View style={[styles.splitRowBetween, { flexWrap: 'wrap' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 140 }}>
                        {knownAnimal ? (
                          <SpeciesIcon
                            species={knownAnimal.species}
                            sex={knownAnimal.sex}
                            size={ui.font(16)}
                          />
                        ) : null}
                        {knownAnimal ? (
                          <SexIcon sex={knownAnimal.sex} size={ui.font(12)} />
                        ) : null}
                        <Text style={[styles.rowPrimary, { fontSize: ui.font(13), flexShrink: 1 }]} numberOfLines={2}>
                          {item.name ? `${item.name} (${item.tagNumber})` : item.tagNumber}
                        </Text>
                        <AnimalEyeButton livestockId={item.livestockId} />
                      </View>
                      <Text style={[styles.rowMetric, { fontSize: ui.font(13) }]}>
                        {totalDisp.toFixed(1)} {volumeShort}
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${pct}%` }]} />
                    </View>
                  </View>
                );
              });
            })()}
          </View>
        )}
      </View>

      {/* Card 5: Breeds & Medical Conditions */}
      <View style={cardStyle}>
        <Text style={[styles.cardTitle, { fontSize: ui.font(16) }]}>
          Breed Breakdown &amp; Health Patterns
        </Text>

        {report.topBreeds.length === 0 && report.topConditions.length === 0 ? (
          <Text style={[styles.mutedText, { fontSize: ui.font(13) }]}>
            No records yet.
          </Text>
        ) : (
          <View style={{ gap: ui.space(12) }}>
            {report.topBreeds.length > 0 ? (
              <View style={{ gap: ui.space(6) }}>
                <Text style={[styles.subSectionHeading, { fontSize: ui.font(12) }]}>
                  BREED DISTRIBUTION
                </Text>
                {report.topBreeds.map((b) => (
                  <View key={b.breed} style={[styles.splitRowBetween, { flexWrap: 'wrap' }]}>
                    <Text style={[styles.rowPrimary, { fontSize: ui.font(13), minWidth: 120 }]}>
                      {b.breed}
                    </Text>
                    <Text style={[styles.rowMetric, { fontSize: ui.font(12) }]}>
                      {b.count} ({b.sharePercent}%)
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {report.topConditions.length > 0 ? (
              <View style={{ gap: ui.space(6), paddingTop: 6, borderTopWidth: 1, borderTopColor: '#efeae0' }}>
                <Text style={[styles.subSectionHeading, { fontSize: ui.font(12) }]}>
                  TOP HEALTH CONDITIONS
                </Text>
                {report.topConditions.map((c) => (
                  <View key={c.condition} style={[styles.splitRowBetween, { flexWrap: 'wrap' }]}>
                    <Text style={[styles.rowPrimary, { fontSize: ui.font(13), minWidth: 120 }]}>
                      {c.label}
                    </Text>
                    <Text style={[styles.rowMetric, { fontSize: ui.font(12) }]}>
                      {c.eventCount}x · {formatCurrency(c.totalCost, currency)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}
      </View>

      {/* Card 5b: Gender & Dairy-Eligibility Mix */}
      <View style={cardStyle}>
        <Text style={[styles.cardTitle, { fontSize: ui.font(16) }]}>
          Gender &amp; Dairy-Eligibility Mix
        </Text>
        <View style={{ gap: ui.space(10) }}>
          {report.sexBreakdown.map((sx) => {
            const isFemale = sx.sex === 'female';
            const fillColor = isFemale ? '#b83b72' : '#1e5f8a';
            const milkDisp = convertLitersToDisplayVolume(sx.milkLiters, volumeUnit);
            return (
              <View key={sx.sex} style={{ gap: 4 }}>
                <View style={[styles.splitRowBetween, { flexWrap: 'wrap' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <SexIcon sex={sx.sex} size={ui.font(15)} />
                    <Text style={[styles.rowPrimary, { fontSize: ui.font(13) }]}>
                      {sx.label} ({sx.activeCount} active)
                    </Text>
                  </View>
                  <Text style={[styles.rowMetric, { fontSize: ui.font(13), color: fillColor }]}>
                    {sx.count} ({sx.sharePercent}%)
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.min(100, sx.sharePercent)}%`, backgroundColor: fillColor },
                    ]}
                  />
                </View>
                <Text style={[styles.mutedText, { fontSize: ui.font(11) }]}>
                  {isFemale
                    ? `${milkDisp.toFixed(1)} ${volumeShort} milk (${report.milkingEligibleCount} active milking females)`
                    : 'Non-milking male cohort'}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Card 6: Species Summary List */}
      {report.speciesBreakdown.length > 0 ? (
        <View style={cardStyle}>
          <Text style={[styles.cardTitle, { fontSize: ui.font(16) }]}>
            Species Performance Summary
          </Text>
          <View style={{ gap: ui.space(8) }}>
            {report.speciesBreakdown.map((sp) => (
              <View key={sp.species} style={styles.speciesSummaryRow}>
                <SpeciesIcon
                  species={sp.species}
                  sex={sexFilter === 'male' ? 'male' : 'female'}
                  size={ui.font(20)}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.rowPrimary, { fontSize: ui.font(13) }]}>
                    {sp.species === 'cow' && sexFilter === 'male'
                      ? 'Bull'
                      : sp.species === 'cow' && sexFilter === 'all'
                        ? `Cattle (${report.cowsCount} Cow · ${report.bullsCount} Bull)`
                        : sp.label}{' '}
                    ({sp.totalCount} total · {sp.activeCount} active)
                  </Text>
                  <Text style={[styles.mutedText, { fontSize: ui.font(11) }]}>
                    Milk: {convertLitersToDisplayVolume(sp.milkLiters, volumeUnit).toFixed(1)}{' '}
                    {volumeShort} · Med Spend: {formatCurrency(sp.totalMedicalCost, currency)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </FarmScrollView>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: FARMDB_COLORS.darkHeader,
    borderWidth: 1,
    borderColor: '#244734',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: FARMDB_COLORS.brandMark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: FARMDB_FONTS.extrabold,
    color: '#ffffff',
  },
  heroSubtitle: {
    fontFamily: FARMDB_FONTS.regular,
    color: '#c5d9cd',
    marginTop: 2,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 4,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  segmentBtn: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: FARMDB_COLORS.accent,
  },
  segmentText: {
    fontFamily: FARMDB_FONTS.semibold,
    color: '#d7e3db',
  },
  segmentTextActive: {
    fontFamily: FARMDB_FONTS.bold,
    color: '#ffffff',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statBox: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: '45%',
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    gap: 3,
  },
  statLabel: {
    fontFamily: FARMDB_FONTS.semibold,
    color: FARMDB_COLORS.textMuted,
  },
  statValue: {
    fontFamily: FARMDB_FONTS.extrabold,
    color: FARMDB_COLORS.text,
  },
  statHint: {
    fontFamily: FARMDB_FONTS.regular,
    color: FARMDB_COLORS.textMuted,
  },
  card: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.text,
  },
  mutedText: {
    fontFamily: FARMDB_FONTS.regular,
    color: FARMDB_COLORS.textMuted,
  },
  chart: {
    borderRadius: 12,
    marginTop: 2,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  progressLabel: {
    fontFamily: FARMDB_FONTS.semibold,
    color: FARMDB_COLORS.text,
    flexShrink: 1,
    minWidth: 0,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#ebe5d8',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: FARMDB_COLORS.accent,
  },
  progressValue: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.textMuted,
    minWidth: 64,
    textAlign: 'right',
  },
  splitRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowPrimary: {
    fontFamily: FARMDB_FONTS.semibold,
    color: FARMDB_COLORS.text,
    flexShrink: 1,
  },
  rowMetric: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.accent,
  },
  subSectionHeading: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.textMuted,
    letterSpacing: 0.4,
  },
  speciesSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0ece3',
  },
});
