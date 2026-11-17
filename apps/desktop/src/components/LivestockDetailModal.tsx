import { useEffect, useMemo, useState } from 'react';
import { Camera, Pencil, Trash2, X } from 'lucide-react';
import {
  formatAnimalAge,
  formatIsoDate,
  formatSpeciesLabel,
  formatStatusLabel,
  LIVESTOCK_STATUSES,
  roundAmount,
  type Livestock,
  type LivestockStatus,
} from '@farmdb/core';
import {
  useAlertList,
  useDeleteLivestock,
  useLivestockDetail,
  useMedicalRecordList,
  useProductRecordList,
  useUpdateLivestock,
} from '@farmdb/db';
import {
  deleteManagedDesktopImage,
  resolveDesktopImageSrc,
} from '../services/imageStorage';

interface LivestockDetailModalProps {
  livestockId: string | null;
  onClose: () => void;
  onEdit: (animal: Livestock) => void;
}

export function LivestockDetailModal({
  livestockId,
  onClose,
  onEdit,
}: LivestockDetailModalProps) {
  const detailQuery = useLivestockDetail(livestockId);
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
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setConfirmDelete(false);
  }, [livestockId]);

  const records = livestockId ? (productionQuery.data ?? []) : [];
  const medicalRecords = livestockId ? (medicalQuery.data ?? []) : [];
  const openAlerts = livestockId ? (alertsQuery.data ?? []) : [];

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
            <X size={16} />
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
                <img
                  src={imageSrc}
                  alt={animal.name ?? animal.tagNumber}
                  className="detail-photo"
                />
              ) : (
                <div className="detail-photo-empty">
                  <Camera size={28} />
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="tag-chip">{animal.tagNumber}</span>
                  <span className={`status-pill status-${animal.status}`}>
                    {formatStatusLabel(animal.status)}
                  </span>
                </div>

                <h3 style={{ margin: '10px 0 4px', fontSize: '1.35rem' }}>
                  {animal.name ?? 'Unnamed Animal'}
                </h3>
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
                <p className="detail-fact-value">{formatIsoDate(animal.dob)}</p>
              </div>
              <div className="detail-fact">
                <p className="detail-fact-label">Age</p>
                <p className="detail-fact-value">{formatAnimalAge(animal.dob)}</p>
              </div>
              <div className="detail-fact">
                <p className="detail-fact-label">Recorded Milk Yield</p>
                <p className="detail-fact-value">
                  {totalLiters.toFixed(1)} L ({records.length} logs)
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
                    {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Keep
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={14} />
                  Delete Animal
                </button>
              )}

              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onEdit(animal)}
              >
                <Pencil size={14} />
                Edit Details / Photo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
