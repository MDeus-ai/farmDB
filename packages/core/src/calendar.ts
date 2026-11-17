export const CALENDAR_WEEKDAY_LABELS = [
  'Su',
  'Mo',
  'Tu',
  'We',
  'Th',
  'Fr',
  'Sa',
] as const;

export const CALENDAR_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export interface CalendarDayCell {
  iso: string;
  dayNumber: number;
  inCurrentMonth: boolean;
}

function padTwo(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatCalendarIsoDate(
  year: number,
  monthIndex: number,
  day: number
): string {
  return `${year}-${padTwo(monthIndex + 1)}-${padTwo(day)}`;
}

export function parseIsoCalendarParts(
  isoDate: string
): { year: number; monthIndex: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, monthIndex: month - 1, day };
}

export function shiftCalendarMonth(
  year: number,
  monthIndex: number,
  deltaMonths: number
): { year: number; monthIndex: number } {
  const dt = new Date(Date.UTC(year, monthIndex + deltaMonths, 1));
  return { year: dt.getUTCFullYear(), monthIndex: dt.getUTCMonth() };
}

export function buildCalendarMonthCells(
  year: number,
  monthIndex: number
): CalendarDayCell[] {
  const firstDayUtc = new Date(Date.UTC(year, monthIndex, 1));
  const leadingOffset = firstDayUtc.getUTCDay();
  const startUtc = new Date(Date.UTC(year, monthIndex, 1 - leadingOffset));

  const cells: CalendarDayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(
      Date.UTC(
        startUtc.getUTCFullYear(),
        startUtc.getUTCMonth(),
        startUtc.getUTCDate() + i
      )
    );
    const cellYear = dt.getUTCFullYear();
    const cellMonth = dt.getUTCMonth();
    const cellDay = dt.getUTCDate();
    cells.push({
      iso: formatCalendarIsoDate(cellYear, cellMonth, cellDay),
      dayNumber: cellDay,
      inCurrentMonth: cellYear === year && cellMonth === monthIndex,
    });
  }
  return cells;
}
