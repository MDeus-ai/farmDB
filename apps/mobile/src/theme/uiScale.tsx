import React, { createContext, useContext, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  DEFAULT_FARM_SETTINGS,
  type FarmSettings,
  type FontScale,
  type UiDensity,
} from '@farmdb/core';
import { useFarmSettings } from '@farmdb/db';

export const FARMDB_COLORS = {
  bg: '#f5f3ee',
  surface: '#ffffff',
  surfaceMuted: '#f0ece3',
  cardAlt: '#faf8f4',
  border: '#ddd6c8',
  text: '#1c241e',
  textMuted: '#5d675f',
  accent: '#2d6a4f',
  accentHover: '#214e3a',
  accentSoft: '#e6f2ec',
  darkHeader: '#17271d',
  brandMark: '#40916c',
  warnBg: '#fff6e5',
  warnBorder: '#f0c97a',
  warnText: '#7a4f01',
  danger: '#b42318',
  dangerSoft: '#fdeceb',
  success: '#1b6b3a',
  successSoft: '#e6f5ec',
} as const;

export const FARMDB_FONTS = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
  mono: 'JetBrainsMono_600SemiBold',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

const FONT_SCALE_FACTORS: Record<FontScale, number> = {
  small: 0.88,
  medium: 1.0,
  large: 1.14,
  xlarge: 1.28,
};

const DENSITY_FACTORS: Record<UiDensity, number> = {
  compact: 0.84,
  comfortable: 1.0,
  spacious: 1.22,
};

export type UiPreviewOverrides = Partial<
  Pick<FarmSettings, 'fontScale' | 'uiDensity' | 'mobileIconMode'>
>;

export interface UiScaleContextValue {
  settings: FarmSettings;
  width: number;
  height: number;
  fontMult: number;
  densityMult: number;
  isCompactPhone: boolean;
  isTablet: boolean;
  isLargeText: boolean;
  isLargeDensity: boolean;
  isCramped: boolean;
  statColumns: number;
  contentPadding: number;
  controlHeight: number;
  chipHeight: number;
  thumbSize: number;
  radius: number;
  chartWidth: number;
  bottomDockReserve: number;
  font: (baseSize: number) => number;
  lineHeight: (baseFontSize: number, multiplier?: number) => number;
  space: (baseSpace: number) => number;
  setPreviewOverrides: (overrides: UiPreviewOverrides | null) => void;
}

const UiScaleContext = createContext<UiScaleContextValue | null>(null);

function computeUiScale(
  settings: FarmSettings,
  width: number,
  height: number,
  setPreviewOverrides: (overrides: UiPreviewOverrides | null) => void
): UiScaleContextValue {
  const safeWidth = Math.max(width || 375, 280);
  const isCompactPhone = safeWidth < 360;
  const isTablet = safeWidth >= 600;

  const widthFontFactor = isCompactPhone ? 0.94 : isTablet ? 1.05 : 1.0;
  const fontMult = FONT_SCALE_FACTORS[settings.fontScale] * widthFontFactor;
  const densityMult = DENSITY_FACTORS[settings.uiDensity];
  const isLargeText = FONT_SCALE_FACTORS[settings.fontScale] >= 1.12;
  const isLargeDensity = densityMult >= 1.12;
  const isCramped =
    isCompactPhone || (safeWidth < 430 && (isLargeText || isLargeDensity));

  const contentPadding = isCompactPhone ? 10 : isTablet ? 20 : 12;
  const chartCardPad = Math.round(6 * densityMult);
  const chartWidth = Math.max(
    250,
    Math.min(safeWidth - contentPadding * 2 - chartCardPad * 2, 740)
  );
  const font = (baseSize: number) => Math.max(10, Math.round(baseSize * fontMult));

  return {
    settings,
    width: safeWidth,
    height: height || 667,
    fontMult,
    densityMult,
    isCompactPhone,
    isTablet,
    isLargeText,
    isLargeDensity,
    isCramped,
    statColumns: isTablet ? 4 : 2,
    contentPadding,
    controlHeight: Math.max(Math.round(44 * densityMult), font(15) + 22),
    chipHeight: Math.max(Math.round(36 * densityMult), font(13) + 18),
    thumbSize: Math.round(54 * densityMult),
    radius: settings.uiDensity === 'compact' ? 10 : settings.uiDensity === 'spacious' ? 16 : 14,
    chartWidth,
    bottomDockReserve: Math.round(78 * densityMult + 24 * fontMult),
    font,
    lineHeight: (baseFontSize: number, multiplier = 1.42) =>
      Math.round(font(baseFontSize) * multiplier),
    space: (baseSpace: number) =>
      Math.max(2, Math.round(baseSpace * densityMult * (isCompactPhone ? 0.92 : 1))),
    setPreviewOverrides,
  };
}

const NOOP_SET_PREVIEW = () => {};

export function UiScaleProvider({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const settingsQuery = useFarmSettings();
  const settings = settingsQuery.data ?? DEFAULT_FARM_SETTINGS;
  const [previewOverrides, setPreviewOverrides] =
    useState<UiPreviewOverrides | null>(null);

  const effectiveSettings = useMemo<FarmSettings>(
    () => (previewOverrides ? { ...settings, ...previewOverrides } : settings),
    [settings, previewOverrides]
  );

  const value = useMemo(
    () => computeUiScale(effectiveSettings, width, height, setPreviewOverrides),
    [effectiveSettings, width, height]
  );

  return (
    <UiScaleContext.Provider value={value}>{children}</UiScaleContext.Provider>
  );
}

export function useUiScale(): UiScaleContextValue {
  const ctx = useContext(UiScaleContext);
  const { width, height } = useWindowDimensions();

  return useMemo(
    () =>
      ctx ??
      computeUiScale(DEFAULT_FARM_SETTINGS, width, height, NOOP_SET_PREVIEW),
    [ctx, width, height]
  );
}
