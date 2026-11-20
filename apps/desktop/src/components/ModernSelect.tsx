import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
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
  tooltip?: string;
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
  showSelectedHint?: boolean;
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
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const { openPreview } = useAnimalQuickPreview();
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
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

  const updatePopoverPosition = useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const maxWidth = Math.min(380, window.innerWidth - 24);
    const width = Math.min(maxWidth, Math.max(rect.width, 260));
    const left = Math.min(
      Math.max(12, rect.left),
      Math.max(12, window.innerWidth - width - 12)
    );
    const top = rect.bottom + 6;
    const maxHeight = Math.max(
      110,
      Math.min(340, window.innerHeight - top - 12)
    );
    setPopoverStyle({ top, left, width, maxHeight });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setQuery('');
      setPopoverStyle(null);
      return;
    }

    updatePopoverPosition();

    function handleResize() {
      updatePopoverPosition();
    }

    function handleScroll(event: Event) {
      if (
        popoverRef.current &&
        event.target instanceof Node &&
        popoverRef.current.contains(event.target)
      ) {
        return;
      }
      updatePopoverPosition();
    }

    window.addEventListener('resize', handleResize);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [open, updatePopoverPosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.quick-preview-backdrop, .image-lightbox-backdrop')) {
        return;
      }
      if (
        (rootRef.current && rootRef.current.contains(target as Node)) ||
        (popoverRef.current && popoverRef.current.contains(target as Node))
      ) {
        return;
      }
      setOpen(false);
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
        data-farm-hint={selected?.tooltip ?? selected?.hint ?? undefined}
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

      {open &&
        popoverStyle &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            className="modern-select-popover"
            role="listbox"
            aria-label={ariaLabel}
            style={{
              top: `${popoverStyle.top}px`,
              left: `${popoverStyle.left}px`,
              width: `${popoverStyle.width}px`,
              maxHeight: `${popoverStyle.maxHeight}px`,
            }}
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
                        data-farm-hint={opt.tooltip ?? opt.hint ?? undefined}
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
                          <span className="modern-select-option-label">
                            {opt.label}
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
          </div>,
          document.body
        )}
    </div>
  );
}
