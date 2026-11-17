import {
  buildSampleAxisNumbers,
  estimateTextWidthPx,
  fitCategoryLabelToWidth,
} from '@farmdb/core';

let cachedCtx: CanvasRenderingContext2D | null | undefined;

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (cachedCtx !== undefined) {
    return cachedCtx;
  }
  if (typeof document === 'undefined') {
    cachedCtx = null;
    return null;
  }
  const canvas = document.createElement('canvas');
  cachedCtx = canvas.getContext('2d');
  return cachedCtx;
}

/**
 * Measures rendered tick width using the browser's 2D canvas context
 * (falling back to character-weighted estimation) with a modest safety margin.
 */
export function measureDesktopTextPx(text: string, fontSize = 11): number {
  const fallback = estimateTextWidthPx(text, fontSize);
  const ctx = getMeasureCtx();
  if (!ctx) {
    return fallback;
  }
  ctx.font = `500 ${fontSize}px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  const measured = Math.ceil(ctx.measureText(text).width * 1.05);
  return Math.max(measured, Math.round(fallback * 0.92));
}

export interface DesktopCategoryYAxisSpec {
  width: number;
  formatTick: (label: string) => string;
}

/**
 * Sizes a horizontal bar chart's category Y-axis to fit labels cleanly up to
 * `maxWidth`, gracefully truncating only extreme outliers with `…`.
 */
export function computeDesktopCategoryYAxis(
  labels: readonly string[],
  options?: {
    fontSize?: number;
    minWidth?: number;
    maxWidth?: number;
    axisOverheadPx?: number;
  }
): DesktopCategoryYAxisSpec {
  const fontSize = options?.fontSize ?? 11;
  const minWidth = options?.minWidth ?? 96;
  const maxWidth = options?.maxWidth ?? 210;
  // Recharts tickSize (6px) + tickMargin (2px) + generous left safety padding
  const axisOverheadPx = options?.axisOverheadPx ?? 20;

  let maxMeasuredTextPx = 0;
  for (const label of labels) {
    const w = measureDesktopTextPx(label.trim(), fontSize);
    if (w > maxMeasuredTextPx) {
      maxMeasuredTextPx = w;
    }
  }

  const width = Math.max(
    minWidth,
    Math.min(maxWidth, Math.ceil(maxMeasuredTextPx + axisOverheadPx))
  );
  const textBudgetPx = Math.max(48, width - axisOverheadPx);

  return {
    width,
    formatTick: (raw: string) =>
      fitCategoryLabelToWidth(raw, textBudgetPx, (t) =>
        measureDesktopTextPx(t, fontSize)
      ),
  };
}

/**
 * Computes a safe Recharts `<YAxis width>` for numeric values formatted by
 * `formatTick` so large figures (e.g. UGX millions or `gal` yields) never clip.
 */
export function computeDesktopNumericYAxisWidth(
  values: readonly number[],
  formatTick: (value: number) => string,
  options?: {
    fontSize?: number;
    minWidth?: number;
    maxWidth?: number;
    axisOverheadPx?: number;
  }
): number {
  const fontSize = options?.fontSize ?? 11;
  const minWidth = options?.minWidth ?? 38;
  const maxWidth = options?.maxWidth ?? 94;
  const axisOverheadPx = options?.axisOverheadPx ?? 18;

  const samples = buildSampleAxisNumbers(values);
  let maxTextPx = 0;
  for (const sample of samples) {
    const w = measureDesktopTextPx(formatTick(sample), fontSize);
    if (w > maxTextPx) {
      maxTextPx = w;
    }
  }

  return Math.max(
    minWidth,
    Math.min(maxWidth, Math.ceil(maxTextPx + axisOverheadPx))
  );
}
