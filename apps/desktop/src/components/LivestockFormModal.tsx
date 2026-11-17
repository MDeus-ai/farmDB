import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2, X } from 'lucide-react';
import {
  formatSpeciesLabel,
  formatStatusLabel,
  LIVESTOCK_STATUSES,
  SPECIES_LIST,
  validateNewLivestock,
  validateUpdateLivestock,
  type Livestock,
  type LivestockStatus,
  type NewLivestockInput,
  type Species,
  type ValidationErrors,
} from '@farmdb/core';
import {
  LivestockValidationError,
  useCreateLivestock,
  useUpdateLivestock,
} from '@farmdb/db';
import {
  deleteManagedDesktopImage,
  isTauriEnvironment,
  pickAndSaveDesktopImage,
  readBrowserPreviewImageFile,
  resolveDesktopImageSrc,
} from '../services/imageStorage';

interface LivestockFormModalProps {
  open: boolean;
  editing: Livestock | null;
  existingTags: string[];
  onClose: () => void;
}

export function LivestockFormModal({
  open,
  editing,
  existingTags,
  onClose,
}: LivestockFormModalProps) {
  const createMutation = useCreateLivestock();
  const updateMutation = useUpdateLivestock();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [tagNumber, setTagNumber] = useState('');
  const [species, setSpecies] = useState<Species>('cow');
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [dob, setDob] = useState('');
  const [status, setStatus] = useState<LivestockStatus>('active');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [sessionImportedUris, setSessionImportedUris] = useState<string[]>([]);
  const [pickingImage, setPickingImage] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors<NewLivestockInput>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTagNumber(editing.tagNumber);
      setSpecies(editing.species);
      setName(editing.name ?? '');
      setBreed(editing.breed ?? '');
      setDob(editing.dob ?? '');
      setStatus(editing.status);
      setImageUri(editing.imageUri);
    } else {
      setTagNumber('');
      setSpecies('cow');
      setName('');
      setBreed('');
      setDob('');
      setStatus('active');
      setImageUri(null);
    }
    setSessionImportedUris([]);
    setErrors({});
    setSubmitError(null);
  }, [open, editing]);

  if (!open) {
    return null;
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const previewSrc = resolveDesktopImageSrc(imageUri);

  async function handlePickPhoto() {
    setSubmitError(null);
    if (!isTauriEnvironment()) {
      fileInputRef.current?.click();
      return;
    }

    setPickingImage(true);
    try {
      const savedPath = await pickAndSaveDesktopImage(tagNumber || 'animal');
      if (savedPath) {
        setSessionImportedUris((prev) => [...prev, savedPath]);
        setImageUri(savedPath);
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to import selected image.'
      );
    } finally {
      setPickingImage(false);
    }
  }

  async function handleBrowserFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setPickingImage(true);
    try {
      const dataUrl = await readBrowserPreviewImageFile(file);
      setImageUri(dataUrl);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to read selected image.'
      );
    } finally {
      setPickingImage(false);
    }
  }

  async function handleCancel() {
    for (const uri of sessionImportedUris) {
      await deleteManagedDesktopImage(uri);
    }
    onClose();
  }

  async function cleanupAfterSave(finalUri: string | null | undefined) {
    const originalUri = editing?.imageUri ?? null;
    if (originalUri && originalUri !== finalUri) {
      await deleteManagedDesktopImage(originalUri);
    }
    for (const uri of sessionImportedUris) {
      if (uri !== finalUri) {
        await deleteManagedDesktopImage(uri);
      }
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    if (editing) {
      const check = validateUpdateLivestock(
        { tagNumber, species, name, breed, dob, status, imageUri },
        { existingTags, currentTag: editing.tagNumber }
      );
      if (!check.ok || !check.data) {
        setErrors(check.errors);
        return;
      }
      setErrors({});
      try {
        await updateMutation.mutateAsync({ id: editing.id, input: check.data });
        await cleanupAfterSave(check.data.imageUri);
        onClose();
      } catch (err) {
        if (err instanceof LivestockValidationError) {
          setErrors(err.errors);
        } else {
          setSubmitError(
            err instanceof Error ? err.message : 'Failed to update record.'
          );
        }
      }
      return;
    }

    const check = validateNewLivestock(
      { tagNumber, species, name, breed, dob, status, imageUri },
      { existingTags }
    );
    if (!check.ok || !check.data) {
      setErrors(check.errors);
      return;
    }
    setErrors({});
    try {
      await createMutation.mutateAsync(check.data);
      await cleanupAfterSave(check.data.imageUri);
      onClose();
    } catch (err) {
      if (err instanceof LivestockValidationError) {
        setErrors(err.errors);
      } else {
        setSubmitError(
          err instanceof Error ? err.message : 'Failed to save animal.'
        );
      }
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">
            {editing ? `Edit ${editing.tagNumber}` : 'Add Livestock'}
          </h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void handleCancel()}
            aria-label="Close form"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="photo-picker-box">
            <div className="photo-preview-frame">
              {previewSrc ? (
                <img src={previewSrc} alt={tagNumber || 'Animal preview'} />
              ) : (
                <Camera size={24} />
              )}
            </div>

            <div className="photo-picker-actions">
              <div className="photo-picker-buttons">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void handlePickPhoto()}
                  disabled={pickingImage || isSubmitting}
                >
                  <ImagePlus size={15} />
                  {pickingImage
                    ? 'Importing...'
                    : previewSrc
                      ? 'Replace Photo'
                      : 'Choose Photo'}
                </button>
                {imageUri && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => setImageUri(null)}
                    disabled={isSubmitting}
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                )}
              </div>
              <span className="photo-uri-hint">
                {imageUri
                  ? imageUri.startsWith('data:')
                    ? 'Browser preview image selected'
                    : imageUri
                  : 'Stored as local file path (no SQLite blob).'}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => void handleBrowserFileChange(e)}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="tag-number">
                Tag Number *
              </label>
              <input
                id="tag-number"
                className="input"
                placeholder="e.g. COW-402"
                value={tagNumber}
                onChange={(e) => setTagNumber(e.target.value)}
                autoFocus
              />
              {errors.tagNumber && (
                <span className="field-error">{errors.tagNumber}</span>
              )}
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="species">
                Species
              </label>
              <select
                id="species"
                className="select"
                value={species}
                onChange={(e) => setSpecies(e.target.value as Species)}
              >
                {SPECIES_LIST.map((sp) => (
                  <option key={sp} value={sp}>
                    {formatSpeciesLabel(sp)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="animal-name">
                Name
              </label>
              <input
                id="animal-name"
                className="input"
                placeholder="e.g. Bessie"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="breed">
                Breed
              </label>
              <input
                id="breed"
                className="input"
                placeholder="e.g. Holstein"
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="dob">
                Date of Birth
              </label>
              <input
                id="dob"
                type="date"
                className="input"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
              {errors.dob && <span className="field-error">{errors.dob}</span>}
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                className="select"
                value={status}
                onChange={(e) => setStatus(e.target.value as LivestockStatus)}
              >
                {LIVESTOCK_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {formatStatusLabel(st)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {submitError && (
            <p className="field-error" style={{ marginTop: 12 }}>
              {submitError}
            </p>
          )}

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void handleCancel()}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || pickingImage}
            >
              {isSubmitting
                ? 'Saving...'
                : editing
                  ? 'Save Changes'
                  : 'Save Animal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
