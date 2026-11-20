import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_FARM_SETTINGS,
  findCanonicalBreed,
  formatBreedHint,
  formatSexLabel,
  formatSpeciesLabel,
  formatStatusLabel,
  getBreedsForSpecies,
  getEligibleParentCandidates,
  inferDefaultLivestockSex,
  LIVESTOCK_SEXES,
  LIVESTOCK_STATUS_HINTS,
  LIVESTOCK_STATUSES,
  SPECIES_LIST,
  validateNewLivestock,
  validateUpdateLivestock,
  type Livestock,
  type LivestockSex,
  type LivestockStatus,
  type NewLivestockInput,
  type Species,
  type ValidationErrors,
} from '@farmdb/core';
import {
  LivestockValidationError,
  useCreateLivestock,
  useFarmSettings,
  useLivestockList,
  useModulePermissions,
  useUpdateLivestock,
} from '@farmdb/db';
import {
  APP_ICONS,
  getSexPngIcon,
  getSpeciesPngIcon,
  getStatusPngIcon,
} from '../assets/icons';
import {
  deleteManagedDesktopImage,
  isTauriEnvironment,
  pickAndSaveDesktopImage,
  readBrowserPreviewImageFile,
  resolveDesktopImageSrc,
} from '../services/imageStorage';
import { buildAnimalSelectOption } from '../utils/animalOptions';
import { ModernDatePicker } from './ModernDatePicker';
import { ModernSelect, type ModernSelectOption } from './ModernSelect';

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
  const settingsQuery = useFarmSettings();
  const defaultSpecies =
    settingsQuery.data?.defaultSpecies ?? DEFAULT_FARM_SETTINGS.defaultSpecies;
  const allLivestockQuery = useLivestockList({});
  const createMutation = useCreateLivestock();
  const updateMutation = useUpdateLivestock();
  const { canEdit: canEditLineage } = useModulePermissions('family_tree');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [tagNumber, setTagNumber] = useState('');
  const [species, setSpecies] = useState<Species>(defaultSpecies);
  const [sex, setSex] = useState<LivestockSex>('female');
  const [sexTouched, setSexTouched] = useState(false);
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [dob, setDob] = useState('');
  const [status, setStatus] = useState<LivestockStatus>('active');
  const [sireId, setSireId] = useState<string>('');
  const [damId, setDamId] = useState<string>('');
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
      setSex(editing.sex ?? inferDefaultLivestockSex(editing.tagNumber));
      setSexTouched(true);
      setName(editing.name ?? '');
      setBreed(editing.breed ?? '');
      setDob(editing.dob ?? '');
      setStatus(editing.status);
      setSireId(editing.sireId ?? '');
      setDamId(editing.damId ?? '');
      setImageUri(editing.imageUri);
    } else {
      setTagNumber('');
      setSpecies(defaultSpecies);
      setSex('female');
      setSexTouched(false);
      setName('');
      setBreed('');
      setDob('');
      setStatus('active');
      setSireId('');
      setDamId('');
      setImageUri(null);
    }
    setSessionImportedUris([]);
    setErrors({});
    setSubmitError(null);
  }, [open, editing, defaultSpecies]);

  const allLivestock = allLivestockQuery.data ?? [];

  const sireOptions = useMemo<ModernSelectOption<string>[]>(() => {
    const candidates = getEligibleParentCandidates(
      editing?.id ?? null,
      'sire',
      allLivestock,
      damId || null,
      species
    );
    return [
      { value: '', label: 'Unknown / Founder', iconSrc: APP_ICONS.tree },
      ...candidates.map((item) =>
        buildAnimalSelectOption(item, {
          label: `${item.tagNumber}${item.name ? ` · ${item.name}` : ''}`,
        })
      ),
    ];
  }, [allLivestock, editing, species, damId]);

  const damOptions = useMemo<ModernSelectOption<string>[]>(() => {
    const candidates = getEligibleParentCandidates(
      editing?.id ?? null,
      'dam',
      allLivestock,
      sireId || null,
      species
    );
    return [
      { value: '', label: 'Unknown / Founder', iconSrc: APP_ICONS.tree },
      ...candidates.map((item) =>
        buildAnimalSelectOption(item, {
          label: `${item.tagNumber}${item.name ? ` · ${item.name}` : ''}`,
        })
      ),
    ];
  }, [allLivestock, editing, species, sireId]);

  const sexOptions = useMemo<ModernSelectOption<LivestockSex>[]>(
    () =>
      LIVESTOCK_SEXES.map((sx) => ({
        value: sx,
        label: formatSexLabel(sx),
        iconSrc: getSexPngIcon(sx),
      })),
    []
  );

  type SpeciesSelectorValue = 'cow' | 'bull' | 'goat' | 'sheep' | 'duck' | 'other';
  const speciesOptions = useMemo<ModernSelectOption<SpeciesSelectorValue>[]>(
    () => [
      { value: 'cow', label: 'Cow', iconSrc: getSpeciesPngIcon('cow', 'female') },
      { value: 'bull', label: 'Bull', iconSrc: getSpeciesPngIcon('cow', 'male') },
      ...SPECIES_LIST.filter((sp) => sp !== 'cow').map((sp) => ({
        value: sp as SpeciesSelectorValue,
        label: formatSpeciesLabel(sp),
        iconSrc: getSpeciesPngIcon(sp),
      })),
    ],
    []
  );
  const selectedSpeciesOption: SpeciesSelectorValue =
    species === 'cow' ? (sex === 'male' ? 'bull' : 'cow') : species;

  const statusOptions = useMemo<ModernSelectOption<LivestockStatus>[]>(
    () =>
      LIVESTOCK_STATUSES.map((st) => ({
        value: st,
        label: formatStatusLabel(st),
        iconSrc: getStatusPngIcon(st),
        hint: LIVESTOCK_STATUS_HINTS[st],
      })),
    []
  );

  const breedOptions = useMemo<ModernSelectOption<string>[]>(() => {
    const defs = getBreedsForSpecies(species);
    const spIcon = getSpeciesPngIcon(species, sex);
    const list: ModernSelectOption<string>[] = [
      {
        value: '',
        label: 'Not Specified / Unknown',
        iconSrc: spIcon,
        hint: 'Leave breed blank if unknown or mixed.',
      },
      ...defs.map((def) => ({
        value: def.name,
        label: def.name,
        iconSrc: spIcon,
        hint: formatBreedHint(def),
      })),
    ];
    const trimmedCurrent = breed.trim();
    if (
      trimmedCurrent &&
      !defs.some((d) => d.name.toLowerCase() === trimmedCurrent.toLowerCase())
    ) {
      list.splice(1, 0, {
        value: trimmedCurrent,
        label: `${trimmedCurrent} (Legacy Record)`,
        iconSrc: spIcon,
        hint: 'Existing breed recorded before dictionary standardization.',
      });
    }
    return list;
  }, [species, sex, breed]);

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
        {
          tagNumber,
          species,
          sex,
          name,
          breed,
          dob,
          status,
          imageUri,
          sireId: sireId || null,
          damId: damId || null,
        },
        {
          existingTags,
          currentTag: editing.tagNumber,
          currentId: editing.id,
          currentSpecies: editing.species,
          currentBreed: editing.breed,
          currentDob: editing.dob,
          allLivestock,
        }
      );
      if (!check.ok || !check.data) {
        setErrors(check.errors);
        return;
      }
      setErrors({});
      try {
        const updatePayload = canEditLineage
          ? check.data
          : {
              ...check.data,
              sireId: editing.sireId ?? null,
              damId: editing.damId ?? null,
            };
        await updateMutation.mutateAsync({ id: editing.id, input: updatePayload });
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
      {
        tagNumber,
        species,
        sex,
        name,
        breed,
        dob,
        status,
        imageUri,
        sireId: sireId || null,
        damId: damId || null,
      },
      { existingTags, allLivestock }
    );
    if (!check.ok || !check.data) {
      setErrors(check.errors);
      return;
    }
    setErrors({});
    try {
      const createPayload = canEditLineage
        ? check.data
        : {
            ...check.data,
            sireId: null,
            damId: null,
          };
      await createMutation.mutateAsync(createPayload);
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
      <div className="modal-card livestock-form-modal">
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
            <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="photo-picker-box">
            <div className={`photo-preview-frame ${previewSrc ? '' : 'is-empty'}`}>
              {previewSrc ? (
                <img src={previewSrc} alt={tagNumber || 'Animal preview'} />
              ) : (
                <img src={APP_ICONS.image} alt="No photo" />
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
                  <img src={APP_ICONS.image} alt="" className="app-icon-sm" />
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
                    <img src={APP_ICONS.delete} alt="" className="app-icon-sm" />
                    Remove
                  </button>
                )}
              </div>
              <span className="photo-uri-hint">
                {imageUri
                  ? imageUri.startsWith('data:')
                    ? 'Optimized Cloud & Offline Photo ready'
                    : imageUri
                  : 'Optimized automatically for offline SQLite & cloud sync.'}
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
                onChange={(e) => {
                  const nextTag = e.target.value;
                  setTagNumber(nextTag);
                  if (!sexTouched) {
                    setSex(inferDefaultLivestockSex(nextTag));
                  }
                }}
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
              <ModernSelect
                id="species"
                fullWidth
                ariaLabel="Species"
                value={selectedSpeciesOption}
                options={speciesOptions}
                onChange={(nextChoice) => {
                  const nextSpecies: Species =
                    nextChoice === 'bull' ? 'cow' : nextChoice;
                  if (nextSpecies !== species) {
                    setSireId('');
                    setDamId('');
                    if (breed.trim() && !findCanonicalBreed(nextSpecies, breed)) {
                      setBreed('');
                    }
                  }
                  setSpecies(nextSpecies);
                  if (nextChoice === 'bull') {
                    setSex('male');
                    setSexTouched(true);
                  } else if (nextChoice === 'cow') {
                    setSex('female');
                    setSexTouched(true);
                  }
                }}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="animal-sex">
                Sex *
              </label>
              <ModernSelect
                id="animal-sex"
                fullWidth
                ariaLabel="Sex"
                value={sex}
                options={sexOptions}
                onChange={(nextSex) => {
                  setSex(nextSex);
                  setSexTouched(true);
                }}
              />
              {errors.sex && (
                <span className="field-error">{errors.sex}</span>
              )}
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
                Breed (Validated Dictionary)
              </label>
              <ModernSelect
                id="breed"
                fullWidth
                searchable
                showSelectedHint
                ariaLabel="Breed"
                placeholder="Select breed (e.g. Holstein, Ankole, Boer...)"
                value={breed}
                options={breedOptions}
                onChange={setBreed}
              />
              {errors.breed && (
                <span className="field-error">{errors.breed}</span>
              )}
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="dob">
                Date of Birth
              </label>
              <ModernDatePicker
                id="dob"
                ariaLabel="Date of Birth"
                placeholder="Optional birth date"
                allowClear
                value={dob}
                onChange={setDob}
              />
              {errors.dob && <span className="field-error">{errors.dob}</span>}
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="status">
                Status
              </label>
              <ModernSelect
                id="status"
                fullWidth
                showSelectedHint
                ariaLabel="Status"
                value={status}
                options={statusOptions}
                onChange={setStatus}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="sire-select">
                Sire (Father)
              </label>
              <ModernSelect
                id="sire-select"
                fullWidth
                searchable
                disabled={!canEditLineage}
                ariaLabel="Sire (Father)"
                value={sireId}
                options={sireOptions}
                onChange={setSireId}
              />
              {!canEditLineage && (
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Requires Family Tree Edit permission
                </span>
              )}
              {errors.sireId && (
                <span className="field-error">{errors.sireId}</span>
              )}
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="dam-select">
                Dam (Mother)
              </label>
              <ModernSelect
                id="dam-select"
                fullWidth
                searchable
                disabled={!canEditLineage}
                ariaLabel="Dam (Mother)"
                value={damId}
                options={damOptions}
                onChange={setDamId}
              />
              {!canEditLineage && (
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Requires Family Tree Edit permission
                </span>
              )}
              {errors.damId && (
                <span className="field-error">{errors.damId}</span>
              )}
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
