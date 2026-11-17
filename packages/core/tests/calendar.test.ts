import { describe, expect, it } from 'vitest';
import {
  buildCalendarMonthCells,
  parseIsoCalendarParts,
  shiftCalendarMonth,
} from '../src/calendar';

describe('calendar helpers', () => {
  it('parses valid ISO dates and rejects invalid calendar dates', () => {
    expect(parseIsoCalendarParts('2026-11-17')).toEqual({
      year: 2026,
      monthIndex: 10,
      day: 17,
    });
    expect(parseIsoCalendarParts('2024-02-29')).toEqual({
      year: 2024,
      monthIndex: 1,
      day: 29,
    });
    expect(parseIsoCalendarParts('2025-02-29')).toBeNull();
    expect(parseIsoCalendarParts('')).toBeNull();
  });

  it('shifts months across year boundaries and builds 42-cell Sunday-first grids', () => {
    expect(shiftCalendarMonth(2026, 0, -1)).toEqual({
      year: 2025,
      monthIndex: 11,
    });
    expect(shiftCalendarMonth(2026, 11, 1)).toEqual({
      year: 2027,
      monthIndex: 0,
    });

    const cells = buildCalendarMonthCells(2026, 10);
    expect(cells).toHaveLength(42);
    expect(cells[0]?.iso).toBe('2026-11-01');
    expect(cells[0]?.inCurrentMonth).toBe(true);
    expect(cells.filter((c) => c.inCurrentMonth)).toHaveLength(30);
  });
});
