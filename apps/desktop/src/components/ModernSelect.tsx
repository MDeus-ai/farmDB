import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Eye } from 'lucide-react';
import type { LivestockStatus } from '@farmdb/core';
import { useAnimalQuickPreview } from './AnimalQuickPreviewModal';

export interface SelectOptionPreview {
  animalId?: string;
  title: string;
  tagNumber?: string;
  subtitle?: string;
  status?: LivestockStatus;
  statusLabel?: string;
  ageText?: string;
  dobText?: string;
  imageSrc?: string | null;
  fallbackIconSrc?: string | null;
}

export interface ModernSelectOption<T extends string = string> {
  value: T;
  label: string;
  iconSrc?: string | null;
  hint?: string;
  preview?: SelectOptionPreview;
}

interface ModernSelectProps<T extends string = string> {
  id?: string;
  value: T;
  options: readonly ModernSelectOption<T>[];
  onChange: (nextValue: T) => void;
  ariaLabel?: string;
  placeholder?: string;
  searchable?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
}

export function ModernSelect<T extends string = string>({
  id,
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = 'Select...',
  searchable = false,
  fullWidth = false,
  disabled = false,
}: ModernSelectProps<T>) {
  const autoId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { openPreview } = useAnimalQuickPreview();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.hint && opt.hint.toLowerCase().includes(q)) ||
        (opt.preview?.subtitle &&
          opt.preview.subtitle.toLowerCase().includes(q))
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }

    function handleOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.quick-preview-backdrop, .image-lightbox-backdrop')) {
        return;
      }
      if (rootRef.current && !rootRef.current.contains(target as Node)) {
        setOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (document.querySelector('.quick-preview-backdrop, .image-lightbox-backdrop')) {
          return;
        }
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

  const showSearch = searchable || options.length > 8;
  const triggerThumbSrc = selected?.preview?.imageSrc ?? selected?.iconSrc;

  return (
    <div
      ref={rootRef}
      className={`modern-select ${fullWidth ? 'full-width' : ''} ${
        open ? 'is-open' : ''
      }`}
    >
      <button
        id={id ?? autoId}
        type="button"
        className="modern-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="modern-select-value">
          {triggerThumbSrc && (
            <img
              src={triggerThumbSrc}
              alt=""
              className={
                selected?.preview?.imageSrc
                  ? 'modern-select-thumb'
                  : 'modern-select-icon'
              }
            />
          )}
          <span className="modern-select-label">
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`modern-select-chevron ${open ? 'rotated' : ''}`}
        />
      </button>

      {open && (
        <div
          className="modern-select-popover"
          role="listbox"
          aria-label={ariaLabel}
        >
          {showSearch && (
            <div className="modern-select-search">
              <input
                type="text"
                className="input modern-select-search-input"
                placeholder="Filter options..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
          )}

          <div className="modern-select-list">
            {filteredOptions.length === 0 ? (
              <div className="modern-select-empty">No matching options</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                const rowImgSrc = opt.preview?.imageSrc ?? opt.iconSrc;
                const previewAnimalId = opt.preview?.animalId;
                return (
                  <div
                    key={opt.value}
                    className={`modern-select-option-row ${
                      isSelected ? 'selected' : ''
                    }`}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`modern-select-option ${
                        isSelected ? 'selected' : ''
                      }`}
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                    >
                      <span className="modern-select-option-left">
                        {rowImgSrc && (
                          <img
                            src={rowImgSrc}
                            alt=""
                            className={
                              opt.preview?.imageSrc
                                ? 'modern-select-thumb'
                                : 'modern-select-icon'
                            }
                          />
                        )}
                        <span>
                          <span className="modern-select-option-label">
                            {opt.label}
                          </span>
                          {opt.hint && (
                            <span className="modern-select-option-hint">
                              {opt.hint}
                            </span>
                          )}
                        </span>
                      </span>
                      {isSelected && (
                        <Check size={15} color="#2d6a4f" strokeWidth={2.5} />
                      )}
                    </button>

                    {previewAnimalId && (
                      <button
                        type="button"
                        className="modern-select-option-eye"
                        title={`Quick preview ${opt.preview?.title ?? opt.label}`}
                        aria-label={`Quick preview ${opt.preview?.title ?? opt.label}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openPreview(previewAnimalId);
                        }}
                      >
                        <Eye size={14} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
