import { useEffect, useMemo, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import {
  buildAnimalPedigree,
  DEFAULT_FARM_SETTINGS,
  formatAnimalAge,
  formatDisplayDate,
  formatSpeciesLabel,
  formatStatusLabel,
  formatVolume,
  LIVESTOCK_STATUSES,
  roundAmount,
  type Livestock,
  type LivestockStatus,
} from '@farmdb/core';
import {
  useAlertList,
  useDeleteLivestock,
  useFarmSettings,
  useLivestockDetail,
  useLivestockList,
  useMedicalRecordList,
  useProductRecordList,
  useUpdateLivestock,
} from '@farmdb/db';
import {
  APP_ICONS,
  getSpeciesPngIcon,
  getStatusPngIcon,
} from '../assets/icons';
import {
  deleteManagedDesktopImage,
  resolveDesktopImageSrc,
} from '../services/imageStorage';
import { ImageLightboxModal } from './ImageLightboxModal';

interface LivestockDetailModalProps {
  livestockId: string | null;
  onClose: () => void;
  onEdit: (animal: Livestock) => void;
  onSelectAnimal?: (id: string) => void;
  onOpenFamilyTree?: (id: string) => void;
}

export function LivestockDetailModal({
  livestockId,
  onClose,
  onEdit,
  onSelectAnimal,
  onOpenFamilyTree,
}: LivestockDetailModalProps) {
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
  const updateMutation = useUpdateLivestock();
  const deleteMutation = useDeleteLivestock();
  const settingsQuery = useFarmSettings();
  const settings = settingsQuery.data ?? DEFAULT_FARM_SETTINGS;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);

  useEffect(() => {
    setConfirmDelete(false);
    setImageViewerOpen(false);
  }, [livestockId]);

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

  async function handleStatusChange(nextStatus: LivestockStatus) {
    if (!animal || animal.status === nextStatus) return;
    await updateMutation.mutateAsync({
      id: animal.id,
      input: { status: nextStatus },
    });
  }

  async function handleDeleteConfirmed() {
    if (!animal) return;
    const oldImage = animal.imageUri;
    const removed = await deleteMutation.mutateAsync(animal.id);
    if (removed) {
      await deleteManagedDesktopImage(oldImage);
      onClose();
    }
  }

  return (
    <>
      <div className="modal-backdrop" role="dialog" aria-modal="true">
        <div className="modal-card detail-modal">
        <div className="modal-header">
          <h2 className="modal-title">
            {animal ? `${animal.name || animal.tagNumber} Profile` : 'Animal Profile'}
          </h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Close profile"
          >
            <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
          </button>
        </div>

        {detailQuery.isLoading || !animal ? (
          <p style={{ color: 'var(--text-muted)' }}>
            {detailQuery.isLoading
              ? 'Loading animal details...'
              : 'Record could not be found.'}
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
                  <h3 style={{ margin: 0, fontSize: '1.35rem' }}>
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

                {animal.imageUri && (
                  <p
                    className="photo-uri-hint"
                    style={{ marginTop: 10 }}
                    title={animal.imageUri}
                  >
                    File:{' '}
                    {animal.imageUri.startsWith('data:')
                      ? 'Browser preview image'
                      : animal.imageUri}
                  </p>
                )}
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

            <div className="status-switcher">
              <span className="form-label" style={{ marginRight: 4 }}>
                Quick Status:
              </span>
              {LIVESTOCK_STATUSES.map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`btn btn-sm ${
                    animal.status === st ? 'btn-primary' : 'btn-secondary'
                  }`}
                  disabled={updateMutation.isPending}
                  onClick={() => void handleStatusChange(st)}
                >
                  {formatStatusLabel(st)}
                </button>
              ))}
            </div>

            {pedigree && (
              <div className="detail-lineage-box">
                <div className="detail-lineage-head">
                  <span className="form-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <img src={APP_ICONS.tree} alt="" className="app-icon-sm" />
                    Family &amp; Lineage
                  </span>
                  {onOpenFamilyTree && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        onOpenFamilyTree(animal.id);
                        onClose();
                      }}
                    >
                      <img src={APP_ICONS.tree} alt="" className="app-icon-sm" />
                      Open Family Tree
                    </button>
                  )}
                </div>

                <div className="lineage-pill-row">
                  {pedigree.sire ? (
                    <button
                      type="button"
                      className="lineage-rel-pill"
                      onClick={() => onSelectAnimal?.(pedigree.sire!.animal.id)}
                    >
                      <span className="lineage-rel-role">Sire</span>
                      <strong>{pedigree.sire.animal.name ?? pedigree.sire.animal.tagNumber}</strong>
                      <span className="tag-chip">{pedigree.sire.animal.tagNumber}</span>
                    </button>
                  ) : (
                    <span className="lineage-rel-empty">Sire: Founder / Unassigned</span>
                  )}

                  {pedigree.dam ? (
                    <button
                      type="button"
                      className="lineage-rel-pill"
                      onClick={() => onSelectAnimal?.(pedigree.dam!.animal.id)}
                    >
                      <span className="lineage-rel-role">Dam</span>
                      <strong>{pedigree.dam.animal.name ?? pedigree.dam.animal.tagNumber}</strong>
                      <span className="tag-chip">{pedigree.dam.animal.tagNumber}</span>
                    </button>
                  ) : (
                    <span className="lineage-rel-empty">Dam: Founder / Unassigned</span>
                  )}

                  {pedigree.directOffspring.map((child) => (
                    <button
                      key={child.animal.id}
                      type="button"
                      className="lineage-rel-pill is-offspring"
                      onClick={() => onSelectAnimal?.(child.animal.id)}
                    >
                      <span className="lineage-rel-role">Offspring</span>
                      <strong>{child.animal.name ?? child.animal.tagNumber}</strong>
                      <span className="tag-chip">{child.animal.tagNumber}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {medicalRecords.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <p className="form-label" style={{ marginBottom: 6 }}>
                  Medical History Timeline
                </p>
                <div className="detail-facts" style={{ marginBottom: 0 }}>
                  {medicalRecords.slice(0, 4).map((med) => (
                    <div key={med.id} className="detail-fact">
                      <p className="detail-fact-label">{med.date}</p>
                      <p className="detail-fact-value">{med.condition}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {med.treatment}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {openAlerts.length > 0 && (
              <div className="detail-roadmap-note" style={{ marginBottom: 14 }}>
                <strong>Open Reminders / Notes:</strong>{' '}
                {openAlerts
                  .slice(0, 3)
                  .map((a) => `${a.title} (${a.triggerDate})`)
                  .join(' · ')}
              </div>
            )}

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              {confirmDelete ? (
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={deleteMutation.isPending}
                    onClick={() => void handleDeleteConfirmed()}
                  >
                    <img src={APP_ICONS.checkmark} alt="" className="app-icon-sm" />
                    {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setConfirmDelete(false)}
                  >
                    <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
                    Keep
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (settings.confirmBeforeDelete) {
                      setConfirmDelete(true);
                    } else {
                      void handleDeleteConfirmed();
                    }
                  }}
                >
                  <img src={APP_ICONS.delete} alt="" className="app-icon-sm" />
                  Delete Animal
                </button>
              )}

              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onEdit(animal)}
              >
                <img src={APP_ICONS.pencil} alt="" className="app-icon-sm" />
                Edit Details / Photo
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
