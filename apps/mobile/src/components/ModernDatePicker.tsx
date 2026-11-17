import React, { useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  buildCalendarMonthCells,
  CALENDAR_MONTH_NAMES,
  CALENDAR_WEEKDAY_LABELS,
  formatDisplayDate,
  getTodayIsoDate,
  parseIsoCalendarParts,
  shiftCalendarMonth,
} from '@farmdb/core';
import { MOBILE_APP_ICONS } from '../assets/icons';
import { FARMDB_COLORS, FARMDB_FONTS, useUiScale } from '../theme/uiScale';
import { AppIcon } from './FarmIcons';
import { FarmScrollView } from './FarmScrollView';

interface ModernDatePickerProps {
  value: string;
  onChange: (nextIsoDate: string) => void;
  title?: string;
  placeholder?: string;
  allowClear?: boolean;
  accessibilityLabel?: string;
}

export function ModernDatePicker({
  value,
  onChange,
  title = 'Select Date',
  placeholder = 'Select date...',
  allowClear = false,
  accessibilityLabel,
}: ModernDatePickerProps) {
  const ui = useUiScale();
  const todayIso = getTodayIsoDate();
  const initialParts =
    parseIsoCalendarParts(value) ?? parseIsoCalendarParts(todayIso)!;

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initialParts.year);
  const [viewMonth, setViewMonth] = useState(initialParts.monthIndex);

  const cells = useMemo(
    () => buildCalendarMonthCells(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const weeks = useMemo(() => {
    const rows = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }
    return rows;
  }, [cells]);

  const hasValidDate = Boolean(parseIsoCalendarParts(value));
  const formattedTrigger = hasValidDate
    ? formatDisplayDate(value, ui.settings.dateFormat)
    : placeholder;

  function handleOpen() {
    const target =
      parseIsoCalendarParts(value) ?? parseIsoCalendarParts(getTodayIsoDate())!;
    setViewYear(target.year);
    setViewMonth(target.monthIndex);
    setOpen(true);
  }

  function stepMonth(delta: number) {
    const next = shiftCalendarMonth(viewYear, viewMonth, delta);
    setViewYear(next.year);
    setViewMonth(next.monthIndex);
  }

  return (
    <>
      <Pressable
        accessibilityLabel={accessibilityLabel ?? title}
        style={[
          styles.trigger,
          {
            minHeight: ui.controlHeight,
            borderRadius: Math.max(10, ui.radius - 2),
            paddingHorizontal: ui.space(12),
            paddingVertical: ui.space(6),
          },
        ]}
        onPress={handleOpen}
      >
        <View style={styles.triggerLeft}>
          <Image
            source={MOBILE_APP_ICONS.calendar}
            style={{
              width: ui.font(18),
              height: ui.font(18),
            }}
            resizeMode="contain"
          />
          <Text
            style={[
              styles.triggerLabel,
              {
                fontSize: ui.font(14),
                fontFamily: hasValidDate
                  ? FARMDB_FONTS.mono
                  : FARMDB_FONTS.regular,
                color: hasValidDate
                  ? FARMDB_COLORS.text
                  : FARMDB_COLORS.textMuted,
              },
            ]}
            numberOfLines={2}
          >
            {formattedTrigger}
          </Text>
        </View>
        <AppIcon
          name="chevronDown"
          size={ui.font(16)}
          color={FARMDB_COLORS.textMuted}
        />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />
          <SafeAreaView
            style={styles.sheetSafeWrap}
            edges={['top', 'bottom', 'left', 'right']}
          >
            <View
              style={[
                styles.sheetCard,
                {
                  borderRadius: Math.max(16, ui.radius + 2),
                  maxHeight: Math.min(ui.height * 0.88, 540),
                },
              ]}
            >
              <View
                style={[
                  styles.sheetHeader,
                  {
                    paddingHorizontal: ui.space(16),
                    paddingVertical: ui.space(12),
                  },
                ]}
              >
                <View style={styles.sheetTitleLeft}>
                  <Image
                    source={MOBILE_APP_ICONS.calendar}
                    style={{ width: ui.font(20), height: ui.font(20) }}
                    resizeMode="contain"
                  />
                  <Text
                    style={[
                      styles.sheetTitle,
                      { fontSize: ui.font(16), fontFamily: FARMDB_FONTS.bold },
                    ]}
                    numberOfLines={2}
                  >
                    {title}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setOpen(false)}
                  hitSlop={10}
                  accessibilityLabel="Close calendar"
                  style={styles.sheetCloseBtn}
                >
                  <AppIcon name="close" size={ui.font(17)} />
                </Pressable>
              </View>

              <FarmScrollView
                fillParent={false}
                surfaceTone="card"
                contentContainerStyle={{
                  padding: ui.space(12),
                  gap: ui.space(10),
                }}
              >
                <View style={[styles.navBar, { flexWrap: 'wrap', rowGap: 6 }]}>
                  <View style={styles.navGroup}>
                    <Pressable
                      accessibilityLabel="Previous year"
                      style={[
                        styles.navBtn,
                        {
                          minWidth: Math.max(36, ui.space(36)),
                          minHeight: Math.max(34, ui.chipHeight - 2),
                          paddingHorizontal: ui.space(7),
                        },
                      ]}
                      onPress={() => stepMonth(-12)}
                    >
                      <Text
                        style={[
                          styles.yearBtnText,
                          { fontSize: ui.font(11) },
                        ]}
                      >
                        -1Y
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityLabel="Previous month"
                      style={[
                        styles.navBtn,
                        {
                          minWidth: Math.max(36, ui.space(34)),
                          minHeight: Math.max(34, ui.chipHeight - 2),
                        },
                      ]}
                      onPress={() => stepMonth(-1)}
                    >
                      <AppIcon
                        name="chevronLeft"
                        size={ui.font(16)}
                        color={FARMDB_COLORS.text}
                      />
                    </Pressable>
                  </View>

                  <Text
                    style={[
                      styles.monthLabel,
                      { fontSize: ui.font(15), minWidth: 100 },
                    ]}
                    numberOfLines={2}
                  >
                    {CALENDAR_MONTH_NAMES[viewMonth]} {viewYear}
                  </Text>

                  <View style={styles.navGroup}>
                    <Pressable
                      accessibilityLabel="Next month"
                      style={[
                        styles.navBtn,
                        {
                          minWidth: Math.max(36, ui.space(34)),
                          minHeight: Math.max(34, ui.chipHeight - 2),
                        },
                      ]}
                      onPress={() => stepMonth(1)}
                    >
                      <AppIcon
                        name="chevronRight"
                        size={ui.font(16)}
                        color={FARMDB_COLORS.text}
                      />
                    </Pressable>
                    <Pressable
                      accessibilityLabel="Next year"
                      style={[
                        styles.navBtn,
                        {
                          minWidth: Math.max(36, ui.space(36)),
                          minHeight: Math.max(34, ui.chipHeight - 2),
                          paddingHorizontal: ui.space(7),
                        },
                      ]}
                      onPress={() => stepMonth(12)}
                    >
                      <Text
                        style={[
                          styles.yearBtnText,
                          { fontSize: ui.font(11) },
                        ]}
                      >
                        +1Y
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.weekdayRow}>
                  {CALENDAR_WEEKDAY_LABELS.map((wd) => (
                    <View key={wd} style={styles.dayCellWrap}>
                      <Text
                        style={[
                          styles.weekdayText,
                          { fontSize: ui.font(11) },
                        ]}
                      >
                        {wd}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={{ gap: 4 }}>
                  {weeks.map((week, rowIdx) => (
                    <View key={`wk-${rowIdx}`} style={styles.weekRow}>
                      {week.map((cell) => {
                        const isSelected = cell.iso === value;
                        const isToday = cell.iso === todayIso;
                        return (
                          <View key={cell.iso} style={styles.dayCellWrap}>
                            <Pressable
                              accessibilityLabel={cell.iso}
                              style={[
                                styles.dayBtn,
                                {
                                  minHeight: Math.max(34, ui.font(13) + 18),
                                },
                                isToday && styles.dayBtnToday,
                                isSelected && styles.dayBtnSelected,
                              ]}
                              onPress={() => {
                                onChange(cell.iso);
                                setOpen(false);
                              }}
                            >
                              <Text
                                style={[
                                  styles.dayText,
                                  { fontSize: ui.font(13) },
                                  !cell.inCurrentMonth && styles.dayTextOutside,
                                  isToday && styles.dayTextToday,
                                  isSelected && styles.dayTextSelected,
                                ]}
                              >
                                {cell.dayNumber}
                              </Text>
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>

                <View style={[styles.footerRow, { flexWrap: 'wrap' }]}>
                  <Pressable
                    style={[
                      styles.footerBtn,
                      styles.todayBtn,
                      { minHeight: ui.chipHeight },
                    ]}
                    onPress={() => {
                      const nowIso = getTodayIsoDate();
                      onChange(nowIso);
                      setOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.todayBtnText,
                        { fontSize: ui.font(13) },
                      ]}
                    >
                      Today
                    </Text>
                  </Pressable>
                  {allowClear && hasValidDate ? (
                    <Pressable
                      style={[
                        styles.footerBtn,
                        styles.clearBtn,
                        { minHeight: ui.chipHeight },
                      ]}
                      onPress={() => {
                        onChange('');
                        setOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.clearBtnText,
                          { fontSize: ui.font(13) },
                        ]}
                      >
                        Clear
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </FarmScrollView>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: FARMDB_COLORS.cardAlt,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  triggerLabel: {
    flexShrink: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(23, 39, 29, 0.48)',
    justifyContent: 'center',
    padding: 16,
  },
  sheetSafeWrap: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  sheetCard: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    overflow: 'hidden',
    shadowColor: FARMDB_COLORS.darkHeader,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: FARMDB_COLORS.surfaceMuted,
    backgroundColor: FARMDB_COLORS.cardAlt,
  },
  sheetTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  sheetTitle: {
    color: FARMDB_COLORS.darkHeader,
    flexShrink: 1,
  },
  sheetCloseBtn: {
    padding: 4,
    borderRadius: 999,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  navGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    backgroundColor: FARMDB_COLORS.cardAlt,
  },
  yearBtnText: {
    fontFamily: FARMDB_FONTS.monoBold,
    color: FARMDB_COLORS.accentHover,
  },
  monthLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.darkHeader,
  },
  weekdayRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayCellWrap: {
    width: '14.2857%',
    paddingHorizontal: 2,
  },
  weekdayText: {
    textAlign: 'center',
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.textMuted,
    paddingVertical: 4,
  },
  dayBtn: {
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayBtnToday: {
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderColor: FARMDB_COLORS.accent,
  },
  dayBtnSelected: {
    backgroundColor: FARMDB_COLORS.accent,
    borderColor: FARMDB_COLORS.accent,
  },
  dayText: {
    fontFamily: FARMDB_FONTS.medium,
    color: FARMDB_COLORS.text,
  },
  dayTextOutside: {
    opacity: 0.42,
  },
  dayTextToday: {
    color: FARMDB_COLORS.accentHover,
    fontFamily: FARMDB_FONTS.bold,
  },
  dayTextSelected: {
    color: '#ffffff',
    fontFamily: FARMDB_FONTS.bold,
    opacity: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: FARMDB_COLORS.surfaceMuted,
  },
  footerBtn: {
    flex: 1,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  todayBtn: {
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1,
    borderColor: '#cce3d6',
  },
  todayBtnText: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.accentHover,
  },
  clearBtn: {
    backgroundColor: FARMDB_COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
  },
  clearBtnText: {
    fontFamily: FARMDB_FONTS.semibold,
    color: FARMDB_COLORS.text,
  },
});
