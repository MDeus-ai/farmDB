import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { FARMDB_COLORS, FARMDB_FONTS, useUiScale } from '../theme/uiScale';
import { AppIcon } from './FarmIcons';

interface MobileNumberStepperProps {
  value: string;
  onChangeText: (nextValue: string) => void;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  placeholder?: string;
  keyboardType?: 'decimal-pad' | 'number-pad';
  accessibilityLabel?: string;
  compact?: boolean;
}

function countDecimals(num: number): number {
  if (!Number.isFinite(num) || Math.floor(num) === num) return 0;
  const text = num.toString();
  const expIdx = text.indexOf('e-');
  if (expIdx !== -1) {
    return Number(text.slice(expIdx + 2)) || 0;
  }
  const dotIdx = text.indexOf('.');
  return dotIdx === -1 ? 0 : text.length - dotIdx - 1;
}

function clampAndFormat(
  raw: number,
  min?: number,
  max?: number,
  decimals = 0
): string {
  let next = raw;
  if (min !== undefined && next < min) next = min;
  if (max !== undefined && next > max) next = max;
  const factor = Math.pow(10, decimals);
  next = Math.round((next + Number.EPSILON) * factor) / factor;
  if (min !== undefined && next < min) next = min;
  if (max !== undefined && next > max) next = max;
  return decimals > 0 ? next.toFixed(decimals) : String(Math.round(next));
}

export function MobileNumberStepper({
  value,
  onChangeText,
  min,
  max,
  step = 1,
  decimals,
  placeholder,
  keyboardType = 'decimal-pad',
  accessibilityLabel,
  compact = false,
}: MobileNumberStepperProps) {
  const ui = useUiScale();
  const latestRef = useRef(value);
  latestRef.current = value;

  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopRepeating = useCallback(() => {
    if (delayTimerRef.current) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
    if (repeatTimerRef.current) {
      clearInterval(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
  }, []);

  useEffect(() => stopRepeating, [stopRepeating]);

  const applyStep = useCallback(
    (direction: 1 | -1) => {
      const parsed = Number(latestRef.current);
      const base = Number.isFinite(parsed)
        ? parsed
        : min !== undefined && direction > 0
          ? min - step
          : min ?? 0;

      const precision = decimals ?? countDecimals(step);
      const formatted = clampAndFormat(
        base + direction * step,
        min,
        max,
        precision
      );
      latestRef.current = formatted;
      onChangeText(formatted);
    },
    [decimals, max, min, onChangeText, step]
  );

  const startRepeating = useCallback(
    (direction: 1 | -1) => {
      stopRepeating();
      applyStep(direction);
      delayTimerRef.current = setTimeout(() => {
        repeatTimerRef.current = setInterval(() => {
          applyStep(direction);
        }, 90);
      }, 380);
    },
    [applyStep, stopRepeating]
  );

  const parsedNum = Number(value);
  const atMax =
    max !== undefined && Number.isFinite(parsedNum) && parsedNum >= max;
  const atMin =
    min !== undefined && Number.isFinite(parsedNum) && parsedNum <= min;

  const dockWidth = Math.max(
    compact ? 34 : 38,
    Math.round(ui.font(compact ? 13 : 14) * 2.5)
  );
  const iconSize = ui.font(compact ? 13 : 14);
  const stepMinHeight = Math.max(20, Math.round(ui.controlHeight / 2));

  return (
    <View
      style={[
        styles.wrapper,
        {
          minHeight: ui.controlHeight,
          borderRadius: Math.max(10, ui.radius - 2),
        },
      ]}
    >
      <TextInput
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.input,
          {
            fontSize: ui.font(compact ? 14 : 15),
            paddingHorizontal: ui.space(compact ? 8 : 12),
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={FARMDB_COLORS.textMuted}
      />
      <View style={[styles.controlsDock, { width: dockWidth }]}>
        <Pressable
          accessibilityLabel={`Increase ${accessibilityLabel ?? 'value'}`}
          disabled={atMax}
          onPressIn={() => startRepeating(1)}
          onPressOut={stopRepeating}
          style={({ pressed }) => [
            styles.stepBtn,
            styles.stepBtnUp,
            { minHeight: stepMinHeight },
            pressed && !atMax && styles.stepBtnPressed,
            atMax && styles.stepBtnDisabled,
          ]}
        >
          <AppIcon
            name="chevronUp"
            size={iconSize}
            color={FARMDB_COLORS.accentHover}
            strokeWidth={2.4}
          />
        </Pressable>
        <Pressable
          accessibilityLabel={`Decrease ${accessibilityLabel ?? 'value'}`}
          disabled={atMin}
          onPressIn={() => startRepeating(-1)}
          onPressOut={stopRepeating}
          style={({ pressed }) => [
            styles.stepBtn,
            { minHeight: stepMinHeight },
            pressed && !atMin && styles.stepBtnPressed,
            atMin && styles.stepBtnDisabled,
          ]}
        >
          <AppIcon
            name="chevronDown"
            size={iconSize}
            color={FARMDB_COLORS.accentHover}
            strokeWidth={2.4}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: FARMDB_COLORS.cardAlt,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: FARMDB_FONTS.mono,
    color: FARMDB_COLORS.text,
    paddingVertical: 8,
  },
  controlsDock: {
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderLeftWidth: 1,
    borderLeftColor: FARMDB_COLORS.border,
  },
  stepBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 18,
  },
  stepBtnUp: {
    borderBottomWidth: 1,
    borderBottomColor: '#cce3d6',
  },
  stepBtnPressed: {
    backgroundColor: '#d1e8dc',
  },
  stepBtnDisabled: {
    opacity: 0.35,
  },
});
