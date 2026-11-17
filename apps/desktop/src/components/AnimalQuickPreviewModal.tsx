import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Eye, Maximize2 } from 'lucide-react';
import {
  buildAnimalPedigree,
  DEFAULT_FARM_SETTINGS,
  formatAnimalAge,
  formatDisplayDate,
  formatSpeciesLabel,
  formatStatusLabel,
  formatVolume,
  roundAmount,
} from '@farmdb/core';
import {
  useAlertList,
  useFarmSettings,
  useLivestockDetail,
  useLivestockList,
  useMedicalRecordList,
  useProductRecordList,
} from '@farmdb/db';
import {
  APP_ICONS,
  getSpeciesPngIcon,
  getStatusPngIcon,
} from '../assets/icons';
import { resolveDesktopImageSrc } from '../services/imageStorage';
import { ImageLightboxModal } from './ImageLightboxModal';

interface AnimalQuickPreviewContextValue {
  openPreview: (livestockId: string) => void;
  closePreview: () => void;
}

const AnimalQuickPreviewContext = createContext<AnimalQuickPreviewContextValue>({
  openPreview: () => {},
  closePreview: () => {},
});

export function useAnimalQuickPreview() {
  return useContext(AnimalQuickPreviewContext);
}

/**
 * Compact eye icon button placed beside livestock references outside Herd Registry
 * to quick-preview full animal details and photo.
 */
export function AnimalEyeButton({
  livestockId,
  title = 'Quick preview livestock',
  size = 14,
}: {
  livestockId: string | null | undefined;
  title?: string;
  size?: number;
}) {
  const { openPreview } = useAnimalQuickPreview();
  if (!livestockId) {
    return null;
  }
  return (
    <button
      type="button"
      className="animal-eye-btn"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        openPreview(livestockId);
      }}
    >
      <Eye size={size} />
    </button>
  );
}

