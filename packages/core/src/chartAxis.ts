/**
 * Formats numeric Y-axis values compactly (e.g. `1.5k`, `2.4M`) so large
 * currencies, livestock headcounts, and volumes never clip on chart axes.
 */
export function formatCompactAxisNumber(
  raw: number | string,
  decimalsWhenSmall = 0
): string {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    return String(raw);
  }
  const abs = Math.abs(n);
  if (abs === 0) {
    return '0';
  }
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (abs >= 10_000) {
    return `${sign}${Math.round(abs / 1_000)}k`;
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  if (abs >= 100 || decimalsWhenSmall <= 0) {
    return `${sign}${Math.round(abs)}`;
  }
  const formatted = abs
    .toFixed(decimalsWhenSmall)
    .replace(/(\.\d*?[1-9])0+$/, '$1')
    .replace(/\.0+$/, '');
  return `${sign}${formatted}`;
}

/**
 * Truncates long category labels cleanly while preserving trailing `(TAG)`
 * identifiers whenever space permits.
 */
export function formatCategoryAxisLabel(label: string, maxChars = 24): string {
  const clean = label.trim();
  if (clean.length <= maxChars) {
    return clean;
  }
  if (maxChars <= 3) {
    return `${clean.slice(0, Math.max(1, maxChars))}…`;
  }

  const tagMatch = /^(.*?)\s+(\([^()]+\))$/.exec(clean);
  if (tagMatch) {
    const namePart = tagMatch[1] ?? '';
    const tagPart = tagMatch[2] ?? '';
    const availableNameChars = maxChars - tagPart.length - 2; // space + ellipsis
    if (availableNameChars >= 3) {
      return `${namePart.slice(0, availableNameChars).trimEnd()}… ${tagPart}`;
    }
  }

  return `${clean.slice(0, maxChars - 1).trimEnd()}…`;
}

const NARROW_AXIS_CHARS = new Set('iljtfrI.,:;|!()1 '.split(''));
const WIDE_AXIS_CHARS = new Set('WMmwQGOD@%#'.split(''));

/**
 * Estimates rendered text width in pixels without requiring a DOM canvas,
 * weighting wide uppercase glyphs (`W`, `M`) and narrow glyphs cleanly.
 */
export function estimateTextWidthPx(text: string, fontSize = 11): number {
  let units = 0;
  for (const ch of text) {
    if (NARROW_AXIS_CHARS.has(ch)) {
      units += 0.36;
    } else if (WIDE_AXIS_CHARS.has(ch)) {
      units += 0.88;
    } else if (ch >= 'A' && ch <= 'Z') {
      units += 0.7;
    } else if (ch >= '0' && ch <= '9') {
      units += 0.6;
    } else {
      units += 0.56;
    }
  }
  return Math.ceil(units * fontSize * 1.06);
}

/**
 * Produces representative tick values (including fractional midpoints) from
 * a chart series so dynamic Y-axis width sizing covers worst-case ticks.
 */
export function buildSampleAxisNumbers(values: readonly number[]): number[] {
  let maxVal = 0;
  let minVal = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v > maxVal) maxVal = v;
    if (v < minVal) minVal = v;
  }
  if (maxVal === 0 && minVal === 0) {
    return [0];
  }
  return [minVal, 0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal, maxVal * 1.15];
}

/**
 * Shrinks a category axis label cleanly using `formatCategoryAxisLabel` until
 * its measured pixel width fits within `maxTextWidthPx`.
 */
export function fitCategoryLabelToWidth(
  label: string,
  maxTextWidthPx: number,
  measureWidthPx: (text: string) => number
): string {
  const clean = label.trim();
  if (measureWidthPx(clean) <= maxTextWidthPx) {
    return clean;
  }
  for (let limit = clean.length - 1; limit >= 4; limit -= 1) {
    const candidate = formatCategoryAxisLabel(clean, limit);
    if (measureWidthPx(candidate) <= maxTextWidthPx) {
      return candidate;
    }
  }
  return formatCategoryAxisLabel(clean, 4);
}
