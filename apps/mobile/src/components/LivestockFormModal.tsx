import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
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
  useLivestockList,
  useModulePermissions,
  useUpdateLivestock,
} from '@farmdb/db';
import {
  getSpeciesPngSource,
  getStatusPngSource,
  MOBILE_APP_ICONS,
} from '../assets/icons';
import {
  captureLivestockPhoto,
  deleteManagedLivestockPhoto,
  pickLivestockPhotoFromLibrary,
} from '../services/imageStorage';
import {
  FARMDB_COLORS,
  FARMDB_FONTS,
  useUiScale,
} from '../theme/uiScale';
import { buildAnimalDropdownOption } from '../utils/animalOptions';
import { AppIcon, SexIcon, SpeciesIcon } from './FarmIcons';
import { FarmScrollView } from './FarmScrollView';
import { ModernDatePicker } from './ModernDatePicker';
import {
  ModernDropdown,
  type ModernDropdownOption,
} from './ModernDropdown';

interface LivestockFormModalProps {
  visible: boolean;
  editing: Livestock | null;
  existingTags: string[];
  onClose: () => void;
}

export function LivestockFormModal({
  visible,
  editing,
  existingTags,
  onClose,
}: LivestockFormModalProps) {
  const ui = useUiScale();
  const iconMode = ui.settings.mobileIconMode;
  const defaultSpecies = ui.settings.defaultSpecies;
  const allLivestockQuery = useLivestockList({});
  const createMutation = useCreateLivestock();
  const updateMutation = useUpdateLivestock();
  const { canEdit: canEditLineage } = useModulePermissions('family_tree');

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
    if (!visible) return;
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
  }, [visible, editing, defaultSpecies]);

  const allLivestock = allLivestockQuery.data ?? [];

  const sireOptions = useMemo<ModernDropdownOption<string>[]>(() => {
    const candidates = getEligibleParentCandidates(
      editing?.id ?? null,
      'sire',
      allLivestock,
      damId || null,
      species
    );
    return [
      { value: '', label: 'Unknown / Founder', iconSource: MOBILE_APP_ICONS.tree },
      ...candidates.map((item) =>
        buildAnimalDropdownOption(item, {
          label: `${item.tagNumber}${item.name ? ` · ${item.name}` : ''}`,
        })
      ),
    ];
  }, [allLivestock, editing, species, damId]);

  const damOptions = useMemo<ModernDropdownOption<string>[]>(() => {
    const candidates = getEligibleParentCandidates(
      editing?.id ?? null,
      'dam',
      allLivestock,
      sireId || null,
      species
    );
    return [
      { value: '', label: 'Unknown / Founder', iconSource: MOBILE_APP_ICONS.tree },
      ...candidates.map((item) =>
        buildAnimalDropdownOption(item, {
          label: `${item.tagNumber}${item.name ? ` · ${item.name}` : ''}`,
        })
      ),
    ];
  }, [allLivestock, editing, species, sireId]);

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const statusOptions = useMemo<ModernDropdownOption<LivestockStatus>[]>(
    () =>
      LIVESTOCK_STATUSES.map((st) => ({
        value: st,
        label: formatStatusLabel(st),
        iconSource: getStatusPngSource(st),
        hint: LIVESTOCK_STATUS_HINTS[st],
      })),
    []
  );

  const breedOptions = useMemo<ModernDropdownOption<string>[]>(() => {
    const defs = getBreedsForSpecies(species);
    const spIcon = getSpeciesPngSource(species, sex);
    const list: ModernDropdownOption<string>[] = [
      {
        value: '',
        label: 'Not Specified / Unknown',
        iconSource: spIcon,
        hint: 'Leave breed blank if unknown or mixed.',
      },
      ...defs.map((def) => ({
        value: def.name,
        label: def.name,
        iconSource: spIcon,
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
        iconSource: spIcon,
        hint: 'Existing breed recorded before dictionary standardization.',
      });
    }
    return list;
  }, [species, sex, breed]);

  async function handleAcquirePhoto(source: 'camera' | 'library') {
    setSubmitError(null);
    setPickingImage(true);
    try {
      const savedUri =
        source === 'camera'
          ? await captureLivestockPhoto(tagNumber || 'animal')
          : await pickLivestockPhotoFromLibrary(tagNumber || 'animal');

      if (savedUri) {
        setSessionImportedUris((prev) => [...prev, savedUri]);
        setImageUri(savedUri);
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Unable to capture or select photo.'
      );
    } finally {
      setPickingImage(false);
    }
  }

  function handleCancel() {
    for (const uri of sessionImportedUris) {
      deleteManagedLivestockPhoto(uri);
    }
    onClose();
  }

  function cleanupAfterSave(finalUri: string | null | undefined) {
    const originalUri = editing?.imageUri ?? null;
    if (originalUri && originalUri !== finalUri) {
      deleteManagedLivestockPhoto(originalUri);
    }
    for (const uri of sessionImportedUris) {
      if (uri !== finalUri) {
        deleteManagedLivestockPhoto(uri);
      }
    }
  }

  async function handleSubmit() {
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
        cleanupAfterSave(check.data.imageUri);
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
      cleanupAfterSave(check.data.imageUri);
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
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View
            style={[
              styles.header,
              { paddingHorizontal: ui.contentPadding, paddingVertical: ui.space(13), gap: 10 },
            ]}
          >
            <Text style={[styles.title, { fontSize: ui.font(18), flex: 1, minWidth: 0 }]} numberOfLines={2}>
              {editing ? `Edit ${editing.tagNumber}` : 'Add Livestock'}
            </Text>
            <Pressable
              onPress={handleCancel}
              hitSlop={12}
              accessibilityLabel="Close form"
            >
              <AppIcon name="close" size={ui.font(22)} color={FARMDB_COLORS.text} />
            </Pressable>
          </View>

          <FarmScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { padding: ui.contentPadding, paddingBottom: ui.space(40) },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={[
                styles.photoBox,
                {
                  padding: ui.space(12),
                  borderRadius: ui.radius,
                  gap: ui.space(12),
                  flexWrap: 'wrap',
                },
              ]}
            >
              {imageUri ? (
                <Image
                  source={{ uri: imageUri }}
                  style={[
                    styles.photoPreview,
                    { width: ui.thumbSize + 18, height: ui.thumbSize + 18 },
                  ]}
                />
              ) : (
                <View
                  style={[
                    styles.photoEmpty,
                    { width: ui.thumbSize + 18, height: ui.thumbSize + 18 },
                  ]}
                >
                  <SpeciesIcon
                    species={species}
                    sex={sex}
                    size={ui.font(28)}
                    color={FARMDB_COLORS.textMuted}
                  />
                </View>
              )}

              <View style={[styles.photoActions, { minWidth: 160 }]}>
                <View style={styles.photoButtonRow}>
                  <Pressable
                    accessibilityLabel="Take photo"
                    style={[
                      styles.photoBtn,
                      {
                        minHeight: ui.chipHeight,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                      },
                    ]}
                    onPress={() => void handleAcquirePhoto('camera')}
                    disabled={pickingImage || isSubmitting}
                  >
                    <AppIcon
                      name="camera"
                      size={ui.font(16)}
                      color={FARMDB_COLORS.accent}
                    />
                    {!iconMode ? (
                      <Text style={[styles.photoBtnText, { fontSize: ui.font(12) }]}>
                        {pickingImage ? 'Working...' : 'Take Photo'}
                      </Text>
                    ) : null}
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Choose from library"
                    style={[
                      styles.photoBtn,
                      {
                        minHeight: ui.chipHeight,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                      },
                    ]}
                    onPress={() => void handleAcquirePhoto('library')}
                    disabled={pickingImage || isSubmitting}
                  >
                    <AppIcon
                      name="library"
                      size={ui.font(16)}
                      color={FARMDB_COLORS.accent}
                    />
                    {!iconMode ? (
                      <Text style={[styles.photoBtnText, { fontSize: ui.font(12) }]}>
                        Library
                      </Text>
                    ) : null}
                  </Pressable>
                  {imageUri ? (
                    <Pressable
                      accessibilityLabel="Remove photo"
                      style={[
                        styles.photoRemoveBtn,
                        {
                          minHeight: ui.chipHeight,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 5,
                        },
                      ]}
                      onPress={() => setImageUri(null)}
                      disabled={isSubmitting}
                    >
                      <AppIcon
                        name="trash"
                        size={ui.font(15)}
                        color={FARMDB_COLORS.danger}
                      />
                      {!iconMode ? (
                        <Text style={[styles.photoRemoveText, { fontSize: ui.font(12) }]}>
                          Remove
                        </Text>
                      ) : null}
                    </Pressable>
                  ) : null}
                </View>
                <Text style={[styles.photoHint, { fontSize: ui.font(11) }]}>
                  {imageUri
                    ? 'Saved locally on device'
                    : 'Stored in app documents (URI saved in SQLite)'}
                </Text>
              </View>
            </View>

            <Text style={[styles.label, { fontSize: ui.font(13) }]}>
              Tag Number *
            </Text>
            <TextInput
              style={[styles.input, { minHeight: ui.controlHeight, fontSize: ui.font(15) }]}
              placeholder="e.g. COW-402"
              value={tagNumber}
              onChangeText={(nextTag) => {
                setTagNumber(nextTag);
                if (!sexTouched) {
                  setSex(inferDefaultLivestockSex(nextTag));
                }
              }}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {errors.tagNumber ? (
              <Text style={[styles.errorText, { fontSize: ui.font(12) }]}>
                {errors.tagNumber}
              </Text>
            ) : null}

            <Text style={[styles.label, { fontSize: ui.font(13) }]}>Species</Text>
            <View style={styles.chipRow}>
              {(
                [
                  { id: 'cow', speciesVal: 'cow' as Species, sexVal: 'female' as LivestockSex, label: 'Cow' },
                  { id: 'bull', speciesVal: 'cow' as Species, sexVal: 'male' as LivestockSex, label: 'Bull' },
                  ...SPECIES_LIST.filter((sp) => sp !== 'cow').map((sp) => ({
                    id: sp,
                    speciesVal: sp,
                    sexVal: undefined,
                    label: formatSpeciesLabel(sp),
                  })),
                ] as Array<{ id: string; speciesVal: Species; sexVal?: LivestockSex; label: string }>
              ).map((opt) => {
                const active =
                  opt.id === 'bull'
                    ? species === 'cow' && sex === 'male'
                    : opt.id === 'cow'
                      ? species === 'cow' && sex === 'female'
                      : species === opt.speciesVal;
                return (
                  <Pressable
                    key={opt.id}
                    accessibilityLabel={opt.label}
                    style={[
                      styles.chip,
                      active && styles.chipActive,
                      {
                        minHeight: ui.chipHeight,
                        paddingHorizontal: ui.space(iconMode ? 14 : 12),
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      },
                    ]}
                    onPress={() => {
                      if (opt.speciesVal !== species) {
                        setSireId('');
                        setDamId('');
                        if (breed.trim() && !findCanonicalBreed(opt.speciesVal, breed)) {
                          setBreed('');
                        }
                      }
                      setSpecies(opt.speciesVal);
                      if (opt.sexVal) {
                        setSex(opt.sexVal);
                        setSexTouched(true);
                      }
                    }}
                  >
                    <SpeciesIcon
                      species={opt.speciesVal}
                      sex={opt.sexVal}
                      size={ui.font(18)}
                      color={active ? FARMDB_COLORS.accentHover : FARMDB_COLORS.text}
                    />
                    {!iconMode ? (
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                          { fontSize: ui.font(13) },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { fontSize: ui.font(13) }]}>Sex *</Text>
            <View style={styles.chipRow}>
              {LIVESTOCK_SEXES.map((sx) => {
                const active = sex === sx;
                return (
                  <Pressable
                    key={sx}
                    accessibilityLabel={formatSexLabel(sx)}
                    style={[
                      styles.chip,
                      active && styles.chipActive,
                      {
                        minHeight: ui.chipHeight,
                        paddingHorizontal: ui.space(14),
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      },
                    ]}
                    onPress={() => {
                      setSex(sx);
                      setSexTouched(true);
                    }}
                  >
                    <SexIcon sex={sx} size={ui.font(14)} />
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                        { fontSize: ui.font(13) },
                      ]}
                    >
                      {formatSexLabel(sx)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.sex ? (
              <Text style={[styles.errorText, { fontSize: ui.font(12) }]}>
                {errors.sex}
              </Text>
            ) : null}

            <Text style={[styles.label, { fontSize: ui.font(13) }]}>Name</Text>
            <TextInput
              style={[styles.input, { minHeight: ui.controlHeight, fontSize: ui.font(15) }]}
              placeholder="e.g. Bessie"
              value={name}
              onChangeText={setName}
            />

            <Text style={[styles.label, { fontSize: ui.font(13) }]}>
              Breed (Validated Dictionary)
            </Text>
            <ModernDropdown
              searchable
              showSelectedHint
              value={breed}
              options={breedOptions}
              title={`Select ${formatSpeciesLabel(species, sex)} Breed`}
              placeholder="Not Specified / Unknown"
              accessibilityLabel="Breed"
              onChange={setBreed}
            />
            {errors.breed ? (
              <Text style={[styles.errorText, { fontSize: ui.font(12) }]}>
                {errors.breed}
              </Text>
            ) : null}

            <Text style={[styles.label, { fontSize: ui.font(13) }]}>
              Date of Birth
            </Text>
            <ModernDatePicker
              title="Date of Birth"
              placeholder="Optional birth date"
              allowClear
              accessibilityLabel="Date of Birth"
              value={dob}
              onChange={setDob}
            />
            {errors.dob ? (
              <Text style={[styles.errorText, { fontSize: ui.font(12) }]}>
                {errors.dob}
              </Text>
            ) : null}

            <Text style={[styles.label, { fontSize: ui.font(13) }]}>Status</Text>
            <ModernDropdown
              showSelectedHint
              value={status}
              options={statusOptions}
              title="Select Status"
              accessibilityLabel="Status"
              onChange={setStatus}
            />

            <Text style={[styles.label, { fontSize: ui.font(13) }]}>
              Sire (Father)
            </Text>
            <ModernDropdown
              searchable
              disabled={!canEditLineage}
              value={sireId}
              options={sireOptions}
              title="Select Sire (Father)"
              accessibilityLabel="Sire (Father)"
              onChange={setSireId}
            />
            {!canEditLineage ? (
              <Text style={[styles.photoHint, { fontSize: ui.font(11), marginTop: 4 }]}>
                Requires Family Tree Edit permission
              </Text>
            ) : null}
            {errors.sireId ? (
              <Text style={[styles.errorText, { fontSize: ui.font(12) }]}>
                {errors.sireId}
              </Text>
            ) : null}

            <Text style={[styles.label, { fontSize: ui.font(13) }]}>
              Dam (Mother)
            </Text>
            <ModernDropdown
              searchable
              disabled={!canEditLineage}
              value={damId}
              options={damOptions}
              title="Select Dam (Mother)"
              accessibilityLabel="Dam (Mother)"
              onChange={setDamId}
            />
            {!canEditLineage ? (
              <Text style={[styles.photoHint, { fontSize: ui.font(11), marginTop: 4 }]}>
                Requires Family Tree Edit permission
              </Text>
            ) : null}
            {errors.damId ? (
              <Text style={[styles.errorText, { fontSize: ui.font(12) }]}>
                {errors.damId}
              </Text>
            ) : null}

            {submitError ? (
              <Text style={[styles.errorText, { marginTop: 12, fontSize: ui.font(12) }]}>
                {submitError}
              </Text>
            ) : null}

            <Pressable
              style={[
                styles.saveButton,
                (isSubmitting || pickingImage) && styles.saveButtonDisabled,
                { minHeight: ui.controlHeight + 4, justifyContent: 'center' },
              ]}
              onPress={() => void handleSubmit()}
              disabled={isSubmitting || pickingImage}
            >
              <Text style={[styles.saveButtonText, { fontSize: ui.font(15) }]}>
                {isSubmitting
                  ? 'Saving...'
                  : editing
                    ? 'Save Changes'
                    : 'Save to SQLite'}
              </Text>
            </Pressable>
          </FarmScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f3ee',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd6c8',
  },
  title: {
    fontSize: 18,
    fontFamily: FARMDB_FONTS.bold,
    color: '#1c241e',
  },
  cancelText: {
    fontSize: 15,
    fontFamily: FARMDB_FONTS.semibold,
    color: '#2d6a4f',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  photoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    marginBottom: 8,
  },
  photoPreview: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#f0ece3',
  },
  photoEmpty: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#e6f2ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmptyText: {
    fontSize: 11,
    fontFamily: FARMDB_FONTS.semibold,
    color: '#5d675f',
  },
  photoActions: {
    flex: 1,
    gap: 6,
  },
  photoButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  photoBtn: {
    backgroundColor: '#e6f2ec',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  photoBtnText: {
    fontSize: 12,
    fontFamily: FARMDB_FONTS.bold,
    color: '#2d6a4f',
  },
  photoRemoveBtn: {
    backgroundColor: '#fdeceb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  photoRemoveText: {
    fontSize: 12,
    fontFamily: FARMDB_FONTS.bold,
    color: '#b42318',
  },
  photoHint: {
    fontSize: 11,
    fontFamily: FARMDB_FONTS.regular,
    color: '#5d675f',
  },
  label: {
    fontSize: 13,
    fontFamily: FARMDB_FONTS.semibold,
    color: '#1c241e',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: FARMDB_FONTS.regular,
    color: '#1c241e',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ddd6c8',
    backgroundColor: '#ffffff',
  },
  chipActive: {
    backgroundColor: '#e6f2ec',
    borderWidth: 1.5,
    borderColor: '#2d6a4f',
  },
  chipText: {
    fontSize: 13,
    fontFamily: FARMDB_FONTS.semibold,
    color: '#1c241e',
  },
  chipTextActive: {
    color: '#214e3a',
    fontFamily: FARMDB_FONTS.bold,
  },
  errorText: {
    color: '#b42318',
    fontSize: 12,
    fontFamily: FARMDB_FONTS.medium,
    marginTop: 4,
  },
  saveButton: {
    marginTop: 22,
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: FARMDB_FONTS.bold,
  },
});
