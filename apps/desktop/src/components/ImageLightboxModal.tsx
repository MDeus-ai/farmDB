import { useEffect } from 'react';
import { APP_ICONS } from '../assets/icons';

interface ImageLightboxModalProps {
  open: boolean;
  src: string | null | undefined;
  title?: string;
  subtitle?: string;
  caption?: string;
  onClose: () => void;
}

/**
 * Full-screen image viewer overlay for inspecting animal profile and preview photos
 * without cropping.
 */
export function ImageLightboxModal({
  open,
  src,
  title,
  subtitle,
  caption,
  onClose,
}: ImageLightboxModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open || !src) {
    return null;
  }

  return (
    <div
      className="image-lightbox-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title ? `${title} image preview` : 'Animal image viewer'}
      onClick={onClose}
    >
      <div
        className="image-lightbox-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="image-lightbox-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexWrap: 'wrap' }}>
            {title && (
              <strong style={{ fontSize: '1.05rem', color: 'var(--text)' }}>
                {title}
              </strong>
            )}
            {subtitle && <span className="tag-chip">{subtitle}</span>}
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Close image viewer"
          >
            <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
            Close
          </button>
        </div>

        <div className="image-lightbox-stage">
          <img
            src={src}
            alt={title ?? 'Animal photo'}
            className="image-lightbox-img"
          />
        </div>

        {caption && (
          <p className="image-lightbox-caption" title={caption}>
            {caption}
          </p>
        )}
      </div>
    </div>
  );
}
