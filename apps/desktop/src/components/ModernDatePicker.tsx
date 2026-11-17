import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import {
  buildCalendarMonthCells,
  CALENDAR_MONTH_NAMES,
  CALENDAR_WEEKDAY_LABELS,
  DEFAULT_FARM_SETTINGS,
  formatDisplayDate,
  getTodayIsoDate,
  parseIsoCalendarParts,
  shiftCalendarMonth,
} from '@farmdb/core';
import { useFarmSettings } from '@farmdb/db';
import { APP_ICONS } from '../assets/icons';

interface ModernDatePickerProps {
  id?: string;
  value: string;
  onChange: (nextIsoDate: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  allowClear?: boolean;
  disabled?: boolean;
}

export function ModernDatePicker({
  id,
  value,
  onChange,
  placeholder = 'Select date...',
  ariaLabel,
  allowClear = false,
  disabled = false,
}: ModernDatePickerProps) {
  const autoId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const settingsQuery = useFarmSettings();
  const dateFormat =
    settingsQuery.data?.dateFormat ?? DEFAULT_FARM_SETTINGS.dateFormat;

  const todayIso = getTodayIsoDate();
  const initialParts =
    parseIsoCalendarParts(value) ?? parseIsoCalendarParts(todayIso)!;

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initialParts.year);
  const [viewMonth, setViewMonth] = useState(initialParts.monthIndex);

  useEffect(() => {
    if (!open) return;
    const target =
      parseIsoCalendarParts(value) ?? parseIsoCalendarParts(getTodayIsoDate())!;
    setViewYear(target.year);
    setViewMonth(target.monthIndex);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;

    function handleOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const cells = useMemo(
    () => buildCalendarMonthCells(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const hasValidDate = Boolean(parseIsoCalendarParts(value));
  const formattedTrigger = hasValidDate
    ? formatDisplayDate(value, dateFormat)
    : placeholder;

  function stepMonth(delta: number) {
    const next = shiftCalendarMonth(viewYear, viewMonth, delta);
    setViewYear(next.year);
    setViewMonth(next.monthIndex);
  }

  return (
    <div
      ref={rootRef}
      className={`modern-date ${open ? 'is-open' : ''}`}
    >
      <button
        id={id ?? autoId}
        type="button"
        className="modern-date-trigger"
        aria-label={ariaLabel ?? 'Select date'}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="modern-date-value">
          <img
            src={APP_ICONS.calendar}
            alt=""
            className="modern-date-icon"
          />
          <span
            className={`modern-date-label ${
              hasValidDate ? 'has-value' : 'is-placeholder'
            }`}
          >
            {formattedTrigger}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`modern-select-chevron ${open ? 'rotated' : ''}`}
        />
      </button>

      {open && (
        <div
          className="modern-date-popover"
          role="dialog"
          aria-label={ariaLabel ?? 'Calendar picker'}
        >
          <div className="modern-date-header">
            <div className="modern-date-nav-group">
              <button
                type="button"
                className="modern-date-nav-btn"
                aria-label="Previous year"
                onClick={() => stepMonth(-12)}
              >
                <ChevronsLeft size={15} />
              </button>
              <button
                type="button"
                className="modern-date-nav-btn"
                aria-label="Previous month"
                onClick={() => stepMonth(-1)}
              >
                <ChevronLeft size={15} />
              </button>
            </div>

            <span className="modern-date-month-title">
              {CALENDAR_MONTH_NAMES[viewMonth]} {viewYear}
            </span>

            <div className="modern-date-nav-group">
              <button
                type="button"
                className="modern-date-nav-btn"
                aria-label="Next month"
                onClick={() => stepMonth(1)}
              >
                <ChevronRight size={15} />
              </button>
              <button
                type="button"
                className="modern-date-nav-btn"
                aria-label="Next year"
                onClick={() => stepMonth(12)}
              >
                <ChevronsRight size={15} />
              </button>
            </div>
          </div>

          <div className="modern-date-weekdays">
            {CALENDAR_WEEKDAY_LABELS.map((day) => (
              <span key={day} className="modern-date-weekday">
                {day}
              </span>
            ))}
          </div>

          <div className="modern-date-grid">
            {cells.map((cell) => {
              const isSelected = cell.iso === value;
              const isToday = cell.iso === todayIso;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  aria-label={cell.iso}
                  aria-pressed={isSelected}
                  className={[
                    'modern-date-day',
                    !cell.inCurrentMonth ? 'is-outside' : '',
                    isToday ? 'is-today' : '',
                    isSelected ? 'is-selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    onChange(cell.iso);
                    setOpen(false);
                  }}
                >
                  {cell.dayNumber}
                </button>
              );
            })}
          </div>

          <div className="modern-date-footer">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const nowIso = getTodayIsoDate();
                const parts = parseIsoCalendarParts(nowIso)!;
                setViewYear(parts.year);
                setViewMonth(parts.monthIndex);
                onChange(nowIso);
                setOpen(false);
              }}
            >
              Today
            </button>
            {allowClear && hasValidDate && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
