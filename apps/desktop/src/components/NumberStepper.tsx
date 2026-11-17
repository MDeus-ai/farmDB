import { useCallback, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface NumberStepperProps {
  id?: string;
  value: string;
  onChange: (nextValue: string) => void;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  placeholder?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  disabled?: boolean;
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

export function NumberStepper({
  id,
  value,
  onChange,
  min,
  max,
  step = 1,
  decimals,
  placeholder,
  ariaLabel,
  autoFocus = false,
  disabled = false,
  compact = false,
}: NumberStepperProps) {
  const latestValueRef = useRef(value);
  latestValueRef.current = value;

  const holdDelayRef = useRef<number | null>(null);
  const holdIntervalRef = useRef<number | null>(null);

  const stopRepeating = useCallback(() => {
    if (holdDelayRef.current !== null) {
      window.clearTimeout(holdDelayRef.current);
      holdDelayRef.current = null;
    }
    if (holdIntervalRef.current !== null) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }, []);

  useEffect(() => stopRepeating, [stopRepeating]);

  const applyStep = useCallback(
    (direction: 1 | -1) => {
      if (disabled) return;
      const parsed = Number(latestValueRef.current);
      const base = Number.isFinite(parsed)
        ? parsed
        : min !== undefined && direction > 0
          ? min - step
          : min ?? 0;

      const precision = decimals ?? countDecimals(step);
      const nextRaw = base + direction * step;
      const formatted = clampAndFormat(nextRaw, min, max, precision);
      latestValueRef.current = formatted;
      onChange(formatted);
    },
    [decimals, disabled, max, min, onChange, step]
  );

  const startRepeating = useCallback(
    (direction: 1 | -1) => {
      if (disabled) return;
      stopRepeating();
      applyStep(direction);
      holdDelayRef.current = window.setTimeout(() => {
        holdIntervalRef.current = window.setInterval(() => {
          applyStep(direction);
        }, 85);
      }, 380);
    },
    [applyStep, disabled, stopRepeating]
  );

  const parsedNum = Number(value);
  const atMax =
    max !== undefined && Number.isFinite(parsedNum) && parsedNum >= max;
  const atMin =
    min !== undefined && Number.isFinite(parsedNum) && parsedNum <= min;

  return (
    <div
      className={`number-stepper ${compact ? 'is-compact' : ''} ${
        disabled ? 'is-disabled' : ''
      }`}
    >
      <input
        id={id}
        type="text"
        inputMode="decimal"
        className="number-stepper-input"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            applyStep(1);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            applyStep(-1);
          }
        }}
      />
      <div className="number-stepper-controls">
        <button
          type="button"
          className="number-stepper-btn is-up"
          aria-label={`Increase ${ariaLabel ?? 'value'}`}
          disabled={disabled || atMax}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            startRepeating(1);
          }}
          onPointerUp={stopRepeating}
          onPointerLeave={stopRepeating}
          onPointerCancel={stopRepeating}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              applyStep(1);
            }
          }}
        >
          <ChevronUp size={13} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          className="number-stepper-btn is-down"
          aria-label={`Decrease ${ariaLabel ?? 'value'}`}
          disabled={disabled || atMin}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            startRepeating(-1);
          }}
          onPointerUp={stopRepeating}
          onPointerLeave={stopRepeating}
          onPointerCancel={stopRepeating}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              applyStep(-1);
            }
          }}
        >
          <ChevronDown size={13} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