function AnimalQuickPreviewDialog({
  livestockId,
  onSelectAnimal,
  onClose,
}: {
  livestockId: string | null;
  onSelectAnimal: (id: string) => void;
  onClose: () => void;
}) {
  const detailQuery = useLivestockDetail(livestockId);
  const allLivestockQuery = useLivestockList({});
  const productionQuery = useProductRecordList(
    livestockId ? { livestockId } : undefined
  );
  const medicalQuery = useMedicalRecordList(
    livestockId ? { livestockId } : undefined
  );
  const alertsQuery = useAlertList(
    livestockId ? { livestockId, status: 'open' } : undefined
  );
  const settingsQuery = useFarmSettings();
  const settings = settingsQuery.data ?? DEFAULT_FARM_SETTINGS;
  const [imageViewerOpen, setImageViewerOpen] = useState(false);

  useEffect(() => {
    setImageViewerOpen(false);
  }, [livestockId]);

  useEffect(() => {
    if (!livestockId) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !imageViewerOpen) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [livestockId, imageViewerOpen, onClose]);

  const records = livestockId ? (productionQuery.data ?? []) : [];
  const medicalRecords = livestockId ? (medicalQuery.data ?? []) : [];
  const openAlerts = livestockId ? (alertsQuery.data ?? []) : [];
  const allLivestock = allLivestockQuery.data ?? [];

  const pedigree = useMemo(
    () =>
      livestockId ? buildAnimalPedigree(livestockId, allLivestock, records) : null,
    [livestockId, allLivestock, records]
  );

  const totalLiters = useMemo(
    () => roundAmount(records.reduce((sum, r) => sum + r.yieldAmount, 0)),
    [records]
  );

  if (!livestockId) {
    return null;
  }

  const animal = detailQuery.data;
  const imageSrc = resolveDesktopImageSrc(animal?.imageUri);

  return (
    <>
      <div
        className="modal-backdrop quick-preview-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Livestock quick preview"
        onClick={onClose}
      >
        <div
          className="modal-card detail-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <h2 className="modal-title">
              {animal ? `${animal.name || animal.tagNumber} Preview` : 'Livestock Preview'}
            </h2>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              aria-label="Close quick preview"
            >
              <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
            </button>
          </div>

          {detailQuery.isLoading || !animal ? (
            <p style={{ color: 'var(--text-muted)' }}>
              {detailQuery.isLoading
                ? 'Loading animal record...'
                : 'Animal record could not be found.'}
            </p>
          ) : (
            <>
              <div className="detail-hero">
                {imageSrc ? (
                  <button
                    type="button"
                    className="detail-photo-btn"
                    onClick={() => setImageViewerOpen(true)}
                    title="View full image"
                  >
                    <img
                      src={imageSrc}
                      alt={animal.name ?? animal.tagNumber}
                      className="detail-photo"
                    />
                    <span className="detail-photo-zoom-badge" aria-hidden="true">
                      <Maximize2 size={13} />
                    </span>
                  </button>
                ) : (
                  <div className="detail-photo-empty">
                    <img
                      src={getSpeciesPngIcon(animal.species)}
                      alt={animal.species}
                      style={{ width: 56, height: 56, objectFit: 'contain' }}
                    />
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="tag-chip">{animal.tagNumber}</span>
                    <span className={`status-pill status-${animal.status}`} style={{ gap: 5 }}>
                      <img
                        src={getStatusPngIcon(animal.status)}
                        alt=""
                        style={{ width: 13, height: 13, objectFit: 'contain' }}
                      />
                      {formatStatusLabel(animal.status)}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      flexWrap: 'wrap',
                      margin: '10px 0 4px',
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: '1.3rem' }}>
                      {animal.name ?? 'Unnamed Animal'}
                    </h3>
                    {imageSrc && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setImageViewerOpen(true)}
                      >
                        <img src={APP_ICONS.image} alt="" className="app-icon-sm" />
                        View Image
                      </button>
                    )}
                  </div>

                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {formatSpeciesLabel(animal.species)}
                    {animal.breed ? ` · ${animal.breed}` : ''}
                  </p>
                </div>
              </div>

              <div className="detail-facts">
                <div className="detail-fact">
                  <p className="detail-fact-label">Date of Birth</p>
                  <p className="detail-fact-value">
                    {formatDisplayDate(animal.dob, settings.dateFormat)}
                  </p>
                </div>
                <div className="detail-fact">
                  <p className="detail-fact-label">Age</p>
                  <p className="detail-fact-value">{formatAnimalAge(animal.dob)}</p>
                </div>
                <div className="detail-fact">
                  <p className="detail-fact-label">Recorded Milk Yield</p>
                  <p className="detail-fact-value">
                    {formatVolume(totalLiters, settings.volumeUnit)} ({records.length} logs)
                  </p>
                </div>
                <div className="detail-fact">
                  <p className="detail-fact-label">Medical / Open Alerts</p>
                  <p className="detail-fact-value">
                    {medicalRecords.length} med · {openAlerts.length} open
                  </p>
                </div>
              </div>

              {pedigree && (pedigree.sire || pedigree.dam) && (
                <div className="detail-lineage-box">
                  <div className="lineage-pill-row">
                    {pedigree.sire ? (
                      <button
                        type="button"
                        className="lineage-rel-pill"
                        onClick={() => onSelectAnimal(pedigree.sire!.animal.id)}
                      >
                        <span className="lineage-rel-role">Sire</span>
                        <strong>{pedigree.sire.animal.name ?? pedigree.sire.animal.tagNumber}</strong>
                        <span className="tag-chip">{pedigree.sire.animal.tagNumber}</span>
                      </button>
                    ) : null}
                    {pedigree.dam ? (
                      <button
                        type="button"
                        className="lineage-rel-pill"
                        onClick={() => onSelectAnimal(pedigree.dam!.animal.id)}
                      >
                        <span className="lineage-rel-role">Dam</span>
                        <strong>{pedigree.dam.animal.name ?? pedigree.dam.animal.tagNumber}</strong>
                        <span className="tag-chip">{pedigree.dam.animal.tagNumber}</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="modal-footer" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={onClose}
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {animal && (
        <ImageLightboxModal
          open={imageViewerOpen && Boolean(imageSrc)}
          src={imageSrc}
          title={animal.name ?? animal.tagNumber}
          subtitle={`${animal.tagNumber} · ${formatSpeciesLabel(animal.species)}`}
          caption={
            animal.imageUri && !animal.imageUri.startsWith('data:')
              ? animal.imageUri
              : undefined
          }
          onClose={() => setImageViewerOpen(false)}
        />
      )}
    </>
  );
}

export function AnimalQuickPreviewProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const openPreview = useCallback((id: string) => setPreviewId(id), []);
  const closePreview = useCallback(() => setPreviewId(null), []);
  const value = useMemo(
    () => ({ openPreview, closePreview }),
    [openPreview, closePreview]
  );

  return (
    <AnimalQuickPreviewContext.Provider value={value}>
      {children}
      <AnimalQuickPreviewDialog
        livestockId={previewId}
        onSelectAnimal={openPreview}
        onClose={closePreview}
      />
    </AnimalQuickPreviewContext.Provider>
  );
}
