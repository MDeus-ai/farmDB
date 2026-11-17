import {
  buildSampleAxisNumbers,
  estimateTextWidthPx,
} from '@farmdb/core';

/**
 * Computes `style.paddingRight` (the left Y-axis gutter in `react-native-chart-kit`)
 * so end-anchored tick text (`x = paddingRight - yLabelsOffset`) always clears
 * the left SVG boundary without wasting space.
 */
export function computeMobileYAxisGutter(
  values: readonly number[],
  formatSampleLabel: (value: number) => string,
  options?: {
    fontSize?: number;
    yLabelsOffset?: number;
    minGutter?: number;
    maxGutter?: number;
    leftSafetyPx?: number;
  }
): number {
  const fontSize = options?.fontSize ?? 10.5;
  const yLabelsOffset = options?.yLabelsOffset ?? 8;
  const minGutter = options?.minGutter ?? 38;
  const maxGutter = options?.maxGutter ?? 92;
  const leftSafetyPx = options?.leftSafetyPx ?? 8;

  const samples = buildSampleAxisNumbers(values);
  let maxTextPx = 0;
  for (const sample of samples) {
    const w = estimateTextWidthPx(formatSampleLabel(sample), fontSize);
    if (w > maxTextPx) {
      maxTextPx = w;
    }
  }

  const needed = Math.ceil(maxTextPx + yLabelsOffset + leftSafetyPx);
  return Math.max(minGutter, Math.min(maxGutter, needed));
}
