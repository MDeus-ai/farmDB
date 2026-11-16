import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
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

  const [tagNumber, setTagNumber] = useState('');
  const [species, setSpecies] = useState<Species>('cow');
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [dob, setDob] = useState('');
  const [status, setStatus] = useState<LivestockStatus>('active');
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
    } else {
      setTagNumber('');
      setSpecies('cow');
      setName('');
      setBreed('');
      setDob('');
      setStatus('active');
    }
    setErrors({});
    setSubmitError(null);
  }, [open, editing]);

  if (!open) {
    return null;
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    if (editing) {
      const check = validateUpdateLivestock(
        { tagNumber, species, name, breed, dob, status },
        { existingTags, currentTag: editing.tagNumber }
      );
      if (!check.ok || !check.data) {
        setErrors(check.errors);
        return;
      }
      setErrors({});
      try {
        await updateMutation.mutateAsync({ id: editing.id, input: check.data });
        onClose();
      } catch (err) {
        if (err instanceof LivestockValidationError) {
          setErrors(err.errors);
        } else {
          setSubmitError(err instanceof Error ? err.message : 'Failed to update record.');
        }
      }
      return;
    }

    const check = validateNewLivestock(
      { tagNumber, species, name, breed, dob, status },
      { existingTags }
    );
    if (!check.ok || !check.data) {
      setErrors(check.errors);
      return;
    }
    setErrors({});
    try {
      await createMutation.mutateAsync(check.data);
      onClose();
    } catch (err) {
      if (err instanceof LivestockValidationError) {
        setErrors(err.errors);
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Failed to save animal.');
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
            className="btn btn-secondary"
            onClick={onClose}
            aria-label="Close form"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
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
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
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
