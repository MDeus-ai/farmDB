import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FARMDB_COLORS, FARMDB_FONTS, useUiScale } from '../theme/uiScale';
import { AppIcon, type AppIconName } from './FarmIcons';

export interface MobileFileTabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: AppIconName;
}

interface MobileFileTabsProps<T extends string> {
  tabs: readonly MobileFileTabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  surfaceTone?: 'page' | 'surface';
}

/** Folder-style tab strip matching the desktop file-tabs design. */
export function MobileFileTabs<T extends string>({
  tabs,
  activeId,
  onChange,
  surfaceTone = 'page',
}: MobileFileTabsProps<T>) {
  const ui = useUiScale();
  const activeBg =
    surfaceTone === 'surface' ? FARMDB_COLORS.surface : FARMDB_COLORS.bg;
  const compactMultiTab = tabs.length >= 3 && (ui.isLargeText || ui.isCramped);

  return (
    <View style={styles.barRow}>
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[
              styles.tab,
              active
                ? [styles.tabActive, { backgroundColor: activeBg }]
                : styles.tabInactive,
              {
                minHeight: Math.max(36, ui.chipHeight - 2),
                paddingHorizontal: ui.space(6),
                paddingVertical: ui.space(6),
                flexDirection: compactMultiTab ? 'column' : 'row',
              },
            ]}
            onPress={() => onChange(tab.id)}
          >
            {tab.icon ? (
              <AppIcon
                name={tab.icon}
                size={ui.font(14)}
                color={active ? FARMDB_COLORS.accent : FARMDB_COLORS.textMuted}
              />
            ) : null}
            <Text
              style={[
                styles.label,
                active && styles.labelActive,
                { fontSize: ui.font(11.5), textAlign: 'center' },
              ]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              maxFontSizeMultiplier={1.2}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: FARMDB_COLORS.border,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  tabInactive: {
    marginTop: 4,
    paddingTop: 6,
    paddingBottom: 7,
    backgroundColor: '#eae4d7',
    borderColor: '#d8d1c2',
  },
  tabActive: {
    marginTop: 0,
    marginBottom: -1.5,
    paddingTop: 8,
    paddingBottom: 9,
    backgroundColor: FARMDB_COLORS.bg,
    borderColor: FARMDB_COLORS.border,
    borderTopWidth: 3,
    borderTopColor: FARMDB_COLORS.accent,
  },
  label: {
    fontFamily: FARMDB_FONTS.semibold,
    color: FARMDB_COLORS.textMuted,
    flexShrink: 1,
  },
  labelActive: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.accent,
  },
});
