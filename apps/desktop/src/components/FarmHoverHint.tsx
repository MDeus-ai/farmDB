import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface HintState {
  text: string;
  anchorRect: DOMRect;
  pointerX: number;
}

const HOVER_DELAY_MS = 220;

function extractHintElement(rawTarget: EventTarget | null): {
  el: HTMLElement;
  text: string;
} | null {
  if (!(rawTarget instanceof Element)) return null;

  let current: Element | null = rawTarget;
  while (current && current instanceof HTMLElement) {
    const rawTitle = current.getAttribute('title');
    if (rawTitle && rawTitle.trim().length > 0) {
      const trimmed = rawTitle.trim();
      current.setAttribute('data-farm-hint', trimmed);
      current.removeAttribute('title');
      return { el: current, text: trimmed };
    }

    const dataHint = current.getAttribute('data-farm-hint');
    if (dataHint && dataHint.trim().length > 0) {
      return { el: current, text: dataHint.trim() };
    }

    if (
      current.tagName === 'BUTTON' ||
      current.tagName === 'A' ||
      current.getAttribute('role') === 'button' ||
      current.getAttribute('role') === 'tab'
    ) {
      const aria = current.getAttribute('aria-label');
      if (aria && aria.trim().length > 0) {
        const textContent = (current.textContent ?? '').trim();
        if (textContent.length === 0 || current.classList.contains('animal-eye-btn') || current.classList.contains('window-ctrl-btn')) {
          return { el: current, text: aria.trim() };
        }
      }
    }

    current = current.parentElement;
  }

  return null;
}

export function FarmHoverHintOverlay() {
  const [hint, setHint] = useState<HintState | null>(null);
  const timerRef = useRef<number | null>(null);
  const activeElRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function clearScheduled() {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function hideHint() {
      clearScheduled();
      activeElRef.current = null;
      setHint(null);
    }

    function scheduleHint(el: HTMLElement, text: string, pointerX: number) {
      if (activeElRef.current === el && hint?.text === text) {
        return;
      }
      clearScheduled();
      activeElRef.current = el;
      timerRef.current = window.setTimeout(() => {
        if (!el.isConnected) {
          setHint(null);
          return;
        }
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
          setHint(null);
          return;
        }
        setHint({
          text,
          anchorRect: rect,
          pointerX,
        });
      }, HOVER_DELAY_MS);
    }

    function handleMouseOver(e: MouseEvent) {
      const found = extractHintElement(e.target);
      if (!found) {
        hideHint();
        return;
      }
      scheduleHint(found.el, found.text, e.clientX);
    }

    function handleMouseOut(e: MouseEvent) {
      const active = activeElRef.current;
      if (!active) return;
      const related = e.relatedTarget;
      if (related instanceof Node && active.contains(related)) {
        return;
      }
      hideHint();
    }

    function handleFocusIn(e: FocusEvent) {
      const found = extractHintElement(e.target);
      if (!found) return;
      const rect = found.el.getBoundingClientRect();
      scheduleHint(found.el, found.text, rect.left + rect.width / 2);
    }

    function handleFocusOut() {
      hideHint();
    }

    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('focusout', handleFocusOut, true);
    document.addEventListener('mousedown', hideHint, true);
    document.addEventListener('scroll', hideHint, true);
    window.addEventListener('blur', hideHint);

    return () => {
      clearScheduled();
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('focusout', handleFocusOut, true);
      document.removeEventListener('mousedown', hideHint, true);
      document.removeEventListener('scroll', hideHint, true);
      window.removeEventListener('blur', hideHint);
    };
  }, []);

  if (!hint || typeof document === 'undefined') {
    return null;
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxWidth = 280;
  const approxLeft = Math.min(
    Math.max(12, (hint.pointerX || hint.anchorRect.left + hint.anchorRect.width / 2) - 110),
    Math.max(12, vw - maxWidth - 12)
  );
  const placeBelow = hint.anchorRect.bottom + 54 < vh || hint.anchorRect.top < 72;
  const top = placeBelow
    ? Math.min(vh - 44, hint.anchorRect.bottom + 8)
    : Math.max(8, hint.anchorRect.top - 42);

  return createPortal(
    <div
      className="farm-hover-tooltip"
      role="tooltip"
      style={{
        left: `${Math.round(approxLeft)}px`,
        top: `${Math.round(top)}px`,
        maxWidth: `${maxWidth}px`,
      }}
    >
      <span className="farm-hover-tooltip-dot" aria-hidden="true" />
      <span>{hint.text}</span>
    </div>,
    document.body
  );
}
